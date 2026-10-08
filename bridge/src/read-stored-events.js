import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openReadbackStore } from './session-store.js';

export function parseArgs(args) {
  if (args.length !== 2 || args[0] !== '--db' || !args[1] || args[1].startsWith('--')) {
    throw new Error('Usage: node bridge/src/read-stored-events.js --db <existing database>');
  }
  return resolve(args[1]);
}

export function main(args = process.argv.slice(2)) {
  const store = openReadbackStore(parseArgs(args));
  try {
    const rows = store.list();
    if (store.ownership) console.log(`Session ownership: ${JSON.stringify(store.ownership)}`);
    for (const row of rows) console.log(JSON.stringify(row));
    console.log(`Stored docking count: ${rows.length}`);
  } finally {
    store.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(`Readback error: ${error.message}`);
    process.exitCode = 1;
  }
}
