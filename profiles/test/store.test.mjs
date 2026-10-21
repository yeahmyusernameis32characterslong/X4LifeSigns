import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ProfileStore, universeId } from '../store.mjs';
import { ProfileConsumer, LogTail, startService } from '../service.mjs';
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
  a.ingest([row(A,12,'ENTITY_EVENT',{event_type:'ATTACKED',subject_kind:'SHIP',subject_idcode:'SYN-001'})]);
  a.close(); const b = open(B); assert.equal(b.ingest([start(B, A, '7')]).state, 'READY');
  assert.equal(b.profilesAt()[0].fields.name.value, baseline[4].fields.value, 'Later branch state must not be inherited');
  assert.equal(b.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 2);
  b.ingest([row(B, 2, 'ENTITY_EVENT', { event_type: 'ROLE_CHANGED', subject_kind: 'NPC', subject_seed: '9223372036854775807', assigned_ship_idcode: 'ABC-123', role: 'Marine' })]);
  const e = b.db.prepare('SELECT * FROM events WHERE run_id=?').get(B); assert.equal(e.subject_kind, 'NPC'); assert.equal(e.game_time, '0.2');
  assert.equal(JSON.parse(e.fields_json).assigned_ship_idcode, 'ABC-123');
  assert.deepEqual(b.eventsAt().map(x=>x.event_type),['ROLE_CHANGED']);
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

test('an existing universe rejects a pre-database save without a committed checkpoint', t => {
  const {open}=fixture(t);const a=open();a.ingest(baseline);a.close();const b=open(B);
  assert.throws(()=>b.ingest([start(B)]),/saved committed checkpoint/);
  assert.equal(b.db.prepare('SELECT count(*) AS n FROM sessions WHERE run_id=?').get(B).n,0);
  assert.throws(()=>b.ingest([start(B,A,'1')]),/predates completed baseline/);
});

test('a missing universe database rebuilds a baseline without importing an unavailable saved ancestor', t => {
  const {open}=fixture(t);const b=open(B);
  assert.equal(b.ingest([start(B,A,'7')]).state,'NEED_BASELINE');
  assert.equal(b.db.prepare('SELECT parent_run FROM sessions').get().parent_run,null);
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
  const replacement=path.join(dir,'replacement.log');fs.writeFileSync(replacement,'different\n');
  const identityTail=new LogTail(file);identityTail.poll();fs.renameSync(replacement,file);
  assert.throws(()=>identityTail.poll(),/replaced/);
});

test('rename history projects a mutable name without rewriting profile rows or inheriting future branches',t=>{
  const {open}=fixture(t),s=open();const original=baseline.map(r=>r.kind==='PROFILE_BEGIN'?{...r,fields:{...r.fields,kind:'SHIP'}}:r);
  s.ingest(original);
  const change=(run,n,name,extra={})=>row(run,n,'ENTITY_EVENT',{event_type:'NAME_CHANGED',subject_kind:'SHIP',subject_seed:'9223372036854775807',old_name:'prior',old_name_state:'PRESENT',new_name:name,new_name_state:'PRESENT',...extra});
  const first=change(A,8,'First | % 船\nname'),later=change(A,9,'Abandoned future');s.ingest([first,later]);
  assert.equal(s.profilesAt(A,7)[0].fields.name.value,baseline[4].fields.value);
  assert.equal(s.profilesAt(A,8)[0].fields.name.value,first.fields.new_name);assert.equal(s.profilesAt()[0].fields.name.value,'Abandoned future');
  assert.equal(JSON.parse(s.db.prepare('SELECT fields_json FROM profile_versions').get().fields_json).name.value,baseline[4].fields.value);
  s.close();const b=open(B);b.ingest([start(B,A,'8')]);assert.equal(b.profilesAt()[0].fields.name.value,first.fields.new_name);
  b.ingest([change(B,2,'Current branch')]);b.ingest([change(B,2,'Current branch')]);
  assert.equal(b.profilesAt()[0].fields.name.value,'Current branch');assert.equal(b.eventsAt().length,2);
  assert.deepEqual(b.profilesAt()[0].name_observation,{run_id:B,record_id:2,game_time:'0.2',event_type:'NAME_CHANGED'});
  b.ingest([change(B,3,'Unobserved request',{event_type:'NAME_CHANGE_REQUESTED',new_name_state:'UNKNOWN'})]);
  assert.equal(b.profilesAt()[0].fields.name.value,'Current branch');
  b.ingest([change(B,4,'Wrong seed',{subject_seed:'123',subject_idcode:'SYN-001'})]);
  assert.equal(b.profilesAt()[0].fields.name.value,'Current branch');
});

