import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fsModule from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync,
  rmSync, symlinkSync, linkSync, renameSync, cpSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { validateSessionKey } from '../src/session-key.js';
import { parseV2Record, parseRecord, parseArgs, createTail } from '../src/read-events.js';
import { createSessionRouter, openReadbackStore } from '../src/session-store.js';
import { openEventStore } from '../src/event-store.js';
import { SESSION_DIRECTORY } from '../src/session-path.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const key = 's1-2026-10-08_12-30-00-0-1-2-2147483647';
const other = 's1-2026-10-08_12-30-00-0-1-2-2147483646'; // Identical clock, different tuple.
const record = (session = key) => ({ session, ship: 'ABC-123', destination: 'DEF-456' });
const v1 = 'LIFESIGNS_BRIDGE_V1|docked|ship=ABC-123|destination=DEF-456|END';
const v2 = (session = key) => `LIFESIGNS_BRIDGE_V2|docked|session=${session}|ship=ABC-123|destination=DEF-456|END`;
const badKeys = [
  '', '../escape', '..\\escape', key + '.db', key + '-5', key + '|extra=1', key + ' ',
  key + '\n', ' ' + key, key.replace('-0-1-', '-00-1-'), key.replace('-0-1-', '-+0-1-'),
  key.replace('-0-1-', '--1-1-'), key.replace('2147483647', '2147483648'),
  key.replace('2147483647', '999999999999999999999999'), key.replace('-0-1-', '-1e3-1-'),
  key.replace('-0-1-', '-1.0-1-'), key.replace('-0-1-', '-0/1-1-'),
  key.replace('-0-1-', '-0\\1-1-'), key.replace('-0-1-', '-0\t-1-'),
  key.replace('s1-', 's2-'), key.replace('2026-10', '26-10'),
  key.replace('_12-30-00', '_24-30-00'), key.replace('_12-30-00', '_12-60-00'),
  key.replace('_12-30-00', '_12-30-60'), key.replace('2026-10-08', '2026-02-29'),
  key.replace('2026-10-08', '2026-00-08'), key.replace('2026-10-08', '2026-13-08'),
  key.replace('2026-10-08', '2026-04-31'), key.replace('2026-10-08', '2026-10-00')
];

