// Experimental sidecar: MD logs -> owned SQLite -> read-only UI reply file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { randomUUID } from 'node:crypto';
import { parseRecord } from '../recorder/log-format.mjs';
import { ProfileStore, runId, universeId } from './store.mjs';
import { checkPath } from '../bridge/src/session-path.js';
import { LoadFence, parseLoadRequest, CHALLENGE_RUN, FENCE_RUN, ACTIVE_RUN } from './load-fence.mjs';
import { PreviewService } from './preview-service.mjs';
import { PREVIEW_HELLO, PREVIEW_REPLY } from './preview-protocol.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export class ReplyPublicationError extends Error {
  constructor(cause) { super(`Profile reply publication failed: ${cause.message}`, { cause }); this.name='ReplyPublicationError'; }
}
export class ProfileConsumer {
  constructor({ root = ROOT, replyDirectory, renameReply = fs.renameSync,
    onReplyDelayed = (e) => console.error(`Profile reply publication delayed; retrying: ${e.code}`) }) {
    this.root = path.resolve(root); this.replyDirectory = path.resolve(replyDirectory);
    checkPath(this.replyDirectory, { directory: true }); this.stores = new Map();
    this.pendingReplies = new Map(); this.renameReply=renameReply; this.onReplyDelayed=onReplyDelayed;
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
      let status;
      try { status = this.stores.get(run).ingest(rows); }
      catch (e) { const store = this.stores.get(run); this.reply({ universe: store.id, run, state: 'ERROR', record: 0 }); throw e; }
      // A committed transaction and delivery of its acknowledgement are separate.
      // Publication failure must not turn valid committed data into a log error.
      this.reply(status); statuses.push(status);
    }
    return statuses;
  }
  reply({ universe, run, state, record }) {
    runId(run); if (!['READY', 'NEED_BASELINE', 'BUILDING', 'ERROR'].includes(state)) throw Error('Invalid reply');
    const pending=this.pendingReplies.get(run) || {};
    pending.latest={ universe, run, state, record }; this.pendingReplies.set(run,pending);
    return this.flushReplies(run);
  }
  flushReplies(onlyRun) {
    let published=false;
    for(const [run,pending] of this.pendingReplies) {
      if(onlyRun && onlyRun!==run) continue;
      try {
        // Retain at most one owned temporary file per run while replacement is
        // blocked. New commits supersede the desired ACK, not committed history.
        // Only publish the newest desired ACK, including a later genuine ERROR.
        const target=path.join(this.replyDirectory,run+'.reply');
        checkPath(target,{missing:true});
        if(pending.temp && JSON.stringify(pending.staged)!==JSON.stringify(pending.latest)) {
          // This exact temporary file was created by this consumer; never
          // discover/delete another process's retained evidence.
          checkPath(pending.temp);fs.unlinkSync(pending.temp);pending.temp=null;
        }
        if(!pending.temp) {
          const staged=pending.latest;
          const temp=path.join(this.replyDirectory,`${run}.${process.pid}.${randomUUID()}.tmp`);
          const fd=fs.openSync(temp,'wx');
          try { fs.writeFileSync(fd,`LSDB1|${staged.universe}|${run}|${staged.state}|${staged.record}|END\n`);fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
          pending.temp=temp;pending.staged=staged;
        }
        checkPath(pending.temp);
        try { this.renameReply(pending.temp,target); }
        catch(e) {
          if(!['EPERM','EACCES','EBUSY'].includes(e.code)) throw e;
          if(!pending.delayed) { pending.delayed=true;this.onReplyDelayed(e,run); }
          continue; // Retry on the next service poll without blocking the game.
        }
        published=true;pending.temp=null;
        this.pendingReplies.delete(run);
      } catch(e) { throw new ReplyPublicationError(e); }
    }
    return published;
  }
  seal(runs) {
    for (const run of runs) {
      // Retained temporary files are evidence; they must never be retried.
      this.pendingReplies.delete(run);
      this.stores.get(run)?.close(); this.stores.delete(run);
    }
  }
  close() { for (const s of this.stores.values()) s.close(); }
}

