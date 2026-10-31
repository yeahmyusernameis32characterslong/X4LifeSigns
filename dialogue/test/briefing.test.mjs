import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {makeFixture,A,B,CAPTAIN,MANAGER,FOREIGN} from './fixture.mjs';
import {DialogueReader} from '../retrieval.mjs';import {BriefingReader,renderBriefing} from '../briefing.mjs';import {runDialogue} from '../model-session.mjs';
function setup(t,grant={},options={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-briefing-')),f=makeFixture(dir),reader=new DialogueReader(f.binding,{npcSeed:CAPTAIN,run:A,record:f.record,access:'command',...grant}),b=new BriefingReader(reader,options);t.after(()=>{reader.close();assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true});});return{f,reader,b};}
test('identity bundles current person and permitted posting without old role or assignment confusion',t=>{
 const {b}=setup(t),identity=b.call('recall',{view:'identity'}).result.identity;assert.equal(identity.person.name,'Iris Vale');assert.equal(identity.person.seed,CAPTAIN);assert.equal(identity.person.currentRole,'Marine');assert.equal(identity.person.currentAssignment.idcode,'SYN-202');assert.equal(identity.posting.available,false);assert(!JSON.stringify(identity).includes('Captain'));
 const captain=setup(t,{record:53}).b.call('recall',{view:'identity'}).result.identity;assert.equal(captain.posting.name,'Lark');assert.equal(captain.person.currentRole,'Captain');
});
test('plain evidence cards preserve record refs and structured selection dispatches actual model arguments',async t=>{
 const {reader,b}=setup(t,{record:53});const text=renderBriefing(b.call('recall',{view:'incident',text:'Needle'}).result);assert(text.includes('[R1:52]'));assert(text.includes('order Attack, state ready'));assert(text.includes('does not record survival'));let n=0;
 const chat=async input=>{if(++n===1){assert.equal(input.format.type,'object');assert.equal(input.tools,undefined);return{message:{role:'assistant',content:JSON.stringify({view:'incident',text:'Needle'})}};}assert(input.messages.at(-1).content.includes('[R1:52]'));return{message:{role:'assistant',content:'The ready Attack order is recorded [R1:52].'}};};
 const out=await runDialogue({reader,chat,presentation:'briefing',selection:'structured',encoding:'text',question:'Needle?'});assert.equal(out.status,'ANSWER');assert.equal(out.metrics.toolCalls,1);assert.equal(out.trace.find(x=>x.kind==='tool').request.arguments.text,'Needle');assert(out.trace.some(x=>x.kind==='structured_tool_selection'));assert(out.metrics.toolContentBytes>0);
 const bad=await runDialogue({reader,chat:async()=>({message:{role:'assistant',content:'not json'}}),presentation:'briefing',selection:'structured',encoding:'text',question:'Needle?'});assert.equal(bad.status,'INCOMPLETE');
});
test('incident presentation includes nearby orders without reversing contact or granting counterpart outcomes',t=>{
 const {b}=setup(t,{record:53}),result=b.call('recall',{view:'incident',text:'Needle'}).result;assert.deepEqual(result.records.map(e=>e.ref),['R1:50','R1:51','R1:52','R1:53']);assert(result.records[0].fact.includes('received contact from Needle'));assert(result.records[2].fact.includes('order Attack, state ready'));assert(result.records[3].fact.includes('does not establish'));assert(result.coverage.completeForSelection);assert(!JSON.stringify(result).includes('R1:54'));
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
