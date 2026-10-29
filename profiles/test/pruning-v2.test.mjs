import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {ProfileStore} from '../store.mjs';
import {createLab,openLab,copyFixture,sealFixture,fileDigest,acquireLease,recoverLab} from '../experimental/maintenance-v2.mjs';
import {ReplayV2} from '../experimental/replay-v2.mjs';
import {backupFixture,planPruneFixture,pruneFixture,restoreFixture,resumeRestoreFixture} from '../experimental/pruning-v2.mjs';

const U='lsu1-2026-10-29_12-00-00-1-2-3-4';
const A='session-1-2-loaded-2026-10-29_12-00-00',B='session-3-4-loaded-2026-10-29_12-01-00',C='session-5-6-loaded-2026-10-29_12-02-00',D='session-7-8-loaded-2026-10-29_12-03-00',E='session-9-10-loaded-2026-10-29_12-04-00';
const row=(run,n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}});
const start=(run,parent='NONE',cutoff='0')=>row(run,1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:U,parent_run:parent,parent_record:cutoff});
const ev=(run,n,fields={})=>row(run,n,'ENTITY_EVENT',{subject_kind:'NPC',subject_seed:'111',event_type:'ASSIGNMENT_OBSERVED',assigned_idcode:'SYN-001',actual_role:run===C?'Marine':'Captain',assignment_basis:'ACTOR_ROLE_OR_CONTROL_OBSERVED',...fields});
const root=(run,record)=>({universe:U,run,record});
const roots=[root(B,2),root(C,2)];
function fixture(t) {
  const lab=createLab();t.after(()=>{assert.equal(path.dirname(lab.workspace),path.resolve(os.tmpdir()));assert.match(path.basename(lab.workspace),/^lifesigns-stage3-/);fs.rmSync(lab.workspace,{recursive:true});});
  let s=new ProfileStore(lab.sourceRoot,U,A);const a=[start(A),row(A,2,'SNAPSHOT_BEGIN')];
  const profile=(kind,fields)=>{const n=String(a.length),append=(kind,f)=>a.push(row(A,a.length+1,kind,f));append('PROFILE_BEGIN',{kind,profile:n});for(const [field,value] of Object.entries(fields))append('VALUE',{profile:n,field,value,state:'PRESENT',type:'string'});append('PROFILE_END',{profile:n,partial:'0'});};
  profile('NPC',{seed:'111',name:'Synthetic captain',assigned_idcode:'SYN-001'});profile('SHIP',{seed:'222',idcode:'SYN-001',name:'Synthetic ship'});profile('STATION',{seed:'333',idcode:'SYN-002',name:'Synthetic station'});
  a.push(row(A,a.length+1,'SNAPSHOT_END',{profiles:'3'}));const baseline=a.length;
  a.push(ev(A,a.length+1),ev(A,a.length+2,{subject_kind:'SHIP',subject_seed:'222',event_type:'ATTACKED'}),ev(A,a.length+3,{subject_kind:'SHIP',subject_seed:'222',event_type:'NAME_CHANGED',new_name:'Retained ship'}));
  s.ingest(a);const source=s.final;s.close();const rows=new Map([[A,a]]);
  for(const [run,cutoff] of [[B,baseline+1],[C,baseline+2],[D,baseline]]){s=new ProfileStore(lab.sourceRoot,U,run);const r=[start(run,A,String(cutoff)),ev(run,2),ev(run,3)];if(run===B)r.push(row(B,4,'PROFILE_BEGIN',{profile:'99',kind:'NPC'}),row(B,5,'VALUE',{profile:'99',field:'seed',value:'999',state:'PRESENT',type:'string'}),row(B,6,'PROFILE_END',{profile:'99',partial:'0'}));s.ingest(r);s.close();rows.set(run,r);}
  const file=copyFixture(lab,U);sealFixture(lab,U,roots);return {lab,file,source,rows,baseline};
}
function tables(file) {const db=new DatabaseSync(file,{readOnly:true});try{return Object.fromEntries(['universe_metadata','sessions','records','profile_versions','events','sealed_runs','maintenance_metadata'].map(n=>[n,db.prepare(`SELECT * FROM ${n} ORDER BY 1,2`).all()]));}finally{db.close();}}
function views(lab,rs=roots){const s=new ReplayV2(lab,U,B);try{return rs.map(r=>({profiles:s.profilesAt(r.run,r.record),events:s.eventsAt(r.run,r.record),history:s.historyForNpc('111',{run:r.run,record:r.record})}));}finally{s.close();}}
function pair(lab){return [path.join(lab.workspace,'registration.json'),lab.marker,lab.catalogue,...fs.readdirSync(lab.profiles).sort().map(n=>path.join(lab.profiles,n))].map(f=>[path.relative(lab.workspace,f),fileDigest(f)]);}
function backupDir(lab,b){return path.join(lab.workspace,'backups',b.id);}

