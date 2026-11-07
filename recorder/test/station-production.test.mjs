import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
 const s=station(),seed='$STATION:'+s.seed;
 const h=setup(s,{databaseState:'READY',savedCueState:{UniverseIdentity:{$KnownProfileSeeds:new Map([[seed,true]])}}});ticks(h);
 assert.equal(stationProfiles(h).length,1);assert.equal(rows(h).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);
 assert.equal(h.callCounts.NpcProfile||0,0);acknowledge(h);assert.equal(saved(h).UniverseIdentity.$StationProductionVersions.get(seed),1);
 const state=saved(h);ticks(h,30);assert.equal(stationProfiles(h).length,1);
 const restored=setup(s,{databaseState:'READY',savedCueState:state});ticks(restored);assert.equal(stationProfiles(restored).length,0);
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
