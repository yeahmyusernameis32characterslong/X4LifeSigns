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
const dtype = value => value == null ? 'null' : Array.isArray(value) ? 'list' : value instanceof Map ? 'table' : value.__type || (typeof value === 'bigint' ? 'largeint' : typeof value === 'number' || typeof value === 'boolean' ? 'integer' : typeof value);
const show = value => value == null ? 'null' : value.__type === 'datatype' ? `datatype.${value.name}` : value.ref ?? value.text ?? String(value);
const equal = (a, b) => a?.__type === 'datatype' && b?.__type === 'datatype' ? a.name === b.name : a === b;
export function harness(source, { ships = [], stations = [], allShips = ships, allStations = stations, age = 1, gamestart = {} } = {}) {
  const tree = parseXml(source), md = {}, output = [], notifications = [], callCounts = {}, libraries = new Map(), cues = new Map(), parents = new Map(), contexts = new Map();
  let randomCounter = 0;
  function walk(node, parentCue) {
    // Native load-time syntax errors cannot be hidden by optional evaluation.
    if (Object.values(node.attrs).some(v => /^@\s*(?:null\b|')/.test(v))) throw Error('Optional lookup operator requires a property lookup, not a literal');
    if (node.tag === 'library') libraries.set(node.attrs.name, node);
    if (node.tag === 'cue') { cues.set(node.attrs.name, node); parents.set(node.attrs.name, parentCue); parentCue = node.attrs.name; }
    node.children.forEach(child => walk(child, parentCue));
  }
  walk(tree);
  const player = { age, entity: { __type: 'component', exists: true }, galaxy: { __type: 'component', exists: true }, systemtime: { '%Y-%m-%d_%H-%M-%S': '2000-01-01_00-00-00' } };
  function get(value, key) {
    if (value == null && key === 'exists') return false;
    if (value == null) throw new Error(`Unavailable ${key}`);
    if (Object.hasOwn(value, '__pseudoEntry')) return get(value.entry, key);
    if (Object.hasOwn(value, '__indexOf')) return value.__indexOf.indexOf(key) + 1;
    if (value instanceof Map) {
      if (Object.hasOwn(value, key)) return value[key];
      if (key === 'keys') return { count: value.size, list: [...value.keys()] };
      if (!value.has(key)) throw new Error(`Missing table ${key}`);
      const item = value.get(key);
      // Contextual entry pseudo-types support terminal access, never storage.
      return key?.__type === 'npctemplate' && item != null && typeof item === 'object' && Object.hasOwn(item, 'exists') ? { __pseudoEntry: true, entry: item } : item;
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
    if (key === 'isclass') return new Proxy({}, { get: (_, klass) => value.class === klass || (klass === 'ship' && value.class === 'spacesuit') });
    const item = value[key];
    if (item === undefined) throw new Error(`Missing property ${key}`);
    return item;
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
    if (/^-?\d+(?:\.\d+)?(?:L|s)?$/.test(s)) return Number.parseFloat(s);
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
    else if (first === 'gamestart') value = gamestart;
    else if (first === 'faction') value = { player: 'player' };
    else if (first === 'controlpost') value = {aipilot:'aipilot',manager:'manager'};
    else if (first === 'class') value = {npc:'npc'};
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
    if (value != null && Object.hasOwn(Object(value), '__pseudoEntry')) throw new Error('Cannot store contextual pseudo-type');
    const parts = split(path, '.'); const first = parts.shift();
    if (!parts.length) { if (remove) delete local[first]; else local[first] = value; return; }
    let owner = first === 'md' ? md : local[first];
    const key = part => part.startsWith('{') ? evalx(part.slice(1, -1), local) : part;
    while (parts.length > 1) owner = get(owner, key(parts.shift()));
    const last = key(parts[0]);
    if (owner instanceof Map) {
      if (typeof last === 'string' && !last.startsWith('$')) throw Error('MD table string keys must start with $');
      if (last == null) throw Error('Null is not an MD table key');
      if (remove) owner.delete(last); else owner.set(last, value);
    }
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
      if (n.tag === 'set_value') { const exact = a.exact === undefined ? Number(a.min) + randomCounter++ : ev(a.exact); assign(a.name, a.operation === 'add' ? ev(a.name) + exact : exact, local); }
      else if (n.tag === 'return') return { return: ev(a.value) };
      else if (n.tag === 'break') return { break: true };
      else if (n.tag === 'run_actions') { const args = Object.fromEntries(n.children.map(p => [p.attrs.name, ev(p.attrs.value)])); const result = call(a.ref, args); if (a.result) assign(a.result, result, local); }
      else if (n.tag === 'substitute_text') { let text = a.source ? ev(a.source) : ev(a.text); for (const r of n.children) text = text.split(ev(r.attrs.string)).join(ev(r.attrs.with)); assign(a.text, text, local); }
      else if (n.tag === 'debug_to_file') output.push({ name: ev(a.name), line: ev(a.text) });
      else if (n.tag === 'show_notification') notifications.push({ kind: 'ticker', text: ev(a.text), timeout: ev(a.timeout), priority: ev(a.priority), afterRows: output.length });
      else if (n.tag === 'show_help') notifications.push({ kind: 'help', text: ev(a.custom), allowclose: ev(a.allowclose), timeout: ev(a.timeout), log: ev(a.log), afterRows: output.length });
      else if (n.tag === 'append_to_list') ev(a.name).push(ev(a.exact));
      else if (n.tag === 'remove_value') assign(a.name, null, local, true);
      else if (n.tag === 'find_ship') assign(a.name, [...(a.trueowner ? ships : allShips)], local);
      else if (n.tag === 'find_station') assign(a.name, [...(a.trueowner ? stations : allStations)], local);
      else if (n.tag === 'find_object_component') { const host = ev(a.object); assign(a.name, (host.componentNpcs || []).filter(x => x.class === 'npc' && x.isplayerowned), local); }
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
    callCounts[name] = (callCounts[name] || 0) + 1;
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
  function context(name) { if (!contexts.has(name)) contexts.set(name, { parent: parents.get(name) ? context(parents.get(name)) : {} }); return contexts.get(name); }
  function cue(name) {
    const node = cues.get(name), local = context(name);
    const checks = node.children.find(x => x.tag === 'conditions')?.children.filter(x => x.tag === 'check_value') || [];
    if (!checks.every(x => evalx(x.attrs.value, local))) return false;
    return execute(node.children.find(x => x.tag === 'actions')?.children || [], local);
  }
  // Explicit synthetic event delivery/readiness progression, not an MD scheduler.
  function load() { cue('RunBoundary'); cue('Bootstrap'); }
  function start() { load(); }
  return { md, player, output, notifications, callCounts, call, cue, start, load, tree };
}
