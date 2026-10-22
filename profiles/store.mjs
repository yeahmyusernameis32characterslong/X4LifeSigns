// Additive profile test storage. Production docking v1/v2 files are never opened.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { validateSessionKey } from '../bridge/src/session-key.js';
import { checkPath, checkSidecars, sameFile } from '../bridge/src/session-path.js';

export function universeId(id) {
  if (typeof id !== 'string' || !id.startsWith('lsu1-')) throw Error('Invalid Life Signs universe ID');
  validateSessionKey('s1-' + id.slice(5));
  return id;
}
export function runId(run) {
  const m = /^session-(0|[1-9]\d{0,9})-(0|[1-9]\d{0,9})-loaded-(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/.exec(run);
  if (!m || m.slice(1, 3).some(v => Number(v) > 2147483647)) throw Error('Invalid recorder run');
  validateSessionKey(`s1-${m[3]}-${m[1]}-${m[2]}-0-0`);
  return run;
}
export function ordinal(value) {
  if (!/^(0|[1-9]\d*)$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw Error('Invalid record/checkpoint ordinal');
  return Number(value);
}
const APP = 1280528464;
const statements = [
  `CREATE TABLE universe_metadata (singleton INTEGER PRIMARY KEY CHECK(singleton=1), universe_id TEXT NOT NULL, scheme TEXT NOT NULL CHECK(scheme='LIFESIGNS_MD_V1'), ready INTEGER NOT NULL CHECK(ready IN (0,1))) STRICT`,
  `CREATE TABLE sessions (run_id TEXT PRIMARY KEY, production_session TEXT NOT NULL, parent_run TEXT, parent_record INTEGER NOT NULL, baseline INTEGER NOT NULL CHECK(baseline IN (0,1))) STRICT`,
  `CREATE TABLE records (run_id TEXT NOT NULL, record_id INTEGER NOT NULL, kind TEXT NOT NULL, game_time TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id,record_id)) STRICT`,
  `CREATE TABLE profile_versions (run_id TEXT NOT NULL, record_id INTEGER NOT NULL, profile_number TEXT NOT NULL, entity_key TEXT NOT NULL, kind TEXT NOT NULL, seed TEXT, idcode TEXT, reference TEXT, game_time TEXT NOT NULL, fields_json TEXT NOT NULL, partial INTEGER NOT NULL, PRIMARY KEY(run_id,record_id)) STRICT`,
  `CREATE INDEX profile_entity ON profile_versions(entity_key,run_id,record_id)`,
  `CREATE TABLE events (run_id TEXT NOT NULL, record_id INTEGER NOT NULL, event_type TEXT NOT NULL, game_time TEXT NOT NULL, subject_kind TEXT NOT NULL, subject_seed TEXT, subject_idcode TEXT, subject_reference TEXT, host_seed TEXT, host_idcode TEXT, other_seed TEXT, other_idcode TEXT, fields_json TEXT NOT NULL, PRIMARY KEY(run_id,record_id)) STRICT`,
  `CREATE INDEX event_subject ON events(subject_kind,subject_seed,subject_idcode)`,
  `CREATE INDEX event_host ON events(host_seed,host_idcode)`,
  `CREATE INDEX event_other ON events(other_seed,other_idcode)`,
  `CREATE INDEX profile_seed ON profile_versions(kind,seed,idcode)`,
];
const normal = s => s.trim().replace(/\s+/g, ' ');
function validate(db, id) {
  if (db.prepare('PRAGMA application_id').get().application_id !== APP || db.prepare('PRAGMA user_version').get().user_version !== 1) throw Error('Incompatible profile database');
  const objects = db.prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x => normal(x.sql)).sort();
  if (JSON.stringify(objects) !== JSON.stringify(statements.map(normal).sort())) throw Error('Unexpected profile schema');
  const rows = db.prepare('SELECT * FROM universe_metadata').all();
  if (rows.length !== 1 || rows[0].universe_id !== id || rows[0].scheme !== 'LIFESIGNS_MD_V1') throw Error('Universe ownership mismatch');
  if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw Error('Profile database integrity check failed');
  return rows[0];
}
function refuseWal(file) {
  const fd = fs.openSync(file, 'r'); const header = Buffer.alloc(20);
  try { fs.readSync(fd, header, 0, 20, 0); } finally { fs.closeSync(fd); }
  if (header[18] === 2 || header[19] === 2) throw Error('WAL profile files are not supported');
}
function directory(root) {
  checkPath(root, { directory: true });
  for (const p of [path.join(root, 'local-data'), path.join(root, 'local-data', 'profiles')]) {
    if (!fs.existsSync(p)) fs.mkdirSync(p);
    checkPath(p, { directory: true });
  }
  return path.join(root, 'local-data', 'profiles');
}
export class ProfileStore {
  constructor(root, id, run) {
    this.id = universeId(id); this.run = runId(run);
    const dir = directory(path.resolve(root));
    this.final = path.join(dir, id + '.db');
    this.file = fs.existsSync(this.final) ? this.final : path.join(dir, `${id}.${run}.building.db`);
    this.newBaseline = this.file !== this.final;
    checkSidecars(this.file);
    let created = false;
    this.info = checkPath(this.file, { missing: true });
    if (!this.info) { const fd = fs.openSync(this.file, 'wx'); try { this.info = fs.fstatSync(fd); created = true; } finally { fs.closeSync(fd); } }
    if (!created) {
      refuseWal(this.file); const ro = new DatabaseSync(this.file, { readOnly: true });
      try { const m = validate(ro, id); if (!this.newBaseline && !m.ready) throw Error('Published profile database is incomplete'); } finally { ro.close(); }
    }
    this.guard(); this.db = new DatabaseSync(this.file);
    if (created) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        for (const sql of statements) this.db.exec(sql);
        this.db.prepare("INSERT INTO universe_metadata VALUES(1,?,'LIFESIGNS_MD_V1',0)").run(id);
        this.db.exec(`PRAGMA application_id=${APP}; PRAGMA user_version=1; COMMIT`);
      } catch (e) { this.db.exec('ROLLBACK'); this.db.close(); throw e; }
    }
    validate(this.db, id); this.guard(); this.activeProfile = null;
  }
  guard() { if (!sameFile(this.info, checkPath(this.file))) throw Error('Profile database replaced'); checkSidecars(this.file); }
  close() { if (this.db?.isOpen) this.db.close(); }
  status() {
    const ready = this.db.prepare('SELECT ready FROM universe_metadata').get().ready;
    const record = this.db.prepare('SELECT coalesce(max(record_id),0) AS n FROM records WHERE run_id=?').get(this.run).n;
    return { universe: this.id, run: this.run, state: ready ? 'READY' : this.db.prepare("SELECT 1 FROM records WHERE run_id=? AND kind='SNAPSHOT_BEGIN'").get(this.run) ? 'BUILDING' : 'NEED_BASELINE', record };
  }
  ingest(rows) {
    this.guard(); const db = this.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of rows) {
        if (row.run !== this.run) throw Error('Run mismatch');
        const n = ordinal(row.fields.record); if (!n) throw Error('Record ordinal must be positive');
        const payload = JSON.stringify(row);
        const prior = db.prepare('SELECT payload FROM records WHERE run_id=? AND record_id=?').get(this.run, n);
        if (prior) {
          if (prior.payload !== payload) throw Error('Conflicting replay');
          // Rebuild an unfinished profile when a service restart replays its prefix.
          if (row.kind === 'PROFILE_BEGIN') this.activeProfile = { number: row.fields.profile, kind: row.fields.kind, fields: {} };
          if (row.kind === 'VALUE' && this.activeProfile) this.activeProfile.fields[row.fields.field] = { value: row.fields.value, state: row.fields.state, type: row.fields.type };
          if (row.kind === 'PROFILE_END') this.activeProfile = null;
          continue;
        }
        if (!/^\d+(?:\.\d+)?$/.test(row.age)) throw Error('Invalid game time');
        const last = db.prepare('SELECT coalesce(max(record_id),0) AS n FROM records WHERE run_id=?').get(this.run).n;
        if (n !== last + 1) throw Error(`Non-contiguous profile stream: expected ${last + 1}, received ${n} (${row.kind})`);
        const f = row.fields;
        if (row.kind === 'RUN_BEGIN') {
          if (n !== 1 || f.lifesigns_universe_id !== this.id || f.database_protocol !== 'LSDB1') throw Error('Invalid profile startup');
          let parent = f.parent_run === 'NONE' ? null : runId(f.parent_run);
          let cursor = ordinal(f.parent_record);
          // Missing universe file requires a fresh baseline, even when a save carries
          // an older acknowledged checkpoint. Retain the raw startup provenance.
          if (this.newBaseline) { parent = null; cursor = 0; }
          if (!parent && !this.newBaseline) throw Error('Existing universe requires a saved committed checkpoint; refusing later history for a pre-database save');
          if (parent && !db.prepare('SELECT 1 FROM records WHERE run_id=? AND record_id=?').get(parent, cursor)) throw Error('Saved checkpoint not found in this universe database');
          if (parent && !this.ancestry(parent, cursor).some(p => db.prepare("SELECT 1 FROM records WHERE run_id=? AND record_id<=? AND kind='SNAPSHOT_END'").get(p.run, p.limit))) throw Error('Saved checkpoint predates completed baseline; save after database creation');
          db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(this.run, row.session, parent, cursor, this.newBaseline ? 1 : 0);
        } else if (!db.prepare('SELECT 1 FROM sessions WHERE run_id=?').get(this.run)) throw Error('Missing profile startup');
        db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(this.run, n, row.kind, row.age, payload);
        if (row.kind === 'PROFILE_BEGIN') {
          if (this.activeProfile) throw Error('Nested profile');
          if (!['STATION', 'SHIP', 'NPC'].includes(f.kind)) throw Error('Unknown profile kind');
          this.activeProfile = { number: f.profile, kind: f.kind, fields: {} };
        }
        if (row.kind === 'VALUE') {
          if (!this.activeProfile || this.activeProfile.number !== f.profile || Object.hasOwn(this.activeProfile.fields, f.field)) throw Error('Unmatched or duplicate profile value');
          this.activeProfile.fields[f.field] = { value: f.value, state: f.state, type: f.type };
        }
        if (row.kind === 'PROFILE_END') {
          const p = this.activeProfile; if (!p || p.number !== f.profile) throw Error('Unmatched profile end');
          const present = key => p.fields[key]?.state === 'PRESENT' ? p.fields[key].value : null;
          const seed = present('seed'), code = present('idcode') || (p.kind === 'NPC' ? /\(([A-Z]{3}-[0-9]{3})\)/.exec(present('debugname') || '')?.[1] || null : null), ref = present('reference') || present('actor_reference');
          const key = seed ? `${p.kind}:seed:${seed}` : code ? `${p.kind}:idcode:${code}` : `${p.kind}:unresolved:${this.run}:${n}`;
          db.prepare('INSERT INTO profile_versions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(this.run, n, p.number, key, p.kind, seed, code, ref, row.age, JSON.stringify(p.fields), f.partial === '1' || f.partial === 'true' ? 1 : 0);
          this.activeProfile = null;
        }
        if (row.kind === 'ENTITY_EVENT') {
          if (!['SHIP', 'STATION', 'NPC', 'ASSET', 'UNIVERSE'].includes(f.subject_kind) || !/^[A-Z][A-Z_]+$/.test(f.event_type)) throw Error('Invalid entity event');
          const identifier = x => x && x !== 'null' && x !== 'UNAVAILABLE' ? x : null;
          db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(this.run, n, f.event_type, row.age, f.subject_kind, identifier(f.subject_seed), identifier(f.subject_idcode), identifier(f.subject_reference), identifier(f.host_seed), identifier(f.host_idcode), identifier(f.other_seed), identifier(f.other_idcode), JSON.stringify(f));
        }
        if (row.kind === 'SNAPSHOT_END') {
          if (this.activeProfile) throw Error('Snapshot ended with open profile');
          const count = db.prepare('SELECT count(*) AS n FROM profile_versions WHERE run_id=?').get(this.run).n;
          if (count !== ordinal(f.profiles)) throw Error('Snapshot count/readback mismatch');
          db.exec('UPDATE universe_metadata SET ready=1');
        }
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); this.activeProfile = null; throw e; }
    const result = this.status(); // Readback occurs only after COMMIT.
    if (result.state === 'READY' && this.newBaseline) {
      this.close(); this.guard(); checkSidecars(this.final); fs.copyFileSync(this.file, this.final, fs.constants.COPYFILE_EXCL);
      const ro = new DatabaseSync(this.final, { readOnly: true }); try { validate(ro, this.id); } finally { ro.close(); }
      this.file = this.final; this.info = checkPath(this.file); this.newBaseline = false; this.db = new DatabaseSync(this.file); this.guard();
    }
    return result;
  }
  ancestry(run = this.run, record = Number.MAX_SAFE_INTEGER) {
    runId(run); ordinal(record);
    const chain = []; const seen = new Set();
    for (let cursor = run, limit = record; cursor;) {
      if (seen.has(cursor)) throw Error('Cyclic saved ancestry'); seen.add(cursor);
      chain.push({ run: cursor, limit }); const s = this.db.prepare('SELECT * FROM sessions WHERE run_id=?').get(cursor);
      if (!s) throw Error('Unknown saved session'); cursor = s.parent_run; limit = s.parent_record;
    }
    return chain;
  }
  eventsAt(run = this.run, record = Number.MAX_SAFE_INTEGER) {
    return this.ancestry(run, record).reverse().flatMap(p => this.db.prepare('SELECT * FROM events WHERE run_id=? AND record_id<=? ORDER BY record_id').all(p.run, p.limit).map(e => ({...e, fields:JSON.parse(e.fields_json)})));
  }
  profilesAt(run = this.run, record = Number.MAX_SAFE_INTEGER) {
    const chain = this.ancestry(run, record);
    const objects = new Map();
    for (const item of chain) for (const p of this.db.prepare('SELECT * FROM profile_versions WHERE run_id=? AND record_id<=? ORDER BY record_id DESC').all(item.run, item.limit)) if (!objects.has(p.entity_key)) objects.set(p.entity_key, { ...p, fields: JSON.parse(p.fields_json) });
    const profiles = [...objects.values()];
    // Baseline/profile rows remain immutable. Apply only later observed names
    // on this save's ancestry, not names from an abandoned future branch.
    const position = new Map([...chain].reverse().map((p, i) => [p.run, i]));
    const seeds = new Map(), codes = new Map(), references = new Map();
    const index = (map, key, p) => { if (key) map.set(key, map.has(key) ? null : p); };
    for (const p of profiles) {
      index(seeds, p.seed && `${p.kind}:${p.seed}`, p);
      index(codes, p.idcode && `${p.kind}:${p.idcode}`, p);
      index(references, p.reference && `${p.run_id}:${p.kind}:${p.reference}`, p);
    }
    const names = this.db.prepare("SELECT * FROM events WHERE run_id=? AND record_id<=? AND event_type IN ('NAME_CHANGED','NAME_OBSERVED') AND subject_kind IN ('SHIP','STATION') ORDER BY record_id");
    const nameEvents = [...chain].reverse().flatMap(p => names.all(p.run, p.limit).map(e => ({ ...e, fields: JSON.parse(e.fields_json) })));
    for (const e of nameEvents) {
      if (!['SHIP', 'STATION'].includes(e.subject_kind) || !['NAME_CHANGED', 'NAME_OBSERVED'].includes(e.event_type) || e.fields.new_name_state !== 'PRESENT' || typeof e.fields.new_name !== 'string') continue;
      // A mismatching seed must never fall back to somebody else's ID code.
      const p = e.subject_seed ? seeds.get(`${e.subject_kind}:${e.subject_seed}`) : e.subject_idcode ? codes.get(`${e.subject_kind}:${e.subject_idcode}`) : references.get(`${e.run_id}:${e.subject_kind}:${e.subject_reference}`);
      if (!p || position.get(e.run_id) < position.get(p.run_id) || (e.run_id === p.run_id && e.record_id <= p.record_id)) continue;
      p.fields.name = { value: e.fields.new_name, state: 'PRESENT', type: 'string' };
      p.name_observation = { run_id: e.run_id, record_id: e.record_id, game_time: e.game_time, event_type: e.event_type };
    }
    return profiles;
  }
}
