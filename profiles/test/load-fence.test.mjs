import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { LoadFence, CHALLENGE_RUN, FENCE_RUN, ACTIVE_RUN, parseLoadRequest } from '../load-fence.mjs';
import { startService } from '../service.mjs';

const id='lsu1-2026-10-23_00-00-00-1-2-3-4';
const a='session-1-2-loaded-2026-10-23_00-00-00',b='session-3-4-loaded-2026-10-23_00-01-00';
const row=(run,n,kind,fields='')=>`LSEV1|run=${run}|session=UNAVAILABLE|seq=0|age=${n}|${kind}|${fields}record=${n}|END`;
const begin=(run,parent='NONE',record=0)=>row(run,1,'RUN_BEGIN',`database_protocol=LSDB1|lifesigns_universe_id=${id}|parent_run=${parent}|parent_record=${record}|`);
const event=(run,n)=>row(run,n,'ENTITY_EVENT','event_type=ATTACKED|subject_kind=SHIP|subject_seed=1|');
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-fence-'));
  const logs=path.join(root,'logs'),replies=path.join(root,'replies'),debug=path.join(root,'debuglog.txt');
  fs.mkdirSync(logs);fs.mkdirSync(replies);fs.writeFileSync(debug,'');
  const services=[];
  t.after(()=>{for(const s of services)s.stop();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});});
  const errors=[];
  return {root,logs,replies,debug,errors,
    start:()=>{const s=startService({root,logDirectory:logs,replyDirectory:replies,debugLog:debug,notBefore:0,interval:100000,onError:e=>errors.push(e),onRunError:e=>errors.push(e)});services.push(s);return s;},
    log:(run,lines)=>fs.appendFileSync(path.join(logs,'profiles-'+run+'.log'),lines.join('\n')+'\n'),
    request:token=>fs.appendFileSync(debug,`[game] LSLOAD1|PREPARE|${token}|END\n`),
    ledger:()=>JSON.parse(fs.readFileSync(path.join(root,'local-data/profile-load-fence-v1.json'),'utf8')),
    reply:run=>fs.readFileSync(path.join(replies,run+'.reply'),'utf8'),
    count:run=>{const db=new DatabaseSync(path.join(root,'local-data/profiles',id+'.db'),{readOnly:true});try{return db.prepare('SELECT count(*) n FROM records WHERE run_id=?').get(run).n;}finally{db.close();}}
  };
}
test('real service fences contiguous stale rows, suppresses old ACKs and opens only the validated new run',t=>{
  const f=fixture(t);
  f.log(a,[begin(a),row(a,2,'SNAPSHOT_BEGIN'),row(a,3,'SNAPSHOT_END','profiles=0|partial=0|')]);
  let s=f.start();const token=f.ledger().challenge;
  f.log(a,[event(a,4)]);f.request(token);s.poll();
  assert.equal(f.count(a),4,'Pre-load rows drain before closure');
  assert.ok(f.ledger().closed.includes(a));assert.match(f.reply(FENCE_RUN),new RegExp('FENCED\\|'+token));
  const ack=f.reply(a);f.log(a,[event(a,5)]);s.poll();assert.equal(f.count(a),4);assert.equal(f.reply(a),ack);
  f.log(b,[begin(b,a,3),event(b,2)]);s.poll();assert.equal(f.count(b),2);
  assert.match(f.reply(ACTIVE_RUN),new RegExp('OPEN\\|'+b+'\\|'+id+'\\|'+f.ledger().challenge));
  f.request(token);s.poll();assert.ok(!f.ledger().closed.includes(b),'Old intent replay cannot seal new session');
  s.stop();s=f.start();assert.equal(f.count(a),4);assert.equal(f.count(b),2);
  f.log(a,[event(a,6)]);s.poll();assert.equal(f.count(a),4);assert.deepEqual(f.errors,[]);
  const db=new DatabaseSync(path.join(f.root,'local-data/profiles',id+'.db'),{readOnly:true});
  try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
});
test('control backlog is read before raw profiles and closure drains a fixed byte boundary',t=>{
  const f=fixture(t),s=f.start(),token=f.ledger().challenge;
  // More than a single control chunk, with small complete diagnostic lines.
  fs.appendFileSync(f.debug,('ordinary diagnostic\n').repeat(230000));
  f.request(token);f.log(a,[begin(a),row(a,2,'SNAPSHOT_BEGIN'),row(a,3,'SNAPSHOT_END','profiles=0|partial=0|')]);
  s.poll();assert.equal(fs.existsSync(path.join(f.root,'local-data/profiles',id+'.db')),false);
  s.poll();assert.equal(f.count(a),3);assert.ok(f.ledger().closed.includes(a));assert.deepEqual(f.errors,[]);
});
test('durable fence survives failure before ACK publication and request replay',t=>{
  const f=fixture(t);let fail=false;
  const x=new LoadFence({root:f.root,replyDirectory:f.replies,processStarted:1,rename:(from,to)=>{
    if(fail && to.endsWith(FENCE_RUN+'.reply'))throw Object.assign(Error('synthetic sharing lock'),{code:'EPERM'});
    fs.renameSync(from,to);
  }});
  const token=x.state.challenge;
  x.commit(token,[a]);fail=true;assert.throws(()=>x.publish(),/sharing/);
  assert.equal(fs.existsSync(path.join(f.replies,FENCE_RUN+'.reply')),false);
  const restarted=new LoadFence({root:f.root,replyDirectory:f.replies,processStarted:1});
  assert.ok(restarted.isClosed(a));assert.equal(restarted.commit(token,[a,b]),false);assert.equal(restarted.isClosed(b),false);
  assert.match(f.reply(FENCE_RUN),new RegExp(token));
  const fresh=new LoadFence({root:f.root,replyDirectory:f.replies,processStarted:2});
  assert.ok(fresh.isClosed(a));assert.equal(fresh.accepts(token),false);
});
test('ledger persistence failure cannot acknowledge or close a run',t=>{
  const f=fixture(t);let fail=false;
  const x=new LoadFence({root:f.root,replyDirectory:f.replies,processStarted:1,rename:(a,b)=>{
    if(fail && b.endsWith('profile-load-fence-v1.json'))throw Error('synthetic ledger failure');fs.renameSync(a,b);
  }});
  fail=true;assert.throws(()=>x.commit(x.state.challenge,[a]),/ledger failure/);
  assert.equal(x.isClosed(a),false);assert.equal(fs.existsSync(path.join(f.replies,FENCE_RUN+'.reply')),false);
  assert.throws(()=>x.commit(randomUUID(),[a]),/Unknown/);
});
test('unowned ledger and unsafe control paths fail closed; requests are bounded and exact',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.root,'local-data'));
  fs.writeFileSync(path.join(f.root,'local-data/profile-load-fence-v1.json'),'{}');
  assert.throws(()=>new LoadFence({root:f.root,replyDirectory:f.replies,processStarted:1}),/Invalid/);
  const token=randomUUID();assert.equal(parseLoadRequest(`[error] LSLOAD1|PREPARE|${token}|END`),token);
  for(const s of [`LSLOAD1|PREPARE|${token}|END|extra`,'LSLOAD1|PREPARE|../path|END','LSLOAD1|HOOK_INSTALLED|END'])assert.equal(parseLoadRequest(s),null);
});
test('a profile file cannot route records to another run',t=>{
  const f=fixture(t);f.log(a,[begin(b)]);f.start();assert.equal(f.errors.length,1);assert.match(f.errors[0].message,/filename\/run mismatch/);
  assert.equal(fs.existsSync(path.join(f.root,'local-data/profiles',id+'.db')),false);
});
