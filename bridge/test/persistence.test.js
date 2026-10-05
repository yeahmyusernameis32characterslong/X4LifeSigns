import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, writeFile, appendFile, readFile, rm, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { openEventStore } from '../src/event-store.js';

const writerScript = fileURLToPath(new URL('../src/read-events.js', import.meta.url));
const readerScript = fileURLToPath(new URL('../src/read-stored-events.js', import.meta.url));
const line = 'LIFESIGNS_BRIDGE_V1|docked|ship=ABC-123|destination=DEF-456|END\n';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'lifesigns-persistence-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const log = join(directory, 'debuglog.txt');
  const db = join(directory, 'history.db');
  await writeFile(log, line); // Historical event must not be imported.
  return { log, db, directory };
}

async function writer(t, f) {
  // Test-only IPC lets Windows exercise the actual graceful SIGINT handler.
  const launcher = `import { pathToFileURL } from 'node:url';
    process.on('message', () => { process.disconnect(); process.emit('SIGINT'); });
    process.channel.unref();
    await import(pathToFileURL(process.argv[1]));`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', launcher,
    writerScript, '--log', f.log, '--db', f.db], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let output = '';
  let errors = '';
  let finished = false;
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { errors += data; });
  const exited = new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => { finished = true; done(code); });
  });
  t.after(async () => { if (!finished) child.kill(); await exited; });
  async function waitFor(text) {
    const end = Date.now() + 5000;
    while (!output.includes(text)) {
      if (finished || Date.now() > end) throw new Error(`Writer did not print ${text}: ${output} ${errors}`);
      await delay(20);
    }
  }
  await waitFor('Watching from current end:');
  return {
    waitFor,
    output: () => output,
    errors: () => errors,
    async stop() {
      child.send('stop');
      const code = await Promise.race([exited, delay(5000).then(() => { throw new Error('Shutdown timeout'); })]);
      assert.equal(code, 0, errors);
    },
    exited
  };
}

function readback(db) {
  const result = spawnSync(process.execPath, [readerScript, '--db', db], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split(/\r?\n/);
  return { rows: lines.slice(0, -1).map((value) => JSON.parse(value)), count: lines.at(-1) };
}

test('commit/readback survives graceful writer restarts; only new dockings add rows', async (t) => {
  const f = await fixture(t);
  const first = await writer(t, f);
  await appendFile(f.log, 'unrelated\nLIFESIGNS_BRIDGE_V1 malformed\n' + line);
  await first.waitFor('Docking persisted:');
  const persisted = JSON.parse(first.output().split('Docking persisted: ')[1].split(/\r?\n/)[0]);
  assert.match(first.errors(), /Malformed/);
  await first.stop();
  const one = readback(f.db);
  assert.equal(one.count, 'Stored docking count: 1');
  assert.deepEqual(one.rows, [persisted]);
  assert.equal(persisted.ship_idcode, 'ABC-123');
  assert.equal(persisted.destination_idcode, 'DEF-456');

  await appendFile(f.log, line); // Capture while stopped is deliberately unsupported.
  const restarted = await writer(t, f);
  await delay(350);
  await restarted.stop();
  assert.equal(restarted.output().includes('Docking persisted'), false);
  assert.deepEqual(readback(f.db), one);

  const second = await writer(t, f);
  await appendFile(f.log, line);
  await second.waitFor('Docking persisted:');
  await second.stop();
  const two = readback(f.db);
  assert.equal(two.count, 'Stored docking count: 2');
  assert.deepEqual(two.rows[0], persisted);
  assert.notEqual(two.rows[0].event_id, two.rows[1].event_id);
  assert.equal(two.rows[1].ship_idcode, persisted.ship_idcode);
  assert.equal(two.rows[1].destination_idcode, persisted.destination_idcode);
});

test('writer failure after startup exits without a false persisted acknowledgement', async (t) => {
  const f = await fixture(t);
  const running = await writer(t, f);
  const locker = new DatabaseSync(f.db);
  try {
    locker.exec('BEGIN IMMEDIATE');
    await appendFile(f.log, line);
    assert.equal(await Promise.race([running.exited,
      delay(5000).then(() => { throw new Error('Writer failure exit timeout'); })]), 1);
    assert.equal(running.output().includes('Docking persisted'), false);
    assert.match(running.errors(), /Failed to persist docking:.*locked/);
    assert.equal(running.errors().includes('Malformed'), false);
    locker.exec('ROLLBACK');
  } finally { locker.close(); }
  assert.equal(readback(f.db).count, 'Stored docking count: 0');
});

test('incompatible database fails before watching, preserving its bytes', async (t) => {
  const f = await fixture(t);
  const other = new DatabaseSync(f.db);
  other.exec('CREATE TABLE unrelated (value TEXT)');
  other.close();
  const before = await readFile(f.db);
  const result = spawnSync(process.execPath, [writerScript, '--log', f.log, '--db', f.db], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Incompatible database/);
  assert.equal(result.stdout, '');
  assert.deepEqual(await readFile(f.db), before);
});

test('readback missing/incompatible database fails without creation or mutation', async (t) => {
  const f = await fixture(t);
  const missing = spawnSync(process.execPath, [readerScript, '--db', f.db], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /does not exist/);
  await assert.rejects(readFile(f.db), { code: 'ENOENT' });
  await writeFile(f.db, 'not a database');
  const bad = spawnSync(process.execPath, [readerScript, '--db', f.db], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Readback error: Database error/);
  assert.equal(bad.stdout, '');
  assert.equal(await readFile(f.db, 'utf8'), 'not a database');
});

test('readback uses no game/log and leaves database bytes unchanged', async (t) => {
  const f = await fixture(t);
  const store = openEventStore(f.db);
  const row = store.persist({ ship: 'ABC-123', destination: 'DEF-456' });
  store.close();
  await rm(f.log);
  const before = await readFile(f.db);
  assert.deepEqual(readback(f.db).rows, [row]);
  assert.deepEqual(await readFile(f.db), before);
});

test('database path aliasing the log is refused, including hard links', async (t) => {
  const f = await fixture(t);
  await writeFile(f.log, '');
  await link(f.log, f.db);
  for (const db of [f.log, f.db]) {
    const result = spawnSync(process.execPath, [writerScript, '--log', f.log, '--db', db], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /different file/);
    assert.equal(await readFile(f.log, 'utf8'), '');
  }
});

test('readback requires an explicit --db argument', () => {
  for (const args of [[], ['--db'], ['--log', 'x'], ['--db', 'x', '--db', 'y']]) {
    const result = spawnSync(process.execPath, [readerScript, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage/);
  }
});
