import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {harness} from '../recorder/test/md-harness.mjs';
// This reads, but never distributes or writes, the owner's extracted native source.
const directory=process.argv[2];if(!directory)throw Error('Usage: node scripts/check-npc-reputation-native.mjs <extracted-native-source>');
const source=fs.readFileSync(path.join(directory,'md/notifications.xml'),'utf8');
const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,'md/notifications.xml'))).digest('hex');
assert.equal(sha,'3262d56ca654e2bb94d210cf64a85fca15553216c3ef71c19929f6832ad2400a','Reverify native contract for this game version before updating the pin');
function cue(name){const match=source.match(new RegExp('<cue name="'+name+'"[\\s\\S]*?</cue>'));assert.ok(match,name);return match[0];}
const native='<mdscript><cues><cue name="IllegalActivity"><actions /></cue>'+cue('AccumulateRewards')+cue('IllegalActivityReward')+'</cues></mdscript>';
function exercise({relation=0.02,suppress=true,existing=false}={}){
 const faction={ref:'beneficiary',relationto:new Map([['player',relation]])},npc={ref:'reward-npc',knownname:'Synthetic recipient',owner:faction},killed={ref:'victim',idcode:'synthetic-victim',knownname:'Synthetic victim',relationchange:{killfaction:{bonus:0.00017},policefaction:{bounty:1500}}};
 const changes=[],money=[];
 const h=harness(native,{age:100,nativeActions:{
  add_faction_relation:(a,ev)=>changes.push({kind:'add',value:ev(a.value),reason:ev(a.reason)}),
  set_faction_relation:(a,ev)=>changes.push({kind:'set',value:ev(a.value),reason:ev(a.reason)}),
  transfer_money:(a,ev)=>money.push(ev(a.amount))
 }});
 const queues=h.cueVariables('IllegalActivity');queues.$rewardnpcs=existing?[npc]:[];queues.$rewardnpcdata=existing?[[npc,80,125,0.0001,1500,'destroyedfactionenemy']]:[];
 h.cueVariables('AccumulateRewards').event={param:[npc,killed,true,false,'destroyedfactionenemy',suppress,0]};h.cue('AccumulateRewards');
 assert.equal(queues.$rewardnpcdata.length,1);const data=queues.$rewardnpcdata[0];
 if(!existing){h.cueVariables('IllegalActivityReward').event={param:data};if(suppress)h.cue('IllegalActivityReward');}
 return {data,changes,money,killed};
}
const positive=exercise();assert.equal(positive.data[3],positive.killed.relationchange.killfaction.bonus);assert.ok(!positive.data[4]);assert.deepEqual(positive.money,[]);assert.deepEqual(positive.changes,[{kind:'add',value:0.00017,reason:'destroyedfactionenemy'}]);
const negative=exercise({relation:-0.02});assert.equal(negative.changes[0].kind,'set');assert.ok(Math.abs(negative.changes[0].value-(-0.02*0.1**(0.00017/0.006401)))<1e-14);assert.deepEqual(negative.money,[]);
const merged=exercise({existing:true});assert.equal(merged.data[4],1500,'NPC request must not increase an existing legitimate bounty');assert.ok(Math.abs(merged.data[3]-0.00027)<1e-14);
const unsafe=exercise({suppress:false});assert.equal(unsafe.data[4],500,'The actual native fallback must be detected by this fixture');
console.log(JSON.stringify({nativeSourceSha256:sha,positiveNativeBonus:true,negativeNativeScaling:true,noAdditionalMoney:true,existingBountyUnchanged:true,unsafeOneThirdFallbackDetected:true,scope:'Actual native cue actions in synthetic interpreter; not X4 scheduling or engine execution'}));
