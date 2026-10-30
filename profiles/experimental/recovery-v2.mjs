// Explicit recovery for a recorded disposable-lab transaction checkpoint only.
// The original damaged pair is preserved, never opened with SQLite or repaired.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {checkPath,sameFile} from '../../bridge/src/session-path.js';
import {universeId} from '../profile-schema.mjs';
import {openLab,acquireLease,fileDigest,digest,labTools as T} from './maintenance-v2.mjs';
import {pruningTools as P} from './pruning-v2.mjs';

const fail=code=>{throw Error(code);};
const journalName=id=>'managed/local-data/profiles/'+universeId(id)+'.db-journal';
const identity=s=>({dev:s.dev,ino:s.ino,birthtimeMs:s.birthtimeMs});
const identical=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function dead(pid){if(!Number.isSafeInteger(pid)||pid<=0)fail('INVALID_CHECKPOINT_OWNER');try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')return;}fail('CHECKPOINT_OWNER_NOT_DEAD');}
function regular(file){return checkPath(file,{missing:true});}
function memberNames(lab,manifest,sidecar,allowMissingJournal=false) {
  const expected=manifest.members.map(m=>m.name),names=fs.readdirSync(lab.profiles).sort(),dbs=expected.filter(n=>n.startsWith('managed/local-data/profiles/')).map(n=>path.basename(n));
  if(!identical(names,[...dbs,...(regular(path.join(lab.workspace,sidecar))?[path.basename(sidecar)]:[])].sort()))fail('UNEXPECTED_RECOVERY_DESTINATION');
  if(!allowMissingJournal&&!regular(path.join(lab.workspace,sidecar)))fail('MISSING_BOUND_JOURNAL');
  for(const name of expected){const file=path.join(lab.workspace,name);checkPath(file);if(name.endsWith('.db'))for(const suffix of ['-journal','-wal','-shm'])if(name+suffix!==sidecar&&regular(file+suffix))fail('UNKNOWN_RECOVERY_SIDECAR');}
  return [...expected,...(regular(path.join(lab.workspace,sidecar))?[sidecar]:[])];
}
function rawState(lab,names){return names.map(name=>{const file=path.join(lab.workspace,name);return {name,hash:fileDigest(file),identity:identity(checkPath(file))};});}
function verifyPending(lab,prior,manifest) {
  if(prior.kind!=='LS_STAGE4_OPERATION'||prior.rootId!==lab.anchor.rootId||prior.phase!=='PRUNING'||prior.transaction?.kind!=='LS_STAGE4_JOURNAL_CHECKPOINT')fail('NO_BOUND_TRANSACTION');
  dead(prior.transaction.pid);
  const plan=prior.plan,id=universeId(plan.universe),sidecar=journalName(id),dbName=sidecar.slice(0,-8),names=memberNames(lab,manifest,sidecar);
  if(digest(JSON.stringify(manifest.members))!==plan.stateDigest||manifest.members.find(m=>m.name===dbName)?.hash!==plan.sourceDigest)fail('BACKUP_PLAN_MISMATCH');
  if(!identical(identity(checkPath(path.join(lab.workspace,dbName))),prior.transaction.database)||!identical(identity(checkPath(path.join(lab.workspace,sidecar))),prior.transaction.journal)||fileDigest(path.join(lab.workspace,sidecar))!==prior.transaction.journalHash)fail('BOUND_PAIR_CHANGED');
  const cat=T.catalogue(lab),backupCat=T.openSql(path.join(P.backupManifest(lab,prior.backup).dir,'managed/maintenance.db'));
  try {
    const root=cat.prepare('SELECT * FROM root_state').get(),old=backupCat.prepare('SELECT * FROM root_state').get(),op=cat.prepare('SELECT * FROM operations WHERE generation=?').get(plan.generation);
    if(root.generation!==old.generation+1||root.generation!==plan.generation||root.phase!=='PREPARED'||op?.phase!=='PREPARED'||op.digest!==prior.transaction.operationDigest)fail('RECOVERY_OPERATION_MISMATCH');
    const m=T.operationManifest(lab,op);
    if(m.kind!=='PRUNE'||m.backup?.digest!==prior.backup.digest||m.sourceDigest!==plan.sourceDigest||!identical(m.roots,plan.roots)||!identical(m.seals,plan.seals))fail('RECOVERY_OPERATION_MISMATCH');
    for(const table of ['universes','operations']){
      const current=cat.prepare(`SELECT * FROM ${table}${table==='operations'?' WHERE generation<>?':''} ORDER BY 1`).all(...(table==='operations'?[plan.generation]:[])),previous=backupCat.prepare(`SELECT * FROM ${table} ORDER BY 1`).all();
      if(!identical(current,previous))fail('RECOVERY_CATALOGUE_CHANGED');
    }
  }finally{cat.close();backupCat.close();}
  if(!identical(T.readJson(lab.marker),T.markerValue(lab,plan.generation,'PREPARED')))fail('RECOVERY_MARKER_MISMATCH');
  const observed=rawState(lab,names);
  for(const m of manifest.members)if(!['managed/maintenance.json','managed/maintenance.db',dbName].includes(m.name)&&observed.find(o=>o.name===m.name).hash!==m.hash)fail('RECOVERY_OTHER_MEMBER_CHANGED');
  return {observed,sidecar};
}
function evidence(lab,j) {
  const base=path.join(lab.workspace,'recovery-evidence-'+P.uuid(j.recoveryId));checkPath(base,{directory:true});
  const receipt=path.join(base,'manifest.json');if(fileDigest(receipt)!==j.evidenceDigest)fail('RECOVERY_EVIDENCE_CHANGED');const m=T.readJson(receipt);
  if(m.kind!=='LS_STAGE4_DAMAGED_PAIR'||m.rootId!==lab.anchor.rootId||m.backup.digest!==j.backup.digest||!identical(m.observed,j.observed)||m.sidecar!==j.sidecar)fail('RECOVERY_EVIDENCE_CHANGED');
  for(const o of m.observed)if(fileDigest(path.join(base,'pair',o.name))!==o.hash)fail('RECOVERY_EVIDENCE_CHANGED');
  return base;
}
function verifyRecovery(lab,j) {
  if(j.kind!=='LS_STAGE4_OPERATION'||j.rootId!==lab.anchor.rootId||!['RECOVERING','RESTORED'].includes(j.phase)||!j.recoveryId)fail('NO_RECOVERY_TO_RESUME');
  const {manifest}=P.verifyRestorable(lab,j.backup),names=manifest.members.map(m=>m.name),expected=[...names,journalName(j.universe)];
  if(j.sidecar!==journalName(j.universe)||!identical(j.observed.map(o=>o.name),expected))fail('INVALID_RECOVERY_RECEIPT');
  const base=evidence(lab,j);memberNames(lab,manifest,j.sidecar,true);
  const original=path.join(lab.workspace,j.sidecar),moved=path.join(base,'evacuated-journal'),before=j.observed.find(o=>o.name===j.sidecar),a=regular(original),b=regular(moved);
  if(!!a===!!b||!identical(identity(a||b),before.identity)||fileDigest(a?original:moved)!==before.hash)fail('BOUND_JOURNAL_LOCATION_CHANGED');
  for(const m of manifest.members){
    const file=path.join(lab.workspace,m.name),h=fileDigest(file),o=j.observed.find(x=>x.name===m.name);
    if(h!==o.hash&&h!==m.hash)fail('RECOVERY_DESTINATION_CHANGED');
    // A replacement of the damaged DB before this API takes custody is foreign,
    // even when its bytes happen to match. Known backup replacements are allowed.
    if(h!==m.hash&&!sameFile({...o.identity},checkPath(file)))fail('RECOVERY_DESTINATION_REPLACED');
    const staged=path.join(lab.workspace,'recovery-staging-'+P.uuid(j.recoveryId),m.name),s=regular(staged);
    if((s&&fileDigest(staged)!==m.hash)||(!s&&h!==m.hash))fail('RECOVERY_STAGING_CHANGED');
  }
  return {manifest,base,original,moved};
}
function recoverStep(lab,j,onPhase) {
  const {manifest,original,moved}=verifyRecovery(lab,j);
  if(j.phase==='RESTORED')return openLab(lab.receipt);
  if(regular(original)){fs.renameSync(original,moved);onPhase('RECOVERY_JOURNAL_PRESERVED');}
  for(const m of manifest.members){const target=path.join(lab.workspace,m.name);if(fileDigest(target)===m.hash)continue;
    const staged=path.join(lab.workspace,'recovery-staging-'+j.recoveryId,m.name);fs.renameSync(staged,target);onPhase('RECOVERY_MEMBER',m.name);
  }
  if(!identical(P.state(lab),manifest.members))fail('RECOVERY_PAIR_VERIFY_FAILED');
  // Validate the complete restored pair before lifting the barrier. The probe
  // opens a separate factory lab, not the damaged active files.
  P.verifyRestorable(lab,j.backup);T.writeJson(P.operation(lab),{...j,phase:'RESTORED'});
  const result=openLab(lab.receipt);onPhase('RECOVERY_COMPLETE');return result;
}
export function recoverPruneFixture(receipt,{onPhase=()=>{}}={}) {
  const lab=T.descriptor(receipt),lease=acquireLease(lab,{recoverDead:true});
  try {
    const prior=T.readJson(P.operation(lab));if(prior.phase==='RECOVERING'||prior.recoveryId)fail('USE_EXPLICIT_RECOVERY_RESUME');
    const {manifest,dir}=P.verifyRestorable(lab,prior.backup),{observed,sidecar}=verifyPending(lab,prior,manifest),recoveryId=randomUUID();
    const base=path.join(lab.workspace,'recovery-evidence-'+recoveryId),staging=path.join(lab.workspace,'recovery-staging-'+recoveryId);fs.mkdirSync(base);fs.mkdirSync(staging);
    for(const o of observed){const rel='pair/'+o.name;P.makeParents(base,rel);P.copyExclusive(path.join(lab.workspace,o.name),path.join(base,rel));}
    const record={kind:'LS_STAGE4_DAMAGED_PAIR',rootId:lab.anchor.rootId,backup:prior.backup,observed,sidecar,prior};T.writeJson(path.join(base,'manifest.json'),record);onPhase('RECOVERY_EVIDENCE_COPIED');
    for(const m of manifest.members){P.makeParents(staging,m.name);P.copyExclusive(path.join(dir,m.name),path.join(staging,m.name));onPhase('RECOVERY_STAGE_MEMBER');}
    if(!identical(rawState(lab,observed.map(o=>o.name)),observed))fail('DAMAGED_PAIR_CHANGED');
    const j={kind:'LS_STAGE4_OPERATION',rootId:lab.anchor.rootId,phase:'RECOVERING',universe:prior.plan.universe,backup:prior.backup,observed,sidecar,recoveryId,evidenceDigest:fileDigest(path.join(base,'manifest.json'))};
    T.writeJson(P.operation(lab),j);onPhase('RECOVERY_PREPARED');return recoverStep(lab,j,onPhase);
  }finally{lease.close();}
}
export function resumePruneRecoveryFixture(receipt,{onPhase=()=>{}}={}) {
  const lab=T.descriptor(receipt),lease=acquireLease(lab,{recoverDead:true});
  try{return recoverStep(lab,T.readJson(P.operation(lab)),onPhase);}finally{lease.close();}
}
