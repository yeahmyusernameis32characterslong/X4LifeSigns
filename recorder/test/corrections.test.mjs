import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generateRecorder } from '../md-generator.mjs';
import { parseRecord } from '../log-format.mjs';
import { harness } from './md-harness.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const ship = (ref = '{fixture}') => ({ __type: 'component', ref, exists: true, class: 'ship', idcode: 'FIXTURE', knownname: 'Invented fixture', owner: 'player', trueowner: 'player', sector: null, container: null, isplayerowned: true, people: { list: [] }, roleentities: [] });
const create = (env = {}, overrides = {}) => { const h = harness(generateRecorder({ ...config, ...overrides }), env); h.cue('Runtime'); return h; };
const rows = h => h.output.map(x => ({ name: x.name, ...parseRecord(x.line) }));

test('pseudo-aware harness rejects the former intermediate assignment and preserves terminal false/zero/null', () => {
  const a = ship(), template = { __type: 'npctemplate', text: 'invented-template' };
  a.people = new Map([['list', [template]], [template, { exists: true, seed: 0, role: null, isintransit: false, istransferscheduled: false, istemporary: false }]]);
  const source = generateRecorder(config);
  const regression = source.replace('exact="$People.{$Index}" />', 'exact="$Asset.people.{$People.{$Index}}" />');
  assert.notEqual(regression, source);
  const old = harness(regression); old.cue('Runtime');
  assert.throws(() => old.call('Asset', { Asset: a, Seq: 1, Trigger: 'EVENT' }), /Cannot store contextual pseudo-type/);
  const h = create(); h.call('Asset', { Asset: a, Seq: 1, Trigger: 'EVENT' });
  const r = rows(h), field = suffix => r.find(x => x.fields.field === 'asset.people.1.' + suffix)?.fields;
  assert.equal(field('seed').value, '0'); assert.equal(field('role').state, 'NULL');
  assert.equal(field('isintransit').value, 'false');
  assert.equal(r.at(-1).fields.partial, 'false');
  delete a.people.get(template).seed;
  h.call('Asset', { Asset: a, Seq: 2, Trigger: 'EVENT' });
  assert.equal(rows(h).find(x => x.seq === '2' && x.fields.field === 'asset.people.1.seed').fields.state, 'UNAVAILABLE');
  assert.equal(rows(h).at(-1).fields.partial, 'true');
  a.people.get(template).exists = false;
  h.call('Asset', { Asset: a, Seq: 3, Trigger: 'EVENT' });
  assert.equal(rows(h).find(x => x.seq === '3' && x.fields.field === 'asset.people.1.entry').fields.state, 'UNAVAILABLE');
  assert.equal(rows(h).at(-1).fields.partial, 'true');
});

test('two-million default has one additional stop marker and an independent coupled diagnostic allowance', () => {
  assert.equal(config.maxRowsPerRun, 2000000);
  const h = create(); h.md.$LSERWrites = config.maxRowsPerRun - 1;
  h.call('Write', { Body: 'FIXTURE', Seq: 1 });
  assert.equal(h.md.$LSERWrites, 2000000); assert.equal(h.md.$LSERStopped, false);
  h.call('Write', { Body: 'OVERFLOW', Seq: 1 });
  h.call('Write', { Body: 'SUPPRESSED', Seq: 1 });
  assert.equal(h.md.$LSERWrites, 2000001); assert.equal(h.md.$LSERStopped, true);
  assert.equal(rows(h).filter(x => x.kind === 'LIMIT').length, 1);
  assert.equal(rows(h).some(x => x.kind === 'overflow'), false);
  h.md.$LSERDiagnosticWrites = config.maxRowsPerRun - 1;
  h.call('Write', { Body: 'HEALTH', Seq: 1, Diagnostic: true, Level: 3 });
  h.call('Write', { Body: 'HEALTH', Seq: 1, Diagnostic: true, Level: 3 });
  assert.equal(h.md.$LSERDiagnosticWrites, 2000000);
});
