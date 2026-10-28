import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { ProfileStore } from '../store.mjs';
import { retentionPreview } from '../retention-plan.mjs';
import { inspectProfileDatabase } from '../profile-inventory.mjs';
import { inspectSave, inventorySaves } from '../save-inventory.mjs';
import { housekeeping, main } from '../housekeeping-cli.mjs';

const U = 'lsu1-2026-10-21_12-00-00-1-2-3-4', V = 'lsu1-2026-10-21_12-00-00-5-6-7-8';
const A = 'session-1-2-loaded-2026-10-21_12-00-00', B = 'session-3-4-loaded-2026-10-21_12-01-00', C = 'session-5-6-loaded-2026-10-21_12-02-00';
const local = { getAvailability: () => 'LOCAL_METADATA_ONLY' };
const hash = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifesigns-housekeeping-'));
  t.after(() => { assert.equal(path.dirname(dir), path.resolve(os.tmpdir())); fs.rmSync(dir, { recursive: true }); });
  return dir;
}
const row = (run, n, kind, fields = {}) => ({ run, session: 'UNAVAILABLE', seq: '1', age: String(n), kind, fields: { record: String(n), ...fields } });
const start = (run, parent = 'NONE', n = '0') => row(run, 1, 'RUN_BEGIN', { database_protocol: 'LSDB1', lifesigns_universe_id: U, parent_run: parent, parent_record: n });
const event = (run, n) => row(run, n, 'ENTITY_EVENT', { subject_kind: 'SHIP', event_type: 'ATTACKED', subject_idcode: 'SYN-001' });
function database(t) {
  const dir = temp(t), store = new ProfileStore(dir, U, A);
  const baseline = [start(A), row(A,2,'SNAPSHOT_BEGIN'), row(A,3,'PROFILE_BEGIN',{kind:'SHIP',profile:'1'}), row(A,4,'VALUE',{profile:'1',field:'seed',value:'42',state:'PRESENT',type:'datatype.largeint'}), row(A,5,'PROFILE_END',{profile:'1',partial:'1'}), row(A,6,'SNAPSHOT_END',{profiles:'1',partial:'1'}), event(A,7), event(A,8)];
  store.ingest(baseline); const file = store.final; store.close();
  for (const [run, cutoff] of [[B,'7'],[C,'6']]) { const s = new ProfileStore(dir,U,run); s.ingest([start(run,A,cutoff),event(run,2),event(run,3)]); s.close(); }
  return {dir,file};
}
const root = (run, record) => ({ universe: U, run, record });
function graph() {
  return { status:'OWNED', universe:U, runs:[
    {run:A,parent:null,parentRecord:0,baseline:1,records:12,first:1,last:12,profiles:[{begin:3,end:5}],profileEnds:[5],eventRecords:[7,8,9,10,11,12],snapshotEnds:[6]},
    {run:B,parent:A,parentRecord:8,baseline:0,records:4,first:1,last:4,profiles:[],profileEnds:[],eventRecords:[2,3,4],snapshotEnds:[]},
    {run:C,parent:A,parentRecord:10,baseline:0,records:3,first:1,last:3,profiles:[],profileEnds:[],eventRecords:[2,3],snapshotEnds:[]}
  ]};
}
test('all retained roots union maximum ancestor prefixes, preserving overwritten ancestor and both branches', () => {
  const g=graph(), p=retentionPreview(g,[root(B,2),root(C,2),root(B,3)],{complete:true});
  assert.equal(p.status,'PREVIEW_ONLY'); assert.deepEqual(p.retained,[{run:A,through:10},{run:B,through:3},{run:C,through:2}]);
  assert.deepEqual(p.candidates,{kind:'UNREACHABLE_HISTORY',records:4,profiles:0,events:4,sessions:0});
  assert.deepEqual(retentionPreview(g,[root(B,3),root(C,2),root(B,2)],{complete:true}).retained,p.retained);
});
test('pin preserves whole history even with unknown saves and no roots',()=>{
  const p=retentionPreview(graph(),[],{pinned:true}); assert.equal(p.status,'PINNED'); assert.deepEqual(p.retained.map(r=>r.through),[12,4,3]); assert.equal(p.candidates.records,0);
});
test('unknown identity blocks every universe; identified uncertainty blocks its universe only',()=>{
  assert.equal(retentionPreview(graph(),[],{complete:true,unknowns:[{code:'BAD_SAVE'}]}).candidates,null);
  assert.equal(retentionPreview(graph(),[],{complete:true,unknowns:[{code:'BAD_SAVE',universe:V}]}).status,'PREVIEW_ONLY');
  assert.equal(retentionPreview(graph(),[],{complete:false}).status,'BLOCKED');
  assert.equal(retentionPreview(graph(),[],{complete:true}).candidates.kind,'ORPHAN_UNIVERSE');
});
test('invalid graph, missing roots, incomplete baseline and cuts inside profiles block previews',()=>{
  for(const [change,roots,code] of [
    [g=>g.runs[0].snapshotEnds=[],[],'INCOMPLETE_BASELINE'],
    [g=>g.runs[1].parent=C, [root(B,2)],'ANCESTRY_CYCLE'],
    [g=>g.runs[1].parent='session-7-8-loaded-2026-10-21_12-00-00',[],'MISSING_PARENT'],
    [g=>g.runs[0].first=2,[],'RECORD_GAP'],
    [()=>{},[root(A,4)],'PARTIAL_PROFILE_CUTOFF'],
    [()=>{},[root(A,5)],'INCOMPLETE_BASELINE'],
    [()=>{},[root(B,99)],'MISSING_ROOT_RECORD']
  ]) {const g=graph();change(g); if(code==='ANCESTRY_CYCLE'){g.runs[2].parent=B;g.runs[1].parentRecord=2;g.runs[2].parentRecord=2;} const p=retentionPreview(g,roots,{complete:true}); assert.ok(p.blocks.includes(code),JSON.stringify(p)); assert.equal(p.candidates,null);}
});
test('actual DB inspection is read-only; completed partial-data profile is retained and views remain exact',t=>{
  const {dir,file}=database(t), before=hash(file), snap=inspectProfileDatabase(file,local);
  assert.equal(snap.status,'OWNED',JSON.stringify(snap)); const p=retentionPreview(snap,[root(B,2),root(C,2)],{complete:true}); assert.equal(p.status,'PREVIEW_ONLY'); assert.equal(hash(file),before);
  const db=new DatabaseSync(file,{readOnly:true}); assert.equal(db.prepare('SELECT partial FROM profile_versions').get().partial,1); db.close();
  const s=new ProfileStore(dir,U,B); assert.equal(s.profilesAt()[0].seed,'42'); assert.equal(s.eventsAt().length,3);s.close();assert.equal(hash(file),before);
});
test('missing, foreign, building, sidecar and WAL DBs never create or repair data',t=>{
  const dir=temp(t), missing=path.join(dir,U+'.db'); assert.equal(inspectProfileDatabase(missing,local).status,'BLOCKED');assert.deepEqual(fs.readdirSync(dir),[]);
  fs.writeFileSync(missing,'foreign');let before=hash(missing);assert.equal(inspectProfileDatabase(missing,local).status,'BLOCKED');assert.equal(hash(missing),before);
  const {file}=database(t);before=hash(file);fs.writeFileSync(file+'-journal','fixture');assert.equal(inspectProfileDatabase(file,local).status,'BLOCKED');assert.equal(hash(file),before);fs.unlinkSync(file+'-journal');
  const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL');db.close();before=hash(file);assert.equal(inspectProfileDatabase(file,local).problem,'WAL_DATABASE');assert.equal(hash(file),before);
  assert.equal(inspectProfileDatabase(path.join(dir,U+'.building.db'),local).problem,'BUILDING_DATABASE');
});

