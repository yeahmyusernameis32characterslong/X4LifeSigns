import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {ProfileConsumer,ReplyPublicationError,startService} from '../service.mjs';

const id='lsu1-2026-10-21_12-00-00-1-2-3-4',run='session-1-2-loaded-2026-10-21_12-00-00';
const line=(n,kind,fields='')=>`LSEV1|run=${run}|session=UNAVAILABLE|seq=0|age=${n}|${kind}|${fields}record=${n}|END`;
const start=line(1,'RUN_BEGIN',`database_protocol=LSDB1|lifesigns_universe_id=${id}|parent_run=NONE|parent_record=0|`);
const baseline=[line(2,'SNAPSHOT_BEGIN'),line(3,'SNAPSHOT_END','profiles=0|partial=0|')];
const event=n=>line(n,'ENTITY_EVENT','event_type=ATTACKED|subject_kind=SHIP|subject_seed=1|');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-reply-'));const replies=path.join(root,'replies');fs.mkdirSync(replies);
  const resources=[];t.after(()=>{for(const r of resources)r.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});});
  return {root,replies,target:path.join(replies,run+'.reply'),track:r=>(resources.push(r),r)};
}

test('transient replacement errors keep committed records and coalesce to the latest ACK',t=>{
  for(const code of ['EPERM','EACCES','EBUSY']){
    const f=fixture(t);let blocked=false;const delayed=[],published=[];
    const c=f.track(new ProfileConsumer({root:f.root,replyDirectory:f.replies,
      renameReply:(a,b)=>{if(blocked)throw Object.assign(Error('synthetic lock'),{code});fs.renameSync(a,b);published.push(fs.readFileSync(b,'utf8'));},onReplyDelayed:e=>delayed.push(e.code)}));
    c.consume([start]);const before=fs.readFileSync(f.target,'utf8');blocked=true;
    c.consume(baseline);for(let n=4;n<=30;n++)c.consume([event(n)]);
    assert.equal(c.stores.get(run).db.prepare('SELECT count(*) AS n FROM records').get().n,30);
    assert.equal(fs.readFileSync(f.target,'utf8'),before);assert.equal(c.pendingReplies.size,1);
    assert.equal(fs.readdirSync(f.replies).filter(n=>n.endsWith('.tmp')).length,1);
    assert.deepEqual(delayed,[code]);assert.equal(c.flushReplies(),false);
    blocked=false;assert.equal(c.flushReplies(),true);
    assert.match(fs.readFileSync(f.target,'utf8'),/\|READY\|30\|END/);
    assert.equal(published.length,2,'Recovery must not publish a superseded ACK');
    assert.equal(c.pendingReplies.size,0);assert.equal(fs.readdirSync(f.replies).some(n=>n.endsWith('.tmp')),false);
  }
});

test('a genuine pending ERROR supersedes READY without briefly publishing stale success',t=>{
  const f=fixture(t);let blocked=false;const published=[];
  const c=f.track(new ProfileConsumer({root:f.root,replyDirectory:f.replies,onReplyDelayed:()=>{},renameReply:(a,b)=>{
    if(blocked)throw Object.assign(Error('synthetic lock'),{code:'EPERM'});fs.renameSync(a,b);published.push(fs.readFileSync(b,'utf8'));
  }}));
  c.consume([start]);blocked=true;c.consume(baseline);
  assert.throws(()=>c.consume([event(5)]),/Non-contiguous/);
  blocked=false;c.flushReplies();assert.equal(published.length,2);
  assert.match(published[1],/\|ERROR\|0\|END/);
  assert.equal(c.stores.get(run).db.prepare('SELECT count(*) AS n FROM records').get().n,3);
});

test('non-retryable publication failure never fabricates a database ERROR after commit',t=>{
  const f=fixture(t);let fail=false;
  const c=f.track(new ProfileConsumer({root:f.root,replyDirectory:f.replies,renameReply:(a,b)=>{if(fail)throw Object.assign(Error('synthetic I/O failure'),{code:'EIO'});fs.renameSync(a,b);}}));
  c.consume([start]);fail=true;
  assert.throws(()=>c.consume(baseline),e=>e instanceof ReplyPublicationError && e.cause.code==='EIO');
  assert.equal(c.stores.get(run).db.prepare('SELECT count(*) AS n FROM records').get().n,3);
  assert.match(fs.readFileSync(f.target,'utf8'),/\|NEED_BASELINE\|1\|END/);
});

