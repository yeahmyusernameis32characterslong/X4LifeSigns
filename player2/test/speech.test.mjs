import test from 'node:test';import assert from 'node:assert/strict';
import {Player2Speech,PushToTalk} from '../speech.mjs';
const wave=()=>{const b=Buffer.alloc(48);b.write('RIFF');b.writeUInt32LE(40,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(4,40);return b;};
test('microphone is never started without an explicit user action and release waits for start acknowledgement',async()=>{
 let ready;const calls=[];const speech=new Player2Speech({endpoint:'http://127.0.0.1:4315',fetchImpl:async(u,o)=>{calls.push([u,o]);if(u.endsWith('/start')){await new Promise(r=>ready=r);return new Response(null);}return Response.json({text:'Hello Captain'});}});
 await assert.rejects(speech.startRecording(),/USER_ACTION/);assert.equal(calls.length,0);
 const ptt=new PushToTalk(speech),press=ptt.press({userGesture:true}),release=ptt.release();ready();await press;assert.equal(await release,'Hello Captain');assert.equal(ptt.state,'IDLE');assert.equal(calls.length,2);assert.equal(JSON.parse(calls[0][1].body).timeout,15);
});
test('recording conflicts do not stop another owner and uncertain connection failures never silently restart capture',async()=>{
 let stop=0;const speech=new Player2Speech({endpoint:'http://127.0.0.1:4315',fetchImpl:async u=>{if(u.endsWith('/stop'))stop++;return new Response('',{status:409});}});
 await assert.rejects(speech.startRecording({userGesture:true}),/PROVIDER_REQUEST_REJECTED/);assert.equal(speech.recording,false);await assert.rejects(speech.stopRecording(),/MICROPHONE_NOT_OWNED/);assert.equal(stop,0);
 speech.transport.fetchImpl=async()=>{throw new Error('disconnect');};await assert.rejects(speech.startRecording({userGesture:true}),/CONNECTION_FAILED/);assert.equal(speech.recordingUnknown,true);await assert.rejects(speech.startRecording({userGesture:true}),/STATE_BUSY/);
});
test('an expired local recording cannot issue a global stop against a later recording',async()=>{
 let now=0,stops=0;const speech=new Player2Speech({endpoint:'http://127.0.0.1:4315',now:()=>now,fetchImpl:async u=>{if(u.endsWith('/stop'))stops++;return new Response(null);}});
 await speech.startRecording({userGesture:true,timeout:3});now=3001;await assert.rejects(speech.stopRecording(),/RECORDING_EXPIRED/);assert.equal(stops,0);assert(speech.recordingUnknown);
});
test('buffered synthesis requests an explicit stable voice and WAV, and never enables in-app playback',async()=>{
 const calls=[];const speech=new Player2Speech({endpoint:'http://127.0.0.1:4315',fetchImpl:async(u,o)=>{calls.push([u,o]);return Response.json({data:wave().toString('base64')});}});
 const result=await speech.synthesize({text:'Life Signs connected.',voiceId:'test-voice'});assert.equal(result.contentType,'audio/wav');assert.equal(result.audio.length,48);const body=JSON.parse(calls[0][1].body);assert.equal(body.play_in_app,false);assert.deepEqual(body.voice_ids,['test-voice']);assert.equal(body.audio_format,'wav');
 await assert.rejects(speech.synthesize({text:'Hello',voiceId:'test-voice',speed:99}),/INVALID_SPEECH/);
 speech.transport.fetchImpl=async()=>Response.json({data:Buffer.from('not wave').toString('base64')});await assert.rejects(speech.synthesize({text:'Hi',voiceId:'test-voice'}),/UNEXPECTED_AUDIO_FORMAT/);
});
test('uploaded STT uses multipart file data and streaming audio retains bytes without pretending the codec is known',async()=>{
 const calls=[];const speech=new Player2Speech({endpoint:'http://127.0.0.1:4315',fetchImpl:async(u,o)=>{calls.push([u,o]);return u.endsWith('/stream')?new Response(wave(),{headers:{'content-type':'application/octet-stream'}}):Response.json({text:'Life Signs connected.'});}});
 assert.equal(await speech.transcribeFile({audio:wave()}),'Life Signs connected.');assert(calls[0][1].body instanceof FormData);assert.equal(calls[0][1].body.get('response_format'),'json');assert(!calls[0][1].headers['Content-Type']);
 const bytes=[];for await(const item of speech.streamAudio({text:'Hi',voiceId:'test-voice'}))bytes.push(item.chunk);assert.deepEqual(Buffer.concat(bytes),wave());
});
