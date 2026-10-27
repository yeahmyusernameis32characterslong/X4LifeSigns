import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { checkPath, checkSidecars, sameFile } from '../bridge/src/session-path.js';
import { universeId, runId, ordinal, validateProfileDatabase } from './profile-schema.mjs';
import { availability, checkAvailability } from './inventory-path.mjs';

const stable = (a, b) => sameFile(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const fail = code => { throw Error(code); };

export function inspectProfileDatabase(file, { maxBoundaries = 1000000, maxRecords = 5000000, getAvailability = availability } = {}) {
  const result = { file: path.basename(file), status: 'BLOCKED', universe: null };
  let db, fd;
  try {
    if (![maxBoundaries,maxRecords].every(n => Number.isSafeInteger(n) && n > 0)) fail('INVALID_RESOURCE_LIMIT');
    checkAvailability(file, getAvailability);
    if (result.file.endsWith('.building.db')) fail('BUILDING_DATABASE');
    result.universe = universeId(result.file.slice(0, -3));
    if (!result.file.endsWith('.db')) fail('UNSUPPORTED_FILENAME');
    const info = checkPath(file); checkSidecars(file);
    fd = fs.openSync(file, 'r'); const header = Buffer.alloc(20); fs.readSync(fd, header, 0, 20, 0);
    if (!stable(info, fs.fstatSync(fd))) fail('DATABASE_CHANGED');
    if (header[18] === 2 || header[19] === 2) fail('WAL_DATABASE');
    db = new DatabaseSync(file, { readOnly: true, timeout: 0, allowExtension: false });
    db.exec('PRAGMA query_only=ON'); const version = db.prepare('PRAGMA data_version').get().data_version;
    db.exec('BEGIN'); const owner = validateProfileDatabase(db, result.universe);
    if (!owner.ready) fail('INCOMPLETE_DATABASE');
    const rows = db.prepare('SELECT * FROM sessions ORDER BY run_id').all();
    const runs = new Map(rows.map(r => [r.run_id, { run: runId(r.run_id), parent: r.parent_run,
      parentRecord: ordinal(r.parent_record), baseline: r.baseline, records: 0, first: null, last: null,
      profiles: [], profileEnds: [], eventRecords: [], snapshotEnds: [] }]));
    const stats = db.prepare('SELECT run_id,count(*) AS n,min(record_id) AS first,max(record_id) AS last FROM records GROUP BY run_id').all();
    if (stats.reduce((n,r) => n + r.n, 0) > maxRecords) fail('RESOURCE_LIMIT');
    for (const r of stats) { if (!runs.has(r.run_id)) fail('ORPHAN_RAW_RECORD'); Object.assign(runs.get(r.run_id), { records: ordinal(r.n), first: r.first, last: r.last }); }
    for (const run of runs.values()) {
      const first = db.prepare('SELECT kind,payload FROM records WHERE run_id=? AND record_id=1').get(run.run);
      if (first?.kind !== 'RUN_BEGIN') fail('MISSING_RUN_BEGIN');
      const raw = JSON.parse(first.payload), f = raw.fields;
      if (raw.run !== run.run || raw.kind !== 'RUN_BEGIN' || f.record !== '1' || f.database_protocol !== 'LSDB1' || f.lifesigns_universe_id !== result.universe) fail('RAW_IDENTITY_MISMATCH');
      // A rebuilt baseline legitimately resets missing saved ancestry in the
      // session projection; ordinary children must match their raw parent.
      if (!run.baseline && (f.parent_run !== run.parent || ordinal(f.parent_record) !== run.parentRecord)) fail('SESSION_PARENT_MISMATCH');
    }
    for (const [table, kind] of [['profile_versions', 'PROFILE_END'], ['events', 'ENTITY_EVENT']]) {
      const bad = db.prepare(`SELECT 1 FROM ${table} p LEFT JOIN records r ON p.run_id=r.run_id AND p.record_id=r.record_id WHERE r.kind IS NULL OR r.kind<>? LIMIT 1`).get(kind);
      if (bad) fail('PROJECTION_MISMATCH');
      if (db.prepare(`SELECT count(*) n FROM ${table}`).get().n !== db.prepare('SELECT count(*) n FROM records WHERE kind=?').get(kind).n) fail('PROJECTION_MISMATCH');
    }
    let count = 0;
    const active = new Map();
    for (const r of db.prepare("SELECT run_id,record_id,kind,payload FROM records WHERE kind IN ('PROFILE_BEGIN','PROFILE_END','SNAPSHOT_END') ORDER BY run_id,record_id").iterate()) {
      if (++count > maxBoundaries || r.payload.length > 1048576) fail('RESOURCE_LIMIT');
      const run = runs.get(r.run_id); if (!run) fail('ORPHAN_RAW_RECORD');
      const raw = JSON.parse(r.payload);
      if (raw.run !== r.run_id || raw.kind !== r.kind || raw.fields.record !== String(r.record_id)) fail('RAW_IDENTITY_MISMATCH');
      if (r.kind === 'PROFILE_BEGIN') {
        if (active.has(r.run_id)) fail('NESTED_PROFILE');
        const p = { begin: r.record_id, end: null, number: raw.fields.profile }; run.profiles.push(p); active.set(r.run_id, p);
      } else if (r.kind === 'PROFILE_END') {
        const p = active.get(r.run_id); if (!p || p.number !== raw.fields.profile) fail('UNMATCHED_PROFILE');
        p.end = r.record_id; active.delete(r.run_id);
      } else {
        if (active.has(r.run_id)) fail('BASELINE_WITH_OPEN_PROFILE');
        const n = db.prepare('SELECT count(*) n FROM profile_versions WHERE run_id=? AND record_id<=?').get(r.run_id, r.record_id).n;
        if (n !== ordinal(raw.fields.profiles)) fail('BASELINE_COUNT_MISMATCH'); run.snapshotEnds.push(r.record_id);
      }
    }
    for (const r of db.prepare('SELECT run_id,record_id FROM profile_versions ORDER BY run_id,record_id').iterate()) runs.get(r.run_id).profileEnds.push(r.record_id);
    for (const r of db.prepare('SELECT run_id,record_id FROM events ORDER BY run_id,record_id').iterate()) runs.get(r.run_id).eventRecords.push(r.record_id);
    db.exec('ROLLBACK');
    if (version !== db.prepare('PRAGMA data_version').get().data_version || !stable(info, fs.fstatSync(fd)) || !stable(info, checkPath(file))) fail('DATABASE_CHANGED');
    checkSidecars(file);
    checkAvailability(file, getAvailability);
    return { ...result, status: 'OWNED', bytes: info.size, ready: true, runs: [...runs.values()] };
  } catch (e) { return { ...result, problem: /^[A-Z_]+$/.test(e.message) ? e.message : e.code === 'ENOENT' ? 'MISSING_DATABASE' : 'INVALID_OR_UNREADABLE_DATABASE' }; }
  finally { db?.close(); if (fd !== undefined) fs.closeSync(fd); }
}