test('a later full profile supersedes earlier name events while station observations retain unknown-old provenance',t=>{
  const {open}=fixture(t),s=open();const original=baseline.map(r=>r.kind==='PROFILE_BEGIN'?{...r,fields:{...r.fields,kind:'STATION'}}:r);s.ingest(original);
  s.ingest([row(A,8,'ENTITY_EVENT',{event_type:'NAME_OBSERVED',subject_kind:'STATION',subject_seed:'9223372036854775807',old_name:'',old_name_state:'UNKNOWN',new_name:'Observed station',new_name_state:'PRESENT'})]);
  assert.equal(s.profilesAt()[0].fields.name.value,'Observed station');assert.equal(s.eventsAt()[0].fields.old_name_state,'UNKNOWN');
  s.ingest([row(A,9,'PROFILE_BEGIN',{kind:'STATION',profile:'2'}),row(A,10,'VALUE',{profile:'2',field:'seed',value:'9223372036854775807',type:'largeint',state:'PRESENT'}),row(A,11,'VALUE',{profile:'2',field:'name',value:'Later profile',type:'string',state:'PRESENT'}),row(A,12,'PROFILE_END',{profile:'2',partial:'0'})]);
  assert.equal(s.profilesAt()[0].fields.name.value,'Later profile');assert.equal(s.db.prepare('SELECT count(*) AS n FROM profile_versions').get().n,2);
});

test('launch boundary excludes retained files even if their modification time changes', async t => {
  const {dir,open,track}=fixture(t), s=open(); s.ingest(baseline);s.close();
  const logs=path.join(dir,'logs'),replies=path.join(dir,'replies');fs.mkdirSync(logs);fs.mkdirSync(replies);
  const name=r=>`profiles-${r}.log`;
  const old=path.join(logs,name(B));fs.writeFileSync(old,line(start(B))+'\n');
  await new Promise(r=>setTimeout(r,30));const cutoff=Date.now();await new Promise(r=>setTimeout(r,30));
  fs.utimesSync(old,new Date(),new Date());
  const fresh=path.join(logs,name(A));fs.writeFileSync(fresh,baseline.map(line).join('\n')+'\n');
  const errors=[];const service=startService({root:dir,logDirectory:logs,replyDirectory:replies,notBefore:cutoff,interval:100000,onError:e=>errors.push(e),onRunError:e=>errors.push(e)});track({close:()=>service.stop()});
  assert.equal(fs.existsSync(path.join(replies,B+'.reply')),false,'No historical error reply or DB write');
  assert.match(fs.readFileSync(path.join(replies,A+'.reply'),'utf8'),/READY\|7\|END/);
  assert.deepEqual(errors,[]);
});

test('rejected historical run cannot stop subsequent valid save runs or weaken ancestry', t=>{
  const {dir,open,track}=fixture(t),s=open();s.ingest(baseline);s.close();
  const logs=path.join(dir,'logs'),replies=path.join(dir,'replies');fs.mkdirSync(logs);fs.mkdirSync(replies);
  fs.writeFileSync(path.join(logs,`profiles-${B}.log`),line(start(B))+'\n');
  const errors=[],fatal=[];const service=startService({root:dir,logDirectory:logs,replyDirectory:replies,interval:100000,onRunError:e=>errors.push(e.message),onError:e=>fatal.push(e)});track({close:()=>service.stop()});
  assert.match(fs.readFileSync(path.join(replies,B+'.reply'),'utf8'),/ERROR\|0\|END/);
  const C='session-5-6-loaded-2026-10-21_12-02-00';
  fs.writeFileSync(path.join(logs,`profiles-${C}.log`),line(start(C,A,'7'))+'\n');service.poll();
  assert.match(fs.readFileSync(path.join(replies,C+'.reply'),'utf8'),/READY\|1\|END/);
  assert.equal(errors.length,1);assert.match(errors[0],/saved committed checkpoint/);assert.deepEqual(fatal,[]);
});

test('graceful stop drains more than one final chunk and closes SQLite', t=>{
  const {dir}=fixture(t),logs=path.join(dir,'logs'),replies=path.join(dir,'replies');fs.mkdirSync(logs);fs.mkdirSync(replies);
  const file=path.join(logs,`profiles-${A}.log`);fs.writeFileSync(file,line(baseline[0])+'\n');
  const errors=[];const service=startService({root:dir,logDirectory:logs,replyDirectory:replies,interval:100000,onError:e=>errors.push(e),onRunError:e=>errors.push(e)});
  const event=n=>row(A,n,'ENTITY_EVENT',{event_type:'ATTACKED',subject_kind:'SHIP',subject_seed:'1',detail:'x'.repeat(900000)});
  fs.appendFileSync(file,Array.from({length:6},(_,i)=>line(event(i+2))).join('\n')+'\n');service.stop();
  assert.deepEqual(errors,[]);assert.match(fs.readFileSync(path.join(replies,A+'.reply'),'utf8'),/NEED_BASELINE\|7\|END/);
  const db=new DatabaseSync(path.join(dir,'local-data','profiles',`${id}.${A}.building.db`));
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n,6);db.exec('BEGIN EXCLUSIVE;ROLLBACK');db.close();
});
