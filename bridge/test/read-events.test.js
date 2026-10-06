import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, appendFile, readFile, rename, unlink, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createTail, parseArgs, parseRecord } from '../src/read-events.js';

const record = (ship = 'ABC-123') => `LIFESIGNS_BRIDGE_V1|docked|ship=${ship}|destination=DEF-456|END`;
const expected = (ship = 'ABC-123') => ({ ship, destination: 'DEF-456' });
const root = fileURLToPath(new URL('../../', import.meta.url));

async function fixture(t, initial = '') {
  const directory = await mkdtemp(join(tmpdir(), 'lifesigns-bridge-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const log = join(directory, 'debuglog.txt');
  await writeFile(log, initial);
  const records = [];
  const warnings = [];
  const tail = await createTail(log, {
    onRecord: (value) => records.push(value),
    onWarning: (value) => warnings.push(value)
  });
  return { directory, log, records, warnings, tail };
}

test('parses X4-prefixed records and ignores unrelated lines', () => {
  assert.deepEqual(parseRecord(`[General] 12.3 ${record()}\r`), expected());
  assert.equal(parseRecord('ordinary docking chatter'), null);
  assert.equal(parseRecord('LIFESIGNS_SESSION_DIAG_V1|docked|seq=1|token=UNSET|ship=ABC-123|destination=DEF-456|END'), null);
});

test('rejects malformed marked records and extra fields', () => {
  for (const value of [record().replace('ABC-123', ''), record().replace('docked', 'docking'),
    record().replace('DEF-456', 'station name'), record() + '|extra', 'LIFESIGNS_BRIDGE_V1']) {
    assert.throws(() => parseRecord(value), /Malformed/);
  }
});

test('requires an explicit log path and rejects unknown arguments', () => {
  assert.deepEqual(parseArgs(['--log', 'example.txt']), { logPath: resolve('example.txt'), dbPath: undefined });
  assert.deepEqual(parseArgs(['--db', 'events.db', '--log', 'example.txt']),
    { logPath: resolve('example.txt'), dbPath: resolve('events.db') });
  for (const args of [[], ['--log'], ['--log', ''], ['--log', '--other'],
    ['--other', 'x'], ['--log', 'x', '--extra'], ['--log', 'x', '--db'],
    ['--log', 'x', '--log', 'y'], ['--db', 'x']]) assert.throws(() => parseArgs(args), /Usage/);
});

test('onRecord errors propagate instead of being reported as malformed records', async (t) => {
  const f = await fixture(t);
  const warnings = [];
  const tail = await createTail(f.log, {
    onRecord: () => { throw new Error('storage failed'); },
    onWarning: (message) => warnings.push(message)
  });
  await appendFile(f.log, record() + '\n');
  await assert.rejects(tail.poll(), /storage failed/);
  assert.deepEqual(warnings, []);
});

test('starts at EOF and never replays old complete records', async (t) => {
  const f = await fixture(t, record() + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, []);
  await appendFile(f.log, record('GHI-789') + '\n');
  await f.tail.poll();
  await f.tail.poll();
  assert.deepEqual(f.records, [expected('GHI-789')]);
});

test('discards the remainder of a pre-existing partial line', async (t) => {
  const f = await fixture(t, record().slice(0, 20));
  await appendFile(f.log, record().slice(20) + '\n' + record('GHI-789') + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected('GHI-789')]);
  assert.deepEqual(f.warnings, []);
});

test('buffers partial lines across polls and handles CRLF and multiple lines', async (t) => {
  const f = await fixture(t);
  await appendFile(f.log, record().slice(0, 31));
  await f.tail.poll();
  assert.deepEqual(f.records, []);
  await appendFile(f.log, record().slice(31) + '\r');
  await f.tail.poll();
  assert.deepEqual(f.records, []);
  await appendFile(f.log, '\nignored\n' + record('GHI-789') + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected(), expected('GHI-789')]);
});

test('preserves split UTF-8 prefixes until the complete line arrives', async (t) => {
  const f = await fixture(t);
  const bytes = Buffer.from('é ' + record() + '\n');
  await appendFile(f.log, bytes.subarray(0, 1));
  await f.tail.poll();
  await appendFile(f.log, bytes.subarray(1));
  await f.tail.poll();
  assert.deepEqual(f.records, [expected()]);
});

