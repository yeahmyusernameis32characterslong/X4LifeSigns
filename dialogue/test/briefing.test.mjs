import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {makeFixture,A,B,CAPTAIN,MANAGER,FOREIGN} from './fixture.mjs';
import {DialogueReader} from '../retrieval.mjs';import {BriefingReader,renderBriefing} from '../briefing.mjs';import {runDialogue} from '../model-session.mjs';
import {evidenceFacts,evidenceSequence} from '../evidence-facts.mjs';
function setup(t,grant={},options={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-briefing-')),f=makeFixture(dir),reader=new DialogueReader(f.binding,{npcSeed:CAPTAIN,run:A,record:f.record,access:'command',...grant}),b=new BriefingReader(reader,options);t.after(()=>{reader.close();assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true});});return{f,reader,b};}

test('resolved roles distinguish received contact, target destruction, docking destination and assignment',t=>{
 const {b}=setup(t);const incident=b.call('recall',{view:'incident',text:'Needle'}).result;
 assert.equal(incident.records[0].evidence.roles.recipient.idcode,'SYN-101');
 assert.equal(incident.records[0].evidence.roles.source.idcode,'SYN-701');
 assert.equal(incident.records[1].evidence.roles.target.name,'Needle');
 assert.equal(incident.records[3].evidence.roles.destroyedObject.name,'Needle');
 assert.equal(incident.records[3].evidence.roles.creditedAsset.name,'Lark');
 assert(incident.records[2].evidence.notEstablished.includes('active execution from ready state alone'));
 assert(incident.records[0].evidence.notEstablished.includes('deliberate hostility'));
 const service=b.call('recall',{view:'service'}).result;
 assert.equal(service.records[0].ref,'R1:57');assert.equal(service.records[0].evidence.roles.assignment.idcode,'SYN-202');
 const dock=service.records.find(r=>r.type==='DOCKED');
 assert.equal(dock.evidence.roles.dockingAsset.name,'Kite');assert.equal(dock.evidence.roles.destination.name,'Orchard');
 assert(dock.evidence.notEstablished.includes('new assignment'));
 const unknown=evidenceFacts({event_type:'DOCKED',subject_seed:'9',fields:{}});assert.equal(unknown.roles.destination.seed,null);
 assert.equal(evidenceFacts({event_type:'NEW_UNVERIFIED_TYPE',fields:{}}).predicate,'UNINTERPRETED_RECORD');
});

test('chronology preserves branch order and never converts matching names or proximity into causation',t=>{
 const {b}=setup(t,{run:B,record:2}),r=b.call('recall',{view:'incident',text:'Orchard'}).result;
 assert.equal(r.records.at(-1).ref,'R2:2');
 const rows=[{ref:'R1:9',gameTime:'55',subject:{name:'Same',seed:'1',idcode:'AAA'},other:{}},{ref:'R2:2',gameTime:'2',subject:{name:'Same',seed:'2',idcode:'AAA'},other:{}}];
 const seq=evidenceSequence(rows);assert.equal(seq[1].relationToPrevious.clockMovedBackwards,true);
 assert.equal(seq[1].relationToPrevious.sameRecordedSubject,false);assert.equal(seq[1].relationToPrevious.sameRecordedCounterpart,null);
 assert.equal(seq[1].relationToPrevious.causation,'NOT_ESTABLISHED');
 assert.deepEqual(r.sequence.map(s=>s.ref),r.records.map(e=>e.ref));
});

test('host window filters records, nearby context, topics and totals without widening role access',t=>{
 const {b}=setup(t,{}, {focus:{run:'R1',from:50,to:51}});
 const incident=b.call('recall',{view:'incident',text:'Needle'}).result;
 assert.deepEqual(incident.records.map(r=>r.ref),['R1:50','R1:51']);assert(!renderBriefing(incident).includes('R1:52'));
 assert.equal(b.call('recall',{view:'combat'}).result.combatTotals.totalObservations,2);
 assert.equal(b.call('recall',{view:'service'}).result.records.length,0);
 assert(!b.selectionActions('Kite').includes('incident:Kite'));
 const empty=setup(t,{}, {focus:{run:'R1',from:58,to:58}}).b.call('recall',{view:'combat'}).result;
 assert.equal(empty.combatTotals.totalObservations,0);assert(!JSON.stringify(empty).includes('UNKNOWN_ROLE_SECRET'));
 assert.throws(()=>new BriefingReader(b.reader,{focus:{run:'R99'}}),/FOCUS_RUN/);
 assert.throws(()=>new BriefingReader(b.reader,{focus:{run:'R1',from:55,to:50}}),/FOCUS_TIME/);
 assert.throws(()=>new BriefingReader(b.reader,{focus:{run:'R1',from:NaN}}),/FOCUS_TIME/);
});

test('history windows bind conversation reuse and cannot be overridden by model arguments',async t=>{
 const {reader}=setup(t);let n=0;const chat=async()=>++n===1?{message:{role:'assistant',tool_calls:[{function:{name:'recall',arguments:{view:'incident',text:'Needle'}}}]}}:{message:{role:'assistant',content:'Contact received [R1:50].'}};
 const focus={run:'R1',from:50,to:51};const out=await runDialogue({reader,chat,presentation:'briefing',focus,question:'Needle?'});
 assert.equal(out.status,'ANSWER');assert.deepEqual(out.trace.find(x=>x.kind==='tool').result.records.map(r=>r.ref),['R1:50','R1:51']);
 await assert.rejects(runDialogue({reader,chat,presentation:'briefing',focus:{run:'R1',from:50,to:53},conversation:out.conversation,question:'Again?'}),/FOREIGN_CONVERSATION/);
 await assert.rejects(runDialogue({reader,chat,presentation:'briefing',focus:{...focus,extra:'bad'},question:'Again?'}),/ARGUMENTS/);
 const narrow=new BriefingReader(reader,{focus});assert.throws(()=>narrow.call('recall',{view:'combat',from:0}),/ARGUMENTS/);
});
test('identity bundles current person and permitted posting without old role or assignment confusion',t=>{
 const {b}=setup(t),identity=b.call('recall',{view:'identity'}).result.identity;assert.equal(identity.person.name,'Iris Vale');assert.equal(identity.person.seed,CAPTAIN);assert.equal(identity.person.currentRole,'Marine');assert.equal(identity.person.currentAssignment.idcode,'SYN-202');assert.equal(identity.posting.available,false);assert(!JSON.stringify(identity).includes('Captain'));
 const captain=setup(t,{record:53}).b.call('recall',{view:'identity'}).result.identity;assert.equal(captain.posting.name,'Lark');assert.equal(captain.person.currentRole,'Captain');
});
test('plain evidence cards preserve record refs and structured selection dispatches actual model arguments',async t=>{
 const {reader,b}=setup(t,{record:53});const text=renderBriefing(b.call('recall',{view:'incident',text:'Needle'}).result);assert(text.includes('[R1:52]'));assert(text.includes('order Attack, state ready'));assert(text.includes('does not record survival'));let n=0;
 const chat=async input=>{if(++n===1){assert.equal(input.format.type,'object');assert.equal(input.format.properties.after,undefined);assert.equal(input.tools,undefined);return{message:{role:'assistant',content:JSON.stringify({view:'incident:Needle'})}};}assert(input.messages.at(-1).content.includes('[R1:52]'));return{message:{role:'assistant',content:'The ready Attack order is recorded [R1:52].'}};};
 const out=await runDialogue({reader,chat,presentation:'briefing',selection:'structured',encoding:'text',question:'Needle?'});assert.equal(out.status,'ANSWER');assert.equal(out.metrics.toolCalls,1);assert.equal(out.trace.find(x=>x.kind==='tool').request.arguments.text,'Needle');assert(out.trace.some(x=>x.kind==='structured_tool_selection'));assert(out.metrics.toolContentBytes>0);
 const bad=await runDialogue({reader,chat:async()=>({message:{role:'assistant',content:'not json'}}),presentation:'briefing',selection:'structured',encoding:'text',question:'Needle?'});assert.equal(bad.status,'INCOMPLETE');
 const invalid=await runDialogue({reader,chat:async()=>({message:{role:'assistant',content:JSON.stringify({view:'identity',after:'invented'})}}),presentation:'briefing',selection:'structured',encoding:'text',question:'Who?'});assert.equal(invalid.status,'INCOMPLETE');assert.equal(invalid.metrics.modelCalls,1);
 const loop=await runDialogue({reader,chat:async()=>({message:{role:'assistant',tool_calls:[{function:{name:'recall',arguments:{view:'identity',after:'invented'}}}]}}),presentation:'briefing',encoding:'text',question:'Who?'});assert.equal(loop.status,'INCOMPLETE');assert.equal(loop.metrics.modelCalls,2);assert.equal(loop.trace.at(-1).reason,'REPEATED_INVALID_TOOL_REQUEST');
});
test('incident presentation includes nearby orders without reversing contact or granting counterpart outcomes',t=>{
 const {b}=setup(t,{record:53}),result=b.call('recall',{view:'incident',text:'Needle'}).result;assert.deepEqual(result.records.map(e=>e.ref),['R1:50','R1:51','R1:52','R1:53']);assert(result.records[0].fact.includes('received contact from Needle'));assert(result.records[2].fact.includes('order Attack, state ready'));assert(result.records[3].fact.includes('destroyed object in this record is Needle'));assert(result.coverage.completeForSelection);assert(!JSON.stringify(result).includes('R1:54'));
 const station=setup(t,{npcSeed:MANAGER}).b.call('recall',{view:'incident',text:'Needle'}).result;assert.deepEqual(station.records.map(e=>e.type),['ATTACKED']);assert.equal(station.identity.posting.name,'Orchard');
});
test('service bundle and bound pages preserve every allowed transition and latest role',t=>{
 const {b}=setup(t,{}, {pageSize:2});let p=b.call('recall',{view:'service'}).result,rows=[...p.records];assert.equal(p.identity.person.currentRole,'Marine');assert.equal(p.coverage.selectedRecords,5);assert.equal(p.coverage.completeForSelection,false);
 const foreign=setup(t,{npcSeed:FOREIGN}).b;assert.throws(()=>foreign.call('recall',{view:'service',after:p.coverage.next}),/FOREIGN_CURSOR/);assert.throws(()=>b.call('recall',{view:'combat',after:p.coverage.next}),/FOREIGN_CURSOR/);
 while(p.coverage.next){p=b.call('recall',{view:'service',after:p.coverage.next}).result;rows.push(...p.records);}assert.deepEqual(rows.map(e=>e.ref),['R1:57','R1:59','R1:60','R1:62','R1:64']);
});
test('latest means latest in selected ancestry, summaries remain scoped and arguments cannot widen access',t=>{
 const {b}=setup(t,{run:B,record:2});assert.equal(b.call('recall',{view:'latest'}).result.records.at(-1).ref,'R2:2');
 assert.throws(()=>b.call('recall',{view:'identity',npcSeed:MANAGER}),/ARGUMENTS/);assert.throws(()=>b.call('recall',{view:'incident'}),/TEXT_REQUIRED/);assert.throws(()=>b.call('exec',{}),/UNKNOWN_TOOL/);
 const crew=setup(t,{npcSeed:FOREIGN}).b.call('recall',{view:'combat'}).result;assert.equal(crew.combatTotals.totalObservations,0);assert.equal(crew.records.length,0);
});
test('briefing adapter dispatches the model chosen bundle and prevents cross-presentation conversation reuse',async t=>{
 const {reader}=setup(t);let n=0;const chat=async input=>{assert.equal(input.tools.length,1);return ++n===1?{message:{role:'assistant',tool_calls:[{function:{name:'recall',arguments:{view:'identity'}}}]}}:{message:{role:'assistant',content:'I am Iris Vale, currently Marine (R1:64).'}};};
 const out=await runDialogue({reader,chat,presentation:'briefing',question:'Who are you?'});assert.equal(out.status,'ANSWER');assert.equal(out.metrics.toolCalls,1);assert.equal(out.trace[1].result.identity.person.currentRole,'Marine');assert.equal(out.conversation.presentation,'briefing');await assert.rejects(runDialogue({reader,chat,question:'Again?',conversation:out.conversation}),/FOREIGN_CONVERSATION/);
});
test('briefing repairs missing refs and refuses invented/unretrieved refs without treating citation as truth',async t=>{
 const {reader}=setup(t);let n=0;const chat=async()=>++n===1?{message:{role:'assistant',tool_calls:[{function:{name:'recall',arguments:{view:'identity'}}}]}}:{message:{role:'assistant',content:n===2?'I am Iris Vale.':'I am Iris Vale [R1:34].'}};
 const out=await runDialogue({reader,chat,presentation:'briefing',question:'Who?'});assert.equal(out.status,'ANSWER');assert.equal(out.metrics.modelCalls,3);assert(out.trace.some(x=>x.reason==='MISSING_RECORD_REFS'));
 n=0;const refusal=await runDialogue({reader,chat:async()=>++n===1?{message:{role:'assistant',tool_calls:[{function:{name:'recall',arguments:{view:'identity'}}}]}}:{message:{role:'assistant',content:'An invented event [R9:999].'}},presentation:'briefing',question:'Who?'});assert.equal(refusal.status,'INCOMPLETE');assert(refusal.trace.some(x=>x.reason==='UNRETRIEVED_RECORD_REF'));
});
