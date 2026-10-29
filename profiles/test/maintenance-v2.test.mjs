import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { ProfileStore } from '../store.mjs';
import { createLab,openLab,copyFixture,sealFixture,recoverLab,fileDigest,acquireLease,openRegisteredV2 } from '../experimental/maintenance-v2.mjs';
import { ReplayV2 } from '../experimental/replay-v2.mjs';

const U='lsu1-2026-10-28_12-00-00-1-2-3-4';
const A='session-1-2-loaded-2026-10-28_12-00-00',B='session-3-4-loaded-2026-10-28_12-01-00',C='session-5-6-loaded-2026-10-28_12-02-00',D='session-7-8-loaded-2026-10-28_12-03-00',E='session-9-10-loaded-2026-10-28_12-04-00';
const row=(run,n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}});
const start=(run,parent='NONE',cutoff='0')=>row(run,1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:U,parent_run:parent,parent_record:cutoff});
const ev=(run,n)=>row(run,n,'ENTITY_EVENT',{subject_kind:'NPC',subject_seed:'111',event_type:'ASSIGNMENT_OBSERVED',assigned_idcode:'SYN-001',actual_role:run===C?'Marine':'Captain',assignment_basis:'ACTOR_ROLE_OR_CONTROL_OBSERVED'});
const root=(run,record)=>({universe:U,run,record});
function cleanup(t,receipt) {t.after(()=>{assert.equal(path.dirname(receipt.workspace),path.resolve(os.tmpdir()));assert.match(path.basename(receipt.workspace),/^lifesigns-stage3-/);fs.rmSync(receipt.workspace,{recursive:true});});}
function fixture(t) {
 const lab=createLab();cleanup(t,lab.receipt);let s=new ProfileStore(lab.sourceRoot,U,A);
 const rowsA=[start(A),row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'PROFILE_BEGIN',{kind:'NPC',profile:'1'}),row(A,4,'VALUE',{profile:'1',field:'seed',value:'111',state:'PRESENT',type:'datatype.largeint'}),row(A,5,'PROFILE_END',{profile:'1',partial:'0'}),row(A,6,'SNAPSHOT_END',{profiles:'1'}),ev(A,7),ev(A,8),ev(A,9)];
 s.ingest(rowsA);const source=s.final;s.close();
 const rows=new Map([[A,rowsA]]);
 for(const [run,cutoff] of [[B,'7'],[C,'8'],[D,'6']]){s=new ProfileStore(lab.sourceRoot,U,run);const r=[start(run,A,cutoff),ev(run,2),ev(run,3)];s.ingest(r);s.close();rows.set(run,r);}
 const file=copyFixture(lab,U);return {lab,source,file,rows};
}
function rawTables(file) {
 const db=new DatabaseSync(file,{readOnly:true});try{return Object.fromEntries(['universe_metadata','sessions','records','profile_versions','events'].map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all()]));}finally{db.close();}
}
function views(store,roots) {return roots.map(r=>({events:store.eventsAt(r.run,r.record),profiles:store.profilesAt(r.run,r.record),npc:store.historyForNpc('111',{run:r.run,record:r.record})}));}

test('v2 copy migration preserves raw tables, every retained branch/ancestor view and source bytes',t=>{
 const {lab,source,file}=fixture(t),before=fileDigest(source),tables=rawTables(file),roots=[root(B,2),root(C,2)];
 const old=new ProfileStore(lab.sourceRoot,U,B),expected=views(old,roots);old.close();
 const result=sealFixture(lab,U,roots);assert.deepEqual(result.manifest.seals,[{run:A,cutoff:8},{run:B,cutoff:2},{run:C,cutoff:2},{run:D,cutoff:0}]);
 assert.deepEqual(rawTables(file),tables);assert.equal(fileDigest(source),before);
 const s=new ReplayV2(lab,U,B);try{assert.deepEqual(views(s,roots),expected);assert.equal(s.status().state,'SEALED');}finally{s.close();}
});