test('verified unique paired backups restore every registered byte and never overwrite prior backups',t=>{
  const {lab,file,source}=fixture(t),original=pair(lab),sourceHash=fileDigest(source),a=backupFixture(lab),b=backupFixture(lab);
  assert.notEqual(a.id,b.id);const manifest=fileDigest(path.join(backupDir(lab,a),'manifest.json'));
  pruneFixture(lab,planPruneFixture(lab,U,roots));assert.notDeepEqual(pair(lab),original);restoreFixture(lab.receipt,a);
  assert.deepEqual(pair(lab),original);assert.equal(fileDigest(source),sourceHash);assert.equal(fileDigest(path.join(backupDir(lab,a),'manifest.json')),manifest);assert.equal(tables(file).sessions.length,4);
});

test('actual pruning preserves all retained views, ancestry and exact rows while removing tails and retired sessions',t=>{
  const {lab,file,source,rows,baseline}=fixture(t),before=tables(file),expected=views(lab,[...roots,root(A,baseline+2)]),sourceHash=fileDigest(source),plan=planPruneFixture(lab,U,roots);
  assert.equal(plan.candidates.sessions,1);assert.ok(plan.candidates.records>0);const result=pruneFixture(lab,plan),after=tables(file);
  assert.deepEqual(views(lab,[...roots,root(A,baseline+2)]),expected);assert.equal(fileDigest(source),sourceHash);assert.equal(after.records.length,before.records.length-plan.candidates.records);
  assert.equal(before.profile_versions.length-after.profile_versions.length,1);assert.deepEqual(after.profile_versions,before.profile_versions.filter(p=>p.run_id===A));assert.equal(after.sessions.length,3);assert.equal(after.sealed_runs.find(s=>s.run_id===D).cutoff,0);
  for(const run of [B,D]){const s=new ReplayV2(lab,U,run);try{const replay=s.replay(rows.get(run));assert.equal(replay.state,run===D?'RETIRED_REPLAY':'SEALED_REPLAY');assert.equal(replay.archived,rows.get(run).length-(run===D?0:2));assert.throws(()=>s.append(rows.get(run)),/SEALED_RUN/);}finally{s.close();}}
  restoreFixture(lab.receipt,result.backup);assert.deepEqual(tables(file),before);
});

test('repeated pruning seals newly appended children, narrows ancestors and retains old tombstones',t=>{
  const {lab,file}=fixture(t);pruneFixture(lab,planPruneFixture(lab,U,roots));
  const s=new ReplayV2(lab,U,E);try{s.append([start(E,B,'2'),ev(E,2),ev(E,3)]);}finally{s.close();}
  const next=[root(E,2)],expected=views(lab,next),before=pair(lab),result=pruneFixture(lab,planPruneFixture(lab,U,next));
  assert.deepEqual(views(lab,next),expected);const data=tables(file);assert.equal(data.sessions.length,3);assert.equal(data.sealed_runs.find(s=>s.run_id===C).cutoff,0);assert.equal(data.sealed_runs.find(s=>s.run_id===D).cutoff,0);
  const retired=new ReplayV2(lab,U,C);try{assert.equal(retired.status().state,'RETIRED');}finally{retired.close();}
  assert.throws(()=>planPruneFixture(lab,U,roots));assert.throws(()=>planPruneFixture(lab,U,[root(E,3)]));restoreFixture(lab.receipt,result.backup);assert.deepEqual(pair(lab),before);
  const child=new ReplayV2(lab,U,E);try{assert.equal(child.status().state,'READY');assert.equal(child.status().record,3);}finally{child.close();}
});

