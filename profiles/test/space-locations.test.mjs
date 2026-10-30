import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {gzipSync} from 'node:zlib';
import {ProfileStore} from '../store.mjs';import {ProfileConsumer} from '../service.mjs';import {escapeValue} from '../../recorder/log-format.mjs';
import {registerProduction,productionRoot,fileHash,contentDigest,readJson,writeJson,digest,openDatabase} from '../production-contract.mjs';
import {reviewProduction,executeProduction,scanProduction,filesInScope} from '../maintenance-production.mjs';import {reviewSpace,executeSpace,restorePoints} from '../maintenance-space.mjs';
import {readMenuSettings,changeLocation,setProtection,SETTINGS_NAME} from '../preview-settings.mjs';
import {PreviewService} from '../preview-service.mjs';import {parsePreviewRequest} from '../preview-protocol.mjs';import {EventEmitter} from 'node:events';
import {fork} from 'node:child_process';import {once} from 'node:events';
const U='lsu1-2026-10-30_12-00-00-1-2-3-4',V='lsu1-2026-10-30_12-00-00-5-6-7-8',A='session-1-2-loaded-2026-10-30_12-00-00',B='session-3-4-loaded-2026-10-30_12-01-00';
const row=(run,n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}}),start=(id,run,parent='NONE',n='0')=>row(run,1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:id,parent_run:parent,parent_record:n});
const xml=(id,run,n)=>`<savegame><info><game id="X4" version="900"/></info><script><refs type="string"><ref id="10" string="${id}"/><ref id="11" string="${run}"/></refs></script><md><script name="LifeSigns_EventRecorder"><cue name="UniverseIdentity"><vars><value name="$Id" type="string" value="10"/><value name="$CheckpointRun" type="string" value="11"/><value name="$CheckpointRecord" type="largefloat" value="${n}"/></vars></cue></script></md></savegame>`;
const history=file=>{const db=openDatabase(file);try{return {rows:contentDigest(db),seals:db.prepare("SELECT name FROM sqlite_schema WHERE name='housekeeping_seals'").get()?db.prepare('SELECT * FROM housekeeping_seals ORDER BY run_id').all():[]};}finally{db.close();}};
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-space-'));t.after(()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true});});const root=path.join(dir,'data'),saves=path.join(dir,'native'),archive=path.join(dir,'Archive 日本語');fs.mkdirSync(root);fs.mkdirSync(saves);fs.mkdirSync(archive);
 for(const id of [U,V]){let s=new ProfileStore(root,id,A);s.ingest([start(id,A),row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'SNAPSHOT_END',{profiles:'0'}),...Array.from({length:200},(_,i)=>row(A,i+4,'ENTITY_EVENT',{subject_kind:'SHIP',subject_seed:'42',event_type:'ATTACKED',details:'x'.repeat(4096)}))]);s.close();s=new ProfileStore(root,id,B);s.ingest([start(id,B,A,'50'),...Array.from({length:100},(_,i)=>row(B,i+2,'ENTITY_EVENT',{subject_kind:'SHIP',subject_seed:'42',event_type:'ATTACKED',details:'y'.repeat(4096)}))]);s.close();}
 fs.writeFileSync(path.join(saves,'save.xml.gz'),gzipSync(xml(U,B,10)));const c=registerProduction(root,path.join(dir,'anchor.json'));fs.mkdirSync(path.join(c.directory,'local-data'));writeJson(path.join(c.directory,'local-data',SETTINGS_NAME),{owner:'LifeSignsReadOnlyPreview',version:1,saveLocations:[saves],protectedUniverses:[]});return {root,saves,archive,c,file:path.join(root,'local-data/profiles',U+'.db'),peer:path.join(root,'local-data/profiles',V+'.db')};
}
const options=f=>({nativeSaveDirectory:f.saves,...(process.platform==='win32'?{}:{handles:async()=>({add:async()=>{},assert(){},close:async()=>{},install:async(a,b)=>fs.renameSync(a,b)})})});
const clean=async f=>executeProduction(f.root,await reviewProduction(f.root,U,'CLEAN',options(f)),options(f));

