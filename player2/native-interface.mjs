// Prepared protocol boundary only. It is not registered with the live X4 UI.
import {randomUUID} from 'node:crypto';
import {Player2Error} from './transport.mjs';

export class NativeDialogueInterface {
  constructor(){this.loadToken=randomUUID();this.host=null;this.npcSeed=null;}
  beginLoad(){this.host?.cancel();this.host=null;this.npcSeed=null;this.loadToken=randomUUID();return this.loadToken;}
  activate({host,npcSeed}){
    if(typeof npcSeed!=='string'||!/^[0-9]+$/.test(npcSeed)||host.reader.grant.npcSeed!==npcSeed)throw new Player2Error('NPC_GRANT_MISMATCH');
    this.host?.cancel();this.host=host;this.npcSeed=npcSeed;
  }
  async request(input,{selection,focus=null,requireFocus=false}={}){
    if(!input||Object.keys(input).some(k=>!['version','requestId','loadToken','npcSeed','question'].includes(k))||typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(input.requestId)||input.version!==1||input.loadToken!==this.loadToken||input.npcSeed!==this.npcSeed||!this.host)throw new Player2Error('INVALID_NATIVE_REQUEST');
    const token=this.loadToken,host=this.host;const result=await host.ask({question:input.question,requestId:input.requestId,selection,focus,requireFocus});
    if(token!==this.loadToken||host!==this.host)throw new Player2Error('STALE_NATIVE_REPLY');
    return {version:1,loadToken:token,requestId:result.requestId,npcSeed:this.npcSeed,speaker:result.speaker,text:result.text,status:result.status,evidenceRefs:result.evidenceRefs};
  }
}
