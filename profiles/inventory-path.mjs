import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkPath, sameFile } from '../bridge/src/session-path.js';

export const sameSnapshot = (a, b) => sameFile(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
// Metadata only. No hydration, attribute changes or path interpolation into code.
export function availability(file) {
  if (process.platform !== 'win32') return 'LOCAL_METADATA_ONLY';
  try {
    const value = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '[int][System.IO.File]::GetAttributes($env:LIFESIGNS_INVENTORY_ATTRIBUTE_PATH)'], {
      env: { ...process.env, LIFESIGNS_INVENTORY_ATTRIBUTE_PATH: file }, encoding: 'utf8', windowsHide: true, timeout: 10000
    }).trim();
    if (!/^-?\d+$/.test(value)) return 'UNKNOWN';
    const bits = Number(value) >>> 0;
    return bits & (0x1000 | 0x40000 | 0x400000 | 0x400) ? 'PROVIDER_OR_REPARSE' : 'LOCAL_METADATA_ONLY';
  } catch { return 'UNKNOWN'; }
}

export function readOnlyInput(file, getAvailability = availability) {
  checkAvailability(file, getAvailability);
  const info = checkPath(file);
  const fd = fs.openSync(file, 'r');
  if (!sameSnapshot(info, fs.fstatSync(fd))) { fs.closeSync(fd); throw Error('INPUT_CHANGED'); }
  return { info, fd };
}

export function checkAvailability(file, getAvailability = availability) {
  for (let p = path.resolve(file);; p = path.dirname(p)) {
    if (getAvailability(p) !== 'LOCAL_METADATA_ONLY') throw Error('UNAVAILABLE_OR_PROVIDER_INPUT');
    if (path.dirname(p) === p) return;
  }
}
