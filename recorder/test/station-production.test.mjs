import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProfileStore} from '../../profiles/store.mjs';
import {generateRecorder} from '../md-generator.mjs';
import {parseRecord} from '../log-format.mjs';
import {harness} from './md-harness.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url)));
const ware=(id,name=id)=>({__type:'ware',ref:id,id,name});
const list=items=>({__pseudoEntry:true,entry:{list:items}});
const module=(kind,id,extra={})=>({__type:'component',ref:id,exists:true,class:kind,realclass:kind,macro:{id,name:'Module | '+id},...extra});
const station=(operational=[],construction=[])=>({__type:'component',exists:true,class:'station',ref:'station',isplayerowned:true,
 seed:9007199254740999n,idcode:'STA-001',knownname:'Synthetic station',sector:{name:'Synthetic sector'},primarypurpose:{name:'Factory'},
 macro:{name:'Factory'},assignedcontrolentity:{manager:null},modules:{operational:{list:operational},construction:{list:construction}},
 products:list([]),resources:list([]),supplyresources:list([]),tradewares:list([]),people:Object.assign(new Map(),{list:[],count:0}),availablepeople:Object.assign(new Map(),{list:[],count:0}),roleentities:[],assignedaipilot:null,tradenpc:null,shiptrader:null});
const rows=h=>h.output.map(o=>parseRecord(o.line));
function stationProfiles(h){const out=[];let current;for(const r of rows(h)){if(r.kind==='PROFILE_BEGIN')current={kind:r.fields.kind,fields:{}};if(r.kind==='VALUE'&&current)current.fields[r.fields.field]=r.fields;if(r.kind==='PROFILE_END'){if(current?.kind==='STATION')out.push({...current,end:r.fields});current=null;}}return out;}
function setup(s,env={},overrides={}){const h=harness(generateRecorder({...config,...overrides}),{stations:[s],...env});h.start();return h;}
function ticks(h,n=15){for(let i=0;i<n;i++){h.player.age+=1;h.call('Tick');}}
const saved=h=>({UniverseIdentity:structuredClone(h.cueVariables('UniverseIdentity'))});
const acknowledge=h=>h.call('DatabaseReply',{Response:[h.md.$LSPRun,h.md.$LSPUniverseIdText,'READY',h.md.$LSPRecord]});
test('station modules distinguish operational/construction, products, workforce inputs and storage without amounts',()=>{
 const energy=ware('energycells','Energy | Cells'),ore=ware('ore','Ore');
 const production=module('production','prod',{products:list([energy]),resources:list([ore])});
 const storage=module('storage','storage',{waretransport:['container','solid']});
 const habitat=module('habitation','hab',{resources:list([ware('food')]),workforce:{race:{name:'Terran'}}});
 const future=module('production','future',{class:'construction',products:list([ware('hullparts')]),resources:list([])});
 for(const m of [production,storage,habitat,future])Object.defineProperty(m,'cargo',{get(){throw Error('No stock reads');}});
 Object.defineProperty(ore,'amount',{get(){throw Error('No recipe quantities');}});
 const h=setup(station([production,storage,habitat],[future]));ticks(h);
 const p=stationProfiles(h)[0];assert.equal(p.fields.station_production_complete.value,'true');
 assert.equal(p.fields.module_1_product_1_id.value,'energycells');assert.equal(p.fields.module_1_product_1_name.value,'Energy | Cells');
 assert.equal(p.fields.module_1_resource_1_id.value,'ore');assert.equal(p.fields.module_2_storage_transport_2.value,'solid');
 assert.equal(p.fields.module_3_workforce_resource_1_id.value,'food');assert.equal(p.fields.module_4_state.value,'construction');
 assert.equal(p.fields.module_4_product_1_id.value,'hullparts');assert.equal(p.fields.module_4_resource_count.value,'0');
 assert.ok(Object.keys(p.fields).every(k=>!/(stock|amount|capacity|rate|price)/.test(k)));
});
test('missing collection stays unavailable and cannot be acknowledged as a completed metadata revision',()=>{
 const s=station();delete s.modules.construction.list;
 const h=setup(s);ticks(h);const p=stationProfiles(h)[0];
 assert.equal(p.fields.station_modules_construction_count.state,'UNAVAILABLE');assert.equal(p.fields.station_production_complete.value,'false');
 assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.size,0);
});
test('small value ceiling stops before resource getters and leaves an explicit partial profile',()=>{
 const m=module('production','prod');Object.defineProperty(m,'products',{get(){throw Error('Read after exhausted budget');}});
 const h=setup(station([m]),{}, {profileValueItems:16});ticks(h);const p=stationProfiles(h)[0];
 assert.equal(Object.keys(p.fields).length,16);assert.equal(p.end.partial,'true');assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.size,0);
});
test('existing database gets a station-only upgrade once acknowledged; restored saves retain the revision',()=>{
 const s=station([module('production','prod',{products:list([]),resources:list([])})]),seed='$STATION:'+s.seed;
 const h=setup(s,{databaseState:'READY',savedCueState:{UniverseIdentity:{$KnownProfileSeeds:new Map([[seed,true]])}}});ticks(h);
 assert.equal(stationProfiles(h).length,1);assert.equal(rows(h).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);
 assert.equal(h.callCounts.NpcProfile||0,0);assert.equal(h.callCounts.QueueNewHostPersonnel||0,0);acknowledge(h);assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.get(seed),1);
 const state=saved(h);ticks(h,30);assert.equal(stationProfiles(h).length,1);
 const restored=setup(s,{databaseState:'READY',savedCueState:state});ticks(restored);assert.equal(stationProfiles(restored).length,0);assert.equal(restored.md.$LSPStationModuleWatch.length,1,'Saved revisions still restore module loss watches without profiles');
});
test('metadata revision is not saved before actual database acknowledgement',()=>{
 const s=station(),h=setup(s,{autoDatabase:false});
 h.call('DatabaseReply',{Response:[h.md.$LSPRun,h.md.$LSPUniverseIdText,'READY',1]});ticks(h);
 assert.equal(stationProfiles(h).length,1);assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.size,0);
 h.call('DatabaseReply',{Response:[h.md.$LSPRun,h.md.$LSPUniverseIdText,'READY',h.md.$LSPRecord]});
 assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.get('$STATION:'+s.seed),1);
});
test('station ware catalogues separate production inputs, outputs, supplies and trade wares',()=>{
 const s=station([module('buildmodule','yard')]);
 s.products=list([ware('energycells')]);s.resources=list([ware('ore')]);s.supplyresources=list([ware('missilecomponents')]);s.tradewares=list([ware('water')]);
 for(const key of ['cargo','neededbuildresources','buildships','buildequipment'])Object.defineProperty(s,key,{get(){throw Error('No inventory, shortage or blueprint expansion');}});
 const h=setup(s);ticks(h);const f=stationProfiles(h)[0].fields;
 assert.equal(f.station_product_1_id.value,'energycells');assert.equal(f.station_resource_1_id.value,'ore');
 assert.equal(f.station_supply_resource_1_id.value,'missilecomponents');assert.equal(f.station_trade_ware_1_id.value,'water');
 assert.equal(f.module_1_build_resource_scope.value,'BUILD_SPECIFIC_NOT_ENUMERATED');
});

