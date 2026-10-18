import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generateRecorder, validateConfig } from '../md-generator.mjs';
import { parseRecord, escapeValue, unescapeValue } from '../log-format.mjs';
import { harness } from './md-harness.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const sector = { __type: 'component', exists: true, class: 'sector', name: 'Synthetic sector', ref: 'sector' };
const host = (className, ref, owned = true) => ({ __type: 'component', ref, class: className, exists: true, isplayerowned: owned,
  seed: 9007199254740993n, idcode: ref, knownname: `Synthetic | ${ref}\nname`, sector,
  primarypurpose: { name: 'Synthetic purpose' }, macro: { name: 'Synthetic model' },
  people: Object.assign(new Map(), { list: [] }), availablepeople: Object.assign(new Map(), { count: 0 }),
  controlposts: { all: ['aipilot', 'manager'] }, assignedcontrolentity: { aipilot: null, manager: null }, assignedpilot: null,
  componentNpcs: [], commander: null, assignment: null });
const actor = (ref, home, role = null) => ({ __type: 'component', ref, class: 'npc', exists: true, isplayerowned: true,
  seed: 9223372036854775801n, knownname: 'Synthetic actor', debugname: 'Synthetic actor SYN-001 [0x123]', sector,
  race: { name: 'Synthetic race' }, owner: 'player', trueowner: 'player', role, controlpost: null,
  container: home, roleobject: role ? home : null, assignedcontrolled: null, macro: { name: 'Synthetic NPC macro' }, npctemplate: null });
const template = ref => ({ __type: 'npctemplate', ref });
function crew(home, ref = 'template-1', role = 'Crewman') {
  const t = template(ref), p = { exists: true, seed: 9223372036854775807n, name: 'Synthetic crew', race: { name: 'Synthetic race' },
    macro: { name: 'Synthetic crew macro' }, role: { name: role }, isintransit: 0, istransferscheduled: 0, istemporary: 0 };
  home.people.set(t, p); home.people.list.push(t); home.availablepeople.set(t, p); home.availablepeople.count++;
  home.people.count = home.people.list.length;
  return t;
}
function setup(env = {}, overrides = {}) { const h = harness(generateRecorder({ ...config, ...overrides }), env); h.start(); return h; }
const rows = h => h.output.map(o => ({ file: o.name, ...parseRecord(o.line) }));
function finish(h) { for (let i = 0; i < 2000; i++) { h.call('Tick'); if (!h.md.$LSPActive || h.md.$LSPStopped) return; } throw Error('Snapshot failed to finish'); }
function profiles(h) {
  const records = rows(h), result = []; let current;
  for (const r of records) {
    if (r.kind === 'PROFILE_BEGIN') { assert.equal(current, undefined, 'Profiles must not nest'); current = { kind: r.fields.kind, fields: {}, begin: r }; }
    if (current && r.kind === 'VALUE') current.fields[r.fields.field] = r.fields;
    if (r.kind === 'PROFILE_END') { assert.ok(current); current.end = r; result.push(current); current = undefined; }
  }
  return result;
}

