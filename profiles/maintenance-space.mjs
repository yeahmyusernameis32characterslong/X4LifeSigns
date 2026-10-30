// Explicit menu disk-space actions. Never called by ingestion or on import.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {checkPath,checkSidecars} from '../bridge/src/session-path.js';
import {readMenuSettings} from './preview-settings.mjs';
import {productionRoot,rootLease,fileHash,readJson,writeJson,digest,fail} from './production-contract.mjs';
import {paths,scope,snapshot,receipt,setEntry,makeBackup,unchangedScope,listRestorePoints} from './maintenance-production.mjs';
import {retentionPreview} from './retention-plan.mjs';
import {displaySize} from './preview-model.mjs';
import {maintenanceHandles} from './maintenance-handles.mjs';

export const restorePoints=listRestorePoints;
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
export function backupRows(root,id){const c=productionRoot(root);return restorePoints(c,id).map(p=>[p.id,'Restore point',p.modified,displaySize(p.bytes),c.catalog.universes[id].lastBackup===p.id?'Current restore point':'Earlier restore point']);}
function planFile(c,id){return path.join(c.directory,'space-plan-'+digest(id)+'.json');}
function journal(c,operation){if(!uuid(operation))fail('INVALID_DELETE_OPERATION');return path.join(c.directory,'delete-'+operation+'.json');}
function readJob(c,e){const job=readJson(journal(c,e.operation));if(digest(job)!==e.deleteDigest||job.rootId!==c.registration.id||job.operation!==e.operation||job.universe===undefined||job.digest!==digest(job.targets)||!['BACKUPDELETE','DELETEUNIVERSE'].includes(job.kind))fail('DELETE_JOURNAL_CHANGED');return job;}
export async function reviewSpace(root,id,kind,{nativeSaveDirectory=null,backupId=null}={}){
  const c=productionRoot(root),lock=rootLease(c,'SPACE_REVIEW');
  try{
    const settings=readMenuSettings(c.directory,nativeSaveDirectory),e=c.catalog.universes[id],p=paths(c,id);let plan,rows;
    if(settings.value.protectedUniverses.includes(id))fail('UNIVERSE_PROTECTED');
    if(e.phase==='DELETE_PENDING'){
      const job=readJob(c,e);if(job.universe!==id)fail('DELETE_JOURNAL_CHANGED');
      plan={kind:'RESUMEDELETE',universe:id,entry:e,operation:e.operation};
      rows=[['CONFIRM','Resume confirmed deletion',id,'Previously confirmed scope only','No new targets'],['CONFIRM','Deletion scope',job.kind,'Unfinished known file removals','Retirement remains enforced']];
    }else{
      if(e.phase!=='READY')fail('RECOVERY_REQUIRED');checkSidecars(p.file);
      if(Object.values(c.catalog.universes).some(e=>!['READY','RETIRED'].includes(e.phase)))fail('RECOVERY_REQUIRED');
      if(kind==='DELETEUNIVERSE'){
        const s=await scope(c,settings),result=retentionPreview(snapshot(c,id),s.inventory.roots,{complete:s.inventory.complete,unknowns:s.inventory.unknowns});
        if(result.status!=='PREVIEW_ONLY'||result.roots.length||result.candidates?.kind!=='ORPHAN_UNIVERSE')fail('NOT_A_VERIFIED_ORPHAN');
        const points=restorePoints(c,id,{hashes:true});for(const point of points)receipt(c,id,point.id);
        plan={kind,universe:id,entry:e,dbHash:fileHash(p.file),scopeDigest:s.scopeDigest,inputs:s.inputs,points};
        rows=[['CONFIRM','Delete orphan universe',id,'No matching saves were found in your configured save locations.','Database and ALL its restore points, including the fresh safety copy'],['CONFIRM','Permanent deletion',"Permanently delete this universe's Life Signs history?",'Saves stored elsewhere may still need it.','This does not delete X4 save files.'],['CONFIRM','Selected file space',displaySize(checkPath(p.file).size)+' database',displaySize(points.reduce((n,p)=>n+p.bytes,0))+' restore points','Minimal retirement metadata is retained']];
      }else if(kind==='BACKUPDELETE'){
        const point=restorePoints(c,id,{hashes:true}).find(p=>p.id===backupId);if(!point)fail('UNKNOWN_RESTORE_POINT');receipt(c,id,point.id);
        plan={kind,universe:id,entry:e,dbHash:fileHash(p.file),point};
        rows=[['CONFIRM','Delete restore point',point.modified,displaySize(point.bytes),backupId],['CONFIRM','Restoration option lost','This backup can no longer restore its earlier history.','Current database and saves are unchanged.',e.lastBackup===backupId?'The current Restore option will be removed.':'Other restore points are retained.']];
      }else fail('INVALID_SPACE_ACTION');
    }
    plan={...plan,rootId:c.registration.id,nativeSaveDirectory,settingsDigest:settings.digest,created:Date.now()};const token=digest(plan);writeJson(planFile(c,id),{token,plan});return {token,plan,rows};
  }finally{lock.close();}
}
function deletionTargets(c,job){
  // The journal cannot nominate arbitrary files, even after a local modification.
  const db=path.join(c.root,'local-data/profiles',job.universe+'.db');paths(c,job.universe);
  const allowed=new Set(job.backups.flatMap(id=>{if(!uuid(id))fail('INVALID_DELETE_BACKUP');return ['receipt.json','history.db'].map(n=>path.join(c.directory,'backups',id,n));}));
  if(job.kind==='DELETEUNIVERSE')allowed.add(db);
  for(const t of job.targets)if(!allowed.has(t.file)||!Number.isSafeInteger(t.bytes)||t.bytes<0||!/^[a-f0-9]{64}$/.test(t.hash))fail('INVALID_DELETE_TARGET');
  if(new Set(job.targets.map(t=>t.file)).size!==job.targets.length||job.targets.length!==allowed.size)fail('DELETE_TARGET_SET_CHANGED');
  return job.targets;
}
export async function executeSpace(root,confirmation,{nativeSaveDirectory=null,onProgress=()=>{},onPhase=()=>{},handles=maintenanceHandles}={}){
  const c=productionRoot(root),lock=rootLease(c,'SPACE_DELETE');let guard;let result;
  try{
    const plan=confirmation?.plan,id=plan?.universe,p=paths(c,id),e=c.catalog.universes[id],saved=readJson(planFile(c,id)),settings=readMenuSettings(c.directory,nativeSaveDirectory);
    if(plan.nativeSaveDirectory!==nativeSaveDirectory||plan.rootId!==c.registration.id||digest(plan)!==confirmation.token||saved.token!==confirmation.token||digest(saved.plan)!==confirmation.token||digest(e)!==digest(plan.entry)||settings.digest!==plan.settingsDigest||settings.value.protectedUniverses.includes(id)||Date.now()-plan.created>600000)fail('STALE_SPACE_CONFIRMATION');
    const volume=fs.statfsSync(c.directory),freeBefore=volume.bavail*volume.bsize;let job;
    if(plan.kind==='RESUMEDELETE'){
      if(e.phase!=='DELETE_PENDING')fail('NO_DELETION_TO_RESUME');job=readJob(c,e);deletionTargets(c,job);
      const remaining=job.targets.filter(t=>t.file!==p.file&&fs.existsSync(t.file));
      guard=await handles([p.file]);await guard.add(remaining.map(t=>t.file),true);
      if(!job.retired&&fileHash(p.file)!==job.databaseHash)fail('DELETE_SOURCE_CHANGED_PRESERVE_EVIDENCE');
    }else{
      if(e.phase!=='READY'||fileHash(p.file)!==plan.dbHash)fail('TARGET_CHANGED');checkSidecars(p.file);
      if(Object.values(c.catalog.universes).some(e=>!['READY','RETIRED'].includes(e.phase)))fail('RECOVERY_REQUIRED');
      if(plan.kind==='DELETEUNIVERSE')unchangedScope(settings,plan.inputs);
      guard=await handles([p.file,...(plan.inputs||[]).map(i=>i.file)]);
      let points=plan.kind==='DELETEUNIVERSE'?restorePoints(c,id,{hashes:true}):[restorePoints(c,id,{hashes:true}).find(p=>p.id===plan.point.id)];
      if(points.some(p=>!p)||digest(points)!==digest(plan.kind==='DELETEUNIVERSE'?plan.points:[plan.point]))fail('RESTORE_POINTS_CHANGED');
      for(const point of points)receipt(c,id,point.id);const originalPoints=points;
      if(plan.kind==='DELETEUNIVERSE'){
        // Verify a fresh backup before the first unlink. Permanent confirmation
        // explicitly includes its removal, after the database has been removed.
        const space=fs.statfsSync(c.directory);if(space.bavail*space.bsize<checkPath(p.file).size+32*1024**2)fail('INSUFFICIENT_BACKUP_SPACE');
        const backupId=await makeBackup(c,id,e,p.file,onProgress);points=restorePoints(c,id,{hashes:true});if(points.length!==originalPoints.length+1||!points.some(p=>p.id===backupId)||points.some(p=>p.id!==backupId&&!originalPoints.some(o=>o.id===p.id)))fail('DELETE_BACKUP_SET_CHANGED');
      }
      const targets=[...(plan.kind==='DELETEUNIVERSE'?[p.file]:[]),...points.flatMap(p=>[p.file,p.receipt])];
      await guard.add(targets.filter(t=>t!==p.file),true);
      for(const point of points)receipt(c,id,point.id);
      for(const point of originalPoints)if(fileHash(point.file)!==point.hash||fileHash(point.receipt)!==point.receiptHash)fail('RESTORE_POINT_CHANGED_AFTER_REVIEW');
      guard.assert();if(fileHash(p.file)!==plan.dbHash)fail('TARGET_CHANGED');if(plan.inputs)unchangedScope(settings,plan.inputs);
      job={rootId:c.registration.id,universe:id,kind:plan.kind,operation:randomUUID(),before:e,databaseHash:plan.dbHash,retired:plan.kind==='DELETEUNIVERSE',backups:points.map(p=>p.id),targets:targets.map(file=>({file,hash:fileHash(file),bytes:checkPath(file).size})),freeBefore};
      if(job.retired){
        const marker=path.join(c.directory,'retired-'+job.operation+'.marker'),text=JSON.stringify({owner:'LifeSignsRetiredUniverse',rootId:c.registration.id,universe:id,operation:job.operation})+'\n',fd=fs.openSync(marker,'wx');try{fs.writeFileSync(fd,text);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
        job.marker={file:marker,hash:fileHash(marker),bytes:checkPath(marker).size};
      }
      job.digest=digest(job.targets);deletionTargets(c,job);writeJson(journal(c,job.operation),job);onPhase('DELETE_JOURNALED');
      setEntry(c,id,{...e,phase:'DELETE_PENDING',operation:job.operation,retired:job.retired,deleteDigest:digest(job)});onPhase('DELETE_PREPARED');
    }
    if(job.universe!==id)fail('DELETE_UNIVERSE_CHANGED');
    const targets=deletionTargets(c,job);
    if(job.retired&&(!job.marker||job.marker.file!==path.join(c.directory,'retired-'+job.operation+'.marker')||job.marker.bytes>1024))fail('RETIREMENT_MARKER_CHANGED');
    for(const t of targets)if(fs.existsSync(t.file)&&fileHash(t.file)!==t.hash&&!(job.retired&&t.file===p.file&&fileHash(t.file)===job.marker.hash))fail('DELETE_TARGET_CHANGED_PRESERVE_EVIDENCE');
    // Once published, retirement is irrevocable for replay even if a process
    // exits between unlinks. Only this known target set can be resumed.
    for(const t of targets){
      guard?.assert();
      if(job.retired&&t.file===p.file){
        if(!fs.existsSync(t.file))fail('RETIREMENT_TARGET_MISSING');
        if(fileHash(t.file)!==job.marker.hash){
          if(fileHash(job.marker.file)!==job.marker.hash)fail('RETIREMENT_MARKER_CHANGED');
          await guard.add([job.marker.file],true,true);await guard.install(job.marker.file,t.file);
        }
      }else if(fs.existsSync(t.file)){checkSidecars(t.file);fs.unlinkSync(t.file);}
      onPhase('FILE_REMOVED',t.file);
    }
    await guard?.close();guard=null;
    for(const t of targets)if(job.retired&&t.file===p.file?fileHash(t.file)!==job.marker.hash:fs.existsSync(t.file))fail('FILE_REMOVAL_INCOMPLETE');
    const after=job.retired?{phase:'RETIRED',version:job.before.version,generation:job.before.generation,operation:job.operation,lastBackup:null,retired:true,retirementHash:job.marker.hash}:{...job.before,lastBackup:job.backups.includes(job.before.lastBackup)?null:job.before.lastBackup};
    setEntry(c,id,after);onPhase('DELETE_REGISTERED');
    const freeAfter=fs.statfsSync(c.directory).bavail*fs.statfsSync(c.directory).bsize;writeJson(journal(c,job.operation)+'.completed.json',{operation:job.operation,jobDigest:digest(job),completed:true,freeAfter});
    result={rows:[['RESULT',job.retired?'Orphan universe deleted':'Restore point deleted',id,'Verified selected history removal','X4 saves unchanged'],['RESULT','Removed files',displaySize(targets.reduce((n,t)=>n+t.bytes,0)-(job.marker?.bytes||0))+' net target files',(freeAfter<job.freeBefore?'-':'+')+displaySize(Math.abs(freeAfter-job.freeBefore))+' observed free-disk change','Volume activity can affect the observed change'],['RESULT','Retained safeguards',job.retired?'Tiny permanent retirement marker':'Current database and other backups','Unrelated evidence unchanged','Refresh for current list']]};
  }finally{await guard?.close();lock.close();}
  return result;
}
