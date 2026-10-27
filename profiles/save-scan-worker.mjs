// Separate heap and an independently owned read-only descriptor. No extraction.
import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { SaxesParser } from 'saxes';
import { universeId, runId, ordinal } from './profile-schema.mjs';
import { sameSnapshot } from './inventory-path.mjs';
import { checkPath } from '../bridge/src/session-path.js';

const { file, info, gzip, maxBytes, maxRefs, maxDepth } = workerData;
let fd;
const stack = [], refs = new Map(), ids = new Set(), variables = new Map();
let script = false, identity = false, stringTable = false, scripts = 0, cues = 0, tables = 0, hasMd = false, headers = 0, version;
let bytes = 0, storedBytes = 0, raw, stream;
let refCount = 0;
const fail = code => { throw Error(code); };
const parser = new SaxesParser({ xmlns: true });
parser.on('doctype', () => fail('DTD_NOT_ALLOWED'));
parser.on('error', () => fail('MALFORMED_XML'));
parser.on('opentag', node => {
  if (node.uri) fail('UNSUPPORTED_XML_NAMESPACE');
  if (stack.length >= maxDepth) fail('RESOURCE_LIMIT');
  stack.push(node.name); const loc = stack.join('/');
  const a = Object.fromEntries(Object.entries(node.attributes).map(([k, v]) => [k, v.value]));
  if (stack.length === 1 && node.name !== 'savegame') fail('UNSUPPORTED_SAVE_LAYOUT');
  if (loc === 'savegame/info/game') { headers++; version = a.id === 'X4' ? a.version : null; }
  if (loc === 'savegame/script/refs') { stringTable = a.type === 'string'; if (stringTable) tables++; }
  if (loc === 'savegame/md') hasMd = true;
  if (loc === 'savegame/script/refs/ref') {
    if (++refCount > maxRefs) fail('RESOURCE_LIMIT');
    // Native refs reuse numbers across datatype namespaces. Only string refs
    // resolve MD type=string variables; a non-string ref is not an ambiguity.
    if (!stringTable) return;
    if (!/^(0|[1-9]\d*)$/.test(a.id || '') || ids.has(a.id)) fail('AMBIGUOUS_STRING_REFERENCE');
    ids.add(a.id); if (ids.size > maxRefs) fail('RESOURCE_LIMIT');
    if (a.string?.startsWith('lsu1-') || a.string?.startsWith('session-')) refs.set(a.id, a.string);
  }
  if (loc === 'savegame/md/script') { script = a.name === 'LifeSigns_EventRecorder'; if (script) scripts++; }
  if (script && node.name === 'cue' && a.name === 'UniverseIdentity') {
    if (loc !== 'savegame/md/script/cue') fail('UNSUPPORTED_IDENTITY_LAYOUT');
    identity = true; cues++;
  }
  if (identity && node.name === 'value' && ['$Id', '$CheckpointRun', '$CheckpointRecord'].includes(a.name)) {
    if (loc !== 'savegame/md/script/cue/vars/value' || variables.has(a.name)) fail('AMBIGUOUS_CHECKPOINT');
    variables.set(a.name, a);
  }
});
parser.on('closetag', () => {
  const loc = stack.join('/');
  if (loc === 'savegame/md/script/cue') identity = false;
  if (loc === 'savegame/md/script') script = false;
  if (loc === 'savegame/script/refs') stringTable = false;
  stack.pop();
});

try {
  if (!sameSnapshot(info, checkPath(file))) fail('INPUT_CHANGED');
  fd = fs.openSync(file, 'r');
  if (!sameSnapshot(info, fs.fstatSync(fd))) fail('INPUT_CHANGED');
  raw = fs.createReadStream(null, { fd, autoClose: false, start: 0, highWaterMark: 65536 });
  const hash = createHash('sha256'); raw.on('data', b => { storedBytes += b.length; hash.update(b); });
  stream = gzip ? raw.pipe(createGunzip()) : raw;
  if (gzip) raw.on('error', e => stream.destroy(e));
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for await (const b of stream) { bytes += b.length; if (bytes > maxBytes) fail('RESOURCE_LIMIT'); parser.write(decoder.decode(b, { stream: true })); }
  parser.write(decoder.decode()).close();
  if (!sameSnapshot(info, fs.fstatSync(fd)) || !sameSnapshot(info, checkPath(file))) fail('INPUT_CHANGED');
  const evidence = { sha256: hash.digest('hex'), storedBytes, decodedBytes: bytes, container: gzip ? 'gzip' : 'xml', layout: 'X4_900_MD_REFS_V1' };
  if (headers !== 1 || version !== '900' || !hasMd || tables !== 1) fail('UNSUPPORTED_SAVE_LAYOUT');
  if (scripts > 1 || cues > 1) fail('AMBIGUOUS_IDENTITY_CUE');
  if (!cues) {
    if ([...refs.values()].some(v => v.startsWith('lsu1-'))) fail('UNRECOGNISED_IDENTITY_LAYOUT');
    parentPort.postMessage({ ...evidence, status: 'NO_LIFESIGNS_STATE' });
  } else {
    const id = variables.get('$Id'), run = variables.get('$CheckpointRun'), record = variables.get('$CheckpointRecord');
    const universe = id?.type === 'string' ? refs.get(id.value) : null;
    let hint; try { hint = universeId(universe); } catch { /* Unknown identity affects the entire scope. */ }
    try {
      if (!id || !run || !record) fail('MISSING_CHECKPOINT');
      if (id.type !== 'string' || run.type !== 'string' || record.type !== 'largefloat') fail('UNSUPPORTED_CHECKPOINT_TYPE');
      const root = { universe: universeId(universe), run: runId(refs.get(run.value)), record: ordinal(record.value) };
      if (!root.record) fail('UNINITIALISED_CHECKPOINT');
      parentPort.postMessage({ ...evidence, status: 'CHECKPOINT', root });
    } catch (e) { parentPort.postMessage({ ...evidence, status: 'UNKNOWN', code: /^[A-Z_]+$/.test(e.message) ? e.message : 'INVALID_CHECKPOINT', universe: hint }); }
  }
} catch (e) {
  parentPort.postMessage({ status: 'UNKNOWN', code: /^[A-Z_]+$/.test(e.message) ? e.message : e.code?.startsWith('Z_') ? 'INVALID_GZIP' : 'INVALID_SAVE_STREAM' });
} finally {
  stream?.destroy(); raw?.destroy();
  if (fd !== undefined && !raw) fs.closeSync(fd);
}
