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
  async renderSegments(result,{segments,approve,signal,play=false,onReady=()=>{}}={}){
    const context=this.context;
    if(!context||result.scope!==context.scope||result.status!=='GENERATED_UNVERIFIED'||typeof result.text!=='string')throw new Player2Error('STALE_AUDIO_CONTEXT');
    // A trusted host must approve the complete historical claim before any TTS.
    // Model reference membership alone is insufficient. No draft input allowed.
    if(typeof approve!=='function'||approve(result)!==true)throw new Player2Error('SPEECH_FACT_APPROVAL_REQUIRED');
    if(!Array.isArray(segments)||!segments.length||segments.length>8||segments.some(s=>typeof s!=='string'||!s.trim()||s.length>2000)||spokenText(segments.join(' '))!==spokenText(result.text)||/\bR\d+:\d+\b/.test(spokenText(result.text)))throw new Player2Error('INVALID_SPEECH_SEGMENTS');
    if(play&&!this.sink)throw new Player2Error('AUDIO_SINK_UNAVAILABLE');
    this.pending?.abort();const controller=new AbortController();this.pending=controller;const generation=++this.generation;
    const activeSignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    const guard=()=>{if(this.context!==context||generation!==this.generation||activeSignal.aborted)throw new Player2Error('STALE_AUDIO');};
    let playing=Promise.resolve();const results=[];
    try{const voiceId=this.voiceFor(context);
      for(let index=0;index<segments.length;index++){
        guard();const audio=await this.speech.synthesize({text:spokenText(segments[index]),voiceId,signal:activeSignal});guard();
        // Synthesise the next sentence while the preceding one plays, but never
        // overlap playback or accumulate an unbounded audio queue.
        await playing;guard();onReady({index,...audio});guard();results.push(audio.metrics);
        if(play){playing=Promise.resolve(this.sink.play(audio.audio,{contentType:audio.contentType,signal:activeSignal,context}));playing.catch(()=>{});}
      }
      await playing;guard();return {status:'APPROVED_SEGMENTS_COMPLETE',segments:results,context};
    }catch(e){controller.abort();try{this.sink?.stop();}catch{this.playbackStopFailed=true;}if(this.context!==context||generation!==this.generation||signal?.aborted)throw new Player2Error('STALE_AUDIO');throw e;}
    finally{if(this.pending===controller)this.pending=null;}
  }
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
