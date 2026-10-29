// Stage 3 laboratory only. Not imported or packaged by the game companion.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { checkPath, checkSidecars, sameFile } from '../../bridge/src/session-path.js';
import { APP, statements, universeId, runId, ordinal, validateProfileDatabase } from '../profile-schema.mjs';
import { inspectProfileDatabase } from '../profile-inventory.mjs';
import { retentionPreview } from '../retention-plan.mjs';

const fail = code => { throw Error(code); };
export const digest = text => createHash('sha256').update(text).digest('hex');
export function fileDigest(file) { return digest(fs.readFileSync(file)); }
const issuedLeases = new WeakMap();
const normal = sql => sql.trim().replace(/\s+/g, ' ');
const catalogueSql = [
  `CREATE TABLE root_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1), root_id TEXT NOT NULL, catalogue_id TEXT NOT NULL, generation INTEGER NOT NULL CHECK(generation>=0), phase TEXT NOT NULL) STRICT`,
  `CREATE TABLE operations (generation INTEGER PRIMARY KEY, universe_id TEXT NOT NULL, manifest TEXT NOT NULL, digest TEXT NOT NULL, phase TEXT NOT NULL) STRICT`,
  `CREATE TABLE universes (universe_id TEXT PRIMARY KEY, generation INTEGER NOT NULL, digest TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('SOURCE','ACTIVE','RETIRED'))) STRICT`,
];
export const v2Sql = [
  `CREATE TABLE maintenance_metadata (singleton INTEGER PRIMARY KEY CHECK(singleton=1), root_id TEXT NOT NULL, catalogue_id TEXT NOT NULL, generation INTEGER NOT NULL CHECK(generation>0), manifest_digest TEXT NOT NULL, retired INTEGER NOT NULL CHECK(retired IN (0,1))) STRICT`,
  `CREATE TABLE sealed_runs (run_id TEXT PRIMARY KEY, cutoff INTEGER NOT NULL CHECK(cutoff>=0)) STRICT`,
  `CREATE TRIGGER sealed_record_insert BEFORE INSERT ON records WHEN EXISTS(SELECT 1 FROM sealed_runs WHERE run_id=NEW.run_id) BEGIN SELECT RAISE(ABORT,'SEALED_RUN'); END`,
  `CREATE TRIGGER sealed_session_insert BEFORE INSERT ON sessions WHEN EXISTS(SELECT 1 FROM sealed_runs WHERE run_id=NEW.run_id) OR EXISTS(SELECT 1 FROM sealed_runs WHERE run_id=NEW.parent_run AND (cutoff=0 OR NEW.parent_record>cutoff)) BEGIN SELECT RAISE(ABORT,'SEALED_PARENT_OR_RUN'); END`,
];
function schema(db, sql, app, version) {
  if (db.prepare('PRAGMA application_id').get().application_id !== app || db.prepare('PRAGMA user_version').get().user_version !== version) fail('INCOMPATIBLE_SCHEMA');
  const actual = db.prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => normal(r.sql)).sort();
  if (JSON.stringify(actual) !== JSON.stringify(sql.map(normal).sort())) fail('UNEXPECTED_SCHEMA');
  if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') fail('INTEGRITY_FAILED');
}
function openSql(file, readOnly = true) {
  checkPath(file); checkSidecars(file);
  const fd=fs.openSync(file,'r'),h=Buffer.alloc(20);
  try {fs.readSync(fd,h,0,20,0);} finally {fs.closeSync(fd);}
  if(h[18]===2 || h[19]===2) fail('WAL_NOT_SUPPORTED');
  const db = new DatabaseSync(file, {readOnly,timeout:0,allowExtension:false});
  if(readOnly)db.exec('PRAGMA query_only=ON'); else db.exec('PRAGMA synchronous=FULL');
  return db;
}
function readJson(file) {
  const stat=checkPath(file);if(stat.size>1048576)fail('OVERSIZED_REGISTRATION');
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
function writeJson(file, value) {
  checkPath(path.dirname(file),{directory:true});checkPath(file,{missing:true});
  const temp=file+'.'+randomUUID()+'.tmp',fd=fs.openSync(temp,'wx');
  try {fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try {checkPath(file,{missing:true});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  // Directory fsync is unavailable on some Windows filesystems. This prototype
  // does not claim tested power-loss durability or cross-file atomicity.
  let dir;try{dir=fs.openSync(path.dirname(file),'r');fs.fsyncSync(dir);}catch{}finally{if(dir!==undefined)fs.closeSync(dir);}
}
function descriptor(receipt) {
  if (!receipt || typeof receipt.workspace!=='string' || !/^[0-9a-f-]{36}$/.test(receipt.rootId || '')) fail('INVALID_LAB_RECEIPT');
  const workspace=path.resolve(receipt.workspace);
  if(path.dirname(workspace)!==path.resolve(os.tmpdir()) || !/^lifesigns-stage3-[A-Za-z0-9]+$/.test(path.basename(workspace)))fail('DISPOSABLE_LAB_ONLY');
  checkPath(workspace,{directory:true});
  const anchor=readJson(path.join(workspace,'registration.json'));
  if(anchor.kind!=='LS_STAGE3_ANCHOR' || anchor.rootId!==receipt.rootId || !/^[0-9a-f-]{36}$/.test(anchor.catalogueId || '') || !['BOOTSTRAP','READY'].includes(anchor.phase))fail('REGISTRATION_MISMATCH');
  const root=path.join(workspace,'managed');checkPath(root,{directory:true});
  return Object.freeze({receipt:Object.freeze({workspace,rootId:receipt.rootId}),workspace,root,sourceRoot:path.join(workspace,'source'),anchor:Object.freeze(anchor),
    marker:path.join(root,'maintenance.json'),catalogue:path.join(root,'maintenance.db'),profiles:path.join(root,'local-data','profiles'),lock:path.join(root,'maintenance.lock')});
}
function catalogue(lab, readOnly=true) {
  const db=openSql(lab.catalogue,readOnly);
  try {
    schema(db,catalogueSql,APP+1,1);
    const rows=db.prepare('SELECT * FROM root_state').all();
    if(rows.length!==1 || rows[0].root_id!==lab.anchor.rootId || rows[0].catalogue_id!==lab.anchor.catalogueId)fail('CATALOGUE_IDENTITY_MISMATCH');
    return db;
  } catch(e){db.close();throw e;}
}
function makeCatalogue(lab) {
  const fd=fs.openSync(lab.catalogue,'wx');fs.closeSync(fd);const db=new DatabaseSync(lab.catalogue);
  try {db.exec('PRAGMA synchronous=FULL; BEGIN EXCLUSIVE');for(const sql of catalogueSql)db.exec(sql);
    db.prepare('INSERT INTO root_state VALUES(1,?,?,0,?)').run(lab.anchor.rootId,lab.anchor.catalogueId,'READY');
    db.exec(`PRAGMA application_id=${APP+1}; PRAGMA user_version=1; COMMIT`);
  }finally{db.close();}
}
function markerValue(lab,generation,phase){return {kind:'LS_STAGE3_MARKER',rootId:lab.anchor.rootId,catalogueId:lab.anchor.catalogueId,generation,phase};}
export function createLab({onPhase=()=>{}}={}) {
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-stage3-')),rootId=randomUUID(),catalogueId=randomUUID();
  fs.mkdirSync(path.join(workspace,'source'));fs.mkdirSync(path.join(workspace,'managed','local-data','profiles'),{recursive:true});
  const receipt={workspace,rootId};
  writeJson(path.join(workspace,'registration.json'),{kind:'LS_STAGE3_ANCHOR',rootId,catalogueId,phase:'BOOTSTRAP'});
  onPhase('ANCHOR',receipt);const lab=descriptor(receipt);makeCatalogue(lab);onPhase('CATALOGUE',receipt);
  writeJson(lab.marker,markerValue(lab,0,'READY'));onPhase('MARKER',receipt);
  writeJson(path.join(workspace,'registration.json'),{...lab.anchor,phase:'READY'});
  return openLab(receipt);
}
export function validateV2(db,lab,id,expected) {
  schema(db,[...statements,...v2Sql],APP,2);
  const owner=db.prepare('SELECT * FROM universe_metadata').all(),meta=db.prepare('SELECT * FROM maintenance_metadata').all();
  if(owner.length!==1 || owner[0].universe_id!==id || owner[0].scheme!=='LIFESIGNS_MD_V1' || owner[0].ready!==1 || meta.length!==1)fail('OWNERSHIP_MISMATCH');
  const m=meta[0];
  if(m.root_id!==lab.anchor.rootId || m.catalogue_id!==lab.anchor.catalogueId || m.generation!==expected.generation || m.manifest_digest!==expected.digest || !!m.retired!==(expected.state==='RETIRED'))fail('DATABASE_GENERATION_MISMATCH');
  const seals=db.prepare('SELECT run_id AS run,cutoff FROM sealed_runs ORDER BY run_id').all();
  if(JSON.stringify(seals)!==JSON.stringify(expected.manifest.seals))fail('DISPOSITION_MISMATCH');
  for(const s of seals){runId(s.run);ordinal(s.cutoff);const n=db.prepare('SELECT count(*) n,max(record_id) last FROM records WHERE run_id=?').get(s.run);if(!n.n || n.n!==n.last || s.cutoff>n.last)fail('INVALID_SEALED_PREFIX');}
  return m;
}
function verifyEntry(lab,db,entry) {
  const file=path.join(lab.profiles,universeId(entry.universe_id)+'.db'),ro=openSql(file);
  try {
    if(entry.state==='SOURCE'){validateProfileDatabase(ro,entry.universe_id);if(fileDigest(file)!==entry.digest)fail('SOURCE_COPY_CHANGED');}
    else {
      const op=db.prepare('SELECT * FROM operations WHERE generation=?').get(entry.generation);
      if(!op || op.phase!=='COMPLETE' || op.digest!==entry.digest || digest(op.manifest)!==op.digest)fail('OPERATION_RECEIPT_MISMATCH');
      validateV2(ro,lab,entry.universe_id,{...entry,manifest:JSON.parse(op.manifest)});
    }
  } finally{ro.close();}
}
export function openLab(receipt) {
  const lab=descriptor(receipt);assertReady(lab);return lab;
}
export function assertReady(lab) {
  const actual=descriptor(lab.receipt);if(actual.anchor.phase!=='READY')fail('BOOTSTRAP_RECOVERY_REQUIRED');
  const marker=readJson(actual.marker),db=catalogue(actual);
  try {
    const state=db.prepare('SELECT * FROM root_state').get();
    if(marker.kind!=='LS_STAGE3_MARKER' || marker.rootId!==actual.anchor.rootId || marker.catalogueId!==actual.anchor.catalogueId || marker.generation!==state.generation || marker.phase!=='READY' || state.phase!=='READY')fail('RECOVERY_REQUIRED');
    if(db.prepare("SELECT 1 FROM operations WHERE phase NOT IN ('COMPLETE','ABORTED')").get())fail('RECOVERY_REQUIRED');
    const entries=db.prepare('SELECT * FROM universes').all(),names=fs.readdirSync(actual.profiles).sort();
    if(JSON.stringify(names)!==JSON.stringify(entries.map(e=>e.universe_id+'.db').sort()))fail('DATABASE_INVENTORY_MISMATCH');
    for(const entry of entries)verifyEntry(actual,db,entry);
  }finally{db.close();}
}
export function acquireLease(lab,{recoverDead=false}={}) {
  lab=descriptor(lab.receipt);
  if(fs.existsSync(lab.lock)) {
    const old=readJson(lab.lock);
    if(!recoverDead || old.rootId!==lab.anchor.rootId || !Number.isSafeInteger(old.pid) || old.pid<=0)fail('MAINTENANCE_BUSY');
    let dead=false;try{process.kill(old.pid,0);}catch(e){dead=e.code==='ESRCH';}
    if(!dead)fail('MAINTENANCE_BUSY');
    // Explicit recovery only. No lease timeout or live-owner stealing.
    const identity=checkPath(lab.lock),text=fs.readFileSync(lab.lock,'utf8');
    if(JSON.stringify(JSON.parse(text))!==JSON.stringify(old) || !sameFile(identity,checkPath(lab.lock)))fail('LEASE_CHANGED');
    fs.unlinkSync(lab.lock);
  }
  const token=randomUUID(),fd=fs.openSync(lab.lock,'wx'),info=fs.fstatSync(fd);
  try{fs.writeFileSync(fd,JSON.stringify({rootId:lab.anchor.rootId,pid:process.pid,token}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  let closed=false;
  const lease={guard(){if(closed || !sameFile(info,checkPath(lab.lock)) || readJson(lab.lock).token!==token)fail('LEASE_LOST');},close(){if(!closed){this.guard();fs.unlinkSync(lab.lock);closed=true;}}};
  issuedLeases.set(lease,lab.root);return lease;
}
export function copyFixture(lab,id) {
  lab=descriptor(lab.receipt);universeId(id);assertReady(lab);const lease=acquireLease(lab);let db;
  try{
    db=catalogue(lab,false);if(db.prepare('SELECT generation FROM root_state').get().generation!==0)fail('FIXTURE_SETUP_FINISHED');
    const source=path.join(lab.sourceRoot,'local-data','profiles',id+'.db'),target=path.join(lab.profiles,id+'.db');
    const ro=openSql(source);try{if(!validateProfileDatabase(ro,id).ready)fail('INCOMPLETE_BASELINE');}finally{ro.close();}
    const hash=fileDigest(source);fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);if(fileDigest(target)!==hash || fileDigest(source)!==hash)fail('COPY_CHANGED');
    db.prepare("INSERT INTO universes VALUES(?,0,?,'SOURCE')").run(id,hash);return target;
  }finally{db?.close();lease.close();}
}
export function sealFixture(lab,id,roots,{retire=false,onPhase=()=>{}}={}) {
  lab=descriptor(lab.receipt);universeId(id);assertReady(lab);const lease=acquireLease(lab);let cat,db;
  try {
    cat=catalogue(lab,false);const entry=cat.prepare('SELECT * FROM universes WHERE universe_id=?').get(id);
    if(!entry || entry.state!=='SOURCE')fail('FIRST_COPY_MIGRATION_ONLY');
    if(!Array.isArray(roots) || (!roots.length && !retire) || (roots.length && retire))fail('EXPLICIT_RETIREMENT_REQUIRED');
    roots=roots.map(r=>{if(r.universe!==id)fail('ROOT_UNIVERSE_MISMATCH');const record=ordinal(r.record);if(!record)fail('INVALID_ROOT');return {universe:id,run:runId(r.run),record};}).sort((a,b)=>a.run.localeCompare(b.run)||a.record-b.record);
    const file=path.join(lab.profiles,id+'.db'),snap=inspectProfileDatabase(file),plan=retentionPreview(snap,roots,{complete:true});
    if(snap.status!=='OWNED' || plan.status!=='PREVIEW_ONLY')fail('UNSAFE_RETAINED_ROOTS');
    const keep=new Map(plan.retained.map(r=>[r.run,r.through])),generation=cat.prepare('SELECT generation FROM root_state').get().generation+1;
    const manifest={rootId:lab.anchor.rootId,catalogueId:lab.anchor.catalogueId,universe:id,generation,sourceDigest:entry.digest,retire,roots,seals:snap.runs.map(r=>({run:r.run,cutoff:keep.get(r.run)||0})).sort((a,b)=>a.run.localeCompare(b.run))};
    const text=JSON.stringify(manifest),hash=digest(text);
    cat.exec('BEGIN IMMEDIATE');try{cat.prepare("INSERT INTO operations VALUES(?,?,?,?,'PREPARED')").run(generation,id,text,hash);cat.prepare("UPDATE root_state SET generation=?,phase='PREPARED'").run(generation);cat.exec('COMMIT');}catch(e){cat.exec('ROLLBACK');throw e;}
    onPhase('RESERVED');writeJson(lab.marker,markerValue(lab,generation,'PREPARED'));onPhase('MARKER_PREPARED');
    db=openSql(file,false);db.exec('BEGIN EXCLUSIVE');
    try {
      validateProfileDatabase(db,id);if(fileDigest(file)!==entry.digest)fail('SOURCE_COPY_CHANGED');
      for(const sql of v2Sql)db.exec(sql);
      db.prepare('INSERT INTO maintenance_metadata VALUES(1,?,?,?,?,?)').run(lab.anchor.rootId,lab.anchor.catalogueId,generation,hash,retire?1:0);
      const insert=db.prepare('INSERT INTO sealed_runs VALUES(?,?)');for(const r of manifest.seals)insert.run(r.run,r.cutoff);
      db.exec('PRAGMA user_version=2; COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();db=null;}
    onPhase('DATABASE_COMMITTED');
    finish(lab,cat,manifest,hash,onPhase);return {generation,digest:hash,manifest};
  }finally{db?.close();cat?.close();lease.close();}
}
function finish(lab,cat,manifest,hash,onPhase=()=>{}) {
  const state=manifest.retire?'RETIRED':'ACTIVE';
  const db=openSql(path.join(lab.profiles,manifest.universe+'.db'));
  try{validateV2(db,lab,manifest.universe,{generation:manifest.generation,digest:hash,state,manifest});}finally{db.close();}
  cat.exec('BEGIN IMMEDIATE');try{
    cat.prepare("UPDATE operations SET phase='VERIFIED' WHERE generation=?").run(manifest.generation);
    cat.prepare('UPDATE universes SET generation=?,digest=?,state=? WHERE universe_id=?').run(manifest.generation,hash,state,manifest.universe);cat.exec('COMMIT');
  }catch(e){cat.exec('ROLLBACK');throw e;}
  onPhase('CATALOGUE_VERIFIED');writeJson(lab.marker,markerValue(lab,manifest.generation,'READY'));onPhase('MARKER_READY');
  cat.exec('BEGIN IMMEDIATE');try{cat.prepare("UPDATE operations SET phase='COMPLETE' WHERE generation=?").run(manifest.generation);cat.exec("UPDATE root_state SET phase='READY'; COMMIT");}catch(e){cat.exec('ROLLBACK');throw e;}
  onPhase('COMPLETE');
}
export function recoverLab(receipt) {
  const lab=descriptor(receipt),lease=acquireLease(lab,{recoverDead:true});let cat;
  try {
    if(lab.anchor.phase==='BOOTSTRAP') {
      if(fs.readdirSync(lab.profiles).length)fail('BOOTSTRAP_HAS_DATABASES');
      if(!fs.existsSync(lab.catalogue))makeCatalogue(lab);
      cat=catalogue(lab,false);const s=cat.prepare('SELECT * FROM root_state').get();
      if(s.generation!==0 || cat.prepare('SELECT count(*) n FROM operations').get().n || cat.prepare('SELECT count(*) n FROM universes').get().n)fail('INVALID_BOOTSTRAP');
      writeJson(lab.marker,markerValue(lab,0,'READY'));writeJson(path.join(lab.workspace,'registration.json'),{...lab.anchor,phase:'READY'});
    } else {
      // READY registration never silently creates a missing catalogue/marker.
      const marker=readJson(lab.marker);cat=catalogue(lab,false);
      const s=cat.prepare('SELECT * FROM root_state').get(),op=cat.prepare("SELECT * FROM operations WHERE generation=? AND phase IN ('PREPARED','VERIFIED')").get(s.generation);
      if(!op)fail('NO_RECOVERABLE_OPERATION');
      if(marker.kind!=='LS_STAGE3_MARKER' || marker.rootId!==lab.anchor.rootId || marker.catalogueId!==lab.anchor.catalogueId || ![s.generation,s.generation-1].includes(marker.generation) || !['READY','PREPARED'].includes(marker.phase))fail('MARKER_MISMATCH');
      if(digest(op.manifest)!==op.digest)fail('OPERATION_RECEIPT_MISMATCH');const m=JSON.parse(op.manifest);
      if(m.rootId!==lab.anchor.rootId || m.catalogueId!==lab.anchor.catalogueId || m.generation!==s.generation || m.universe!==op.universe_id)fail('OPERATION_RECEIPT_MISMATCH');
      const file=path.join(lab.profiles,universeId(op.universe_id)+'.db'),db=openSql(file);let version;
      try{version=db.prepare('PRAGMA user_version').get().user_version;if(version===1){validateProfileDatabase(db,op.universe_id);if(fileDigest(file)!==m.sourceDigest)fail('SOURCE_COPY_CHANGED');}}finally{db.close();}
      if(version===1) {
        if(op.phase!=='PREPARED')fail('INVALID_RECOVERY_PHASE');
        writeJson(lab.marker,markerValue(lab,s.generation,'READY'));
        cat.exec('BEGIN IMMEDIATE');try{cat.prepare("UPDATE operations SET phase='ABORTED' WHERE generation=?").run(s.generation);cat.exec("UPDATE root_state SET phase='READY'; COMMIT");}catch(e){cat.exec('ROLLBACK');throw e;}
      } else if(version===2) finish(lab,cat,m,op.digest);else fail('INCOMPATIBLE_SCHEMA');
    }
  }finally{cat?.close();lease.close();}
  return openLab(receipt);
}
export function openRegisteredV2(lab,id,lease) {
  lab=descriptor(lab.receipt);
  if(issuedLeases.get(lease)!==lab.root)fail('LEASE_REQUIRED');lease.guard();
  universeId(id);assertReady(lab);
  const cat=catalogue(lab);let entry,op;
  try{entry=cat.prepare('SELECT * FROM universes WHERE universe_id=?').get(id);if(!entry || entry.state!=='ACTIVE')fail('UNIVERSE_NOT_ACTIVE');op=cat.prepare('SELECT * FROM operations WHERE generation=?').get(entry.generation);}finally{cat.close();}
  const file=path.join(lab.profiles,id+'.db'),db=openSql(file,false);
  try{validateV2(db,lab,id,{...entry,manifest:JSON.parse(op.manifest)});return {file,db,info:checkPath(file)};}catch(e){db.close();throw e;}
}
