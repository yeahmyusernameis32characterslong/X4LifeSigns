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
