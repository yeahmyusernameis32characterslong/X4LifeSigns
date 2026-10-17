// Limited interpreter of the generated MD actions against synthetic values.
// It cannot reproduce engine scheduling, reference lifetimes or disk semantics.
export function parseXml(source) {
  const root = { tag: 'root', attrs: {}, children: [] }, stack = [root];
  const decode = s => s.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  for (const [, text] of source.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([^>]+)>/g)) {
    if (text.startsWith('?')) continue;
    if (text.startsWith('/')) { stack.pop(); continue; }
    const node = { tag: text.match(/^\w+/)[0], attrs: {}, children: [] };
    for (const [, key, value] of text.matchAll(/(\w+)="([^"]*)"/g)) node.attrs[key] = decode(value);
    stack.at(-1).children.push(node);
    if (!text.endsWith('/')) stack.push(node);
  }
  if (stack.length !== 1) throw new Error('Unbalanced XML');
  return root;
}
function split(s, delimiter) {
  const out = []; let quote = false, depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && quote) { i++; continue; }
    if (s[i] === "'") quote = !quote;
    if (quote) continue;
    if ('[{('.includes(s[i])) depth++;
    if (']})'.includes(s[i])) depth--;
    if (!depth && s.startsWith(delimiter, i)) { out.push(s.slice(start, i)); start = i + delimiter.length; i += delimiter.length - 1; }
  }
  return [...out, s.slice(start)];
}
const dtype = value => value == null ? 'null' : Array.isArray(value) ? 'list' : value instanceof Map ? 'table' : value.__type || (typeof value === 'number' || typeof value === 'boolean' ? 'integer' : typeof value);
const show = value => value == null ? 'null' : value.__type === 'datatype' ? `datatype.${value.name}` : value.ref ?? value.text ?? String(value);
const equal = (a, b) => a?.__type === 'datatype' && b?.__type === 'datatype' ? a.name === b.name : a === b;
export function harness(source, { ships = [], stations = [], age = 1 } = {}) {
  const tree = parseXml(source), md = {}, output = [], libraries = new Map(), cues = new Map();
  function walk(node) { if (node.tag === 'library') libraries.set(node.attrs.name, node); if (node.tag === 'cue') cues.set(node.attrs.name, node); node.children.forEach(walk); }
  walk(tree);
  const player = { age, entity: { __type: 'component', exists: true }, galaxy: true, systemtime: { '%Y-%m-%d_%H-%M-%S': '2000-01-01_00-00-00' } };
  function get(value, key) {
    if (value == null && key === 'exists') return false;
    if (value == null) throw new Error(`Unavailable ${key}`);
    if (Object.hasOwn(value, '__indexOf')) return value.__indexOf.indexOf(key) + 1;
    if (value instanceof Map) {
      if (key === 'keys') return { count: value.size, list: [...value.keys()] };
      if (!value.has(key)) throw new Error(`Missing table ${key}`);
      return value.get(key);
    }
    if (Array.isArray(value)) {
      if (key === 'count') return value.length;
      if (key === 'clone') return [...value];
      if (key === 'min') return Math.min(...value);
      if (key === 'indexof') return { __indexOf: value };
      const item = value[Number(key) - 1]; if (item === undefined) throw new Error('List range'); return item;
    }
    if (value.__type === 'datatype' && key === 'isstring') return value.name === 'string';
    if (value.__type === 'datatype' && key === 'isnumeric') return value.name === 'integer';
    if (key === 'isclass') return new Proxy({}, { get: (_, klass) => value.class === klass });
    if (value[key] === undefined) throw new Error(`Missing property ${key}`);
    return value[key];
  }
  function evalx(s, local) {
    s = s.trim();
    if (s.startsWith('if ')) { const [cond, rest] = split(s.slice(3), ' then '); const [yes, no] = split(rest, ' else '); return evalx(cond, local) ? evalx(yes, local) : no ? evalx(no, local) : null; }
    for (const op of [' or ', ' and ', ' == ', ' != ', ' ge ', ' gt ', ' le ', ' lt ', ' + ', ' - ']) {
      const parts = split(s, op); if (parts.length === 1) continue;
      if (op === ' or ') return parts.some(x => Boolean(evalx(x, local)));
      if (op === ' and ') return parts.every(x => Boolean(evalx(x, local)));
      const a = evalx(parts.slice(0, -1).join(op), local), b = evalx(parts.at(-1), local);
      if (op === ' == ') return equal(a, b);
      if (op === ' != ') return !equal(a, b);
      if (op === ' ge ') return a >= b;
      if (op === ' gt ') return a > b;
      if (op === ' le ') return a <= b;
      if (op === ' lt ') return a < b;
      if (op === ' + ') return typeof a === 'string' || typeof b === 'string' ? show(a) + show(b) : a + b;
      return a - b;
    }
    if (s.startsWith('not ')) return !evalx(s.slice(4), local);
    if (s.startsWith('typeof ')) return { __type: 'datatype', name: dtype(evalx(s.slice(7), local)) };
    if (s.startsWith('@')) { try { return evalx(s.slice(1), local); } catch { return null; } }
    if (s.endsWith('?')) { try { evalx(s.slice(0, -1), local); return true; } catch { return false; } }
    const parts = split(s, '.');
    let value;
    const first = parts.shift();
    if (/^-?\d+(?:L|s)?$/.test(first)) value = Number.parseInt(first);
    else if (first === 'true' || first === 'false') value = first === 'true';
    else if (first === 'null') value = null;
    else if (first.startsWith("'") && first.endsWith("'")) value = first.slice(1, -1).replace(/\\([nrt'\\])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', "'": "'", '\\': '\\' })[c]);
    else if (first.startsWith('table[')) value = new Map(split(first.slice(6, -1), ',').filter(Boolean).map(x => { const [k, v] = split(x, '='); return [k.trim(), evalx(v, local)]; }));
    else if (first.startsWith('[')) value = split(first.slice(1, -1), ',').filter(Boolean).map(x => evalx(x, local));
    else if (first.startsWith('(') && first.endsWith(')')) value = evalx(first.slice(1, -1), local);
    else if (first === 'md') value = md;
    else if (first === 'player') value = player;
    else if (first === 'faction') value = { player: 'player' };
    else if (first === 'datatype') value = new Proxy({}, { get: (_, name) => ({ __type: 'datatype', name }) });
    else if (Object.hasOwn(local, first)) value = local[first];
    else throw new Error(`Unknown expression ${s}`);
    for (const part of parts) {
      if (part.startsWith('[')) { const args = evalx(part, local); value = value.replace(/%s/g, () => show(args.shift())); }
      else value = get(value, part.startsWith('{') ? evalx(part.slice(1, -1), local) : part);
    }
    return value;
  }
  function assign(path, value, local, remove = false) {
    const parts = split(path, '.'); const first = parts.shift();
    if (!parts.length) { if (remove) delete local[first]; else local[first] = value; return; }
    let owner = first === 'md' ? md : local[first];
    const key = part => part.startsWith('{') ? evalx(part.slice(1, -1), local) : part;
    while (parts.length > 1) owner = get(owner, key(parts.shift()));
    const last = key(parts[0]);
    if (owner instanceof Map) { if (remove) owner.delete(last); else owner.set(last, value); }
    else if (Array.isArray(owner)) { if (remove) owner.splice(Number(last) - 1, 1); else owner[Number(last) - 1] = value; }
    else if (remove) delete owner[last]; else owner[last] = value;
  }
  function execute(nodes, local) {
    let branch = false;
    for (const n of nodes) {
      const a = n.attrs, ev = s => evalx(s, local);
      if (n.tag === 'do_if' || n.tag === 'do_elseif' || n.tag === 'do_else') {
        if (n.tag === 'do_if') branch = false;
        if (!branch && (n.tag === 'do_else' || ev(a.value))) { branch = true; const flow = execute(n.children, local); if (flow) return flow; } continue;
      }
      branch = false;
      if (n.tag === 'set_value') { const exact = a.exact === undefined ? Number(a.min) : ev(a.exact); assign(a.name, a.operation === 'add' ? ev(a.name) + exact : exact, local); }
      else if (n.tag === 'return') return { return: ev(a.value) };
      else if (n.tag === 'break') return { break: true };
      else if (n.tag === 'run_actions') { const args = Object.fromEntries(n.children.map(p => [p.attrs.name, ev(p.attrs.value)])); const result = call(a.ref, args); if (a.result) assign(a.result, result, local); }
      else if (n.tag === 'substitute_text') { let text = a.source ? ev(a.source) : ev(a.text); for (const r of n.children) text = text.split(ev(r.attrs.string)).join(ev(r.attrs.with)); assign(a.text, text, local); }
      else if (n.tag === 'debug_to_file') output.push({ name: ev(a.name), line: ev(a.text) });
      else if (n.tag === 'append_to_list') ev(a.name).push(ev(a.exact));
      else if (n.tag === 'remove_value') assign(a.name, null, local, true);
      else if (n.tag === 'find_ship') assign(a.name, [...ships], local);
      else if (n.tag === 'find_station') assign(a.name, [...stations], local);
      else if (n.tag === 'create_group') assign(a.groupname, [], local);
      else if (n.tag === 'add_to_group') { let group; try { group = ev(a.groupname); } catch { group = []; } if (a.replace === 'true') group = []; const items = a.list ? ev(a.list) : [ev(a.object)]; for (const item of items) if (!group.includes(item)) group.push(item); assign(a.groupname, group, local); }
      else if (n.tag === 'do_all' || n.tag === 'do_for_each') {
        const items = n.tag === 'do_all' ? Array.from({ length: ev(a.exact) }, (_, i) => i + 1) : ev(a.in);
        for (const item of items) { if (a.counter) local[a.counter] = item; if (a.name) local[a.name] = item; const flow = execute(n.children, local); if (flow?.break) break; if (flow) return flow; }
      } else if (n.tag === 'reset_cue') {} // Scheduling is outside this harness.
      else throw new Error(`Unsupported action ${n.tag}`);
    }
  }
  function call(name, args = {}) {
    const library = libraries.get(name); if (!library) throw new Error(`Unknown library ${name}`);
    const local = {};
    for (const p of library.children.find(x => x.tag === 'params').children) {
      const key = `$${p.attrs.name}`;
      if (Object.hasOwn(args, p.attrs.name)) local[key] = args[p.attrs.name];
      else if (p.attrs.default !== undefined) local[key] = evalx(p.attrs.default, local);
      else throw new Error(`Missing ${p.attrs.name}`);
    }
    return execute(library.children.find(x => x.tag === 'actions').children, local)?.return;
  }
  function cue(name) { return execute(cues.get(name).children.find(x => x.tag === 'actions').children, {}); }
  return { md, player, output, call, cue, tree };
}
