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

export async function runHarness({config,generate=false,input=process.stdin,output=process.stdout}={}){
  const endpoint=await discoverEndpoint(config.player2),client=new Player2Client({...config.player2,endpoint,gameClientId:process.env.PLAYER2_GAME_CLIENT_ID||config.player2?.gameClientId||null});
  const health=await client.health();output.write('Player2 connected: '+String(health.client_version||'version unknown')+'\n');
  if(!generate){output.write('Read-only preflight complete. Generation requires --generate and explicit configuration.\n');return;}
  if(config.allowGeneration!==true)throw Error('GENERATION_NOT_ENABLED');
  if(config.costAcknowledged!==true)throw Error('COST_POLICY_NOT_ACKNOWLEDGED');
  if(!client.transport.gameClientId)throw Error('GAME_CLIENT_ID_REQUIRED');
  const reader=new DialogueReader(config.binding,config.grant),host=new DialogueHost({client,reader});
  const rl=readline.createInterface({input,output,terminal:!!input.isTTY});
  let signal;
  const cancel=()=>{signal?.abort();host.cancel();};process.on('SIGINT',cancel);
  try{
    output.write('Scoped text dialogue ready. /quit exits. Responses are generated, not verified history.\n');
    while(true){
      const question=await rl.question('You> ').catch(()=>'/quit');if(question.trim()==='/quit')break;if(!question.trim())continue;
      signal=new AbortController();
      try{
        const result=await host.ask({question,selection:config.selection||{view:'latest'},focus:config.focus||null,requireFocus:config.requireFocus===true,persona:config.persona,signal:signal.signal});
        output.write((result.speaker||'NPC')+'> '+result.text+'\n');
        output.write(JSON.stringify({status:result.status,metrics:result.metrics})+'\n');
      }catch(e){output.write('Dialogue unavailable: '+(e.code||e.message)+'. Typed input remains available.\n');}
    }
  }finally{process.removeListener('SIGINT',cancel);host.close();reader.close();rl.close();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),i=args.indexOf('--config');
  if(i<0||!args[i+1]){console.error('Usage: node player2/harness.mjs --config <private-config.json> [--generate]');process.exitCode=1;}
  else try{const file=path.resolve(args[i+1]);checkPath(file);const config=JSON.parse(fs.readFileSync(file,'utf8'));await runHarness({config,generate:args.includes('--generate')});}catch(e){console.error(e.code||e.message);process.exitCode=1;}
}
