import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateRecorder} from '../md-generator.mjs';
import {profileEvents} from '../profile-event-generator.mjs';
import {harness} from './md-harness.mjs';
import {parseRecord} from '../log-format.mjs';
import {ProfileStore} from '../../profiles/store.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url)));
const xml=generateRecorder(config);
const asset=(ref,owned=true,klass='ship')=>({__type:'component',ref,class:klass,exists:true,isplayerowned:owned,seed:BigInt(ref.replace(/\D/g,'')||1),idcode:ref,knownname:ref,owner:owned?'player':'argon',trueowner:owned?'player':'argon',sector:{knownname:'Sector'}});
const setup=(ships=[],stations=[])=>{const h=harness(xml,{ships,stations,databaseState:'READY'});h.start();return h;};
const rows=h=>h.output.filter(x=>x.name.startsWith('profiles-')).map(x=>parseRecord(x.line));
const events=h=>rows(h).filter(r=>r.kind==='ENTITY_EVENT');
function emit(h,type,event){const i=profileEvents.findIndex(e=>e.type===type);assert.ok(i>=0,type);h.cueVariables('ProfileEventV2_'+i).event=event;h.cue('ProfileEventV2_'+i);}

test('native incoming/outgoing payload shapes preserve mechanism and guarded command/order targets',()=>{
 const own=asset('OUR-1'),other=asset('ARG-2',false),part=asset('PART-3',false,'engine'),weapon=asset('WEAPON-4',true,'weapon');weapon.macro={text:'macro | %'};
 own.aipilot={...asset('PILOT-5',true,'npc'),command:{value:'attackobject',param:other}};
 own.order={__type:'order',exists:true,id:'Attack',state:'started',$primarytarget:other,$internalorder:true};
 own.mayattack=new Map([[other,true]]);other.mayattack=new Map([[own,false]]);
 const h=setup([own]);emit(h,'ATTACKING',{object:own,param:other,param2:'hitbybullet',param3:[part,weapon]});
 let f=events(h).at(-1).fields;
 assert.equal(f.method,'hitbybullet');assert.equal(f.component_reference,'PART-3');assert.equal(f.weapon_macro,'macro | %');
 assert.equal(f.subject_command_target_seed,'2');assert.equal(f.subject_order_target_idcode,'ARG-2');assert.equal(f.subject_order_internal,'true');
 assert.equal(f.subject_may_attack_other,'true');assert.equal(f.other_may_attack_subject,'false');assert.equal(f.intent,'UNKNOWN');
 emit(h,'ATTACKED',{object:own,param:other,param2:'collided',param3:part});f=events(h).at(-1).fields;
 assert.equal(f.method,'collided');assert.equal(f.component_reference,'PART-3');assert.equal(f.weapon_reference,'null');
});

test('repeated contacts gate all extra command and weapon reads; missing stations/player controllers are honest',()=>{
 const own=asset('OUR-1'),other=asset('ARG-2',false),h=setup([own]);let reads=0;
 Object.defineProperty(own,'aipilot',{get(){reads++;return null;}});
 for(let i=0;i<200;i++)emit(h,'ATTACKED',{object:own,param:other});
 assert.equal(reads,1);assert.equal(events(h).length,1);
 h.player.occupiedship=own;h.player.age+=31;emit(h,'ATTACKED',{object:own,param:other});
 assert.equal(events(h).at(-1).fields.subject_controller_state,'PLAYER');assert.equal(reads,1);
 const station=asset('STA-6',true,'station');Object.defineProperty(station,'aipilot',{get(){throw Error('Station has no pilot');}});
 emit(h,'ATTACKED',{object:station,param:other});assert.equal(events(h).at(-1).fields.subject_controller_state,'UNAVAILABLE');
});

test('distress swaps participants only when required; unrelated calls and pre-ready callbacks do no work',()=>{
 const own=asset('OUR-1'),other=asset('ARG-2',false),foreign=asset('EXT-3',false),h=setup([own]);
 emit(h,'DISTRESS_CALL',{param2:other,param3:foreign});assert.equal(events(h).length,0);
 emit(h,'DISTRESS_CALL',{param2:own,param3:other});assert.equal(events(h).at(-1).fields.subject_idcode,'OUR-1');
 h.player.age+=31;emit(h,'DISTRESS_CALL',{param2:other,param3:own});const f=events(h).at(-1).fields;
 assert.equal(f.subject_idcode,'OUR-1');assert.equal(f.other_idcode,'ARG-2');assert.equal(f.participant_role,'ATTACKER_IN_DISTRESS_REPORT');
 h.md.$LSPEventsReady=false;const count=h.output.length;emit(h,'DISTRESS_CALL',{param2:own,param3:other});assert.equal(h.output.length,count);
});

