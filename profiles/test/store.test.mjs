import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ProfileStore, universeId } from '../store.mjs';
import { ProfileConsumer, LogTail } from '../service.mjs';
import { escapeValue } from '../../recorder/log-format.mjs';

const id = 'lsu1-2026-10-21_12-00-00-1-2-3-4';
const A = 'session-1-2-loaded-2026-10-21_12-00-00', B = 'session-3-4-loaded-2026-10-21_12-01-00';
const row = (run, n, kind, fields = {}) => ({ run, session: 'UNAVAILABLE', seq: '1', age: String(n / 10), kind, fields: { record: String(n), ...fields } });
const start = (run = A, parent = 'NONE', cursor = '0') => row(run, 1, 'RUN_BEGIN', { database_protocol: 'LSDB1', lifesigns_universe_id: id, parent_run: parent, parent_record: cursor });
const baseline = [start(), row(A, 2, 'SNAPSHOT_BEGIN'), row(A, 3, 'PROFILE_BEGIN', { kind: 'NPC', profile: '1' }), row(A, 4, 'VALUE', { profile: '1', field: 'seed', value: '9223372036854775807', type: 'datatype.largeint', state: 'PRESENT' }), row(A, 5, 'VALUE', { profile: '1', field: 'name', value: 'Synthetic | % 船\nname', type: 'datatype.string', state: 'PRESENT' }), row(A, 6, 'PROFILE_END', { profile: '1', partial: '0' }), row(A, 7, 'SNAPSHOT_END', { profiles: '1', partial: '0' })];
const line = r => `LSEV1|run=${r.run}|session=${r.session}|seq=${r.seq}|age=${r.age}|${r.kind}|${Object.entries(r.fields).map(([k, v]) => `${k}=${escapeValue(v)}`).join('|')}|END`;
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifesigns-profile-test-')); const stores = [];
  const open = (run = A) => { const s = new ProfileStore(dir, id, run); stores.push(s); return s; };
  t.after(() => { for (const s of stores) s.close(); assert.equal(path.dirname(dir), path.resolve(os.tmpdir())); fs.rmSync(dir, { recursive: true }); });
  return { dir, open, track: s => stores.push(s) };
}

test('baseline remains staged until committed/read back and preserves exact profile values', t => {
  const { open } = fixture(t), s = open();
  assert.equal(s.ingest([baseline[0]]).state, 'NEED_BASELINE'); assert.equal(fs.existsSync(s.final), false);
  assert.equal(s.ingest(baseline.slice(1, 5)).state, 'BUILDING');
  assert.equal(s.ingest(baseline.slice(5)).state, 'READY'); assert.equal(fs.existsSync(s.final), true);
  const p = s.profilesAt()[0]; assert.equal(p.seed, '9223372036854775807'); assert.equal(p.fields.name.value, 'Synthetic | % 船\nname');
  assert.equal(s.db.prepare('SELECT ready FROM universe_metadata').get().ready, 1);
});

test('saved checkpoint isolates later profile versions while new run reuses ready universe', t => {
  const { open } = fixture(t), a = open(); a.ingest(baseline);
  a.ingest([row(A, 8, 'PROFILE_BEGIN', { kind: 'NPC', profile: '2' }), row(A, 9, 'VALUE', { profile: '2', field: 'seed', value: '9223372036854775807', type: 'datatype.largeint', state: 'PRESENT' }), row(A, 10, 'VALUE', { profile: '2', field: 'name', value: 'Later history', state: 'PRESENT', type: 'datatype.string' }), row(A, 11, 'PROFILE_END', { profile: '2', partial: '0' })]);
  a.close(); const b = open(B); assert.equal(b.ingest([start(B, A, '7')]).state, 'READY');
  assert.equal(b.profilesAt()[0].fields.name.value, baseline[4].fields.value, 'Later branch state must not be inherited');
  assert.equal(b.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 2);
  b.ingest([row(B, 2, 'ENTITY_EVENT', { event_type: 'ROLE_CHANGED', subject_kind: 'NPC', subject_seed: '9223372036854775807', assigned_ship_idcode: 'ABC-123', role: 'Marine' })]);
  const e = b.db.prepare('SELECT * FROM events').get(); assert.equal(e.subject_kind, 'NPC'); assert.equal(e.game_time, '0.2');
  assert.equal(JSON.parse(e.fields_json).assigned_ship_idcode, 'ABC-123');
});

test('restart reconstructs unfinished profile and identical replay is idempotent', t => {
  const { open } = fixture(t); const a = open(); a.ingest(baseline.slice(0, 5)); a.close();
  const b = open(); b.ingest(baseline); assert.equal(b.db.prepare('SELECT count(*) AS n FROM profile_versions').get().n, 1);
  b.ingest(baseline); assert.equal(b.db.prepare('SELECT count(*) AS n FROM records').get().n, 7);
  assert.throws(() => b.ingest([{ ...baseline[0], age: '999' }]), /Conflicting replay/);
});

test('ownership, malformed identifiers, gaps and unknown saved ancestors fail without success', t => {
  const { dir, open } = fixture(t); assert.throws(() => universeId('../escape')); assert.throws(() => universeId(id.replace('-1-2-', '-01-2-')));
  const a = open(); assert.throws(() => a.ingest([row(A, 2, 'SNAPSHOT_BEGIN')]), /Non-contiguous/);
  a.ingest(baseline); a.close(); const b = open(B);
  assert.throws(() => b.ingest([start(B, A, '999')]), /checkpoint not found/);
  assert.equal(b.db.prepare('SELECT count(*) AS n FROM sessions WHERE run_id=?').get(B).n, 0);
  b.close(); const db = new DatabaseSync(path.join(dir, 'local-data', 'profiles', id + '.db')); db.prepare('UPDATE universe_metadata SET universe_id=?').run(id.replace('-1-2-', '-2-2-')); db.close();
  assert.throws(() => new ProfileStore(dir, id, B), /ownership mismatch/);
});

test('consumer sends READY only after successful database commit and publishes no old diagnostic data', t => {
  const { dir, track } = fixture(t); const replyDirectory = path.join(dir, 'reply'); fs.mkdirSync(replyDirectory);
  const c = new ProfileConsumer({ root: dir, replyDirectory }); track(c);
  c.consume(baseline.slice(0, 1).map(line)); const reply = path.join(replyDirectory, A + '.reply'); assert.match(fs.readFileSync(reply, 'utf8'), /NEED_BASELINE\|1\|END/);
  c.consume(baseline.slice(1).map(line)); assert.match(fs.readFileSync(reply, 'utf8'), /READY\|7\|END/);
  const bad = row(A, 8, 'PROFILE_END', { profile: 'not-open' }); assert.throws(() => c.consume([line(bad)]));
  assert.match(fs.readFileSync(reply, 'utf8'), /ERROR\|0\|END/);
});

test('incremental tail retains incomplete UTF-8 rows and refuses truncation', t => {
  const { dir } = fixture(t), file = path.join(dir, 'synthetic.log'); const bytes = Buffer.from('first\n船\n');
  fs.writeFileSync(file, bytes.subarray(0, 7)); const tail = new LogTail(file); assert.deepEqual(tail.poll(), ['first']);
  fs.appendFileSync(file, bytes.subarray(7)); assert.deepEqual(tail.poll(), ['船']); fs.writeFileSync(file, ''); assert.throws(() => tail.poll(), /truncated/);
});