test('generated snapshot-only artifact has no event listeners or actor creation', () => {
  const xml = generateRecorder(config);
  assert.equal(xml, readFileSync(new URL('../../extensions/lifesigns_event_recorder/md/LifeSigns_EventRecorder.xml', import.meta.url), 'utf8').replaceAll('\r\n', '\n'));
  assert.doesNotMatch(xml, /<event_|event\.(?:object|param)|<create_npc|roleentity\.\{/);
  assert.doesNotMatch(xml, /name="Capture"|name="Listen\d|eventValueItems|EVENT_BEGIN/);
  assert.match(xml, /listeners=0/);
  assert.throws(() => validateConfig({ ...config, eventValueItems: 1 }));
  assert.throws(() => validateConfig({ ...config, profileValueItems: 16385 }));
  assert.throws(() => validateConfig({ ...config, profilesPerTick: 0 }));
});

test('station then ship then independent NPC profiles collect identities without nesting', () => {
  const station = host('station', 'STATION-1'), ship = host('ship', 'SHIP-1');
  const manager = actor('manager', station); manager.controlpost = { name: 'Manager' }; manager.assignedcontrolled = station;
  station.assignedcontrolentity.manager = manager; station.componentNpcs = [manager];
  const captain = actor('captain', ship); captain.controlpost = { name: 'Captain' }; captain.assignedcontrolled = ship;
  ship.assignedcontrolentity.aipilot = captain; ship.assignedpilot = captain; ship.componentNpcs = [captain];
  ship.commander = station; ship.assignment = { name: 'Defend Commander' };
  crew(ship);
  const h = setup({ stations: [station], ships: [ship] }); finish(h);
  const p = profiles(h); assert.deepEqual(p.map(x => x.kind), ['STATION', 'SHIP', 'NPC', 'NPC', 'NPC']);
  const [sp, sh] = p;
  assert.equal(sp.fields.manager_seed.value, manager.seed.toString());
  assert.equal(sh.fields.captain_seed.value, captain.seed.toString());
  assert.equal(sh.fields.pilot_seed.value, captain.seed.toString());
  assert.equal(sh.fields.model_name.value, 'Synthetic model');
  assert.equal(sh.fields.commander_idcode.value, 'STATION-1');
  assert.equal(sh.fields.fleet_role.value, 'Defend Commander');
  assert.equal(sh.fields.personnel_onboard.state, 'UNVERIFIED');
  assert.equal(sh.fields.onboard_template_personnel.value, '1');
  assert.equal(sh.fields.name.value, ship.knownname);
  assert.equal(sh.fields.captain_idcode, undefined); assert.equal(sp.fields.manager_idcode, undefined);
  const captainProfile = p.find(x => x.fields.actor_reference?.value === 'captain');
  assert.equal(captainProfile.fields.seed.value, '9223372036854775801');
  assert.equal(captainProfile.fields.idcode.state, 'UNAVAILABLE');
  assert.equal(captainProfile.fields.debugname.value, captain.debugname);
  assert.equal(captainProfile.fields.contextual_seed.state, 'NO_CONTEXT_ENTRY');
  const cp = p.find(x => x.fields.discovery_origin?.value === 'OWNED_HOST_PERSONNEL');
  assert.equal(cp.fields.name.value, 'Synthetic crew'); assert.equal(cp.fields.race.value, 'Synthetic race');
  assert.equal(cp.fields.contextual_macro.state, 'PRESENT'); assert.equal(cp.fields.role_name.value, 'Crewman');
  assert.equal(cp.fields.sector_name.value, 'Synthetic sector');
  assert.equal(cp.fields.location_basis.value, 'HOST_CURRENT_PERSONNEL_ENTRY');
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_END').length, 1);
});

test('NPC discovery includes player actors on foreign hosts and spacesuits', () => {
  const station = host('station', 'FOREIGN', false), suit = host('spacesuit', 'SUIT', false);
  const a = actor('foreign-host-player-npc', station), b = actor('spacesuit-npc', suit), foreign = actor('foreign-npc', station);
  foreign.isplayerowned = false; station.componentNpcs = [a, foreign]; suit.componentNpcs = [b];
  const h = setup({ allStations: [station], allShips: [suit] }); finish(h);
  assert.deepEqual(profiles(h).map(x => x.fields.actor_reference.value).sort(), [a.ref, b.ref].sort());
  assert.equal(rows(h).find(x => x.kind === 'DISCOVERY_END').fields.complete, 'UNVERIFIED');
});

test('actual aliases merge only with exact host/template association, never seed equality', () => {
  const ship = host('ship', 'SHIP'), t = crew(ship, 'marine', 'Marine'), a = actor('marine-actor', ship, { name: 'Marine' });
  a.npctemplate = t; ship.componentNpcs = [a, a]; ship.assignedpilot = a; ship.assignedcontrolentity.aipilot = a;
  const b = actor('same-seed-different-component', ship); b.seed = a.seed; ship.componentNpcs.push(b);
  const h = setup({ ships: [ship] }); finish(h);
  const p = profiles(h).filter(x => x.kind === 'NPC'); assert.equal(p.length, 2);
  const linked = p.find(x => x.fields.actor_reference.value === a.ref);
  assert.equal(linked.fields.contextual_name.value, 'Synthetic crew');
  assert.equal(linked.fields.name.value, 'Synthetic actor');
  assert.equal(linked.fields.discovery_origin.value, 'CONTEXT_AND_ACTOR');
});

test('same template text in distinct hosts does not collapse context identities', () => {
  const a = host('ship', 'A'), b = host('ship', 'B'), t = crew(a);
  b.people.set(t, a.people.get(t)); b.people.list.push(t); b.availablepeople.set(t, a.people.get(t));
  const h = setup({ ships: [a,b] }); finish(h);
  assert.equal(profiles(h).filter(x => x.kind === 'NPC').length, 2);
});

test('context transit does not assert host sector as actual NPC location', () => {
  const ship = host('ship', 'SHIP'), t = crew(ship); ship.people.get(t).isintransit = 1;
  const h = setup({ ships: [ship] }); finish(h);
  const p = profiles(h).find(x => x.kind === 'NPC');
  assert.equal(p.fields.sector_name.state, 'UNVERIFIED');
  assert.equal(p.fields.isintransit.value, '1');
});

test('stale references and missing contextual fields are explicit without pseudo storage', () => {
  const ship = host('ship', 'SHIP'), t = crew(ship); delete ship.people.get(t).name;
  const h = setup({ ships: [ship] }); finish(h);
  assert.equal(profiles(h).find(x => x.kind === 'NPC').fields.name.state, 'UNAVAILABLE');
  h.call('BeginSnapshot'); ship.exists = false; finish(h);
  assert.equal(profiles(h).at(-1).fields.reference.state, 'UNAVAILABLE_REFERENCE');
});

test('candidate, host and roster limits produce explicit discovery markers', () => {
  const ship = host('ship', 'SHIP'); crew(ship, 'a'); crew(ship, 'b');
  const h = setup({ ships: [ship] }, { maxCandidates: 1 }); finish(h);
  assert.equal(profiles(h).filter(x => x.kind === 'NPC').length, 1);
  assert.ok(rows(h).some(x => x.kind === 'DISCOVERY_LIMIT' && x.fields.reason === 'NPC_CANDIDATES'));
  const r = setup({ ships: [ship] }, { personnelPerHost: 1 }); finish(r);
  assert.ok(rows(r).some(x => x.kind === 'DISCOVERY_LIMIT' && x.fields.reason === 'CONTEXTUAL_ROSTER'));
  const k = setup({ allShips: [ship, host('ship','SECOND')] }, { maxDiscoveryHosts: 1 }); finish(k);
  assert.ok(rows(k).some(x => x.kind === 'DISCOVERY_LIMIT' && x.fields.reason === 'HOSTS'));
});

test('profile budget is fresh per profile and stops getters after exhaustion', () => {
  const ship = host('ship', 'SHIP'), a = actor('actor', ship); ship.componentNpcs = [a];
  let reads = 0; Object.defineProperty(a, 'roleobject', { get() { reads++; throw Error('Must not read after budget exhausted'); } });
  const h = setup({ ships: [ship] }, { profileValueItems: 16 }); finish(h);
  const p = profiles(h); assert.equal(reads, 0);
  for (const item of p) assert.ok(Object.keys(item.fields).length <= 16);
  assert.ok(rows(h).some(x => x.kind === 'PROFILE_LIMIT'));
  assert.equal(p.find(x => x.kind === 'NPC').fields.seed.value, a.seed.toString());
});

test('readiness polling, bounded progress and completion-based cadence do not overlap snapshots', () => {
  const h = setup({ stations: [host('station','A')], ships: [host('ship','B')] }, { profilesPerTick: 1, discoveryPerTick: 1 });
  h.call('Tick'); assert.equal(profiles(h).length, 1);
  h.player.age += 1000; finish(h);
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_BEGIN').length, 1);
  h.call('Tick'); assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_BEGIN').length, 1);
  h.player.age += config.periodSeconds; finish(h);
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_END').length, 2);
  const waiting = harness(generateRecorder(config)); waiting.player.galaxy = null; waiting.start();
  assert.equal(waiting.output.length, 0);
});

test('clock regression explicitly interrupts active snapshot and starts a new run', () => {
  const h = setup({ ships: [host('ship','SHIP')] }, { profilesPerTick: 1 }); h.call('Tick');
  h.player.age = 0; h.call('Tick');
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_INTERRUPTED').length, 1);
  assert.equal(rows(h).filter(x => x.kind === 'RUN_BEGIN').length, 2);
});

test('raw row cap writes one final stop marker and OFF suppresses diagnostics', () => {
  const h = setup({ ships: Array.from({ length: 100 }, (_,i) => host('ship',`SHIP-${i}`)) }, { maxRowsPerRun: 1000, diagnostics: 'OFF' });
  finish(h); h.call('Tick'); h.player.age += 1000; h.call('Tick');
  const raw = rows(h).filter(x => x.file === 'profiles.log'); assert.equal(raw.length, 1001);
  assert.equal(raw.at(-1).kind, 'LIMIT'); assert.equal(raw.filter(x => x.kind === 'LIMIT').length, 1);
  assert.equal(rows(h).filter(x => x.file === 'profile-diagnostics.log').length, 0);
  assert.equal(h.md.$LSPStopped, true);
});

test('text framing preserves reserved characters and rejects malformed rows', () => {
  const text = 'Synthetic % | crew\n\r\t船'; assert.equal(unescapeValue(escapeValue(text)), text);
  assert.throws(() => parseRecord('LSEV1|broken'));
  assert.throws(() => unescapeValue('%FF'));
});
