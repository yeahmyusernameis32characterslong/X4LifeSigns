import {Player2Error} from './transport.mjs';

export function spokenText(text){return text.replace(/\[R\d+:\d+(?:[,\s]+R\d+:\d+)*\]/g,'').replace(/\s+/g,' ').replace(/\s+([.,!?;:])/g,'$1').trim();}

// Buffered output never plays in Player2. A caller-owned sink must apply the
// same cancellation signal; no stale audio is returned after a load/NPC change.
export class ScopedSpeechOutput {
  constructor({speech,voiceFor,sink=null}){this.speech=speech;this.voiceFor=voiceFor;this.sink=sink;this.context=null;this.generation=0;this.pending=null;}
  activate({universe,npcSeed,scope,loadToken}){
    if(typeof universe!=='string'||!universe||typeof npcSeed!=='string'||!/^[0-9]+$/.test(npcSeed)||typeof scope!=='string'||!scope||typeof loadToken!=='string'||!loadToken)throw new Player2Error('INVALID_AUDIO_CONTEXT');
    this.clear();this.context=Object.freeze({universe,npcSeed,scope,loadToken});
  }
  clear(){this.context=null;this.pending?.abort();this.pending=null;this.generation++;try{this.sink?.stop();this.playbackStopFailed=false;}catch{this.playbackStopFailed=true;}}
  async render(result,{signal,play=false}={}){
    const context=this.context;if(!context||result.scope!==context.scope||result.status!=='GENERATED_UNVERIFIED'||typeof result.text!=='string')throw new Player2Error('STALE_AUDIO_CONTEXT');
    this.pending?.abort();const controller=new AbortController();this.pending=controller;const generation=++this.generation;
    const activeSignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    const guard=()=>{if(this.context!==context||this.generation!==generation||activeSignal.aborted)throw new Player2Error('STALE_AUDIO');};
    try{
      const voiceId=this.voiceFor(context),audio=await this.speech.synthesize({text:spokenText(result.text),voiceId,signal:activeSignal});guard();
      if(play){if(!this.sink)throw new Player2Error('AUDIO_SINK_UNAVAILABLE');await this.sink.play(audio.audio,{contentType:audio.contentType,signal:activeSignal,context});guard();}
      return {...audio,context,status:'BUFFERED_AUDIO_READY'};
    }catch(e){guard();throw e;}finally{if(this.pending===controller)this.pending=null;}
  }
}