function fixture(t, copy = false) {
  const directory = mkdtempSync(join(tmpdir(), 'lifesigns-auto-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  if (copy) {
    mkdirSync(join(directory, 'bridge'));
    cpSync(join(root, 'bridge/src'), join(directory, 'bridge/src'), { recursive: true });
    cpSync(join(root, 'bridge/package.json'), join(directory, 'bridge/package.json'));
  }
  return {
    directory,
    filename: (session = key) => join(directory, 'local-data/sessions', session + '.db'),
    router: () => createSessionRouter({ repositoryRoot: directory })
  };
}
function read(path) {
  const store = openReadbackStore(path);
  try { return { ownership: store.ownership, rows: store.list() }; } finally { store.close(); }
}
function seed(f, session = key) {
  const router = f.router();
  try { return router.persist(record(session)); } finally { router.close(); }
}
function mutate(path, sql) {
  const db = new DatabaseSync(path);
  try { db.exec(sql); } finally { db.close(); }
}

test('V2 exact parsing, clock representation and bounded canonical integer limbs', () => {
  assert.deepEqual(parseV2Record('[General] 12.3 ' + v2()), record());
  assert.equal(validateSessionKey(key), key);
  assert.equal(validateSessionKey(key.replace('2026-10-08', '2024-02-29')), key.replace('2026-10-08', '2024-02-29'));
  assert.equal(parseV2Record(v1), null);
  assert.equal(parseRecord(v2()), null);
  for (const bad of badKeys) {
    assert.throws(() => validateSessionKey(bad), /canonical/);
    assert.throws(() => parseV2Record(v2(bad)), /Malformed/);
  }
  for (const bad of [v2().replace('session=' + key + '|', ''), v2().replace('ABC-123', ''),
    v2().replace('docked', 'docking'), v2() + '|extra', v2() + ' ', v2() + '\n',
    v2().replace('ship=ABC-123|destination=DEF-456', 'destination=DEF-456|ship=ABC-123'),
    v2().replace('|END', '|session=' + key + '|END')]) {
    assert.throws(() => parseV2Record(bad), /Malformed/);
  }
});

test('auto flag is opt-in and conflicts clearly with manual db in either order', () => {
  assert.deepEqual(parseArgs(['--auto-db', '--log', 'x']), { logPath: resolve('x'), dbPath: undefined, autoDb: true });
  for (const args of [
    ['--log', 'x', '--db', 'y', '--auto-db'],
    ['--auto-db', '--db', 'y', '--log', 'x']
  ]) assert.throws(() => parseArgs(args), /mutually exclusive/);
  for (const args of [['--auto-db'], ['--log', 'x', '--auto-db', '--auto-db'],
    ['--log', 'x', '--auto-db', 'y']]) assert.throws(() => parseArgs(args), /Usage/);
});

test('malformed V2 warns and never creates storage or reuses the preceding key', async (t) => {
  const f = fixture(t);
  const log = join(f.directory, 'log.txt');
  writeFileSync(log, '');
  const router = f.router();
  const warnings = [];
  const acknowledged = [];
  const tail = await createTail(log, { parse: parseV2Record,
    onWarning: (message) => warnings.push(message),
    onRecord: (value) => acknowledged.push(router.persist(value)) });
  writeFileSync(log, badKeys.map(v2).join('\n') + '\n' +
    v2().replace('session=' + key + '|', '') + '\n' + v1 + '\n' +
    'LIFESIGNS_SESSION_ROUTING_V1|assigned|session=' + key + '|END\n');
  await tail.poll();
  assert.equal(existsSync(join(f.directory, 'local-data')), false);
  assert.equal(acknowledged.length, 0);
  assert.ok(warnings.length >= badKeys.length);
  // Also protect the storage API before any filesystem operation.
  for (const bad of badKeys) assert.throws(() => router.persist(record(bad)));
  assert.throws(() => router.persist({ ...record(), ship: '../bad' }));
  assert.equal(existsSync(join(f.directory, 'local-data')), false);
  const { appendFileSync } = await import('node:fs');
  appendFileSync(log, v2() + '\n' + v2('') + '\n');
  await tail.poll();
  assert.equal(acknowledged.length, 1);
  assert.equal(read(f.filename()).rows.length, 1);
  router.close();
});

test('v2 transactional schema and exact ownership; committed readback before return', (t) => {
  const f = fixture(t);
  const router = f.router();
  try {
    const row = router.persist(record());
    const independent = read(f.filename());
    assert.deepEqual(independent.ownership, { singleton: 1, session_key: key, key_scheme: 's1' });
    assert.deepEqual(independent.rows, [row]);
    const db = new DatabaseSync(f.filename(), { readOnly: true });
    try {
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
      assert.deepEqual(db.prepare('SELECT name FROM sqlite_schema ORDER BY name').all().map(x => x.name),
        ['docking_events', 'session_metadata']);
    } finally { db.close(); }
  } finally { router.close(); }
});

test('initialisation failure rolls back schema, ownership and version together', (t) => {
  const f = fixture(t);
  const original = DatabaseSync.prototype.exec;
  t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
    if (sql === 'PRAGMA user_version = 2') throw new Error('injected initialisation failure');
    return original.call(this, sql);
  });
  const router = f.router();
  assert.throws(() => router.persist(record()), /initialisation failure/);
  router.close();
  const db = new DatabaseSync(f.filename(), { readOnly: true });
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 0);
    assert.deepEqual(db.prepare('SELECT name FROM sqlite_schema').all(), []);
  } finally { db.close(); }
});

test('clock-identical different tuples route separately; identical complete keys reuse their owner', (t) => {
  const f = fixture(t);
  const router = f.router();
  try {
    const first = router.persist(record());
    router.persist(record(other));
    // Windows refuses renaming a SQLite file while its connection is open.
    const moved = join(f.directory, 'closed-owner.db');
    renameSync(f.filename(), moved);
    renameSync(moved, f.filename());
    assert.deepEqual(read(f.filename()).rows, [first]);
    router.persist(record());
    assert.deepEqual(read(f.filename()).rows[0], first);
    assert.equal(read(f.filename()).rows.length, 2);
    assert.equal(read(f.filename(other)).rows.length, 1);
    assert.deepEqual(readdirSync(join(f.directory, 'local-data/sessions')).sort(),
      [key + '.db', other + '.db'].sort()); // No invented suffix.
  } finally { router.close(); }
});

