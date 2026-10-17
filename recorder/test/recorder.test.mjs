import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generateRecorder, validateConfig } from '../md-generator.mjs';
import { catalog } from '../catalog.mjs';
import { escapeValue, unescapeValue, parseRecord } from '../log-format.mjs';
import { harness } from './md-harness.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const ship = (id = 'TEST-1') => ({ __type: 'component', ref: `{${id}}`, exists: true, class: 'ship', idcode: id, knownname: 'Test | ship\nName', owner: 'player', trueowner: 'player', isplayerowned: true, sector: null, container: null, people: { list: [] }, roleentities: [] });
const create = (overrides = {}, env = {}) => { const h = harness(generateRecorder({ ...config, ...overrides }), env); h.cue('Runtime'); return h; };
const rows = h => h.output.map(x => ({ name: x.name, ...parseRecord(x.line) }));
const capture = (h, values = [null, null, null, null], available = [true, true, true, true]) => h.call('Capture', { Name: 'event_object_attacked', Scope: 'assets', Values: values, Available: available, Age: h.player.age });

test('generated artifact is deterministic and includes broad isolated subscriptions', () => {
  assert.equal(generateRecorder(config), readFileSync(new URL('../../extensions/lifesigns_event_recorder/md/LifeSigns_EventRecorder.xml', import.meta.url), 'utf8'));
  assert.equal(catalog.length, 52);
  const h = create(), nodes = [];
  function walk(n) { if (/^Listen\d+$/.test(n.attrs.name || '')) nodes.push(n); n.children.forEach(walk); } walk(h.tree);
  assert.equal(nodes.length, catalog.length);
  const runtime = h.tree.children[0].children[0].children.find(x => x.attrs.name === 'Runtime');
  const gate = runtime.children.find(x => x.tag === 'cues').children[0];
  assert.equal(gate.attrs.name, 'ListenersReady');
  assert.match(gate.children.find(x => x.tag === 'conditions').children[0].attrs.value, /md\.\$LSERAssets\? and md\.\$LSERActors\?/);
  for (const node of nodes) {
    assert.equal(node.attrs.instantiate, 'true'); assert.equal(node.attrs.namespace, 'this');
    const actions = node.children.find(x => x.tag === 'actions').children;
    assert.equal(actions.slice(0, 8).filter(x => x.tag === 'set_value').length, 8);
    assert.equal(actions.at(-1).attrs.ref, 'Capture');
  }
});

test('starts independently, rebuilds all owned assets and never assigns production state', () => {
  const ships = [ship('TEST-1'), ship('TEST-2')], station = { ...ship('STATION'), class: 'station' };
  const h = create({}, { ships, stations: [station] });
  assert.deepEqual(h.md.$LSERAssets, [...ships, station]);
  assert.equal(h.md.$LSERReady, true);
  assert.equal(rows(h)[0].kind, 'RUN_BEGIN');
  assert.equal(rows(h)[0].session, 'UNAVAILABLE');
  assert.equal(Object.keys(h.md).some(k => k.startsWith('$LifeSignsProduction')), false);
  h.md.$LSERActors.push(ship('OLD'));
  h.cue('Runtime');
  assert.equal(h.md.$LSERActors.length, 0);
  assert.equal(h.md.$LSERReceived, 0);
});

test('repeated delivered events retain distinct values, typed nulls and missing fields', () => {
  const h = create();
  const text = "A|B%7C\r\n\t'船=";
  capture(h, [text, null, [1, 'x|y'], null], [true, true, true, false]);
  capture(h, ['second', 17, null, null]);
  const r = rows(h), begins = r.filter(x => x.kind === 'EVENT_BEGIN');
  assert.deepEqual(begins.map(x => x.seq), ['1', '2']);
  assert.equal(r.find(x => x.seq === '1' && x.fields.field === 'object').fields.value, text);
  assert.equal(r.find(x => x.seq === '2' && x.fields.field === 'object').fields.value, 'second');
  assert.equal(r.find(x => x.seq === '1' && x.fields.field === 'param').fields.state, 'NULL');
  assert.equal(r.find(x => x.seq === '1' && x.fields.field === 'param3').fields.state, 'UNAVAILABLE');
  assert.equal(h.md.$LSERFamilies.get('$event_object_attacked'), 2);
  assert.equal(h.md.$LSERReceived, 2);
  assert.equal(h.output.some(x => /[\r\n\t]/.test(x.line)), false);
});

