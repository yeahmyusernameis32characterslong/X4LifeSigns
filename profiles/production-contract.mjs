// Production ownership and replay contract. No registration is created on import.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {checkPath,checkSidecars} from '../bridge/src/session-path.js';
import {APP,statements,universeId,validateProfileDatabase} from './profile-schema.mjs';

export const REGISTRATION='housekeeping-production.json';
export const fail=code=>{throw Error(code);};
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function readJson(file){if(checkPath(file).size>4*1024**2)fail('REGISTRATION_TOO_LARGE');return JSON.parse(fs.readFileSync(file,'utf8'));}
export function writeJson(file,value){checkPath(path.dirname(file),{directory:true});checkPath(file,{missing:true});const tmp=file+'.'+randomUUID()+'.tmp',fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);}
export function fileHash(file){const info=checkPath(file),h=createHash('sha256'),buf=Buffer.alloc(1024**2);if(info.size>4*1024**3)fail('RESOURCE_LIMIT_4_GIB');const fd=fs.openSync(file,'r');try{for(let n;(n=fs.readSync(fd,buf,0,buf.length,null));)h.update(buf.subarray(0,n));const after=fs.fstatSync(fd);if(info.ino!==after.ino||info.size!==after.size||info.mtimeMs!==after.mtimeMs)fail('FILE_CHANGED');}finally{fs.closeSync(fd);}return h.digest('hex');}
export function registered(root){return fs.existsSync(path.join(root,'local-data',REGISTRATION));}
function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;return true;}}
export function productionRoot(root,{expectedId=null}={}){
  root=path.resolve(root);checkPath(root,{directory:true});const registration=readJson(path.join(root,'local-data',REGISTRATION));
  if(registration.owner!=='LifeSignsProductionMaintenance'||registration.version!==1||!/^[-a-f0-9]{36}$/.test(registration.id)||!path.isAbsolute(registration.anchor)||expectedId&&registration.id!==expectedId)fail('INVALID_PRODUCTION_REGISTRATION');
  const directory=path.join(root,'local-data','housekeeping-'+registration.id);checkPath(directory,{directory:true});
  const c={root,directory,registration,catalogFile:path.join(directory,'catalog.json'),pending:path.join(directory,'catalog.pending.json'),lease:path.join(directory,'lease.json')};
  // A known metadata-publication interruption only. Never change database data.
  if(fs.existsSync(c.pending)){
    const p=readJson(c.pending);if(p.rootId!==registration.id||alive(p.pid))fail('CATALOG_PUBLICATION_BUSY_OR_INVALID');
    const old=fs.readFileSync(c.catalogFile,'utf8'),anchor=readJson(registration.anchor),next=JSON.stringify(p.next)+'\n';
    if(p.next.id!==registration.id||digest(next)!==p.nextHash||![p.beforeHash,p.nextHash].includes(digest(old))||![p.beforeHash,p.nextHash].includes(anchor.catalogDigest))fail('CATALOG_RECOVERY_MISMATCH');
    writeJson(c.catalogFile,p.next);writeJson(registration.anchor,{owner:registration.owner,id:registration.id,root,catalogDigest:p.nextHash});fs.renameSync(c.pending,c.pending+'.recovered-'+randomUUID());
  }
  const text=fs.readFileSync(c.catalogFile,'utf8'),anchor=readJson(registration.anchor),catalog=JSON.parse(text);
  if(anchor.owner!==registration.owner||anchor.id!==registration.id||anchor.root!==root||anchor.catalogDigest!==digest(text)||catalog.id!==registration.id||catalog.version!==1||!catalog.universes||Object.keys(catalog.universes).length>1024)fail('PRODUCTION_ANCHOR_MISMATCH');
  for(const [id,e] of Object.entries(catalog.universes)){universeId(id);if(!['READY','PREPARED','DELETE_PENDING','RETIRED'].includes(e.phase)||![1,2].includes(e.version)||!Number.isSafeInteger(e.generation)||e.generation<0)fail('INVALID_PRODUCTION_ENTRY');}
  for(const[id,e]of Object.entries(catalog.universes))if(e.phase==='RETIRED'&&(!/^[a-f0-9]{64}$/.test(e.retirementHash||'')||fileHash(path.join(root,'local-data/profiles',id+'.db'))!==e.retirementHash))fail('RETIREMENT_MARKER_MISMATCH');
  return {...c,catalog};
}
export function updateCatalog(c,catalog){
  const fresh=productionRoot(c.root);if(digest(fresh.catalog)!==digest(c.catalog))fail('CATALOG_CHANGED');
  const nextHash=digest(JSON.stringify(catalog)+'\n');writeJson(c.pending,{rootId:c.registration.id,pid:process.pid,beforeHash:digest(JSON.stringify(c.catalog)+'\n'),nextHash,next:catalog});
  writeJson(c.catalogFile,catalog);writeJson(c.registration.anchor,{owner:c.registration.owner,id:c.registration.id,root:c.root,catalogDigest:nextHash});fs.unlinkSync(c.pending);c.catalog=catalog;
}
export function rootLease(c,kind){
  if(fs.existsSync(c.lease)){
    const old=readJson(c.lease);if(old.rootId!==c.registration.id||!Number.isSafeInteger(old.pid)||alive(old.pid))fail('WRITER_OR_MAINTENANCE_BUSY');
    fs.renameSync(c.lease,c.lease+'.abandoned-'+randomUUID());
  }
  const token=randomUUID(),fd=fs.openSync(c.lease,'wx');try{fs.writeFileSync(fd,JSON.stringify({rootId:c.registration.id,kind,pid:process.pid,token}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  let closed=false;return {guard(){if(closed||readJson(c.lease).token!==token)fail('ROOT_LEASE_CHANGED');},close(){if(closed)return;this.guard();fs.unlinkSync(c.lease);closed=true;}};
}
const writers=new Map();
export function writerLease(root){
  if(!registered(root))return null;
  root=path.resolve(root);let w=writers.get(root);
  if(!w){const c=productionRoot(root);if(Object.values(c.catalog.universes).some(e=>!['READY','RETIRED'].includes(e.phase)))fail('RECOVERY_REQUIRED');w={lease:rootLease(c,'WRITER'),refs:0};writers.set(root,w);}
  w.refs++;let closed=false;return {guard(){w.lease.guard();productionRoot(root);},close(){if(closed)return;closed=true;if(--w.refs===0){w.lease.close();writers.delete(root);}}};
}
export function openDatabase(file,readOnly=true){
  checkPath(file);checkSidecars(file);const fd=fs.openSync(file,'r'),header=Buffer.alloc(20);try{fs.readSync(fd,header,0,20,0);}finally{fs.closeSync(fd);}
  if(header[18]===2||header[19]===2)fail('WAL_NOT_SUPPORTED');return new DatabaseSync(file,{readOnly,timeout:0,allowExtension:false});
}
const tables=['universe_metadata','sessions','records','profile_versions','events','housekeeping_meta','housekeeping_seals'];
export const productionSql=[
 `CREATE TABLE housekeeping_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), root_id TEXT NOT NULL, generation INTEGER NOT NULL, operation TEXT NOT NULL) STRICT`,
 `CREATE TABLE housekeeping_seals (run_id TEXT PRIMARY KEY, cutoff INTEGER NOT NULL CHECK(cutoff>=0)) STRICT`,
 ...tables.flatMap(t=>['INSERT','UPDATE','DELETE'].map(action=>`CREATE TRIGGER hk_${t}_${action.toLowerCase()} BEFORE ${action} ON ${t} BEGIN SELECT CASE WHEN ls_housekeeping_generation()<>(SELECT generation FROM housekeeping_meta WHERE singleton=1) THEN RAISE(ABORT,'STALE_WRITER_GENERATION') END; END`)),
 `CREATE TRIGGER hk_sealed_record BEFORE INSERT ON records WHEN EXISTS(SELECT 1 FROM housekeeping_seals WHERE run_id=NEW.run_id) BEGIN SELECT RAISE(ABORT,'SEALED_RUN'); END`,
 `CREATE TRIGGER hk_sealed_session BEFORE INSERT ON sessions WHEN EXISTS(SELECT 1 FROM housekeeping_seals WHERE run_id=NEW.run_id) BEGIN SELECT RAISE(ABORT,'SEALED_RUN'); END`,
];
const normal=s=>s.trim().replace(/\s+/g,' ');
export function validateProduction(db,id,rootId,entry){
  if(db.prepare('PRAGMA user_version').get().user_version===1){if(entry&&entry.version!==1)fail('PRODUCTION_VERSION_ROLLBACK');return validateProfileDatabase(db,id);}
  if(!entry||entry.version!==2||db.prepare('PRAGMA user_version').get().user_version!==2||db.prepare('PRAGMA application_id').get().application_id!==APP)fail('INCOMPATIBLE_PRODUCTION_DATABASE');
  const actual=db.prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'").all().map(x=>normal(x.sql)).sort();
  if(JSON.stringify(actual)!==JSON.stringify([...statements,...productionSql].map(normal).sort()))fail('UNEXPECTED_PRODUCTION_SCHEMA');
  const meta=db.prepare('SELECT * FROM housekeeping_meta').all(),owners=db.prepare('SELECT * FROM universe_metadata').all();
  if(meta.length!==1||meta[0].root_id!==rootId||meta[0].generation!==entry.generation||meta[0].operation!==entry.operation||owners.length!==1||owners[0].universe_id!==id||owners[0].ready!==1)fail('PRODUCTION_GENERATION_MISMATCH');
  if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')fail('PRODUCTION_INTEGRITY');return owners[0];
}
export function migrateProduction(db,rootId,generation,operation){
  const old=db.prepare('PRAGMA user_version').get().user_version;
  if(old===1){for(const sql of productionSql.slice(0,2))db.exec(sql);db.prepare('INSERT INTO housekeeping_meta VALUES(1,?,?,?)').run(rootId,generation,operation);for(const sql of productionSql.slice(2))db.exec(sql);db.exec('PRAGMA user_version=2');}
  else db.prepare('UPDATE housekeeping_meta SET generation=?,operation=? WHERE singleton=1').run(generation,operation);
}
export function contentDigest(db){const h=createHash('sha256');for(const t of tables.slice(0,5)){h.update(t+'\n');for(const r of db.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).iterate())h.update(JSON.stringify(r)+'\n');}return h.digest('hex');}
export function replayDigest(db){const h=createHash('sha256');for(const r of db.prepare('SELECT * FROM housekeeping_seals ORDER BY run_id').iterate())h.update(JSON.stringify(r)+'\n');return h.digest('hex');}
export function retainedDigest(db,retained){const h=createHash('sha256');for(const r of retained){h.update(JSON.stringify(r));h.update(JSON.stringify(db.prepare('SELECT * FROM sessions WHERE run_id=?').get(r.run)));for(const t of ['records','profile_versions','events']){h.update(t);for(const v of db.prepare(`SELECT * FROM ${t} WHERE run_id=? AND record_id<=? ORDER BY record_id`).iterate(r.run,r.through))h.update(JSON.stringify(v)+'\n');}}return h.digest('hex');}
export function registerProduction(root,anchor){
  root=path.resolve(root);checkPath(root,{directory:true});checkPath(path.dirname(anchor),{directory:true});checkPath(anchor,{missing:true});if(registered(root)||fs.existsSync(anchor))fail('ALREADY_REGISTERED');
  const id=randomUUID(),directory=path.join(root,'local-data','housekeeping-'+id);fs.mkdirSync(directory);const universes={};
  for(const name of fs.readdirSync(path.join(root,'local-data','profiles')).sort())if(name.endsWith('.db')&&!name.endsWith('.building.db')){const u=universeId(name.slice(0,-3)),db=openDatabase(path.join(root,'local-data','profiles',name));try{if(!validateProfileDatabase(db,u).ready)fail('INCOMPLETE_DATABASE');}finally{db.close();}universes[u]={phase:'READY',version:1,generation:0,lastBackup:null};}
  const catalog={id,version:1,universes};writeJson(path.join(directory,'catalog.json'),catalog);writeJson(anchor,{owner:'LifeSignsProductionMaintenance',id,root,catalogDigest:digest(JSON.stringify(catalog)+'\n')});
  writeJson(path.join(root,'local-data',REGISTRATION),{owner:'LifeSignsProductionMaintenance',version:1,id,anchor:path.resolve(anchor)});return productionRoot(root);
}
