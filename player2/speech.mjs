import {Player2Transport,Player2Error} from './transport.mjs';

export class Player2Speech {
  constructor(options){this.transport=options instanceof Player2Transport?options:new Player2Transport(options);this.recording=false;this.recordingUnknown=false;}
  async voices({signal}={}){const r=await this.transport.json('/v1/tts/voices',{signal,resource:'npc-speech'});if(!Array.isArray(r.voices)||r.voices.some(v=>typeof v.id!=='string'))throw new Player2Error('INVALID_VOICE_CATALOGUE');return r.voices;}
  async startRecording({userGesture=false,timeout=15,signal}={}){
    if(!userGesture)throw new Player2Error('MICROPHONE_REQUIRES_USER_ACTION');if(this.recording||this.recordingUnknown)throw new Player2Error('MICROPHONE_STATE_BUSY');
    if(!Number.isFinite(timeout)||timeout<3||timeout>60)throw new Player2Error('INVALID_RECORDING_TIMEOUT');
    try{for await(const _ of this.transport.bytes('/v1/stt/start',{method:'POST',body:{timeout},signal,resource:'npc-speech',allowEmpty:true})){}this.recording=true;}
    catch(e){if(['TIMEOUT','CANCELLED','CONNECTION_FAILED'].includes(e.code))this.recordingUnknown=true;throw e;}
  }
  async stopRecording({signal}={}){
    if(!this.recording)throw new Player2Error(this.recordingUnknown?'MICROPHONE_STATE_UNKNOWN':'MICROPHONE_NOT_OWNED');
    try{const result=await this.transport.json('/v1/stt/stop',{method:'POST',signal,resource:'npc-speech'});if(typeof result.text!=='string')throw new Player2Error('INVALID_TRANSCRIPTION');this.recording=false;return result.text;}
    catch(e){this.recording=false;this.recordingUnknown=true;throw e;}
  }
  async transcribeFile({audio,filename='speech.wav',language='en',signal}={}){
    if(!(audio instanceof Uint8Array)||!audio.byteLength||audio.byteLength>16777216||!/^[a-zA-Z0-9_-]+\.(wav|mp3|ogg|flac)$/.test(filename)||!/^[a-z]{2}$/.test(language))throw new Player2Error('INVALID_AUDIO_INPUT');
    const form=new FormData();form.set('file',new Blob([audio]),filename);form.set('language',language);form.set('response_format','json');
    const result=await this.transport.json('/v1/stt/whisper/audio/transcriptions',{method:'POST',body:form,contentType:null,signal,resource:'npc-speech'});
    if(typeof result.text!=='string')throw new Player2Error('INVALID_TRANSCRIPTION');return result.text;
  }
  async synthesize({text,voiceId,speed=1,instructions=null,signal}={}){
    if(typeof text!=='string'||!text.trim()||text.length>2000||typeof voiceId!=='string'||!voiceId||voiceId.length>256||!Number.isFinite(speed)||speed<0.25||speed>4||instructions!==null&&(typeof instructions!=='string'||instructions.length>500))throw new Player2Error('INVALID_SPEECH_REQUEST');
    const body={text,play_in_app:false,speed,voice_ids:[voiceId],audio_format:'wav'};if(instructions)body.advanced_voice={instructions};
    const started=performance.now(),r=await this.transport.json('/v1/tts/speak',{method:'POST',body,signal,resource:'npc-speech',maxBytes:33554432});
    if(typeof r.data!=='string'||!r.data||r.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(r.data))throw new Player2Error('INVALID_AUDIO_DATA');
    const audio=Buffer.from(r.data,'base64');if(audio.subarray(0,4).toString()!=='RIFF'||audio.subarray(8,12).toString()!=='WAVE')throw new Player2Error('UNEXPECTED_AUDIO_FORMAT');
    const elapsed=performance.now()-started;return {audio,contentType:'audio/wav',voiceId,metrics:{wholeAudioMs:elapsed,firstPlayableAudioMs:elapsed,bytes:audio.length,playback:'BUFFERED_CALLER_SINK'}};
  }
  async *streamAudio({text,voiceId,signal}={}){
    if(typeof text!=='string'||!text.trim()||text.length>2000||typeof voiceId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(voiceId))throw new Player2Error('INVALID_SPEECH_REQUEST');
    // Raw chunks are not automatically playable. Codec and sink are caller-owned.
    yield* this.transport.bytes('/v1/tts/eleven/text-to-speech/'+voiceId+'/stream',{method:'POST',body:{text},signal,resource:'npc-speech',accept:'application/octet-stream',maxBytes:16777216});
  }
}

export class PushToTalk {
  constructor(speech){this.speech=speech;this.starting=null;this.state='IDLE';}
  async press({signal,timeout=15,userGesture=false}={}){
    if(this.state!=='IDLE')throw new Player2Error('PTT_BUSY');this.state='STARTING';
    this.starting=this.speech.startRecording({signal,timeout,userGesture});
    try{await this.starting;this.state='RECORDING';}catch(e){this.state=this.speech.recordingUnknown?'UNKNOWN':'IDLE';throw e;}
  }
  async release({signal}={}){
    if(this.starting)await this.starting;if(this.state!=='RECORDING')throw new Player2Error('PTT_NOT_RECORDING');this.state='TRANSCRIBING';
    try{return await this.speech.stopRecording({signal});}finally{this.state=this.speech.recordingUnknown?'UNKNOWN':'IDLE';this.starting=null;}
  }
}
