import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateRecorder} from '../md-generator.mjs';
import {harness} from './md-harness.mjs';
import {parseRecord} from '../log-format.mjs';

const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url)));
const xml=generateRecorder(config);
const ship={__type:'component',ref:'synthetic-host',class:'ship',exists:true,isplayerowned:true,seed:11n,idcode:'SYN-001',knownname:'Synthetic host',commander:null};
const npc={__type:'component',ref:'synthetic-npc',class:'npc',exists:true,isplayerowned:true,seed:22n,knownname:'Synthetic person',container:ship,roleobject:ship,assignedcontrolled:null,role:{name:'Crewman'},controlpost:null};
const event=h=>h.call('HandleProfileEvent',{Subject:npc,Host:ship,Type:'NPC_CREATED',Npc:true,Create:true});
const rows=h=>h.output.filter(r=>r.name.startsWith('profiles-')).map(r=>({file:r.name,...parseRecord(r.line)}));

test('older saved readiness cannot reach missing history state or append to the old file',()=>{
  const h=harness(xml,{ships:[ship],databaseState:'READY'});
  Object.assign(h.md,{$LSPReady:true,$LSPStopped:false,$LSPRun:'synthetic-old-run',$LSPProfileFile:'profiles-synthetic-old-run.log'});
  assert.equal(event(h),false);
  assert.equal(h.call('Write',{Body:"'ENTITY_EVENT|event_type=NPC_CREATED'"}),false);
  assert.equal(h.call('ProcessHistoryWork'),false);
  assert.equal(h.output.length,0);
  const identity=h.call('HistoryIdentity',{Object:npc});
  assert.equal(identity.get('$seed'),'');
  assert.equal(h.md.$LSPHistoryIdentities,undefined);
});

test('all tables and groups precede ready; events wait for the explicit matching-run signal',()=>{
  const h=harness(xml,{ships:[ship],databaseState:'READY'});
  let readyValue=false;
  Object.defineProperty(h.md,'$LSPReady',{get:()=>readyValue,set:value=>{
    if(value){
      for(const k of ['Identities','Contacts','MarineStates','OperationHosts','OutsiderExpiry'])assert.ok(h.md['$LSPHistory'+k] instanceof Map,k);
      for(const k of ['$LSPWatch','$LSPHistorySectors','$LSPHistoryOutsiders'])assert.ok(h.md[k],k);
      assert.equal(h.md.$LSPInitialisedRun,h.md.$LSPRun);
    }
    readyValue=value;
  }});
  h.cue('RunBoundary');h.call('Initialize');
  assert.equal(h.md.$LSPReady,true);assert.equal(h.md.$LSPEventsReady,false);
  assert.equal(event(h),false);assert.equal(rows(h).length,1);
  h.md.$LSPBusArmedRun='stale-run';
  assert.equal(h.cue('ProfileEventBusV2'),false);assert.equal(h.md.$LSPEventsReady,false);
  h.md.$LSPBusArmedRun=h.md.$LSPRun;
  h.deliverSignals();assert.equal(h.md.$LSPEventsReady,true);
  assert.equal(h.md.$LSPBusArmedRun,undefined,'arming is consumed once');
  assert.equal(event(h),true);
  assert.deepEqual(rows(h).map(r=>Number(r.fields.record)),[1,2]);
  assert.equal(rows(h)[1].run,h.md.$LSPRun);
});

test('load invalidation closes complete saved state before callbacks, replies and writes',()=>{
  const h=harness(xml,{ships:[ship],databaseState:'READY'});h.start();
  event(h);
  const oldRun=h.md.$LSPRun,oldId=h.cueVariables('UniverseIdentity').$Id,before=h.output.length;
  const checkpoint=h.cueVariables('UniverseIdentity');checkpoint.$CheckpointRun=oldRun;checkpoint.$CheckpointRecord=h.md.$LSPRecord;
  const savedRecord=checkpoint.$CheckpointRecord;
  h.cue('InvalidateLoadedRecorder');
  assert.equal(event(h),false);
  assert.equal(h.call('Write',{Body:"'ENTITY_EVENT|event_type=NPC_CREATED'"}),false);
  assert.equal(h.call('DatabaseReply',{Response:[oldRun,h.md.$LSPUniverseIdText,'READY',h.md.$LSPRecord]}),false);
  assert.equal(h.cue('ProfileEvent0'),false,'legacy listener is an inactive placeholder');
  assert.equal(h.cue('ProfileEventV2_0'),false,'current child is cancelled by its parent');
  assert.equal(h.output.length,before);
  h.cue('RunBoundary');h.cue('Bootstrap');
  assert.notEqual(h.md.$LSPRun,oldRun);assert.equal(h.cueVariables('UniverseIdentity').$Id,oldId);
  assert.equal(h.md.$LSPParentRun,oldRun);assert.equal(h.md.$LSPParentRecord,savedRecord);
  event(h);
  assert.deepEqual(rows(h).slice(-2).map(r=>r.fields.record),['1','2']);
  assert.equal(rows(h).at(-1).run,h.md.$LSPRun);
  assert.equal(rows(h).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);
});

test('partial history state fails closed, including direct boarding and identity calls',()=>{
  for(const field of ['Identities','Contacts','OperationHosts','MarineStates','OutsiderExpiry']){
    const h=harness(xml,{ships:[ship],databaseState:'READY'});h.start();
    const before=h.output.length;delete h.md['$LSPHistory'+field];
    assert.equal(event(h),false);
    assert.equal(h.call('RecordHistoryBoarding',{Operation:null,Type:'BOARDING_STARTED'}),false);
    assert.equal(h.call('RecordHistoryEvent',{Subject:ship,Type:'ATTACKED'}),false);
    assert.equal(h.call('Tick'),false);
    assert.equal(h.output.length,before);
  }
});

test('retired listener names stay inactive; migration covers every saved cue state and preserves identity',()=>{
  for(const state of ['waiting','active','complete','cancelled']){
    const h=harness(xml,{ships:[ship],databaseState:'READY'});h.start();
    const identity=structuredClone(h.cueVariables('UniverseIdentity'));
    assert.equal(h.patchCue('ProfileEventBus',state),1);
    assert.equal(h.md.$LSPReady,false);assert.equal(h.md.$LSPEventsReady,false);
    assert.equal(h.cue('ProfileEventBus'),false,'retired bus cannot reactivate');
    assert.deepEqual(h.cueVariables('UniverseIdentity'),identity);
    assert.equal(h.patchCue('ProfileEventBus',state,1),0,'version patch is not a per-load mechanism');
    assert.equal(event(h),false);
  }
  const retired=harness(xml).tree.children[0].children[0].children.find(n=>n.attrs.name==='ProfileEventBus');
  assert.ok(retired);
  const children=retired.children.find(n=>n.tag==='cues').children;
  assert.equal(children.length,48);
  assert.ok(children.every(n=>n.attrs.instantiate==='false' && n.children[0].children[0].attrs.value==='false'));
});
