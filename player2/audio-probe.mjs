import {Player2Error} from './transport.mjs';

// Decode PCM16 samples, rather than treating a RIFF signature as playback proof.
export function decodeWav(bytes){
  const b=Buffer.from(bytes);if(b.length<12||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')throw new Player2Error('UNEXPECTED_AUDIO_FORMAT');
  const end=b.readUInt32LE(4)+8;if(end!==b.length)throw new Player2Error('INCOMPLETE_WAV');let fmt,data;
  for(let i=12;i+8<=end;){const size=b.readUInt32LE(i+4),next=i+8+size;if(next>end)throw new Player2Error('INCOMPLETE_WAV');const tag=b.toString('ascii',i,i+4);if(tag==='fmt '){if(size<16)throw new Player2Error('INVALID_WAV');fmt=b.subarray(i+8,next);}if(tag==='data')data=b.subarray(i+8,next);i=next+(size%2);}
  if(!fmt||!data||fmt.readUInt16LE(0)!==1||fmt.readUInt16LE(14)!==16)throw new Player2Error('UNSUPPORTED_WAV_CODEC');
  const channels=fmt.readUInt16LE(2),sampleRate=fmt.readUInt32LE(4),align=fmt.readUInt16LE(12);
  if(!channels||channels>8||sampleRate<8000||sampleRate>192000||align!==channels*2||fmt.readUInt32LE(8)!==sampleRate*align||!data.length||data.length%align)throw new Player2Error('INVALID_WAV');
  const samples=data.length/align;let peak=0;for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)/32768));
  return {codec:'PCM16',channels,sampleRate,samples,durationMs:samples/sampleRate*1000,peak};
}

// Optional development-only decoder; no system audio device is opened.
export async function mpegProbe(){
  const {MPEGDecoder}=await import('mpg123-decoder');const decoder=new MPEGDecoder();await decoder.ready;
  let total=0,rate=null,channels=null,errors=0;
  return {push(chunk){const r=decoder.decode(chunk);errors+=r.errors.length;if(r.samplesDecoded){if(rate!==null&&(rate!==r.sampleRate||channels!==r.channelData.length))throw new Player2Error('AUDIO_FORMAT_CHANGED');rate=r.sampleRate;channels=r.channelData.length;if(!rate||r.channelData.some(c=>c.length!==r.samplesDecoded||c.some(v=>!Number.isFinite(v))))throw new Player2Error('INVALID_DECODED_AUDIO');total+=r.samplesDecoded;}return {samples:r.samplesDecoded,sampleRate:rate,errors};},summary(){return {codec:'MPEG',samples:total,sampleRate:rate,channels,decodeErrors:errors,durationMs:rate?total/rate*1000:null};},close(){decoder.free();}};
}
