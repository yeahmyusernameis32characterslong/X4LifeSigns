// Separate from LSDB1 profile acknowledgements and LSLOAD1 load fencing.
export const PREVIEW_HELLO = 'session-0-4-loaded-2000-01-01_00-00-00';
export const PREVIEW_REPLY = 'session-0-5-loaded-2000-01-01_00-00-00';
export const PAGE_SIZE = 3;
export const LIST_PAGE_SIZE = 10;
export const generation = x => typeof x === 'string' && /^[0-9a-f]{32}$/.test(x);
const integer = x => /^(0|[1-9]\d{0,8})$/.test(x);
export function parsePreviewRequest(line) {
  const m = /(?:^|\s)LSHK1\|([0-9a-f]{32})\|([0-9a-f]{32})\|([1-9]\d{0,8})\|(REFRESH|LIST|DETAIL|LOCATIONS|PROTECT|CANCEL|REVIEW|RESTOREREVIEW|APPLY|RESTORE)\|(0|[1-9]\d{0,8})\|(0|1)\|(0|[1-9]\d{0,8})\|END\s*$/.exec(line);
  if (!m || line.length > 512) return null;
  const [, gen, client, seq, verb, item, enabled, page] = m;
  const action=['REVIEW','RESTOREREVIEW','APPLY','RESTORE'].includes(verb);
  if ((verb === 'DETAIL' || verb === 'PROTECT' || action) ? item === '0' : item !== '0') return null;
  if (['APPLY','RESTORE'].includes(verb) ? enabled!=='1' : verb !== 'PROTECT' && enabled !== '0') return null;
  if(action&&page!=='0')return null;
  return { gen, client, seq: Number(seq), verb, item: Number(item), enabled: enabled === '1', page: Number(page) };
}
export function cell(value, maxBytes = 96) {
  let text = String(value ?? 'Unknown').replace(/[\x00-\x1f\x7f]/g, ' ');
  if (Buffer.byteLength(text) > maxBytes) {
    while (Buffer.byteLength(text) > maxBytes - 3) text = text.slice(0, -1);
    // Never publish an unpaired UTF-16 surrogate from clipping.
    text = text.replace(/[\ud800-\udbff]$/, '') + '...';
  }
  return Buffer.from(text, 'utf8').toString('hex');
}
export function previewReply(gen, request, state, rows = [], page = 0) {
  if (!generation(gen) || !generation(request.client) || !integer(String(request.seq)) || !/^(READY|SCANNING|CANCELLED|STALE|ERROR|UNAVAILABLE)$/.test(state)) throw Error('Invalid preview frame');
  const list = ['REFRESH','LIST'].includes(request.verb);
  const pageSize = list ? LIST_PAGE_SIZE : PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (!Number.isSafeInteger(page) || page < 0 || page >= pages) throw Error('Invalid preview page');
  const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
  if (slice.some(row => row.length !== 5)) throw Error('Invalid preview row');
  // Ten compact list rows fit the unchanged native buffer even at every cap.
  // Details/locations retain three rows and their original 96-byte cells.
  // Independent usage/protection/restore labels must survive clipping together.
  // Ten rows at all these caps still fit the unchanged 4096-byte native buffer.
  const caps = list ? [9,32,32,32,80] : [96,96,96,96,96];
  const text = `LSDB1|HOUSEKEEPING|${gen}|${request.client}|${request.seq}|${state}|${page}|${pages}|${slice.length}|${slice.flatMap(row => row.map((value,i) => cell(value,caps[i]))).join('|')}${slice.length ? '|' : ''}END\n`;
  if (Buffer.byteLength(text) >= 4096) throw Error('Oversized preview frame');
  return text;
}

// Informational counts only. No paths, identities or provisional conclusions.
export function scanProgressRows(progress) {
  if (!progress || !['SAVES','SAVE_RECHECK','DATABASES','DATABASE_RECHECK'].includes(progress.stage) ||
      !Number.isSafeInteger(progress.completed) || progress.completed < 0 || progress.completed > 999999999 ||
      (progress.stage === 'SAVES' ? progress.total !== null :
        !Number.isSafeInteger(progress.total) || progress.total < progress.completed || progress.total > 999999999)) throw Error('Invalid scan progress');
  return [['PROGRESS',progress.stage,String(progress.completed),progress.total === null ? '' : String(progress.total),'']];
}
