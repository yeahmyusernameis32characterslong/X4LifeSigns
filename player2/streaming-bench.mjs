// Explicit, bounded external experiment. No recorder import or audio playback.
import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {Player2Client} from './client.mjs';import {Player2Speech} from './speech.mjs';
import {discoverEndpoint,Player2Error} from './transport.mjs';import {DialogueHost} from './dialogue-host.mjs';import {DialogueReader} from '../dialogue/retrieval.mjs';
import {LatencyTrace,naturalPrefix,completedSentence} from './latency.mjs';import {decodeWav,mpegProbe} from './audio-probe.mjs';

export async function measureText({options,reader,question,selection,stream,check=()=>null}){
 const trace=new LatencyTrace(),client=new Player2Client({...options,observe:e=>trace.record(e)}),complete=client.complete.bind(client);let draft='',sentenceSeen=false,fragments=0;
 client.complete=args=>complete({...args,stream,onEvent:e=>trace.record(e)});
 const host=new DialogueHost({client,reader});
 try{const result=await host.ask({question,selection,onEvent:e=>trace.record(e),onDraft:fragment=>{draft+=fragment.text;fragments++;trace.record({stage:'content',bytes:Buffer.byteLength(fragment.text)});if(!sentenceSeen&&completedSentence(naturalPrefix(draft))){sentenceSeen=true;trace.record({stage:'draftSentence'});}}});
  trace.record({stage:'accepted'});const facts=check(result);return {status:'CONTRACT_ACCEPTED_NOT_FACT_VERIFIED',stream,model:result.metrics.model,fragments,answerBytes:result.metrics.answerBytes,factCheck:facts,events:trace.events,dropped:trace.dropped};
 }catch(e){trace.record({stage:'rejected'});return {status:'REJECTED',stream,error:e instanceof Player2Error?e.code:'LOCAL_CHECK_FAILED',events:trace.events,dropped:trace.dropped};}finally{host.close();}
}
export async function measureAudio({options,text,voiceId,stream}){
 // Decoder initialisation is outside request dispatch timing and disclosed.
 const decoder=stream?await mpegProbe():null,trace=new LatencyTrace(),speech=new Player2Speech({...options,observe:e=>trace.record(e)});let first=false;
 try{let decoded;if(stream){for await(const {chunk} of speech.streamAudio({text,voiceId})){const r=decoder.push(chunk);if(r.errors)throw new Player2Error('AUDIO_DECODE_FAILED');if(r.samples&&!first){first=true;trace.record({stage:'playable',samples:r.samples,sampleRate:r.sampleRate});}}decoded=decoder.summary();if(!decoded.samples)throw new Player2Error('NO_PLAYABLE_AUDIO');}
  else{const r=await speech.synthesize({text,voiceId});decoded=decodeWav(r.audio);trace.record({stage:'playable',samples:decoded.samples,sampleRate:decoded.sampleRate});}
  trace.record({stage:'audioComplete'});return {status:'DECODED_NO_DEVICE_PLAYBACK',stream,decoded,events:trace.events,dropped:trace.dropped};
 }catch(e){return {status:'REJECTED',stream,error:e instanceof Player2Error?e.code:'DECODER_FAILED',events:trace.events,dropped:trace.dropped};}finally{decoder?.close();}
}

export async function runBench(config,{text=false,audio=false}={}){
 if(!config.allowGeneration||!config.costAcknowledged||(!text&&!audio)||!Number.isInteger(config.repeats)||config.repeats<2||config.repeats>3)throw new Player2Error('EXPLICIT_BOUNDED_EXPERIMENT_REQUIRED');
 if(typeof config.output!=='string'||!config.output.endsWith('.local.jsonl'))throw new Player2Error('PRIVATE_OUTPUT_REQUIRED');
 const endpoint=await discoverEndpoint(config.player2),options={...config.player2,endpoint},control=new Player2Client(options);const out=await fs.open(config.output,'wx');let spend=0,calls=0;
 const run=async(label,fn)=>{if(++calls>30||spend>=10)throw new Player2Error('EXPERIMENT_BUDGET_REACHED');const before=await control.credits();if(before.patron_tier||before.joules<30)throw new Player2Error('AVAILABLE_BALANCE_REQUIRED');const result=await fn();const after=await control.credits(),delta=before.joules-after.joules;spend+=Math.max(0,delta);await out.write(JSON.stringify({label,trial:calls,...result,roundedJouleDelta:delta})+'\n');console.log(label,result.status);};
 try{
  if(text){if(!Array.isArray(config.cases)||config.cases.length!==3)throw new Player2Error('THREE_FIXED_CASES_REQUIRED');
   for(let repeat=0;repeat<config.repeats;repeat++)for(const [index,c]of config.cases.entries())for(const stream of (repeat%2?[false,true]:[true,false])){const reader=new DialogueReader(config.binding,config.grant);try{await run('text-'+index+'-'+repeat,()=>measureText({options,reader,question:c.question,selection:c.selection,stream,check:r=>({literalChecks:(c.required||[]).map(pattern=>new RegExp(pattern,'i').test(r.text))})}));}finally{reader.close();}}
  }
  if(audio){if(!config.allowSpeech||typeof config.voiceId!=='string')throw new Player2Error('EXPLICIT_SPEECH_REQUIRED');const texts=['The ship docked at the station.','The ship docked at the station. Its captain was reassigned before the next recorded patrol.'];
   for(let repeat=0;repeat<config.repeats;repeat++)for(const [index,utterance]of texts.entries())for(const stream of (repeat%2?[true,false]:[false,true]))await run('audio-'+index+'-'+repeat,()=>measureAudio({options,text:utterance,voiceId:config.voiceId,stream}));
  }
 }finally{await out.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const args=process.argv.slice(2),i=args.indexOf('--config');if(i<0)throw new Player2Error('PRIVATE_CONFIG_REQUIRED');const config=JSON.parse(await fs.readFile(args[i+1],'utf8'));await runBench(config,{text:args.includes('--text'),audio:args.includes('--audio')});}catch(e){console.error(e instanceof Player2Error?e.code:'EXPERIMENT_FAILED');process.exitCode=1;}}