test('sealed replay separates exact retained rows, archived tails and retired runs without writing or READY',t=>{
 const {lab,file,rows}=fixture(t);sealFixture(lab,U,[root(B,2)]);const before=fileDigest(file);
 let s=new ReplayV2(lab,U,B);try {
  assert.deepEqual(s.replay(rows.get(B)),{state:'SEALED_REPLAY',retainedCutoff:2,retained:2,archived:1});
  assert.throws(()=>s.replay([{...rows.get(B)[1],age:'999'}]),/CONFLICTING_RETAINED_REPLAY/);
  assert.throws(()=>s.append([ev(B,4)]),/SEALED_RUN/);assert.throws(()=>s.eventsAt(B,3),/PARENT_BEYOND_RETAINED_CUTOFF/);
 }finally{s.close();}
 s=new ReplayV2(lab,U,D);try{assert.equal(s.replay(rows.get(D)).state,'RETIRED_REPLAY');assert.throws(()=>s.append([start(D,A,'6')]),/SEALED_RUN/);assert.throws(()=>s.eventsAt(),/RETIRED_PARENT/);}finally{s.close();}
 assert.equal(fileDigest(file),before);
});

test('fresh children inherit retained ancestry only and preserve exact replay and branch isolation',t=>{
 const {lab,source}=fixture(t),roots=[root(B,2),root(C,2)];sealFixture(lab,U,roots);
 const s=new ReplayV2(lab,U,E);try {
  assert.equal(s.status().state,'NEED_CHILD');assert.throws(()=>s.append([start(E,B,'3')]),/PARENT_BEYOND_RETAINED_CUTOFF/);
  assert.throws(()=>s.append([start(E,D,'1')]),/RETIRED_PARENT/);
  const input=[start(E,B,'2'),ev(E,2)];assert.equal(s.append(input).state,'READY');s.append(input);
  assert.throws(()=>s.append([{...input[1],age:'999'}]),/Conflicting replay/);
  assert.throws(()=>s.append([ev(E,4)]),/Non-contiguous/);
  assert.equal(s.eventsAt().at(-1).run_id,E);assert.ok(!s.eventsAt().some(e=>e.run_id===C));
  const old=new ProfileStore(lab.sourceRoot,U,B);try{assert.deepEqual(views(s,roots),views(old,roots));}finally{old.close();}
 }finally{s.close();}
 assert.equal(rawTables(source).sessions.length,4);
});

test('unsafe root cuts and incomplete root lists do not mutate a registered v1 copy',t=>{
 const {lab,file}=fixture(t),before=fileDigest(file);
 for(const roots of [[],[root(A,4)],[root(A,5)],[root(B,99)],[root(E,1)],[{...root(B,2),universe:U+'bad'}]])assert.throws(()=>sealFixture(lab,U,roots));
 assert.equal(fileDigest(file),before);openLab(lab.receipt);
});

test('retired universe keeps its v2 refusal object; old writer refuses it unchanged',t=>{
 const {lab,file}=fixture(t);sealFixture(lab,U,[],{retire:true});const before=fileDigest(file);
 assert.throws(()=>new ReplayV2(lab,U,E),/UNIVERSE_NOT_ACTIVE/);
 assert.throws(()=>new ProfileStore(lab.root,U,E),/Incompatible/);assert.equal(fileDigest(file),before);assert.equal(rawTables(file).sessions.length,4);
});

test('exact old-writer missing-path hazard is demonstrated on a separate temporary fixture',t=>{
 const lab=createLab();cleanup(t,lab.receipt);
 const old=new ProfileStore(lab.sourceRoot,U,E);try{const status=old.ingest([start(E,B,'2'),row(E,2,'SNAPSHOT_BEGIN'),row(E,3,'SNAPSHOT_END',{profiles:'0'})]);assert.equal(status.state,'READY');assert.equal(old.db.prepare('SELECT parent_run FROM sessions').get().parent_run,null);}finally{old.close();}
});

for(const phase of ['ANCHOR','CATALOGUE','MARKER'])test(`explicit bootstrap recovery after ${phase}`,t=>{
 let receipt;assert.throws(()=>createLab({onPhase(p,r){receipt=r;if(p===phase)throw Error('INTERRUPTED');}}),/INTERRUPTED/);cleanup(t,receipt);
 assert.throws(()=>openLab(receipt));const lab=recoverLab(receipt);assert.equal(JSON.parse(fs.readFileSync(lab.marker)).generation,0);
});