test('folder enumeration reports progress, includes nested files, and bounds broad scopes before content reads',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-scope-'));t.after(()=>fs.rmSync(dir,{recursive:true}));
 fs.mkdirSync(path.join(dir,'nested'));fs.writeFileSync(path.join(dir,'nested','save.xml.gz'),'not read during enumeration');fs.writeFileSync(path.join(dir,'unrelated.txt'),'preserved');
 const settings={value:{saveLocations:[dir,path.join(dir,'nested')]}},progress=[],opts={getAvailability:()=> 'LOCAL_METADATA_ONLY',onProgress:p=>progress.push(p)};
 const files=filesInScope(settings,opts);assert.equal(files.length,1);assert.ok(files.includes(path.join(dir,'nested','save.xml.gz')));assert.equal(progress[0].completed,0);assert.ok(progress.at(-1).completed>0);assert.ok(progress.every(p=>p.stage==='FOLDERS'&&p.total===null));
 assert.throws(()=>filesInScope(settings,{...opts,maxEntries:1}),/SAVE_SCOPE_TOO_BROAD/);
 let clock=0;assert.throws(()=>filesInScope(settings,{...opts,now:()=>clock++,maxMilliseconds:2}),/SAVE_SCOPE_TOO_BROAD/);
 assert.equal(fs.readFileSync(files[0],'utf8'),'not read during enumeration');
});

