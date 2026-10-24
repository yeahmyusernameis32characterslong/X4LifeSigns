import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { inspectLog } from '../check-log.mjs';

const row = (seq, kind, tail = '') => `LSEV1|run=synthetic|session=UNAVAILABLE|seq=${seq}|age=1|${kind}${tail}|END\n`;
test('offline checker reads interleaved batches without modifying the original', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lifesigns-recorder-')); t.after(() => rm(dir, { recursive: true }));
  const file = join(dir, 'events.log');
  const source = (row(0, 'RUN_BEGIN') + row(1, 'SNAPSHOT_BEGIN') + row(2, 'EVENT_BEGIN', '|event=synthetic') + row(2, 'VALUE', `|field=name|value=${'船'.repeat(24000)}%7Ctest`) + row(2, 'EVENT_END') + row(1, 'SNAPSHOT_END')).replaceAll('\n', '\r\n');
  await writeFile(file, source);
  const r = await inspectLog(file, { expectedRun: 'synthetic' });
  assert.equal(r.readiness, 'EXPECTED_RUN_OBSERVED'); assert.equal(r.incompleteBatches, 0);
  assert.equal(r.validRows, 6); assert.equal(r.sha256, createHash('sha256').update(source).digest('hex'));
  assert.equal(await readFile(file, 'utf8'), source);
  assert.equal((await inspectLog(file)).readiness, 'HISTORICAL_OUTPUT_ONLY');
  assert.equal((await inspectLog(file, { expectedRun: 'another' })).readiness, 'EXPECTED_RUN_NOT_FOUND');
});
test('missing output, truncated batches and oversized rows remain explicit', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lifesigns-recorder-')); t.after(() => rm(dir, { recursive: true }));
  assert.equal((await inspectLog(join(dir, 'missing'))).readiness, 'NO_FILE');
  const file = join(dir, 'events.log');
  await writeFile(file, row(0, 'RUN_BEGIN') + row(1, 'EVENT_BEGIN') + 'x'.repeat(200) + '\ntruncated');
  const r = await inspectLog(file, { maxLineBytes: 128 });
  assert.equal(r.oversizedRows, 1); assert.equal(r.malformedRows, 1); assert.equal(r.incompleteBatches, 1);
  assert.equal(r.writeConfirmation, 'UNAVAILABLE'); assert.equal(r.launchFlag, 'UNAVAILABLE');
});

test('explicit lifecycle interruption remains incomplete and is counted only once', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lifesigns-recorder-')); t.after(() => rm(dir, { recursive: true }));
  const file = join(dir, 'events.log');
  await writeFile(file, row(0, 'RUN_BEGIN') + row(1, 'SNAPSHOT_BEGIN') + row(1, 'SNAPSHOT_INTERRUPTED', '|provenance=ACTIVE_OR_RESTORED_UNKNOWN'));
  const result = await inspectLog(file);
  assert.equal(result.interruptedBatches, 1); assert.equal(result.incompleteBatches, 1);
});

test('profile checker tracks profile identities, pass kinds, discovery and explicit partials', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lifesigns-profiles-')); t.after(() => rm(dir, { recursive: true }));
  const file = join(dir, 'profiles.log');
  await writeFile(file, row(0, 'RUN_BEGIN') + row(1, 'SNAPSHOT_BEGIN') + row(1, 'PASS_BEGIN', '|kind=NPCS') +
    row(1, 'DISCOVERY_BEGIN') + row(1, 'DISCOVERY_LIMIT', '|reason=HOSTS') + row(1, 'DISCOVERY_END') +
    row(1, 'PROFILE_BEGIN', '|profile=1') + row(1, 'PROFILE_LIMIT', '|reason=VALUE_BUDGET') + row(1, 'PROFILE_END', '|profile=1|partial=true') +
    row(1, 'PROFILE_BEGIN', '|profile=2') + row(1, 'PROFILE_END', '|profile=2|partial=false') + row(1, 'PASS_END', '|kind=NPCS') + row(1, 'SNAPSHOT_END', '|partial=true'));
  const r = await inspectLog(file);
  assert.equal(r.incompleteBatches, 0); assert.equal(r.partialProfiles, 1); assert.equal(r.partialSnapshots, 1);
  assert.equal(r.profileLimitMarkers, 1); assert.equal(r.discoveryLimitMarkers, 1);
  await writeFile(file, row(1, 'PROFILE_BEGIN', '|profile=1') + row(1, 'PROFILE_END', '|profile=2'));
  assert.equal((await inspectLog(file)).incompleteBatches, 2);
});
