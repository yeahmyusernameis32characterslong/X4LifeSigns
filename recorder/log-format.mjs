// Lossless text framing only. Numeric/ID rendering performed by X4 is unverified.
export function escapeValue(value) {
  return String(value).replaceAll('%', '%25').replaceAll('|', '%7C')
    .replaceAll('\n', '%0A').replaceAll('\r', '%0D').replaceAll('\t', '%09');
}
export function unescapeValue(value) {
  if (/%(?!25|7C|0A|0D|09)/i.test(value)) throw new Error('Unknown escape');
  return value.replace(/%(25|7C|0A|0D|09)/gi, code => String.fromCharCode(Number.parseInt(code.slice(1), 16)));
}
export function parseRecord(line) {
  const cells = line.replace(/\r?\n$|\r$/, '').split('|');
  if (cells.shift() !== 'LSEV1' || cells.pop() !== 'END' || cells.length < 5) throw new Error('Invalid record framing');
  const header = Object.create(null);
  for (const key of ['run', 'session', 'seq', 'age']) {
    const cell = cells.shift();
    if (!cell?.startsWith(`${key}=`)) throw new Error(`Missing ${key}`);
    header[key] = cell.slice(key.length + 1);
  }
  if (!/^[0-9]+$/.test(header.seq) || !header.run || !header.session) throw new Error('Invalid provenance');
  const kind = cells.shift();
  if (!/^[A-Z_]+$/.test(kind)) throw new Error('Invalid record kind');
  const fields = Object.create(null);
  for (const cell of cells) {
    const equals = cell.indexOf('=');
    if (equals < 1) throw new Error('Invalid field');
    const key = cell.slice(0, equals);
    if (Object.hasOwn(fields, key)) throw new Error('Duplicate field');
    fields[key] = unescapeValue(cell.slice(equals + 1));
  }
  return { ...header, kind, fields };
}
