// Stage 4 laboratory only: never accepts an owner database or arbitrary path.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {checkPath,checkSidecars} from '../../bridge/src/session-path.js';
import {sameSnapshot} from '../inventory-path.mjs';
import {universeId,runId,ordinal} from '../profile-schema.mjs';
import {retentionPreview} from '../retention-plan.mjs';
import {ReplayV2} from './replay-v2.mjs';
import {createLab,openLab,assertReady,acquireLease,validateV2,digest,fileDigest,labTools as T} from './maintenance-v2.mjs';

const fail=code=>{throw Error(code);};
const operation=lab=>path.join(lab.workspace,'stage4-operation.json');
const uuid=s=>{if(!/^[0-9a-f-]{36}$/.test(s||''))fail('INVALID_BACKUP_ID');return s;};
const HASH=/^[0-9a-f]{64}$/;
function files(lab) {
  checkPath(lab.profiles,{directory:true});
  return ['registration.json','managed/maintenance.json','managed/maintenance.db',...fs.readdirSync(lab.profiles).sort().map(n=>{
    if(!n.endsWith('.db'))fail('UNEXPECTED_DESTINATION');universeId(n.slice(0,-3));return 'managed/local-data/profiles/'+n;
  })];
}
function state(lab) {
  return files(lab).map(name=>{const file=path.join(lab.workspace,name);if(name.endsWith('.db'))checkSidecars(file);return {name,hash:fileDigest(file)};});
}
const stateDigest=lab=>digest(JSON.stringify(state(lab)));
function exclusiveProbe(lab) {
  // All laboratory writers honour the lease. This also refuses active SQLite
  // readers/writers. It does not revoke idle unmanaged handles or prove a
  // production exclusion barrier across the later closed-file copy/rename.
  for(const {name} of state(lab).filter(x=>x.name.endsWith('.db'))) {
    const db=T.openSql(path.join(lab.workspace,name),false);
    try{db.exec('BEGIN EXCLUSIVE; ROLLBACK');}finally{db.close();}
  }
}
function copyExclusive(from,to) {
  checkPath(from);checkPath(path.dirname(to),{directory:true});checkPath(to,{missing:true});
  fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
  const fd=fs.openSync(to,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(fileDigest(from)!==fileDigest(to))fail('COPY_MISMATCH');
}
function makeParents(root,name) {
  for(const part of name.split('/').slice(0,-1)){root=path.join(root,part);if(!fs.existsSync(root))fs.mkdirSync(root);checkPath(root,{directory:true});}
}
function backupDirectory(lab,id) {
  const dir=path.join(lab.workspace,'backups');checkPath(dir,{directory:true});
  const target=path.join(dir,uuid(id));checkPath(target,{directory:true});return target;
}
function backupManifest(lab,receipt) {
  if(receipt?.rootId!==lab.anchor.rootId || !HASH.test(receipt?.digest||''))fail('BACKUP_IDENTITY_MISMATCH');
  const dir=backupDirectory(lab,receipt.id),file=path.join(dir,'manifest.json');
  if(fileDigest(file)!==receipt.digest)fail('BACKUP_MANIFEST_CHANGED');const m=T.readJson(file);
  if(m.kind!=='LS_STAGE4_BACKUP' || m.rootId!==lab.anchor.rootId || m.catalogueId!==lab.anchor.catalogueId || m.id!==receipt.id || !Array.isArray(m.members) || m.members.length>100)fail('INVALID_BACKUP');
  const names=m.members.map(x=>x.name);
  if(new Set(names).size!==names.length || !['registration.json','managed/maintenance.json','managed/maintenance.db'].every(n=>names.includes(n)))fail('INVALID_BACKUP');
  for(const member of m.members){
    if(!['registration.json','managed/maintenance.json','managed/maintenance.db'].includes(member.name)) {
      if(!/^managed\/local-data\/profiles\/[^/]+\.db$/.test(member.name))fail('INVALID_BACKUP_MEMBER');universeId(path.basename(member.name,'.db'));
    }
    const f=path.join(dir,member.name);if(!HASH.test(member.hash)||fileDigest(f)!==member.hash)fail('BACKUP_MEMBER_CHANGED');if(member.name.endsWith('.db'))checkSidecars(f);
  }
  // Refuse extra files/directories in a recovery set as well as missing members.
  function walk(base,rel=''){return fs.readdirSync(base).flatMap(n=>{const r=rel?rel+'/'+n:n,p=path.join(base,n),s=fs.lstatSync(p);if(s.isDirectory()){checkPath(p,{directory:true});return walk(p,r);}checkPath(p);return [r];});}
  if(JSON.stringify(walk(dir).sort())!==JSON.stringify([...names,'manifest.json'].sort()))fail('UNEXPECTED_BACKUP_MEMBER');
  return {dir,manifest:m};
}
function verifyRestorable(lab,receipt) {
  const {dir,manifest}=backupManifest(lab,receipt),probe=createLab(),workspace=probe.workspace;
  try {
    for(const m of manifest.members){makeParents(workspace,m.name);const to=path.join(workspace,m.name);if(fs.existsSync(to))fs.unlinkSync(to);copyExclusive(path.join(dir,m.name),to);}
    const restored=openLab({workspace,rootId:manifest.rootId});
    if(JSON.stringify(state(restored))!==JSON.stringify(manifest.members))fail('RESTORE_PROBE_CHANGED');
  }finally{
    // Only the exact factory-created probe is ever recursively removed.
    if(path.dirname(workspace)!==path.dirname(lab.workspace)||!/^lifesigns-stage3-/.test(path.basename(workspace)))fail('UNSAFE_PROBE_CLEANUP');
    fs.rmSync(workspace,{recursive:true});
  }
  return {dir,manifest};
}
function backupUnderLease(lab,onPhase) {
  assertReady(lab);exclusiveProbe(lab);const members=state(lab),id=randomUUID(),base=path.join(lab.workspace,'backups');
  if(!fs.existsSync(base))fs.mkdirSync(base);checkPath(base,{directory:true});const dir=path.join(base,id);fs.mkdirSync(dir);
  for(const m of members){makeParents(dir,m.name);copyExclusive(path.join(lab.workspace,m.name),path.join(dir,m.name));onPhase('BACKUP_MEMBER');}
  if(JSON.stringify(state(lab))!==JSON.stringify(members))fail('BACKUP_SOURCE_CHANGED');
  const file=path.join(dir,'manifest.json');T.writeJson(file,{kind:'LS_STAGE4_BACKUP',id,rootId:lab.anchor.rootId,catalogueId:lab.anchor.catalogueId,members});
  const receipt=Object.freeze({id,rootId:lab.anchor.rootId,digest:fileDigest(file)});
  verifyRestorable(lab,receipt);onPhase('BACKUP_VERIFIED');return receipt;
}
export function backupFixture(input,{onPhase=()=>{}}={}) {
  const lab=openLab(input.receipt),lease=acquireLease(lab);
  try{return backupUnderLease(lab,onPhase);}finally{lease.close();}
}

function snapshot(db,id) {
  const runs=db.prepare('SELECT * FROM sessions ORDER BY run_id').all().map(s=>({run:s.run_id,parent:s.parent_run,parentRecord:s.parent_record,baseline:s.baseline,records:0,first:null,last:null,profiles:[],profileEnds:[],eventRecords:[],snapshotEnds:[]})),map=new Map(runs.map(r=>[r.run,r]));
  let count=0;const active=new Map();
  for(const row of db.prepare('SELECT * FROM records ORDER BY run_id,record_id').iterate()) {
    if(++count>100000)fail('FIXTURE_RESOURCE_LIMIT');const r=map.get(row.run_id);if(!r)fail('ORPHAN_RAW_RECORD');
    const raw=JSON.parse(row.payload),f=raw.fields;
    if(raw.run!==row.run_id||raw.kind!==row.kind||f.record!==String(row.record_id))fail('RAW_IDENTITY_MISMATCH');
    r.records++;r.first??=row.record_id;r.last=row.record_id;
    if(row.record_id===1&&(row.kind!=='RUN_BEGIN'||f.lifesigns_universe_id!==id||f.database_protocol!=='LSDB1'||(!r.baseline&&(f.parent_run!==r.parent||ordinal(f.parent_record)!==r.parentRecord))))fail('INVALID_RUN_BEGIN');
    if(row.kind==='PROFILE_BEGIN'){if(active.has(r.run))fail('NESTED_PROFILE');const p={begin:row.record_id,end:null,number:f.profile};r.profiles.push(p);active.set(r.run,p);}
    if(row.kind==='PROFILE_END'){const p=active.get(r.run);if(!p||p.number!==f.profile)fail('UNMATCHED_PROFILE');p.end=row.record_id;active.delete(r.run);r.profileEnds.push(row.record_id);}
    if(row.kind==='ENTITY_EVENT')r.eventRecords.push(row.record_id);
    if(row.kind==='SNAPSHOT_END'){
      if(active.has(r.run)||db.prepare('SELECT count(*) n FROM profile_versions WHERE run_id=? AND record_id<=?').get(r.run,row.record_id).n!==ordinal(f.profiles))fail('INCOMPLETE_BASELINE');r.snapshotEnds.push(row.record_id);
    }
  }
  for(const [table,kind] of [['profile_versions','PROFILE_END'],['events','ENTITY_EVENT']]) {
    if(db.prepare(`SELECT 1 FROM ${table} p LEFT JOIN records r USING(run_id,record_id) WHERE r.kind IS NULL OR r.kind<>? LIMIT 1`).get(kind)||db.prepare(`SELECT count(*) n FROM ${table}`).get().n!==db.prepare('SELECT count(*) n FROM records WHERE kind=?').get(kind).n)fail('PROJECTION_MISMATCH');
  }
  return {universe:id,status:'OWNED',runs};
}
function reader(db,id){const r=Object.create(ReplayV2.prototype);Object.assign(r,{db,id,guard(){}});return r;}
function viewDigest(db,id,roots) {
  const r=reader(db,id),seeds=new Set();
  // Include ancestors' retained tips, not just each selected leaf root.
  const tips=new Map();for(const root of roots)for(const a of r.ancestry(root.run,root.record))tips.set(a.run,Math.max(tips.get(a.run)||0,a.limit));
  for(const [run,n] of tips){for(const x of db.prepare("SELECT seed FROM profile_versions WHERE kind='NPC' AND seed IS NOT NULL AND run_id=? AND record_id<=? UNION SELECT subject_seed seed FROM events WHERE subject_kind='NPC' AND subject_seed IS NOT NULL AND run_id=? AND record_id<=?").all(run,n,run,n))seeds.add(x.seed);}
  return digest(JSON.stringify([...tips].sort(([a],[b])=>a.localeCompare(b)).map(([run,record])=>({run,record,profiles:r.profilesAt(run,record),events:r.eventsAt(run,record),npc:[...seeds].sort().map(seed=>[seed,r.historyForNpc(seed,{run,record})])}))));
}
function retainedRows(db,seals) {
  return digest(JSON.stringify(['sessions','records','profile_versions','events'].map(table=>[table,seals.filter(s=>s.cutoff>0).flatMap(s=>table==='sessions'?db.prepare('SELECT * FROM sessions WHERE run_id=?').all(s.run):db.prepare(`SELECT * FROM ${table} WHERE run_id=? AND record_id<=? ORDER BY record_id`).all(s.run,s.cutoff))])));
}
function entryFor(lab,id,cat) {
  const entry=cat.prepare('SELECT * FROM universes WHERE universe_id=?').get(id);if(entry?.state!=='ACTIVE')fail('ACTIVE_V2_REQUIRED');
  const op=cat.prepare('SELECT * FROM operations WHERE generation=?').get(entry.generation);return {...entry,manifest:T.operationManifest(lab,op)};
}
function planUnderLease(lab,id,roots) {
  universeId(id);assertReady(lab);
  if(!Array.isArray(roots)||!roots.length||roots.length>1000)fail('EXPLICIT_RETAINED_ROOTS_REQUIRED');
  roots=roots.map(r=>{if(r.universe!==id)fail('ROOT_UNIVERSE_MISMATCH');return {universe:id,run:runId(r.run),record:ordinal(r.record)};}).sort((a,b)=>a.run.localeCompare(b.run)||a.record-b.record);
  const cat=T.catalogue(lab),db=T.openSql(path.join(lab.profiles,id+'.db'));let entry;
  try {
    entry=entryFor(lab,id,cat);validateV2(db,lab,id,entry);
    // Existing retired tails may still be physically present before first prune.
    // Logical seal ceilings must be checked before using the raw graph preview.
    const r=reader(db,id);for(const root of roots)r.ancestry(root.run,root.record);
    const snap=snapshot(db,id),preview=retentionPreview(snap,roots,{complete:true});if(preview.status!=='PREVIEW_ONLY')fail('UNSAFE_RETAINED_ROOTS');
    const keep=new Map(preview.retained.map(x=>[x.run,x.through])),old=db.prepare('SELECT run_id run,cutoff FROM sealed_runs').all(),ceil=new Map(old.map(x=>[x.run,x.cutoff]));
    for(const [run,n] of keep)if(ceil.has(run)&&n>ceil.get(run))fail('SEALED_CUTOFF_WIDENING');
    const seals=[...new Set([...old.map(s=>s.run),...snap.runs.map(s=>s.run)])].sort().map(run=>({run,cutoff:keep.get(run)||0}));
    return {kind:'LS_STAGE4_PLAN',rootId:lab.anchor.rootId,catalogueId:lab.anchor.catalogueId,universe:id,generation:cat.prepare('SELECT generation FROM root_state').get().generation+1,roots,seals,views:viewDigest(db,id,roots),retainedRows:retainedRows(db,seals),sourceDigest:fileDigest(path.join(lab.profiles,id+'.db')),stateDigest:stateDigest(lab),candidates:preview.candidates};
  } finally{db.close();cat.close();}
}
export function planPruneFixture(input,id,roots) {
  const lab=openLab(input.receipt),lease=acquireLease(lab);try{return planUnderLease(lab,id,roots);}finally{lease.close();}
}
export function pruneFixture(input,plan,{onPhase=()=>{}}={}) {
  const lab=openLab(input.receipt),lease=acquireLease(lab);let cat,db;
  try {
    const fresh=planUnderLease(lab,plan.universe,plan.roots);if(JSON.stringify(fresh)!==JSON.stringify(plan))fail('STALE_PLAN');
    const backup=backupUnderLease(lab,onPhase);if(stateDigest(lab)!==plan.stateDigest)fail('STALE_PLAN');
    const journal={kind:'LS_STAGE4_OPERATION',rootId:lab.anchor.rootId,phase:'PRUNING',backup,plan};T.writeJson(operation(lab),journal);onPhase('PRUNE_PREPARED');
    cat=T.catalogue(lab,false);const entry=entryFor(lab,plan.universe,cat),file=path.join(lab.profiles,plan.universe+'.db');
    const manifest={...entry.manifest,kind:'PRUNE',generation:plan.generation,roots:plan.roots,rootsDigest:digest(JSON.stringify(plan.roots)),sourceDigest:plan.sourceDigest,seals:plan.seals,backup,views:plan.views,retainedRows:plan.retainedRows,retire:false},text=JSON.stringify(manifest),hash=digest(text);
    cat.exec('BEGIN IMMEDIATE');try{cat.prepare("INSERT INTO operations VALUES(?,?,?,?,'PREPARED')").run(plan.generation,plan.universe,text,hash);cat.prepare("UPDATE root_state SET generation=?,phase='PREPARED'").run(plan.generation);cat.exec('COMMIT');}catch(e){if(cat.isTransaction)cat.exec('ROLLBACK');throw e;}
    onPhase('RESERVED');T.writeJson(lab.marker,T.markerValue(lab,plan.generation,'PREPARED'));onPhase('MARKER_PREPARED');
    const before=checkPath(file);if(fileDigest(file)!==manifest.sourceDigest)fail('SOURCE_CHANGED');db=T.openSql(file,false);db.exec('BEGIN EXCLUSIVE');
    try {
      validateV2(db,lab,plan.universe,entry);if(!sameSnapshot(before,checkPath(file)))fail('SOURCE_CHANGED');
      onPhase('PRUNE_TRANSACTION_BEGIN',db);
      db.exec('DELETE FROM sealed_runs');const seal=db.prepare('INSERT INTO sealed_runs VALUES(?,?)');for(const s of plan.seals)seal.run(s.run,s.cutoff);
      for(const s of plan.seals){for(const table of ['profile_versions','events','records'])db.prepare(`DELETE FROM ${table} WHERE run_id=? AND record_id>?`).run(s.run,s.cutoff);if(!s.cutoff)db.prepare('DELETE FROM sessions WHERE run_id=?').run(s.run);}
      db.prepare('UPDATE maintenance_metadata SET generation=?,manifest_digest=?').run(plan.generation,hash);
      // Bind only this transaction's observed journal. Never read/close a raw
      // descriptor for the database while its SQLite transaction holds locks.
      const journalFile=file+'-journal',identity=s=>({dev:s.dev,ino:s.ino,birthtimeMs:s.birthtimeMs});
      journal.transaction={kind:'LS_STAGE4_JOURNAL_CHECKPOINT',pid:process.pid,operationDigest:hash,
        database:identity(checkPath(file)),journal:identity(checkPath(journalFile)),journalHash:fileDigest(journalFile)};
      T.writeJson(operation(lab),journal);onPhase('PRUNE_TRANSACTION',db);
      validateV2(db,lab,plan.universe,{generation:plan.generation,digest:hash,state:'ACTIVE',manifest});
      if(viewDigest(db,plan.universe,plan.roots)!==plan.views||retainedRows(db,plan.seals)!==plan.retainedRows)fail('RETAINED_VIEW_CHANGED');
      db.exec('COMMIT');
    }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{db.close();db=null;}
    onPhase('DATABASE_COMMITTED');T.finish(lab,cat,manifest,hash,onPhase);
    // Independent connection after COMMIT, before removing the normal-open barrier.
    const ro=T.openSql(file);try{if(viewDigest(ro,plan.universe,plan.roots)!==plan.views||retainedRows(ro,plan.seals)!==plan.retainedRows)fail('POSTCOMMIT_VIEW_CHANGED');}finally{ro.close();}
    T.writeJson(operation(lab),{...journal,phase:'COMPLETE'});assertReady(lab);return {backup,generation:plan.generation,candidates:plan.candidates};
  }finally{db?.close();cat?.close();lease.close();}
}

function restoreStep(lab,journal,onPhase) {
  const {dir,manifest}=verifyRestorable(lab,journal.backup),expected=journal.observed;
  if(JSON.stringify(files(lab))!==JSON.stringify(manifest.members.map(m=>m.name)))fail('UNEXPECTED_DESTINATION');
  // After interruption, each destination must still equal its observed old
  // member or the exact backup member. Never overwrite an unexplained new file.
  for(const m of manifest.members){const f=path.join(lab.workspace,m.name);if(m.name.endsWith('.db'))checkSidecars(f);const h=fileDigest(f);if(h!==m.hash&&h!==expected.find(x=>x.name===m.name)?.hash)fail('RESTORE_DESTINATION_CHANGED');}
  exclusiveProbe(lab);
  for(const m of manifest.members){
    const target=path.join(lab.workspace,m.name);if(fileDigest(target)===m.hash)continue;
    const staged=path.join(lab.workspace,'restoration-staging-'+uuid(journal.rollbackId),m.name);
    if(fileDigest(staged)!==m.hash)fail('RESTORE_STAGING_CHANGED');
    fs.renameSync(staged,target);onPhase('RESTORE_MEMBER');
  }
  if(JSON.stringify(state(lab))!==JSON.stringify(manifest.members))fail('RESTORE_VERIFY_FAILED');
  T.writeJson(operation(lab),{...journal,phase:'RESTORED'});assertReady(lab);onPhase('RESTORED');return openLab(lab.receipt);
}
function interruptedIdentity(lab,journal) {
  const cat=T.catalogue(lab);
  try {
    const entries=cat.prepare('SELECT * FROM universes ORDER BY universe_id').all();
    if(JSON.stringify(entries.map(e=>'managed/local-data/profiles/'+e.universe_id+'.db'))!==JSON.stringify(files(lab).filter(n=>n.startsWith('managed/local-data/profiles/'))))fail('UNEXPECTED_DESTINATION');
    for(const e of entries) {
      try{T.verifyEntry(lab,cat,e);continue;}catch(error){
        // After the DB commit but before catalogue completion, only the exact
        // prepared operation's new metadata is an alternative known state.
        if(e.universe_id!==journal.plan.universe)throw error;
        const op=cat.prepare('SELECT * FROM operations WHERE generation=?').get(journal.plan.generation);
        if(!op||!['PREPARED','VERIFIED','COMPLETE'].includes(op.phase))throw error;
        const manifest=T.operationManifest(lab,op);if(manifest.backup?.digest!==journal.backup.digest)fail('UNKNOWN_INTERRUPTED_OPERATION');
        const db=T.openSql(path.join(lab.profiles,e.universe_id+'.db'));
        try{validateV2(db,lab,e.universe_id,{generation:op.generation,digest:op.digest,state:'ACTIVE',manifest});}finally{db.close();}
      }
    }
  }finally{cat.close();}
}
export function restoreFixture(receipt,backup,{onPhase=()=>{}}={}) {
  const lab=T.descriptor(receipt),lease=acquireLease(lab,{recoverDead:true});
  try {
    verifyRestorable(lab,backup);
    const prior=fs.existsSync(operation(lab))?T.readJson(operation(lab)):null;if(prior?.phase==='RESTORING')fail('USE_EXPLICIT_RESTORE_RESUME');
    // Either a valid current pair or the exact known interrupted prune operation.
    if(!prior||['COMPLETE','RESTORED'].includes(prior.phase))assertReady(lab);
    else {
      if(prior.kind!=='LS_STAGE4_OPERATION'||prior.rootId!==lab.anchor.rootId||prior.phase!=='PRUNING'||prior.backup.digest!==backup.digest)fail('UNKNOWN_INTERRUPTED_OPERATION');
      interruptedIdentity(lab,prior);
    }
    exclusiveProbe(lab);const observed=state(lab),{manifest}=backupManifest(lab,backup);
    if(JSON.stringify(observed.map(x=>x.name))!==JSON.stringify(manifest.members.map(x=>x.name)))fail('UNEXPECTED_DESTINATION');
    // Preserve the entire pre-restore set, including an incomplete catalogue, in
    // a unique rollback directory. No existing recovery set is overwritten.
    const rollbackId=randomUUID(),base=path.join(lab.workspace,'restoration-rollback-'+rollbackId),staging=path.join(lab.workspace,'restoration-staging-'+rollbackId);fs.mkdirSync(base);fs.mkdirSync(staging);
    for(const m of observed){makeParents(base,m.name);copyExclusive(path.join(lab.workspace,m.name),path.join(base,m.name));}
    T.writeJson(path.join(base,'receipt.json'),{observed,backup});
    const {dir}=backupManifest(lab,backup);
    for(const m of manifest.members){makeParents(staging,m.name);copyExclusive(path.join(dir,m.name),path.join(staging,m.name));onPhase('RESTORE_STAGE_MEMBER');}
    if(JSON.stringify(state(lab))!==JSON.stringify(observed))fail('RESTORE_DESTINATION_CHANGED');
    const journal={kind:'LS_STAGE4_OPERATION',rootId:lab.anchor.rootId,phase:'RESTORING',backup,observed,rollbackId};T.writeJson(operation(lab),journal);onPhase('RESTORE_PREPARED');
    return restoreStep(lab,journal,onPhase);
  }finally{lease.close();}
}
export function resumeRestoreFixture(receipt,{onPhase=()=>{}}={}) {
  const lab=T.descriptor(receipt),lease=acquireLease(lab,{recoverDead:true});
  try{const j=T.readJson(operation(lab));if(j.kind!=='LS_STAGE4_OPERATION'||j.rootId!==lab.anchor.rootId||j.phase!=='RESTORING')fail('NO_RESTORATION_TO_RESUME');return restoreStep(lab,j,onPhase);}finally{lease.close();}
}

// Internal disposable-lab recovery helpers, never packaged by the companion.
export const pruningTools=Object.freeze({operation,uuid,files,state,copyExclusive,makeParents,backupManifest,verifyRestorable});