test('changed plans, roots and child writes are stale and cannot begin pruning',t=>{
  const {lab}=fixture(t),plan=planPruneFixture(lab,U,roots),before=pair(lab);
  assert.throws(()=>pruneFixture(lab,{...plan,roots:[root(B,2)]}),/STALE_PLAN/);assert.deepEqual(pair(lab),before);
  const s=new ReplayV2(lab,U,E);try{s.append([start(E,B,'2'),ev(E,2)]);}finally{s.close();}
  const after=pair(lab);assert.throws(()=>pruneFixture(lab,plan),/STALE_PLAN/);assert.deepEqual(pair(lab),after);
});

test('source changes after backup/reservation are refused before deleting any row',t=>{
  const {lab,file}=fixture(t),before=tables(file);
  assert.throws(()=>pruneFixture(lab,planPruneFixture(lab,U,roots),{onPhase(p){if(p!=='PRUNE_PREPARED')return;const db=new DatabaseSync(file);try{db.prepare("UPDATE records SET game_time='999' WHERE run_id=? AND record_id=3").run(B);}finally{db.close();}}}),/SOURCE_CHANGED/);
  const after=tables(file);assert.equal(after.records.length,before.records.length);assert.equal(after.sessions.length,before.sessions.length);assert.deepEqual(after.sealed_runs,before.sealed_runs);
  const j=JSON.parse(fs.readFileSync(path.join(lab.workspace,'stage4-operation.json')));restoreFixture(lab.receipt,j.backup);assert.deepEqual(tables(file),before);
});

test('no roots, retired/beyond-seal roots, incomplete profiles and arbitrary roots are refused',t=>{
  const {lab,baseline}=fixture(t),before=pair(lab);
  for(const rs of [[],[root(D,2)],[root(B,3)],[root(A,4)],[root(A,baseline-1)],[{...root(B,2),universe:U+'bad'}]])assert.throws(()=>planPruneFixture(lab,U,rs));
  assert.deepEqual(pair(lab),before);assert.throws(()=>planPruneFixture({receipt:{workspace:process.cwd(),rootId:lab.anchor.rootId}},U,roots),/DISPOSABLE_LAB_ONLY/);
});

for(const phase of ['BACKUP_MEMBER','BACKUP_VERIFIED'])test(`backup ${phase} cancellation/full-disk injection leaves managed pair unchanged`,t=>{
  const {lab}=fixture(t),before=pair(lab);
  assert.throws(()=>pruneFixture(lab,planPruneFixture(lab,U,roots),{onPhase(p){if(p===phase){const e=Error('SIMULATED_ENOSPC');e.code='ENOSPC';throw e;}}}),/SIMULATED_ENOSPC/);
  assert.deepEqual(pair(lab),before);openLab(lab.receipt);
});

for(const phase of ['PRUNE_PREPARED','RESERVED','MARKER_PREPARED','PRUNE_TRANSACTION','DATABASE_COMMITTED','CATALOGUE_VERIFIED','MARKER_READY','COMPLETE'])test(`interrupted ${phase} is blocked and explicitly restores its paired backup`,t=>{
  const {lab,file}=fixture(t),before=pair(lab),old=tables(file);let backup;
  assert.throws(()=>pruneFixture(lab,planPruneFixture(lab,U,roots),{onPhase(p){if(p===phase)throw Error('CANCELLED');}}),/CANCELLED/);
  backup=JSON.parse(fs.readFileSync(path.join(lab.workspace,'stage4-operation.json'))).backup;
  assert.throws(()=>openLab(lab.receipt),/STAGE4_RESTORATION_REQUIRED/);assert.throws(()=>recoverLab(lab.receipt),/STAGE4_RESTORATION_REQUIRED/);
  if(['PRUNE_PREPARED','RESERVED','MARKER_PREPARED','PRUNE_TRANSACTION'].includes(phase))assert.deepEqual(tables(file),old);
  restoreFixture(lab.receipt,backup);assert.deepEqual(pair(lab),before);assert.deepEqual(tables(file),old);
});