for (const [name, sql, ownerOnly] of [
  ['wrong owner', `UPDATE session_metadata SET session_key = '${other}'`, true],
  ['wrong scheme', "PRAGMA ignore_check_constraints=ON; UPDATE session_metadata SET key_scheme='s2'"],
  ['absent owner', 'DELETE FROM session_metadata'],
  ['extra owner', `PRAGMA ignore_check_constraints=ON; INSERT INTO session_metadata VALUES (2, '${key}', 's1')`],
  ['malformed owner', "UPDATE session_metadata SET session_key='../escape'"],
  ['unexpected table', 'CREATE TABLE extra(value TEXT)'],
  ['unexpected trigger', 'CREATE TRIGGER extra AFTER INSERT ON docking_events BEGIN SELECT 1; END'],
  ['changed schema', 'ALTER TABLE docking_events ADD COLUMN extra TEXT'],
  ['wrong version', 'PRAGMA user_version=3'],
  ['application marker', 'PRAGMA application_id=1']
]) {
  test(`rejects ${name} without modification or repair`, (t) => {
    const f = fixture(t);
    seed(f);
    mutate(f.filename(), sql);
    const before = readFileSync(f.filename());
    const router = f.router();
    assert.throws(() => router.persist(record()));
    router.close();
    if (ownerOnly) assert.equal(read(f.filename()).ownership.session_key, other);
    else assert.throws(() => read(f.filename()));
    assert.deepEqual(readFileSync(f.filename()), before);
    assert.deepEqual(readdirSync(join(f.directory, 'local-data/sessions')), [key + '.db']);
  });
}

for (const kind of ['empty file', 'empty SQLite', 'v1', 'corrupt']) {
  test(`existing ${kind} at automatic target is never initialised or modified`, (t) => {
    const f = fixture(t);
    mkdirSync(join(f.directory, 'local-data/sessions'), { recursive: true });
    if (kind === 'v1') openEventStore(f.filename()).close();
    else if (kind === 'empty SQLite') new DatabaseSync(f.filename()).close();
    else writeFileSync(f.filename(), kind === 'corrupt' ? 'not SQLite' : '');
    const before = readFileSync(f.filename());
    const router = f.router();
    assert.throws(() => router.persist(record()));
    router.close();
    assert.deepEqual(readFileSync(f.filename()), before);
  });
}

test('readback accepts any filename for canonical v2 ownership and does not write', (t) => {
  const f = fixture(t);
  const row = seed(f);
  const renamed = join(f.directory, 'renamed.db');
  renameSync(f.filename(), renamed);
  const before = readFileSync(renamed);
  assert.deepEqual(read(renamed), { ownership: { singleton: 1, session_key: key, key_scheme: 's1' }, rows: [row] });
  const result = spawnSync(process.execPath, [join(root, 'bridge/src/read-stored-events.js'), '--db', renamed], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Session ownership:/);
  assert.ok(result.stdout.includes(key));
  assert.match(result.stdout, /Stored docking count: 1/);
  assert.deepEqual(readFileSync(renamed), before);
});

test('automatic lock failure stops the router; no fallback or further writes', (t) => {
  const f = fixture(t);
  const router = f.router();
  router.persist(record());
  const locker = new DatabaseSync(f.filename());
  try {
    locker.exec('BEGIN IMMEDIATE');
    assert.throws(() => router.persist(record()), /locked/);
    locker.exec('ROLLBACK');
    assert.throws(() => router.persist(record(other)), /stopped/);
    assert.equal(existsSync(f.filename(other)), false);
    assert.equal(read(f.filename()).rows.length, 1);
  } finally { locker.close(); router.close(); }
});

test('commit failure and missing committed readback never return a success', (t) => {
  for (const mode of ['commit', 'readback']) {
    const f = fixture(t);
    const router = f.router();
    router.persist(record());
    if (mode === 'commit') {
      const original = DatabaseSync.prototype.exec;
      t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
        if (sql === 'COMMIT') throw new Error('injected commit failure');
        return original.call(this, sql);
      });
    } else {
      // Existing prepared select statement uses the same prototype.
      const probe = new DatabaseSync(':memory:');
      const proto = Object.getPrototypeOf(probe.prepare('SELECT 1'));
      const original = proto.get;
      t.mock.method(proto, 'get', function(...args) {
        if (this.sourceSQL === 'SELECT * FROM docking_events WHERE event_id = ?') return undefined;
        return original.apply(this, args);
      });
      probe.close();
    }
    assert.throws(() => router.persist(record()), mode === 'commit' ? /commit failure/ : /read back/);
    router.close();
    t.mock.restoreAll();
    assert.equal(read(f.filename()).rows.length, mode === 'commit' ? 1 : 2);
  }
});

for (const location of ['local-data', 'sessions', 'target', 'journal', 'wal', 'shm']) {
  test(`refuses linked/reparse ${location} without changing the outside target`, (t) => {
    const f = fixture(t);
    const outside = join(f.directory, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'sentinel'), 'untouched');
    if (location === 'local-data') symlinkSync(outside, join(f.directory, 'local-data'), 'junction');
    else {
      mkdirSync(join(f.directory, 'local-data'));
      if (location === 'sessions') symlinkSync(outside, join(f.directory, 'local-data/sessions'), 'junction');
      else {
        mkdirSync(join(f.directory, 'local-data/sessions'));
        // Hard links require no symlink privilege on Windows and can redirect file writes too.
        linkSync(join(outside, 'sentinel'), f.filename() + (location === 'target' ? '' : '-' + location));
      }
    }
    const router = f.router();
    assert.throws(() => router.persist(record()), /linked|Unsafe|sidecar/);
    router.close();
    assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'untouched');
    assert.deepEqual(readdirSync(outside), ['sentinel']);
  });
}

