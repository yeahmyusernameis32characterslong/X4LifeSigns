// Explicit disposable menu-test backend. Never accepts a live cleanup target.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {checkPath,checkSidecars} from '../bridge/src/session-path.js';
import {checkAvailability,sameSnapshot} from './inventory-path.mjs';
import {APP,statements,universeId,validateProfileDatabase} from './profile-schema.mjs';
import {inventorySaves} from './save-inventory.mjs';
import {inspectProfileDatabase} from './profile-inventory.mjs';
import {retentionPreview} from './retention-plan.mjs';
import {readSettings} from './preview-settings.mjs';

export const TEST_REGISTRATION='housekeeping-menu-test.json';
const fail=code=>{throw Error(code);},sha=text=>createHash('sha256').update(text).digest('hex');
const MAX=4*1024**3,HEX=/^[0-9a-f]{64}$/;
const testSql=[
 `CREATE TABLE maintenance_test_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), root_id TEXT NOT NULL, generation INTEGER NOT NULL, plan_digest TEXT NOT NULL) STRICT`,
 `CREATE TABLE maintenance_test_seals (run_id TEXT PRIMARY KEY, cutoff INTEGER NOT NULL CHECK(cutoff>=0)) STRICT`,
 `CREATE TRIGGER maintenance_test_record BEFORE INSERT ON records BEGIN SELECT RAISE(ABORT,'MAINTENANCE_ONLY'); END`,
 `CREATE TRIGGER maintenance_test_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT,'MAINTENANCE_ONLY'); END`,
];
export function hashFile(file) {
  const info=checkPath(file);if(info.size>MAX)fail('RESOURCE_LIMIT_4_GIB');checkAvailability(file);
  const h=createHash('sha256'),buffer=Buffer.alloc(1024*1024),fd=fs.openSync(file,'r');
  try{for(let n;(n=fs.readSync(fd,buffer,0,buffer.length,null));)h.update(buffer.subarray(0,n));if(!sameSnapshot(info,fs.fstatSync(fd))||!sameSnapshot(info,checkPath(file)))fail('INPUT_CHANGED');}finally{fs.closeSync(fd);}
  return h.digest('hex');
}
function json(file){if(checkPath(file).size>4*1024*1024)fail('OVERSIZED_REGISTRATION');return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(file,value){checkPath(path.dirname(file),{directory:true});checkPath(file,{missing:true});const tmp=file+'.'+randomUUID()+'.tmp',fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}try{fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function copy(from,to){checkPath(from);checkPath(path.dirname(to),{directory:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);if(hashFile(from)!==hashFile(to))fail('COPY_CHANGED');}
function uuid(id){if(!/^[0-9a-f-]{36}$/.test(id||''))fail('INVALID_REGISTRATION');return id;}
export function hasTestRegistration(host){return !!checkPath(path.join(host,'local-data',TEST_REGISTRATION),{missing:true});}
export function testRegistration(host) {
  host=path.resolve(host);checkPath(host,{directory:true});const registration=json(path.join(host,'local-data',TEST_REGISTRATION));
  if(registration.kind!=='LifeSignsIsolatedMenuTest'||!HEX.test(registration.manifestDigest))fail('INVALID_TEST_REGISTRATION');
  const root=path.join(host,'local-data','housekeeping-menu-test-'+uuid(registration.id)),manifestFile=path.join(root,'manifest.json');checkPath(root,{directory:true});
  if(json(path.join(root,'maintenance-owned.json')).rootId!==registration.id)fail('TEST_ROOT_IDENTITY_MISMATCH');
  if(hashFile(manifestFile)!==registration.manifestDigest)fail('TEST_REGISTRATION_CHANGED');const manifest=json(manifestFile);
  if(manifest.kind!==registration.kind||manifest.id!==registration.id||!Array.isArray(manifest.universes)||manifest.universes.length>32||!Array.isArray(manifest.inputs)||manifest.inputs.length>96)fail('INVALID_TEST_MANIFEST');
  for(const id of manifest.universes)universeId(id);
  return {host,root,manifest,registration};
}
function inputs(c) {
  const names=fs.readdirSync(path.join(c.root,'evidence','saves')).sort();
  if(JSON.stringify(names)!==JSON.stringify(c.manifest.inputs.filter(x=>x.type==='save').map(x=>x.name).sort()))fail('SAVE_INPUT_SET_CHANGED');
  for(const i of c.manifest.inputs){if(!['save','profile'].includes(i.type)||path.basename(i.name)!==i.name)fail('INVALID_INPUT_RECEIPT');const f=path.join(c.root,'evidence',i.type==='save'?'saves':'profiles',i.name);if(hashFile(f)!==i.hash)fail('EVIDENCE_CHANGED');}
}
const universeFolder=id=>'u-'+sha(universeId(id)).slice(0,16);
function locations(c,id) {
  universeId(id);if(!c.manifest.universes.includes(id))fail('UNREGISTERED_TEST_UNIVERSE');
  const root=path.join(c.root,'universes',universeFolder(id)),marker=json(path.join(root,'maintenance-owned.json'));
  if(marker.rootId!==c.registration.id||marker.universe!==id)fail('TEST_OWNERSHIP_MISMATCH');
  const file=path.join(root,'local-data','profiles',id+'.db');checkPath(file);checkSidecars(file);
  if(JSON.stringify(fs.readdirSync(path.dirname(file)))!==JSON.stringify([id+'.db']))fail('UNKNOWN_TEST_DATABASE_ENTRY');
  return {root,file,state:path.join(root,'state.json'),lock:path.join(root,'maintenance.lock'),plan:path.join(root,'plan.json')};
}
function lease(p){if(checkPath(p.lock,{missing:true}))fail('MAINTENANCE_BUSY_OR_INTERRUPTED');const token=randomUUID(),fd=fs.openSync(p.lock,'wx');try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return ()=>{if(json(p.lock).token!==token)fail('LEASE_CHANGED');fs.unlinkSync(p.lock);};}
function open(file,readOnly=true){checkPath(file);checkSidecars(file);const fd=fs.openSync(file,'r'),h=Buffer.alloc(20);try{fs.readSync(fd,h,0,20,0);}finally{fs.closeSync(fd);}if(h[18]===2||h[19]===2)fail('WAL_NOT_SUPPORTED');return new DatabaseSync(file,{readOnly,timeout:0,allowExtension:false});}
const normal=s=>s.trim().replace(/\s+/g,' ');
function validate(db,id,c,s) {
  if(s.version===1)return validateProfileDatabase(db,id);
  if(s.version!==2||db.prepare('PRAGMA application_id').get().application_id!==APP||db.prepare('PRAGMA user_version').get().user_version!==2)fail('INCOMPATIBLE_TEST_DATABASE');
  const actual=db.prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>normal(x.sql)).sort();
  if(JSON.stringify(actual)!==JSON.stringify([...statements,...testSql].map(normal).sort()))fail('UNEXPECTED_TEST_SCHEMA');
  const m=db.prepare('SELECT * FROM maintenance_test_meta').all(),owners=db.prepare('SELECT * FROM universe_metadata').all();
  if(m.length!==1||m[0].root_id!==c.registration.id||m[0].generation!==s.dbGeneration||m[0].plan_digest!==s.planDigest||owners.length!==1||owners[0].universe_id!==id||owners[0].ready!==1)fail('TEST_DATABASE_IDENTITY_MISMATCH');
  if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')fail('INTEGRITY_FAILED');return owners[0];
}
function ready(c,id,p){const s=json(p.state);if(s.kind!=='LifeSignsTestUniverse'||s.rootId!==c.registration.id||s.universe!==id||s.phase!=='READY')fail('RECOVERY_REQUIRED_CLOSE_X4_REPORT_TO_CODEX');if(hashFile(p.file)!==s.dbHash)fail('TEST_DATABASE_CHANGED');const db=open(p.file);try{validate(db,id,c,s);}finally{db.close();}return s;}
function digestRows(db,retained) {
  const h=createHash('sha256');for(const table of ['sessions','records','profile_versions','events']){h.update(table+'\n');for(const r of retained){const q=table==='sessions'?'SELECT * FROM sessions WHERE run_id=?':`SELECT * FROM ${table} WHERE run_id=? AND record_id<=? ORDER BY record_id`;for(const row of db.prepare(q).iterate(...(table==='sessions'?[r.run]:[r.run,r.through])))h.update(JSON.stringify(row)+'\n');}}
  return h.digest('hex');
}
function contentDigest(db,version){const h=createHash('sha256');for(const table of ['universe_metadata','sessions','records','profile_versions','events',...(version===2?['maintenance_test_meta','maintenance_test_seals']:[])]){h.update(table+'\n');for(const row of db.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).iterate())h.update(JSON.stringify(row)+'\n');}return h.digest('hex');}
function snapshot(c,id,p,s){return inspectProfileDatabase(p.file,{validateDatabase:(db,u)=>validate(db,u,c,s)});}
function preview(c,id,p,s,settings) {
  const snap=snapshot(c,id,p,s),result=retentionPreview(snap,c.manifest.inventory.roots,{complete:c.manifest.inventory.complete,unknowns:c.manifest.inventory.unknowns,pinned:settings.value.protectedUniverses.includes(id)});
  return {snap,result};
}
export async function createMenuTest(host,{saveFiles,profileFiles,onProgress=()=>{}}) {
  host=path.resolve(host);checkPath(path.join(host,'local-data'),{directory:true});if(hasTestRegistration(host))fail('TEST_ALREADY_REGISTERED');
  if(!saveFiles.length||saveFiles.length>64||!profileFiles.length||profileFiles.length>32)fail('EXPLICIT_COPIED_INPUTS_REQUIRED');
  const id=randomUUID(),root=path.join(host,'local-data','housekeeping-menu-test-'+id);fs.mkdirSync(root);
  for(const from of profileFiles)if(process.platform==='win32'&&path.join(root,'universes',universeFolder(path.basename(from,'.db')),'backups',randomUUID(),path.basename(from)).length>248)fail('TEST_HOST_PATH_TOO_LONG');
  write(path.join(root,'maintenance-owned.json'),{rootId:id,kind:'LifeSignsIsolatedMenuTest'});
  for(const rel of ['evidence/saves','evidence/profiles','universes','local-data'])fs.mkdirSync(path.join(root,rel),{recursive:true});
  const records=[],universes=[];
  for(const [type,files] of [['save',saveFiles],['profile',profileFiles]])for(const from of files){
    const name=path.basename(from);if(records.some(r=>r.type===type&&r.name===name))fail('DUPLICATE_SOURCE_NAME');
    if(type==='save'&&!/\.xml(?:\.gz)?$/.test(name))fail('UNSUPPORTED_SAVE_SOURCE');
    if(type==='profile'){if(!name.endsWith('.db')||name.endsWith('.building.db'))fail('UNSUPPORTED_PROFILE_SOURCE');universeId(name.slice(0,-3));checkSidecars(from);const db=open(from);try{if(!validateProfileDatabase(db,name.slice(0,-3)).ready)fail('INCOMPLETE_SOURCE');}finally{db.close();}}
    const before=hashFile(from),target=path.join(root,'evidence',type==='save'?'saves':'profiles',name);copy(from,target);if(hashFile(from)!==before)fail('SOURCE_CHANGED');records.push({type,name,hash:before,source:path.resolve(from)});onProgress({stage:'COPY',name});
    if(type==='profile'){const u=name.slice(0,-3);if(universes.some(x=>universeFolder(x)===universeFolder(u)))fail('UNIVERSE_PATH_COLLISION');const dir=path.join(root,'universes',universeFolder(u));fs.mkdirSync(path.join(dir,'local-data','profiles'),{recursive:true});copy(target,path.join(dir,'local-data','profiles',name));write(path.join(dir,'maintenance-owned.json'),{rootId:id,universe:u});write(path.join(dir,'state.json'),{kind:'LifeSignsTestUniverse',rootId:id,universe:u,phase:'READY',generation:0,version:1,dbHash:before,lastBackup:null});universes.push(u);}
  }
  const inventory=await inventorySaves([path.join(root,'evidence','saves')],{onProgress});
  if(!inventory.roots.some(r=>universes.includes(r.universe)))fail('NO_MATCHING_DATABASE_EVIDENCE');
  write(path.join(root,'local-data','housekeeping-preview-v1.json'),{owner:'LifeSignsReadOnlyPreview',version:1,saveLocations:[path.join(root,'evidence','saves')],protectedUniverses:[]});
  write(path.join(root,'manifest.json'),{kind:'LifeSignsIsolatedMenuTest',id,inputs:records,universes:universes.sort(),inventory});
  write(path.join(host,'local-data',TEST_REGISTRATION),{kind:'LifeSignsIsolatedMenuTest',id,manifestDigest:hashFile(path.join(root,'manifest.json'))});return testRegistration(host);
}
export async function scanMenuTest(host,{onProgress=()=>{},ignoreProtection=false}={}) {
  const c=testRegistration(host);inputs(c);const settings=readSettings(c.root),databases=[];
  if(ignoreProtection)settings.value={...settings.value,protectedUniverses:[]};
  onProgress({stage:'DATABASES',completed:0,total:c.manifest.universes.length});
  for(const [i,id] of c.manifest.universes.entries()){
    try{const p=locations(c,id),s=ready(c,id,p),{snap,result}=preview(c,id,p,s,settings);databases.push({...result,bytes:snap.bytes,file:id+'.db',hasBackup:!!s.lastBackup});}
    catch(e){databases.push({universe:id,status:'BLOCKED',blocks:[e.message],retained:[],candidates:null});}
    onProgress({stage:'DATABASES',completed:i+1,total:c.manifest.universes.length});
  }
  return {mode:'ISOLATED_MENU_TEST',applyAvailable:true,inventory:c.manifest.inventory,databases,unknowns:[],settings:settings.value};
}
export async function reviewMenuTest(host,id,kind) {
  if(!['CLEAN','RESTORE'].includes(kind))fail('INVALID_TEST_ACTION');const c=testRegistration(host);inputs(c);const p=locations(c,id),release=lease(p);
  try {
    const s=ready(c,id,p),settings=readSettings(c.root);if(settings.value.protectedUniverses.includes(id))fail('UNIVERSE_PROTECTED');
    const {snap,result}=preview(c,id,p,s,settings);if(kind==='CLEAN'&&(result.status!=='PREVIEW_ONLY'||!result.roots.length||!result.candidates.records))fail('NO_SAFE_HISTORY_TO_PRUNE');
    if(kind==='RESTORE'&&!s.lastBackup)fail('NO_VERIFIED_BACKUP');
    const db=open(p.file);let retainedHash;try{retainedHash=digestRows(db,result.retained);}finally{db.close();}
    const plan={rootId:c.registration.id,universe:id,kind,generation:s.generation,dbHash:s.dbHash,settingsDigest:settings.digest,manifestDigest:c.registration.manifestDigest,retained:result.retained,candidates:result.candidates,retainedHash,priorSeals:s.version===2?(()=>{const d=open(p.file);try{return d.prepare('SELECT run_id run,cutoff FROM maintenance_test_seals ORDER BY run_id').all();}finally{d.close();}})():[],lastBackup:s.lastBackup};
    if(s.version===2&&kind==='CLEAN')for(const r of result.retained){const old=plan.priorSeals.find(x=>x.run===r.run);if(old&&r.through>old.cutoff)fail('SEALED_CUTOFF_WIDENING');}
    const token=sha(JSON.stringify(plan));write(p.plan,{token,plan});return {token,plan,rows:[['CONFIRM','TEST COPY universe',id,'',''],['CONFIRM',kind==='CLEAN'?'Keep / remove raw rows':'Restore selected universe',kind==='CLEAN'?`${result.retained.reduce((n,r)=>n+r.through,0)} / ${result.candidates.records}`:'Verified backup before last cleanup','Ancestor history preserved',''],['CONFIRM','Scope',kind==='CLEAN'?'Back up, then prune this test copy':'Rewind this test universe only','Other universes / live data unchanged','Backups retained; no promised disk savings']]};
  }finally{release();}
}
function backupReceipt(c,p,id,receipt){uuid(receipt);const dir=path.join(p.root,'backups',receipt),m=json(path.join(dir,'receipt.json'));if(m.rootId!==c.registration.id||m.universe!==id||m.id!==receipt||hashFile(path.join(dir,id+'.db'))!==m.hash)fail('BACKUP_CHANGED');const db=open(path.join(dir,id+'.db'));try{validate(db,id,c,m.before);if(contentDigest(db,m.before.version)!==m.contentDigest)fail('BACKUP_CONTENT_CHANGED');}finally{db.close();}return {dir,m};}
export async function executeMenuTest(host,confirmation,{onProgress=()=>{},onPhase=()=>{}}={}) {
  const c=testRegistration(host),plan=confirmation.plan,id=universeId(plan.universe);if(plan.rootId!==c.registration.id||confirmation.token!==sha(JSON.stringify(plan)))fail('INVALID_CONFIRMATION');inputs(c);const p=locations(c,id),release=lease(p);let db;
  try {
    const current=ready(c,id,p),settings=readSettings(c.root),stored=json(p.plan);
    if(settings.value.protectedUniverses.includes(id))fail('UNIVERSE_PROTECTED');
    if(stored.token!==confirmation.token||settings.digest!==plan.settingsDigest||current.dbHash!==plan.dbHash||current.generation!==plan.generation||c.registration.manifestDigest!==plan.manifestDigest)fail('STALE_CONFIRMATION_REFRESH');
    const free=fs.statfsSync(p.root);if(free.bavail*free.bsize<checkPath(p.file).size*3+16*1024**2)fail('INSUFFICIENT_BACKUP_SPACE');
    const backupId=randomUUID(),dir=path.join(p.root,'backups',backupId);fs.mkdirSync(dir,{recursive:true});onProgress('Creating verified backup');
    let dataDigest;db=open(p.file);try{dataDigest=contentDigest(db,current.version);await backup(db,path.join(dir,id+'.db'));}finally{db.close();db=null;}
    if(hashFile(p.file)!==current.dbHash)fail('BACKUP_SOURCE_CHANGED');
    const backupHash=hashFile(path.join(dir,id+'.db'));
    // SQLite's backup API may change opaque header counters. Verify complete
    // rows/schema and the resulting backup's own hash, not source byte equality.
    write(path.join(dir,'receipt.json'),{id:backupId,rootId:c.registration.id,universe:id,hash:backupHash,sourceHash:current.dbHash,contentDigest:dataDigest,before:{...current,dbHash:backupHash}});backupReceipt(c,p,id,backupId);onPhase('BACKUP_VERIFIED');
    inputs(c);if(readSettings(c.root).digest!==plan.settingsDigest)fail('PROTECTION_OR_SETTINGS_CHANGED');
    const generation=current.generation+1,operation={...current,phase:plan.kind==='CLEAN'?'APPLYING':'RESTORING',operationBackup:backupId,confirmation};write(p.state,operation);onPhase('PREPARED');
    let next;
    if(plan.kind==='RESTORE') {
      const {dir:from,m}=backupReceipt(c,p,id,plan.lastBackup),stage=path.join(p.root,'restore-'+randomUUID()+'.db');copy(path.join(from,id+'.db'),stage);
      const probe=open(p.file,false);try{probe.exec('BEGIN EXCLUSIVE;ROLLBACK');}finally{probe.close();}if(hashFile(p.file)!==current.dbHash)fail('RESTORE_TARGET_CHANGED');fs.renameSync(stage,p.file);onPhase('DATABASE_COMMITTED');next={...m.before,generation,lastBackup:plan.lastBackup};
    } else {
      onProgress('Pruning test history');const before=checkPath(p.file);if(hashFile(p.file)!==current.dbHash)fail('STALE_DATABASE');
      db=open(p.file,false);db.exec('PRAGMA synchronous=FULL;BEGIN EXCLUSIVE');try{
        validate(db,id,c,current);if(!sameSnapshot(before,checkPath(p.file)))fail('DATABASE_CHANGED');
        if(current.version===1){for(const sql of testSql)db.exec(sql);db.exec('PRAGMA user_version=2');}
        const all=db.prepare('SELECT run_id FROM sessions ORDER BY run_id').all().map(r=>r.run_id),old=current.version===2?db.prepare('SELECT run_id FROM maintenance_test_seals').all().map(r=>r.run_id):[],keep=new Map(plan.retained.map(r=>[r.run,r.through]));
        db.exec('DELETE FROM maintenance_test_seals');for(const run of [...new Set([...all,...old])]){const n=keep.get(run)||0;db.prepare('INSERT INTO maintenance_test_seals VALUES(?,?)').run(run,n);for(const table of ['events','profile_versions','records'])db.prepare(`DELETE FROM ${table} WHERE run_id=? AND record_id>?`).run(run,n);if(!n)db.prepare('DELETE FROM sessions WHERE run_id=?').run(run);}
        db.exec('DELETE FROM maintenance_test_meta');db.prepare('INSERT INTO maintenance_test_meta VALUES(1,?,?,?)').run(c.registration.id,generation,confirmation.token);
        if(digestRows(db,plan.retained)!==plan.retainedHash)fail('RETAINED_HISTORY_CHANGED');onPhase('TRANSACTION',db);db.exec('COMMIT');
      }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{db.close();db=null;}
      onPhase('DATABASE_COMMITTED');next={...current,version:2,dbGeneration:generation,planDigest:confirmation.token,generation,lastBackup:backupId};
    }
    next={...next,phase:'READY',dbHash:hashFile(p.file)};
    const ro=open(p.file);try{validate(ro,id,c,next);if(plan.kind==='CLEAN'&&digestRows(ro,plan.retained)!==plan.retainedHash)fail('POSTCOMMIT_RETAINED_HISTORY_CHANGED');}finally{ro.close();}
    if(plan.kind==='RESTORE'&&next.dbHash!==backupReceipt(c,p,id,plan.lastBackup).m.hash)fail('RESTORE_VERIFY_FAILED');
    write(p.state,next);ready(c,id,p);onProgress('Verified');return {rows:[['RESULT','Test universe',id,'Verified',''],['RESULT',plan.kind==='CLEAN'?'Cleanup completed':'Restoration completed',plan.kind==='CLEAN'?`${plan.candidates.records} raw rows removed`:'Verified prior rows restored','Selected test universe only',''],['RESULT','Backup retained',backupId,'Live databases unchanged','Refresh to see current counts']],backupId};
  }finally{db?.close();release();}
}
