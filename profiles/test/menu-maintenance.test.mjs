import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {fork} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {ProfileStore} from '../store.mjs';
import {createMenuTest,scanMenuTest,reviewMenuTest,executeMenuTest,testRegistration,hashFile,TEST_REGISTRATION} from '../maintenance-test.mjs';
import {setProtection,readSettings} from '../preview-settings.mjs';
import {PreviewService} from '../preview-service.mjs';
import {PREVIEW_REPLY} from '../preview-protocol.mjs';

const U='lsu1-2026-10-29_12-00-00-1-2-3-4',V='lsu1-2026-10-29_12-00-00-5-6-7-8';
const A='session-1-2-loaded-2026-10-29_12-00-00',B='session-3-4-loaded-2026-10-29_12-01-00',C='session-5-6-loaded-2026-10-29_12-02-00',D='session-7-8-loaded-2026-10-29_12-03-00';
const row=(run,n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}});
const start=(id,run,parent='NONE',n='0')=>row(run,1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:id,parent_run:parent,parent_record:n});
const event=(run,n)=>row(run,n,'ENTITY_EVENT',{subject_kind:'SHIP',subject_seed:'42',event_type:'ATTACKED'});
const xml=(id,run,n)=>`<savegame><info><game id="X4" version="900"/></info><script><refs type="string"><ref id="10" string="${id}"/><ref id="11" string="${run}"/></refs></script><md><script name="LifeSigns_EventRecorder"><cue name="UniverseIdentity"><vars><value name="$Id" type="string" value="10"/><value name="$CheckpointRun" type="string" value="11"/><value name="$CheckpointRecord" type="largefloat" value="${n}"/></vars></cue></script></md></savegame>`;
function working(c,id){for(const name of fs.readdirSync(path.join(c.root,'universes'))){const root=path.join(c.root,'universes',name);if(JSON.parse(fs.readFileSync(path.join(root,'maintenance-owned.json'))).universe===id)return {root,file:path.join(root,'local-data','profiles',id+'.db')};}throw Error('fixture');}
function data(file){const db=new DatabaseSync(file,{readOnly:true});try{return ['universe_metadata','sessions','records','profile_versions','events'].map(n=>db.prepare(`SELECT * FROM ${n} ORDER BY 1,2`).all());}finally{db.close();}}
async function fixture(t,two=false) {
  const host=fs.mkdtempSync(path.join(os.tmpdir(),'lsmenu-'));t.after(()=>{assert.equal(path.dirname(host),path.resolve(os.tmpdir()));assert.match(path.basename(host),/^lsmenu-/);fs.rmSync(host,{recursive:true});});fs.mkdirSync(path.join(host,'local-data'));const source=path.join(host,'source');fs.mkdirSync(source);const saveFiles=[],profileFiles=[];
  for(const id of two?[U,V]:[U]){
    let s=new ProfileStore(source,id,A);s.ingest([start(id,A),row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'PROFILE_BEGIN',{kind:'SHIP',profile:'1'}),row(A,4,'VALUE',{profile:'1',field:'seed',value:'42',state:'PRESENT',type:'string'}),row(A,5,'PROFILE_END',{profile:'1',partial:'0'}),row(A,6,'SNAPSHOT_END',{profiles:'1'}),event(A,7),event(A,8),event(A,9)]);profileFiles.push(s.final);s.close();
    for(const [run,cut] of [[B,'7'],[C,'8'],[D,'6']]){s=new ProfileStore(source,id,run);s.ingest([start(id,run,A,cut),event(run,2),event(run,3)]);s.close();}
    for(const [i,run] of [B,C].entries()){const file=path.join(source,`${id===U?'one':'two'}-${i}.xml.gz`);fs.writeFileSync(file,gzipSync(xml(id,run,2)));saveFiles.push(file);}
  }
  const hashes=[...saveFiles,...profileFiles].map(f=>[f,hashFile(f)]),c=await createMenuTest(host,{saveFiles,profileFiles});return {host,c,hashes,...working(c,U)};
}

