// External, explicitly opt-in harness. Never launched by the game lifecycle.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import readline from 'node:readline/promises';
import {discoverEndpoint} from './transport.mjs';
import {Player2Client} from './client.mjs';
import {DialogueHost} from './dialogue-host.mjs';
import {DialogueReader} from '../dialogue/retrieval.mjs';
import {checkPath} from '../bridge/src/session-path.js';
import {Player2Speech,PushToTalk} from './speech.mjs';
import {VoiceIdentities} from './voice-identity.mjs';
import {randomUUID} from 'node:crypto';

export async function runHarness({config,generate=false,enableSpeech=false,input=process.stdin,output=process.stdout}={}){
  const endpoint=await discoverEndpoint(config.player2),client=new Player2Client({...config.player2,endpoint,gameClientId:process.env.PLAYER2_GAME_CLIENT_ID||config.player2?.gameClientId||null});
  const health=await client.health();output.write('Player2 connected: '+String(health.client_version||'version unknown')+'\n');
  if(!generate){output.write('Read-only preflight complete. Generation requires --generate and explicit configuration.\n');return;}
  if(config.allowGeneration!==true)throw Error('GENERATION_NOT_ENABLED');
  if(config.costAcknowledged!==true)throw Error('COST_POLICY_NOT_ACKNOWLEDGED');
  if(!client.transport.gameClientId)throw Error('GAME_CLIENT_ID_REQUIRED');
  const reader=new DialogueReader(config.binding,config.grant),host=new DialogueHost({client,reader});
  let speech,ptt,voiceId,lastAnswer=null;
  const rl=readline.createInterface({input,output,terminal:!!input.isTTY});
  let signal;
  const cancel=()=>{signal?.abort();host.cancel();};process.on('SIGINT',cancel);
  try{
  if(enableSpeech){
    if(config.allowSpeech!==true||typeof config.voiceLedger!=='string'||typeof config.audioDirectory!=='string'){throw Error('SPEECH_NOT_CONFIGURED');}
    checkPath(config.audioDirectory,{directory:true});speech=new Player2Speech({...config.player2,endpoint,gameClientId:client.transport.gameClientId,timeoutMs:90000});
    const voices=await speech.voices();voiceId=new VoiceIdentities(config.voiceLedger).choose({universe:config.binding.universe,npcSeed:config.grant.npcSeed,voices,preferredId:config.preferredVoiceId||null});ptt=new PushToTalk(speech);
  }
    output.write('Scoped text dialogue ready. /quit exits. Responses are generated, not verified history.\n');
    while(true){
      let question=await rl.question('You> ').catch(()=>'/quit');if(question.trim()==='/quit')break;if(!question.trim())continue;
      signal=new AbortController();
      try{
        if(question.trim()==='/record'){if(!ptt)throw Error('SPEECH_DISABLED');await ptt.press({userGesture:true,signal:signal.signal});output.write('Recording started. /stop transcribes; typed input remains available.\n');continue;}
        if(question.trim()==='/stop'){if(!ptt)throw Error('SPEECH_DISABLED');question=await ptt.release({signal:signal.signal});output.write('You said: '+question+'\n');if(!question.trim())continue;}
        if(question.trim()==='/say'){
          if(!speech||!lastAnswer)throw Error('NO_SPEECH_OR_REPLY');
          const text=lastAnswer.replace(/\[R\d+:\d+(?:[,\s]+R\d+:\d+)*\]/g,'').replace(/\s+/g,' ').trim();
          const result=await speech.synthesize({text,voiceId,signal:signal.signal});const file=path.join(config.audioDirectory,randomUUID()+'.wav');checkPath(config.audioDirectory,{directory:true});fs.writeFileSync(file,result.audio,{flag:'wx',mode:0o600});
          output.write('Speech audio ready: '+file+'\n');output.write(JSON.stringify(result.metrics)+'\n');continue;
        }
        const result=await host.ask({question,selection:config.selection||{view:'latest'},focus:config.focus||null,requireFocus:config.requireFocus===true,persona:config.persona,signal:signal.signal});
        lastAnswer=result.text;
        output.write((result.speaker||'NPC')+'> '+result.text+'\n');
        output.write(JSON.stringify({status:result.status,metrics:result.metrics})+'\n');
      }catch(e){output.write('Dialogue unavailable: '+(e.code||e.message)+'. Typed input remains available.\n');}
    }
  }finally{
    process.removeListener('SIGINT',cancel);host.close();
    if(speech?.recording)try{await speech.stopRecording();}catch{output.write('Microphone stop could not be confirmed. Check Player2 before leaving.\n');}
    if(speech?.recordingUnknown)output.write('Microphone state is unknown; check and stop it in Player2.\n');
    reader.close();rl.close();
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),i=args.indexOf('--config');
  if(i<0||!args[i+1]){console.error('Usage: node player2/harness.mjs --config <private-config.json> [--generate]');process.exitCode=1;}
    else try{const file=path.resolve(args[i+1]);checkPath(file);const config=JSON.parse(fs.readFileSync(file,'utf8'));await runHarness({config,generate:args.includes('--generate'),enableSpeech:args.includes('--speech')});}catch(e){console.error(e.code||e.message);process.exitCode=1;}
}
