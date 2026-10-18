import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generateRecorder } from '../md-generator.mjs';
import { parseRecord } from '../log-format.mjs';
import { harness } from './md-harness.mjs';
import { lightEvents } from '../catalog.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const ship = (ref = '{fixture}') => ({ __type: 'component', ref, exists: true, class: 'ship', idcode: 'FIXTURE', knownname: 'Invented fixture', owner: 'player', trueowner: 'player', sector: null, container: null, isplayerowned: true, people: { list: [] }, roleentities: [] });
const create = (env = {}, overrides = {}) => { const h = harness(generateRecorder({ ...config, ...overrides }), env); h.start(); return h; };
const rows = h => h.output.map(x => ({ name: x.name, ...parseRecord(x.line) }));

test('pseudo-aware harness rejects the former intermediate assignment and preserves terminal false/zero/null', () => {
  const a = ship(), template = { __type: 'npctemplate', text: 'invented-template' };
  a.people = new Map([['list', [template]], [template, { exists: true, seed: 0, role: null, isintransit: false, istransferscheduled: false, istemporary: false }]]);
  const source = generateRecorder(config);
  const regression = source.replace('exact="$People.{$Index}" />', 'exact="$Asset.people.{$People.{$Index}}" />');
  assert.notEqual(regression, source);
  const old = harness(regression); old.start();
  assert.throws(() => old.call('Asset', { Asset: a, Seq: 1, Trigger: 'EVENT' }), /Cannot store contextual pseudo-type/);
  const h = create(); h.call('Asset', { Asset: a, Seq: 1, Trigger: 'EVENT' });
  const r = rows(h), field = suffix => r.find(x => x.fields.field === 'asset.people.1.' + suffix)?.fields;
  assert.equal(field('seed').value, '0'); assert.equal(field('role').state, 'NULL');
  assert.equal(field('isintransit').value, 'false');
  assert.equal(r.at(-1).fields.partial, 'false');
  delete a.people.get(template).seed;
  h.call('Asset', { Asset: a, Seq: 2, Trigger: 'EVENT' });
  assert.equal(rows(h).find(x => x.seq === '2' && x.fields.field === 'asset.people.1.seed').fields.state, 'UNAVAILABLE');
  assert.equal(rows(h).at(-1).fields.partial, 'true');
  a.people.get(template).exists = false;
  h.call('Asset', { Asset: a, Seq: 3, Trigger: 'EVENT' });
  assert.equal(rows(h).find(x => x.seq === '3' && x.fields.field === 'asset.people.1.entry').fields.state, 'UNAVAILABLE');
  assert.equal(rows(h).at(-1).fields.partial, 'true');
});

test('two-million default has one additional stop marker and an independent coupled diagnostic allowance', () => {
  assert.equal(config.maxRowsPerRun, 2000000);
  const h = create(); h.md.$LSERWrites = config.maxRowsPerRun - 1;
  h.call('Write', { Body: 'FIXTURE', Seq: 1 });
  assert.equal(h.md.$LSERWrites, 2000000); assert.equal(h.md.$LSERStopped, false);
  h.call('Write', { Body: 'OVERFLOW', Seq: 1 });
  h.call('Write', { Body: 'SUPPRESSED', Seq: 1 });
  assert.equal(h.md.$LSERWrites, 2000001); assert.equal(h.md.$LSERStopped, true);
  assert.equal(rows(h).filter(x => x.kind === 'LIMIT').length, 1);
  assert.equal(rows(h).some(x => x.kind === 'OVERFLOW'), false);
  h.md.$LSERDiagnosticWrites = config.maxRowsPerRun - 1;
  h.call('Write', { Body: 'HEALTH', Seq: 1, Diagnostic: true, Level: 3 });
  h.call('Write', { Body: 'HEALTH', Seq: 1, Diagnostic: true, Level: 3 });
  assert.equal(h.md.$LSERDiagnosticWrites, 2000000);
});

