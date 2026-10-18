import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generateRecorder, validateConfig } from '../md-generator.mjs';
import { parseRecord } from '../log-format.mjs';
import { harness } from './md-harness.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const ship = id => ({ __type: 'component', ref: `{${id}}`, exists: true, class: 'ship', idcode: id, isplayerowned: true, people: { list: [] }, roleentities: [] });
const create = (overrides = {}, ships = []) => { const h = harness(generateRecorder({ ...config, ...overrides }), { ships }); h.cue('Runtime'); return h; };
const rows = h => h.output.map(x => parseRecord(x.line));
const asset = (h, a, seq, trigger = 'EVENT') => h.call('Asset', { Asset: a, Seq: seq, Trigger: trigger, Path: `assets.${seq}` });
function crew(a, contextual, instantiated) {
  const templates = Array.from({ length: contextual }, (_, i) => ({ __type: 'npctemplate', text: `invented-template-${i}` }));
  a.people = new Map(templates.map(t => [t, { exists: true, seed: 1, role: 'service', isintransit: false, istransferscheduled: false, istemporary: false }]));
  a.people.set('list', templates);
  a.roleentities = Array.from({ length: instantiated }, (_, i) => ({ __type: 'component', ref: `{invented-actor-${a.idcode}-${i}}`, exists: true, class: 'entity' }));
  Object.defineProperty(a, 'roleentity', { get() { throw new Error('Materialisation attempted'); } });
  return a;
}

test('approved split configuration rejects old/shared keys and excessive budgets', () => {
  assert.deepEqual([config.snapshotValueItems, config.eventValueItems, config.crewPerAsset, config.assetsPerTick, config.periodSeconds], [16384, 1024, 500, 8, 300]);
  assert.equal(validateConfig(config), config);
  const guide = readFileSync(new URL('../../docs/BROAD_EVENT_RECORDER_IMPLEMENTATION.md', import.meta.url), 'utf8');
  for (const key of ['snapshotValueItems', 'eventValueItems', 'crewPerAsset', 'assetsPerTick', 'periodSeconds']) assert.ok(guide.includes('`' + key + '` | ' + config[key] + ' |'), `Guide disagrees on ${key}`);
  for (const overrides of [{ valueItems: 1024 }, { snapshotValueItems: 16385 }, { eventValueItems: 16384 }, { snapshotValueItems: 15 }, { eventValueItems: 1.5 }]) assert.throws(() => validateConfig({ ...config, ...overrides }));
});

test('each asset gets a fresh budget and early independently correlated availability rows', () => {
  const h = create({ snapshotValueItems: 16 });
  for (const seq of [1, 2]) asset(h, crew(ship(`ID|${seq}`), 4, 4), seq);
  for (const seq of ['1', '2']) {
    const r = rows(h).filter(x => x.seq === seq), counts = r.filter(x => x.kind === 'PERSONNEL_AVAILABILITY');
    assert.equal(counts.length, 2);
    assert.ok(counts.every(x => x.fields.available === '4' && x.fields.state === 'AVAILABLE' && x.fields.asset_id === `ID|${seq}` && x.fields.asset_ref === `{ID|${seq}}` && x.fields.field === `assets.${seq}` && x.run && x.session === 'UNAVAILABLE'));
    assert.deepEqual(r.slice(1, 3).map(x => x.kind), ['PERSONNEL_AVAILABILITY', 'PERSONNEL_AVAILABILITY']);
    assert.equal(r.filter(x => x.kind === 'VALUE').length, 16);
    assert.ok(r.some(x => x.kind === 'PAYLOAD_LIMIT'));
    assert.equal(r.at(-1).fields.partial, 'true');
  }
});

