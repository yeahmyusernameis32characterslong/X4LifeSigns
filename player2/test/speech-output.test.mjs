import test from 'node:test';import assert from 'node:assert/strict';
import {ScopedSpeechOutput,spokenText} from '../speech-output.mjs';
const context={universe:'synthetic-universe',npcSeed:'123',scope:'scope-a',loadToken:'load-a'},result={scope:'scope-a',status:'GENERATED_UNVERIFIED',text:'Ship docked [R1:60].'};
test('audio is tied to exact NPC/checkpoint context and cannot return or play after a load',async()=>{
 let complete,plays=0;const output=new ScopedSpeechOutput({speech:{synthesize:()=>new Promise(r=>complete=r)},voiceFor:()=> 'fixed-voice',sink:{play:()=>plays++,stop:()=>{}}});
 output.activate(context);const pending=output.render(result,{play:true});output.clear();complete({audio:Buffer.from('old audio'),contentType:'audio/wav'});await assert.rejects(pending,/STALE_AUDIO/);assert.equal(plays,0);
 output.activate({...context,scope:'scope-b',loadToken:'load-b'});await assert.rejects(output.render(result),/STALE_AUDIO_CONTEXT/);
});
test('voice comes from host identity, citations stay out of speech and sink receives cancellation scope',async()=>{
 let input,played;const output=new ScopedSpeechOutput({speech:{synthesize:async x=>{input=x;return {audio:Buffer.from('audio'),contentType:'audio/wav',voiceId:x.voiceId};}},voiceFor:c=>{assert.equal(c.npcSeed,'123');return 'fixed-voice';},sink:{play:async(audio,metadata)=>{played=metadata;},stop:()=>{}}});
 output.activate(context);const r=await output.render(result,{play:true});assert.equal(input.text,'Ship docked.');assert.equal(input.voiceId,'fixed-voice');assert.equal(played.context.loadToken,'load-a');assert.equal(r.status,'BUFFERED_AUDIO_READY');
 assert.equal(spokenText('Hello [R1:10, R2:20].'),'Hello.');
});
test('a failed sink stop never preserves an old history context or prevents load invalidation',()=>{
 const output=new ScopedSpeechOutput({speech:{},voiceFor:()=>'',sink:{stop:()=>{throw Error('device disconnected');}}});
 output.activate(context);output.clear();assert.equal(output.context,null);assert.equal(output.playbackStopFailed,true);
});

test('sentence queue requires independent host approval and preserves exact complete text',async()=>{
 let calls=0;const output=new ScopedSpeechOutput({speech:{synthesize:async()=>{calls++;return {audio:Buffer.from('audio'),metrics:{}};}},voiceFor:()=> 'fixed'});output.activate(context);
 const answer={...result,text:'Lark docked. Its role changed.'};
 await assert.rejects(output.renderSegments(answer,{segments:['Lark docked.','Its role changed.']}),/SPEECH_FACT_APPROVAL_REQUIRED/);assert.equal(calls,0);
 await assert.rejects(output.renderSegments(answer,{segments:['Invented.'],approve:()=>true}),/INVALID_SPEECH_SEGMENTS/);assert.equal(calls,0);
 const r=await output.renderSegments(answer,{segments:['Lark docked.','Its role changed.'],approve:r=>r===answer});assert.equal(r.segments.length,2);assert.equal(calls,2);
});
test('sentence synthesis overlaps prior playback without overlapping sounds or growing a queue',async()=>{
 let release,played=0,generated=0;const output=new ScopedSpeechOutput({voiceFor:()=> 'fixed',speech:{synthesize:async()=>{generated++;return {audio:Buffer.from('a'),metrics:{}};}},sink:{stop(){},play(){played++;return played===1?new Promise(r=>release=r):Promise.resolve();}}});output.activate(context);
 const pending=output.renderSegments({...result,text:'First sentence. Second sentence.'},{segments:['First sentence.','Second sentence.'],approve:()=>true,play:true});
 await new Promise(r=>setImmediate(r));assert.equal(generated,2);assert.equal(played,1);release();await pending;assert.equal(played,2);
});
test('load and interruption stop queued speech even when synthesis ignores abort',async()=>{
 for(const honors of [true,false]){let finish,stops=0,ready=0;const output=new ScopedSpeechOutput({voiceFor:()=> 'fixed',speech:{synthesize:({signal})=>new Promise((resolve,reject)=>{finish=resolve;if(honors)signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});})},sink:{stop(){stops++;},play(){throw Error('stale playback');}}});output.activate(context);
 const pending=output.renderSegments({...result,text:'First. Second.'},{segments:['First.','Second.'],approve:()=>true,onReady:()=>ready++,play:true});output.clear();if(!honors)finish({audio:Buffer.from('a'),metrics:{}});await assert.rejects(pending,/STALE_AUDIO/);assert.equal(ready,0);assert(stops>=2);
 }
});
