import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openEventStore } from '../src/event-store.js';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'lifesigns-store-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, 'history.db');
}
const docking = { ship: 'ABC-123', destination: 'DEF-456' };

test('initialises version 1 in a new file and commits a readable row', (t) => {
  const path = fixture(t);
  const store = openEventStore(path);
  try {
    const row = store.persist(docking);
    assert.equal(row.event_id, 1);
    assert.equal(row.event_type, 'docked');
    assert.equal(row.ship_idcode, docking.ship);
    assert.equal(row.destination_idcode, docking.destination);
    assert.match(row.received_at_utc, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Independent connection sees the row while the writer remains open: commit happened.
    const reader = new DatabaseSync(path, { readOnly: true });
    try {
      assert.equal(reader.prepare('PRAGMA user_version').get().user_version, 1);
      assert.deepEqual({ ...reader.prepare('SELECT * FROM docking_events').get() }, row);
    } finally { reader.close(); }
  } finally { store.close(); }
});

test('initialises an existing empty SQLite database only', (t) => {
  const path = fixture(t);
  const empty = new DatabaseSync(path);
  empty.close();
  const store = openEventStore(path);
  assert.deepEqual(store.list(), []);
  store.close();
});

test('parameterised values stay literal and repeated docking remains separate', (t) => {
  const store = openEventStore(fixture(t));
  try {
    const values = { ship: "ABC-123'); DROP TABLE docking_events; --", destination: 'DEF-456' };
    const first = store.persist(values);
    const second = store.persist(values);
    assert.equal(first.ship_idcode, values.ship);
    assert.notEqual(first.event_id, second.event_id);
    assert.deepEqual(store.list(), [first, second]);
  } finally { store.close(); }
});

test('read-only reopen returns identical rows and cannot insert or change bytes', (t) => {
  const path = fixture(t);
  const writer = openEventStore(path);
  const row = writer.persist(docking);
  writer.close();
  const before = readFileSync(path);
  const reader = openEventStore(path, { readOnly: true });
  try {
    assert.deepEqual(reader.list(), [row]);
    assert.throws(() => reader.persist(docking), /read-only/);
  } finally { reader.close(); }
  assert.deepEqual(readFileSync(path), before);
});

test('read-only missing database is never created', (t) => {
  const path = fixture(t);
  assert.throws(() => openEventStore(path, { readOnly: true }), /does not exist/);
  assert.equal(existsSync(path), false);
});

test('read-only empty database is not initialised', (t) => {
  const path = fixture(t);
  writeFileSync(path, '');
  assert.throws(() => openEventStore(path, { readOnly: true }), /Incompatible/);
  assert.equal(readFileSync(path).length, 0);
});

for (const [name, mutate] of [
  ['unrelated table', (db) => db.exec('CREATE TABLE unrelated(value TEXT)')],
  ['wrong version', (db) => db.exec('PRAGMA user_version = 2')],
  ['additional column', (db) => db.exec('ALTER TABLE docking_events ADD COLUMN extra TEXT')],
  ['additional trigger', (db) => db.exec('CREATE TRIGGER extra AFTER INSERT ON docking_events BEGIN SELECT 1; END')],
  ['foreign application marker', (db) => db.exec('PRAGMA application_id = 123')],
  ['wrong schema claiming version 1', (db) => db.exec('DROP TABLE docking_events; CREATE TABLE docking_events(event_id INTEGER PRIMARY KEY); PRAGMA user_version = 1')]
]) {
  test(`rejects ${name} without modifying the database`, (t) => {
    const path = fixture(t);
    openEventStore(path).close();
    const other = new DatabaseSync(path);
    try { mutate(other); } finally { other.close(); }
    const before = readFileSync(path);
    assert.throws(() => openEventStore(path), /Incompatible/);
    assert.throws(() => openEventStore(path, { readOnly: true }), /Incompatible/);
    assert.deepEqual(readFileSync(path), before);
  });
}

test('corrupt/non-SQLite input is rejected without destructive recovery', (t) => {
  const path = fixture(t);
  writeFileSync(path, 'not a database');
  const before = readFileSync(path);
  assert.throws(() => openEventStore(path), /Database error/);
  assert.deepEqual(readFileSync(path), before);
});

test('write lock failure throws and commits no row; connection closes', (t) => {
  const path = fixture(t);
  const store = openEventStore(path);
  const locker = new DatabaseSync(path);
  try {
    locker.exec('BEGIN IMMEDIATE');
    assert.throws(() => store.persist(docking), /Failed to persist docking:.*locked/);
    locker.exec('ROLLBACK');
    assert.deepEqual(store.list(), []);
  } finally { locker.close(); store.close(); }
  // Reopen writable after closure, with no lingering locks.
  openEventStore(path).close();
});

test('different database files keep separate histories', (t) => {
  const firstPath = fixture(t);
  const secondPath = fixture(t);
  const first = openEventStore(firstPath);
  const second = openEventStore(secondPath);
  try {
    first.persist(docking);
    assert.equal(first.list().length, 1);
    assert.deepEqual(second.list(), []);
    second.persist({ ship: 'GHI-789', destination: 'JKL-012' });
    assert.equal(first.list()[0].ship_idcode, 'ABC-123');
    assert.equal(second.list()[0].ship_idcode, 'GHI-789');
  } finally { first.close(); second.close(); }
});