// Shape established independently from native X4 900 owner archives, not from
// the extractor. Synthetic identities/checkpoint expectations are explicit.
const xml = () => `<savegame><info><game id="X4" version="900"/></info><script><refs type="string"><ref id="10" string="${U}"/><ref id="11" string="${A}"/></refs><refs type="list"><ref id="10"/></refs></script><md><script name="LifeSigns_EventRecorder"><cue name="UniverseIdentity"><vars><value name="$Id" type="string" value="10"/><value name="$CheckpointRun" type="string" value="11"/><value name="$CheckpointRecord" type="largefloat" value="8"/></vars></cue></script></md></savegame>`;
test('plain XML and native gzip resolve typed refs to the independently expected checkpoint and stay byte-identical',async t=>{
  const dir=temp(t);
  for(const [name,data] of [['save.xml',xml()],['save.xml.gz',gzipSync(xml())]]){
    const file=path.join(dir,name);fs.writeFileSync(file,data);const before=hash(file),r=await inspectSave(file,local);
    assert.equal(r.status,'CHECKPOINT',JSON.stringify(r));assert.deepEqual(r.root,root(A,8));assert.equal(r.sha256,before);assert.equal(hash(file),before);
  }
});
test('invalid, truncated, ambiguous, unsupported and hostile XML/gzip remain unknown',async t=>{
  const dir=temp(t), bad=[
    xml().slice(0,-5),xml()+'<extra/>',xml().replace('version="900"','version="901"'),
    xml().replace('<refs type="string">','<refs type="string"><ref id="10" string="duplicate"/>'),
    xml().replace('</vars>','<value name="$Id" type="string" value="10"/></vars>'),
    xml().replace('value="11"','value="999"'),xml().replace('type="largefloat"','type="integer"'),
    xml().replace('value="8"','value="9007199254740992"'),xml().replace('value="8"','value="8e0"'),
    xml().replace('<savegame>','<savegame xmlns="urn:unknown">'),
    '<!DOCTYPE savegame [<!ENTITY x "boom">]>'+xml(),xml().replace('</md>','<script name="LifeSigns_EventRecorder"/></md>'),
    xml().replace('name="UniverseIdentity"','name="OtherCue"'),
    xml().replace('</script></md>','<cue name="UniverseIdentity"/></script></md>'),
    gzipSync(xml()).subarray(0,-4), Buffer.from([0xff,0xfe,0,0]),Buffer.from('PK\x03\x04fixture')
  ];
  const crc=gzipSync(xml());crc[crc.length-8]^=1;bad.push(crc);
  for(let i=0;i<bad.length;i++){const file=path.join(dir,`bad-${i}.xml`);fs.writeFileSync(file,bad[i]);const before=hash(file),r=await inspectSave(file,local);assert.equal(r.status,'UNKNOWN',`${i}: ${JSON.stringify(r)}`);assert.equal(hash(file),before);}
});
test('known complete no-state save is distinct from unreadable/missing checkpoint state',async t=>{
  const dir=temp(t), file=path.join(dir,'save.xml');fs.writeFileSync(file,'<savegame><info><game id="X4" version="900"/></info><script><refs type="string"/></script><md/></savegame>');
  assert.equal((await inspectSave(file,local)).status,'NO_LIFESIGNS_STATE');
  fs.writeFileSync(file,xml().replace('<value name="$CheckpointRecord" type="largefloat" value="8"/>',''));const r=await inspectSave(file,local);assert.equal(r.status,'UNKNOWN');assert.equal(r.universe,U);
});
test('resource limits, provider metadata and concurrent file changes block rather than trust an early checkpoint',async t=>{
  const dir=temp(t),file=path.join(dir,'save.xml');fs.writeFileSync(file,xml());
  assert.equal((await inspectSave(file,{...local,maxBytes:20})).status,'UNKNOWN');
  assert.equal((await inspectSave(file,{...local,timeout:1})).status,'UNKNOWN');
  assert.equal((await inspectSave(file,{getAvailability:()=> 'PROVIDER_OR_REPARSE'})).status,'UNKNOWN');
  assert.equal((await inspectSave(file,{...local,beforeVerify:f=>fs.appendFileSync(f,' ')})).code,'INPUT_CHANGED');
});
test('inventory includes all declared folders and archives; unknown/missing locations block without creating anything',async t=>{
  const dir=temp(t),a=path.join(dir,'one'),b=path.join(dir,'two');fs.mkdirSync(a);fs.mkdirSync(b);fs.writeFileSync(path.join(a,'save.xml'),xml());fs.writeFileSync(path.join(b,'save.xml.gz'),gzipSync(xml()));
  let r=await inventorySaves([a,b],local);assert.equal(r.complete,true);assert.equal(r.roots.length,2);
  fs.writeFileSync(path.join(b,'unsupported.zip'),'fixture');r=await inventorySaves([a,b,path.join(dir,'missing')],local);assert.equal(r.complete,false);assert.equal(r.unknowns.length,2);assert.equal(fs.existsSync(path.join(dir,'missing')),false);
});
test('standalone CLI requires explicit scopes, rejects Apply and never creates a missing DB directory',async t=>{
  const dir=temp(t),save=path.join(dir,'saves');fs.mkdirSync(save);fs.writeFileSync(path.join(save,'save.xml'),xml());
  await assert.rejects(main(['--apply','yes']));await assert.rejects(main([]));
  const p=path.join(dir,'missing');const r=await housekeeping({saves:[save],profiles:p,...local});assert.equal(r.applyAvailable,false);assert.ok(r.unknowns.length);assert.equal(fs.existsSync(p),false);
});
test('whole CLI preview associates real disposable DB roots, preserves all bytes and honours whole-universe pin',async t=>{
  const {dir,file}=database(t),saves=path.join(dir,'saves');fs.mkdirSync(saves);const save=path.join(saves,'save.xml.gz');fs.writeFileSync(save,gzipSync(xml()));
  const before=hash(file),saveBefore=hash(save),profiles=path.dirname(file),names=fs.readdirSync(profiles);
  const result=await housekeeping({saves:[saves],profiles,...local});
  const d=result.databases.find(x=>x.universe===U);assert.equal(result.inventory.roots.length,1);assert.equal(d.status,'PREVIEW_ONLY');assert.equal(d.candidates.records,6);assert.equal(d.candidates.sessions,2);
  const pin=await housekeeping({saves:[saves],profiles,pins:[U],...local});assert.equal(pin.databases.find(x=>x.universe===U).status,'PINNED');assert.equal(pin.databases.find(x=>x.universe===U).candidates.records,0);
  assert.deepEqual(fs.readdirSync(profiles),names);assert.equal(hash(file),before);assert.equal(hash(save),saveBefore);
});
test('read-only inspectors reject hard links, incomplete publication, wrong schema and mismatched session projection',t=>{
  const {file}=database(t),alias=path.join(path.dirname(file),'alias.xml');fs.linkSync(file,alias);const before=hash(file);assert.equal(inspectProfileDatabase(file,local).status,'BLOCKED');assert.equal(hash(file),before);fs.unlinkSync(alias);
  let db=new DatabaseSync(file);db.exec('UPDATE universe_metadata SET ready=0');db.close();assert.equal(inspectProfileDatabase(file,local).problem,'INCOMPLETE_DATABASE');
  db=new DatabaseSync(file);db.exec('UPDATE universe_metadata SET ready=1');db.prepare('UPDATE sessions SET parent_record=6 WHERE run_id=?').run(B);db.close();assert.equal(inspectProfileDatabase(file,local).problem,'SESSION_PARENT_MISMATCH');
  db=new DatabaseSync(file);db.exec('PRAGMA user_version=2');db.close();const changed=hash(file);assert.equal(inspectProfileDatabase(file,local).status,'BLOCKED');assert.equal(hash(file),changed);
});
test('inventory rechecks earlier saves after later files are scanned',async t=>{
  const dir=temp(t),first=path.join(dir,'a.xml'),last=path.join(dir,'b.xml');fs.writeFileSync(first,xml());fs.writeFileSync(last,xml());
  const r=await inventorySaves([dir],{...local,beforeVerify:f=>{if(f===last)fs.appendFileSync(first,' ');}});
  assert.equal(r.complete,false);assert.ok(r.unknowns.some(u=>u.code==='INVENTORY_CHANGED'));
});

test('scan progress counts completed checks without changing preview, roots or input bytes',async t=>{
 const {dir,file}=database(t),saves=path.join(dir,'saves');fs.mkdirSync(saves);const save=path.join(saves,'save.xml.gz');fs.writeFileSync(save,gzipSync(xml()));
 const before=[hash(file),hash(save)],events=[];
 const a=await housekeeping({saves:[saves],profiles:path.dirname(file),...local,onProgress:p=>events.push(p)});
 const b=await housekeeping({saves:[saves],profiles:path.dirname(file),...local});assert.deepEqual(a,b);
 assert.ok(events.some(p=>p.stage==='SAVES'&&p.completed===1&&p.total===null));
 assert.ok(events.some(p=>p.stage==='DATABASES'&&p.completed===a.databases.length&&p.total===a.databases.length),JSON.stringify({events,unknowns:a.unknowns}));
 for(const stage of ['SAVE_RECHECK','DATABASE_RECHECK'])assert.ok(events.some(p=>p.stage===stage&&p.completed===p.total));
 assert.deepEqual([hash(file),hash(save)],before);
});
