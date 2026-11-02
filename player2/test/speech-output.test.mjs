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
