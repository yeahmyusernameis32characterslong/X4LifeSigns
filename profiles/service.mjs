// Experimental sidecar: MD logs -> owned SQLite -> read-only UI reply file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { randomUUID } from 'node:crypto';
import { parseRecord } from '../recorder/log-format.mjs';
import { ProfileStore, runId, universeId } from './store.mjs';
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
    const temp = path.join(this.replyDirectory, `${run}.${process.pid}.${randomUUID()}.tmp`);
    const fd = fs.openSync(temp, 'wx');
    try { fs.writeFileSync(fd, `LSDB1|${universe}|${run}|${state}|${record}|END\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, target); // Atomic replacement; Lua opens with FILE_SHARE_DELETE.
  }
  close() { for (const s of this.stores.values()) s.close(); }
}

export class LogTail {
  constructor(filename) { this.filename = filename; this.offset = 0; this.pending = ''; this.decoder = new StringDecoder('utf8'); }
  poll() {
    const stat = fs.statSync(this.filename);
    if (this.identity && (stat.dev !== this.identity.dev || stat.ino !== this.identity.ino)) throw Error('Per-run profile log replaced');
    this.identity ??= stat;
    if (stat.size < this.offset) throw Error('Per-run profile log truncated');
    if (stat.size === this.offset) return [];
    const bytes = Buffer.alloc(Math.min(stat.size - this.offset, 4 * 1024 * 1024));
    const fd = fs.openSync(this.filename, 'r'); let count;
    try { count = fs.readSync(fd, bytes, 0, bytes.length, this.offset); } finally { fs.closeSync(fd); }
    this.offset += count; const lines = (this.pending + this.decoder.write(bytes.subarray(0, count))).split(/\r?\n/);
    this.pending = lines.pop(); if (this.pending.length > 1024 * 1024) throw Error('Oversized profile row'); return lines;
  }
}
export function startService({ logDirectory, replyDirectory, root = ROOT, interval = 250, notBefore = null,
  onRunError = (e, name) => console.error(`Rejected profile log ${name}: ${e.message}`),
  onError = e => { console.error(e.message); process.exitCode = 1; } }) {
  if (notBefore !== null && (!Number.isFinite(notBefore) || notBefore < 0)) throw Error('Invalid launch time');
  const consumer = new ProfileConsumer({ root, replyDirectory }), tails = new Map(), failed = new Set(); let timer, stopped = false;
  function stop({ drain = true } = {}) {
    if (stopped) return;
    clearInterval(timer);
    try { if (drain) while (poll()) { /* Bounded chunks, until the closed game's logs are drained. */ } }
    finally { stopped = true; consumer.close(); }
  }
  function poll() {
    if (stopped) return false;
    let progressed = false;
    try {
      const names = fs.readdirSync(logDirectory).filter(n => /^profiles-session-\d+-\d+-loaded-[0-9_-]+\.log$/.test(n)).sort((a, b) => a.slice(a.indexOf('-loaded-')).localeCompare(b.slice(b.indexOf('-loaded-'))));
      for (const name of names) {
        if (failed.has(name)) continue;
        const file = path.join(logDirectory, name);
        // Windows creation time is independent of later writes/touches to retained logs.
        if (!tails.has(file)) {
          if (notBefore !== null && fs.statSync(file).birthtimeMs < notBefore) continue;
          tails.set(file, new LogTail(file));
        }
        const tail = tails.get(file);
        try {
          const before = tail.offset, lines = tail.poll();
          progressed ||= tail.offset !== before;
          if (!lines.length) continue;
          if (!tail.startup) {
            const first = lines.find(l => l.includes('LSEV1|'));
            if (first) { const row = parseRecord(first.slice(first.indexOf('LSEV1|'))); if (row.kind === 'RUN_BEGIN' && row.fields.database_protocol === 'LSDB1') tail.startup = row; }
          }
          consumer.consume(lines);
        } catch (e) {
          failed.add(name);
          if (tail.startup) {
            const row = tail.startup, id = universeId(row.fields.lifesigns_universe_id); runId(row.run);
            consumer.reply({ universe: id, run: row.run, state: 'ERROR', record: 0 });
            consumer.stores.get(row.run)?.close(); consumer.stores.delete(row.run);
          }
          onRunError(e, name);
        }
      }
    } catch (e) { stop({ drain: false }); onError(e); }
    return !stopped && progressed;
  }
  timer = setInterval(poll, interval); poll(); return { stop, poll };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const managed = args.length === 9 && args[4] === '--since' && args[6] === '--control-stdin' && args[7] === '--root';
  if ((!managed && args.length !== 4) || args[0] !== '--logs' || args[2] !== '--replies') throw Error('Usage: service.mjs --logs <directory> --replies <directory> [--since <UTC ISO time> --control-stdin]');
  const notBefore = managed ? Date.parse(args[5]) : null;
  let fatal = false;
  const service = startService({ logDirectory: path.resolve(args[1]), replyDirectory: path.resolve(args[3]), notBefore, root: managed ? path.resolve(args[8]) : ROOT,
    onError: e => { fatal = true; console.error(e.message); process.exitCode = 1; process.stdin.destroy(); } });
  const shutdown = () => { service.stop(); process.stdin.destroy(); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  if (managed && !fatal) {
    process.stdin.setEncoding('utf8'); let command = '';
    process.stdin.on('data', data => { command += data; if (command.length > 64 || command.includes('\n')) shutdown(); });
    process.stdin.on('end', shutdown); process.stdin.on('error', shutdown); process.stdin.resume();
  }
}
