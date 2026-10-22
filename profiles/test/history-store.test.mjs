import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProfileStore} from '../store.mjs';
const id='lsu1-2026-10-22_12-00-00-1-2-3-4',A='session-1-2-loaded-2026-10-22_12-00-00',B='session-3-4-loaded-2026-10-22_12-01-00';
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-history-'));const stores=[];t.after(()=>{stores.forEach(s=>s.close());assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});});return run=>{const s=new ProfileStore(root,id,run);stores.push(s);return s;};}
const row=(run,n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'0',age:String(n),kind,fields:{record:String(n),...fields}});
const start=(run=A,parent='NONE',record='0')=>row(run,1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:id,parent_run:parent,parent_record:record});
test('new history scope values retain schema-v1 compatibility and exact raw payload',t=>{
 const open=fixture(t),s=open(A);s.ingest([start(),row(A,2,'SNAPSHOT_BEGIN'),row(A,3,'SNAPSHOT_END',{profiles:'0'})]);
 s.ingest([row(A,4,'ENTITY_EVENT',{event_type:'FACTION_RELATION_CHANGED',subject_kind:'UNIVERSE',subject_seed:id,scope:'WORLD_CONTEXT',related_faction:'argon'}),row(A,5,'ENTITY_EVENT',{event_type:'DESTROYED',subject_kind:'ASSET',subject_reference:'expired-ref',identity_state:'UNKNOWN'})]);
 assert.equal(s.db.prepare('PRAGMA user_version').get().user_version,1);assert.equal(s.eventsAt()[0].fields.related_faction,'argon');s.close();
 const b=open(B);b.ingest([start(B,A,'5')]);assert.equal(b.eventsAt().length,2);assert.equal(b.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});

test('NPC histories separate requests, service and presence; correlate outsider outcomes without invented intent',t=>{
 const open=fixture(t),s=open(A);let n=1;const input=[start(),row(A,++n,'SNAPSHOT_BEGIN')];
 const profile=(kind,number,fields)=>{input.push(row(A,++n,'PROFILE_BEGIN',{kind,profile:number}));for(const [field,value] of Object.entries(fields))input.push(row(A,++n,'VALUE',{profile:number,field,value,state:'PRESENT',type:'datatype.string'}));input.push(row(A,++n,'PROFILE_END',{profile:number,partial:'0'}));};
 profile('SHIP','1',{seed:'101',idcode:'OLD-001',reference:'ref-old',name:'Old ship'});
 profile('SHIP','2',{seed:'202',idcode:'NEW-002',reference:'ref-new',name:'New ship'});
 profile('NPC','3',{seed:'9223372036854775807',name:'Synthetic captain',assigned_ship_idcode:'OLD-001',container_reference:'ref-old',controlpost_name:'Captain',assignment_basis:'ACTOR_ROLE_OR_CONTROL_RELATIONSHIP'});
 input.push(row(A,++n,'SNAPSHOT_END',{profiles:'3'}));s.ingest(input);
 const ev=(type,kind,seed,fields={})=>s.ingest([row(A,++n,'ENTITY_EVENT',{event_type:type,subject_kind:kind,subject_seed:seed,...fields})]);
 ev('ATTACKED','SHIP','101',{other_seed:'303'});const contact=n;
 ev('ASSIGNMENT_REQUESTED','NPC','9223372036854775807',{other_seed:'202',requested_role:'Captain'});
 ev('ORDER_READY','SHIP','202');const premature=n;
 ev('ORDER_READY','SHIP','101');const stillAssigned=n;
 ev('ASSIGNMENT_OBSERVED','NPC','9223372036854775807',{assigned_seed:'202',assigned_idcode:'NEW-002',assignment_basis:'ACTOR_ROLE_OR_CONTROL_OBSERVED',actual_role:'Captain'});
 ev('ORDER_READY','SHIP','202');const newDuty=n;
 ev('RELATED_OBJECT_DESTROYED','SHIP','303',{other_seed:'404'});const outcome=n;
 ev('ENTITY_ENTERED','NPC','9223372036854775807',{location_seed:'202',location_idcode:'NEW-002',location_basis:'ACTOR_CONTAINER_OBSERVED'});
 ev('ORDER_RUNNING_OBSERVED','SHIP','202');const present=n;
 ev('FACTION_RELATION_CHANGED','UNIVERSE',id,{scope:'WORLD_CONTEXT'});
 const h=s.historyForNpc('9223372036854775807');const at=i=>h.observations.find(e=>e.record_id===i);
 assert.equal(at(premature),undefined);assert.equal(at(stillAssigned).relationship,'LAST_OBSERVED_PRESENT_ON_RELATED_ASSET');
 assert.equal(at(newDuty).relationship,'ASSIGNED_TO_RELATED_ASSET');assert.equal(at(present).relationship,'LAST_OBSERVED_PRESENT_ON_RELATED_ASSET');
 assert.equal(at(outcome).relationship,'DERIVED_RELATED_CONTACT_OUTCOME');assert.equal(at(outcome).related_contact.record_id,contact);assert.equal(at(outcome).intent,'UNKNOWN');
 assert.equal(h.observations.some(e=>e.subject_kind==='UNIVERSE'),false);assert.ok(s.historyForNpc('9223372036854775807',{includeWorld:true}).observations.some(e=>e.subject_kind==='UNIVERSE'));
 assert.equal(s.historyForNpc('9223372036854775807',{record:contact}).observations.at(-1).record_id,contact);
 assert.throws(()=>s.historyForNpc(9223372036854775807),/exact integer text/);
 s.close();const b=open(B);b.ingest([start(B,A,String(contact))]);const inherited=b.historyForNpc('9223372036854775807');assert.equal(inherited.service_observations.at(-1).assignment.seed,'101');assert.equal(inherited.observations.some(e=>e.record_id===newDuty&&e.run_id===A),false);
});
