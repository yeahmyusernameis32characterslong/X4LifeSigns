import test from 'node:test';import assert from 'node:assert/strict';
import {LatencyTrace,naturalPrefix,completedSentence} from '../latency.mjs';import {decodeWav} from '../audio-probe.mjs';
test('trace logs only numerical/categorical metadata, never prompts or tokens',()=>{let t=10;const trace=new LatencyTrace({now:()=>t,maxEvents:2});t=15;trace.record({stage:'bytes',bytes:3,text:'secret',headers:{Authorization:'secret'}});trace.record({stage:'end'});trace.record({stage:'late'});assert.deepEqual(trace.events[0],{ms:5,stage:'bytes',bytes:3});assert.equal(trace.dropped,1);});
test('sentence diagnostic ignores metadata, escapes and incomplete quotations',()=>{
 const p=naturalPrefix('{"evidence_refs":["R1:1"],"text":"Hi\\u0020there. More');assert.equal(p.s,'Hi there. More');assert.equal(completedSentence(p),'Hi there.');
 assert.equal(completedSentence(naturalPrefix('{"text":"A quote: \\"Stop.')) ,null);
 assert.equal(completedSentence(naturalPrefix('{"text":"Ready.')),null);
 assert.equal(completedSentence(naturalPrefix('{"text":"Ready."}')),'Ready.');
 assert.equal(completedSentence(naturalPrefix('{"text":"The ship docked [R1:60]. More')),'The ship docked.');
 assert.equal(naturalPrefix('{"evidence_refs":["text: fake."],"text":"Real.' ).s,'Real.');
});
test('PCM decoding refuses truncated, missing and changed codecs',()=>{const b=Buffer.alloc(48);b.write('RIFF');b.writeUInt32LE(40,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(4,40);b.writeInt16LE(100,44);assert.equal(decodeWav(b).samples,2);assert.throws(()=>decodeWav(b.subarray(0,47)),/INCOMPLETE_WAV/);b.writeUInt16LE(3,20);assert.throws(()=>decodeWav(b),/UNSUPPORTED_WAV_CODEC/);});
