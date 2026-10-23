// Experimental load control. This ledger is separate from universe databases.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkPath } from '../bridge/src/session-path.js';
import { runId } from './store.mjs';

export const CHALLENGE_RUN = 'session-0-1-loaded-2000-01-01_00-00-00';
export const FENCE_RUN = 'session-0-2-loaded-2000-01-01_00-00-00';
export const ACTIVE_RUN = 'session-0-3-loaded-2000-01-01_00-00-00';
const owner = 'LifeSignsLoadFenceV1';
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(x);
export function parseLoadRequest(line) {
  // DebugError adds a game-owned prefix; nothing after END is accepted.
  const m = /(?:^|\s)LSLOAD1\|PREPARE\|([0-9a-f-]+)\|END\s*$/.exec(line);
  return m && uuid(m[1]) ? m[1] : null;
}
export class LoadFence {
  constructor({ root, replyDirectory, processStarted, rename = fs.renameSync }) {
    if (!Number.isFinite(processStarted) || processStarted < 0) throw Error('Invalid load fence process boundary');
    this.replyDirectory = replyDirectory; this.rename = rename; this.staged = new Map();
    checkPath(root, { directory: true }); checkPath(replyDirectory, { directory: true });
    const directory = path.join(root, 'local-data');
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    checkPath(directory, { directory: true });
    this.file = path.join(directory, 'profile-load-fence-v1.json');
    checkPath(this.file, { missing: true });
    let state;
    if (fs.existsSync(this.file)) {
      if (fs.statSync(this.file).size > 2 * 1024 * 1024) throw Error('Oversized load fence ledger');
      state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Object.keys(state).sort().join() !== 'ack,challenge,closed,owner,processStarted,version' ||
          state.owner !== owner || state.version !== 1 || !uuid(state.challenge) ||
          !(state.ack === null || uuid(state.ack)) || !Number.isFinite(state.processStarted) || state.processStarted < 0 ||
          !Array.isArray(state.closed) || state.closed.length > 10000 || new Set(state.closed).size !== state.closed.length)
        throw Error('Invalid load fence ledger');
      state.closed.forEach(runId);
    }
    if (!state || state.processStarted !== processStarted) {
      state = { owner, version: 1, processStarted, challenge: randomUUID(), ack: null, closed: state?.closed ?? [] };
      this.atomic(this.file, JSON.stringify(state));
    }
    this.state = state; this.closed = new Set(state.closed); this.publish();
  }
  atomic(target, text) {
    checkPath(target, { missing: true });
    let staged = this.staged.get(target);
    if (staged && staged.text !== text) {
      checkPath(staged.file); fs.unlinkSync(staged.file); this.staged.delete(target); staged = null;
    }
    if (!staged) {
      const file = `${target}.${process.pid}.${randomUUID()}.tmp`, fd = fs.openSync(file, 'wx');
      try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      staged = { file, text }; this.staged.set(target, staged);
    }
    checkPath(staged.file); this.rename(staged.file, target); this.staged.delete(target);
  }
  accepts(token) { return token === this.state.challenge || token === this.state.ack; }
  isClosed(run) { return this.closed.has(run); }
  commit(token, runs) {
    if (!uuid(token) || !this.accepts(token)) throw Error('Unknown load fence challenge');
    if (token === this.state.ack) return false; // Replay cannot seal a subsequent run.
    const closed = [...new Set([...this.state.closed, ...runs.map(runId)])];
    if (closed.length > 10000) throw Error('Load fence history capacity reached');
    const next = { ...this.state, challenge: randomUUID(), ack: token, closed };
    // An ACK is never staged until this replacement succeeds.
    this.atomic(this.file, JSON.stringify(next)); this.state = next; this.closed = new Set(closed);
    return true;
  }
  publish() {
    this.atomic(path.join(this.replyDirectory, CHALLENGE_RUN + '.reply'),
      `LSDB1|CONTROL|${CHALLENGE_RUN}|CHALLENGE|${this.state.challenge}|END\n`);
    if (this.state.ack) this.atomic(path.join(this.replyDirectory, FENCE_RUN + '.reply'),
      `LSDB1|CONTROL|${FENCE_RUN}|FENCED|${this.state.ack}|END\n`);
  }
  publishActive({ run, universe }) {
    if (this.isClosed(run)) return;
    const text = `LSDB1|CONTROL|${ACTIVE_RUN}|OPEN|${run}|${universe}|${this.state.challenge}|END\n`;
    if (text === this.activeText) return;
    this.atomic(path.join(this.replyDirectory, ACTIVE_RUN + '.reply'), text); this.activeText = text;
  }
}