function moduleEvent(h,name,event){h.cueVariables(name).event=event;h.cue(name);}
test('module completion coalesces station refreshes and ignores ship construction and stale callbacks',()=>{
 const s=station([module('production','p',{products:list([]),resources:list([])})]),h=setup(s);ticks(h);acknowledge(h);
 const count=stationProfiles(h).length;
 moduleEvent(h,'StationProductionModuleCompleted',{param:{buildanchor:s},param3:{isshipbuild:true}});ticks(h);
 assert.equal(stationProfiles(h).length,count,'Ship builds do not refresh the shipyard');
 s.products=list([ware('water')]);
 for(let i=0;i<30;i++)moduleEvent(h,'StationProductionModuleCompleted',{param:{buildanchor:s},param3:{isshipbuild:false}});
 ticks(h);assert.equal(stationProfiles(h).length,count+1);assert.equal(stationProfiles(h).at(-1).fields.station_product_1_id.value,'water');
 acknowledge(h);ticks(h);assert.equal(stationProfiles(h).length,count+1);
 const before=h.output.length;h.cue('InvalidateLoadedRecorder');
 moduleEvent(h,'StationProductionModuleCompleted',{param:{buildanchor:s},param3:{isshipbuild:false}});assert.equal(h.output.length,before);
});
test('module destruction uses cached host and refresh arriving before ACK is retained',()=>{
 const m=module('production','p',{products:list([]),resources:list([])}),s=station([m]),h=setup(s);ticks(h);
 // Do not ACK the station profile yet. Its pending known key must not erase a newer change.
 assert.equal(h.md.$LSPQueuedKeys.size,0); // Initial baseline was ACKed by synthetic fixture.
 h.call('QueueNewProfile',{Object:s,Refresh:true});ticks(h);assert.ok(h.md.$LSPQueuedKeys.size>0);
 m.exists=false;s.modules.operational.list=[];
 moduleEvent(h,'StationProductionModuleDestroyed',{object:m});
 assert.equal(h.md.$LSPStationProductionDirty.size,1);assert.equal(h.md.$LSPStationModuleHosts.size,0);
 const count=stationProfiles(h).length;ticks(h);assert.equal(stationProfiles(h).length,count);
 acknowledge(h);assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.size,0);
 ticks(h);assert.equal(stationProfiles(h).length,count+1);assert.equal(stationProfiles(h).at(-1).fields.station_modules_operational_count.value,'0');
 acknowledge(h);assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.get('$STATION:'+s.seed),1);
});
test('generated station revisions round-trip through SQLite while old checkpoints and branches stay intact',t=>{
 const s=station([module('processingmodule','recycle',{products:list([ware('scrapmetal')]),resources:list([ware('scrap')])})]);
 const h=setup(s);ticks(h);
 // Only the canonical profiles stream is ingested; diagnostic rows repeat record IDs.
 const canonical=h.output.filter(o=>o.name.startsWith('profiles-')).map(o=>parseRecord(o.line));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ls-station-types-')),stores=[];
 t.after(()=>{for(const store of stores)store.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});});
 const begin=canonical[0],open=run=>{const store=new ProfileStore(root,begin.fields.lifesigns_universe_id,run);stores.push(store);return store;};
 let store=open(begin.run);store.ingest(canonical);const checkpoint=Number(canonical.at(-1).fields.record);
 const old=store.profilesAt().find(p=>p.kind==='STATION');assert.equal(old.seed,String(s.seed));
 assert.equal(old.fields.module_1_product_1_id.value,'scrapmetal');
 const profileCount=store.db.prepare('SELECT count(*) AS n FROM profile_versions').get().n;
 const offset=h.output.length;s.products=list([ware('energycells')]);
 h.call('RequestStationProductionRefresh',{Station:s});ticks(h);acknowledge(h);
 const update=h.output.slice(offset).filter(o=>o.name.startsWith('profiles-')).map(o=>parseRecord(o.line));store.ingest(update);store.ingest(update);
 assert.equal(store.profilesAt().find(p=>p.kind==='STATION').fields.station_product_1_id.value,'energycells');
 assert.equal(store.profilesAt(begin.run,checkpoint).find(p=>p.kind==='STATION').fields.station_product_count.value,'0');
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM profile_versions').get().n,profileCount+1,'Replay adds no duplicate profile');
 assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,1);
 const branch='session-3-4-loaded-2000-01-01_00-00-01';store.close();store=open(branch);
 store.ingest([{...begin,run:branch,fields:{...begin.fields,record:'1',parent_run:begin.run,parent_record:String(checkpoint)}}]);
 assert.equal(store.profilesAt().find(p=>p.kind==='STATION').fields.station_product_count.value,'0','Alternative branch does not inherit later metadata');
});

