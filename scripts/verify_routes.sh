#!/bin/bash
# Verify all critical API routes exist before building
cd /home/z/my-project
ERRORS=0

check_route() {
  local path="$1"
  local name="$2"
  if [ ! -f "$path" ]; then
    echo "❌ MISSING: $name ($path)"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ EXISTS: $name"
  fi
}

echo "=== Verifying critical API routes ==="
check_route "src/app/api/transmittals/route.ts" "Transmittals list/create"
check_route "src/app/api/transmittals/[id]/route.ts" "Transmittal detail"
check_route "src/app/api/transmittals/[id]/upload/route.ts" "File upload"
check_route "src/app/api/transmittals/[id]/attachments/route.ts" "Attachments list/delete"
check_route "src/app/api/files/[transmittalId]/[filename]/route.ts" "File serving"
check_route "src/app/api/file-data/[attId]/route.ts" "File data (base64)"
check_route "src/app/api/download/[attId]/route.ts" "File download"
check_route "src/app/api/excel-template/route.ts" "Excel template"
check_route "src/app/api/reports/export/route.ts" "Reports export"
check_route "src/app/api/import/route.ts" "Import"
check_route "src/app/api/categories/route.ts" "Categories"
check_route "src/app/api/categories/[code]/route.ts" "Category detail"
check_route "src/app/api/templates/[code]/route.ts" "Template serving"
check_route "src/app/api/disciplines/route.ts" "Disciplines"
check_route "src/app/api/doc-types/route.ts" "Doc types"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS route(s) missing! Restoring..."
  exit 1
else
  echo ""
  echo "✅ All critical routes exist!"
  exit 0
fi
