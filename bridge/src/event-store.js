import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const SCHEMA = `CREATE TABLE docking_events (
  event_id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type = 'docked'),
  ship_idcode TEXT NOT NULL,
  destination_idcode TEXT NOT NULL,
  received_at_utc TEXT NOT NULL
) STRICT`;
const normalise = (sql) => sql.trim().replace(/\s+/g, ' ');

function validate(db, allowEmpty) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const application = db.prepare('PRAGMA application_id').get().application_id;
  const objects = db.prepare('SELECT type, name, sql FROM sqlite_schema ORDER BY name').all();
  if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') {
    throw new Error('Database integrity check failed');
  }
  if (allowEmpty && version === 0 && application === 0 && objects.length === 0) return 'empty';
  if (version !== 1 || application !== 0 || objects.length !== 1 ||
      objects[0].type !== 'table' || objects[0].name !== 'docking_events' ||
      normalise(objects[0].sql) !== normalise(SCHEMA)) {
    throw new Error('Incompatible database: expected docking_events schema version 1; no migration or repair attempted');
  }
  return 'ready';
}

export function openEventStore(path, { readOnly = false } = {}) {
  const filename = resolve(path);
  let db;
  try {
    // Reject existing incompatible files before opening any writable connection.
    if (existsSync(filename)) {
      const check = new DatabaseSync(filename, { readOnly: true });
      try { validate(check, !readOnly); } finally { check.close(); }
    } else if (readOnly) {
      throw new Error('Database does not exist (readback never creates one)');
    } else {
      mkdirSync(dirname(filename), { recursive: true });
    }
    db = new DatabaseSync(filename, { readOnly });
    if (!readOnly) {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (validate(db, true) === 'empty') {
          db.exec(SCHEMA);
          db.exec('PRAGMA user_version = 1');
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } else {
      validate(db, false);
    }
    const select = db.prepare('SELECT * FROM docking_events WHERE event_id = ?');
    const insert = readOnly ? null : db.prepare(`INSERT INTO docking_events
      (event_type, ship_idcode, destination_idcode, received_at_utc) VALUES (?, ?, ?, ?)`);
    return {
      persist({ ship, destination }) {
        if (readOnly) throw new Error('Cannot persist using a read-only database');
        try {
          // One explicit transaction per docking, with no equality-based deduplication.
          db.exec('BEGIN IMMEDIATE');
          let eventId;
          try {
            const result = insert.run('docked', ship, destination, new Date().toISOString());
            eventId = result.lastInsertRowid;
            db.exec('COMMIT');
          } catch (error) {
            db.exec('ROLLBACK');
            throw error;
          }
          // Read after commit; only the stored row is returned for acknowledgement.
          const stored = select.get(eventId);
          if (!stored) throw new Error('Committed record could not be read back');
          return { ...stored };
        } catch (error) {
          throw new Error(`Failed to persist docking: ${error.message}`, { cause: error });
        }
      },
      list() { return db.prepare('SELECT * FROM docking_events ORDER BY event_id').all().map((row) => ({ ...row })); },
      close() { db.close(); }
    };
  } catch (error) {
    if (db?.isOpen) db.close();
    throw new Error(`Database error: ${error.message}`, { cause: error });
  }
}
