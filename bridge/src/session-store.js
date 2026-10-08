import { DatabaseSync } from 'node:sqlite';
import { openSync, closeSync, fstatSync, readSync } from 'node:fs';
import { SCHEMA, openEventStore } from './event-store.js';
import { validateSessionKey, validateSessionRecord } from './session-key.js';
import { checkPath, checkSidecars, sameFile, sessionTarget, REPOSITORY_ROOT } from './session-path.js';

export const OWNERSHIP_SCHEMA = `CREATE TABLE session_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  session_key TEXT NOT NULL,
  key_scheme TEXT NOT NULL CHECK (key_scheme = 's1')
) STRICT`;
const normalise = (sql) => sql?.trim().replace(/\s+/g, ' ');

function validate(db, expectedSession) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const application = db.prepare('PRAGMA application_id').get().application_id;
  const objects = db.prepare('SELECT type, name, sql FROM sqlite_schema ORDER BY name').all();
  const integrity = db.prepare('PRAGMA quick_check').all();
  if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') {
    throw new Error('Database integrity check failed');
  }
  if (version !== 2 || application !== 0 || objects.length !== 2 ||
      objects[0].type !== 'table' || objects[0].name !== 'docking_events' ||
      normalise(objects[0].sql) !== normalise(SCHEMA) ||
      objects[1].type !== 'table' || objects[1].name !== 'session_metadata' ||
      normalise(objects[1].sql) !== normalise(OWNERSHIP_SCHEMA)) {
    throw new Error('Incompatible database: expected exact session schema version 2; no migration or repair attempted');
  }
  const rows = db.prepare('SELECT * FROM session_metadata').all();
  if (rows.length !== 1 || rows[0].singleton !== 1 || rows[0].key_scheme !== 's1') {
    throw new Error('Invalid session ownership metadata');
  }
  validateSessionKey(rows[0].session_key);
  if (expectedSession !== undefined && rows[0].session_key !== expectedSession) {
    throw new Error('Session ownership mismatch');
  }
  return { ...rows[0] };
}

function readOnlySession(filename, expectedSession) {
  checkPath(filename);
  checkSidecars(filename);
  // A read-only SQLite connection may still create WAL shared-memory sidecars.
  // Our automatic databases use rollback journals; reject WAL headers before SQLite.
  const handle = openSync(filename, 'r');
  try {
    const header = Buffer.alloc(20);
    if (readSync(handle, header, 0, header.length, 0) === 20 &&
        header.subarray(0, 16).toString() === 'SQLite format 3\0' &&
        (header[18] !== 1 || header[19] !== 1)) {
      throw new Error('Incompatible automatic database journal format (rollback journal required)');
    }
  } finally { closeSync(handle); }
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const ownership = validate(db, expectedSession);
    return {
      ownership,
      list() { return db.prepare('SELECT * FROM docking_events ORDER BY event_id').all().map((row) => ({ ...row })); },
      close() { db.close(); }
    };
  } catch (error) { db.close(); throw error; }
}

// Only routing creates filenames. This internal opener never initialises an existing file.
function openSessionStore(filename, session) {
  let db;
  let reservation;
  try {
    let info = checkPath(filename, { missing: true });
    checkSidecars(filename);
    let created = false;
    if (!info) {
      try {
        reservation = openSync(filename, 'wx'); // Exclusive creation, never truncate.
        info = fstatSync(reservation);
        created = true;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // Another creator won. Treat its file as existing; never initialise it.
        info = checkPath(filename);
      }
    }
    const guard = () => {
      if (!sameFile(info, checkPath(filename))) throw new Error('Automatic database file changed');
      checkSidecars(filename);
    };
    guard();
    if (!created) readOnlySession(filename, session).close();
    guard();
    db = new DatabaseSync(filename);
    guard();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (created) {
        if (db.prepare('PRAGMA user_version').get().user_version !== 0 ||
            db.prepare('PRAGMA application_id').get().application_id !== 0 ||
            db.prepare('SELECT name FROM sqlite_schema').all().length !== 0) {
          throw new Error('New automatic database changed before initialisation');
        }
        db.exec(SCHEMA);
        db.exec(OWNERSHIP_SCHEMA);
        db.prepare("INSERT INTO session_metadata VALUES (1, ?, 's1')").run(session);
        db.exec('PRAGMA user_version = 2');
      }
      validate(db, session); // Recheck under the write transaction.
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const insert = db.prepare(`INSERT INTO docking_events
      (event_type, ship_idcode, destination_idcode, received_at_utc) VALUES (?, ?, ?, ?)`);
    const select = db.prepare('SELECT * FROM docking_events WHERE event_id = ?');
    return {
      persist(record) {
        validateSessionRecord(record);
        if (record.session !== session) throw new Error('Session ownership mismatch');
        guard();
        let eventId;
        db.exec('BEGIN IMMEDIATE');
        try {
          validate(db, session);
          eventId = insert.run('docked', record.ship, record.destination, new Date().toISOString()).lastInsertRowid;
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
        // A successful acknowledgement uses only the committed row, read after COMMIT.
        const stored = select.get(eventId);
        if (!stored) throw new Error('Committed record could not be read back');
        return { ...stored };
      },
      close() { db.close(); }
    };
  } catch (error) {
    if (db?.isOpen) db.close();
    throw new Error(`Automatic database error: ${error.message}`, { cause: error });
  } finally {
    if (reservation !== undefined) closeSync(reservation);
  }
}

export function createSessionRouter({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  let active;
  let activeSession;
  let stopped = false;
  return {
    persist(record) {
      // Invalid input must not touch storage or inherit the previous key.
      validateSessionRecord(record);
      if (stopped) throw new Error('Automatic persistence has stopped');
      try {
        if (record.session !== activeSession) {
          const previous = active;
          active = undefined;
          activeSession = undefined;
          previous?.close();
          const filename = sessionTarget(record.session, repositoryRoot);
          active = openSessionStore(filename, record.session);
          activeSession = record.session;
        }
        return active.persist(record);
      } catch (error) {
        stopped = true;
        const previous = active;
        active = undefined;
        activeSession = undefined;
        previous?.close();
        throw error;
      }
    },
    close() {
      stopped = true;
      const previous = active;
      active = undefined;
      previous?.close();
    }
  };
}

export function openReadbackStore(filename) {
  let handle;
  try {
    // Inspect only the header before choosing the validator. In particular, never
    // let SQLite open a v2 file with an unsafe sidecar even for initial inspection.
    try { handle = openSync(filename, 'r'); } catch (error) {
      if (error.code === 'ENOENT') throw new Error('Database does not exist (readback never creates one)');
      throw error;
    }
    const header = Buffer.alloc(100);
    const count = readSync(handle, header, 0, header.length, 0);
    closeSync(handle);
    handle = undefined;
    if (count !== 100 || header.subarray(0, 16).toString() !== 'SQLite format 3\0') {
      throw new Error('Invalid or uninitialised SQLite database header');
    }
    const version = header.readUInt32BE(60);
    if (version === 1) return openEventStore(filename, { readOnly: true });
    if (version === 2) return readOnlySession(filename);
    throw new Error('Incompatible database: expected schema version 1 or 2');
  } catch (error) {
    throw new Error(`Database error: ${error.message}`, { cause: error });
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
}
