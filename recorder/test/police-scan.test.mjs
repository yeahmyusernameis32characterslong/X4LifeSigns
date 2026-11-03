import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {generateRecorder} from '../md-generator.mjs';import {profileEvents} from '../profile-event-generator.mjs';import {harness} from './md-harness.mjs';import {parseRecord} from '../log-format.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url)));
const asset=(id,owned=true,kind='ship')=>({__type:'component',ref:id,class:kind,exists:true,isplayerowned:owned,seed:id==='OUR-001'?9223372036854775807n:42n,idcode:id,knownname:id,owner:owned?'player':'argon',sector:{knownname:'Test sector'},commander:null});
function setup(){const ship=asset('OUR-001'),target=asset('OTHER-002',false),h=harness(generateRecorder(config),{ships:[ship],databaseState:'READY'});h.start();h.call('ProcessHistoryWork');return {h,ship,target};}
function emit(h,type,event){const i=profileEvents.findIndex(e=>e.type===type);h.cueVariables('ProfileEventV2_'+i).event=event;h.cue('ProfileEventV2_'+i);}
const events=h=>h.output.filter(x=>x.name.startsWith('profiles-')).map(x=>parseRecord(x.line)).filter(r=>r.kind==='ENTITY_EVENT');
test('police start/result retain scanner, target, scope and exact flags without inventory reads',()=>{
 const {h,ship,target}=setup();for(const obj of [ship,target])for(const p of ['cargo','people','pilot'])Object.defineProperty(obj,p,{get(){throw Error('No inventory/personnel getters');}});
 emit(h,'POLICE_SCAN_OBSERVATION',{object:h.player.galaxy,param2:ship,param3:[target,'STARTED','UNDETERMINED',null,null,null,null,'argon']});
 emit(h,'POLICE_SCAN_OBSERVATION',{object:h.player.galaxy,param2:ship,param3:[target,'RESULT','CARGO_AND_PILOT_INVENTORY',1,0,1,0,'argon']});
 const rows=events(h);assert.equal(rows.length,2);assert.equal(rows[0].fields.event_type,'POLICE_SCAN_STARTED');assert.equal(rows[0].fields.cargo_finding,'NOT_EVALUATED');
 const f=rows[1].fields;assert.equal(f.event_type,'POLICE_SCAN_RESULT');assert.equal(f.subject_seed,'9223372036854775807');assert.equal(f.subject_idcode,'OUR-001');assert.equal(f.other_idcode,'OTHER-002');assert.equal(f.scan_mode,'CARGO_AND_PILOT_INVENTORY');assert.equal(f.cargo_finding,'DETECTED');assert.equal(f.combined_illegal_finding,'NO_DETECTION_REPORTED');assert.equal(f.trouble_flag_before_response,'1');assert.equal(f.inventory_contents_recorded,'false');
 // Distinct outcome observations must not be discarded by combat coalescing.
 emit(h,'POLICE_SCAN_OBSERVATION',{object:h.player.galaxy,param2:ship,param3:[target,'RESULT','CARGO_ONLY',0,0,0,0,'argon']});assert.equal(events(h).length,3);
});
test('malformed packets, non-player police and stale load callbacks produce no event',()=>{
 const {h,ship,target}=setup();for(const payload of [null,[],[target,'UNKNOWN','CARGO_ONLY',0,0,0,0,'argon'],[target,'RESULT','CARGO_ONLY','1',0,0,0,'argon']])emit(h,'POLICE_SCAN_OBSERVATION',{object:h.player.galaxy,param2:ship,param3:payload});
 emit(h,'POLICE_SCAN_OBSERVATION',{object:h.player.galaxy,param2:target,param3:[ship,'RESULT','CARGO_ONLY',0,0,0,0,'argon']});assert.equal(events(h).length,0);
 h.md.$LSPEventsReady=false;emit(h,'POLICE_SCAN_OBSERVATION',{object:h.player.galaxy,param2:ship,param3:[target,'RESULT','CARGO_ONLY',0,0,0,0,'argon']});assert.equal(events(h).length,0);
});
test('sector police response records owned officer as subject and suspect as other, without claiming cause or execution',()=>{
 const {h,ship,target}=setup();emit(h,'POLICE_RESPONSE_REQUESTED',{object:{class:'sector'},param2:target,param3:ship});let f=events(h)[0].fields;assert.equal(f.subject_idcode,'OUR-001');assert.equal(f.other_idcode,'OTHER-002');assert.equal(f.reason,'NOT_PROVIDED_BY_SIGNAL');assert.equal(f.execution,'NOT_ESTABLISHED');
 emit(h,'POLICE_RESPONSE_REQUESTED',{object:{class:'sector'},param2:ship,param3:target});assert.equal(events(h).length,1);
});
test('AI diff adds only two guarded galaxy signals, no scan/state/order mutation',()=>{
 const diff=fs.readFileSync(new URL('../../extensions/lifesigns_event_recorder/aiscripts/order.move.recon.xml',import.meta.url),'utf8');
 assert.equal((diff.match(/<add /g)||[]).length,2);assert.equal((diff.match(/<signal_objects /g)||[]).length,2);assert(!/<(?:set_value|remove_value|run_script|create_order|replace|remove)\b/.test(diff));assert.equal((diff.match(/isplayerowned/g)||[]).length,3);assert.equal((diff.match(/object="player.galaxy"/g)||[]).length,2);
});