test('real native save copies select owned test DBs; Apply and selected-universe Restore preserve sources and other universe',{timeout:180000},async t=>{
  const f=await fixture(t,true),other=working(f.c,V),original=data(f.file),otherHash=hashFile(other.file),scan=await scanMenuTest(f.host);
  assert.equal(scan.databases.length,2);assert.equal(scan.databases[0].candidates.records,6);
  const confirmation=await reviewMenuTest(f.host,U,'CLEAN'),result=await executeMenuTest(f.host,confirmation);assert.ok(result.backupId);
  const db=new DatabaseSync(f.file,{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM records').get().n,12);assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n,3);assert.equal(db.prepare('SELECT cutoff FROM maintenance_test_seals WHERE run_id=?').get(D).cutoff,0);assert.equal(db.prepare('SELECT count(*) n FROM records WHERE run_id=? AND record_id=8').get(A).n,1);assert.throws(()=>new ProfileStore(f.root,U,B),/Maintenance/);}finally{db.close();}
  assert.equal(hashFile(other.file),otherHash);assert.equal((await scanMenuTest(f.host)).databases[0].candidates.records,0);
  await executeMenuTest(f.host,await reviewMenuTest(f.host,U,'RESTORE'));assert.deepEqual(data(f.file),original);assert.equal(hashFile(other.file),otherHash);for(const [file,h] of f.hashes)assert.equal(hashFile(file),h);
  assert.throws(()=>new ProfileStore(f.c.root,U,B),/Maintenance/);
});

test('whole-universe protection and changed protection invalidate confirmation',{timeout:120000},async t=>{
  const f=await fixture(t),s=readSettings(f.c.root);setProtection(f.c.root,s.digest,U,true);await assert.rejects(reviewMenuTest(f.host,U,'CLEAN'),/PROTECTED/);
  setProtection(f.c.root,readSettings(f.c.root).digest,U,false);const p=await reviewMenuTest(f.host,U,'CLEAN'),before=hashFile(f.file);setProtection(f.c.root,readSettings(f.c.root).digest,U,true);await assert.rejects(executeMenuTest(f.host,p),/PROTECTED/);assert.equal(hashFile(f.file),before);
});

test('stale working DB, changed copied saves and invalid ownership refuse without modifying targets',{timeout:120000},async t=>{
  const f=await fixture(t),p=await reviewMenuTest(f.host,U,'CLEAN');fs.appendFileSync(path.join(f.c.root,'evidence','saves','one-0.xml.gz'),'changed');const before=hashFile(f.file);await assert.rejects(executeMenuTest(f.host,p),/EVIDENCE_CHANGED/);assert.equal(hashFile(f.file),before);
  const pointer=path.join(f.host,'local-data',TEST_REGISTRATION);fs.unlinkSync(pointer);assert.throws(()=>testRegistration(f.host));assert.equal(hashFile(f.file),before);
});

test('active leases and stale plans refuse, interrupted operation remains blocked with retained backup',{timeout:120000},async t=>{
  const f=await fixture(t),p=await reviewMenuTest(f.host,U,'CLEAN'),before=hashFile(f.file);fs.writeFileSync(path.join(f.root,'maintenance.lock'),'owned elsewhere');await assert.rejects(executeMenuTest(f.host,p),/BUSY/);fs.unlinkSync(path.join(f.root,'maintenance.lock'));
  await assert.rejects(executeMenuTest(f.host,p,{onPhase(phase){if(phase==='TRANSACTION')throw Error('INJECTED');}}),/INJECTED/);assert.equal(hashFile(f.file),before);const scan=await scanMenuTest(f.host);assert.equal(scan.databases[0].status,'BLOCKED');assert.ok(scan.databases[0].blocks.some(s=>s.includes('RECOVERY_REQUIRED')));assert.ok(fs.readdirSync(path.join(f.root,'backups')).length);
});

test('a changed database after review is not silently adopted',{timeout:120000},async t=>{
  const f=await fixture(t),p=await reviewMenuTest(f.host,U,'CLEAN'),db=new DatabaseSync(f.file);db.exec("UPDATE records SET game_time='999' WHERE record_id=3");db.close();const before=hashFile(f.file);await assert.rejects(executeMenuTest(f.host,p),/TEST_DATABASE_CHANGED/);assert.equal(hashFile(f.file),before);
});

test('actual companion worker transport scans, confirms, applies and restores the selected test copy',{timeout:240000},async t=>{
  const f=await fixture(t),replies=path.join(f.host,'replies');fs.mkdirSync(replies);let childErrors='';const s=new PreviewService({root:f.host,replyDirectory:replies,launch:()=>{const child=fork(new URL('../preview-scan-worker.mjs',import.meta.url),[],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true,execArgv:['--max-old-space-size=384']});child.stderr.on('data',d=>childErrors+=d);child.on('exit',(code,signal)=>childErrors+=`exit ${code} ${signal}\n`);return child;}});t.after(async()=>{s.stop();await s.waitForExit();});let seq=0;
  const send=async(verb,item=0,enabled=0)=>{const n=++seq;s.handle(`LSHK1|${s.gen}|${'2'.repeat(32)}|${n}|${verb}|${item}|${enabled}|0|END`);const until=Date.now()+60000;while(Date.now()<until){s.poll();const text=fs.readFileSync(path.join(replies,PREVIEW_REPLY+'.reply'),'utf8');if(!s.scanning&&text.includes(`|${n}|READY|`))return text;if(!s.scanning&&text.includes(`|${n}|ERROR|`))throw Error(text+'\n'+childErrors);await new Promise(r=>setTimeout(r,20));}throw Error('TIMEOUT '+verb);};
  const before=hashFile(f.file),original=data(f.file);await send('REFRESH');assert.equal(s.testMode,true);await send('REVIEW',1);assert.ok(s.confirmation);await send('APPLY',1,1);assert.notEqual(hashFile(f.file),before);await s.waitForExit();await send('REFRESH');await send('RESTOREREVIEW',1);await send('RESTORE',1,1);assert.deepEqual(data(f.file),original);
});
