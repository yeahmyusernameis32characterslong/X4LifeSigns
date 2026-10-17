import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseRecord } from './log-format.mjs';

// Optional OFFLINE readback. Collection never starts or depends on this process.
export async function inspectLog(file, { expectedRun, maxLineBytes = 1048576 } = {}) {
  let stat;
  try { stat = await lstat(file); } catch (error) { if (error.code === 'ENOENT') return { readiness: 'NO_FILE', launchFlag: 'UNAVAILABLE', writeConfirmation: 'UNAVAILABLE' }; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Input must be an ordinary single-link file');
  const hash = createHash('sha256'), runs = new Set(), open = new Set();
  const result = { readiness: 'NO_VALID_RUN', bytes: 0, validRows: 0, malformedRows: 0, oversizedRows: 0, incompleteBatches: 0, captureLimitMarkers: 0, lastRun: null, trackingLimited: false, launchFlag: 'UNAVAILABLE', writeConfirmation: 'UNAVAILABLE' };
  let pending = Buffer.alloc(0), skipping = false;
  function line(bytes) {
    let r;
    try { r = parseRecord(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { result.malformedRows++; return; }
    result.validRows++;
    if (r.kind === 'RUN_BEGIN') { result.lastRun = r.run; if (runs.size < 4096) runs.add(r.run); else result.trackingLimited = true; }
    if (r.kind === 'LIMIT') result.captureLimitMarkers++;
    const match = r.kind.match(/^(EVENT|SNAPSHOT)_(BEGIN|END)$/);
    if (match) {
      const key = `${r.run}/${r.seq}/${match[1]}`;
      if (match[2] === 'BEGIN') { if (open.size < 4096) open.add(key); else result.trackingLimited = true; }
      else if (!open.delete(key)) result.incompleteBatches++;
    }
  }
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk); result.bytes += chunk.length;
    let start = 0;
    for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
      const part = chunk.subarray(start, end);
      if (!skipping && pending.length + part.length <= maxLineBytes) line(Buffer.concat([pending, part]));
      else if (!skipping) result.oversizedRows++;
      pending = Buffer.alloc(0); skipping = false; start = end + 1;
    }
    const tail = chunk.subarray(start);
    if (!skipping && pending.length + tail.length <= maxLineBytes) pending = Buffer.concat([pending, tail]);
    else { if (!skipping) result.oversizedRows++; skipping = true; pending = Buffer.alloc(0); }
  }
  // A trailing fragment has no observed line terminator; do not call it complete.
  if (pending.length || skipping) result.malformedRows++;
  result.incompleteBatches += open.size;
  result.sha256 = hash.digest('hex');
  if (runs.size) result.readiness = expectedRun ? (runs.has(expectedRun) ? 'EXPECTED_RUN_OBSERVED' : 'EXPECTED_RUN_NOT_FOUND') : 'HISTORICAL_OUTPUT_ONLY';
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] !== '--events' || !args[1] || (args.length !== 2 && !(args.length === 4 && args[2] === '--run'))) {
    console.error('Usage: node recorder/check-log.mjs --events <native events.log> [--run <expected run marker>]');
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(await inspectLog(args[1], { expectedRun: args[3] }), null, 2)); }
    catch (error) { console.error(`Log inspection failed (${error.code || 'INVALID_INPUT'}).`); process.exitCode = 1; }
  }
}
