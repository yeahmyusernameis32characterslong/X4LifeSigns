import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { checkPath } from '../bridge/src/session-path.js';
import { readOnlyInput, availability, sameSnapshot, checkAvailability } from './inventory-path.mjs';

export async function inspectSave(file, { getAvailability = availability, maxBytes = 8 * 1024 ** 3,
  maxRefs = 2000000, maxDepth = 256, timeout = 600000, heapMb = 256, beforeVerify } = {}) {
  const name = path.basename(file); let input, worker;
  try {
    if (![maxBytes, maxRefs, maxDepth, timeout, heapMb].every(n => Number.isSafeInteger(n) && n > 0)) throw Error('INVALID_RESOURCE_LIMIT');
    input = readOnlyInput(file, getAvailability);
    const h = Buffer.alloc(2); fs.readSync(input.fd, h, 0, 2, 0);
    const gzip = h[0] === 31 && h[1] === 139;
    if (name.endsWith('.gz') && !gzip) throw Error('UNSUPPORTED_CONTAINER');
    const result = await new Promise(resolve => {
      let message, finished = false;
      const done = result => { if (!finished) { finished = true; clearTimeout(timer); resolve(result); } };
      worker = new Worker(new URL('./save-scan-worker.mjs', import.meta.url), {
        workerData: { file, info: input.info, gzip, maxBytes, maxRefs, maxDepth }, resourceLimits: { maxOldGenerationSizeMb: heapMb }, execArgv: []
      });
      const timer = setTimeout(() => { worker.terminate().then(() => done({ status: 'UNKNOWN', code: 'RESOURCE_LIMIT' })); }, timeout);
      worker.on('message', m => { message = m; });
      worker.on('error', () => { message = { status: 'UNKNOWN', code: 'WORKER_RESOURCE_OR_PARSE_FAILURE' }; });
      worker.on('exit', code => done(code === 0 && message ? message : { status: 'UNKNOWN', code: message?.code || 'WORKER_FAILED' }));
    });
    await beforeVerify?.(file);
    if (!sameSnapshot(input.info, fs.fstatSync(input.fd)) || !sameSnapshot(input.info, checkPath(file))) throw Error('INPUT_CHANGED');
    if (getAvailability(file) !== 'LOCAL_METADATA_ONLY') throw Error('INPUT_AVAILABILITY_CHANGED');
    return { name, bytes: input.info.size, modifiedUtc: new Date(input.info.mtimeMs).toISOString(), ...result };
  } catch (e) { return { name, status: 'UNKNOWN', code: /^[A-Z_]+$/.test(e.message) ? e.message : 'UNREADABLE_OR_UNSAFE_SAVE' }; }
  finally { if (worker) await worker.terminate(); if (input) fs.closeSync(input.fd); }
}

export async function inventorySaves(locations, options = {}) {
  const output = { mode: 'READ_ONLY_PREVIEW', coverage: 'DECLARED_LOCATIONS_ONLY', atomicInventory: false,
    complete: true, locations: [], saves: [], roots: [], unknowns: [], warnings: ['External/unregistered saves are outside this inventory.', 'No Apply operation is implemented.'] };
  const getAvailability = options.getAvailability || availability;
  if (!Array.isArray(locations) || !locations.length) { output.complete = false; output.unknowns.push({ code: 'NO_DECLARED_SAVE_LOCATIONS' }); return output; }
  const seen = new Set(), observations = []; let files = 0;
  async function walk(dir, location, relative = '') {
    try {
      checkAvailability(dir, getAvailability);
      checkPath(dir, { directory: true });
      const before = fs.readdirSync(dir).sort();
      observations.push({ file: dir, listing: before });
      for (const name of before) {
        if (++files > (options.maxFiles || 10000)) throw Error('RESOURCE_LIMIT');
        const file = path.join(dir, name), rel = relative ? relative + '/' + name : name;
        const stat = fs.lstatSync(file);
        if (stat.isDirectory() && !stat.isSymbolicLink()) { await walk(file, location, rel); continue; }
        let entry;
        observations.push({ file, info: stat });
        if (!/\.xml(?:\.gz)?$/i.test(name)) entry = { name, status: 'UNKNOWN', code: 'UNSUPPORTED_FILE' };
        else entry = await inspectSave(file, { ...options, getAvailability });
        entry.source = location + '/' + rel; output.saves.push(entry);
        if (entry.status === 'CHECKPOINT') output.roots.push({ ...entry.root, source: entry.source });
        if (entry.status === 'UNKNOWN') output.unknowns.push({ source: entry.source, universe: entry.universe, code: entry.code });
      }
      if (JSON.stringify(before) !== JSON.stringify(fs.readdirSync(dir).sort())) throw Error('INVENTORY_CHANGED');
    } catch (e) { output.complete = false; output.unknowns.push({ source: location + '/' + relative, code: /^[A-Z_]+$/.test(e.message) ? e.message : 'UNREADABLE_SAVE_LOCATION' }); }
  }
  for (const [i, value] of locations.entries()) {
    const folder = path.resolve(value), label = 'location-' + (i + 1);
    if (seen.has(folder)) continue; seen.add(folder); output.locations.push({ label, path: folder }); await walk(folder, label);
  }
  // A later scan may outlast a change to an earlier file/location. Recheck all
  // metadata/listings before publishing; this is still not an atomic snapshot.
  for (const o of observations) {
    try {
      checkAvailability(o.file, getAvailability);
      if (o.listing ? JSON.stringify(o.listing) !== JSON.stringify(fs.readdirSync(o.file).sort()) : !sameSnapshot(o.info, checkPath(o.file))) throw Error('INVENTORY_CHANGED');
    } catch { output.complete = false; output.unknowns.push({ code: 'INVENTORY_CHANGED' }); break; }
  }
  output.saves.sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0);
  output.roots.sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0);
  output.manifestDigest = createHash('sha256').update(JSON.stringify(output)).digest('hex');
  return output;
}