for(const phase of ['RESERVED','MARKER_PREPARED','DATABASE_COMMITTED','CATALOGUE_VERIFIED','MARKER_READY'])test(`interrupted ${phase} blocks opens until explicit matching recovery`,t=>{
 const {lab,file}=fixture(t);assert.throws(()=>sealFixture(lab,U,[root(B,2)],{onPhase(p){if(p===phase)throw Error('INTERRUPTED');}}),/INTERRUPTED/);
 assert.throws(()=>openLab(lab.receipt));recoverLab(lab.receipt);const db=new DatabaseSync(file,{readOnly:true});try{assert.equal(db.prepare('PRAGMA user_version').get().user_version,['RESERVED','MARKER_PREPARED'].includes(phase)?1:2);}finally{db.close();}
 if(!['RESERVED','MARKER_PREPARED'].includes(phase)){const s=new ReplayV2(lab,U,B);try{assert.equal(s.status().state,'SEALED');}finally{s.close();}}
});

for(const lost of ['catalogue','marker','both','anchor'])test(`READY registration refuses lost ${lost}, including attempted recovery`,t=>{
 const {lab,file}=fixture(t);sealFixture(lab,U,[root(B,2)]);const before=fileDigest(file);
 if(lost==='catalogue'||lost==='both')fs.unlinkSync(lab.catalogue);
 if(lost==='marker'||lost==='both')fs.unlinkSync(lab.marker);
 if(lost==='anchor')fs.unlinkSync(path.join(lab.workspace,'registration.json'));
 assert.throws(()=>openLab(lab.receipt));assert.throws(()=>recoverLab(lab.receipt));assert.equal(fileDigest(file),before);
 if(lost==='catalogue'||lost==='both')assert.equal(fs.existsSync(lab.catalogue),false);
});

test('mismatched generations, foreign marker/catalogue and unexplained database paths refuse without repair',t=>{
 const {lab,file}=fixture(t);sealFixture(lab,U,[root(B,2)]);const before=fileDigest(file),original=fs.readFileSync(lab.marker);
 const marker=JSON.parse(original);fs.writeFileSync(lab.marker,JSON.stringify({...marker,generation:99}));assert.throws(()=>openLab(lab.receipt),/RECOVERY_REQUIRED/);fs.writeFileSync(lab.marker,original);
 const cat=fs.readFileSync(lab.catalogue),db=new DatabaseSync(lab.catalogue);db.exec('PRAGMA application_id=1');db.close();assert.throws(()=>openLab(lab.receipt),/INCOMPATIBLE_SCHEMA/);fs.writeFileSync(lab.catalogue,cat);
 fs.writeFileSync(path.join(lab.profiles,'unexpected.db'),'foreign');assert.throws(()=>openLab(lab.receipt),/DATABASE_INVENTORY_MISMATCH/);assert.equal(fileDigest(file),before);
});

test('lease excludes concurrent prototype maintenance/writers and cannot be stolen from a live owner',t=>{
 const {lab}=fixture(t),lease=acquireLease(lab);
 try{assert.throws(()=>acquireLease(lab));assert.throws(()=>acquireLease(lab,{recoverDead:true}),/MAINTENANCE_BUSY/);assert.throws(()=>sealFixture(lab,U,[root(B,2)]));}finally{lease.close();}
 sealFixture(lab,U,[root(B,2)]);const s=new ReplayV2(lab,U,B);try{assert.throws(()=>new ReplayV2(lab,U,C));}finally{s.close();}
});

test('non-lab roots are rejected before any fixture or production data can be opened',()=>{
 assert.throws(()=>openLab({workspace:process.cwd(),rootId:'11111111-1111-1111-1111-111111111111'}),/DISPOSABLE_LAB_ONLY/);
});

