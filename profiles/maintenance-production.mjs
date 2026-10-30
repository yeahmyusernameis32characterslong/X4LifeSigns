// Real menu maintenance. All destructive work requires a fresh server-held plan.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {backup} from 'node:sqlite';
import {checkPath,checkSidecars} from '../bridge/src/session-path.js';
import {checkAvailability} from './inventory-path.mjs';
import {inventorySaves} from './save-inventory.mjs';
import {inspectProfileDatabase} from './profile-inventory.mjs';
import {retentionPreview} from './retention-plan.mjs';
import {readMenuSettings} from './preview-settings.mjs';
import {maintenanceHandles} from './maintenance-handles.mjs';
import {productionRoot,rootLease,openDatabase,validateProduction,updateCatalog,fileHash,readJson,writeJson,digest,fail,retainedDigest,contentDigest,migrateProduction} from './production-contract.mjs';
import {universeId} from './profile-schema.mjs';
function syncCreatedFile(file){const fd=fs.openSync(file,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}

export function paths(c,id){universeId(id);if(!c.catalog.universes[id])fail('UNREGISTERED_UNIVERSE');return {file:path.join(c.root,'local-data','profiles',id+'.db'),backups:path.join(c.directory,'backups'),plan:path.join(c.directory,'plan-'+digest(id)+'.json')};}
export function filesInScope(settings){
  const result=[];function walk(dir){checkPath(dir,{directory:true});checkAvailability(dir);for(const name of fs.readdirSync(dir).sort()){if(result.length>=10000)fail('SAVE_SCOPE_RESOURCE_LIMIT');const file=path.join(dir,name),info=fs.lstatSync(file);if(info.isDirectory()&&!info.isSymbolicLink())walk(file);else {checkPath(file);checkAvailability(file);result.push(file);}}}
  for(const dir of settings.value.saveLocations)walk(dir);return [...new Set(result)].sort();
}
export async function scope(c,settings,onProgress=()=>{}){
  let files;try{files=filesInScope(settings);}catch{return {inventory:{complete:false,saves:[],roots:[],locations:settings.value.saveLocations.map((path,i)=>({label:'location-'+(i+1),path})),unknowns:[{code:'SCAN_INCOMPLETE'}]},inputs:[],scopeDigest:null};}
  const guard=process.platform==='win32'?await maintenanceHandles(files,{inputsOnly:true}):null;
  try{
    const inputs=files.map(file=>({file,hash:fileHash(file),modified:checkPath(file).mtimeMs})),cacheFile=path.join(c.directory,'save-inventory-cache.json');let inventory;
    if(fs.existsSync(cacheFile)){
      let cache;try{cache=readJson(cacheFile);}catch{ /* Optional cache is not authority; fully reparse. */ }
      if(cache?.version===2&&cache.proof===digest({locations:cache.locations,inputs:cache.inputs,inventory:cache.inventory})&&digest(cache.locations)===digest(settings.value.saveLocations)&&digest(cache.inputs)===digest(inputs))inventory=cache.inventory;
    }
    if(!inventory){inventory=await inventorySaves(settings.value.saveLocations,{onProgress});if(inventory.complete&&!inventory.unknowns.length)writeJson(cacheFile,{version:2,locations:settings.value.saveLocations,inputs,inventory,proof:digest({locations:settings.value.saveLocations,inputs,inventory})});}
    guard?.assert();unchangedScope(settings,inputs);
    return {inventory,inputs,scopeDigest:digest({inventory:inventory.manifestDigest,inputs})};
  }finally{await guard?.close();}
}
export function unchangedScope(settings,inputs){if(JSON.stringify(filesInScope(settings))!==JSON.stringify(inputs.map(i=>i.file)))fail('SAVE_SCOPE_CHANGED');for(const i of inputs)if(fileHash(i.file)!==i.hash||checkPath(i.file).mtimeMs!==i.modified)fail('SAVE_INPUT_CHANGED');}
export function snapshot(c,id){const e=c.catalog.universes[id],p=paths(c,id);if(e.phase!=='READY')fail('RECOVERY_REQUIRED');return inspectProfileDatabase(p.file,{validateDatabase:(db,u)=>validateProduction(db,u,c.registration.id,e)});}
function preview(c,id,inventory,settings){return retentionPreview(snapshot(c,id),inventory.roots,{complete:inventory.complete,unknowns:inventory.unknowns,pinned:settings.value.protectedUniverses.includes(id)});}
export function setEntry(c,id,entry){updateCatalog(c,{...c.catalog,universes:{...c.catalog.universes,[id]:entry}});}
export function receipt(c,id,backupId){
  if(!/^[-a-f0-9]{36}$/.test(backupId||''))fail('NO_RESTORABLE_BACKUP');
  const dir=path.join(c.directory,'backups',backupId),r=readJson(path.join(dir,'receipt.json')),file=path.join(dir,'history.db');
  if(r.id!==backupId||r.rootId!==c.registration.id||r.universe!==id||fileHash(file)!==r.hash)fail('BACKUP_CHANGED');
  const db=openDatabase(file);try{validateProduction(db,id,c.registration.id,r.entry);if(contentDigest(db)!==r.contentDigest)fail('BACKUP_CONTENT_CHANGED');}finally{db.close();}return {...r,file};
}
export async function makeBackup(c,id,e,file,onProgress){
  const backupId=randomUUID(),dir=path.join(c.directory,'backups',backupId);fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,'history.db');onProgress('Creating and verifying restoration backup');
  const beforeHash=fileHash(file),db=openDatabase(file);let rows;try{validateProduction(db,id,c.registration.id,e);rows=contentDigest(db);await backup(db,target);}finally{db.close();}
  syncCreatedFile(target);if(fileHash(file)!==beforeHash)fail('BACKUP_SOURCE_CHANGED');
  writeJson(path.join(dir,'receipt.json'),{id:backupId,rootId:c.registration.id,universe:id,entry:e,sourceHash:beforeHash,hash:fileHash(target),contentDigest:rows});receipt(c,id,backupId);return backupId;
}
export function listRestorePoints(c,id){
  paths(c,id);const parent=path.join(c.directory,'backups');if(!fs.existsSync(parent))return [];
  const points=[];
  for(const name of fs.readdirSync(parent).sort()){
    if(!/^[a-f0-9-]{36}$/.test(name))fail('UNKNOWN_BACKUP_DIRECTORY');const dir=path.join(parent,name);checkPath(dir,{directory:true});
    const info=path.join(dir,'receipt.json');if(!fs.existsSync(info))continue;
    const r=readJson(info);if(r.rootId!==c.registration.id||r.id!==name)fail('INVALID_BACKUP_RECEIPT');
    if(r.universe!==id)continue;const file=path.join(dir,'history.db');
    if(!fs.existsSync(file))fail('BACKUP_MISSING');checkSidecars(file);
    points.push({id:name,file,receipt:info,bytes:checkPath(file).size+checkPath(info).size,modified:fs.statSync(info).mtime.toISOString()});
  }
  return points;
}

