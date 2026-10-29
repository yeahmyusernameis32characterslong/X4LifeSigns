import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {ProfileStore} from '../store.mjs';
import {createLab,openLab,copyFixture,sealFixture,fileDigest,acquireLease,recoverLab} from '../experimental/maintenance-v2.mjs';
import {ReplayV2} from '../experimental/replay-v2.mjs';
import {restoreFixture,resumeRestoreFixture} from '../experimental/pruning-v2.mjs';
import {recoverPruneFixture,resumePruneRecoveryFixture} from '../experimental/recovery-v2.mjs';

const U='lsu1-2026-10-29_14-00-00-1-2-3-4',A='session-11-12-loaded-2026-10-29_14-00-00',B='session-13-14-loaded-2026-10-29_14-01-00';
const roots=[{universe:U,run:B,record:2}];
const row=(run,n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}});
const event=(run,n)=>row(run,n,'ENTITY_EVENT',{subject_kind:'NPC',subject_seed:'111',event_type:'ASSIGNMENT_OBSERVED',assigned_idcode:'SYN-001',actual_role:'Captain',assignment_basis:'ACTOR_ROLE_OR_CONTROL_OBSERVED'});
const start=(run,parent='NONE',record='0')=>row(run,1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:U,parent_run:parent,parent_record:record});
const pruneModule=new URL('../experimental/pruning-v2.mjs',import.meta.url).href,recoveryModule=new URL('../experimental/recovery-v2.mjs',import.meta.url).href,maintenanceModule=new URL('../experimental/maintenance-v2.mjs',import.meta.url).href;
function child(code,args=[]){return spawnSync(process.execPath,['--input-type=module','-e',code,...args],{windowsHide:true,encoding:'utf8',timeout:30000});}
const operation=lab=>path.join(lab.workspace,'stage4-operation.json');
const readOperation=lab=>JSON.parse(fs.readFileSync(operation(lab)));
function pair(lab){return ['registration.json','managed/maintenance.json','managed/maintenance.db','managed/local-data/profiles/'+U+'.db'].map(name=>({name,hash:fileDigest(path.join(lab.workspace,name))}));}
function views(lab){const s=new ReplayV2(lab,U,B);try{return {profiles:s.profilesAt(),events:s.eventsAt(),npc:s.historyForNpc('111')};}finally{s.close();}}
function fixture(t) {
  const lab=createLab();t.after(()=>{assert.equal(path.dirname(lab.workspace),path.resolve(os.tmpdir()));assert.match(path.basename(lab.workspace),/^lifesigns-stage3-/);fs.rmSync(lab.workspace,{recursive:true});});
  let s=new ProfileStore(lab.sourceRoot,U,A);
  s.ingest([start(A),row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'PROFILE_BEGIN',{kind:'NPC',profile:'1'}),row(A,4,'VALUE',{profile:'1',field:'seed',value:'111',state:'PRESENT',type:'string'}),row(A,5,'PROFILE_END',{profile:'1',partial:'0'}),row(A,6,'SNAPSHOT_END',{profiles:'1'}),event(A,7),event(A,8)]);const source=s.final;s.close();
  s=new ProfileStore(lab.sourceRoot,U,B);s.ingest([start(B,A,'7'),event(B,2),event(B,3)]);s.close();
  const file=copyFixture(lab,U);sealFixture(lab,U,roots);const expected=pair(lab),expectedViews=views(lab),sourceHash=fileDigest(source);
  const crashed=child(`import {openLab} from ${JSON.stringify(maintenanceModule)};import {planPruneFixture,pruneFixture} from ${JSON.stringify(pruneModule)};const [r,u,roots]=process.argv.slice(1),lab=openLab(JSON.parse(r));pruneFixture(lab,planPruneFixture(lab,u,JSON.parse(roots)),{onPhase(p,db){if(p==='PRUNE_TRANSACTION_BEGIN')db.exec('PRAGMA cache_size=1; PRAGMA cache_spill=ON');if(p==='PRUNE_TRANSACTION')process.exit(85);}});`,[JSON.stringify(lab.receipt),U,JSON.stringify(roots)]);
  assert.equal(crashed.status,85,crashed.stderr);assert.equal(fs.existsSync(file+'-journal'),true);assert.ok(readOperation(lab).transaction);
  return {lab,file,source,sourceHash,expected,expectedViews,damagedHash:fileDigest(file),journalHash:fileDigest(file+'-journal')};
}
function verify(t,f) {
  const {lab,file,expected,expectedViews,source,sourceHash,damagedHash,journalHash}=f;
  assert.deepEqual(pair(lab),expected);assert.deepEqual(views(lab),expectedViews);assert.equal(fileDigest(source),sourceHash);assert.equal(fs.existsSync(file+'-journal'),false);
  const j=readOperation(lab),base=path.join(lab.workspace,'recovery-evidence-'+j.recoveryId),manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));
  assert.equal(fileDigest(path.join(base,'pair','managed/local-data/profiles',U+'.db')),damagedHash);assert.equal(fileDigest(path.join(base,'pair',j.sidecar)),journalHash);assert.equal(fileDigest(path.join(base,'evacuated-journal')),journalHash);
  for(const m of manifest.observed)assert.equal(fileDigest(path.join(base,'pair',m.name)),m.hash);
  const reopened=child(`import {openLab} from ${JSON.stringify(maintenanceModule)};openLab(JSON.parse(process.argv[1]));`,[JSON.stringify(lab.receipt)]);assert.equal(reopened.status,0,reopened.stderr);
}