test('nested/cyclic payloads end with explicit limits and bounded work', () => {
  const h = create({ valueItems: 16, valueDepth: 2 });
  const cycle = new Map(); cycle.set('$cycle', cycle);
  capture(h, [cycle, Array.from({ length: 100 }, (_, i) => i), null, null]);
  const r = rows(h);
  assert.ok(r.some(x => x.kind === 'PAYLOAD_LIMIT'));
  assert.ok(r.filter(x => x.kind === 'VALUE').length <= 16);
  assert.equal(r.at(-1).kind, 'EVENT_END');
  assert.ok(h.md.$LSERIncomplete > 0);
});

test('OFF suppresses all diagnostics while events, periodic and requested snapshots operate', () => {
  const h = create({ diagnostics: 'OFF', periodSeconds: 10, heartbeatSeconds: 10 }, { ships: [ship()] });
  capture(h, [ship(), null, null, null]);
  h.cue('Input5');
  h.player.age = 20; h.call('Tick'); h.call('Tick'); h.call('Tick');
  const r = rows(h);
  assert.equal(r.some(x => x.name === 'diagnostics.log'), false);
  assert.ok(r.some(x => x.kind === 'EVENT_BEGIN'));
  assert.ok(r.some(x => x.kind === 'SNAPSHOT_BEGIN' && x.fields.trigger === 'PERIODIC'));
  assert.ok(r.some(x => x.kind === 'SNAPSHOT_BEGIN' && x.fields.trigger === 'ON_DEMAND_HOTKEY'));
});

test('snapshot cursor spans processing ticks while event sequence remains independent', () => {
  const ships = Array.from({ length: 5 }, (_, i) => ship(`TEST-${i}`));
  const h = create({ assetsPerTick: 2 }, { ships });
  h.call('Tick'); const snapshotSeq = h.md.$LSERSnapshotSeq;
  capture(h, ['event during snapshot', null, null, null]);
  h.call('Tick'); h.call('Tick');
  const r = rows(h), assets = r.filter(x => x.kind === 'ASSET_BEGIN' && x.fields.trigger === 'PERIODIC');
  assert.equal(assets.length, 5);
  assert.ok(assets.every(x => x.seq === String(snapshotSeq)));
  assert.equal(r.filter(x => x.kind === 'SNAPSHOT_END').length, 1);
  assert.equal(h.md.$LSERSnapshotActive, false);
});

test('queue overload and row cap are observable without changing diagnostic-independent event budget', () => {
  const h = create({ snapshotQueue: 1, maxRowsPerRun: 1000, diagnostics: 'OFF' });
  h.cue('Input5'); assert.equal(h.md.$LSERDroppedSnapshots, 1);
  assert.ok(rows(h).some(x => x.kind === 'SNAPSHOT_GAP'));
  h.md.$LSERWrites = 1000;
  capture(h); capture(h);
  assert.equal(rows(h).filter(x => x.kind === 'LIMIT').length, 1);
  assert.equal(h.md.$LSERStopped, true);
  assert.equal(h.md.$LSERReceived, 2);
  assert.equal(h.md.$LSERDroppedEvents, 1);
  assert.equal(h.md.$LSERDiagnosticWrites, 0);
});