export async function scanProduction(root,{onProgress=()=>{},nativeSaveDirectory=null}={}){
  const c=productionRoot(root),settings=readMenuSettings(c.directory,nativeSaveDirectory),s=await scope(c,settings,onProgress),databases=[];
  const ids=Object.keys(c.catalog.universes).filter(id=>c.catalog.universes[id].phase!=='RETIRED').sort();onProgress({stage:'DATABASES',completed:0,total:ids.length});
  for(const [i,id] of ids.entries()){
    const e=c.catalog.universes[id],p=paths(c,id);
    try {
      if(e.phase==='DELETE_PENDING'){databases.push({universe:id,status:'BLOCKED',blocks:['DELETION_PENDING'],candidates:null,retained:[],deletionPending:true,bytes:fs.existsSync(p.file)?checkPath(p.file).size:0});}
      else if(e.phase==='PREPARED'){receipt(c,id,e.beforeBackup);databases.push({universe:id,status:'BLOCKED',blocks:['RECOVERY_REQUIRED'],candidates:null,retained:[],hasBackup:true,recovery:true,bytes:checkPath(p.file).size});}
      else {const snap=snapshot(c,id),points=listRestorePoints(c,id),db=openDatabase(p.file);let compactEstimate;try{compactEstimate=db.prepare('PRAGMA freelist_count').get().freelist_count*db.prepare('PRAGMA page_size').get().page_size;}finally{db.close();}databases.push({...retentionPreview(snap,s.inventory.roots,{complete:s.inventory.complete,unknowns:s.inventory.unknowns,pinned:false}),bytes:snap.bytes,backupBytes:points.reduce((n,p)=>n+p.bytes,0),compactEstimate,file:id+'.db',hasBackup:!!e.lastBackup});}
    }catch(e){databases.push({universe:id,status:'BLOCKED',blocks:[/^[A-Z_]+$/.test(e.message)?e.message:'INVALID_PRODUCTION_TARGET'],retained:[],candidates:null});}
    onProgress({stage:'DATABASES',completed:i+1,total:ids.length});
  }
  return {mode:'PRODUCTION_MENU',applyAvailable:true,inventory:s.inventory,databases,unknowns:[],settings:settings.value};
}
export async function reviewProduction(root,id,kind,{nativeSaveDirectory=null,backupId=null}={}){
  if(!['CLEAN','RESTORE','COMPACT'].includes(kind))fail('INVALID_ACTION');const c=productionRoot(root),lock=rootLease(c,'REVIEW');
  try{
    const settings=readMenuSettings(c.directory,nativeSaveDirectory);if(settings.value.protectedUniverses.includes(id))fail('UNIVERSE_PROTECTED');
    const p=paths(c,id),e=c.catalog.universes[id];let s,plan;
    checkSidecars(p.file);
    if(e.phase==='DELETE_PENDING'||e.phase==='RETIRED')fail('DELETION_REQUIRES_OWN_REVIEW');
    if(e.phase==='PREPARED'){
      if(kind!=='RESTORE')fail('RECOVERY_REQUIRED');const r=receipt(c,id,e.beforeBackup),hash=fileHash(p.file);
      if(![e.beforeHash,e.afterHash].includes(hash))fail('INTERRUPTED_TARGET_CHANGED_PRESERVE_EVIDENCE');
      plan={kind:'RECOVER',universe:id,entry:e,dbHash:hash,backup:e.beforeBackup,restoreDigest:r.contentDigest};
    }else{
      s=await scope(c,settings);const result=preview(c,id,s.inventory,settings);
      if(kind==='CLEAN'&&(result.status!=='PREVIEW_ONLY'||!result.roots.length||!result.candidates?.records))fail('NO_SAFE_HISTORY_TO_PRUNE');
      if(kind==='COMPACT'&&(e.version!==2||result.status!=='PREVIEW_ONLY'||!result.roots.length||result.candidates?.records!==0))fail('CLEAN_SAVED_HISTORY_BEFORE_COMPACTION');
      if(kind==='RESTORE'&&(!(backupId||e.lastBackup)||fileHash(p.file)!==e.committedHash))fail('NEW_HISTORY_OR_NO_RESTORE_POINT');
      const r=kind==='RESTORE'?receipt(c,id,backupId||e.lastBackup):null,db=openDatabase(p.file);let retainedHash;try{retainedHash=retainedDigest(db,result.retained);}finally{db.close();}
      plan={kind,universe:id,entry:e,dbHash:fileHash(p.file),scopeDigest:s.scopeDigest,inputs:s.inputs,retained:result.retained,retainedHash,candidates:result.candidates,backup:backupId||e.lastBackup,restoreDigest:r?.contentDigest};
    }
    plan={...plan,rootId:c.registration.id,nativeSaveDirectory,settingsDigest:settings.digest,created:Date.now()};const token=digest(plan);writeJson(p.plan,{token,plan});
    const rows=[['CONFIRM','Universe history',id,'',''],['CONFIRM',plan.kind==='CLEAN'?'Keep / remove history records':plan.kind==='RECOVER'?'Recover interrupted operation':'Restore selected universe',plan.kind==='CLEAN'?`${plan.retained.reduce((n,r)=>n+r.through,0)} / ${plan.candidates.records}`:'Verified pre-maintenance history','Selected universe only',''],['CONFIRM','Scope',plan.kind==='CLEAN'?'Back up, then clean this database':'Preserve current state, restore backup','Other universes and saves unchanged','Backups retained; no compaction']];
    if(kind==='COMPACT'){
      const db=openDatabase(p.file);let free;try{free=db.prepare('PRAGMA freelist_count').get().freelist_count*db.prepare('PRAGMA page_size').get().page_size;}finally{db.close();}
      rows[1]=['CONFIRM','Reclaim disk space',`${checkPath(p.file).size} database bytes`,`${free} free-page bytes (estimate)`,'All history and seals preserved'];
      rows[2]=['CONFIRM','Scope','Compact this database only','New verified backup retained','Actual database/net storage reported separately'];
    }
    return {token,plan,rows};
  }finally{lock.close();}
}
export async function executeProduction(root,confirmation,{onProgress=()=>{},onPhase=()=>{},handles=maintenanceHandles,nativeSaveDirectory=null}={}){
  const c=productionRoot(root),lock=rootLease(c,'MAINTENANCE');let guard,db;
  try{
    const plan=confirmation?.plan,id=universeId(plan?.universe),p=paths(c,id),e=c.catalog.universes[id],saved=readJson(p.plan),settings=readMenuSettings(c.directory,nativeSaveDirectory);
    checkSidecars(p.file);
    if(plan.nativeSaveDirectory!==nativeSaveDirectory||digest(plan)!==confirmation.token||saved.token!==confirmation.token||digest(saved.plan)!==confirmation.token||plan.rootId!==c.registration.id||digest(e)!==digest(plan.entry)||Date.now()-plan.created>600000||settings.digest!==plan.settingsDigest||settings.value.protectedUniverses.includes(id)||fileHash(p.file)!==plan.dbHash)fail('STALE_CONFIRMATION_REFRESH');
    if(plan.kind!=='RECOVER')unchangedScope(settings,plan.inputs);
    guard=await handles([p.file,...(plan.inputs||[]).map(i=>i.file)]);guard.assert();onPhase('HANDLES_ACQUIRED');
    if(fileHash(p.file)!==plan.dbHash)fail('TARGET_CHANGED');
    const space=fs.statfsSync(c.directory);if(space.bavail*space.bsize<checkPath(p.file).size*4+32*1024**2)fail('INSUFFICIENT_BACKUP_SPACE');
    let beforeBackup;
    if(plan.kind==='RECOVER'){
      receipt(c,id,plan.backup);beforeBackup=plan.backup;
      // Preserve the exact observed interrupted file without opening/repairing it.
      const evidence=path.join(c.directory,'interrupted-'+randomUUID()+'.db');fs.copyFileSync(p.file,evidence,fs.constants.COPYFILE_EXCL);if(fileHash(evidence)!==plan.dbHash)fail('EVIDENCE_COPY_CHANGED');
    }else beforeBackup=await makeBackup(c,id,e,p.file,onProgress);
    onPhase('BACKUP_VERIFIED');const beforeBytes=checkPath(p.file).size;
    const operation=randomUUID(),stage=path.join(c.directory,'stage-'+operation+'.db'),nextGeneration=e.generation+1;
    const r=['CLEAN','COMPACT'].includes(plan.kind)?receipt(c,id,beforeBackup):receipt(c,id,plan.backup);
    fs.copyFileSync(r.file,stage,fs.constants.COPYFILE_EXCL);if(fileHash(stage)!==r.hash)fail('STAGE_CHANGED');
    db=openDatabase(stage,false);let connectionGeneration=r.entry.generation;db.function('ls_housekeeping_generation',()=>connectionGeneration);
    db.exec('PRAGMA synchronous=FULL;BEGIN EXCLUSIVE');
    try{
      validateProduction(db,id,c.registration.id,r.entry);migrateProduction(db,c.registration.id,nextGeneration,operation);connectionGeneration=nextGeneration;
      if(plan.kind==='CLEAN'){
        onProgress('Cleaning selected universe history');
        const keep=new Map(plan.retained.map(r=>[r.run,r.through])),runs=new Set([...db.prepare('SELECT run_id FROM sessions').all(),...db.prepare('SELECT run_id FROM housekeeping_seals').all()].map(r=>r.run_id));
        db.exec('DELETE FROM housekeeping_seals');
        for(const run of runs){const n=keep.get(run)||0;db.prepare('INSERT INTO housekeeping_seals VALUES(?,?)').run(run,n);for(const t of ['events','profile_versions','records'])db.prepare(`DELETE FROM ${t} WHERE run_id=? AND record_id>?`).run(run,n);if(!n)db.prepare('DELETE FROM sessions WHERE run_id=?').run(run);}
        if(retainedDigest(db,plan.retained)!==plan.retainedHash)fail('RETAINED_HISTORY_CHANGED');
      }else if(contentDigest(db)!==(plan.kind==='COMPACT'?r.contentDigest:plan.restoreDigest))fail('RESTORE_ROWS_CHANGED');
      onPhase('STAGING_TRANSACTION',db);db.exec('COMMIT');if(plan.kind==='COMPACT'){onProgress('Reclaiming database space');db.exec('VACUUM');onPhase('COMPACTED',db);}
    }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}finally{db.close();db=null;}
    syncCreatedFile(stage);const next={phase:'READY',version:2,generation:nextGeneration,operation,lastBackup:['CLEAN','COMPACT'].includes(plan.kind)?beforeBackup:plan.backup,committedHash:fileHash(stage)};
    const verify=openDatabase(stage);try{validateProduction(verify,id,c.registration.id,next);if(plan.kind==='CLEAN'&&retainedDigest(verify,plan.retained)!==plan.retainedHash)fail('STAGE_RETAINED_MISMATCH');if(plan.kind!=='CLEAN'&&contentDigest(verify)!==(plan.kind==='COMPACT'?r.contentDigest:plan.restoreDigest))fail('STAGE_RESTORE_MISMATCH');}finally{verify.close();}
    onPhase('STAGE_VERIFIED');if(plan.inputs)unchangedScope(settings,plan.inputs);
    checkSidecars(p.file);if(readMenuSettings(c.directory,nativeSaveDirectory).digest!==plan.settingsDigest||fileHash(p.file)!==plan.dbHash)fail('INPUTS_CHANGED_BEFORE_INSTALL');
    // Both inode handles deny writes; FILE_SHARE_DELETE allows atomic replacement.
    await guard.add([stage],true,true);guard.assert();onPhase('BEFORE_PREPARE');
    setEntry(c,id,{...e,phase:'PREPARED',beforeBackup,beforeHash:plan.dbHash,afterHash:next.committedHash,next,operation});onPhase('PREPARED');
    guard.assert();await guard.install(stage,p.file);onPhase('INSTALLED');
    if(fileHash(p.file)!==next.committedHash)fail('INSTALLED_HASH_CHANGED');
    setEntry(c,id,next);onPhase('REGISTERED');onProgress('Verified');
    return {backupId:beforeBackup,rows:[['RESULT','Universe history',id,'Verified',''],['RESULT',plan.kind==='COMPACT'?'Compaction completed':plan.kind==='CLEAN'?'Cleanup completed':plan.kind==='RECOVER'?'Recovery completed':'Restoration completed',plan.kind==='COMPACT'?`${Math.max(0,beforeBytes-checkPath(p.file).size)} database bytes freed`:plan.kind==='CLEAN'?`${plan.candidates.records} history records removed`:'Verified previous history restored','Selected universe only',''],['RESULT','Restore point retained',plan.kind==='COMPACT'?`${checkPath(receipt(c,id,beforeBackup).file).size} backup bytes retained`:'Database history backup','Saves and other universes unchanged','Refresh for current counts']]};
  }finally{db?.close();await guard?.close();lock.close();}
}
