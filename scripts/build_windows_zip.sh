#!/bin/bash
# Build a CLEAN Windows portable zip of Site Secretary
# - No nested zip files
# - No skills/ folder (irrelevant)
# - No download/ folder (irrelevant)
# - Includes RUN.bat + Electron + Node.js standalone server
set -e

cd /home/z/my-project

echo "============================================================"
echo "  Building Site Secretary Windows portable zip (clean)"
echo "============================================================"
echo ""

echo "=== 1. Building Next.js (standalone) ==="
rm -rf .next
npx next build 2>&1 | tail -5

echo ""
echo "=== 2. Copying static + public to standalone ==="
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

echo ""
echo "=== 3. Preparing CLEAN build directory ==="
BUILD_DIR="/tmp/site-secretary-clean"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 1) Copy Next.js standalone build (server.js + node_modules + .next)
cp -r .next/standalone/* "$BUILD_DIR/"

# 2) REMOVE irrelevant folders that may have been copied from project root
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

# 3) Copy Electron files
cp electron-main.js "$BUILD_DIR/"
cp preload.js "$BUILD_DIR/"

# 4) Copy RUN.bat (Windows launcher)
cp RUN.bat "$BUILD_DIR/"

# 5) Copy README
cp README.md "$BUILD_DIR/"

# 6) Update package.json with main + name
python3 -c "
import json
with open('package.json') as f:
    pkg = json.load(f)
pkg['name'] = 'site-secretary'
pkg['version'] = '0.3.0'
pkg['main'] = 'electron-main.js'
with open('$BUILD_DIR/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
print('Updated package.json')
"

# 7) Copy Prisma schema + DB
mkdir -p "$BUILD_DIR/prisma"
cp prisma/schema.prisma "$BUILD_DIR/prisma/"

mkdir -p "$BUILD_DIR/db"
if [ -f "db/custom.db" ]; then
  cp db/custom.db "$BUILD_DIR/db/"
else
  echo "WARNING: No DB file — will be created on first run via ensureSeedData()"
fi

# 8) Create storage directory structure (empty uploads folder)
mkdir -p "$BUILD_DIR/storage/uploads"
mkdir -p "$BUILD_DIR/storage/templates"

# Copy templates if they exist
if [ -d "public/templates" ]; then
  cp -r public/templates/* "$BUILD_DIR/storage/templates/" 2>/dev/null || true
fi

# 9) Copy Prisma Windows engine (if available)
echo ""
echo "=== 4. Copying Prisma Windows engine ==="
PRISMA_RUNTIME_DIR="$BUILD_DIR/node_modules/@prisma/client/runtime"
mkdir -p "$PRISMA_RUNTIME_DIR"
for engine in libquery_engine-windows.dll.node libquery_engine-debian-openssl-3.0.x.so.node; do
  if [ -f "node_modules/@prisma/client/runtime/$engine" ]; then
    cp "node_modules/@prisma/client/runtime/$engine" "$PRISMA_RUNTIME_DIR/"
    echo "  Copied: $engine"
  fi
done

# 10) List final structure
echo ""
echo "=== 5. Final build structure (top-level) ==="
ls -la "$BUILD_DIR/" | head -20

echo ""
echo "=== 6. Checking for nested zip files ==="
NESTED_ZIPS=$(find "$BUILD_DIR" -name "*.zip" 2>/dev/null)
if [ -z "$NESTED_ZIPS" ]; then
  echo "✅ No nested zip files — clean!"
else
  echo "❌ Found nested zip files:"
  echo "$NESTED_ZIPS"
  echo "Removing them..."
  find "$BUILD_DIR" -name "*.zip" -delete
fi

echo ""
echo "=== 7. Zipping ==="
mkdir -p /home/z/my-project/download
ZIP_PATH="/home/z/my-project/download/Site-Secretary-Windows.zip"
rm -f "$ZIP_PATH"
cd /tmp
zip -r "$ZIP_PATH" site-secretary-clean/ -q
echo "✅ Created: $ZIP_PATH"
ls -lh "$ZIP_PATH"

echo ""
echo "=== 8. Verifying zip contents (top-level) ==="
unzip -l "$ZIP_PATH" | head -25
echo "..."
echo ""
echo "Total entries:"
unzip -l "$ZIP_PATH" | tail -1

echo ""
echo "=== 9. Looking for nested zips in final archive ==="
NESTED=$(unzip -l "$ZIP_PATH" | grep -i "\.zip" || true)
if [ -z "$NESTED" ]; then
  echo "✅ No nested zip files in final archive!"
else
  echo "❌ Found nested:"
  echo "$NESTED"
fi

echo ""
echo "============================================================"
echo "  ✅ DONE — Site-Secretary-Windows.zip is ready"
echo "============================================================"
