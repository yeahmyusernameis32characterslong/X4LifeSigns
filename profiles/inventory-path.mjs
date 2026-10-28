import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkPath, sameFile } from '../bridge/src/session-path.js';

export const sameSnapshot = (a, b) => sameFile(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
// Metadata only. No hydration, attribute changes or path interpolation into code.
export function availabilityMany(files, { platform = process.platform, execute = execFileSync } = {}) {
  if (!files.length) return [];
  if (platform !== 'win32') return files.map(() => 'LOCAL_METADATA_ONLY');
  const unknown = () => files.map(() => 'UNKNOWN');
  try {
    // JSON travels as environment data, never interpolated into PowerShell code.
    // Every invocation reads fresh attributes; no across-file/scan cache.
    const values = JSON.parse(execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference='Stop'; $paths=ConvertFrom-Json -InputObject $env:LIFESIGNS_INVENTORY_ATTRIBUTE_PATHS; $values=@(foreach($p in $paths){try{[int][System.IO.File]::GetAttributes([string]$p)}catch{$null}}); ConvertTo-Json -InputObject $values -Compress"], {
      env: { ...process.env, LIFESIGNS_INVENTORY_ATTRIBUTE_PATHS: JSON.stringify(files) }, encoding: 'utf8', windowsHide: true, timeout: 10000
    }));
    if (!Array.isArray(values) || values.length !== files.length) return unknown();
    return values.map(value => {
      if (!Number.isInteger(value) || value < -2147483648 || value > 4294967295) return 'UNKNOWN';
      return (value >>> 0) & (0x1000 | 0x40000 | 0x400000 | 0x400) ? 'PROVIDER_OR_REPARSE' : 'LOCAL_METADATA_ONLY';
    });
  } catch { return unknown(); }
}
export function availability(file) {
  return availabilityMany([file])[0];
}

export function readOnlyInput(file, getAvailability = availability) {
  checkAvailability(file, getAvailability);
  const info = checkPath(file);
  const fd = fs.openSync(file, 'r');
  if (!sameSnapshot(info, fs.fstatSync(fd))) { fs.closeSync(fd); throw Error('INPUT_CHANGED'); }
  return { info, fd };
}

export function checkAvailability(file, getAvailability = availability) {
  const paths = [];
  for (let p = path.resolve(file);; p = path.dirname(p)) {
    paths.push(p);
    if (path.dirname(p) === p) break;
  }
  // Preserve injectable per-path checks; the production path batches only the
  // process launch, not the metadata observations or the before/after phases.
  const states = getAvailability === availability ? availabilityMany(paths) : paths.map(p => getAvailability(p));
  if (states.some(state => state !== 'LOCAL_METADATA_ONLY')) throw Error('UNAVAILABLE_OR_PROVIDER_INPUT');
}
