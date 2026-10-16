// Disposable reader for the NPC observation diagnostic. Production readers do not import it.
import {openSync, closeSync, writeSync, fsyncSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createTail} from './read-events.js';
import {validateSessionKey} from './session-key.js';
import {checkPath, fileInfo} from './session-path.js';

export const MARKER='LIFESIGNS_NPC_OBS_V1';
export const LOG_DIRECTORY=resolve(fileURLToPath(new URL('../../',import.meta.url)),
  'local-data','npc-observation','logs');
const FIELDS={
  enrolment:['complete','reason','ship_a_matches','ship_b_matches','station_matches'],
  batch:['session','seq','trigger','phase'],
  anchor:['session','seq','ref','component_seed_text','role','post','roleobject','assignedcontrolled','container','temporary','in_transit','transfer_scheduled','seed_render'],
  context:['session','seq','object','object_ref','template','entry','entry_seed_text','entry_role','instance','instance_equal_original','seed_render'],
  post:['session','seq','object','object_ref','post','occupant','occupant_equal_original','occupant_seed_text','occupant_role','seed_render'],
  selection:['session','seq','payload','context','instance','equal_original','template_equal_original','component_seed_text','entry_seed_text','role','post','roleobject','assignedcontrolled','container','seed_render']
};

const malformed=(line,reason)=>({kind:'malformed',line,reason});
export function parseProbeLine(line){
  const start=line.indexOf(MARKER);
  if(start<0)return null;
  const parts=line.slice(start).split('|');
  if(parts[0]!==MARKER||parts.at(-1)!=='END'||!Object.hasOwn(FIELDS,parts[1]))
    return malformed(line,'marker, type or END');
  const type=parts[1],fields={};
  for(const part of parts.slice(2,-1)){
    const at=part.indexOf('=');
    if(at<=0||at===part.length-1||Object.hasOwn(fields,part.slice(0,at)))
      return malformed(line,'invalid or duplicate field');
    fields[part.slice(0,at)]=part.slice(at+1);
  }
  const required=[...FIELDS[type]];
  if(type==='batch'&&fields.phase==='end')required.push('records');
  if(required.some(key=>!Object.hasOwn(fields,key)))return malformed(line,'missing required field');
  if(type==='batch'&&!['begin','end'].includes(fields.phase))return malformed(line,'invalid batch phase');
  if(type==='batch'&&fields.phase==='end'&&!/^(?:0|[1-9][0-9]*)$/.test(fields.records))
    return malformed(line,'invalid batch count');
  if(type==='enrolment')return {kind:'enrolment',line,fields};
  if(!/^[1-9][0-9]*$/.test(fields.seq)||!Number.isSafeInteger(Number(fields.seq)))
    return malformed(line,'invalid sequence');
  if(fields.session==='UNAVAILABLE')return {kind:'unavailable',type,line,fields};
  try {validateSessionKey(fields.session);}
  catch {return {kind:'unsafe-session',type,line,fields};}
  return {kind:'session',type,line,fields};
}

export function parseArgs(args){
  if(args.length!==2||args[0]!=='--log'||!args[1]||args[1].startsWith('--'))
    throw Error('Usage: node bridge/src/read-npc-observation.js --log <X4 debug log path>');
  return resolve(args[1]);
}

function ensureDirectory(directory){
  const root=resolve(directory,'../../..');
  checkPath(root,{directory:true});
  for(const path of [join(root,'local-data'),join(root,'local-data','npc-observation'),directory]){
    if(!fileInfo(path))mkdirSync(path);
    checkPath(path,{directory:true});
  }
}
function appendLine(path,line,flush=false){
  checkPath(path,{missing:true});
  const fd=openSync(path,'a');
  try{
    const buffer=Buffer.from(line+'\n','utf8');
    for(let offset=0;offset<buffer.length;){
      const count=writeSync(fd,buffer,offset,buffer.length-offset);
      if(count<=0)throw Error('Diagnostic log write made no progress');
      offset+=count;
    }
    if(flush)fsyncSync(fd);
  }finally{closeSync(fd);}
  checkPath(path);
}
function flushFile(path){
  checkPath(path);
  const fd=openSync(path,'a');
  try{fsyncSync(fd);}finally{closeSync(fd);}
}

