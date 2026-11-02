import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {makeFixture,A,B,CAPTAIN,FOREIGN} from '../../dialogue/test/fixture.mjs';
import {DialogueReader} from '../../dialogue/retrieval.mjs';
import {DialogueHost} from '../dialogue-host.mjs';
import {Player2Client} from '../client.mjs';

function setup(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-player2-')),f=makeFixture(dir),readers=[];t.after(()=>{for(const r of readers)r.close();fs.rmSync(dir,{recursive:true});});return {f,reader:(run=A,record=f.record,npcSeed=CAPTAIN)=>{const r=new DialogueReader(f.binding,{npcSeed,run,record,access:'command'});readers.push(r);return r;}};}
test('caller-owned turns carry scoped sourced evidence and never earlier generated conversations',async t=>{
 const {reader}=setup(t),inputs=[];const client={complete:async input=>{inputs.push(input);return {text:'Kite docked at Orchard [R1:60].',metrics:{}};}};
 const host=new DialogueHost({reader:reader(),client});const r=await host.ask({question:'Where did the ship dock?',selection:{view:'service'}});
 assert.equal(r.status,'GENERATED_UNVERIFIED');assert.equal(r.speaker,'Iris Vale');assert.deepEqual(r.evidenceRefs,['R1:60']);
 assert(!JSON.stringify(inputs[0].messages).includes('FOREIGN_SECRET'));assert(!JSON.stringify(inputs[0].messages).includes('REMOVED_ROLE_SECRET'));
 await host.ask({question:'Again?',selection:{view:'service'}});assert.equal(inputs[1].messages.length,2);assert(!inputs[1].messages.some(m=>m.role==='assistant'));
 assert(inputs[0].messages[1].content.includes('dockingAsset=Kite; destination=Orchard'));
});
test('earlier saved branch reconstruction removes later personnel state and any future dialogue',async t=>{
 const {reader}=setup(t),inputs=[];const client={complete:async input=>{inputs.push(input);return {text:inputs.length===1?'My latest role is Marine [R1:64].':'Lark docked at Orchard [R2:2].',metrics:{}};}};
 const host=new DialogueHost({reader:reader(),client});await host.ask({question:'Latest?',selection:{view:'service'}});
 host.switchReader(reader(B,2));const out=await host.ask({question:'Latest?',selection:{view:'latest'}});
 const rebuilt=JSON.stringify(inputs[1].messages);assert(!rebuilt.includes('R1:57'));assert(!rebuilt.includes('R1:64'));assert(!rebuilt.includes('Marine'));assert(rebuilt.includes('R2:2'));assert.equal(out.epoch,2);
});
test('rollback cancels requests and rejects late outputs even if a provider ignores cancellation',async t=>{
 const {reader}=setup(t);let complete;const client={complete:()=>new Promise(r=>{complete=r;})};const host=new DialogueHost({reader:reader(),client});
 const old=host.ask({question:'Latest?',selection:{view:'service'}});host.switchReader(reader(B,2));complete({text:'Marine [R1:64].',metrics:{}});await assert.rejects(old,/STALE_DIALOGUE/);
 assert.equal(host.pending.size,0);host.close();await assert.rejects(host.ask({question:'Again?'}),/HOST_CLOSED/);
});
test('unknown periods, foreign refs, unknown roles and hostile selection arguments cannot expand knowledge',async t=>{
 const {reader}=setup(t);let n=0;const client={complete:async()=>{n++;return {text:'Secret event [R9:999].',metrics:{}};}};
 const host=new DialogueHost({reader:reader(),client});await assert.rejects(host.ask({question:'Yesterday?',requireFocus:true}),/HISTORY_WINDOW_REQUIRED/);assert.equal(n,0);
 await assert.rejects(host.ask({question:'Tell me.',selection:{view:'identity'}}),/UNGROUNDED_REFERENCE/);
 await assert.rejects(host.ask({question:'Tell me.',selection:{view:'identity',npcSeed:FOREIGN}}),/ARGUMENTS/);
 const innocent={complete:async input=>{assert(!JSON.stringify(input.messages).includes('Lark received contact'));return {text:'My profile [R1:48].',metrics:{}};}};
 const crew=new DialogueHost({reader:reader(A,65,FOREIGN),client:innocent});await crew.ask({question:'Combat?',selection:{view:'combat'}});
});
test('API adapter accepts installed OpenAI-shaped JSON and streamed chunks, rejects tools and incomplete output',async()=>{
 const seen=[];const fetchImpl=async(url,request)=>{seen.push(JSON.parse(request.body));return new Response('data: {"choices":[{"index":0,"delta":{"content":"Hello "},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"delta":{"content":"there"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};
 const client=new Player2Client({endpoint:'http://127.0.0.1:4315',fetchImpl});const r=await client.complete({messages:[{role:'user',content:'Hi'}]});assert.equal(r.text,'Hello there');assert.equal(seen[0].stream,true);assert.equal(seen[0].model,undefined);assert(r.metrics.firstTextMs>=0);
 const bad=new Player2Client({endpoint:'http://127.0.0.1:4315',fetchImpl:async()=>Response.json({choices:[{message:{content:'partial'},finish_reason:'length'}]})});await assert.rejects(bad.complete({messages:[{role:'user',content:'Hi'}]}),/OUTPUT_INCOMPLETE/);
 const tools=new Player2Client({endpoint:'http://127.0.0.1:4315',fetchImpl:async()=>Response.json({choices:[{message:{tool_calls:[{}]},finish_reason:'tool_calls'}]})});await assert.rejects(tools.complete({messages:[{role:'user',content:'Hi'}]}),/UNEXPECTED_TOOL_CALL/);
});
test('read-only health retries are bounded and abortable; generation retry behaviour stays separate',async()=>{
 let attempts=0;const client=new Player2Client({endpoint:'http://127.0.0.1:4315',fetchImpl:async()=>++attempts<2?new Response('',{status:503}):Response.json({client_version:'mock'})});
 assert.equal((await client.health({backoffMs:0})).client_version,'mock');assert.equal(attempts,2);
 attempts=0;const controller=new AbortController();client.transport.fetchImpl=async()=>{attempts++;controller.abort();return new Response('',{status:503});};
 await assert.rejects(client.health({signal:controller.signal}),/CANCELLED/);assert.equal(attempts,1);
});
