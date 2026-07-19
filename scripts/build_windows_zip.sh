#!/bin/bash
# Build a COMPLETE Windows portable zip of Site Secretary
# - Includes .next build output (FIXED: was missing before!)
# - Includes Electron for Windows (FIXED: was missing before!)
# - Includes RUN.bat that uses bundled electron.exe
# - No nested zips, no irrelevant folders
set -e

cd /home/z/my-project

echo "============================================================"
echo "  Building Site Secretary Windows portable zip (complete)"
echo "============================================================"
echo ""

echo "=== 1. Building Next.js (standalone) ==="
rm -rf .next
npx next build 2>&1 | tail -3

echo ""
echo "=== 2. Copying static assets to standalone/.next/ ==="
# CRITICAL: standalone output needs .next/static + .next/BUILD_ID
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
cp -r .next/BUILD_ID .next/standalone/.next/ 2>/dev/null || true
cp -r .next/server .next/standalone/.next/ 2>/dev/null || true
cp -r .next/required-server-files.json .next/standalone/.next/ 2>/dev/null || true
cp -r .next/routes-manifest.json .next/standalone/.next/ 2>/dev/null || true
cp -r .next/prerender-manifest.json .next/standalone/.next/ 2>/dev/null || true
cp -r .next/build-manifest.json .next/standalone/.next/ 2>/dev/null || true
cp -r .next/app-path-routes-manifest.json .next/standalone/.next/ 2>/dev/null || true

echo "=== 3. Verifying .next is in standalone ==="
ls .next/standalone/.next/BUILD_ID && echo "✓ BUILD_ID exists" || echo "❌ BUILD_ID MISSING"

echo ""
echo "=== 4. Preparing CLEAN build directory ==="
BUILD_DIR="/tmp/site-secretary-final"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy standalone build (includes server.js + node_modules + .next)
# Use cp -a to preserve hidden folders like .next/
cp -a .next/standalone/. "$BUILD_DIR/"

# REMOVE irrelevant folders
rm -rf "$BUILD_DIR/download"
rm -rf "$BUILD_DIR/skills"
rm -rf "$BUILD_DIR/scripts"
rm -rf "$BUILD_DIR/.zscripts"
rm -rf "$BUILD_DIR/examples"
rm -rf "$BUILD_DIR/mini-services"
rm -rf "$BUILD_DIR/tool-results"
rm -rf "$BUILD_DIR/.git"
rm -f "$BUILD_DIR/build.log"
rm -f "$BUILD_DIR/dev.log"
rm -f "$BUILD_DIR/server.log"
rm -f "$BUILD_DIR/tsconfig.tsbuildinfo"
# CRITICAL: Remove .env — it has Linux paths that break Windows.
# electron-main.js sets DATABASE_URL to userData/db/custom.db on Windows.
rm -f "$BUILD_DIR/.env"

echo ""
echo "=== 5. Verifying .next is in build dir ==="
ls "$BUILD_DIR/.next/BUILD_ID" && echo "✓ .next/BUILD_ID exists" || echo "❌ MISSING"

echo ""
echo "=== 6. Extracting Electron for Windows ==="
ELECTRON_DIR="/tmp/electron-extracted"
rm -rf "$ELECTRON_DIR"
mkdir -p "$ELECTRON_DIR"
cd "$ELECTRON_DIR"
unzip -q /tmp/electron-download/electron.zip
echo "Electron contents:"
ls -la *.exe *.dll *.pak 2>/dev/null | head -10
cd /home/z/my-project

