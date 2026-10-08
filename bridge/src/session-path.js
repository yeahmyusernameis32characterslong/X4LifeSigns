import { lstatSync, realpathSync, mkdirSync } from 'node:fs';
import { dirname, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSessionKey } from './session-key.js';

export const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SESSION_DIRECTORY = resolve(REPOSITORY_ROOT, 'local-data', 'sessions');
const fold = (path) => process.platform === 'win32' ? path.toLowerCase() : path;

export function fileInfo(path) {
  try { return lstatSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

// Walk all ancestors; reject symlinks, junctions, realpath redirection and hard links.
// These checks address existing objects, not hostile concurrent filesystem mutation.
export function checkPath(path, { directory = false, missing = false } = {}) {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  const parts = relative(root, absolute).split(sep).filter(Boolean);
  for (let i = 0; i <= parts.length; i++) {
    if (i) current = join(current, parts[i - 1]);
    const info = fileInfo(current);
    if (!info && missing && i === parts.length) return undefined;
    if (!info) throw new Error('Automatic storage path is missing');
    if (info.isSymbolicLink() || fold(resolve(realpathSync(current))) !== fold(current)) {
      throw new Error('Refusing linked/reparse automatic storage path');
    }
    const isDirectory = i < parts.length || directory;
    if (isDirectory ? !info.isDirectory() : !info.isFile() || info.nlink !== 1) {
      throw new Error('Unsafe automatic storage object (expected directory or single-link regular file)');
    }
    if (i === parts.length) return info;
  }
}

export function checkSidecars(filename) {
  // Never recover an interrupted transaction or follow a linked journal.
  for (const suffix of ['-journal', '-wal', '-shm']) {
    if (fileInfo(filename + suffix)) throw new Error('Refusing existing automatic database sidecar');
  }
}

export function sessionTarget(session, repositoryRoot = REPOSITORY_ROOT) {
  validateSessionKey(session); // Before any filesystem operation.
  const root = resolve(repositoryRoot);
  const directory = resolve(root, 'local-data', 'sessions');
  const filename = resolve(directory, `${session}.db`);
  if (dirname(filename) !== directory || relative(directory, filename) !== `${session}.db`) {
    throw new Error('Automatic database must remain inside the session directory');
  }
  checkPath(root, { directory: true });
  for (const path of [join(root, 'local-data'), directory]) {
    if (!fileInfo(path)) {
      try { mkdirSync(path); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    checkPath(path, { directory: true });
  }
  return filename;
}

export function sameFile(first, second) {
  return first && second && first.dev === second.dev && first.ino === second.ino &&
    first.birthtimeMs === second.birthtimeMs;
}
