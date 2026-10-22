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