test('rich traversal deduplicates actual components within one occurrence, never native values or later events', () => {
  const a = ship(), b = ship(); // Deliberately identical labels/reference text, distinct components.
  const h = create({ ships: [a, b] });
  const capture = () => h.call('Capture', { Name: 'event_object_changed_owner', Scope: 'assets', Values: [a, a, b, null], Available: [true, true, true, true], Age: 1 });
  capture(); capture();
  const r = rows(h);
  for (const seq of ['1', '2']) {
    const event = r.filter(x => x.seq === seq);
    assert.equal(event.filter(x => x.kind === 'ASSET_BEGIN').length, 2);
    assert.equal(event.filter(x => x.kind === 'ASSET_ALIAS').length, 1);
    assert.equal(event.find(x => x.kind === 'ASSET_ALIAS').fields.target, 'affected.1');
    for (const field of ['object', 'param', 'param2', 'param3']) assert.ok(event.some(x => x.kind === 'VALUE' && x.fields.field === field));
  }
});

test('all six frequent families retain every occurrence and typed context without personnel getters; critical families stay rich', () => {
  const a = ship();
  Object.defineProperty(a, 'people', { get() { throw new Error('Unexpected rich traversal'); } });
  Object.defineProperty(a, 'roleentities', { get() { throw new Error('Unexpected rich traversal'); } });
  const h = create({ ships: [a] });
  for (const Name of lightEvents) for (let i = 0; i < 2; i++) h.call('Capture', { Name, Scope: 'assets', Values: [a, i, false, null], Available: [true, true, true, true], Age: 1 });
  const r = rows(h);
  assert.equal(r.filter(x => x.kind === 'EVENT_BEGIN').length, 12);
  assert.equal(r.filter(x => x.kind === 'EVENT_END').length, 12);
  assert.equal(r.some(x => x.kind === 'ASSET_BEGIN'), false);
  assert.ok(r.filter(x => x.kind === 'EVENT_BEGIN').every(x => x.fields.asset_policy === 'LIGHT_CONTEXT'));
  assert.equal(r.filter(x => x.fields.field === 'object.owner' && x.fields.value === 'player').length, 12);
  assert.equal(r.filter(x => x.fields.field === 'param2' && x.fields.value === 'false').length, 12);
  const rich = create({ ships: [ship()] });
  for (const Name of ['event_object_destroyed', 'event_object_changed_owner', 'event_control_entity_removed', 'event_object_commander_set']) rich.call('Capture', { Name, Scope: 'assets', Values: [rich.md.$LSERAssetList[0], null, null, null], Available: [true, true, true, true], Age: 1 });
  assert.equal(rows(rich).filter(x => x.kind === 'ASSET_BEGIN').length, 4);
});

test('generation event gates bootstrap, repeated polling is idempotent, equal-age reloads create new epochs without production dependency', () => {
  const h = harness(generateRecorder(config));
  assert.equal(h.cue('Bootstrap'), false); assert.equal(h.output.length, 0);
  h.md.$LSERReady = true; h.md.$LSEREpoch = 99; h.md.$LSERRunEpoch = 99;
  assert.equal(h.cue('Bootstrap'), false); assert.equal(h.output.length, 0);
  h.cue('Invalidate0'); assert.equal(h.cue('Bootstrap'), false);
  h.start(); const epoch = h.md.$LSEREpoch, run = h.md.$LSERRun;
  h.cue('Bootstrap'); h.cue('ListenersReady');
  assert.equal(rows(h).filter(x => x.kind === 'RUN_BEGIN').length, 1);
  assert.equal(rows(h)[0].session, 'UNAVAILABLE');
  h.cue('Invalidate0'); h.call('Tick', { Epoch: epoch });
  assert.equal(h.md.$LSERReady, false);
  h.start(); assert.ok(h.md.$LSEREpoch > epoch); assert.notEqual(h.md.$LSERRun, run);
  assert.equal(rows(h).filter(x => x.kind === 'RUN_BEGIN').length, 2);
  assert.equal(rows(h).filter(x => x.kind === 'RUN_INTERRUPTED').length, 1);
  assert.equal(Object.keys(h.md).some(k => k.startsWith('$LifeSignsProduction')), false);
  // An unexpectedly late game_loaded invalidates even a generation-created run.
  // Fail closed until a fresh generation event, rather than resurrecting its flags.
  h.cue('Invalidate0'); assert.equal(h.cue('Bootstrap'), false);
  assert.equal(h.md.$LSERReady, false); h.start(); assert.equal(h.md.$LSERReady, true);
});

