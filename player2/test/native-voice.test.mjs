import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {VoiceIdentities} from '../voice-identity.mjs';import {NativeDialogueInterface} from '../native-interface.mjs';
test('voice preferences survive restart, catalogue reorder and save checkpoints without silently changing missing voices',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ls-voice-'));t.after(()=>fs.rmSync(dir,{recursive:true}));const file=path.join(dir,'voices.json');
 const voices=[{id:'voice-a'},{id:'voice-b'},{id:'voice-c'}],key={universe:'synthetic-universe',npcSeed:'18446744073709551001',voices};
 const ledger=new VoiceIdentities(file),id=ledger.choose(key);const reopened=new VoiceIdentities(file);assert.equal(reopened.choose({...key,voices:[...voices].reverse()}),id);
 const ids=new Set();for(let i=0;i<30;i++)ids.add(reopened.choose({...key,npcSeed:String(i)}));assert(ids.size>1);
 assert.throws(()=>reopened.choose({...key,voices:voices.filter(v=>v.id!==id)}),/SAVED_VOICE_UNAVAILABLE/);
 const stale=new VoiceIdentities(file);reopened.choose({...key,npcSeed:'99'});assert.throws(()=>stale.choose({...key,npcSeed:'100'}),/VOICE_LEDGER_CHANGED/);
 fs.writeFileSync(file+'.lock','other writer');assert.throws(()=>reopened.choose({...key,npcSeed:'101'}),/VOICE_LEDGER_IN_USE/);assert.equal(fs.readFileSync(file+'.lock','utf8'),'other writer');
});
test('native interface rejects foreign NPCs, caller-supplied paths and stale post-load completions',async()=>{
 const bridge=new NativeDialogueInterface();let complete,cancelled=0;
 const host={reader:{grant:{npcSeed:'123'}},cancel:()=>cancelled++,ask:()=>new Promise(r=>{complete=r;})};
 bridge.activate({host,npcSeed:'123'});const request={version:1,requestId:'test-id',loadToken:bridge.loadToken,npcSeed:'123',question:'Hello'};
 await assert.rejects(bridge.request({...request,npcSeed:'456'}),/INVALID_NATIVE_REQUEST/);
 await assert.rejects(bridge.request({...request,database:'secret.db'}),/INVALID_NATIVE_REQUEST/);
 const pending=bridge.request(request);bridge.beginLoad();complete({requestId:'test-id',text:'old reply'});await assert.rejects(pending,/STALE_NATIVE_REPLY/);assert(cancelled>0);
 await assert.rejects(bridge.request(request),/INVALID_NATIVE_REQUEST/);
});
