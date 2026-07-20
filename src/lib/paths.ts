import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Path resolution helpers that work in BOTH:
 *  - Dev mode on Linux (`next dev` from /home/z/my-project)
 *  - Production standalone on Windows (Electron `server.js` from C:\Nova-EDMS\)
 *  - Production standalone on Linux (server.js from /home/z/my-project/)
 *
 * CRITICAL: Do NOT hardcode '/home/z/my-project' — Windows has no such path!
 * Use `process.cwd()` (the directory where server.js runs from) instead.
 * On Electron, server.js runs from the app root folder, so cwd() is correct.
 */

// Resolve the app root dynamically:
// - In Electron desktop: process.cwd() = the folder containing server.js (app root)
// - In dev: process.cwd() = /home/z/my-project
// - In standalone: process.cwd() = .next/standalone/ or the app root
const PROJECT_ROOT = process.cwd();

/**
 * Find the Python script `gen_excel_template.py`.
 * Only used for Excel generation; on Electron/Windows this won't be found
 * (Excel generation will use a JS fallback or fail gracefully).
 */
export function findExcelScript(): string {
  const candidates = [
    path.join(PROJECT_ROOT, 'scripts', 'gen_excel_template.py'),
    path.join(PROJECT_ROOT, '.next', 'standalone', 'scripts', 'gen_excel_template.py'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

/**
 * Find the Excel template file.
 */
export function findExcelTemplate(): string {
  const candidates = [
    path.join(PROJECT_ROOT, 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
    path.join(PROJECT_ROOT, '.next', 'standalone', 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

/**
 * Find the Python interpreter. Only relevant on Linux dev environment.
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
  return 'python3';
}

/**
 * Get the persistent storage directory for uploaded files.
 *
 * Strategy:
 * 1. If DATABASE_URL is set (Electron mode), use a `storage` folder
 *    INSIDE the Electron userData directory (so it's per-user and writable).
 * 2. Otherwise, use `<PROJECT_ROOT>/storage` (dev mode on Linux).
 *
 * This directory is OUTSIDE `public/` (which is read-only in standalone mode),
 * and is served via the /api/files/[transmittalId]/[filename] API route.
 */
let _cachedStorageRoot: string | null = null;

export function getStorageRoot(): string {
  if (_cachedStorageRoot) return _cachedStorageRoot;

  // In Electron mode, DATABASE_URL is set to a path under userData
  // We use the same parent directory for storage
  const dbUrl = process.env.DATABASE_URL || '';
  const candidates: string[] = [];

  if (dbUrl.startsWith('file:')) {
    // dbUrl = "file:C:\Users\TOSHIBA\AppData\Roaming\Nova EDMS\db\custom.db"
    // We want: C:\Users\TOSHIBA\AppData\Roaming\Nova EDMS\storage
    const dbPath = dbUrl.slice(5);
    const dbDir = path.dirname(dbPath);
    const userDataDir = path.dirname(dbDir); // remove "db"
    candidates.push(path.join(userDataDir, 'storage'));
  }

  // Dev mode / Linux
  candidates.push(path.join(PROJECT_ROOT, 'storage'));
  candidates.push(path.join(process.cwd(), 'storage'));

  for (const c of candidates) {
    try {
      mkdirSync(c, { recursive: true });
      _cachedStorageRoot = c;
      return c;
    } catch {
      continue;
    }
  }

  // Last resort — OS temp dir (files will be wiped on reboot)
  const tmp = path.join(os.tmpdir(), 'nova-edms-storage');
  mkdirSync(tmp, { recursive: true });
  _cachedStorageRoot = tmp;
  return tmp;
}

/**
 * Get the IM gateway upload directory (only on Z.ai Linux platform).
 * Returns null on Windows/Electron (no such directory exists).
 */
export function getImUploadDir(): string | null {
  const candidates = [
    '/home/z/my-project/upload',
    path.join(PROJECT_ROOT, 'upload'),
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
 * Example: .../storage/uploads/{id}/123-file.png → /api/files/{id}/123-file.png
 *          (or /api/uploads/{id}/123-file.png — both routes work)
 */
export function filePathToApiUrl(absPath: string): string {
  const storageRoot = getStorageRoot();
  const rel = path.relative(storageRoot, absPath);
  const normalized = rel.split(path.sep).filter(Boolean).join('/');
  return `/api/${normalized}`;
}

/**
 * Convert an API URL like `/api/files/{id}/{filename}` back to the absolute
 * filesystem path. Used by the file-serving route and the delete handler.
 */
export function apiUrlToFilePath(apiUrl: string): string {
  let rel = apiUrl.replace(/^\/+/, '');
  if (rel.startsWith('api/')) rel = rel.slice(4);
  // Normalize "files/" → "uploads/" for backwards compatibility
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