test('reports malformed marked records and continues reading', async (t) => {
  const f = await fixture(t);
  await appendFile(f.log, 'noise\nLIFESIGNS_BRIDGE_V1 broken\n' + record() + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected()]);
  assert.deepEqual(f.warnings, ['Malformed LIFESIGNS_BRIDGE_V1 record']);
});

test('does not change any bytes in the log', async (t) => {
  const f = await fixture(t, 'old\n');
  await appendFile(f.log, record() + '\n');
  const before = await readFile(f.log);
  await f.tail.poll();
  assert.deepEqual(await readFile(f.log), before);
});

test('recovers from truncation and discards the old partial record', async (t) => {
  const f = await fixture(t, 'old'.repeat(100) + '\n');
  await appendFile(f.log, record().slice(0, 30));
  await f.tail.poll();
  await writeFile(f.log, record('GHI-789') + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected('GHI-789')]);
  assert.match(f.warnings[0], /truncated\/rewritten/);
});

test('detects truncate-and-regrow even beyond the previous offset', async (t) => {
  const f = await fixture(t, 'old\n');
  await writeFile(f.log, 'replacement\n' + record() + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected()]);
  assert.match(f.warnings[0], /truncated\/rewritten/);
});

test('detects replacement and reads the new file from byte zero', async (t) => {
  const f = await fixture(t, 'old\n');
  await rename(f.log, join(f.directory, 'previous.txt'));
  await writeFile(f.log, record() + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected()]);
  assert.match(f.warnings[0], /replaced\/reappeared/);
});

test('waits through disappearance and recovers without repeated warnings', async (t) => {
  const f = await fixture(t);
  await unlink(f.log);
  await f.tail.poll();
  await f.tail.poll();
  assert.equal(f.warnings.length, 1);
  await writeFile(f.log, record() + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected()]);
  assert.match(f.warnings[1], /replaced\/reappeared/);
});

test('rejects a missing initial file clearly', async (t) => {
  const f = await fixture(t);
  await assert.rejects(createTail(join(f.directory, 'missing.txt')), { code: 'ENOENT' });
});

test('bounds oversized partial lines and resumes at the next newline', async (t) => {
  const f = await fixture(t);
  await appendFile(f.log, 'LIFESIGNS_BRIDGE_V1' + 'x'.repeat(140000));
  await f.tail.poll();
  assert.equal(f.warnings.length, 1);
  await appendFile(f.log, '\n' + record() + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected()]);
});

test('processes complete lines across the read chunk boundary', async (t) => {
  const f = await fixture(t);
  await appendFile(f.log, ('noise\n').repeat(11000) + record() + '\n');
  await f.tail.poll();
  assert.deepEqual(f.records, [expected()]);
  assert.deepEqual(f.warnings, []);
});

