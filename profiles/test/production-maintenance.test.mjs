import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {gzipSync} from 'node:zlib';import {DatabaseSync} from 'node:sqlite';
import {ProfileStore} from '../store.mjs';import {ProfileConsumer} from '../service.mjs';
import {registerProduction,productionRoot,fileHash,contentDigest,readJson,rootLease} from '../production-contract.mjs';
import {reviewProduction,executeProduction,scanProduction} from '../maintenance-production.mjs';import {maintenanceHandles} from '../maintenance-handles.mjs';
import {SETTINGS_NAME,setProtection} from '../preview-settings.mjs';
import {escapeValue} from '../../recorder/log-format.mjs';
import {fork} from 'node:child_process';import {once} from 'node:events';
const U='lsu1-2026-10-30_12-00-00-1-2-3-4',V='lsu1-2026-10-30_12-00-00-5-6-7-8',A='session-1-2-loaded-2026-10-30_12-00-00',B='session-3-4-loaded-2026-10-30_12-01-00',C='session-5-6-loaded-2026-10-30_12-02-00',D='session-7-8-loaded-2026-10-30_12-03-00';
const row=(run,n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}}),start=(id,run,parent='NONE',n='0')=>row(run,1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:id,parent_run:parent,parent_record:n}),event=(run,n)=>row(run,n,'ENTITY_EVENT',{subject_kind:'SHIP',subject_seed:'42',event_type:'ATTACKED'});
const xml=(run,n)=>`<savegame><info><game id="X4" version="900"/></info><script><refs type="string"><ref id="10" string="${U}"/><ref id="11" string="${run}"/></refs></script><md><script name="LifeSigns_EventRecorder"><cue name="UniverseIdentity"><vars><value name="$Id" type="string" value="10"/><value name="$CheckpointRun" type="string" value="11"/><value name="$CheckpointRecord" type="largefloat" value="${n}"/></vars></cue></script></md></savegame>`;
const history=file=>{const db=new DatabaseSync(file,{readOnly:true});try{return contentDigest(db);}finally{db.close();}};
async function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'lsproduction-'));t.after(()=>{assert.equal(path.dirname(base),path.resolve(os.tmpdir()));fs.rmSync(base,{recursive:true});});
 const root=path.join(base,'data');fs.mkdirSync(root);const saves=path.join(base,'saves');fs.mkdirSync(saves);
 for(const id of [U,V]){let s=new ProfileStore(root,id,A);s.ingest([start(id,A),row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'SNAPSHOT_END',{profiles:'0'}),event(A,4),event(A,5),event(A,6)]);s.close();for(const [run,cut] of [[B,'4'],[C,'5'],[D,'3']]){s=new ProfileStore(root,id,run);s.ingest([start(id,run,A,cut),event(run,2),event(run,3)]);s.close();}}
 for(const [i,run] of [B,C].entries())fs.writeFileSync(path.join(saves,i+'.xml.gz'),gzipSync(xml(run,2)));
 const c=registerProduction(root,path.join(base,'anchor.json'));fs.mkdirSync(path.join(c.directory,'local-data'));fs.writeFileSync(path.join(c.directory,'local-data',SETTINGS_NAME),JSON.stringify({owner:'LifeSignsReadOnlyPreview',version:1,saveLocations:[saves],protectedUniverses:[]}));
 return {root,saves,c,file:path.join(root,'local-data','profiles',U+'.db'),peer:path.join(root,'local-data','profiles',V+'.db')};
}
const execute=(f,p,o={})=>executeProduction(f.root,p,{...o,...(process.platform!=='win32'?{handles:async()=>({add:async()=>{},install:async(a,b)=>fs.renameSync(a,b),assert(){},close:async()=>{}})}:{})});