test('known inside-transaction crash restores exact paired backup while preserving damaged DB and journal',t=>{
  const f=fixture(t),prior=readOperation(f.lab);assert.notEqual(f.damagedHash,f.expected.find(m=>m.name.endsWith(U+'.db')).hash,'fixture must exercise actual spilled/dirty DB pages');
  assert.throws(()=>openLab(f.lab.receipt));assert.throws(()=>restoreFixture(f.lab.receipt,prior.backup));assert.throws(()=>recoverLab(f.lab.receipt));recoverPruneFixture(f.lab.receipt);verify(t,f);
  resumePruneRecoveryFixture(f.lab.receipt);resumePruneRecoveryFixture(f.lab.receipt);verify(t,f);
});

for(const phase of ['RECOVERY_EVIDENCE_COPIED','RECOVERY_STAGE_MEMBER','RECOVERY_PREPARED','RECOVERY_JOURNAL_PRESERVED','RECOVERY_MEMBER'])test(`real process exit during ${phase} preserves evidence and explicitly resumes`,t=>{
  const f=fixture(t),code=`import {recoverPruneFixture} from ${JSON.stringify(recoveryModule)};const [r,p]=process.argv.slice(1);recoverPruneFixture(JSON.parse(r),{onPhase(x){if(x===p)process.exit(86);}});`,r=child(code,[JSON.stringify(f.lab.receipt),phase]);assert.equal(r.status,86,r.stderr);assert.throws(()=>openLab(f.lab.receipt));
  const j=readOperation(f.lab);if(j.phase==='PRUNING')recoverPruneFixture(f.lab.receipt);else {assert.throws(()=>recoverPruneFixture(f.lab.receipt),/USE_EXPLICIT_RECOVERY_RESUME/);assert.throws(()=>resumeRestoreFixture(f.lab.receipt));resumePruneRecoveryFixture(f.lab.receipt);}
  verify(t,f);
});

test('repeated real exits while resuming different member replacements remain recoverable',t=>{
  const f=fixture(t);assert.throws(()=>recoverPruneFixture(f.lab.receipt,{onPhase(p){if(p==='RECOVERY_PREPARED')throw Error('STOP');}}));
  const code=`import {resumePruneRecoveryFixture} from ${JSON.stringify(recoveryModule)};const [r,p,name]=process.argv.slice(1);resumePruneRecoveryFixture(JSON.parse(r),{onPhase(x,n){if(x===p&&(!name||name===n))process.exit(87);}});`;
  for(const [phase,name] of [['RECOVERY_JOURNAL_PRESERVED',''],['RECOVERY_MEMBER','managed/maintenance.json'],['RECOVERY_MEMBER','managed/maintenance.db']]){const r=child(code,[JSON.stringify(f.lab.receipt),phase,name]);assert.equal(r.status,87,r.stderr);assert.throws(()=>openLab(f.lab.receipt));}
  resumePruneRecoveryFixture(f.lab.receipt);verify(t,f);
});