test('menu locations retain native scope, normalise duplicates, persist Unicode archives and never remove folders',async t=>{
 const f=await fixture(t),r=readMenuSettings(f.c.directory,f.saves);let s=changeLocation(f.c.directory,r.digest,f.saves,{add:f.archive});assert.equal(s.value.saveLocations.length,2);
 s=changeLocation(f.c.directory,s.digest,f.saves,{add:path.join(f.archive,'.')});assert.equal(s.value.saveLocations.length,2);assert.deepEqual(readMenuSettings(f.c.directory,f.saves).value,s.value);
 assert.throws(()=>changeLocation(f.c.directory,s.digest,f.saves,{remove:0}),/NATIVE/);assert.throws(()=>changeLocation(f.c.directory,r.digest,f.saves,{remove:1}),/SETTINGS_CHANGED/);
 for(const add of ['', 'relative', '\\server\share',path.join(f.archive,'absent'),'x\n'])assert.throws(()=>changeLocation(f.c.directory,s.digest,f.saves,{add}));
 fs.writeFileSync(path.join(f.archive,'keep.txt'),'untouched');s=changeLocation(f.c.directory,s.digest,f.saves,{remove:1});assert.deepEqual(s.value.saveLocations,[f.saves]);assert.equal(fs.readFileSync(path.join(f.archive,'keep.txt'),'utf8'),'untouched');
});
test('missing mandatory native scope stays incomplete and cannot classify an orphan',async t=>{
 const f=await fixture(t);fs.renameSync(f.saves,f.saves+'-unavailable');const r=await scanProduction(f.root,options(f));assert.equal(r.inventory.complete,false);assert(r.databases.every(d=>d.status==='BLOCKED'));await assert.rejects(reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),/NOT_A_VERIFIED_ORPHAN/);
});
test('actual Windows handle IPC scans Unicode archive paths without console-codepage corruption',async t=>{
 const f=await fixture(t);fs.copyFileSync(path.join(f.saves,'save.xml.gz'),path.join(f.archive,'archive.xml.gz'));changeLocation(f.c.directory,readMenuSettings(f.c.directory,f.saves).digest,f.saves,{add:f.archive});
 const result=await scanProduction(f.root,options(f));assert.equal(result.inventory.complete,true);assert.equal(result.inventory.unknowns.length,0);assert.equal(result.inventory.roots.length,2);
});
test('compaction retains all remaining rows, seals, ancestry and peer bytes and measures smaller database',async t=>{
 const f=await fixture(t),peer=fileHash(f.peer);await clean(f);const before=history(f.file),size=fs.statSync(f.file).size;
 const p=await reviewProduction(f.root,U,'COMPACT',options(f));await executeProduction(f.root,p,options(f));assert.deepEqual(history(f.file),before);assert(fs.statSync(f.file).size<size);assert.equal(fileHash(f.peer),peer);assert.equal(restorePoints(productionRoot(f.root),U).length,2);
 const r=await scanProduction(f.root,options(f));assert.equal(r.databases.find(d=>d.universe===U).candidates.records,0);
});
test('compaction refuses unclean history; interruption in staging preserves active bytes and stale location edits reject confirmation',async t=>{
 const f=await fixture(t);await assert.rejects(reviewProduction(f.root,U,'COMPACT',options(f)),/CLEAN_SAVED/);await clean(f);let p=await reviewProduction(f.root,U,'COMPACT',options(f));const before=fileHash(f.file);
 await assert.rejects(executeProduction(f.root,p,{...options(f),onPhase:phase=>{if(phase==='COMPACTED')throw Error('INJECTED_STAGE_FAILURE');}}),/INJECTED/);assert.equal(fileHash(f.file),before);assert.equal(productionRoot(f.root).catalog.universes[U].phase,'READY');
 p=await reviewProduction(f.root,U,'COMPACT',options(f));changeLocation(f.c.directory,readMenuSettings(f.c.directory,f.saves).digest,f.saves,{add:f.archive});await assert.rejects(executeProduction(f.root,p,options(f)),/STALE_CONFIRMATION/);assert.equal(fileHash(f.file),before);
});
test('selected restore-point deletion retains current history and peers and clears only the selected current pointer',async t=>{
 const f=await fixture(t);await clean(f);const p=await reviewProduction(f.root,U,'COMPACT',options(f));await executeProduction(f.root,p,options(f));const c=productionRoot(f.root),points=restorePoints(c,U),old=points.find(p=>p.id!==c.catalog.universes[U].lastBackup),active=fileHash(f.file),peer=fileHash(f.peer);
 await executeSpace(f.root,await reviewSpace(f.root,U,'BACKUPDELETE',{...options(f),backupId:old.id}),options(f));assert(!fs.existsSync(old.file));assert.equal(restorePoints(productionRoot(f.root),U).length,1);assert.equal(fileHash(f.file),active);assert.equal(fileHash(f.peer),peer);
 const current=productionRoot(f.root).catalog.universes[U].lastBackup;await executeSpace(f.root,await reviewSpace(f.root,U,'BACKUPDELETE',{...options(f),backupId:current}),options(f));assert.equal(productionRoot(f.root).catalog.universes[U].lastBackup,null);assert.equal(fileHash(f.file),active);
});
test('interrupted backup unlink requires explicit known-target resumption and preserves history',async t=>{
 const f=await fixture(t);await clean(f);const c=productionRoot(f.root),id=c.catalog.universes[U].lastBackup,before=fileHash(f.file),p=await reviewSpace(f.root,U,'BACKUPDELETE',{...options(f),backupId:id});
 await assert.rejects(executeSpace(f.root,p,{...options(f),onPhase:phase=>{if(phase==='FILE_REMOVED')throw Error('INTERRUPTED_UNLINK');}}),/INTERRUPTED/);assert.equal(productionRoot(f.root).catalog.universes[U].phase,'DELETE_PENDING');assert.throws(()=>new ProfileStore(f.root,U,B),/RECOVERY/);
 const resume=await reviewSpace(f.root,U,'BACKUPDELETE',options(f));await executeSpace(f.root,resume,options(f));assert.equal(productionRoot(f.root).catalog.universes[U].phase,'READY');assert.equal(fileHash(f.file),before);
});
test('orphan deletion refuses detected/protected/changed scope; retired universe cannot be recreated by actual consumer replay',async t=>{
 const f=await fixture(t),peer=fileHash(f.file);await assert.rejects(reviewSpace(f.root,U,'DELETEUNIVERSE',options(f)),/NOT_A_VERIFIED_ORPHAN/);
 let settings=readMenuSettings(f.c.directory,f.saves);setProtection(f.c.directory,settings.digest,V,true);await assert.rejects(reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),/PROTECTED/);settings=readMenuSettings(f.c.directory,f.saves);setProtection(f.c.directory,settings.digest,V,false);
 let p=await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f));fs.writeFileSync(path.join(f.saves,'new.xml.gz'),gzipSync(xml(V,B,10)));await assert.rejects(executeSpace(f.root,p,options(f)),/SAVE_SCOPE_CHANGED/);fs.unlinkSync(path.join(f.saves,'new.xml.gz'));
 p=await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f));const originalBytes=fs.statSync(f.peer).size,deleted=await executeSpace(f.root,p,options(f));assert.equal(deleted.netFileByteReduction,originalBytes-fs.statSync(f.peer).size);assert.equal(JSON.parse(fs.readFileSync(f.peer,'utf8')).owner,'LifeSignsRetiredUniverse');assert.equal(fileHash(f.file),peer);assert.equal(productionRoot(f.root).catalog.universes[V].phase,'RETIRED');assert.throws(()=>new ProfileStore(f.root,V,A));const{DatabaseSync}=await import('node:sqlite');const legacy=new DatabaseSync(f.peer,{readOnly:true});try{assert.throws(()=>legacy.prepare('PRAGMA user_version').get());}finally{legacy.close();}
 const replies=path.join(f.root,'replies');fs.mkdirSync(replies);const consumer=new ProfileConsumer({root:f.root,replyDirectory:replies}),r=start(V,A),line='LSEV1|'+['run='+r.run,'session='+r.session,'seq='+r.seq,'age='+r.age,r.kind,...Object.entries(r.fields).map(([k,v])=>k+'='+escapeValue(v)),'END'].join('|');assert.deepEqual(consumer.consume([line]),[]);assert.equal(consumer.stores.size,0);assert.equal(consumer.pendingReplies.size,0);assert.equal(JSON.parse(fs.readFileSync(f.peer,'utf8')).owner,'LifeSignsRetiredUniverse');consumer.close();const good=new ProfileStore(f.root,U,B);good.close();
});
test('interrupted orphan deletion preserves permanent retirement and resumes no unrelated evidence',async t=>{
 const f=await fixture(t),p=await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),evidence=path.join(f.c.directory,'unrelated-evidence.txt');fs.writeFileSync(evidence,'KEEP');
 await assert.rejects(executeSpace(f.root,p,{...options(f),onPhase:phase=>{if(phase==='FILE_REMOVED')throw Error('CRASH_AFTER_FIRST_UNLINK');}}),/CRASH/);assert.equal(productionRoot(f.root).catalog.universes[V].retired,true);
 await executeSpace(f.root,await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),options(f));assert.equal(productionRoot(f.root).catalog.universes[V].phase,'RETIRED');assert.equal(fs.readFileSync(evidence,'utf8'),'KEEP');assert.equal(restorePoints(productionRoot(f.root),V).length,0);
});