test('bounded roster snapshots do not use materialising roleentity getter', () => {
  const asset = ship();
  const a = { __type: 'npctemplate', text: 'template-a' }, b = { __type: 'npctemplate', text: 'template-b' };
  asset.people = new Map([[a, { exists: true, seed: 123, role: 'marine', isintransit: true, istransferscheduled: true, istemporary: false }], [b, { exists: true }]]);
  asset.people.set('list', [a, b]);
  Object.defineProperty(asset, 'roleentity', { get() { throw new Error('Materialisation attempted'); } });
  const h = create({ crewPerAsset: 1 });
  h.call('Asset', { Asset: asset, Seq: 1, Trigger: 'EVENT' });
  assert.ok(rows(h).some(x => x.kind === 'ROSTER_LIMIT' && x.fields.omitted === '1'));
  assert.ok(rows(h).some(x => x.fields.field === 'asset.people.1.role' && x.fields.value === 'marine'));
  const gone = { __type: 'component', ref: '{gone}', exists: false };
  h.call('Asset', { Asset: gone, Seq: 2, Trigger: 'EVENT' });
  assert.equal(rows(h).find(x => x.seq === '2' && x.kind === 'VALUE').fields.state, 'UNAVAILABLE_REFERENCE');
});

test('diagnostic thresholds and production key gate are honoured', () => {
  const h = create({ diagnostics: 'ERROR' });
  h.md.$LifeSignsProductionSessionReady = false; h.md.$LifeSignsProductionSessionKey = 's1-stale';
  capture(h); assert.equal(rows(h).at(-1).session, 'UNAVAILABLE');
  h.md.$LifeSignsProductionSessionReady = true; capture(h);
  assert.equal(rows(h).at(-1).session, 's1-stale');
  h.player.age = 100; h.call('Tick'); assert.equal(h.md.$LSERDiagnosticWrites, 0);
  h.cue('Input3'); h.player.age = 200; h.call('Tick');
  assert.ok(rows(h).some(x => x.name === 'diagnostics.log' && x.kind === 'HEALTH'));
});

test('ownership events request reconciliation and bounded instances remain distinct from templates', () => {
  const asset = ship(), actor = { ...ship('ACTOR'), class: 'entity', role: 'service', controlpost: null, roleobject: asset, assignedcontrolled: null, npctemplate: null };
  asset.roleentities = [actor, { ...actor, ref: '{ACTOR-2}' }];
  const h = create({ crewPerAsset: 1 }, { ships: [asset] });
  h.call('Capture', { Name: 'event_object_changed_true_owner', Scope: 'assets', Values: [asset, 'player', 'other', null], Available: [true, true, true, false], Age: h.player.age });
  assert.equal(h.md.$LSERNextReconcile, h.player.age);
  assert.deepEqual(h.md.$LSERActors, [actor]);
  assert.ok(rows(h).some(x => x.fields.field === 'affected.1.instances.1.role' && x.fields.value === 'service'));
  assert.equal(rows(h).filter(x => x.kind === 'EVENT_END').at(-1).fields.partial, 'true');
});

test('ERROR reports an observed capture stop and INFO health continues after capture stops', () => {
  const h = create({ diagnostics: 'ERROR', maxRowsPerRun: 1000 });
  h.md.$LSERWrites = 1000; capture(h);
  assert.ok(rows(h).some(x => x.name === 'diagnostics.log' && x.kind === 'FAULT'));
  assert.equal(h.md.$LSERFailures, 1);
  h.cue('Input3'); h.player.age = 200; h.call('Tick');
  assert.ok(rows(h).some(x => x.kind === 'HEALTH' && x.fields.observable_failures === '1'));
});

test('configuration and text parser reject invalid input without numeric precision conversion', () => {
  assert.throws(() => validateConfig({ ...config, diagnostics: 'TRACE' }));
  assert.throws(() => validateConfig({ ...config, assetsPerTick: 0 }));
  for (const text of ['%7C|\r\n\t', '日本語', '', 'a=b']) assert.equal(unescapeValue(escapeValue(text)), text);
  const r = parseRecord('LSEV1|run=test|session=UNAVAILABLE|seq=9223372036854775807|age=1s|VALUE|value=a%7Cb%250A|END');
  assert.equal(r.seq, '9223372036854775807'); assert.equal(r.fields.value, 'a|b%0A');
  assert.throws(() => parseRecord('LSEV1|run=x|session=x|seq=1|age=0|VALUE|value=%FF|END'));
  assert.throws(() => parseRecord('LSEV1|run=x|session=x|seq=1|age=0|VALUE|x=1|x=2|END'));
});
