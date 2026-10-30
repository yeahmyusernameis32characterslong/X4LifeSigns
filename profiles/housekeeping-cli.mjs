// Read-only planner shared by the offline CLI and isolated menu scan process.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventorySaves } from './save-inventory.mjs';
import { inspectProfileDatabase } from './profile-inventory.mjs';
import { retentionPreview } from './retention-plan.mjs';
import { universeId } from './profile-schema.mjs';
import { checkAvailability, availability, sameSnapshot } from './inventory-path.mjs';
import { checkPath } from '../bridge/src/session-path.js';

export async function housekeeping({ saves, profiles, pins = [], ...options }) {
  const pinned = new Set(pins.map(universeId));
  const inventory = await inventorySaves(saves, options);
  const output = { mode: 'READ_ONLY_PREVIEW', applyAvailable: false, inventory, databases: [], unknowns: [] };
  const getAvailability = options.getAvailability || availability;
  try {
    checkAvailability(profiles, getAvailability); checkPath(profiles, { directory: true });
    const names = fs.readdirSync(profiles).sort(), observed = [];
    const total = names.filter(name => name.endsWith('.db')).length;
    options.onProgress?.({ stage: 'DATABASES', completed: 0, total });
    for (const name of names) {
      const file = path.join(profiles, name);
      if (!name.endsWith('.db')) { output.unknowns.push({ file: name, code: 'UNSUPPORTED_DATABASE_ENTRY' }); continue; }
      const before = fs.lstatSync(file);
      const snapshot = inspectProfileDatabase(file, options);
      observed.push({ file, before });
      options.onProgress?.({ stage: 'DATABASES', completed: observed.length, total });
      output.databases.push({ file: name, bytes: snapshot.bytes, ...retentionPreview(snapshot, inventory.roots, {
        complete: inventory.complete, unknowns: inventory.unknowns, pinned: pinned.has(snapshot.universe)
      }) });
    }
    options.onProgress?.({ stage: 'DATABASE_RECHECK', completed: 0, total: observed.length });
    for (const [i,o] of observed.entries()) {
      if (!sameSnapshot(o.before, checkPath(o.file))) throw Error('DATABASE_INVENTORY_CHANGED');
      options.onProgress?.({ stage: 'DATABASE_RECHECK', completed: i + 1, total: observed.length });
    }
    if (JSON.stringify(names) !== JSON.stringify(fs.readdirSync(profiles).sort())) throw Error('DATABASE_INVENTORY_CHANGED');
  } catch { output.unknowns.push({ code: 'UNAVAILABLE_OR_CHANGED_DATABASE_LOCATION' }); }
  for (const root of inventory.roots) if (!output.databases.some(d => d.universe === root.universe)) {
    output.unknowns.push({ universe: root.universe, code: 'MISSING_UNIVERSE_DATABASE' });
  }
  // An unexplained DB-directory entry may hide ownership. Do not expose numeric
  // candidates from this invocation while that inventory is uncertain.
  if (output.unknowns.length) for (const d of output.databases) if (d.status !== 'PINNED') {
    d.status = 'BLOCKED'; d.blocks.push('INCOMPLETE_DATABASE_INVENTORY'); d.candidates = null;
  }
  return output;
}

export async function main(args) {
  const options = { saves: [], pins: [] };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!['--saves', '--profiles', '--pin'].includes(key) || !value || value.startsWith('--')) throw Error('Usage: node profiles/housekeeping-cli.mjs --saves <folder> [--saves <folder>] --profiles <existing-folder> [--pin <universe-id>]');
    if (key === '--profiles') { if (options.profiles) throw Error('Duplicate --profiles'); options.profiles = value; }
    else options[key === '--saves' ? 'saves' : 'pins'].push(value);
  }
  if (!options.profiles || !options.saves.length) throw Error('Explicit --profiles and --saves locations are required');
  return housekeeping(options);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.stdout.write(JSON.stringify(await main(process.argv.slice(2)), null, 2) + '\n'); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