test('typed path transport rejects malformed UTF-8 and controls, requires explicit mutation confirmation, and never treats payload as code',()=>{
 const head='LSHK2|'+'1'.repeat(32)+'|'+'2'.repeat(32)+'|1|',tail='|END',text=path.resolve('Archive 日本語 $(literal)');
 assert.equal(parsePreviewRequest(head+'ADDLOCATION|0|'+Buffer.from(text).toString('hex')+tail).payload,text);
 for(const x of ['ADDLOCATION|0|ff','ADDLOCATION|0|0a','ADDLOCATION|1|6162','BACKUPREVIEW|0|6162','ADDLOCATION|0|a','ADDLOCATION|0|'+'aa'.repeat(1025)])assert.equal(parsePreviewRequest(head+x+tail),null);
 const prefix='LSHK1|'+'1'.repeat(32)+'|'+'2'.repeat(32)+'|1|';
 for(const verb of ['COMPACT','DELETEUNIVERSE','BACKUPDELETE']){assert.equal(parsePreviewRequest(prefix+verb+'|1|0|0|END'),null);assert.equal(parsePreviewRequest(prefix+verb+'|1|1|0|END').verb,verb);}
});
test('actual location service invalidates confirmation/model, persists changes, retains native scope across restart, and refuses mutation races',async t=>{
 const f=await fixture(t),replies=path.join(f.root,'replies');fs.mkdirSync(replies);let launches=0;
 const make=()=>new PreviewService({root:f.root,replyDirectory:replies,nativeSaveDirectory:f.saves,launch:()=>{launches++;return new EventEmitter();}});let service=make();t.after(()=>service.stop());
 const C='2'.repeat(32),extra=(seq,folder)=>`LSHK2|${service.gen}|${C}|${seq}|ADDLOCATION|0|${Buffer.from(folder).toString('hex')}|END`,plain=(seq,verb,item=0)=>`LSHK1|${service.gen}|${C}|${seq}|${verb}|${item}|0|0|END`;
 service.client=C;service.confirmation={client:C,id:U};service.model={ids:[U]};service.baseModel={};service.handle(extra(1,f.archive));assert.equal(service.model,null);assert.equal(service.confirmation,null);assert.equal(readMenuSettings(f.c.directory,f.saves).value.saveLocations.length,2);assert.equal(launches,0);
 service.stop();service=make();service.client=C;assert.equal(service.readSettings().value.saveLocations[0],f.saves);assert.equal(service.readSettings().value.saveLocations.length,2);
 const before=service.readSettings().digest;service.mutating=true;service.handle(plain(1,'REMOVELOCATION',2));assert.equal(service.readSettings().digest,before);service.mutating=false;service.scanning=false;
 service.handle(plain(2,'REMOVELOCATION',1));assert.equal(service.readSettings().digest,before);service.handle(plain(3,'REMOVELOCATION',2));assert.deepEqual(service.readSettings().value.saveLocations,[f.saves]);assert(fs.existsSync(f.archive));
});
test('catalogue-bound deletion journal refuses changed hash-valid target lists and unlinks nothing else',async t=>{
 const f=await fixture(t),p=await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f));await assert.rejects(executeSpace(f.root,p,{...options(f),onPhase:phase=>{if(phase==='DELETE_PREPARED')throw Error('STOP_BEFORE_UNLINK');}}),/STOP/);
 const c=productionRoot(f.root),e=c.catalog.universes[V],file=path.join(c.directory,'delete-'+e.operation+'.json'),job=readJson(file),before=fileHash(f.file);job.targets[0].file=f.file;job.targets[0].hash=before;job.digest=digest(job.targets);writeJson(file,job);
 await assert.rejects(reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),/DELETE_JOURNAL_CHANGED/);assert.equal(fileHash(f.file),before);assert(fs.existsSync(f.peer));
});

