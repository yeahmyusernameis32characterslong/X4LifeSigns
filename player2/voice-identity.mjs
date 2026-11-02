import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {checkPath} from '../bridge/src/session-path.js';
import {Player2Error} from './transport.mjs';

// A separate local preference ledger, never a second canonical history database.
export class VoiceIdentities {
  constructor(file){
    this.file=path.resolve(file);checkPath(path.dirname(this.file),{directory:true});
    this.data={version:1,voices:{}};
    if(fs.existsSync(this.file)){checkPath(this.file);if(fs.statSync(this.file).size>1048576)throw new Player2Error('VOICE_LEDGER_LIMIT');this.data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(this.data.version!==1||!this.data.voices||typeof this.data.voices!=='object'||Array.isArray(this.data.voices))throw new Player2Error('INVALID_VOICE_LEDGER');}
  }
  choose({universe,npcSeed,voices,preferredId=null}){
    if(typeof universe!=='string'||!universe||universe.length>200||typeof npcSeed!=='string'||!/^[0-9]+$/.test(npcSeed)||!Array.isArray(voices))throw new Player2Error('INVALID_VOICE_IDENTITY');
    const available=[...new Set(voices.map(v=>v.id).filter(v=>typeof v==='string'&&v&&v.length<256))].sort();
    if(!available.length)throw new Player2Error('NO_VOICES_AVAILABLE');
    const key=createHash('sha256').update(JSON.stringify([universe,npcSeed])).digest('hex'),old=this.data.voices[key];
    if(preferredId!==null&&!available.includes(preferredId))throw new Player2Error('VOICE_NOT_AVAILABLE');
    if(old&&preferredId===null){if(typeof old!=='string'||!available.includes(old))throw new Player2Error('SAVED_VOICE_UNAVAILABLE');return old;}
    const id=preferredId||available[Number(BigInt('0x'+key)%BigInt(available.length))];
    // Refuse stale concurrent writers instead of overwriting another preference.
    if(fs.existsSync(this.file)){checkPath(this.file);const current=JSON.parse(fs.readFileSync(this.file,'utf8'));if(JSON.stringify(current)!==JSON.stringify(this.data))throw new Player2Error('VOICE_LEDGER_CHANGED');}
    const next={version:1,voices:{...this.data.voices,[key]:id}},temp=this.file+'.'+randomUUID()+'.tmp';
    try{fs.writeFileSync(temp,JSON.stringify(next,null,2),{flag:'wx',mode:0o600});fs.renameSync(temp,this.file);this.data=next;}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
    return id;
  }
}
