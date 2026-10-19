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
  roleentities: [], assignedaipilot: null, tradenpc: null, shiptrader: null, commander: null, assignment: null });
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
function finish(h) { for (let i = 0; i < 10000; i++) { h.player.age += config.npcTickSeconds; h.call('Tick'); if (!h.md.$LSPActive || h.md.$LSPStopped) return; } throw Error('Snapshot failed to finish'); }
function profiles(h) {
  const records = rows(h), result = []; let current;
  for (const r of records) {
    if (r.kind === 'PROFILE_BEGIN') { assert.equal(current, undefined, 'Profiles must not nest'); current = { kind: r.fields.kind, fields: {}, begin: r }; }
    if (current && r.kind === 'VALUE') current.fields[r.fields.field] = r.fields;
    if (r.kind === 'PROFILE_END') { assert.ok(current); current.end = r; result.push(current); current = undefined; }
  }
  return result;
}

test('generated snapshot-only artifact has exactly one lifecycle hook and no gameplay capture', () => {
  const xml = generateRecorder(config);
  assert.equal(xml, readFileSync(new URL('../../extensions/lifesigns_event_recorder/md/LifeSigns_EventRecorder.xml', import.meta.url), 'utf8').replaceAll('\r\n', '\n'));
  assert.deepEqual([...xml.matchAll(/<(event_[a-z_]+)/g)].map(m=>m[1]), ['event_universe_generated']);
  assert.doesNotMatch(xml, /event\.(?:object|param)|<create_npc|roleentity\.\{/);
  assert.doesNotMatch(xml, /<find_object_component/);
  assert.doesNotMatch(xml, /name="Capture"|name="Listen\d|eventValueItems|EVENT_BEGIN/);
  assert.match(xml, /gameplay_listeners=0/);
  assert.throws(() => validateConfig({ ...config, eventValueItems: 1 }));
  assert.throws(() => validateConfig({ ...config, profileValueItems: 16385 }));
  assert.throws(() => validateConfig({ ...config, profilesPerTick: 0 }));
});

test('station then ship then independent NPC profiles collect identities without nesting', () => {
  const station = host('station', 'STATION-1'), ship = host('ship', 'SHIP-1');
  const manager = actor('manager', station); manager.controlpost = { name: 'Manager' }; manager.assignedcontrolled = station;
  station.assignedcontrolentity.manager = manager; station.roleentities = [manager];
  const captain = actor('captain', ship); captain.controlpost = { name: 'Captain' }; captain.assignedcontrolled = ship;
  ship.assignedcontrolentity.aipilot = captain; ship.assignedpilot = captain; ship.roleentities = [captain];
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
  assert.equal(sh.fields.personnel_onboard, undefined);
  assert.equal(sh.fields.onboard_template_personnel.value, '1');
  assert.equal(sh.fields.name.value, ship.knownname);
  assert.equal(sh.fields.captain_idcode, undefined); assert.equal(sp.fields.manager_idcode, undefined);
  const captainProfile = p.find(x => x.fields.actor_reference?.value === 'captain');
  assert.equal(captainProfile.fields.seed.value, '9223372036854775801');
  assert.equal(captainProfile.fields.idcode, undefined);
  assert.equal(captainProfile.fields.debugname.value, captain.debugname);
  assert.equal(captainProfile.fields.contextual_seed.state, 'NO_CONTEXT_ENTRY');
  assert.equal(captainProfile.fields.assigned_ship_idcode.value, 'SHIP-1');
  const cp = p.find(x => x.fields.discovery_origin?.value === 'OWNED_HOST_PERSONNEL');
  assert.equal(cp.fields.name.value, 'Synthetic crew'); assert.equal(cp.fields.race.value, 'Synthetic race');
  assert.equal(cp.fields.idcode, undefined);
  assert.equal(cp.fields.contextual_macro.state, 'PRESENT'); assert.equal(cp.fields.role_name.value, 'Crewman');
  assert.equal(cp.fields.sector_name.value, 'Synthetic sector');
  assert.equal(cp.fields.location_basis.value, 'HOST_CURRENT_PERSONNEL_ENTRY');
  assert.equal(cp.fields.assigned_ship_idcode.value, 'SHIP-1');
  assert.equal(cp.fields.assignment_basis.value, 'CONTEXT_HOST_ROSTER_ASSOCIATION');
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_END').length, 1);
});

test('datatype cache obeys native string-key rules and reuses labels without changing output', () => {
  const xml=generateRecorder(config);
  const fixed=`name="$TypeKey" exact="'$%s'.[$Type]"`;
  assert.ok(xml.includes(fixed));
  const broken=harness(xml.replace(fixed,()=>`name="$TypeKey" exact="'%s'.[$Type]"`),{stations:[host('station','STATION')]});
  broken.start(); assert.throws(()=>broken.call('Tick'), /MD table string keys must start/);
  const ship=host('ship','SHIP'); crew(ship);
  const h=setup({ships:[ship]}); finish(h);
  assert.ok([...h.md.$LSPTypeEscapes.keys()].every(k=>typeof k==='string'&&k.startsWith('$')));
  const initialSize=h.md.$LSPTypeEscapes.size,beforeEscapes=h.callCounts.Escape;
  h.md.$LSPRemaining=config.profileValueItems;
  for(let i=0;i<3;i++)h.call('Value',{Field:'synthetic_label',Value:'Synthetic % | text\n船',Available:true});
  h.call('Value',{Field:'synthetic_missing',Value:null,Available:false});
  h.call('Value',{Field:'synthetic_null',Value:null,Available:true});
  assert.equal(h.md.$LSPTypeEscapes.size,initialSize);
  assert.equal(h.callCounts.Escape-beforeEscapes,5,'Repeated types escape only their dynamic values');
  const last=rows(h).filter(r=>r.kind==='VALUE').slice(-5);
  assert.equal(last[0].fields.value,'Synthetic % | text\n船');
  assert.equal(last[0].fields.type,'datatype.string');
  assert.equal(last[3].fields.state,'UNAVAILABLE');
  assert.equal(last[4].fields.state,'NULL');
  assert.equal(last[4].fields.type,'datatype.null');
});

test('Personnel List discovery includes owned spacesuits and never scans foreign hosts', () => {
  const station = host('station', 'FOREIGN', false), suit = host('spacesuit', 'SUIT');
  const a = actor('foreign-host-player-npc', station), b = actor('spacesuit-npc', suit);
  Object.defineProperty(station, 'people', { get() { throw Error('Must not inspect foreign host'); } });
  station.roleentities = [a]; suit.assignedaipilot = b;
  const h = setup({ ships: [suit], allStations: [station], allShips: [suit] }); finish(h);
  assert.deepEqual(profiles(h).filter(p => p.kind === 'NPC').map(x => x.fields.actor_reference.value), [b.ref]);
  assert.equal(rows(h).find(x => x.kind === 'DISCOVERY_BEGIN').fields.scope, 'PLAYER_OWNED_PERSONNEL_LIST');
  assert.equal(rows(h).find(x => x.kind === 'DISCOVERY_END').fields.complete, 'UNVERIFIED');
});

test('literal values compile without optional lookup syntax and property reads remain guarded', () => {
  const xml=generateRecorder(config);
  assert.doesNotMatch(xml, /value="@(?:null\b|')/);
  assert.match(xml, /name="Value" value="@\$Actor.seed"/);
  assert.match(xml, /name="Value" value="'CONTEXT_HOST_ROSTER_ASSOCIATION'"/);
  assert.throws(()=>harness(xml.replace('value="null"','value="@null"')), /requires a property lookup/);
  assert.throws(()=>harness(xml.replace('value="\'CONTEXT_HOST_ROSTER_ASSOCIATION\'"','value="@\'CONTEXT_HOST_ROSTER_ASSOCIATION\'"')), /requires a property lookup/);
  const ship=host('ship','SHIP'),station=host('station','STATION'); crew(ship);
  const h=setup({ships:[ship],stations:[station]}); finish(h);
  const p=profiles(h);
  assert.equal(p.find(p=>p.kind==='STATION').fields.manager_seed.state,'NO_ASSIGNED_MANAGER');
  assert.equal(p.find(p=>p.kind==='SHIP').fields.captain_seed.state,'NO_ASSIGNED_CAPTAIN');
  const npc=p.find(p=>p.kind==='NPC');
  assert.equal(npc.fields.assignment_basis.value,'CONTEXT_HOST_ROSTER_ASSOCIATION');
  assert.equal(npc.fields.assignment_basis.type,'datatype.string');
  assert.equal(npc.fields.location_basis.value,'HOST_CURRENT_PERSONNEL_ENTRY');
});

test('Personnel List scalar getters supply pilot, manager and ship trader without component searches', () => {
  const ship = host('ship', 'SHIP'), station = host('station', 'STATION');
  ship.assignedaipilot = actor('pilot', ship); ship.assignedaipilot.controlpost = { name: 'Captain' };
  station.tradenpc = actor('manager', station); station.tradenpc.controlpost = { name: 'Manager' };
  station.shiptrader = actor('shiptrader', station); station.shiptrader.controlpost = { name: 'Ship Trader' };
  const h = setup({ ships: [ship], stations: [station] }); finish(h);
  const npcs = profiles(h).filter(p => p.kind === 'NPC');
  assert.deepEqual(npcs.map(p => [p.fields.actor_reference.value, p.fields.controlpost_name.value]),
    [['manager', 'Manager'], ['shiptrader', 'Ship Trader'], ['pilot', 'Captain']]);
  assert.equal(npcs[0].fields.discovery_origin.value, 'PERSONNEL_MANAGER');
  assert.equal(npcs[0].fields.seed.value, station.tradenpc.seed.toString());
});

test('NPC profiles stream before the personnel inventory finishes and progress distinguishes empty hosts', () => {
  const ships = Array.from({ length: 4 }, (_, i) => host('ship', `SHIP-${i}`));
  crew(ships[0], 'crew', 'Crewman'); crew(ships[2], 'marine', 'Marine');
  const h = setup({ ships }, { discoveryPerTick: 1, profilesPerTick: 64 });
  h.call('Tick');
  for (let i = 0; i < 100 && profiles(h).filter(p => p.kind === 'NPC').length === 0; i++) { h.player.age += config.npcTickSeconds; h.call('Tick'); }
  assert.equal(profiles(h).filter(p => p.kind === 'NPC').length, 1);
  assert.equal(rows(h).some(r => r.kind === 'DISCOVERY_END'), false);
  assert.equal(rows(h).some(r => r.kind === 'SNAPSHOT_END'), false);
  assert.equal(h.notifications.length, 1);
  for (let i = 0; i < 100 && h.md.$LSPHostsVisited < 2; i++) { h.player.age += config.npcTickSeconds; h.call('Tick'); }
  h.player.age += config.heartbeatSeconds; h.call('Tick');
  const empty = rows(h).find(r => r.kind === 'DISCOVERY_HOST' && r.fields.host_reference === 'SHIP-1' && r.fields.state === 'END');
  assert.equal(empty.fields.templates_found, '0'); assert.equal(empty.fields.candidates_added, '0');
  const health = rows(h).find(r => r.kind === 'HEALTH');
  assert.equal(health.fields.phase, 'NPCS'); assert.equal(health.fields.hosts_visited, '2');
  assert.equal(health.fields.npc_profiles_attempted, '1');
  finish(h);
  assert.equal(profiles(h).filter(p => p.kind === 'NPC').length, 2);
  assert.equal(rows(h).find(r => r.kind === 'DISCOVERY_END').fields.hosts_visited, '4');
  assert.equal(h.notifications.length, 2);
});

test('ownership changes skip personnel reads and report the exact host', () => {
  const ship = host('ship', 'CHANGED');
  const h = setup({ ships: [ship] }, { profilesPerTick: 64 }); h.call('Tick');
  ship.isplayerowned = false;
  Object.defineProperty(ship, 'people', { get() { throw Error('Must not read after ownership change'); } });
  finish(h);
  const gap = rows(h).find(r => r.kind === 'DISCOVERY_GAP');
  assert.equal(gap.fields.reason, 'HOST_NOT_PLAYER_OWNED'); assert.equal(gap.fields.host_reference, 'CHANGED');
  assert.equal(rows(h).find(r => r.kind === 'DISCOVERY_END').fields.hosts_skipped, '1');
  assert.equal(profiles(h).filter(p => p.kind === 'NPC').length, 0);
});

test('actual aliases merge only with exact host/template association, never seed equality', () => {
  const ship = host('ship', 'SHIP'), t = crew(ship, 'marine', 'Marine'), a = actor('marine-actor', ship, { name: 'Marine' });
  a.npctemplate = t; ship.roleentities = [a, a]; ship.assignedpilot = a; ship.assignedcontrolentity.aipilot = a;
  const b = actor('same-seed-different-component', ship); b.seed = a.seed; ship.roleentities.push(b);
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

test('conflicting actor assignment evidence is preserved instead of choosing a ship', () => {
  const home = host('ship', 'HOME'), other = host('ship', 'OTHER');
  const a = actor('conflicted-actor', home, { name: 'Crewman' }); a.assignedcontrolled = other; home.roleentities = [a];
  const h = setup({ ships: [home, other] }); finish(h);
  const p = profiles(h).find(x => x.kind === 'NPC');
  assert.equal(p.fields.role_ship_idcode.value, 'HOME'); assert.equal(p.fields.controlled_ship_idcode.value, 'OTHER');
  assert.equal(p.fields.assigned_ship_idcode.state, 'AMBIGUOUS_ASSIGNMENT');
  assert.equal(p.fields.assignment_basis.value, 'CONFLICTING_ACTOR_RELATIONSHIPS');
  assert.equal(p.end.fields.partial, 'true');
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
  h.load(); ship.exists = false; finish(h);
  assert.equal(profiles(h).at(-1).fields.reference.state, 'UNAVAILABLE_REFERENCE');
});

test('candidate, host and roster limits produce explicit discovery markers', () => {
  const ship = host('ship', 'SHIP'); crew(ship, 'a'); crew(ship, 'b');
  const h = setup({ ships: [ship] }, { maxCandidates: 1 }); finish(h);
  assert.equal(profiles(h).filter(x => x.kind === 'NPC').length, 1);
  assert.ok(rows(h).some(x => x.kind === 'DISCOVERY_LIMIT' && x.fields.reason === 'NPC_CANDIDATES'));
  const r = setup({ ships: [ship] }, { personnelPerHost: 1 }); finish(r);
  assert.ok(rows(r).some(x => x.kind === 'DISCOVERY_LIMIT' && x.fields.reason === 'CONTEXTUAL_ROSTER'));
  const k = setup({ ships: [ship, host('ship','SECOND')] }, { maxDiscoveryHosts: 1 }); finish(k);
  assert.ok(rows(k).some(x => x.kind === 'DISCOVERY_LIMIT' && x.fields.reason === 'HOSTS'));
});

test('profile budget is fresh per profile and stops getters after exhaustion', () => {
  const ship = host('ship', 'SHIP'), a = actor('actor', ship); ship.roleentities = [a];
  let reads = 0; Object.defineProperty(a, 'roleobject', { get() { reads++; throw Error('Must not read after budget exhausted'); } });
  const h = setup({ ships: [ship] }, { profileValueItems: 16 }); finish(h);
  const p = profiles(h); assert.equal(reads, 0);
  for (const item of p) assert.ok(Object.keys(item.fields).length <= 16);
  assert.ok(rows(h).some(x => x.kind === 'PROFILE_LIMIT'));
  assert.equal(p.find(x => x.kind === 'NPC').fields.seed.value, a.seed.toString());
});

test('readiness polling takes one initial snapshot and never schedules another', () => {
  const h = setup({ stations: [host('station','A')], ships: [host('ship','B')] }, { profilesPerTick: 1, discoveryPerTick: 1 });
  h.call('Tick'); assert.equal(profiles(h).length, 1);
  h.player.age += 1000; finish(h);
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_BEGIN').length, 1);
  h.call('Tick'); assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_BEGIN').length, 1);
  h.player.age += 86400; finish(h); h.call('BeginSnapshot');
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_END').length, 1);
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_BEGIN').length, 1);
  const waiting = harness(generateRecorder(config)); waiting.player.galaxy = null; waiting.start();
  assert.equal(waiting.output.length, 0);
});

test('each load gets separate timestamped session files even at the same game age and second', () => {
  const h=setup({stations:[host('station','FIRST')]}); finish(h);
  const oldFile=h.md.$LSPProfileFile, before=[...h.output], firstRun=h.md.$LSPRun;
  h.load(); finish(h);
  assert.notEqual(h.md.$LSPRun, firstRun);
  assert.notEqual(h.md.$LSPProfileFile,oldFile);
  assert.match(h.md.$LSPProfileFile,/^profiles-session-\d+-\d+-loaded-2000-01-01_00-00-00\.log$/);
  assert.match(h.md.$LSPDiagnosticFile,/^profile-diagnostics-session-\d+-\d+-loaded-2000-01-01_00-00-00\.log$/);
  assert.deepEqual(h.output.slice(0,before.length),before);
  assert.equal(h.output.slice(before.length).some(o=>o.name===oldFile),false);
  const starts=rows(h).filter(r=>r.kind==='RUN_BEGIN'&&r.file.startsWith('profiles-'));
  assert.equal(starts.length,2); assert.equal(starts[1].fields.snapshot_schedule,'INITIAL_ONLY');
  assert.equal(starts[1].fields.max_rows,'NONE');
  assert.equal(starts[1].fields.loaded_at,'2000-01-01_00-00-00');
  assert.equal(rows(h).filter(r=>r.kind==='SNAPSHOT_END').length,2);
  const completed=h.output.length;
  h.player.age+=86400; h.cue('ProcessingTick'); h.call('Tick');
  assert.equal(h.output.length,completed,'No recurring snapshots or diagnostic growth after completion');
});

test('load boundary blocks restored in-flight work until playable readiness without writing to old files', () => {
  const h=setup({ships:[host('ship','SHIP')]},{profilesPerTick:1}); h.call('Tick');
  const oldFile=h.md.$LSPProfileFile,before=h.output.length;
  h.player.galaxy=null; h.load();
  assert.equal(h.md.$LSPReady,false); assert.equal(h.md.$LSPPending,true);
  h.call('Tick'); h.cue('ProcessingTick'); assert.equal(h.output.length,before);
  h.player.systemtime['%Y-%m-%d_%H-%M-%S']='2000-01-01_00-02-00';
  h.player.galaxy=true; h.cue('Bootstrap'); finish(h);
  assert.equal(h.output.slice(before).some(o=>o.name===oldFile),false);
  assert.match(h.md.$LSPProfileFile,/loaded-2000-01-01_00-00-00/,'Timestamp is boundary observation, not delayed readiness');
  assert.equal(rows(h).filter(r=>r.kind==='SNAPSHOT_INTERRUPTED').length,0,'Do not fabricate old-file interruption on reload');
  assert.equal(rows(h).filter(r=>r.kind==='SNAPSHOT_END').length,1);
});

test('unexplained clock regression interrupts active work and waits for a real lifecycle boundary', () => {
  const h = setup({ ships: [host('ship','SHIP')] }, { profilesPerTick: 1 }); h.call('Tick');
  h.player.age = 0; h.call('Tick');
  assert.equal(rows(h).filter(x => x.kind === 'SNAPSHOT_INTERRUPTED').length, 1);
  assert.equal(rows(h).filter(x => x.kind === 'RUN_BEGIN' && x.file.startsWith('profiles-')).length, 1);
  assert.equal(h.md.$LSPReady, false);
  h.load(); finish(h);
  assert.equal(rows(h).filter(x => x.kind === 'RUN_BEGIN' && x.file.startsWith('profiles-')).length, 2);
});

test('contextual scalar aliases reuse one observation without changing fields or escaping', () => {
  const ship = host('ship', 'SHIP'), t = crew(ship), entry = ship.people.get(t);
  let reads = 0; const text = "Synthetic % | name\n船";
  Object.defineProperty(entry, 'name', { get() { reads++; return text; } });
  const h = setup({ ships: [ship] }); finish(h);
  const p = profiles(h).find(p => p.kind === 'NPC');
  assert.equal(reads, 2, 'One availability lookup and one value lookup, reused for both output fields');
  assert.equal(p.fields.name.value, text); assert.equal(p.fields.contextual_name.value, text);
  assert.equal(p.fields.seed.value, p.fields.contextual_seed.value);
  assert.equal(p.fields.race.value, p.fields.contextual_race.value);
  assert.equal(p.fields.macro.value, p.fields.contextual_macro.value);
  assert.equal(p.fields.seed.type, 'datatype.largeint');
  assert.ok(h.md.$LSPTypeEscapes.size > 0);
  assert.equal(h.callCounts.Escape, rows(h).filter(r => r.kind === 'VALUE').length + h.md.$LSPTypeEscapes.size);
  const missingShip = host('ship', 'MISSING'), missingTemplate = crew(missingShip);
  delete missingShip.people.get(missingTemplate).name;
  const m = setup({ ships: [missingShip] }); finish(m);
  const mp = profiles(m).find(p => p.kind === 'NPC');
  assert.equal(mp.fields.name.state, 'UNAVAILABLE'); assert.equal(mp.fields.contextual_name.state, 'UNAVAILABLE');
});

test('discovery cursor bounds entries and holds profiles until host aliases are collected', () => {
  const ship = host('ship', 'SHIP'); const templates = Array.from({ length: 64 }, (_, i) => crew(ship, `crew-${i}`));
  const a = actor('last-actor', ship); a.npctemplate = templates.at(-1); ship.roleentities = [a];
  const h = setup({ ships: [ship] }); h.call('Tick'); h.call('Tick');
  assert.ok(h.md.$LSPCandidates.length <= config.discoveryPerTick);
  assert.equal(profiles(h).filter(p => p.kind === 'NPC').length, 0);
  let pending = true;
  for (let i = 0; i < 1000 && pending; i++) {
    const before = h.md.$LSPCandidates.length, emitted = h.md.$LSPNpcProfiles;
    const steps = h.callCounts.DiscoveryStep || 0;
    h.player.age += config.npcTickSeconds; h.call('Tick');
    assert.ok((h.callCounts.DiscoveryStep || 0) - steps <= config.discoveryPerTick);
    assert.ok(h.md.$LSPNpcProfiles - emitted <= config.npcProfilesPerTick);
    if (!h.md.$LSPDiscoveryDone) assert.ok(h.md.$LSPCandidates.length - before <= config.discoveryPerTick);
    pending = h.md.$LSPActive;
  }
  assert.equal(pending, false);
  const npcs = profiles(h).filter(p => p.kind === 'NPC'); assert.equal(npcs.length, 64);
  const last = npcs.find(p => p.fields.actor_reference.value === a.ref);
  assert.equal(last.fields.discovery_origin.value, 'CONTEXT_AND_ACTOR');
});

test('asset cadence stays one second while NPC polling requests the finer interval', () => {
  const h = setup({ ships: Array.from({ length: 12 }, (_, i) => host('ship', `SHIP-${i}`)) });
  h.call('Tick'); const count = profiles(h).length;
  h.player.age += config.npcTickSeconds; h.call('Tick'); assert.equal(profiles(h).length, count);
  h.player.age += 1; h.call('Tick'); assert.ok(profiles(h).length > count);
  const cue = h.tree.children[0].children.find(n => n.tag === 'cues').children.find(n => n.attrs.name === 'Bootstrap').children.find(n => n.tag === 'cues').children[0];
  assert.equal(cue.attrs.checkinterval, `${config.npcTickSeconds}s`);
  finish(h); h.call('Tick');
  const idleGate = h.md.$LSPNextAssetTick;
  assert.ok(idleGate >= h.player.age + 0.99);
  h.player.age += config.npcTickSeconds; h.call('Tick'); assert.equal(h.md.$LSPNextAssetTick, idleGate);
  assert.throws(() => validateConfig({ ...config, npcTickSeconds: 0 }));
  assert.throws(() => validateConfig({ ...config, npcProfilesPerTick: 0 }));
});

test('ownership loss during a resumable host scan closes it without reading more personnel', () => {
  const ship = host('ship', 'SHIP'); for (let i = 0; i < 32; i++) crew(ship, `crew-${i}`);
  const h = setup({ ships: [ship] }); h.call('Tick'); h.call('Tick');
  assert.equal(h.md.$LSPDiscoveryStage, 'PEOPLE');
  ship.isplayerowned = false;
  Object.defineProperty(ship, 'people', { get() { throw Error('No roster access after ownership loss'); } });
  finish(h);
  assert.equal(rows(h).find(r => r.kind === 'DISCOVERY_END').fields.hosts_skipped, '1');
  assert.ok(profiles(h).filter(p => p.kind === 'NPC').every(p => p.fields.name.state === 'UNAVAILABLE'));
});

test('raw and diagnostic counters beyond the former ceiling do not stop collection', () => {
  const ship = host('ship', 'SHIP'); crew(ship);
  const h = setup({ ships: [ship] });
  h.md.$LSPRows = 2000000; h.md.$LSPDiagnosticRows = 2000000;
  h.call('Write', {Body:'TEST', Diagnostic:true});
  finish(h);
  assert.equal(h.md.$LSPStopped, false);
  assert.ok(h.md.$LSPRows > 2000000); assert.equal(h.md.$LSPDiagnosticRows, 2000001);
  assert.equal(profiles(h).filter(p => p.kind === 'NPC').length, 1);
  assert.equal(rows(h).some(r => r.kind === 'LIMIT'), false);
});

test('old persisted discovery state waits for lifecycle reset without touching old log files', () => {
  const h = setup({ ships: [host('ship', 'SHIP')] }, { profilesPerTick: 1 }); h.call('Tick');
  h.md.$LSPPass = 'NPC_DISCOVERY'; h.md.$LSPPersonnelVersion = 1;
  delete h.md.$LSPHostsVisited; delete h.md.$LSPNpcProfiles; delete h.md.$LSPDiscoveryDone;
  const before=h.output.length, oldFile=h.md.$LSPProfileFile;
  h.call('Tick'); assert.equal(h.output.length, before);
  h.load();
  assert.equal(h.md.$LSPPersonnelVersion, 3); assert.equal(h.md.$LSPActive, false);
  assert.notEqual(h.md.$LSPProfileFile, oldFile);
  assert.equal(h.output.slice(before).some(r=>r.name===oldFile), false);
  finish(h);
  assert.equal(rows(h).filter(r => r.kind === 'SNAPSHOT_END').length, 1);
  assert.equal(h.notifications.filter(n => n.text.includes('completed')).length, 1);
});

test('begun ticker and closable completion help panel bracket the snapshot once without periodic repetition', () => {
  const h = setup({}, { profilesPerTick: 1, discoveryPerTick: 1 });
  h.call('Tick');
  assert.deepEqual(h.notifications.map(n => n.text), ['Life Signs: Snapshot begun.']);
  assert.equal(rows(h)[h.notifications[0].afterRows - 1].kind, 'SNAPSHOT_BEGIN');
  assert.equal(h.notifications[0].timeout, 5); assert.equal(h.notifications[0].priority, 1);
  assert.equal(h.notifications[0].kind, 'ticker');
  finish(h);
  assert.deepEqual(h.notifications.map(n => n.text), ['Life Signs: Snapshot begun.', 'Life Signs: Snapshot completed.']);
  assert.equal(rows(h)[h.notifications[1].afterRows - 1].kind, 'SNAPSHOT_END');
  assert.deepEqual(h.notifications[1], { kind: 'help', text: 'Life Signs: Snapshot completed.', allowclose: true, timeout: false, log: false, afterRows: h.notifications[1].afterRows });
  assert.equal(rows(h).filter(r => r.kind === 'PASS_END').length, 3);
  h.call('Tick'); assert.equal(h.notifications.length, 2);
  h.player.age += 86400; finish(h);
  assert.equal(h.notifications.length, 2);
});

test('finished partial snapshots say partial data and interrupted snapshots never say completed', () => {
  const stale = host('ship', 'STALE'); stale.exists = false;
  const partial = setup({ ships: [stale] }); finish(partial);
  assert.deepEqual(partial.notifications.at(-1), { kind: 'help', text: 'Life Signs: Snapshot completed — partial data.', allowclose: true, timeout: false, log: false, afterRows: partial.notifications.at(-1).afterRows });
  assert.equal(rows(partial).find(r => r.kind === 'SNAPSHOT_END').fields.partial, 'true');
  const interrupted = setup({ ships: [host('ship', 'SHIP')] }, { profilesPerTick: 1 });
  interrupted.call('Tick'); interrupted.player.age = 0; interrupted.call('Tick');
  assert.deepEqual(interrupted.notifications.map(n => n.text), ['Life Signs: Snapshot begun.']);
});

test('removed schedule and row-cap configuration are rejected rather than silently used', () => {
  assert.throws(() => validateConfig({...config, periodSeconds:300}));
  assert.throws(() => validateConfig({...config, maxRowsPerRun:2000000}));
  const xml = generateRecorder(config);
  assert.doesNotMatch(xml, /MAX_ROWS|LSPNextSnapshot/);
});

test('production session correlation is read-only and optional', () => {
  const h = setup(); h.md.$LifeSignsProductionSessionKey = 'synthetic-session'; h.md.$LifeSignsProductionSessionReady = true;
  finish(h);
  assert.equal(rows(h).find(x => x.kind === 'SNAPSHOT_BEGIN').session, 'synthetic-session');
  assert.equal(h.md.$LifeSignsProductionSessionKey, 'synthetic-session');
  assert.equal(rows(setup())[0].session, 'UNAVAILABLE');
});

test('startup retains separate run and session identifiers without sampling game seed', () => {
  const gamestart={}; Object.defineProperty(gamestart,'seed',{get(){throw Error('Game seed must not be read');}});
  const xml=generateRecorder(config); assert.doesNotMatch(xml,/gamestart[._]seed|LSPGamestartSeed/);
  const h=harness(xml,{gamestart,ships:[host('ship','SHIP')]});
  h.md.$LifeSignsProductionSessionReady=true; h.md.$LifeSignsProductionSessionKey='synthetic-production-session';
  h.start(); finish(h);
  const first=rows(h)[0]; assert.equal(first.kind,'RUN_BEGIN');
  assert.equal(first.session,'synthetic-production-session'); assert.equal(first.run,h.md.$LSPRun);
  const begin=rows(h).find(r=>r.kind==='SNAPSHOT_BEGIN'); assert.equal(begin.session,first.session);
  h.load(); finish(h);
  const starts=rows(h).filter(r=>r.kind==='RUN_BEGIN'&&r.file.startsWith('profiles-'));
  assert.notEqual(starts[1].run,first.run);
  for(const r of rows(h).filter(r=>['RUN_BEGIN','SNAPSHOT_BEGIN'].includes(r.kind))){
    assert.equal(r.session,'synthetic-production-session');
    assert.equal(Object.keys(r.fields).some(k=>k.startsWith('gamestart_seed')),false);
  }
  assert.equal(h.md.$LifeSignsProductionSessionKey,'synthetic-production-session');
});

test('uncapped collection completes beyond old test thresholds and OFF suppresses diagnostics', () => {
  const h = setup({ ships: Array.from({ length: 100 }, (_,i) => host('ship',`SHIP-${i}`)) }, { diagnostics: 'OFF' });
  finish(h); h.call('Tick'); h.player.age += 1000; h.call('Tick');
  const raw = rows(h).filter(x => x.file.startsWith('profiles-')); assert.ok(raw.length > 1000);
  assert.equal(raw.at(-1).kind, 'SNAPSHOT_END'); assert.equal(raw.filter(x => x.kind === 'LIMIT').length, 0);
  assert.equal(rows(h).filter(x => x.file.startsWith('profile-diagnostics-')).length, 0);
  assert.equal(h.md.$LSPStopped, false);
  assert.deepEqual(h.notifications.map(n => n.text), ['Life Signs: Snapshot begun.', 'Life Signs: Snapshot completed — partial data.']);
});

test('text framing preserves reserved characters and rejects malformed rows', () => {
  const text = 'Synthetic % | crew\n\r\t船'; assert.equal(unescapeValue(escapeValue(text)), text);
  assert.throws(() => parseRecord('LSEV1|broken'));
  assert.throws(() => unescapeValue('%FF'));
});