test('genuine non-contiguous data still rejects the run and publishes ERROR',t=>{
  const f=fixture(t),c=f.track(new ProfileConsumer({root:f.root,replyDirectory:f.replies}));
  c.consume([start]);assert.throws(()=>c.consume([event(4)]),/Non-contiguous/);
  assert.match(fs.readFileSync(f.target,'utf8'),/\|ERROR\|0\|END/);
  assert.equal(c.stores.get(run).db.prepare('SELECT count(*) AS n FROM records').get().n,1);
});

test('service classifies an unsafe reply destination as fatal transport, not a rejected log',t=>{
  const f=fixture(t),logs=path.join(f.root,'logs');fs.mkdirSync(logs);
  const log=path.join(logs,'profiles-'+run+'.log');fs.writeFileSync(log,start+'\n');
  const rejected=[],fatal=[];
  const service=startService({root:f.root,logDirectory:logs,replyDirectory:f.replies,interval:100000,onRunError:e=>rejected.push(e),onError:e=>fatal.push(e)});
  f.track({close:()=>service.stop()});
  fs.unlinkSync(f.target);fs.mkdirSync(f.target); // Deliberately unsafe disposable destination.
  fs.appendFileSync(log,baseline.join('\n')+'\n');service.poll();
  assert.equal(rejected.length,0);assert.equal(fatal.length,1);
  assert.ok(fatal[0] instanceof ReplyPublicationError);assert.equal(fs.statSync(f.target).isDirectory(),true);
  const db=new DatabaseSync(path.join(f.root,'local-data/profiles',id+'.db'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT count(*) AS n FROM records').get().n,3);}finally{db.close();}
});

test('real Windows delete-sharing lock recovers on a service poll with no new log rows',{skip:process.platform!=='win32'},async t=>{
  const f=fixture(t),logs=path.join(f.root,'logs');fs.mkdirSync(logs);
  const log=path.join(logs,'profiles-'+run+'.log');fs.writeFileSync(log,start+'\n');
  const rejected=[],fatal=[];
  const service=startService({root:f.root,logDirectory:logs,replyDirectory:f.replies,interval:100000,onRunError:e=>rejected.push(e),onError:e=>fatal.push(e)});
  f.track({close:()=>service.stop()});
  const ready=path.join(f.root,'locked'),release=path.join(f.root,'release');
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./reply-lock-fixture.ps1',import.meta.url)),'-Target',f.target,'-Ready',ready,'-Release',release],{windowsHide:true,stdio:'pipe'});
  const exit=once(child,'exit');let stderr='';child.stderr.on('data',b=>stderr+=b);
  try{
    const deadline=Date.now()+10000;while(!fs.existsSync(ready)){if(Date.now()>deadline)throw Error('Lock fixture did not start: '+stderr);await wait(20);}
    fs.appendFileSync(log,baseline.join('\n')+'\n');service.poll();
    fs.appendFileSync(log,event(4)+'\n');service.poll();
    assert.deepEqual(rejected,[]);assert.deepEqual(fatal,[]);
    assert.match(fs.readFileSync(f.target,'utf8'),/\|NEED_BASELINE\|1\|END/);
    fs.writeFileSync(release,'release');const [code]=await exit;assert.equal(code,0,stderr);
    service.poll(); // No additional raw records: retry itself must publish.
    assert.match(fs.readFileSync(f.target,'utf8'),/\|READY\|4\|END/);
    const db=new DatabaseSync(path.join(f.root,'local-data/profiles',id+'.db'),{readOnly:true});
    try{assert.equal(db.prepare('SELECT count(*) AS n FROM records').get().n,4);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
  } finally {
    if(child.exitCode===null){fs.writeFileSync(release,'release');await exit;}
  }
});
