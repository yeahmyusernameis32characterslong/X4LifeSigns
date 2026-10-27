import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {harness,parseXml} from './md-harness.mjs';
const xml=fs.readFileSync(new URL('../../extensions/lifesigns_npc_kill_reputation/md/LifeSigns_NpcKillReputation.xml',import.meta.url),'utf8');
const target='md.Notifications.AccumulateRewards';
const sector={ref:'incident-sector'},elsewhere={ref:'another-sector'};
const faction=()=>({ref:'beneficiary',isprotective:true,isrelationlocked:false});
const ship=(size='ship_s',owned=true)=>({ref:'killer',idcode:'synthetic-killer',classes:[size,'ship','object','defensible','destructible'],isplayerowned:owned,sector});
const victim=()=>({ref:'victim',idcode:'synthetic-victim',classes:['ship','ship_m','object','defensible','destructible'],owner:'xenon',isvisitor:false,isrelationchangedisabled:false,relationchange:{killfaction:{bonus:0.00017}}});
function station(killer,distance=10000,owner=faction()){
 return {ref:'station-'+distance,idcode:'synthetic-station',owner,sector,maxradarrange:40000,distanceto:new Map([[killer,distance]]),hasrelation:{enemy:new Map([['xenon',true]])},tradenpc:{owner,page:101}};
}
// This is a synthetic implementation of the native query boundary, not native scheduling.
function setup(killer=ship(),killed=victim(),candidates=[station(killer)],options={}){
 const requests=[],queries=[];
 const h=harness(xml,{playerState:{controlled:options.controlled??{ref:'player-elsewhere'},sector:elsewhere},stationQuery:(node,ev)=>{
   queries.push(node);
   return candidates.filter(s=>s.sector===ev(node.attrs.space)&&node.children.every(n=>{
     if(n.tag==='match'){const same=s.owner===ev(n.attrs.owner);return n.attrs.negate==='true'?!same:same;}
     if(n.tag==='match_relation_to')return s.hasrelation.enemy.get(ev(n.attrs.faction))===true;
     if(n.tag==='match_distance')return s.distanceto.get(ev(n.attrs.object))<=ev(n.attrs.max);
     throw Error('Unexpected query predicate '+n.tag);
   }));
 },nativeCues:{[target]:p=>requests.push(p)}});
 h.md.Notifications={IllegalActivity:{$rewardnpcs:[],$rewardnpcdata:[]}};
 const deliver=()=>{h.cueVariables('NpcShipKillReputationV1').event={param:killer,param2:killed,param3:'hitbybullet'};return h.cue('NpcShipKillReputationV1');};
 return {h,requests,queries,deliver,killer,killed,candidates};
}
test('remote NPC ship kill requests native reputation with both bounty paths suppressed',()=>{
 const f=setup();f.deliver();assert.equal(f.requests.length,1);
 assert.deepEqual(f.requests[0],[f.candidates[0].tradenpc,f.killed,true,false,'destroyedfactionenemy',true,0]);
 assert.equal(f.h.player.sector,elsewhere);assert.equal(f.queries[0].attrs.space,'$Killer.sector');
 assert.equal(f.queries[0].children.find(n=>n.tag==='match_distance').attrs.max,'30km');
 assert.match(f.h.traces[0],/reputation queued/);assert.match(f.h.traces[0],/additional_bounty=false/);
});
test('personally controlled killer is excluded before any station lookup; standing aboard is not personal control',()=>{
 const killer=ship(),personal=setup(killer,victim(),[station(killer)],{controlled:killer});
 personal.deliver();assert.equal(personal.queries.length,0);assert.equal(personal.requests.length,0);
 const aboard=setup(killer);aboard.h.player.occupiedship=killer;aboard.deliver();assert.equal(aboard.requests.length,1);
});
test('only player-owned standard S/M/L/XL ships qualify, not stations or deployables',()=>{
 for(const size of ['ship_s','ship_m','ship_l','ship_xl']){const f=setup(ship(size));f.deliver();assert.equal(f.requests.length,1,size);}
 for(const size of ['ship_xs','station','lasertower','missile','navbeacon']){const f=setup(ship(size));f.deliver();assert.equal(f.requests.length,0,size);}
 const f=setup(ship('ship_l',false));f.deliver();assert.equal(f.queries.length,0);
});
test('whole-object native victim gates reject components, own ships, ownerless, visitors and disabled relation changes',()=>{
 const cases=[v=>v.classes=['engine','destructible'],v=>v.owner='player',v=>v.owner='ownerless',v=>v.owner=null,v=>v.isvisitor=true,v=>v.isrelationchangedisabled=true];
 for(const mutate of cases){const v=victim();mutate(v);const f=setup(ship(),v);f.deliver();assert.equal(f.requests.length,0);assert.equal(f.queries.length,0);}
});
test('missing references and nonpositive native bonuses fail closed without writes',()=>{
 for(const bonus of [0,-0.1,null]){const v=victim();v.relationchange.killfaction.bonus=bonus;const f=setup(ship(),v);f.deliver();assert.equal(f.requests.length,0);}
 for(const [killer,killed]of [[null,victim()],[ship(),null],[{},{}]]){const f=setup(ship());f.h.cueVariables('NpcShipKillReputationV1').event={param:killer,param2:killed};assert.doesNotThrow(()=>f.h.cue('NpcShipKillReputationV1'));assert.equal(f.requests.length,0);}
});
test('nearest eligible protective station wins once, with faction locks, radar and NPC eligibility respected',()=>{
 const killer=ship(),near=station(killer,1000),valid=station(killer,6000),far=station(killer,9000);
 near.owner.isrelationlocked=true;
 const noNpc=station(killer,2000);noNpc.tradenpc=null;
 const pageZero=station(killer,2500);pageZero.tradenpc.page=0;
 const nonprotective=station(killer,3000);nonprotective.owner.isprotective=false;
 const outsideRadar=station(killer,4000);outsideRadar.maxradarrange=3000;
 const f=setup(killer,victim(),[far,near,noNpc,pageZero,nonprotective,outsideRadar,valid]);f.deliver();
 assert.equal(f.requests.length,1);assert.equal(f.requests[0][0],valid.tradenpc);
});
test('native query excludes wrong sector, distant stations, own/no-owner stations and non-enemies',()=>{
 const killer=ship(),own=station(killer,1000,'player'),unowned=station(killer,2000,null),distant=station(killer,30001),wrongSector=station(killer,1000),neutral=station(killer,4000);
 wrongSector.sector=elsewhere;neutral.hasrelation.enemy.set('xenon',false);
 const f=setup(killer,victim(),[own,unowned,distant,wrongSector,neutral]);f.deliver();assert.equal(f.requests.length,0);
});
test('uninitialised or incompatible native reward queues are not called',()=>{
 for(const invalid of [undefined,null,{},{$rewardnpcs:[]},{$rewardnpcs:null,$rewardnpcdata:[]}]){const f=setup();f.h.md.Notifications.IllegalActivity=invalid;assert.doesNotThrow(f.deliver);assert.equal(f.requests.length,0);assert.equal(f.queries.length,0);}
});
test('one native kill listener has no load replay, hit hooks, polling or extra award routes',()=>{
 const tags=[];function walk(n){tags.push(n.tag);n.children.forEach(walk);}walk(parseXml(xml));
 assert.deepEqual(tags.filter(t=>t.startsWith('event_')),['event_player_owned_killed_object']);
 assert.equal(tags.filter(t=>t==='signal_cue_instantly').length,1);
 for(const t of ['transfer_money','set_faction_relation','add_faction_relation','change_relation_on_kill','debug_to_file','event_game_loaded'])assert.ok(!tags.includes(t));
 const f=setup();assert.doesNotThrow(()=>f.h.cue('NpcShipKillReputationV1'));assert.equal(f.requests.length,0);
 const fresh=setup();assert.equal(fresh.requests.length,0);fresh.deliver();assert.equal(fresh.requests.length,1);
});
