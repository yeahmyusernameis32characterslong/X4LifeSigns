import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, cp, writeFile, appendFile, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createSessionRouter, openReadbackStore } from '../src/session-store.js';
import { openEventStore } from '../src/event-store.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const key = 's1-2026-10-08_12-30-00-1-2-3-4';
const other = 's1-2026-10-08_12-30-00-1-2-3-5';
const third = 's1-2026-10-09_12-30-00-1-2-3-4';
const v1 = 'LIFESIGNS_BRIDGE_V1|docked|ship=ABC-123|destination=DEF-456|END\n';
const v2 = (session = key) => `LIFESIGNS_BRIDGE_V2|docked|session=${session}|ship=ABC-123|destination=DEF-456|END\n`;
const record = (session = key) => ({ session, ship: 'ABC-123', destination: 'DEF-456' });

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'lifesigns-auto-cli-'));
  // Source copies ensure the actual CLI default is tested without writing to this checkout.
  const repo = join(directory, 'repo');
  await mkdir(join(repo, 'bridge'), { recursive: true });
  await cp(join(root, 'bridge/src'), join(repo, 'bridge/src'), { recursive: true });
  await cp(join(root, 'bridge/package.json'), join(repo, 'bridge/package.json'));
  const log = join(directory, 'log.txt');
  await writeFile(log, v1 + v2()); // Old records are not replayed.
  const cleanups = [];
  t.after(async () => {
    for (const cleanup of cleanups) await cleanup();
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, repo, log, cleanups, script: join(repo, 'bridge/src/read-events.js'),
    filename: (session = key) => join(repo, 'local-data/sessions', session + '.db') };
}

async function writer(f, { args = ['--auto-db'], prelude = '' } = {}) {
  const launcher = `import { pathToFileURL } from 'node:url';
    process.on('message', () => { process.disconnect(); process.emit('SIGINT'); });
    process.channel.unref();
    ${prelude}
    await import(pathToFileURL(process.argv[1]));`;
  // Launch outside the repository: storage must follow source location, never cwd.
  const child = spawn(process.execPath, ['--input-type=module', '-e', launcher,
    f.script, '--log', f.log, ...args], { cwd: f.directory, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let output = '', errors = '', finished = false;
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { errors += data; });
  const exited = new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', code => { finished = true; done(code); });
  });
  f.cleanups.push(async () => { if (!finished) child.kill(); await exited; });
  async function waitFor(text, stderr = false) {
    const end = Date.now() + 5000;
    while (!(stderr ? errors : output).includes(text)) {
      if (finished || Date.now() > end) throw new Error(`Missing ${text}: ${output} ${errors}`);
      await delay(20);
    }
  }
  await waitFor('Watching from current end:');
  return {
    waitFor, output: () => output, errors: () => errors,
    async exit() {
      let timer;
      try {
        return await Promise.race([exited, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Writer exit timeout')), 5000);
        })]);
      } finally { clearTimeout(timer); }
    },
    async stop() {
      child.send('stop');
      assert.equal(await this.exit(), 0, errors);
    }
  };
}
function read(filename) {
  const store = openReadbackStore(filename);
  try { return { ownership: store.ownership, rows: store.list() }; } finally { store.close(); }
}
function seed(f) {
  const router = createSessionRouter({ repositoryRoot: f.repo });
  try { router.persist(record()); } finally { router.close(); }
}

