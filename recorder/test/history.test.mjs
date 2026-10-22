import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateRecorder} from '../md-generator.mjs';
import {profileEvents} from '../profile-event-generator.mjs';
import {harness} from './md-harness.mjs';
import {parseRecord} from '../log-format.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url)));
const asset=(code,owned=true,klass='ship')=>({__type:'component',ref:code,class:klass,exists:true,isplayerowned:owned,seed:code==='OUR-001'?9223372036854775807n:123n,idcode:code,knownname:code+' | % 船',owner:owned?'player':'argon',sector:{knownname:'Test sector'},commander:null});
const setup=(ships=[],stations=[])=>{const h=harness(generateRecorder(config),{ships,stations,databaseState:'READY'});h.start();h.call('ProcessHistoryWork');return h;};
const rows=h=>h.output.filter(x=>x.name.startsWith('profiles-')).map(x=>parseRecord(x.line));
const events=h=>rows(h).filter(r=>r.kind==='ENTITY_EVENT');
function emit(h,type,event){const i=profileEvents.findIndex(e=>e.type===type);assert.ok(i>=0,type);h.cueVariables('ProfileEvent'+i).event=event;h.cue('ProfileEvent'+i);}

test('native combat listeners coalesce hits, preserve exact IDs/context, never scan personnel',()=>{
 const ship=asset('OUR-001'),enemy=asset('ARG-002',false),h=setup([ship]);Object.defineProperty(ship,'people',{get(){throw Error('No personnel reads');}});
 for(let i=0;i<300;i++)emit(h,'ATTACKED',{object:ship,param:enemy});
 assert.equal(events(h).length,1);let f=events(h)[0].fields;assert.equal(f.subject_seed,'9223372036854775807');assert.equal(f.other_faction,'argon');assert.equal(f.subject_name,ship.knownname);assert.equal(f.coalescing_window_seconds,'30');
 h.player.age+=31;emit(h,'ATTACKED',{object:ship,param:enemy});assert.equal(events(h).length,2);
 assert.deepEqual(rows(h).map(r=>Number(r.fields.record)),[1,2,3]);assert.equal(rows(h).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);
 assert.equal(profileEvents.some(e=>/shield|hull/.test(e.name)),false);
});
test('destroyed/former-owned references retain cached identity; counterpart destruction is contextual',()=>{
 const ship=asset('OUR-001'),enemy=asset('ARG-002',false),h=setup([ship]);emit(h,'ATTACKED',{object:ship,param:enemy});ship.exists=false;enemy.exists=false;
 emit(h,'DESTROYED',{object:ship,param:enemy,param2:'weapon',param3:false});let f=events(h).at(-1).fields;assert.equal(f.subject_seed,'9223372036854775807');assert.equal(f.subject_kind,'SHIP');assert.equal(f.other_idcode,'ARG-002');
 emit(h,'RELATED_OBJECT_DESTROYED',{object:enemy,param:null,param2:'unknown'});assert.equal(events(h).at(-1).fields.scope,'RELATED_EXTERNAL');
});
test('trade fallback records observed terms, supply amounts and cancelled build task uses param',()=>{
 const ship=asset('OUR-001'),other=asset('ARG-002',false),h=setup([ship]);
 emit(h,'TRADE_COMPLETED',{object:h.player.galaxy,param:{buyer:ship,seller:other,ware:{name:'Energy cells'},amount:10,unitprice:12},param2:{exists:true,buyer:null,seller:null,ware:{name:'Energy cells'},amount:8,transferredamount:7,price:96}});
 let f=events(h).at(-1).fields;assert.equal(f.event_type,'TRADE_COMPLETED');assert.equal(f.subject_idcode,'OUR-001');assert.equal(f.other_idcode,'ARG-002');assert.equal(f.transferred_amount,'7');assert.equal(f.order_price,'96');
 const wares=new Map([['$energycells',42]]);emit(h,'SUPPLY_REQUEST_REMOVED',{object:ship,param:wares});f=events(h).at(-1).fields;assert.equal(f.amount,'42');assert.equal(f.event_type,'SUPPLY_REQUEST_REMOVED');
 emit(h,'BUILD_CANCELLED',{object:ship,param:{buildobject:other,isshipbuild:false,isexpansion:false,isupgrade:true,isrestock:false}});f=events(h).at(-1).fields;assert.equal(f.is_upgrade,'true');assert.equal(f.event_type,'BUILD_CANCELLED');
});
test('boarding scalars preserve contextual marine IDs without corrupting the host cache or claiming assignment',()=>{
 const ship=asset('OUR-001'),target=asset('ARG-002',false),h=setup([ship]);const t={__type:'npctemplate',ref:'marine-template'};
 const roster=Object.assign(new Map([[t,{exists:true,seed:-9223372036854775807n,name:'Marine | 船'}]]),{list:[t]});
 const operation={ref:'operation-1',boardee:target,attackers:[ship],marines:{infiltrating:roster,fighting:Object.assign(new Map(),{list:[]}),killed:Object.assign(new Map(),{list:[]})}};
 emit(h,'BOARDING_PHASE_CHANGED',{param:operation,param2:'combat',param3:'approach'});h.call('ProcessHistoryWork');
 let f=events(h).at(-1).fields;assert.equal(f.event_type,'BOARDING_MARINE_INFILTRATING');assert.equal(f.subject_seed,'-9223372036854775807');assert.equal(f.subject_name,'Marine | 船');assert.equal(f.subject_kind,'NPC');assert.equal(f.subject_idcode,'');assert.equal(f.scope,'BOARDING_PARTICIPANT');
 emit(h,'BOARDING_PHASE_CHANGED',{param:operation,param2:'combat',param3:'approach'});h.call('ProcessHistoryWork');assert.equal(events(h).filter(r=>r.fields.event_type==='BOARDING_MARINE_INFILTRATING').length,1);
 ship.exists=false;emit(h,'DESTROYED',{object:ship,param:null,param2:'unknown',param3:false});assert.equal(events(h).at(-1).fields.subject_seed,'9223372036854775807');
});
test('world relations remain context, travel retains null sectors, scans identify both sides',()=>{
 const ship=asset('OUR-001'),other=asset('ARG-002',false),h=setup([ship]);
 emit(h,'FACTION_RELATION_CHANGED',{param:'argon',param2:'xenon',param3:[-1,0,'war']});let f=events(h).at(-1).fields;assert.equal(f.subject_kind,'UNIVERSE');assert.equal(f.scope,'WORLD_CONTEXT');assert.equal(f.new_relation,'-1');assert.equal(f.reason,'war');
 emit(h,'SECTOR_CHANGED',{object:ship,param:null,param2:{__type:'component',exists:true,ref:'sector-old',class:'sector',knownname:'Old sector'}});f=events(h).at(-1).fields;assert.equal(f.other_reference,'null');assert.equal(f.previous_name,'Old sector');
 emit(h,'WAS_SCANNED',{object:ship,param:other,param2:false});assert.equal(events(h).at(-1).fields.other_idcode,'ARG-002');
});
