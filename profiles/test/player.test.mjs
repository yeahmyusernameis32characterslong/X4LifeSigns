import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateRecorder} from '../../recorder/md-generator.mjs';
import {harness} from '../../recorder/test/md-harness.mjs';
import {parseRecord,escapeValue} from '../../recorder/log-format.mjs';
import {ProfileConsumer} from '../service.mjs';

const config=JSON.parse(fs.readFileSync(new URL('../../recorder/config.json',import.meta.url)));
const sector={__type:'component',exists:true,class:'sector',ref:'sector',name:'Synthetic sector'};
const ship={__type:'component',exists:true,class:'ship',ref:'ship',seed:9223372036854775807n,idcode:'SYN-001',knownname:'Synthetic ship',sector,isplayerowned:true};
const playerState={name:'Synthetic | player\nname',sector,container:ship,occupiedship:ship,controlled:ship,spacesuit:null};
const raw=h=>h.output.filter(r=>r.name.startsWith('profiles-')).map(r=>parseRecord(r.line));
const playerFields=h=>Object.fromEntries(raw(h).filter(r=>r.kind==='VALUE'&&r.fields.profile==='1').map(r=>[r.fields.field,r.fields]));
function setup(state=playerState,extra={}){
  const h=harness(generateRecorder(config),{databaseState:'READY',playerState:state,...extra});h.start();h.call('Tick');return h;
}

test('player profile identifies actual pilot-seat control independently of NPC discovery',()=>{
  const h=setup();const f=playerFields(h);
  assert.equal(raw(h).filter(r=>r.kind==='PROFILE_BEGIN'&&r.fields.kind==='PLAYER').length,1);
  assert.equal(f.is_player.value,'true');assert.equal(f.name.value,playerState.name);
  assert.equal(f.seed.value,'1234567890123456789');assert.equal(f.player_state.value,'PILOTING_SHIP');
  assert.equal(f.occupied_ship_seed.value,'9223372036854775807');assert.equal(f.occupied_ship_idcode.value,'SYN-001');
  assert.equal(f.container_idcode.value,'SYN-001');assert.equal(f.sector_name.value,sector.name);
  assert.equal(h.callCounts.NpcProfile||0,0);assert.equal(h.callCounts.DiscoveryStep||0,0);
  assert.equal(raw(h).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);
  h.player.age+=100;h.call('Tick');assert.equal(raw(h).filter(r=>r.kind==='PROFILE_BEGIN').length,1);
});

test('being aboard and controlling another object do not imply occupying the pilot seat',()=>{
  const h=setup({...playerState,occupiedship:null});const f=playerFields(h);
  assert.equal(f.player_state.value,'ABOARD_SHIP');assert.equal(f.occupied_ship_seed.state,'NO_PILOT_SEAT_SHIP');
  assert.equal(f.controlled_object_seed.value,String(ship.seed));
  const unknown={...playerState};delete unknown.occupiedship;
  const u=setup(unknown);delete u.player.occupiedship;u.md.$LSPPlayerObserved=false;u.md.$LSPPlayerDirty=true;u.md.$LSPProfile=0;
  u.output.length=0;u.call('ProcessPlayerObservation');
  assert.equal(playerFields(u).occupied_ship_seed.state,'UNAVAILABLE');
});

test('missing player identity waits safely and a later ready player can still be profiled',()=>{
  const h=setup({...playerState,entity:null});assert.equal(raw(h).some(r=>r.kind==='PROFILE_BEGIN'),false);
  h.player.entity={__type:'component',exists:true,ref:'late-player',seed:-9223372036854775807n,debugname:'Synthetic player',race:{name:'Synthetic race'}};
  h.cue('Bootstrap');h.call('Tick');assert.equal(playerFields(h).seed.value,'-9223372036854775807');
});

test('old ready universe gains a player profile without rewriting its existing NPC baseline',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-player-upgrade-'));const replies=path.join(root,'replies');fs.mkdirSync(replies);
  const consumer=new ProfileConsumer({root,replyDirectory:replies});
  t.after(()=>{consumer.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});});
  const id='lsu1-2000-01-01_00-00-00-1-2-3-4',old='session-1-2-loaded-2000-01-01_00-00-00';
  const make=(n,kind,fields={})=>`LSEV1|run=${old}|session=UNAVAILABLE|seq=1|age=1|${kind}|${Object.entries({...fields,record:String(n)}).map(([k,v])=>`${k}=${escapeValue(v)}`).join('|')}|END`;
  const legacy=[make(1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:id,parent_run:'NONE',parent_record:'0'}),make(2,'SNAPSHOT_BEGIN'),make(3,'PROFILE_BEGIN',{kind:'NPC',profile:'1'}),make(4,'VALUE',{profile:'1',field:'seed',value:'99',state:'PRESENT',type:'largeint'}),make(5,'VALUE',{profile:'1',field:'name',value:'Synthetic existing NPC',state:'PRESENT',type:'string'}),make(6,'PROFILE_END',{profile:'1',partial:'false'}),make(7,'SNAPSHOT_END',{profiles:'1',partial:'false'})];
  assert.equal(consumer.consume(legacy).at(-1).state,'READY');
  const h=harness(generateRecorder(config),{autoDatabase:false,playerState,savedCueState:{UniverseIdentity:{$Id:id,$CheckpointRun:old,$CheckpointRecord:7}},randomStart:50});h.start();let cursor=0;
  function deliver(){const rows=h.output.slice(cursor).filter(x=>x.name.startsWith('profiles-')).map(x=>x.line);cursor=h.output.length;for(const status of consumer.consume(rows))h.call('DatabaseReply',{Response:[status.run,status.universe,status.state,status.record]});}
  deliver();h.call('Tick');deliver();const store=consumer.stores.get(h.md.$LSPRun);
  assert.equal(store.status().state,'READY');assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,1);
  assert.equal(store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.deepEqual(store.profilesAt().map(p=>p.kind).sort(),['NPC','PLAYER']);
  assert.equal(store.profilesAt().find(p=>p.kind==='NPC').fields.name.value,'Synthetic existing NPC');
  assert.equal(raw(h).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);assert.equal(h.notifications.length,0);
  assert.equal(store.profilesAt(old,7).some(p=>p.kind==='PLAYER'),false,'new profile must not appear in an earlier checkpoint');
  const saved=structuredClone(h.cueVariables('UniverseIdentity'));delete saved.parent;
  const reload=harness(generateRecorder(config),{autoDatabase:false,playerState,savedCueState:{UniverseIdentity:saved},randomStart:100});reload.start();cursor=0;
  const lines=()=>reload.output.slice(cursor).filter(x=>x.name.startsWith('profiles-')).map(x=>x.line);
  for(const s of consumer.consume(lines()))reload.call('DatabaseReply',{Response:[s.run,s.universe,s.state,s.record]});cursor=reload.output.length;
  reload.call('Tick');consumer.consume(lines());const next=consumer.stores.get(reload.md.$LSPRun);
  assert.equal(next.profilesAt().filter(p=>p.kind==='PLAYER').length,1);assert.equal(raw(reload).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);
});
