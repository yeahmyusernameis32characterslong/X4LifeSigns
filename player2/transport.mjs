// Player2 is an optional loopback dependency. No recorder/service imports this module.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export class Player2Error extends Error {
  constructor(code,status=null){super(code);this.name='Player2Error';this.code=code;this.status=status;}
}
export function loopbackEndpoint(raw){
  if(typeof raw!=='string'||!/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/.test(raw))throw new Player2Error('INVALID_ENDPOINT');
  const port=Number(raw.slice(raw.lastIndexOf(':')+1));if(port<1||port>65535)throw new Player2Error('INVALID_ENDPOINT');return 'http://127.0.0.1:'+port;
}
export async function discoverEndpoint({endpoint,portFile,platform=process.platform,env=process.env,home=os.homedir()}={}){
  if(endpoint)return loopbackEndpoint(endpoint);
  const file=portFile||path.join(platform==='win32'?(env.APPDATA||path.join(home,'AppData','Roaming')):platform==='darwin'?path.join(home,'Library','Application Support'):(env.XDG_CONFIG_HOME||path.join(home,'.config')),'game.player2.client','api.port');
  let text;try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32)throw new Error();text=(await fs.readFile(file,'utf8')).trim();}catch{throw new Player2Error('PLAYER2_NOT_DISCOVERED');}
  if(!/^[0-9]{1,5}$/.test(text))throw new Player2Error('INVALID_PORT_FILE');
  return loopbackEndpoint('http://127.0.0.1:'+text);
}
const statusCode=s=>s===401?'LOGIN_REQUIRED':s===403?'ACCESS_DENIED':s===402?'CREDITS_REQUIRED':s===429?'RATE_LIMITED':s>=500?'PROVIDER_UNAVAILABLE':'PROVIDER_REQUEST_REJECTED';

export class Player2Transport {
  constructor({endpoint,gameClientId=null,timeoutMs=30000,maxBytes=1048576,fetchImpl=fetch}={}){
    this.endpoint=loopbackEndpoint(endpoint);
    if(gameClientId!==null&&(typeof gameClientId!=='string'||!gameClientId.trim()||gameClientId.length>256||/[\r\n]/.test(gameClientId)))throw new Player2Error('INVALID_GAME_CLIENT_ID');
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>67108864)throw new Player2Error('INVALID_TRANSPORT_LIMIT');
    this.gameClientId=gameClientId;this.timeoutMs=timeoutMs;this.maxBytes=maxBytes;this.fetchImpl=fetchImpl;
  }
  async *bytes(route,{method='GET',body,signal,contentType='application/json',accept='application/json',resource='npc-dialogue',maxBytes=this.maxBytes}={}){
    // Routes are host-selected; a caller cannot supply an alternate authority/query.
    if(!/^\/v1\/[a-zA-Z0-9_/-]+$/.test(route)||route.includes('..')||!['GET','POST'].includes(method))throw new Player2Error('INVALID_ROUTE');
    if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(resource))throw new Player2Error('INVALID_RESOURCE');
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>67108864)throw new Player2Error('INVALID_RESPONSE_LIMIT');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('TIMEOUT')),this.timeoutMs),started=performance.now();
    const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    const headers={Accept:accept,'player2-resource':resource};if(this.gameClientId)headers['player2-game-key']=this.gameClientId;
    if(body!==undefined&&contentType)headers['Content-Type']=contentType;
    let response,bytes=0;
    try{
      // Generation POSTs are deliberately never retried: timeout can follow billing.
      response=await this.fetchImpl(this.endpoint+route,{method,headers,body:body===undefined?undefined:contentType==='application/json'?JSON.stringify(body):body,signal:combined,redirect:'error'});
      if(!response.ok)throw new Player2Error(statusCode(response.status),response.status);
      if(!response.body)throw new Player2Error('EMPTY_RESPONSE');
      for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>maxBytes)throw new Player2Error('RESPONSE_LIMIT');yield {chunk,elapsedMs:performance.now()-started,contentType:response.headers.get('content-type')};}
    }catch(e){if(e instanceof Player2Error)throw e;if(signal?.aborted)throw new Player2Error('CANCELLED');if(controller.signal.aborted)throw new Player2Error('TIMEOUT');throw new Player2Error('CONNECTION_FAILED');}
    finally{clearTimeout(timer);controller.abort();if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
  }
  async json(route,options={}){
    const chunks=[];for await(const {chunk}of this.bytes(route,options))chunks.push(chunk);
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Player2Error('INVALID_RESPONSE_JSON');}
  }
  async health({signal}={}){return this.json('/v1/health',{signal});}
  async credits({signal}={}){return this.json('/v1/joules',{signal});}
}

// Framing is separate from provider schema; byte boundaries are not line boundaries.
export async function* jsonFrames(chunks,{framing='sse',maxFrameBytes=262144}={}){
  if(!['sse','ndjson'].includes(framing))throw new Player2Error('INVALID_FRAMING');
  const decoder=new TextDecoder('utf-8',{fatal:true});let buffer='',data=[];
  const parse=s=>{if(s==='[DONE]')return {done:true};try{return {value:JSON.parse(s)};}catch{throw new Player2Error('INVALID_STREAM_JSON');}};
  const line=s=>{
    if(framing==='ndjson')return s.trim()?parse(s):null;
    if(s===''){if(!data.length)return null;const s=data.join('\n');data=[];return parse(s);}
    if(s.startsWith('data:'))data.push(s.slice(5).replace(/^ /,''));
    if(Buffer.byteLength(data.join('\n'))>maxFrameBytes)throw new Player2Error('STREAM_FRAME_LIMIT');return null;
  };
  try{
    for await(const item of chunks){buffer+=decoder.decode(item.chunk??item,{stream:true});let i;
      while((i=buffer.indexOf('\n'))>=0){const s=buffer.slice(0,i).replace(/\r$/,'');buffer=buffer.slice(i+1);if(Buffer.byteLength(s)>maxFrameBytes)throw new Player2Error('STREAM_FRAME_LIMIT');const frame=line(s);if(frame?.done)return;if(frame)yield frame.value;}
      if(Buffer.byteLength(buffer)>maxFrameBytes)throw new Player2Error('STREAM_FRAME_LIMIT');
    }
    buffer+=decoder.decode();
    if(framing==='sse'&&(buffer.trim()||data.length))throw new Player2Error('TRUNCATED_STREAM');
    if(framing==='ndjson'&&buffer.trim()){const frame=parse(buffer);if(!frame.done)yield frame.value;}
  }catch(e){if(e instanceof TypeError)throw new Player2Error('INVALID_STREAM_UTF8');throw e;}
}
