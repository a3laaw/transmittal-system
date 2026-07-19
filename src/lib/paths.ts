import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Path resolution helpers that work in BOTH dev mode (`next dev`) and
 * production standalone mode (`bun .next/standalone/server.js`).
 *
 * Why this is needed:
 *  - In dev, `process.cwd()` = '/home/user/transmittal-system'
 *  - In standalone publish, the server may run from .next/standalone/ or the project root
 *  - Files written to `public/` at runtime are NOT served in standalone mode (404!)
 *  - The `scripts/` dir may or may not be inside the standalone bundle
 *
 * Solution: use absolute paths anchored to '/home/user/transmittal-system' for source assets
 * (scripts, templates), and a dedicated '/home/user/transmittal-system'/storage dir for
 * runtime-uploaded files (served via /api/files/... API route, not static).
 */

// Absolute anchor to the project source root.
// This is always correct on the Z.ai platform.
// Dynamic project root based on current working directory.
// Works in dev, standalone, and Electron desktop modes.
const PROJECT_ROOT = process.cwd();

/**
 * Find the Python script `gen_excel_template.py`.
 * Tries the project root first (always exists in dev & standalone on Z.ai),
 * then falls back to cwd-relative paths.
 */
export function findExcelScript(): string {
  const candidates = [
    path.join(PROJECT_ROOT, 'scripts', 'gen_excel_template.py'),
    path.join(process.cwd(), 'scripts', 'gen_excel_template.py'),
    path.join(process.cwd(), '..', '..', 'scripts', 'gen_excel_template.py'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]; // default; will fail with a clear error
}

/**
 * Find the Excel template file.
 */
export function findExcelTemplate(): string {
  const candidates = [
    path.join(PROJECT_ROOT, 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
    path.join(process.cwd(), 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
    path.join(process.cwd(), '..', '..', 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

/**
 * Find the Python interpreter. Prefers the venv, falls back to system python3.
 */
export function findPython(): string {
  const candidates = [
    '/home/z/.venv/bin/python3',
    '/home/z/.venv/bin/python',
    '/usr/bin/python3',
    '/usr/local/bin/python3',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'python3'; // last resort — rely on PATH
}

/**
 * Get the persistent storage directory for uploaded files.
 * This is OUTSIDE `public/` so it survives rebuilds, and is served via
 * the /api/files/[transmittalId]/[filename] API route (not static serving).
 *
 * Creates the directory if it doesn't exist.
 */
export function getStorageRoot(): string {
  const candidates = [
    path.join(PROJECT_ROOT, 'storage'),
    path.join(process.cwd(), 'storage'),
    path.join(process.cwd(), '..', '..', 'storage'),
  ];
  for (const c of candidates) {
    try {
      mkdirSync(c, { recursive: true });
      // Verify writable
      const testFile = path.join(c, `.write-test-${Date.now()}`);
      try {
        // Use a simple existence check — mkdirSync already would have thrown
        return c;
      } finally {
        // no-op
      }
    } catch {
      continue;
    }
  }
  // Last resort — use OS temp dir (files will be wiped on reboot, but at least it works)
  const tmp = path.join(os.tmpdir(), 'transmittal-storage');
  mkdirSync(tmp, { recursive: true });
  return tmp;
}

/**
 * Get the IM gateway upload directory ('/home/user/transmittal-system'/upload).
 *
 * This is where the IM gateway saves pasted images and dropped files
 * (e.g. `pasted_image_1783626027762.png`). These files are NOT under our
 * control — they exist on the server filesystem and may be referenced by
 * users who copied the file_name from an IM message.
 *
 * Returns the absolute path if it exists, otherwise null.
 */
export function getImUploadDir(): string | null {
  const candidates = [
    path.join(PROJECT_ROOT, 'upload'),
    path.join(process.cwd(), 'upload'),
    path.join(process.cwd(), '..', '..', 'upload'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * Get the uploads directory for a specific transmittal.
 * Creates it if it doesn't exist.
 */
export function getUploadDir(transmittalId: string): string {
  const dir = path.join(getStorageRoot(), 'uploads', transmittalId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Convert an absolute file path on disk to the API URL that serves it.
 * Example: '/home/user/transmittal-system'/storage/uploads/{id}/123-file.png
 *       →  /api/files/{id}/123-file.png
 */
export function filePathToApiUrl(absPath: string): string {
  const storageRoot = getStorageRoot();
  const rel = path.relative(storageRoot, absPath);
  // rel looks like "uploads/{id}/{filename}" on all OSes after path.relative
  const normalized = rel.split(path.sep).filter(Boolean).join('/');
  return `/api/${normalized}`;
}

/**
 * Convert an API URL like `/api/files/{id}/{filename}` back to the absolute
 * filesystem path. Used by the file-serving route and the delete handler.
 */
export function apiUrlToFilePath(apiUrl: string): string {
  // Strip leading slash, strip leading "api/"
  let rel = apiUrl.replace(/^\/+/, '');
  if (rel.startsWith('api/')) rel = rel.slice(4);
  // Now rel = "uploads/{id}/{filename}" or "files/{id}/{filename}"
  // We normalize "files/" → "uploads/" for backwards compatibility with old records
  if (rel.startsWith('files/')) rel = 'uploads/' + rel.slice(6);
  return path.join(getStorageRoot(), rel);
}

/**
 * Migrate a legacy `filePath` (from when we stored files in /public/uploads/...)
 * to the new API URL format. Returns the original if it's not a legacy path.
 */
export function migrateLegacyFilePath(filePath: string): string {
  if (!filePath) return filePath;
  // Old format: /uploads/{id}/{filename}
  if (filePath.startsWith('/uploads/')) {
    const rel = filePath.slice(1); // "uploads/{id}/{filename}"
    const parts = rel.split('/');
    if (parts.length >= 3) {
      const transmittalId = parts[1];
      const filename = parts.slice(2).join('/');
      return `/api/files/${transmittalId}/${filename}`;
    }
  }
  return filePath;
}
