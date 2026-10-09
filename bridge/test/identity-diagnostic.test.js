import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../extension/md/LifeSigns_IdentityDiagnostic.xml', import.meta.url), 'utf8');
const labels = ['LSID-XF', 'LSID-COL', 'LSID-BEH1', 'LSID-BEH2', 'LSID-BEH3', 'LSID-BEH4'];

// Deliberately limited action harness, NOT an X4 runtime or schema validator.
// Executes the actual diagnostic XML against fake components. In particular,
// MD table string keys must start with '$' (Egosoft MD guide, Tables section).
// Unknown actions/expressions fail tests; runtime write faults can be injected.
function parse(xml) {
  const root = { children: [] }, stack = [root];
  for (const token of xml.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([^>]+)>/g)) {
    const tag = token[1];
    if (tag.startsWith('?')) continue;
    if (tag.startsWith('/')) { stack.pop(); continue; }
    const node = { tag: tag.match(/^\w+/)[0], attrs: {}, children: [] };
    for (const [, key, value] of tag.matchAll(/(\w+)="([^"]*)"/g)) node.attrs[key] = value;
    stack.at(-1).children.push(node);
    if (!tag.endsWith('/')) stack.push(node);
  }
  return root;
}
function split(text, delimiter) {
  let quote = false, depth = 0, start = 0;
  const parts = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "'") quote = !quote;
    if (quote) continue;
    if ('[{('.includes(char)) depth++;
    if (']})'.includes(char)) depth--;
    if (!depth && text.startsWith(delimiter, i)) {
      parts.push(text.slice(start, i)); start = i + delimiter.length; i = start - 1;
    }
  }
  return [...parts, text.slice(start)];
}
function harness(xml = source, dropWrite = () => false) {
  const tree = parse(xml), md = {}, local = {};
  let ships = [], searches = 0;
  const output = [], errors = [];
  function get(object, key) {
    if (key === 'exists' && object == null) return false;
    if (object == null) throw new Error(`Missing object for ${key}`);
    return object instanceof Map ? object.get(key) : object[key];
  }
  function evaluate(text) {
    text = text.trim();
    for (const op of [' and ', ' != ', ' == ', ' + ']) {
      const parts = split(text, op);
      if (parts.length > 1) {
        if (op === ' and ') return parts.every(x => Boolean(evaluate(x)));
        const a = evaluate(parts[0]), b = evaluate(parts.slice(1).join(op));
        if (op === ' != ') return a !== b;
        if (op === ' == ') return a === b;
        return a + b;
      }
    }
    if (text.startsWith('not ')) return !evaluate(text.slice(4));
    if (text === 'true' || text === 'false') return text === 'true';
    if (/^\d+$/.test(text)) return Number(text);
    if (text === 'table[]') return new Map();
    if (text.startsWith('[')) return split(text.slice(1, -1), ',').map(evaluate);
    if (/^'[^']*'$/.test(text)) return text.slice(1, -1);
    const format = text.match(/^'([^']*)'\.\[([\s\S]*)\]$/);
    if (format) {
      const args = split(format[2], ',').map(evaluate);
      return format[1].replace(/%s/g, () => { const x = args.shift(); return typeof x === 'boolean' ? Number(x) : x; });
    }
    const exists = text.endsWith('?');
    if (exists) text = text.slice(0, -1);
    const parts = split(text, '.');
    assert.match(parts[0], /^(md|\$\w+)$/, `Unsupported expression: ${text}`);
    let value = parts[0] === 'md' ? md : local[parts[0]];
    for (const part of parts.slice(1)) {
      if (exists && value == null) return false;
      value = get(value, part.startsWith('{') ? evaluate(part.slice(1, -1)) : part);
    }
    if (exists) return value !== undefined;
    if (value === undefined) throw new Error(`Missing value: ${text}`);
    return value;
  }
  function assign(path, value) {
    if (dropWrite(path)) return;
    const parts = split(path, '.');
    let object = parts[0] === 'md' ? md : local;
    const keys = parts[0] === 'md' ? parts.slice(1) : parts;
    for (const part of keys.slice(0, -1)) object = get(object, part.startsWith('{') ? evaluate(part.slice(1, -1)) : part);
    const last = keys.at(-1), key = last.startsWith('{') ? evaluate(last.slice(1, -1)) : last;
    if (object instanceof Map) {
      if (typeof key === 'string' && !key.startsWith('$')) throw new Error('MD string table key must begin with $');
      object.set(key, value);
    } else object[key] = value;
  }
  function run(nodes) {
    let matched = false;
    for (const node of nodes) {
      const a = node.attrs;
      switch (node.tag) {
        case 'do_if': matched = Boolean(evaluate(a.value)); if (matched) run(node.children); break;
        case 'do_elseif': if (!matched && evaluate(a.value)) { matched = true; run(node.children); } break;
        case 'do_else': if (!matched) run(node.children); break;
        case 'do_for_each': for (const item of evaluate(a.in)) { assign(a.name, item); run(node.children); } break;
        case 'set_value': try { assign(a.name, evaluate(a.exact)); } catch (error) { errors.push(error.message); } break;
        case 'find_ship': searches++; assign(a.name, ships); break;
        case 'debug_text': output.push(evaluate(a.text)); break;
        default: assert.fail(`Unsupported action ${node.tag}`);
      }
    }
  }
  function cue(name, node = tree) {
    if (node.tag === 'cue' && node.attrs.name === name) return node;
    for (const child of node.children) { const found = cue(name, child); if (found) return found; }
  }
  const actions = name => cue(name).children.find(x => x.tag === 'actions').children;
  run(actions('InitialiseIdentityFixture'));
  md.$LifeSignsProductionSessionReady = true;
  md.$LifeSignsProductionSessionKey = 'TEST_SESSION';
  return { md, errors, output, get searches() { return searches; }, dock(nextShips) {
    ships = nextShips;
    for (const key of Object.keys(local)) delete local[key]; // fresh cue instance
    const start = output.length;
    run(actions('IdentityPersonallyControlledDocked'));
    return output.slice(start);
  } };
}
function fixture() {
  return labels.map((name, i) => ({ name, idcode: `ABC-${100 + i}`, exists: true, isoperational: true,
    isclass: { ship: true, ship_s: i === 0, ship_m: false, ship_l: i > 1, ship_xl: i === 1 }, commander: null }));
}