export class LogTail {
  constructor(filename) { this.filename = filename; this.offset = 0; this.pending = ''; this.decoder = new StringDecoder('utf8'); }
  poll(maxOffset = Infinity) {
    const stat = fs.statSync(this.filename);
    if (this.identity && (stat.dev !== this.identity.dev || stat.ino !== this.identity.ino)) throw Error('Per-run profile log replaced');
    this.identity ??= stat;
    if (stat.size < this.offset) throw Error('Per-run profile log truncated');
    if (Math.min(stat.size, maxOffset) <= this.offset) return [];
    const bytes = Buffer.alloc(Math.min(Math.min(stat.size, maxOffset) - this.offset, 4 * 1024 * 1024));
    const fd = fs.openSync(this.filename, 'r'); let count;
    try { count = fs.readSync(fd, bytes, 0, bytes.length, this.offset); } finally { fs.closeSync(fd); }
    this.offset += count; const lines = (this.pending + this.decoder.write(bytes.subarray(0, count))).split(/\r?\n/);
    this.pending = lines.pop(); if (this.pending.length > 1024 * 1024) throw Error('Oversized profile row'); return lines;
  }
}
export function startService({ logDirectory, replyDirectory, root = ROOT, interval = 250, notBefore = null,
  debugLog = null,
  onRunError = (e, name) => console.error(`Rejected profile log ${name}: ${e.message}`),
  onError = e => { console.error(e.message); process.exitCode = 1; } }) {
  if (notBefore !== null && (!Number.isFinite(notBefore) || notBefore < 0)) throw Error('Invalid launch time');
  const consumer = new ProfileConsumer({ root, replyDirectory }), tails = new Map(), failed = new Set();
  const fence = debugLog ? new LoadFence({root, replyDirectory, processStarted: notBefore ?? 0}) : null;
  const preview = debugLog ? new PreviewService({root,replyDirectory}) : null;
  let controlTail = null, pending = null, publishPending = false, activePending = null, timer, stopped = false, stopPromise;
  function names() {
    return fs.readdirSync(logDirectory).filter(n => /^profiles-session-\d+-\d+-loaded-[0-9_-]+\.log$/.test(n))
      .sort((a,b) => a.slice(a.indexOf('-loaded-')).localeCompare(b.slice(b.indexOf('-loaded-'))));
  }
  function eligible(name) {
    const run = name.slice(9,-4); runId(run);
    if ([CHALLENGE_RUN,FENCE_RUN,ACTIVE_RUN,PREVIEW_HELLO,PREVIEW_REPLY].includes(run)) throw Error('Reserved control run in profile log');
    if (fence?.isClosed(run)) return false;
    const file=path.join(logDirectory,name); checkPath(file);
    return notBefore === null || fs.statSync(file).birthtimeMs >= notBefore;
  }
  function stop({ drain = true } = {}) {
    if (stopped) return;
    clearInterval(timer);
    preview?.stop();
    const finish=()=>{try { if (drain) while (poll()) { /* Complete-row drain, excluding closed sessions. */ } }
      finally { stopped=true;consumer.close(); }};
    if(preview?.hasReaders()) {
      stopPromise ??= preview.waitForExit().then(finish);return stopPromise;
    }
    if(stopPromise)return stopPromise;
    finish();
  }
  function profiles(limits = null) {
    let progressed = false;
    for (const name of limits ? limits.keys() : names()) {
      if (failed.has(name) || !eligible(name)) continue;
      const file = path.join(logDirectory,name);
      // Close the preview's read transaction before any writer is constructed.
      // This delays ingestion by a poll, never native LoadGame/NewGame dispatch.
      preview?.suspend();if(preview?.hasReaders())return progressed;
      if (!tails.has(file)) tails.set(file,new LogTail(file));
      const tail=tails.get(file);
      try {
        const before=tail.offset, lines=tail.poll(limits?.get(name) ?? Infinity);
        progressed ||= tail.offset !== before;
        if (!lines.length) continue;
        // A file is never allowed to smuggle another session's records across a fence.
        for (const line of lines) {
          const at=line.indexOf('LSEV1|'); if(at<0) continue;
          const row=parseRecord(line.slice(at));
          if(row.run!==name.slice(9,-4)) throw Error('Profile filename/run mismatch');
          if(!tail.startup && row.kind==='RUN_BEGIN' && row.fields.database_protocol==='LSDB1') tail.startup=row;
        }
        const statuses=consumer.consume(lines);
        if(statuses.length) preview?.suspend();
        if(fence && statuses.length) activePending=statuses.at(-1);
      } catch(e) {
        if(e instanceof ReplyPublicationError) throw e;
        failed.add(name);
        if(tail.startup) {
          const row=tail.startup,id=universeId(row.fields.lifesigns_universe_id);runId(row.run);
          consumer.reply({universe:id,run:row.run,state:'ERROR',record:0});
          consumer.stores.get(row.run)?.close();consumer.stores.delete(row.run);
        }
        onRunError(e,name);
      }
    }
    return progressed;
  }
  function poll() {
    if(stopped) return false;
    let progressed=false;
    try {
      preview?.poll();
      if(fence) {
        // Read control before profiles, including after worker restart. Challenge
        // matching makes historical requests harmless; no timestamp guess here.
        if(!controlTail && fs.existsSync(debugLog)) { checkPath(debugLog);controlTail=new LogTail(debugLog); }
        if(controlTail) {
          for(const line of controlTail.poll()) {
            if(preview?.handle(line)) continue;
            const token=parseLoadRequest(line);
            if(!token || !fence.accepts(token)) continue;
            preview?.suspend();
            if(token===fence.state.ack) { publishPending=true; continue; }
            if(!pending) {
              const limits=new Map(names().filter(eligible).map(name=>[name,fs.statSync(path.join(logDirectory,name)).size]));
              pending={token,limits};
            }
          }
          // A PREPARE may be in a later bounded control chunk. Do not ingest
          // profiles before catching up to the current control-file boundary.
          if(controlTail.offset<fs.statSync(debugLog).size) return true;
        }
        if(pending) {
          progressed=profiles(pending.limits);
          const drained=[...pending.limits].every(([name,size])=>failed.has(name) || (tails.get(path.join(logDirectory,name))?.offset ?? 0)>=size);
          if(!drained) return true;
          const runs=[...new Set([...pending.limits.keys()].map(name=>name.slice(9,-4)).concat([...consumer.stores.keys()]))];
          fence.commit(pending.token,runs); // Durable closure BEFORE publication.
          consumer.seal(runs); pending=null;publishPending=true;activePending=null;
          console.log('LSLOAD1 service: old sessions durably fenced');
        }
        if(publishPending) { fence.publish();publishPending=false;progressed=true; }
      }
      progressed=consumer.flushReplies() || progressed;
      progressed=profiles() || progressed;
      if(fence && activePending) { fence.publishActive(activePending);activePending=null; }
      return progressed;
    } catch(e) {
      if(fence && ['EPERM','EACCES','EBUSY'].includes(e.code)) return false;
      stop({drain:false});onError(e);return false;
    }
  }
  timer=setInterval(poll,interval);poll();return {stop,poll};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let debugLog = null;
  if (args.length >= 2 && args.at(-2) === '--load-control') { debugLog = path.resolve(args.pop()); args.pop(); }
  const managed = args.length === 9 && args[4] === '--since' && args[6] === '--control-stdin' && args[7] === '--root';
  if ((!managed && args.length !== 4) || args[0] !== '--logs' || args[2] !== '--replies') throw Error('Usage: service.mjs --logs <directory> --replies <directory> [--since <UTC ISO time> --control-stdin]');
  const notBefore = managed ? Date.parse(args[5]) : null;
  let fatal = false;
  const service = startService({ logDirectory: path.resolve(args[1]), replyDirectory: path.resolve(args[3]), notBefore, debugLog, root: managed ? path.resolve(args[8]) : ROOT,
    onError: e => { fatal = true; console.error(e.message); process.exitCode = 1; process.stdin.destroy(); } });
  const shutdown = () => { service.stop(); process.stdin.destroy(); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  if (managed && !fatal) {
    process.stdin.setEncoding('utf8'); let command = '';
    process.stdin.on('data', data => { command += data; if (command.length > 64 || command.includes('\n')) shutdown(); });
    process.stdin.on('end', shutdown); process.stdin.on('error', shutdown); process.stdin.resume();
  }
}