test('queued station refresh rechecks ownership and skips removed objects without reading their modules',()=>{
 const s=station(),h=setup(s,{databaseState:'READY'});ticks(h);acknowledge(h);
 h.call('RequestStationProductionRefresh',{Station:s});h.call('ProcessStationProductionRefreshes');s.isplayerowned=false;
 Object.defineProperty(s,'modules',{get(){throw Error('Foreign station metadata must not be read');}});
 const count=stationProfiles(h).length;h.call('ProcessNewProfiles');
 assert.equal(stationProfiles(h).length,count);assert.equal(h.md.$LSPQueuedKeys.size,0);assert.equal(h.md.$LSPStationProductionDirty.size,0);
 assert.equal(h.call('RequestStationProductionRefresh',{Station:null}),false);
 assert.equal(h.call('RequestStationProductionRefresh',{Station:s}),false);
});
test('station selectors use native class names rather than script datatype names',()=>{
 const source=generateRecorder(config);
 const selectors=[...source.matchAll(/\.isrealclass\.([a-z_]+)/g)].map(m=>m[1]);
 for(const klass of selectors)assert.ok(['production','processingmodule','habitation','storage','buildmodule'].includes(klass),klass);
 assert.ok(selectors.includes('storage'));assert.ok(selectors.includes('habitation'));
});