for(const bad of ['journal-bytes','journal-identity','journal-missing','wal','foreign-database','checkpoint','catalogue','marker','backup','registration'])test(`unknown ${bad} refuses explicit recovery without altering damaged evidence`,t=>{
  const f=fixture(t),j=readOperation(f.lab),side=f.file+'-journal';
  if(bad==='journal-bytes')fs.appendFileSync(side,'unknown');
  if(bad==='journal-identity'){const bytes=fs.readFileSync(side);fs.renameSync(side,side+'.foreign-preserved');fs.writeFileSync(side,bytes);}
  if(bad==='journal-missing')fs.renameSync(side,side+'.foreign-preserved');
  if(bad==='wal')fs.writeFileSync(f.file+'-wal','unknown');
  if(bad==='foreign-database'){const bytes=fs.readFileSync(f.file);fs.renameSync(f.file,f.file+'.foreign-preserved');fs.writeFileSync(f.file,bytes);}
  if(bad==='checkpoint'){delete j.transaction;fs.writeFileSync(operation(f.lab),JSON.stringify(j));}
  if(bad==='catalogue'){const db=new DatabaseSync(f.lab.catalogue);db.exec("UPDATE root_state SET phase='READY'");db.close();}
  if(bad==='marker')fs.writeFileSync(f.lab.marker,JSON.stringify({kind:'FOREIGN'}));
  if(bad==='backup')fs.appendFileSync(path.join(f.lab.workspace,'backups',j.backup.id,'managed/maintenance.db'),'unknown');
  if(bad==='registration')fs.unlinkSync(path.join(f.lab.workspace,'registration.json'));
  const before={db:fileDigest(f.file),journal:fs.existsSync(side)?fileDigest(side):null,op:fileDigest(operation(f.lab))};assert.throws(()=>recoverPruneFixture(f.lab.receipt));assert.equal(fileDigest(f.file),before.db);if(before.journal)assert.equal(fileDigest(side),before.journal);assert.equal(fileDigest(operation(f.lab)),before.op);
});

for(const bad of ['evidence','staging','active','evacuated-journal'])test(`changed ${bad} blocks interrupted recovery resume`,t=>{
  const f=fixture(t);assert.throws(()=>recoverPruneFixture(f.lab.receipt,{onPhase(p){if(p===(bad==='evacuated-journal'?'RECOVERY_JOURNAL_PRESERVED':'RECOVERY_PREPARED'))throw Error('STOP');}}));
  const j=readOperation(f.lab),evidence=path.join(f.lab.workspace,'recovery-evidence-'+j.recoveryId),stage=path.join(f.lab.workspace,'recovery-staging-'+j.recoveryId);
  const target=bad==='evidence'?path.join(evidence,'pair',j.sidecar):bad==='staging'?path.join(stage,'managed/maintenance.db'):bad==='evacuated-journal'?path.join(evidence,'evacuated-journal'):f.file;
  fs.appendFileSync(target,'changed');const h=fileDigest(target);assert.throws(()=>resumePruneRecoveryFixture(f.lab.receipt));assert.equal(fileDigest(target),h);assert.throws(()=>openLab(f.lab.receipt));
});

test('live lease and live checkpoint owner cannot be stolen by explicit recovery',t=>{
  const f=fixture(t),j=readOperation(f.lab);const lease=acquireLease(f.lab,{recoverDead:true});try{assert.throws(()=>recoverPruneFixture(f.lab.receipt),/MAINTENANCE_BUSY/);}finally{lease.close();}
  j.transaction.pid=process.pid;fs.writeFileSync(operation(f.lab),JSON.stringify(j));assert.throws(()=>recoverPruneFixture(f.lab.receipt),/CHECKPOINT_OWNER_NOT_DEAD/);assert.equal(fileDigest(f.file+'-journal'),f.journalHash);
});