test('refuses a hard-link alias added after opening before the next write', (t) => {
  const f = fixture(t);
  const router = f.router();
  try {
    router.persist(record());
    const alias = join(f.directory, 'outside.db');
    linkSync(f.filename(), alias);
    assert.throws(() => router.persist(record()), /Unsafe/);
    unlinkSync(alias);
    assert.equal(read(f.filename()).rows.length, 1);
  } finally { router.close(); }
});

test('competing automatic creators never truncate, overwrite ownership or invent filenames', (t) => {
  // Real competing Node processes may reuse a committed owner or fail closed.
  const f = fixture(t, true);
  const script = `import { createSessionRouter } from './bridge/src/session-store.js';
    const router = createSessionRouter(); try { router.persist(${JSON.stringify(record())}); } finally { router.close(); }`;
  return Promise.all(Array.from({ length: 2 }, () => new Promise((done, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { cwd: f.directory });
    let errors = '';
    child.stderr.on('data', d => { errors += d; });
    child.once('error', reject);
    child.once('exit', code => done({ code, errors }));
  }))).then(results => {
    assert.ok(results.some(r => r.code === 0), JSON.stringify(results));
    assert.equal(read(f.filename()).rows.length, results.filter(r => r.code === 0).length);
    assert.deepEqual(readdirSync(join(f.directory, 'local-data/sessions')), [key + '.db']);
  });
});

test('automatic database/journal paths are ignored and no database is tracked', () => {
  const names = ['local-data/sessions/' + key + '.db', 'local-data/sessions/' + key + '.db-journal',
    'local-data/sessions/' + key + '.db-wal', 'local-data/sessions/' + key + '.db-shm'];
  const ignored = spawnSync('git', ['check-ignore', ...names], { cwd: root, encoding: 'utf8' });
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.deepEqual(ignored.stdout.trim().split(/\r?\n/), names);
  const tracked = spawnSync('git', ['ls-files', '*.db', '*.db-journal', '*.db-wal', '*.db-shm'], { cwd: root, encoding: 'utf8' });
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.equal(tracked.stdout, '');
  assert.equal(SESSION_DIRECTORY, resolve(root, 'local-data/sessions'));
});

test('WAL-format v2 is rejected without creating shared-memory files even on readback', (t) => {
  const f = fixture(t);
  seed(f);
  mutate(f.filename(), 'PRAGMA journal_mode=WAL');
  const before = readFileSync(f.filename());
  assert.deepEqual(readdirSync(join(f.directory, 'local-data/sessions')), [key + '.db']);
  const router = f.router();
  assert.throws(() => router.persist(record()), /journal format/);
  router.close();
  assert.throws(() => read(f.filename()), /journal format/);
  assert.deepEqual(readFileSync(f.filename()), before);
  mutate(f.filename(), 'PRAGMA user_version=3');
  const incompatible = readFileSync(f.filename());
  assert.throws(() => read(f.filename()), /Incompatible/);
  assert.deepEqual(readFileSync(f.filename()), incompatible);
  assert.deepEqual(readdirSync(join(f.directory, 'local-data/sessions')), [key + '.db']);
});

test('manual v1 writer rejects a v2 automatic database unchanged', (t) => {
  const f = fixture(t);
  seed(f);
  const before = readFileSync(f.filename());
  assert.throws(() => openEventStore(f.filename()), /Incompatible/);
  assert.deepEqual(readFileSync(f.filename()), before);
});

test('exclusive-create EEXIST race never initialises the empty winning file', (t) => {
  const f = fixture(t);
  const original = fsModule.openSync;
  let raced = false;
  t.mock.method(fsModule, 'openSync', function(path, flags, ...args) {
    if (path === f.filename() && flags === 'wx' && !raced) {
      raced = true;
      fsModule.closeSync(original(path, 'wx')); // Another creator wins after lstat.
    }
    return original(path, flags, ...args);
  });
  syncBuiltinESMExports();
  const router = f.router();
  try {
    assert.throws(() => router.persist(record()), /Incompatible/);
    assert.equal(raced, true);
    assert.equal(readFileSync(f.filename()).length, 0);
    assert.deepEqual(readdirSync(join(f.directory, 'local-data/sessions')), [key + '.db']);
  } finally {
    router.close();
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