export function createCapture({directory=LOG_DIRECTORY,write=appendLine,flush=flushFile,
  onWarning=()=>{},onBatch=()=>{}}={}){
  directory=resolve(directory);
  ensureDirectory(directory);
  const runPath=join(directory,`reader-run-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}.log`);
  write(runPath,'# NPC observation reader run: enrolment and unavailable-session lines cannot be assigned to a production session.',true);
  const active=new Map();
  let logged=0,closed=false;
  function sessionPath(session){
    validateSessionKey(session); // No record text reaches a filename before this check.
    return join(directory,`${session}.log`);
  }
  function notice(message,line){
    write(runPath,`# READER_NOTICE ${message}`,true);
    if(line!==undefined)write(runPath,line,true);
    onWarning(message);
  }
  function incomplete(session,state,reason){
    notice(`INCOMPLETE_BATCH session=${session} seq=${state.seq} rows=${state.rows} reason=${reason}`);
    if(session!=='UNAVAILABLE')flush(sessionPath(session));
  }
  function accept(record){
    if(!record)return;
    if(record.kind!=='session'&&record.kind!=='unavailable'){
      const reason=record.kind==='enrolment'?'ENROLMENT_NO_SESSION':
        record.kind==='unsafe-session'?'UNSAFE_SESSION':'MALFORMED_RECORD';
      notice(`${reason}${record.reason?` reason=${record.reason}`:''}`,record.line);
      return;
    }
    const {type,fields,line}=record;
    const session=fields.session;
    if(record.kind==='unavailable'){
      notice(`SESSION_UNAVAILABLE seq=${fields.seq} type=${type}; correlation limited`,line);
    }else{
      const path=sessionPath(session);
      write(path,line,type==='batch'&&fields.phase==='end');
      logged++;
    }
    const prior=active.get(session);
    if(type==='batch'&&fields.phase==='begin'){
      if(prior)incomplete(session,prior,'new begin before end');
      active.set(session,{seq:fields.seq,trigger:fields.trigger,rows:0});
      return;
    }
    if(type==='batch'&&fields.phase==='end'){
      if(!prior){notice(`ORPHAN_BATCH_END session=${session} seq=${fields.seq}`);return;}
      active.delete(session);
      if(prior.seq!==fields.seq||prior.trigger!==fields.trigger||prior.rows!==Number(fields.records))
        incomplete(session,prior,`end seq=${fields.seq} trigger=${fields.trigger} expected_rows=${fields.records}`);
      else if(record.kind==='session')onBatch({session,seq:fields.seq,path:sessionPath(session)});
      return;
    }
    if(!prior){notice(`ORPHAN_ROW session=${session} seq=${fields.seq} type=${type}`);return;}
    if(prior.seq!==fields.seq){
      active.delete(session);
      incomplete(session,prior,`row with seq=${fields.seq}`);
      notice(`ORPHAN_ROW session=${session} seq=${fields.seq} type=${type}`);
      return;
    }
    prior.rows++;
  }
  function warning(message){
    if(/replaced|reappeared|truncated|rewritten|unavailable/i.test(message)){
      for(const [session,state] of active)incomplete(session,state,'input discontinuity');
      active.clear();
    }
    notice(`INPUT_WARNING ${message}`);
  }
  function close(){
    if(closed)return;
    closed=true;
    for(const [session,state] of active)incomplete(session,state,'reader stopped');
    active.clear();
  }
  return {accept,warning,close,runPath,get logged(){return logged;}};
}

export async function createObservationReader(logPath,options={}){
  const capture=createCapture(options);
  try{
    const tail=await createTail(logPath,{parse:parseProbeLine,
      onRecord:record=>capture.accept(record),onWarning:message=>capture.warning(message)});
    return {poll:()=>tail.poll(),close:()=>capture.close(),runPath:capture.runPath};
  }catch(error){capture.close();throw error;}
}

async function main(){
  const logPath=parseArgs(process.argv.slice(2));
  const controller=new AbortController();
  const stop=()=>controller.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let reader;
  try{
    reader=await createObservationReader(logPath,{
      onWarning:message=>console.error(`NPC observation warning: ${message}`),
      onBatch:({session,seq})=>console.log(`NPC observation batch logged: session ${session}, seq ${seq}`)
    });
    console.log(`NPC observation reader PID ${process.pid}; watching from current end: ${logPath}`);
    console.log(`Reader-run diagnostics: ${reader.runPath}`);
    while(!controller.signal.aborted){
      await reader.poll();
      await delay(250,undefined,{signal:controller.signal});
    }
  }catch(error){if(error.name!=='AbortError')throw error;}
  finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);reader?.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(`NPC observation reader error: ${error.message}`);process.exitCode=1;});
}