for (const mode of ['console', 'manual', 'auto-empty', 'auto-existing']) {
  test(`identity diagnostic records never persist in ${mode} mode`, async (t) => {
    const f = await fixture(t);
    const manual = join(f.directory, 'manual.db');
    if (mode === 'manual') {
      const store = openEventStore(manual);
      try { store.persist(record()); } finally { store.close(); }
    }
    if (mode === 'auto-existing') seed(f);
    const database = mode === 'manual' ? manual : f.filename();
    const before = existsSync(database) ? await readFile(database) : null;
    const auto = mode.startsWith('auto');
    const running = await writer(f, { args: auto ? ['--auto-db'] : mode === 'manual' ? ['--db', manual] : [] });
    const rows = ['valid', 'invalid', 'missing'].map((state, i) =>
      `LIFESIGNS_IDENTITY_DIAG_V1|ship|session=${key}|snapshot=1|fixture=LSID-BEH${i + 1}|reference=${state}|original=ABC-123|current=${state === 'valid' ? 'ABC-123' : 'UNAVAILABLE'}|class=ship_l|operational=false|commander_reference=none_or_invalid|commander_idcode=NONE|commander_fixture=NONE|END\n`).join('');
    await appendFile(f.log, rows +
      `LIFESIGNS_IDENTITY_DIAG_V1|enrolment|session=${key}|complete=false|END\n` +
      'LIFESIGNS_IDENTITY_DIAG_V1|blocked|reason=no_ready_production_session|END\n' +
      'LIFESIGNS_IDENTITY_DIAG_V1|malformed\n' +
      // A following parser warning is a barrier proving the earlier lines were consumed.
      (auto ? 'LIFESIGNS_BRIDGE_V2|malformed\n' : 'LIFESIGNS_BRIDGE_V1|malformed\n'));
    await running.waitFor(`Malformed LIFESIGNS_BRIDGE_${auto ? 'V2' : 'V1'}`, true);
    await running.stop();
    assert.equal(running.output().includes('Docking '), false);
    assert.equal(running.errors().includes('LIFESIGNS_IDENTITY_DIAG_V1'), false);
    if (before) {
      assert.deepEqual(await readFile(database), before);
      assert.equal(read(database).rows.length, 1);
    } else {
      assert.equal(existsSync(join(f.repo, 'local-data')), false);
    }
    assert.equal(existsSync(f.filename(other)), false);
  });
}

test('auto CLI is lazy, warns on malformed keys and consumes only V2 of paired records', async (t) => {
  const f = await fixture(t);
  const running = await writer(f);
  await appendFile(f.log, v1 + v2('') + v2('../escape') +
    'LIFESIGNS_SESSION_ROUTING_V1|assigned|session=' + key + '|END\n');
  await running.waitFor('Malformed LIFESIGNS_BRIDGE_V2', true);
  assert.equal(existsSync(join(f.repo, 'local-data')), false);
  assert.equal(running.output().includes('Docking '), false);
  await appendFile(f.log, v1 + v2());
  await running.waitFor('Docking persisted:');
  const row = JSON.parse(running.output().split('Docking persisted: ')[1].split(/\r?\n/)[0]);
  // Separate read-only connection sees exactly the acknowledged committed row.
  assert.deepEqual(read(f.filename()).rows, [row]);
  await appendFile(f.log, v2().replace('session=' + key + '|', '') + v1);
  await running.waitFor('canonical s1', true);
  await delay(350);
  await running.stop();
  assert.equal((running.output().match(/Docking persisted:/g) || []).length, 1);
  assert.equal(running.output().includes('Docking acknowledged:'), false);
  assert.equal(read(f.filename()).rows.length, 1);
  assert.equal(existsSync(join(f.directory, 'local-data')), false);
});

test('separate Node processes reuse the same owner and route later keys separately', async (t) => {
  const f = await fixture(t);
  const first = await writer(f);
  await appendFile(f.log, v1 + v2());
  await first.waitFor('Docking persisted:');
  await first.stop();
  const original = read(f.filename());
  const second = await writer(f);
  await appendFile(f.log, v2());
  await second.waitFor('Docking persisted:');
  await second.stop();
  const two = read(f.filename());
  assert.equal(two.rows.length, 2);
  assert.deepEqual(two.rows[0], original.rows[0]);
  const priorBytes = await readFile(f.filename());
  // No lifecycle callback in any of these synthetic inputs; docking owns routing.
  const thirdProcess = await writer(f);
  await appendFile(f.log, v2(other) + v2(third));
  await thirdProcess.waitFor('Docking persisted:');
  const end = Date.now() + 5000;
  while ((thirdProcess.output().match(/Docking persisted:/g) || []).length < 2) {
    if (Date.now() > end) throw new Error('Missing switched-session acknowledgement');
    await delay(20);
  }
  await thirdProcess.stop();
  assert.equal(read(f.filename(other)).rows.length, 1);
  assert.equal(read(f.filename(third)).rows.length, 1);
  assert.deepEqual(await readFile(f.filename()), priorBytes);
  assert.deepEqual((await readdir(join(f.repo, 'local-data/sessions'))).sort(),
    [key, other, third].map(x => x + '.db').sort());
});

for (const mode of ['console', 'manual']) {
  test(`${mode} CLI consumes V1 only from paired records`, async (t) => {
    const f = await fixture(t);
    const db = join(f.directory, 'manual.db');
    const running = await writer(f, { args: mode === 'manual' ? ['--db', db] : [] });
    await appendFile(f.log, v1 + v2() + v2('bad'));
    await running.waitFor(mode === 'manual' ? 'Docking persisted:' : 'Docking acknowledged:');
    await running.stop();
    assert.equal((running.output().match(/Docking (persisted|acknowledged):/g) || []).length, 1);
    assert.equal(running.errors().includes('Malformed'), false);
    assert.equal(existsSync(join(f.repo, 'local-data')), false);
    if (mode === 'manual') {
      assert.equal(read(db).rows.length, 1);
      assert.equal(read(db).ownership, undefined);
    }
  });
}