test('new observations have shared burst bound with persisted loss notice, without blocking original combat',()=>{
 const own=asset('OUR-1'),h=setup([own]);
 for(let i=1;i<=80;i++)emit(h,'INCOMING_MISSILE',{object:own,param:null,param2:asset('MISSILE-'+i,false,'missile'),param3:asset('ARG-'+(i+100),false)});
 assert.equal(events(h).filter(r=>r.fields.event_type==='INCOMING_MISSILE').length,32);
 assert.equal(events(h).filter(r=>r.fields.event_type==='COMBAT_CONTEXT_LIMIT').length,1);
 emit(h,'ATTACKED',{object:own,param:asset('ARG-999',false)});assert.equal(events(h).at(-1).fields.event_type,'ATTACKED');
 h.player.age+=1.1;emit(h,'INCOMING_MISSILE',{object:own,param3:asset('ARG-200',false)});assert.equal(events(h).at(-1).fields.event_type,'INCOMING_MISSILE');
 const ordinals=rows(h).map(x=>Number(x.fields.record));assert.deepEqual(ordinals,ordinals.map((_,i)=>i+1));
});

test('missile target components resolve enclosing profile; relation ranges remain observations not aggression verdicts',()=>{
 const own=asset('OUR-1'),other=asset('ARG-2',false),part={...asset('ENG-3',false,'engine'),defensible:other},h=setup([own]);
 emit(h,'MISSILE_LAUNCHED',{object:own,param:part,param2:asset('M-4',true,'missile')});
 assert.equal(events(h).at(-1).fields.other_seed,'2');assert.equal(events(h).at(-1).fields.component_reference,'ENG-3');
 own.relationto=new Map([['argon',-.2]]);emit(h,'LOCAL_RELATION_RANGE_CHANGED',{object:own,param:'argon'});
 const f=events(h).at(-1).fields;assert.equal(f.faction,'argon');assert.equal(f.current_relation,'-0.2');assert.equal(f.intent,'UNKNOWN');
});

test('ready/running order observations preserve actual order even if current order changes; absent flag is not player attribution',()=>{
 const own=asset('OUR-1'),target=asset('ARG-2',false),h=setup([own]);
 const order={__type:'order',exists:true,isrunning:true,id:'Flee',name:'Flee',state:'started',$attacker:target,$method:'boost'};
 emit(h,'ORDER_READY',{object:own,param:order});let f=events(h).at(-1).fields;
 assert.equal(f.flee_attacker_seed,'2');assert.equal(f.flee_method,'boost');assert.equal(f.order_internal,'null');
 own.order={__type:'order',exists:true,id:'Wait'};h.player.age+=1.1;h.call('ProcessOrderObservations');f=events(h).at(-1).fields;
 assert.equal(f.event_type,'ORDER_RUNNING_OBSERVED');assert.equal(f.order_id,'Flee');assert.equal(f.flee_attacker_idcode,'ARG-2');assert.equal(f.order_issuer,undefined);
});

test('lock registration is bounded and native selectors use individual objects; raw ambiguous direction is preserved',()=>{
 const h=setup();for(let i=1;i<=100;i++)h.call('EnrolCombatLockWatch',{Object:asset('OUR-'+i)});
 assert.equal(h.md.$LSPCombatLockKeys.size,64);
 const own=asset('OUR-1'),other=asset('ARG-2',false);
 h.cueVariables('CombatLockWatch').$LockObject=own;
 h.cueVariables('CombatLock_initiated_target').event={object:other,param:own,param2:null,param3:null};
 h.cue('CombatLock_initiated_target');const f=events(h).at(-1).fields;
 assert.equal(f.subject_idcode,'OUR-1');assert.equal(f.watch_role,'TARGET');assert.equal(f.native_object_reference,'ARG-2');assert.equal(f.counterparty_resolution,'UNVERIFIED');assert.equal(f.other_seed,'');
 const walk=n=>[n,...n.children.flatMap(walk)];const hooks=walk(h.tree).filter(n=>/^event_lock_/.test(n.tag));
 assert.equal(hooks.length,4);assert.ok(hooks.every(n=>!n.attrs.group&&Object.values(n.attrs).includes('parent.$LockObject')));
 h.cue('InvalidateLoadedRecorder');const count=h.output.length;h.cue('CombatLock_initiated_target');assert.equal(h.output.length,count);
});

test('generated context events survive unchanged SQLite ingestion and saved-branch reopen',t=>{
 const own=asset('OUR-1'),h=setup([own]);emit(h,'DISTRESS_CALL',{param2:own,param3:asset('ARG-2',false)});
 const input=rows(h),begin=input[0],root=fs.mkdtempSync(path.join(os.tmpdir(),'ls-combat-'));const stores=[];
 t.after(()=>{stores.forEach(s=>s.close());fs.rmSync(root,{recursive:true});});
 const store=new ProfileStore(root,begin.fields.lifesigns_universe_id,begin.run);stores.push(store);store.ingest(input);
 const saved=store.eventsAt().at(-1);assert.equal(saved.fields.intent,'UNKNOWN');assert.equal(saved.event_type,'DISTRESS_CALL');
 store.close();const reopened=new ProfileStore(root,begin.fields.lifesigns_universe_id,begin.run);stores.push(reopened);
 assert.equal(reopened.eventsAt().at(-1).fields.participant_role,saved.fields.participant_role);assert.equal(reopened.db.prepare('PRAGMA user_version').get().user_version,1);
});