test('raw v2 writer entry requires an issued lease and lab paths cannot be redirected',t=>{
 const {lab,file}=fixture(t);sealFixture(lab,U,[root(B,2)]);const before=fileDigest(file);
 assert.throws(()=>openRegisteredV2(lab,U),/LEASE_REQUIRED/);assert.throws(()=>openRegisteredV2(lab,U,{guard(){}}),/LEASE_REQUIRED/);
 assert.throws(()=>{lab.profiles=process.cwd();},TypeError);
 const forged={...lab,profiles:process.cwd(),catalogue:path.join(process.cwd(),'missing')};
 const s=new ReplayV2(forged,U,B);try{assert.equal(s.file,file);}finally{s.close();}
 assert.equal(fileDigest(file),before);
});

test('already-open v1 connection is not revoked by version bump; SQL guards still refuse new sealed inserts',t=>{
 const {lab,file,rows}=fixture(t),old=new ProfileStore(lab.root,U,A);
 try {
  sealFixture(lab,U,[root(B,2)]);const before=fileDigest(file);
  const status=old.ingest(rows.get(A));assert.equal(status.state,'READY');assert.equal(status.record,9);
  assert.throws(()=>old.ingest([ev(A,10)]),/SEALED_RUN/);assert.equal(fileDigest(file),before);
 }finally{old.close();}
});

test('real process termination leaves a stale lease and requires explicit recovery, never automatic resume',t=>{
 const {lab,file}=fixture(t),before=rawTables(file);
 const module=new URL('../experimental/maintenance-v2.mjs',import.meta.url).href;
 const code=`import {openLab,sealFixture} from ${JSON.stringify(module)};const [r,u,b]=process.argv.slice(1);sealFixture(openLab(JSON.parse(r)),u,[{universe:u,run:b,record:2}],{onPhase(p){if(p==='DATABASE_COMMITTED')process.exit(81);}});`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code,JSON.stringify(lab.receipt),U,B],{encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(child.status,81,child.stderr);assert.equal(fs.existsSync(lab.lock),true);assert.throws(()=>openLab(lab.receipt));
 recoverLab(lab.receipt);assert.equal(fs.existsSync(lab.lock),false);assert.deepEqual(rawTables(file),before);
 const verify=`import {openLab} from ${JSON.stringify(module)};import {ReplayV2} from ${JSON.stringify(new URL('../experimental/replay-v2.mjs',import.meta.url).href)};const [r,u,b]=process.argv.slice(1);const s=new ReplayV2(openLab(JSON.parse(r)),u,b);try{console.log(JSON.stringify(s.status()));}finally{s.close();}`;
 const reopened=spawnSync(process.execPath,['--input-type=module','-e',verify,JSON.stringify(lab.receipt),U,B],{encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(reopened.status,0,reopened.stderr);assert.deepEqual(JSON.parse(reopened.stdout),{state:'SEALED',retainedCutoff:2});
});

test('an active SQLite reader prevents migration and leaves an explicitly recoverable reservation',t=>{
 const {lab,file}=fixture(t),before=fileDigest(file),reader=new DatabaseSync(file,{readOnly:true});
 try {reader.exec('BEGIN');reader.prepare('SELECT count(*) n FROM records').get();assert.throws(()=>sealFixture(lab,U,[root(B,2)]));assert.throws(()=>openLab(lab.receipt));}
 finally{reader.exec('ROLLBACK');reader.close();}
 recoverLab(lab.receipt);assert.equal(fileDigest(file),before);
});

test('wrong recovery marker and unexplained sidecars never get repaired or ignored',t=>{
 const {lab,file}=fixture(t);assert.throws(()=>sealFixture(lab,U,[root(B,2)],{onPhase(p){if(p==='DATABASE_COMMITTED')throw Error('INTERRUPTED');}}));
 const before=fileDigest(file),original=fs.readFileSync(lab.marker),marker=JSON.parse(original);
 fs.writeFileSync(lab.marker,JSON.stringify({...marker,rootId:'foreign'}));assert.throws(()=>recoverLab(lab.receipt),/MARKER_MISMATCH/);assert.equal(fileDigest(file),before);
 fs.writeFileSync(lab.marker,original);fs.writeFileSync(file+'-journal','unexplained');assert.throws(()=>recoverLab(lab.receipt));assert.equal(fs.readFileSync(file+'-journal','utf8'),'unexplained');assert.equal(fileDigest(file),before);
});