test('production cleanup/restore retains both branches and ancestor union, peers, sources, and seals replay without READY',{timeout:180000},async t=>{
 const f=await fixture(t),before=history(f.file),peer=fileHash(f.peer),source=fs.readdirSync(f.saves).map(n=>[n,fileHash(path.join(f.saves,n))]);
 const plan=await reviewProduction(f.root,U,'CLEAN');assert.equal(plan.plan.candidates.records,6);
 await execute(f,plan);const db=new DatabaseSync(f.file,{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM records').get().n,9);assert.equal(db.prepare('SELECT cutoff FROM housekeeping_seals WHERE run_id=?').get(D).cutoff,0);assert.throws(()=>db.exec('UPDATE universe_metadata SET ready=0'),/readonly|read-only|function/);}finally{db.close();}
 const replay=new ProfileStore(f.root,U,D);assert.equal(replay.ingest([start(U,D,A,'3'),event(D,2)]).state,'SEALED_REPLAY');replay.close();
 const line=r=>`LSEV1|run=${r.run}|session=${r.session}|seq=${r.seq}|age=${r.age}|${r.kind}|${Object.entries(r.fields).map(([k,v])=>`${k}=${escapeValue(v)}`).join('|')}|END`;
 const consumer=new ProfileConsumer({root:f.root,replyDirectory:f.root});try{assert.deepEqual(consumer.consume([start(U,D,A,'3'),event(D,2)].map(line)),[]);assert.equal(fs.existsSync(path.join(f.root,D+'.reply')),false);}finally{consumer.close();}
 await execute(f,await reviewProduction(f.root,U,'RESTORE'));assert.equal(history(f.file),before);assert.equal(fileHash(f.peer),peer);for(const [n,h] of source)assert.equal(fileHash(path.join(f.saves,n)),h);
 assert.equal(productionRoot(f.root).catalog.universes[U].generation,2);
});
test('production root lease excludes direct supported stores; missing/rolled-back registration and missing DB refuse',{timeout:60000},async t=>{
 const f=await fixture(t),s=new ProfileStore(f.root,U,B);await assert.rejects(reviewProduction(f.root,U,'CLEAN'),/BUSY/);s.close();
 const c=productionRoot(f.root),lock=rootLease(c,'MAINTENANCE');assert.throws(()=>new ProfileStore(f.root,U,B),/BUSY/);lock.close();
 const anchor=fs.readFileSync(c.registration.anchor);fs.writeFileSync(c.registration.anchor,'{}');assert.throws(()=>new ProfileStore(f.root,U,B),/ANCHOR/);fs.writeFileSync(c.registration.anchor,anchor);
 const moved=f.file+'.held';fs.renameSync(f.file,moved);assert.throws(()=>new ProfileStore(f.root,U,B),/missing/);assert.equal(fs.existsSync(f.file),false);fs.renameSync(moved,f.file);
});
test('protected and stale save/settings plans never mutate live-role fixture',{timeout:90000},async t=>{
 const f=await fixture(t),before=fileHash(f.file),p=await reviewProduction(f.root,U,'CLEAN');fs.appendFileSync(path.join(f.saves,'0.xml.gz'),'changed');await assert.rejects(execute(f,p),/SAVE_INPUT_CHANGED/);assert.equal(fileHash(f.file),before);
 const settings=readJson(path.join(f.c.directory,'local-data',SETTINGS_NAME));fs.writeFileSync(path.join(f.c.directory,'local-data',SETTINGS_NAME),JSON.stringify({...settings,protectedUniverses:[U]}));await assert.rejects(reviewProduction(f.root,U,'CLEAN'),/PROTECTED/);
});
test('valid new child appends after cleanup, old raw writer lacks connection guard, restoration refuses newer history',{timeout:120000},async t=>{
 const f=await fixture(t);await execute(f,await reviewProduction(f.root,U,'CLEAN'));
 const old=new DatabaseSync(f.file);try{assert.throws(()=>old.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(B,3,'ENTITY_EVENT','3','{}'),/function|SEALED/);}finally{old.close();}
 const run='session-9-10-loaded-2026-10-30_12-04-00',s=new ProfileStore(f.root,U,run);assert.equal(s.ingest([start(U,run,C,'2'),event(run,2)]).state,'READY');s.close();await assert.rejects(reviewProduction(f.root,U,'RESTORE'),/NEW_HISTORY/);
 const bad='session-11-12-loaded-2026-10-30_12-05-00',b=new ProfileStore(f.root,U,bad);try{assert.throws(()=>b.ingest([start(U,bad,D,'2')]),/checkpoint not found/);}finally{b.close();}
});
test('prepared/installed interruptions require explicit recovery preserving before-history and unrelated universe',{timeout:180000},async t=>{
 const f=await fixture(t),before=history(f.file),peer=fileHash(f.peer);
 for(const phase of ['PREPARED','INSTALLED']){
  await assert.rejects(execute(f,await reviewProduction(f.root,U,'CLEAN'),{onPhase(p){if(p===phase)throw Error('INJECTED_'+phase);}}),/INJECTED/);
  assert.equal(productionRoot(f.root).catalog.universes[U].phase,'PREPARED');assert.throws(()=>new ProfileStore(f.root,U,B),/RECOVERY/);
  const recover=await reviewProduction(f.root,U,'RESTORE');assert.equal(recover.plan.kind,'RECOVER');await execute(f,recover);assert.equal(history(f.file),before);assert.equal(fileHash(f.peer),peer);
 }
});
test('Windows native deny-write handles refuse an already-open unmanaged SQLite writer and block new writes',{skip:process.platform!=='win32',timeout:60000},async t=>{
 const f=await fixture(t),db=new DatabaseSync(f.file);await assert.rejects(maintenanceHandles([f.file]),/REFUSED/);db.close();
 const h=await maintenanceHandles([f.file]);try{let attempted;try{attempted=new DatabaseSync(f.file);assert.throws(()=>attempted.exec('UPDATE universe_metadata SET ready=0'),/open|locked|readonly|read-only/);}finally{attempted?.close();}}finally{await h.close();}
});
test('new universe publication joins paired registration without migrating existing history',async t=>{
 const f=await fixture(t),id='lsu1-2026-10-30_13-00-00-9-10-11-12',peer=fileHash(f.file),s=new ProfileStore(f.root,id,A);
 try{s.ingest([start(id,A),row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'SNAPSHOT_END',{profiles:'0'})]);}finally{s.close();}
 assert.equal(productionRoot(f.root).catalog.universes[id].version,1);assert.equal(fileHash(f.file),peer);
});
test('production inventory cache requires fresh hashes and scope metadata; changed save is parsed again',{timeout:90000},async t=>{
 const f=await fixture(t),stages=[];let result=await scanProduction(f.root,{onProgress:p=>stages.push(p.stage)});assert.ok(stages.includes('SAVES'));assert.equal(result.databases.find(d=>d.universe===U).candidates.records,6);
 stages.length=0;result=await scanProduction(f.root,{onProgress:p=>stages.push(p.stage)});assert.ok(!stages.includes('SAVES'));assert.equal(result.databases.find(d=>d.universe===U).candidates.records,6);
 fs.writeFileSync(path.join(f.saves,'0.xml.gz'),gzipSync(xml(B,3)));stages.length=0;result=await scanProduction(f.root,{onProgress:p=>stages.push(p.stage)});assert.ok(stages.includes('SAVES'));assert.equal(result.databases.find(d=>d.universe===U).candidates.records,5);
});
test('a new save arriving during staged work aborts installation with original database unchanged',{timeout:90000},async t=>{
 const f=await fixture(t),before=fileHash(f.file),plan=await reviewProduction(f.root,U,'CLEAN');
 await assert.rejects(execute(f,plan,{onPhase(p){if(p==='STAGE_VERIFIED')fs.writeFileSync(path.join(f.saves,'arrived.xml.gz'),gzipSync(xml(D,2)));}}),/SAVE_SCOPE_CHANGED/);
 assert.equal(fileHash(f.file),before);assert.equal(productionRoot(f.root).catalog.universes[U].phase,'READY');
});
test('rolled-back catalogue pair cannot reopen migrated DB; corrupt backup and unknown sidecars refuse',{timeout:120000},async t=>{
 const f=await fixture(t),oldCatalog=fs.readFileSync(f.c.catalogFile),oldAnchor=fs.readFileSync(f.c.registration.anchor);await execute(f,await reviewProduction(f.root,U,'CLEAN'));
 const current=productionRoot(f.root),catalog=fs.readFileSync(current.catalogFile),anchor=fs.readFileSync(current.registration.anchor),before=fileHash(f.file);
 fs.writeFileSync(current.catalogFile,oldCatalog);fs.writeFileSync(current.registration.anchor,oldAnchor);assert.throws(()=>new ProfileStore(f.root,U,B),/PRODUCTION|Incompatible/);fs.writeFileSync(current.catalogFile,catalog);fs.writeFileSync(current.registration.anchor,anchor);
 const backupId=current.catalog.universes[U].lastBackup;fs.appendFileSync(path.join(current.directory,'backups',backupId,'history.db'),'changed');await assert.rejects(reviewProduction(f.root,U,'RESTORE'),/BACKUP_CHANGED/);assert.equal(fileHash(f.file),before);
 fs.writeFileSync(f.file+'-journal','unknown');await assert.rejects(reviewProduction(f.root,U,'RESTORE'));assert.equal(fileHash(f.file),before);fs.unlinkSync(f.file+'-journal');
});
test('real process exits during staging and after installation preserve evidence and recover selected history',{skip:process.platform!=='win32',timeout:180000},async t=>{
 const f=await fixture(t),before=history(f.file),peer=fileHash(f.peer);
 for(const phase of ['STAGING_TRANSACTION','INSTALLED']){
  const confirmation=await reviewProduction(f.root,U,'CLEAN'),child=fork(new URL('./production-crash-worker.mjs',import.meta.url),[],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true,execArgv:[]});let stderr='';child.stderr.on('data',d=>stderr+=d);const exited=once(child,'exit');child.send({root:f.root,confirmation,phase});assert.equal((await exited)[0],87,stderr);
  if(phase==='STAGING_TRANSACTION'){
   assert.equal(history(f.file),before);assert.equal(productionRoot(f.root).catalog.universes[U].phase,'READY');assert.ok(fs.readdirSync(f.c.directory).some(n=>n.startsWith('stage-')&&n.endsWith('-journal')));
  }else {const p=await reviewProduction(f.root,U,'RESTORE');assert.equal(p.plan.kind,'RECOVER');await execute(f,p);assert.equal(history(f.file),before);}
  assert.equal(fileHash(f.peer),peer);
 }
});