test('lifecycle marks an interrupted scan with old provenance and rejects stale callbacks, queues and assets', () => {
  const a = ship(), h = create({ ships: [a, ship('{second}')] }, { assetsPerTick: 1 });
  h.call('Tick'); const oldEpoch = h.md.$LSEREpoch, oldRun = h.md.$LSERRun, oldSeq = h.md.$LSERSnapshotSeq;
  assert.equal(h.md.$LSERSnapshotActive, true);
  h.call('QueueSnapshot', { Trigger: 'REQUESTED', Requested: 1 });
  h.cue('Invalidate0');
  const interrupted = rows(h).find(x => x.kind === 'SNAPSHOT_INTERRUPTED');
  assert.equal(interrupted.run, oldRun); assert.equal(interrupted.seq, String(oldSeq));
  assert.equal(interrupted.fields.provenance, 'ACTIVE_OR_RESTORED_UNKNOWN');
  assert.equal(h.md.$LSERRequests.length, 0); assert.equal(h.md.$LSERSnapshotActive, false);
  h.start(); const before = h.output.length;
  h.call('Tick', { Epoch: oldEpoch });
  h.call('Capture', { Name: 'event_object_destroyed', Values: [a, null, null, null], Available: [true, true, true, true], Age: 1, Scope: 'assets', Epoch: oldEpoch });
  h.call('QueueSnapshot', { Trigger: 'REQUESTED', Requested: 1, Epoch: oldEpoch });
  h.call('Asset', { Asset: a, Seq: 1, Trigger: 'EVENT', Epoch: oldEpoch });
  assert.equal(h.output.length, before);
  h.md.$LSERRequests = [['REQUESTED', 1, 99, oldEpoch]]; h.call('Tick');
  assert.ok(rows(h).some(x => x.kind === 'SNAPSHOT_GAP' && x.fields.reason === 'STALE_EPOCH'));
  assert.equal(rows(h).filter(x => x.run === oldRun && x.kind === 'SNAPSHOT_END').length, 0);
});

test('personnel detail reads cease at the node budget or stopped raw capture and health cannot claim zero native errors', () => {
  const a = ship(), template = { __type: 'npctemplate', text: 'invented' }; let reads = 0;
  const entry = { exists: true, seed: 0, role: null, isintransit: false, istransferscheduled: false };
  Object.defineProperty(entry, 'istemporary', { get() { reads++; return false; } });
  a.people = new Map([['list', [template]], [template, entry]]);
  a.assignedaipilot = [1, 2]; // Consume two extra nodes before personnel terminals.
  const h = create({}, { snapshotValueItems: 16 });
  h.call('Asset', { Asset: a, Seq: 1, Trigger: 'EVENT' });
  assert.equal(reads, 0); assert.ok(rows(h).some(x => x.kind === 'PAYLOAD_LIMIT'));
  let existenceReads = 0;
  Object.defineProperty(entry, 'exists', { get() { existenceReads++; return true; } });
  a.assignedaipilot = [1, 2, 3, 4, 5]; // The template itself consumes the final node.
  const boundary = create({}, { snapshotValueItems: 16 });
  boundary.call('Asset', { Asset: a, Seq: 1, Trigger: 'EVENT' });
  assert.equal(existenceReads, 0);
  assert.ok(rows(boundary).some(x => x.kind === 'PAYLOAD_LIMIT'));
  h.md.$LSERStopped = true; const before = h.output.length;
  h.call('Asset', { Asset: a, Seq: 2, Trigger: 'EVENT' });
  assert.equal(h.output.length, before); assert.equal(reads, 0);
  h.player.age = 100; h.call('Tick');
  assert.equal(rows(h).find(x => x.kind === 'HEALTH').fields.native_getter_errors, 'UNAVAILABLE');
});