test('CLI --db/--auto-db conflict fails without creating either storage location', async (t) => {
  const f = await fixture(t);
  const db = join(f.directory, 'manual.db');
  const result = spawnSync(process.execPath, [f.script, '--log', f.log, '--db', db, '--auto-db'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mutually exclusive/);
  assert.equal(result.stdout, '');
  assert.equal(existsSync(db), false);
  assert.equal(existsSync(join(f.repo, 'local-data')), false);
});

for (const kind of ['empty', 'v1', 'corrupt', 'owner', 'directory', 'lock']) {
  test(`auto CLI ${kind} failure exits nonzero without a persisted acknowledgement`, async (t) => {
    const f = await fixture(t);
    await mkdir(join(f.repo, 'local-data/sessions'), { recursive: true });
    let locker;
    if (kind === 'directory') await mkdir(f.filename());
    else if (kind === 'v1') openEventStore(f.filename()).close();
    else if (kind === 'owner' || kind === 'lock') {
      seed(f);
      locker = new DatabaseSync(f.filename());
      if (kind === 'owner') {
        locker.prepare('UPDATE session_metadata SET session_key=?').run(other);
        locker.close(); locker = undefined;
      } else locker.exec('BEGIN IMMEDIATE');
    } else await writeFile(f.filename(), kind === 'corrupt' ? 'broken sqlite' : '');
    const before = kind === 'directory' ? undefined : await readFile(f.filename());
    try {
      const running = await writer(f);
      await appendFile(f.log, v2());
      assert.equal(await running.exit(), 1);
      assert.equal(running.output().includes('Docking persisted:'), false);
      assert.match(running.errors(), /Bridge error:/);
      assert.equal(running.errors().includes('Bridge warning:'), false);
      if (before) assert.deepEqual(await readFile(f.filename()), before);
    } finally {
      if (locker) { locker.exec('ROLLBACK'); locker.close(); }
    }
  });
}

for (const failure of ['write', 'commit', 'readback', 'open']) {
  test(`injected SQLite ${failure} failure cannot acknowledge persistence`, async (t) => {
    const f = await fixture(t);
    seed(f);
    const prelude = `
      const { DatabaseSync } = await import('node:sqlite');
      const probe = new DatabaseSync(':memory:');
      const stmtProto = Object.getPrototypeOf(probe.prepare('SELECT 1'));
      probe.close();
      const oldGet = stmtProto.get;
      const oldRun = stmtProto.run;
      const oldExec = DatabaseSync.prototype.exec;
      let commits = 0;
      stmtProto.get = function(...args) {
        if (${JSON.stringify(failure)} === 'readback' && this.sourceSQL === 'SELECT * FROM docking_events WHERE event_id = ?')
          throw new Error('injected readback failure');
        return oldGet.apply(this, args);
      };
      stmtProto.run = function(...args) {
        if (${JSON.stringify(failure)} === 'write' && this.sourceSQL.startsWith('INSERT INTO docking_events'))
          throw new Error('injected write failure');
        return oldRun.apply(this, args);
      };
      DatabaseSync.prototype.exec = function(sql) {
        if (${JSON.stringify(failure)} === 'open' && sql === 'BEGIN IMMEDIATE') throw new Error('injected open failure');
        if (sql === 'COMMIT' && ++commits === 2 && ${JSON.stringify(failure)} === 'commit') throw new Error('injected commit failure');
        return oldExec.call(this, sql);
      };`;
    const running = await writer(f, { prelude });
    await appendFile(f.log, v2());
    assert.equal(await running.exit(), 1);
    assert.equal(running.output().includes('Docking persisted:'), false);
    assert.match(running.errors(), new RegExp('injected ' + failure + ' failure'));
    assert.equal(read(f.filename()).rows.length, failure === 'readback' ? 2 : 1);
  });
}

test('auto log replacement retains the existing replay behaviour, not deduplication', async (t) => {
  const f = await fixture(t);
  const running = await writer(f);
  await appendFile(f.log, v2());
  await running.waitFor('Docking persisted:');
  await writeFile(f.log, v2() + v2());
  await running.waitFor('truncated/rewritten', true);
  await delay(350);
  await running.stop();
  assert.equal(read(f.filename()).rows.length, 3);
});
