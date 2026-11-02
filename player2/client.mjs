import {Player2Transport,Player2Error,jsonFrames} from './transport.mjs';
import {setTimeout as delay} from 'node:timers/promises';

export class Player2Client {
  constructor(options){this.transport=options instanceof Player2Transport?options:new Player2Transport(options);}
  async health({signal,attempts=2,backoffMs=100}={}){
    if(!Number.isSafeInteger(attempts)||attempts<1||attempts>3||!Number.isSafeInteger(backoffMs)||backoffMs<0||backoffMs>2000)throw new Player2Error('INVALID_RETRY_POLICY');
    for(let i=0;;i++)try{return await this.transport.health({signal});}catch(e){
      if(i+1>=attempts||!['CONNECTION_FAILED','PROVIDER_UNAVAILABLE','TIMEOUT'].includes(e.code))throw e;
      try{await delay(backoffMs*2**i,undefined,{signal});}catch{throw new Player2Error('CANCELLED');}
    }
  }
  credits(options){return this.transport.credits(options);}
  async complete({messages,signal,onText=()=>{},stream=true,maxTokens=2048,temperature=0.2,responseFormat}={}){
    if(!Array.isArray(messages)||!messages.length||messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||Buffer.byteLength(JSON.stringify(messages))>120000)throw new Player2Error('INVALID_MESSAGES');
    if(!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>4096||!Number.isFinite(temperature)||temperature<0||temperature>2)throw new Player2Error('INVALID_GENERATION_LIMIT');
    if(responseFormat!==undefined&&(!responseFormat||!['json_object','json_schema'].includes(responseFormat.type)||Buffer.byteLength(JSON.stringify(responseFormat))>16000))throw new Player2Error('INVALID_RESPONSE_FORMAT');
    const started=performance.now(),body={messages,stream,max_tokens:maxTokens,temperature};if(responseFormat)body.response_format=responseFormat;
    const chunks=this.transport.bytes('/v1/chat/completions',{method:'POST',body,signal,accept:stream?'text/event-stream, application/json':'application/json'}),iterator=chunks[Symbol.asyncIterator]();
    let text='',firstTextMs=null,finishReason=null,usage=null,model=null;
    const emit=content=>{if(typeof content!=='string'||!content)return;if(firstTextMs===null)firstTextMs=performance.now()-started;text+=content;onText(content);};
    try{
      const first=await iterator.next();if(first.done)throw new Player2Error('EMPTY_RESPONSE');
      async function* all(){yield first.value;while(true){const n=await iterator.next();if(n.done)return;yield n.value;}}
      if(first.value.contentType?.includes('text/event-stream')){
        for await(const frame of jsonFrames(all())){
          if(frame.error)throw new Player2Error('GENERATION_FAILED');
          const choice=frame.choices?.find(c=>c.index===0)||frame.choices?.[0];
          if(choice?.delta?.tool_calls?.length)throw new Player2Error('UNEXPECTED_TOOL_CALL');
          emit(choice?.delta?.content);if(choice?.finish_reason)finishReason=choice.finish_reason;
          if(frame.usage)usage=frame.usage;if(frame.model)model=frame.model;
        }
      }else{
        const bytes=[];for await(const item of all())bytes.push(item.chunk);let response;
        try{response=JSON.parse(Buffer.concat(bytes).toString('utf8'));}catch{throw new Player2Error('INVALID_RESPONSE_JSON');}
        if(response.error)throw new Player2Error('GENERATION_FAILED');
        const choice=response.choices?.[0];if(choice?.message?.tool_calls?.length)throw new Player2Error('UNEXPECTED_TOOL_CALL');
        emit(choice?.message?.content);finishReason=choice?.finish_reason;usage=response.usage??null;model=response.model??null;
      }
      if(!text.trim()||finishReason!=='stop')throw new Player2Error(finishReason==='length'?'OUTPUT_INCOMPLETE':'INVALID_COMPLETION');
      return {text,metrics:{firstTextMs,wholeTextMs:performance.now()-started,outputBytes:Buffer.byteLength(text),usage,model}};
    }finally{await iterator.return?.();}
  }
}