test('a real SQLite FULL inside pruning rolls back; backup and paired restoration remain usable',t=>{
  const {lab,file}=fixture(t),old=tables(file);let injected=false;
  assert.throws(()=>pruneFixture(lab,planPruneFixture(lab,U,roots),{onPhase(p,db){if(p!=='PRUNE_TRANSACTION')return;
    // Real SQLITE_FULL on the actual maintenance connection, using a page cap
    // and temporary fault table inside the same transaction as all deletions.
    const n=db.prepare('PRAGMA page_count').get().page_count;try{db.exec(`PRAGMA max_page_count=${n}; CREATE TABLE injected_full(x BLOB); INSERT INTO injected_full VALUES(zeroblob(2000000))`);}catch(e){injected=true;assert.match(e.message,/full/i);throw e;}
  }}),/full/i);
  assert.equal(injected,true);assert.deepEqual(tables(file),old);const j=JSON.parse(fs.readFileSync(path.join(lab.workspace,'stage4-operation.json')));restoreFixture(lab.receipt,j.backup);assert.deepEqual(tables(file),old);
});

for(const corruption of ['member','manifest','missing','extra','foreign'])test(`corrupt ${corruption} recovery set refuses before touching destination`,t=>{
  const {lab}=fixture(t),backup=backupFixture(lab),before=pair(lab),dir=backupDir(lab,backup);
  if(corruption==='member')fs.appendFileSync(path.join(dir,'managed','maintenance.db'),'bad');
  if(corruption==='manifest')fs.appendFileSync(path.join(dir,'manifest.json'),'bad');
  if(corruption==='missing')fs.unlinkSync(path.join(dir,'managed','maintenance.json'));
  if(corruption==='extra')fs.writeFileSync(path.join(dir,'unexpected'),'bad');
  assert.throws(()=>restoreFixture(lab.receipt,corruption==='foreign'?{...backup,rootId:'11111111-1111-1111-1111-111111111111'}:backup));assert.deepEqual(pair(lab),before);
});

for(const phase of ['RESTORE_PREPARED','RESTORE_MEMBER'])test(`interrupted ${phase} remains blocked and explicit resume completes exact paired restoration`,t=>{
  const {lab}=fixture(t),before=pair(lab),r=pruneFixture(lab,planPruneFixture(lab,U,roots));
  assert.throws(()=>restoreFixture(lab.receipt,r.backup,{onPhase(p){if(p===phase)throw Error('RESTORE_INTERRUPTED');}}),/RESTORE_INTERRUPTED/);
  assert.throws(()=>openLab(lab.receipt));assert.throws(()=>restoreFixture(lab.receipt,r.backup),/USE_EXPLICIT_RESTORE_RESUME/);
  resumeRestoreFixture(lab.receipt);assert.deepEqual(pair(lab),before);assert.ok(fs.readdirSync(lab.workspace).some(n=>n.startsWith('restoration-rollback-')));
});

test('unexpected destination and changed resume member are preserved rather than overwritten',t=>{
  const {lab}=fixture(t),r=pruneFixture(lab,planPruneFixture(lab,U,roots)),foreign=path.join(lab.profiles,'unknown.db');fs.writeFileSync(foreign,'keep');
  assert.throws(()=>restoreFixture(lab.receipt,r.backup));assert.equal(fs.readFileSync(foreign,'utf8'),'keep');fs.unlinkSync(foreign);
  assert.throws(()=>restoreFixture(lab.receipt,r.backup,{onPhase(p){if(p==='RESTORE_PREPARED')throw Error('STOP');}}));
  const marker=fs.readFileSync(lab.marker);fs.writeFileSync(lab.marker,'unexpected');assert.throws(()=>resumeRestoreFixture(lab.receipt),/RESTORE_DESTINATION_CHANGED/);assert.equal(fs.readFileSync(lab.marker,'utf8'),'unexpected');fs.writeFileSync(lab.marker,marker);resumeRestoreFixture(lab.receipt);
});

test('active prototype lease prevents backup, prune and restoration',t=>{
  const {lab}=fixture(t),plan=planPruneFixture(lab,U,roots),backup=backupFixture(lab),lease=acquireLease(lab);try{for(const fn of [()=>backupFixture(lab),()=>pruneFixture(lab,plan),()=>restoreFixture(lab.receipt,backup)])assert.throws(fn);}finally{lease.close();}
});