test('CLI exits with a readable error when --log is omitted', () => {
  const result = spawnSync(process.execPath, [join(root, 'bridge/src/read-events.js')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:.*--log/);
});

test('running reader process acknowledges a newly appended synthetic event', async (t) => {
  const f = await fixture(t, record('GHI-789') + '\n');
  const child = spawn(process.execPath, [join(root, 'bridge/src/read-events.js'), '--log', f.log]);
  const exit = new Promise((done) => child.once('exit', done));
  t.after(async () => { child.kill(); await exit; });
  let output = '';
  let errors = '';
  let appended = false;
  child.stderr.on('data', (data) => { errors += data; });
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Reader timeout: ${output} ${errors}`)), 5000);
    const finish = (error) => { clearTimeout(timeout); error ? reject(error) : done(); };
    child.once('error', finish);
    child.once('exit', (code) => finish(new Error(`Reader exited early (${code}): ${errors}`)));
    child.stdout.on('data', (data) => {
      output += data;
      if (!appended && output.includes('Watching from current end:')) {
        appended = true;
        appendFile(f.log, record() + '\n').catch(finish);
      }
      if (output.includes('Docking acknowledged: ship ABC-123 -> destination DEF-456')) finish();
    });
  });
  assert.equal(output.includes('ship GHI-789'), false);
  assert.equal(errors, '');
});

test('deployment copies only the probe, supports redeploy and rejects unrelated content',
  { skip: process.platform !== 'win32' }, async (t) => {
    const f = await fixture(t);
    const game = join(f.directory, 'game');
    await mkdir(game);
    await writeFile(join(game, 'X4.exe'), 'test placeholder');
    const deploy = (...extra) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', join(root, 'scripts/deploy-bridge-probe.ps1'), '-GamePath', game, ...extra], { encoding: 'utf8' });
    const target = join(game, 'extensions/lifesigns_bridge_probe');
    assert.equal(deploy('-WhatIf').status, 0);
    await assert.rejects(readFile(join(target, 'content.xml')), { code: 'ENOENT' });
    for (let i = 0; i < 2; i++) {
      const result = deploy();
      assert.equal(result.status, 0, result.stderr);
    }
    for (const relative of ['content.xml', 'md/LifeSigns_BridgeProbe.xml']) {
      assert.deepEqual(await readFile(join(target, relative)), await readFile(join(root, 'extension', relative)));
    }
    await writeFile(join(target, 'content.xml'), '<content id="unrelated" />');
    const rejected = deploy();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /unrelated extension/);
    assert.equal(await readFile(join(target, 'content.xml'), 'utf8'), '<content id="unrelated" />');
    await writeFile(join(target, 'content.xml'), await readFile(join(root, 'extension/content.xml')));
    await writeFile(join(target, 'unrelated.txt'), 'preserve me');
    const unknown = deploy();
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /Unexpected existing probe content/);
    assert.equal(await readFile(join(target, 'unrelated.txt'), 'utf8'), 'preserve me');
    await unlink(join(target, 'unrelated.txt'));
    await rename(join(target, 'md'), join(f.directory, 'original-md'));
    const outside = join(f.directory, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'LifeSigns_BridgeProbe.xml'), 'must not overwrite');
    await symlink(outside, join(target, 'md'), 'junction');
    const linked = deploy();
    assert.notEqual(linked.status, 0);
    assert.match(linked.stderr, /Refusing linked deployment path/);
    assert.equal(await readFile(join(outside, 'LifeSigns_BridgeProbe.xml'), 'utf8'), 'must not overwrite');
  });

test('session diagnostic deployment is opt-in and explicitly reversible',
  { skip: process.platform !== 'win32' }, async (t) => {
    const f = await fixture(t);
    const game = join(f.directory, 'game');
    await mkdir(game);
    await writeFile(join(game, 'X4.exe'), 'test placeholder');
    const deploy = (...extra) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', join(root, 'scripts/deploy-bridge-probe.ps1'), '-GamePath', game, ...extra], { encoding: 'utf8' });
    const target = join(game, 'extensions/lifesigns_bridge_probe');
    const diagnostic = join(target, 'md/LifeSigns_SessionDiagnostic.xml');
    const unrelated = join(game, 'extensions/another_extension');
    await mkdir(unrelated, { recursive: true });
    await writeFile(join(unrelated, 'keep.txt'), 'untouched');
    assert.equal(deploy().status, 0);
    const original = await readFile(join(target, 'md/LifeSigns_BridgeProbe.xml'));
    await assert.rejects(readFile(diagnostic), { code: 'ENOENT' });
    assert.equal(deploy('-SessionDiagnostic', '-WhatIf').status, 0);
    await assert.rejects(readFile(diagnostic), { code: 'ENOENT' });
    for (let i = 0; i < 2; i++) {
      const result = deploy('-SessionDiagnostic');
      assert.equal(result.status, 0, result.stderr);
    }
    assert.deepEqual(await readFile(diagnostic), await readFile(join(root, 'extension/md/LifeSigns_SessionDiagnostic.xml')));
    const refusal = deploy();
    assert.notEqual(refusal.status, 0);
    assert.match(refusal.stderr, /Explicitly choose/);
    assert.notEqual(deploy('-SessionDiagnostic', '-RemoveSessionDiagnostic').status, 0);
    assert.equal(deploy('-RemoveSessionDiagnostic', '-WhatIf').status, 0);
    assert.ok((await readFile(diagnostic)).length > 0);
    const removal = deploy('-RemoveSessionDiagnostic');
    assert.equal(removal.status, 0, removal.stderr);
    await assert.rejects(readFile(diagnostic), { code: 'ENOENT' });
    assert.deepEqual(await readFile(join(target, 'md/LifeSigns_BridgeProbe.xml')), original);
    assert.equal(deploy().status, 0);
    assert.equal(deploy('-RemoveSessionDiagnostic').status, 0);
    assert.equal(await readFile(join(unrelated, 'keep.txt'), 'utf8'), 'untouched');
  });