test('actual XML enrolment retains all six references and original codes before reporting success', () => {
  const h = harness(), ships = fixture(), rows = h.dock(ships);
  assert.match(rows[0], /\|enrolment\|.*\|complete=1\|END$/);
  assert.equal(rows.length, 7);
  for (const [i, label] of labels.entries()) {
    assert.equal(h.md.$LifeSignsIdentityDiagRefs.get('$' + label), ships[i]);
    assert.equal(h.md.$LifeSignsIdentityDiagOriginals.get('$' + label), ships[i].idcode);
    assert.match(rows[i + 1], /\|reference=valid\|original=ABC-\d{3}\|current=ABC-\d{3}\|/);
  }
  assert.deepEqual(h.errors, []);
});
for (const count of [0, 1, 5]) test(`actual XML rejects ${count}/6 matches and never retries on a later docking`, () => {
  const h = harness(), first = h.dock(fixture().slice(0, count));
  assert.match(first[0], /\|complete=0\|END$/);
  assert.equal(first.filter(x => x.includes('|reference=missing|')).length, 6);
  const second = h.dock(fixture());
  assert.equal(h.searches, 1);
  assert.equal(second.length, 6);
  assert.ok(second.every(x => x.includes('|reference=missing|')));
  assert.equal(h.md.$LifeSignsIdentityDiagAttempted, true);
  assert.deepEqual(h.errors, []);
});
test('duplicate label, missing idcode, empty idcode and invalid component each prevent completion', () => {
  const cases = [s => s.push({ ...s[0] }), s => delete s[0].idcode, s => s[0].idcode = '', s => s[0].exists = false];
  for (const mutate of cases) {
    const h = harness(), ships = fixture(); mutate(ships);
    assert.match(h.dock(ships)[0], /\|complete=0\|END$/);
    assert.equal(h.md.$LifeSignsIdentityDiagEnrolled, false);
    assert.deepEqual(h.errors, []);
  }
});
test('lost retained-reference or original-code writes cannot report complete', () => {
  for (const table of ['Refs', 'Originals']) for (const dropAll of [false, true]) {
    let writes = 0;
    const h = harness(source, path => path.startsWith(`md.$LifeSignsIdentityDiag${table}.`) && (++writes === 1 || dropAll));
    assert.match(h.dock(fixture())[0], /\|complete=0\|END$/);
    assert.equal(h.md.$LifeSignsIdentityDiagEnrolled, false);
    h.dock(fixture());
    assert.equal(h.searches, 1);
  }
});
test('regression mutation to unprefixed MD table keys cannot report complete', () => {
  const h = harness(source.replaceAll("{'$' + $Label}", '{$Label}').replaceAll("{'$' + $OtherLabel}", '{$OtherLabel}'));
  assert.match(h.dock(fixture())[0], /\|complete=0\|END$/);
  assert.ok(h.errors.some(x => x.includes('table key')));
});
test('later snapshots use retained references despite rename and empty enumeration input', () => {
  const h = harness(), ships = fixture(); h.dock(ships);
  ships[2].name = 'renamed'; ships[2].commander = ships[1];
  const rows = h.dock([]);
  assert.equal(h.searches, 1);
  assert.equal(rows.length, 6);
  assert.ok(rows.every(x => x.includes('|reference=valid|')));
  assert.match(rows[2], /\|commander_fixture=LSID-COL\|END$/);
  assert.deepEqual(h.errors, []);
});