test('restoration stages all bytes before replacement; full-disk/cancellation there leaves current pair usable',t=>{
  const {lab}=fixture(t),r=pruneFixture(lab,planPruneFixture(lab,U,roots)),before=pair(lab);
  assert.throws(()=>restoreFixture(lab.receipt,r.backup,{onPhase(p){if(p==='RESTORE_STAGE_MEMBER')throw Error('SIMULATED_ENOSPC');}}),/SIMULATED_ENOSPC/);
  assert.deepEqual(pair(lab),before);openLab(lab.receipt);restoreFixture(lab.receipt,r.backup);
});

test('interrupted pruning cannot overwrite a foreign same-path universe database',t=>{
  const {lab,file}=fixture(t);assert.throws(()=>pruneFixture(lab,planPruneFixture(lab,U,roots),{onPhase(p){if(p==='DATABASE_COMMITTED')throw Error('STOP');}}));
  const j=JSON.parse(fs.readFileSync(path.join(lab.workspace,'stage4-operation.json'))),old=fs.readFileSync(file),db=new DatabaseSync(file);db.exec('PRAGMA application_id=1');db.close();const foreign=fileDigest(file);
  assert.throws(()=>restoreFixture(lab.receipt,j.backup));assert.equal(fileDigest(file),foreign);fs.writeFileSync(file,old);restoreFixture(lab.receipt,j.backup);
});

test('unexplained hot journals and WAL sidecars are preserved and block backup/pruning/restoration',t=>{
  const {lab,file}=fixture(t),b=backupFixture(lab),before=fileDigest(file);
  for(const suffix of ['-journal','-wal','-shm']){const side=file+suffix;fs.writeFileSync(side,'unexplained');for(const fn of [()=>backupFixture(lab),()=>planPruneFixture(lab,U,roots),()=>restoreFixture(lab.receipt,b)])assert.throws(fn);assert.equal(fs.readFileSync(side,'utf8'),'unexplained');assert.equal(fileDigest(file),before);fs.unlinkSync(side);}
});

test('paired backups cover multiple universes; pruning mutates only the selected database',t=>{
  const lab=createLab();t.after(()=>{assert.equal(path.dirname(lab.workspace),path.resolve(os.tmpdir()));assert.match(path.basename(lab.workspace),/^lifesigns-stage3-/);fs.rmSync(lab.workspace,{recursive:true});});
  const other='lsu1-2026-10-29_12-00-00-5-6-7-8';
  for(const id of [U,other]){const s=new ProfileStore(lab.sourceRoot,id,A);try{s.ingest([{...start(A),fields:{...start(A).fields,lifesigns_universe_id:id}},row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'SNAPSHOT_END',{profiles:'0'}),ev(A,4)]);}finally{s.close();}copyFixture(lab,id);}
  sealFixture(lab,U,[root(A,3)]);sealFixture(lab,other,[{universe:other,run:A,record:3}]);
  const before=pair(lab),otherFile=path.join(lab.profiles,other+'.db'),otherHash=fileDigest(otherFile),result=pruneFixture(lab,planPruneFixture(lab,U,[root(A,3)]));
  assert.equal(fileDigest(otherFile),otherHash);const manifest=JSON.parse(fs.readFileSync(path.join(backupDir(lab,result.backup),'manifest.json')));assert.equal(manifest.members.filter(m=>m.name.startsWith('managed/local-data/profiles/')).length,2);
  restoreFixture(lab.receipt,result.backup);assert.deepEqual(pair(lab),before);
});