test('disk-space preflight refuses orphan deletion and compaction before altering registered data',async t=>{
 const f=await fixture(t);await clean(f);const compact=await reviewProduction(f.root,U,'COMPACT',options(f)),orphan=await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),before=fileHash(f.file),peer=fileHash(f.peer),statfs=fs.statfsSync;
 try{fs.statfsSync=()=>({bavail:0,bsize:4096});await assert.rejects(executeSpace(f.root,orphan,options(f)),/INSUFFICIENT_BACKUP_SPACE/);await assert.rejects(executeProduction(f.root,compact,options(f)),/INSUFFICIENT_BACKUP_SPACE/);}finally{fs.statfsSync=statfs;}
 assert.equal(fileHash(f.file),before);assert.equal(fileHash(f.peer),peer);assert(Object.values(productionRoot(f.root).catalog.universes).every(e=>e.phase==='READY'));
});
test('Windows unmanaged writable handles prevent orphan unlink',{skip:process.platform!=='win32'},async t=>{
 const f=await fixture(t),plan=await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),before=fileHash(f.peer),{DatabaseSync}=await import('node:sqlite'),writer=new DatabaseSync(f.peer);
 try{await assert.rejects(executeSpace(f.root,plan,options(f)),/HANDLE/);}finally{writer.close();}assert.equal(fileHash(f.peer),before);assert.equal(productionRoot(f.root).catalog.universes[V].phase,'READY');
});
test('real process exit between orphan unlinks resumes from anchored retirement and preserves peer bytes',{skip:process.platform!=='win32'},async t=>{
 const f=await fixture(t),confirmation=await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),before=fileHash(f.file),child=fork(new URL('./space-crash-worker.mjs',import.meta.url),[],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});let errors='';child.stderr.on('data',d=>errors+=d);const done=once(child,'exit');child.send({root:f.root,confirmation,nativeSaveDirectory:f.saves,phase:'FILE_REMOVED'});const[code]=await done;assert.equal(code,87,errors);assert.equal(productionRoot(f.root).catalog.universes[V].phase,'DELETE_PENDING');assert.throws(()=>new ProfileStore(f.root,V,A));
 await executeSpace(f.root,await reviewSpace(f.root,V,'DELETEUNIVERSE',options(f)),options(f));assert.equal(JSON.parse(fs.readFileSync(f.peer,'utf8')).owner,'LifeSignsRetiredUniverse');assert.equal(fileHash(f.file),before);assert.equal(productionRoot(f.root).catalog.universes[V].phase,'RETIRED');
});
