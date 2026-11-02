import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {Readable,Writable} from 'node:stream';
import {runHarness} from '../harness.mjs';import {makeFixture,A,CAPTAIN} from '../../dialogue/test/fixture.mjs';

test('external harness completes a typed conversation after optional speech initialisation without opening the microphone',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-harness-')),fixture=makeFixture(dir),routes=[];
 const server=http.createServer((req,res)=>{routes.push(req.url);res.setHeader('content-type','application/json');
   if(req.url==='/v1/health')res.end(JSON.stringify({client_version:'mock'}));
   else if(req.url==='/v1/tts/voices')res.end(JSON.stringify({voices:[{id:'voice-a'}]}));
   else if(req.url==='/v1/chat/completions')res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'My name is Iris Vale.',evidence_refs:['R1:34']})},finish_reason:'stop'}]}));
   else{res.writeHead(500);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();fs.rmSync(dir,{recursive:true});});
 let text='';const output=new Writable({write(chunk,encoding,done){text+=chunk.toString();done();}});
 const config={player2:{endpoint:'http://127.0.0.1:'+server.address().port,gameClientId:'synthetic-test'},binding:fixture.binding,grant:{npcSeed:CAPTAIN,run:A,record:53,access:'command'},selection:{view:'identity'},allowGeneration:true,costAcknowledged:true,allowSpeech:true,voiceLedger:path.join(dir,'voice-prefs.json'),audioDirectory:dir};
 await runHarness({config,generate:true,enableSpeech:true,input:Readable.from(['What is your name?\n']),output});
 assert(text.includes('Iris Vale> My name is Iris Vale.'));assert(text.includes('GENERATED_UNVERIFIED'));assert.equal(routes.filter(p=>p==='/v1/chat/completions').length,1);assert(!routes.includes('/v1/stt/start'));assert(!routes.includes('/v1/tts/speak'));
});
test('voice service failure does not prevent the external typed dialogue fallback',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-harness-fallback-')),fixture=makeFixture(dir),routes=[];
 const server=http.createServer((req,res)=>{routes.push(req.url);if(req.url==='/v1/health')res.end('{"client_version":"mock"}');else if(req.url==='/v1/tts/voices'){res.writeHead(503);res.end();}else res.end(JSON.stringify({choices:[{message:{content:'{"text":"I am Iris Vale.","evidence_refs":["R1:34"]}'},finish_reason:'stop'}]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();fs.rmSync(dir,{recursive:true});});let text='';const output=new Writable({write(chunk,encoding,done){text+=chunk.toString();done();}});
 await runHarness({config:{player2:{endpoint:'http://127.0.0.1:'+server.address().port,gameClientId:'synthetic-test'},binding:fixture.binding,grant:{npcSeed:CAPTAIN,run:A,record:53,access:'command'},selection:{view:'identity'},allowGeneration:true,costAcknowledged:true,allowSpeech:true,voiceLedger:path.join(dir,'voices.json'),audioDirectory:dir},generate:true,enableSpeech:true,input:Readable.from(['Who are you?\n']),output});
 assert(text.includes('Continuing with typed input.'));assert(text.includes('Iris Vale> I am Iris Vale.'));assert(!routes.includes('/v1/stt/start'));
});
