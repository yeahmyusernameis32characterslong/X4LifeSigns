// Pure shared schema/identifier validation. Importing never opens or creates files.
import { validateSessionKey } from '../bridge/src/session-key.js';

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
const statements = Object.freeze([
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
]);
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

export { APP, statements, validate as validateProfileDatabase };
