// Experimental sidecar: MD logs -> owned SQLite -> read-only UI reply file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { parseRecord } from '../recorder/log-format.mjs';
import { ProfileStore, runId } from './store.mjs';
import { checkPath } from '../bridge/src/session-path.js';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export class ProfileConsumer {
  constructor({ root = ROOT, replyDirectory }) {
    this.root = path.resolve(root); this.replyDirectory = path.resolve(replyDirectory);
    checkPath(this.replyDirectory, { directory: true }); this.stores = new Map();
  }
  consume(lines) {
    const groups = new Map();
    for (const line of lines) {
      const at = line.indexOf('LSEV1|'); if (at < 0) continue;
      const row = parseRecord(line.slice(at));
      // Old exploratory recordings are preserved, never implicitly imported.
      if (!Object.hasOwn(row.fields, 'record')) continue;
      if (row.kind === 'RUN_BEGIN') {
        if (row.fields.database_protocol !== 'LSDB1') continue;
        if (!this.stores.has(row.run)) this.stores.set(row.run, new ProfileStore(this.root, row.fields.lifesigns_universe_id, row.run));
      }
      if (!this.stores.has(row.run)) throw Error('Profile row received before owned startup');
      if (!groups.has(row.run)) groups.set(row.run, []); groups.get(row.run).push(row);
    }
    const statuses = [];
    for (const [run, rows] of groups) {
      try { const status = this.stores.get(run).ingest(rows); this.reply(status); statuses.push(status); }
      catch (e) { const store = this.stores.get(run); this.reply({ universe: store.id, run, state: 'ERROR', record: 0 }); throw e; }
    }
    return statuses;
  }
  reply({ universe, run, state, record }) {
    runId(run); if (!['READY', 'NEED_BASELINE', 'BUILDING', 'ERROR'].includes(state)) throw Error('Invalid reply');
    const target = path.join(this.replyDirectory, run + '.reply');
    checkPath(target, { missing: true });
    const temp = path.join(this.replyDirectory, `${run}.${process.pid}.tmp`);
    const fd = fs.openSync(temp, 'wx');
    try { fs.writeFileSync(fd, `LSDB1|${universe}|${run}|${state}|${record}|END\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, target); // Atomic replacement; Lua opens with FILE_SHARE_DELETE.
  }
  close() { for (const s of this.stores.values()) s.close(); }
}

export class LogTail {
  constructor(filename) { this.filename = filename; this.offset = 0; this.pending = ''; this.decoder = new StringDecoder('utf8'); }
  poll() {
    const stat = fs.statSync(this.filename); if (stat.size < this.offset) throw Error('Per-run profile log truncated');
    if (stat.size === this.offset) return [];
    const bytes = Buffer.alloc(Math.min(stat.size - this.offset, 4 * 1024 * 1024));
    const fd = fs.openSync(this.filename, 'r'); let count;
    try { count = fs.readSync(fd, bytes, 0, bytes.length, this.offset); } finally { fs.closeSync(fd); }
    this.offset += count; const lines = (this.pending + this.decoder.write(bytes.subarray(0, count))).split(/\r?\n/);
    this.pending = lines.pop(); if (this.pending.length > 1024 * 1024) throw Error('Oversized profile row'); return lines;
  }
}
export function startService({ logDirectory, replyDirectory, root = ROOT, interval = 250, onError = e => { console.error(e.message); process.exitCode = 1; } }) {
  const consumer = new ProfileConsumer({ root, replyDirectory }), tails = new Map(); let timer, stopped = false;
  function stop() { if (!stopped) { stopped = true; clearInterval(timer); consumer.close(); } }
  function poll() {
    if (stopped) return;
    try {
      const names = fs.readdirSync(logDirectory).filter(n => /^profiles-session-\d+-\d+-loaded-[0-9_-]+\.log$/.test(n)).sort((a, b) => a.slice(a.indexOf('-loaded-')).localeCompare(b.slice(b.indexOf('-loaded-'))));
      for (const name of names) { const file = path.join(logDirectory, name); if (!tails.has(file)) tails.set(file, new LogTail(file)); const lines = tails.get(file).poll(); if (lines.length) consumer.consume(lines); }
    } catch (e) { stop(); onError(e); }
  }
  timer = setInterval(poll, interval); poll(); return { stop, poll };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); if (args.length !== 4 || args[0] !== '--logs' || args[2] !== '--replies') throw Error('Usage: node profiles/service.mjs --logs <native recorder directory> --replies <optional recorder runtime directory>');
  const service = startService({ logDirectory: path.resolve(args[1]), replyDirectory: path.resolve(args[3]) });
  process.on('SIGINT', () => { service.stop(); process.exit(0); }); process.on('SIGTERM', () => { service.stop(); process.exit(0); });
}
