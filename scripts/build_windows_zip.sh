#!/bin/bash
# Build a Windows portable zip of Site Secretary
# Includes: Next.js standalone build + Prisma Windows engine + Electron + Python portable + templates
set -e

cd /home/z/my-project
echo "=== 1. Building Next.js ==="
rm -rf .next
npx next build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

echo "=== 2. Preparing build directory ==="
BUILD_DIR="/tmp/site-secretary-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy standalone build
cp -r .next/standalone/* "$BUILD_DIR/"

# Copy Electron files
cp electron-main.js "$BUILD_DIR/"
cp preload.js "$BUILD_DIR/"
cp package.json "$BUILD_DIR/"

# Copy Prisma Windows engine (if available)
mkdir -p "$BUILD_DIR/node_modules/@prisma/client/runtime"
if [ -f "node_modules/@prisma/client/runtime/libquery_engine-windows.dll.node" ]; then
  cp node_modules/@prisma/client/runtime/libquery_engine-windows.dll.node "$BUILD_DIR/node_modules/@prisma/client/runtime/"
fi
# Also copy the darwin/linux engines as fallback
for engine in libquery_engine-darwin.dylib.node libquery_engine-debian-openssl-3.0.x.so.node libquery_engine-linux-gnu-openssl-3.0.x.so.node; do
  if [ -f "node_modules/@prisma/client/runtime/$engine" ]; then
    cp "node_modules/@prisma/client/runtime/$engine" "$BUILD_DIR/node_modules/@prisma/client/runtime/"
  fi
done

# Copy Prisma schema + migrations
mkdir -p "$BUILD_DIR/prisma"
cp prisma/schema.prisma "$BUILD_DIR/prisma/"

# Copy DB (seed database with categories + disciplines + doc types)
mkdir -p "$BUILD_DIR/db"
cp db/custom.db "$BUILD_DIR/db/" 2>/dev/null || echo "No DB file found (will be created on first run)"

# Create storage directory structure
mkdir -p "$BUILD_DIR/storage/uploads"
mkdir -p "$BUILD_DIR/storage/templates"

# Copy templates if they exist
if [ -d "public/templates" ]; then
  cp -r public/templates/* "$BUILD_DIR/storage/templates/" 2>/dev/null || true
fi

# Copy scripts (Python Excel generator)
if [ -d "scripts" ]; then
  mkdir -p "$BUILD_DIR/scripts"
  cp scripts/fill_template.py "$BUILD_DIR/scripts/" 2>/dev/null || true
  cp scripts/gen_excel_template.py "$BUILD_DIR/scripts/" 2>/dev/null || true
fi

echo "=== 3. Zipping ==="
mkdir -p /home/z/my-project/download
ZIP_PATH="/home/z/my-project/download/Site-Secretary-Windows.zip"
rm -f "$ZIP_PATH"
cd /tmp
zip -r "$ZIP_PATH" site-secretary-build/ -q
echo "Created: $ZIP_PATH"
ls -lh "$ZIP_PATH"

echo "=== Done ==="