# Copy ALL Electron files to the build dir (so electron.exe can run with its DLLs)
cp -r "$ELECTRON_DIR"/* "$BUILD_DIR/"
echo ""
echo "Electron files in build dir:"
ls "$BUILD_DIR/electron.exe" 2>&1 && echo "✓ electron.exe exists" || echo "❌ electron.exe MISSING"

# Copy Electron files
cp electron-main.js "$BUILD_DIR/"
cp preload.js "$BUILD_DIR/"
cp RUN.bat "$BUILD_DIR/"
cp README.md "$BUILD_DIR/"

# Update package.json
python3 -c "
import json
with open('package.json') as f:
    pkg = json.load(f)
pkg['name'] = 'site-secretary'
pkg['version'] = '0.3.0'
pkg['main'] = 'electron-main.js'
with open('$BUILD_DIR/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
print('✓ Updated package.json')
"

# Copy Prisma schema
mkdir -p "$BUILD_DIR/prisma"
cp prisma/schema.prisma "$BUILD_DIR/prisma/"

# Copy DB
mkdir -p "$BUILD_DIR/db"
if [ -f "db/custom.db" ]; then
  cp db/custom.db "$BUILD_DIR/db/"
fi

# Create storage
mkdir -p "$BUILD_DIR/storage/uploads"
mkdir -p "$BUILD_DIR/storage/templates"
if [ -d "public/templates" ]; then
  cp -r public/templates/* "$BUILD_DIR/storage/templates/" 2>/dev/null || true
fi

# Copy Prisma Windows engine
echo ""
echo "=== 7. Copying Prisma Windows engine ==="
PRISMA_RUNTIME_DIR="$BUILD_DIR/node_modules/@prisma/client/runtime"
mkdir -p "$PRISMA_RUNTIME_DIR"
for engine in libquery_engine-windows.dll.node libquery_engine-debian-openssl-3.0.x.so.node; do
  if [ -f "node_modules/@prisma/client/runtime/$engine" ]; then
    cp "node_modules/@prisma/client/runtime/$engine" "$PRISMA_RUNTIME_DIR/"
    echo "  Copied: $engine"
  fi
done

echo ""
echo "=== 8. Final structure (top-level) ==="
ls -la "$BUILD_DIR/" | head -30

echo ""
echo "=== 9. Critical files check ==="
[ -f "$BUILD_DIR/RUN.bat" ] && echo "✓ RUN.bat" || echo "❌ RUN.bat MISSING"
[ -f "$BUILD_DIR/electron.exe" ] && echo "✓ electron.exe" || echo "❌ electron.exe MISSING"
[ -f "$BUILD_DIR/electron-main.js" ] && echo "✓ electron-main.js" || echo "❌ electron-main.js MISSING"
[ -f "$BUILD_DIR/server.js" ] && echo "✓ server.js" || echo "❌ server.js MISSING"
[ -f "$BUILD_DIR/.next/BUILD_ID" ] && echo "✓ .next/BUILD_ID" || echo "❌ .next/BUILD_ID MISSING"
[ -d "$BUILD_DIR/node_modules" ] && echo "✓ node_modules/" || echo "❌ node_modules/ MISSING"

echo ""
echo "=== 10. Removing any nested zips ==="
find "$BUILD_DIR" -name "*.zip" -delete
echo "✓ Cleaned"

echo ""
echo "=== 11. Zipping ==="
mkdir -p /home/z/my-project/download
ZIP_PATH="/home/z/my-project/download/Site-Secretary-Windows.zip"
rm -f "$ZIP_PATH"
cd /tmp
zip -r "$ZIP_PATH" site-secretary-final/ -q
echo "✅ Created: $ZIP_PATH"
ls -lh "$ZIP_PATH"

echo ""
echo "=== 12. Final verification ==="
echo "Top-level files:"
unzip -l "$ZIP_PATH" | awk '{print $4}' | grep -E "^site-secretary-final/[^/]+$" | sort
echo ""
echo "Nested zips check:"
NESTED=$(unzip -l "$ZIP_PATH" | awk '{print $4}' | grep -E "\.zip$")
if [ -z "$NESTED" ]; then
  echo "✅ No nested zips"
else
  echo "❌ Found: $NESTED"
fi

echo ""
echo "============================================================"
echo "  ✅ DONE — Site-Secretary-Windows.zip is ready"
echo "============================================================"