test('500-entry ceilings are independent per representation and per asset, without padding', t => {
  const h = create();
  for (const seq of [1, 2]) asset(h, crew(ship(`LARGE-${seq}`), 600, 700), seq, seq === 1 ? 'PERIODIC' : 'ON_DEMAND_HOTKEY');
  for (const seq of ['1', '2']) {
    const r = rows(h).filter(x => x.seq === seq);
    assert.deepEqual(r.filter(x => x.kind === 'PERSONNEL_AVAILABILITY').map(x => x.fields.available), ['600', '700']);
    assert.equal(r.filter(x => x.kind === 'VALUE' && /\.people\.\d+\.template$/.test(x.fields.field)).length, 500);
    assert.equal(r.filter(x => x.kind === 'VALUE' && /\.instances\.\d+$/.test(x.fields.field)).length, 500);
    assert.deepEqual(r.filter(x => x.kind === 'ROSTER_LIMIT').map(x => x.fields.omitted), ['100', '200']);
    assert.ok(r.filter(x => x.kind === 'VALUE').length < 16384);
    assert.equal(r.some(x => x.kind === 'PAYLOAD_LIMIT'), false);
    assert.equal(r.at(-1).fields.partial, 'true');
    t.diagnostic(`Synthetic rich asset ${seq}: ${r.length} raw rows, ${r.filter(x => x.kind === 'VALUE').length} value nodes; no native performance claim.`);
  }
  asset(h, ship('EMPTY'), 3);
  const empty = rows(h).filter(x => x.seq === '3');
  assert.deepEqual(empty.filter(x => x.kind === 'PERSONNEL_AVAILABILITY').map(x => x.fields.available), ['0', '0']);
  assert.ok(empty.filter(x => x.kind === 'VALUE').length < 20);
  assert.equal(empty.at(-1).fields.partial, 'false');
});

test('the default 16384 ceiling truncates anomalously large values after reporting availability', () => {
  const a = ship('ANOMALOUS');
  a.assignedaipilot = Array.from({ length: 20000 }, (_, i) => i);
  const h = create(); asset(h, a, 1);
  const r = rows(h).filter(x => x.seq === '1');
  assert.equal(r.filter(x => x.kind === 'VALUE').length, 16384);
  assert.deepEqual(r.slice(1, 3).map(x => x.fields.available), ['0', '0']);
  assert.ok(r.some(x => x.kind === 'PAYLOAD_LIMIT'));
  assert.equal(r.at(-1).fields.partial, 'true');
});

test('unavailable collections, counts and assets retain explicit states instead of zero', () => {
  const h = create(), missing = ship('MISSING'); delete missing.people;
  const brokenCount = new Proxy([], { get(target, key) { if (key === 'length') throw new Error('Count unavailable'); return Reflect.get(target, key); } });
  missing.roleentities = brokenCount;
  asset(h, missing, 1);
  asset(h, { __type: 'component', ref: '{gone}', exists: false }, 2);
  asset(h, null, 3);
  const r = rows(h), counts = r.filter(x => x.kind === 'PERSONNEL_AVAILABILITY');
  assert.equal(counts.length, 6);
  assert.ok(counts.every(x => x.fields.available === 'UNAVAILABLE'));
  assert.deepEqual(counts.map(x => x.fields.state), ['COLLECTION_UNAVAILABLE', 'COUNT_UNAVAILABLE', 'UNAVAILABLE_REFERENCE', 'UNAVAILABLE_REFERENCE', 'UNSUPPORTED_ASSET', 'UNSUPPORTED_ASSET']);
  assert.ok(r.filter(x => x.kind === 'ASSET_END').every(x => x.fields.partial === 'true'));
});

test('event parameter exhaustion leaves the larger affected-asset budget intact', () => {
  const a = crew(ship('EVENT'), 20, 20), h = create({ eventValueItems: 16 }, [a]);
  h.call('Capture', { Name: 'event_object_changed_owner', Scope: 'assets', Values: [a, Array.from({ length: 50 }, (_, i) => i), null, null], Available: [true, true, true, true], Age: 1 });
  const r = rows(h), start = r.findIndex(x => x.kind === 'ASSET_BEGIN');
  assert.equal(r.slice(0, start).filter(x => x.kind === 'VALUE').length, 16);
  assert.ok(r.slice(0, start).some(x => x.kind === 'PAYLOAD_LIMIT'));
  assert.ok(r.slice(start).filter(x => x.kind === 'VALUE').length > 16);
  assert.equal(r.find(x => x.kind === 'ASSET_END').fields.partial, 'false');
  assert.equal(r.at(-1).fields.partial, 'true');
});