test('pruning preserves its SQLite write lock through retained-view validation',t=>{
  const {lab,file}=fixture(t);let checked=false;
  pruneFixture(lab,planPruneFixture(lab,U,roots),{onPhase(p){if(p!=='PRUNE_TRANSACTION')return;checked=true;
    const child=spawnSync(process.execPath,['--input-type=module','-e',"import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1],{timeout:0});try{db.exec('BEGIN IMMEDIATE');process.exitCode=4;}catch{process.exitCode=0;}finally{db.close();}",file],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(child.status,0,child.stderr);
  }});assert.equal(checked,true);
});

test('hard exit inside pruning preserves hot journal evidence and refuses implicit repair or restoration',t=>{
  const {lab,file,source}=fixture(t),sourceHash=fileDigest(source),module=new URL('../experimental/pruning-v2.mjs',import.meta.url).href;
  const code=`import {openLab} from ${JSON.stringify(new URL('../experimental/maintenance-v2.mjs',import.meta.url).href)};import {planPruneFixture,pruneFixture} from ${JSON.stringify(module)};const [r,u,roots]=process.argv.slice(1),lab=openLab(JSON.parse(r));pruneFixture(lab,planPruneFixture(lab,u,JSON.parse(roots)),{onPhase(p){if(p==='PRUNE_TRANSACTION')process.exit(84);}});`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code,JSON.stringify(lab.receipt),U,JSON.stringify(roots)],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(child.status,84,child.stderr);
  const journal=file+'-journal';assert.equal(fs.existsSync(journal),true);const dbHash=fileDigest(file),journalHash=fileDigest(journal),j=JSON.parse(fs.readFileSync(path.join(lab.workspace,'stage4-operation.json')));
  assert.throws(()=>openLab(lab.receipt));assert.throws(()=>restoreFixture(lab.receipt,j.backup));assert.equal(fileDigest(file),dbHash);assert.equal(fileDigest(journal),journalHash);assert.equal(fileDigest(source),sourceHash);
});

test('separate-process SQLite reader blocks backup before any pruning',{timeout:30000},async t=>{
  const {lab,file}=fixture(t),before=pair(lab),code="import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1],{readOnly:true});db.exec('BEGIN');db.prepare('SELECT count(*) FROM records').get();process.stdout.write('LOCKED\\n');process.stdin.once('data',()=>{db.exec('ROLLBACK');db.close();});";
  const child=spawn(process.execPath,['--input-type=module','-e',code,file],{windowsHide:true,stdio:['pipe','pipe','pipe']}),done=once(child,'exit');
  try{await once(child.stdout,'data');assert.throws(()=>pruneFixture(lab,planPruneFixture(lab,U,roots)));}finally{child.stdin.end('STOP');await done;}
  assert.deepEqual(pair(lab),before);openLab(lab.receipt);
});

for(const phase of ['DATABASE_COMMITTED','RESTORE_MEMBER'])test(`real process exit at ${phase} requires explicit recovery and separate-process readback`,t=>{
  const {lab}=fixture(t),before=pair(lab),module=new URL('../experimental/pruning-v2.mjs',import.meta.url).href;
  let backup;if(phase==='RESTORE_MEMBER')backup=pruneFixture(lab,planPruneFixture(lab,U,roots)).backup;
  const code=`import {openLab} from ${JSON.stringify(new URL('../experimental/maintenance-v2.mjs',import.meta.url).href)};import {planPruneFixture,pruneFixture,restoreFixture} from ${JSON.stringify(module)};const [r,u,roots,b,p]=process.argv.slice(1),receipt=JSON.parse(r),onPhase=x=>{if(x===p)process.exit(83);};if(p==='RESTORE_MEMBER')restoreFixture(receipt,JSON.parse(b),{onPhase});else{const lab=openLab(receipt);pruneFixture(lab,planPruneFixture(lab,u,JSON.parse(roots)),{onPhase});}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code,JSON.stringify(lab.receipt),U,JSON.stringify(roots),JSON.stringify(backup||null),phase],{windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(child.status,83,child.stderr);assert.throws(()=>openLab(lab.receipt));
  const j=JSON.parse(fs.readFileSync(path.join(lab.workspace,'stage4-operation.json')));if(phase==='RESTORE_MEMBER')resumeRestoreFixture(lab.receipt);else restoreFixture(lab.receipt,j.backup);
  assert.deepEqual(pair(lab),before);
  const readback=spawnSync(process.execPath,['--input-type=module','-e',`import {openLab} from ${JSON.stringify(new URL('../experimental/maintenance-v2.mjs',import.meta.url).href)};openLab(JSON.parse(process.argv[1]));`,JSON.stringify(lab.receipt)],{windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(readback.status,0,readback.stderr);
});
