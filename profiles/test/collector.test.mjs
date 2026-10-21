import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateRecorder } from '../../recorder/md-generator.mjs';
import { harness } from '../../recorder/test/md-harness.mjs';
import { ProfileConsumer } from '../service.mjs';
import { CREATED } from '../../recorder/profile-messages.mjs';

test('generated collector and real SQLite handshake create once, then skip baseline after saved-state reload', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifesigns-profile-e2e-')); const replies = path.join(root, 'replies'); fs.mkdirSync(replies);
  const consumer = new ProfileConsumer({ root, replyDirectory: replies });
  t.after(() => { consumer.close(); assert.equal(path.dirname(root), path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true }); });
  const config = JSON.parse(fs.readFileSync(new URL('../../recorder/config.json', import.meta.url)));
  const ship = { __type:'component', exists:true, class:'ship', ref:'synthetic-ship', isplayerowned:true, seed:9223372036854775807n, idcode:'SYN-001', knownname:'Synthetic ship' };
  const h = harness(generateRecorder(config), { autoDatabase:false, ships:[ship] }); h.start();
  let cursor = 0;
  const deliver = context => {
    const output = context.output.slice(cursor).filter(x=>x.name.startsWith('profiles-')).map(x=>x.line); cursor = context.output.length;
    for(const status of consumer.consume(output)) context.call('DatabaseReply',{Response:[status.run,status.universe,status.state,status.record]});
  };
  deliver(h); assert.equal(h.md.$LSPNeedBaseline,true); assert.equal(h.notifications.length,0);
  for(let i=0;i<1000&&!h.notifications.some(n=>n.text===CREATED);i++){h.player.age+=0.1;h.call('Tick');deliver(h);}
  assert.equal(h.notifications.at(-1).text,CREATED);
  const store=consumer.stores.get(h.md.$LSPRun);assert.equal(fs.existsSync(store.final),true);assert.equal(store.profilesAt()[0].seed,'9223372036854775807');
  ship.knownname='Renamed | 船';
  h.call('RecordNameObservation',{Object:ship,Before:'Synthetic ship',BeforeState:'PRESENT',Requested:ship.knownname,Source:'MAP_INFO_EDIT'});deliver(h);
  assert.equal(store.profilesAt()[0].fields.name.value,ship.knownname);assert.equal(store.eventsAt()[0].event_type,'NAME_CHANGED');
  const savedCueState={UniverseIdentity:structuredClone(Object.fromEntries(Object.entries(h.cueVariables('UniverseIdentity')).filter(([k])=>k!=='parent')))};
  const next=harness(generateRecorder(config),{autoDatabase:false,ships:[ship],savedCueState,randomStart:100});next.start();cursor=0;deliver(next);
  assert.equal(next.md.$LSPDatabaseState,'READY');assert.equal(next.md.$LSPNeedBaseline,false);
  for(let i=0;i<100;i++){next.player.age+=1;next.call('Tick');deliver(next);}
  assert.equal(next.notifications.length,0);assert.equal(next.output.some(x=>x.line.includes('|SNAPSHOT_BEGIN|')),false);
  const nextStore=consumer.stores.get(next.md.$LSPRun);assert.equal(nextStore.profilesAt()[0].seed,'9223372036854775807');
  assert.equal(nextStore.profilesAt()[0].fields.name.value,ship.knownname);assert.equal(nextStore.eventsAt()[0].fields.old_name,'Synthetic ship');
  assert.equal(nextStore.db.prepare('SELECT count(*) AS n FROM sessions').get().n,2);
});
