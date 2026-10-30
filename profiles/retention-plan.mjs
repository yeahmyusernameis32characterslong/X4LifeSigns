// Pure preview. No SQL/filesystem access and no executable cleanup plan.
import { universeId, runId, ordinal } from './profile-schema.mjs';

export function retentionPreview(snapshot, roots, { complete = false, unknowns = [], pinned = false } = {}) {
  const result = { universe: snapshot.universe, mode: 'READ_ONLY_PREVIEW', applyAvailable: false,
    status: 'BLOCKED', blocks: [], retained: [], candidates: null, roots: [], pinned };
  const block = code => { if (!result.blocks.includes(code)) result.blocks.push(code); };
  try { universeId(snapshot.universe); } catch { block('INVALID_UNIVERSE'); return result; }
  if (snapshot.status !== 'OWNED') { block(snapshot.problem || 'UNSUPPORTED_DATABASE'); return result; }
  const runs = new Map(snapshot.runs.map(r => [r.run, r]));
  // Pinning preserves *all* runs and all prefixes, including abandoned futures.
  if (pinned) {
    result.status = 'PINNED'; result.retained = [...snapshot.runs].sort((a,b) => a.run.localeCompare(b.run)).map(r => ({ run: r.run, through: r.records }));
    result.candidates = { kind: 'NONE', records: 0, profiles: 0, events: 0, sessions: 0 }; return result;
  }
  if (!complete) block('INCOMPLETE_INVENTORY');
  for (const u of unknowns) if (!u.universe || u.universe === snapshot.universe) block(u.code || 'UNKNOWN_SAVE');
  const keep = new Map();
  try {
    if (runs.size !== snapshot.runs.length) throw Error('DUPLICATE_RUN');
    if (!snapshot.runs.some(r => r.baseline === 1 && r.snapshotEnds.length)) throw Error('INCOMPLETE_BASELINE');
    for (const r of runs.values()) {
      runId(r.run); ordinal(r.records);
      if (!r.records || r.first !== 1 || r.last !== r.records) throw Error('RECORD_GAP');
      if (![0, 1].includes(r.baseline)) throw Error('INVALID_SESSION');
      if (r.baseline && !r.snapshotEnds.length) throw Error('INCOMPLETE_BASELINE');
      if ((r.parent === null) !== (r.baseline === 1) || (r.parent === null && r.parentRecord !== 0)) throw Error('INVALID_SESSION');
      const seen = new Set(); let cursor = r;
      while (cursor) {
        if (seen.has(cursor.run)) throw Error('ANCESTRY_CYCLE'); seen.add(cursor.run);
        if (!cursor.parent) break;
        const p = runs.get(cursor.parent);
        if (!p) throw Error('MISSING_PARENT');
        const cutoff = ordinal(cursor.parentRecord);
        if (!cutoff || cutoff > p.records) throw Error('INVALID_PARENT_CUTOFF');
        cursor = p;
      }
    }
    for (const root of [...roots].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
      if (root.universe !== snapshot.universe) continue;
      runId(root.run); const cutoff = ordinal(root.record);
      if (!cutoff) throw Error('INVALID_ROOT_CUTOFF');
      let r = runs.get(root.run), limit = cutoff, baseline = false;
      if (!r) throw Error('MISSING_ROOT_RUN');
      const rootKeep = [];
      while (r) {
        if (limit > r.records) throw Error('MISSING_ROOT_RECORD');
        if (r.profiles.some(p => p.begin <= limit && (p.end === null || p.end > limit))) throw Error('PARTIAL_PROFILE_CUTOFF');
        if (r.baseline && r.snapshotEnds.some(n => n <= limit)) baseline = true;
        rootKeep.push([r.run, limit]); limit = r.parentRecord; r = r.parent ? runs.get(r.parent) : null;
      }
      if (!baseline) throw Error('INCOMPLETE_BASELINE');
      for (const [run, n] of rootKeep) keep.set(run, Math.max(keep.get(run) || 0, n));
      result.roots.push({ source: root.source, run: root.run, record: cutoff });
    }
  } catch (e) { block(/^[A-Z_]+$/.test(e.message) ? e.message : 'INVALID_GRAPH_OR_ROOT'); }
  result.blocks.sort();
  result.retained = [...keep].sort(([a], [b]) => a.localeCompare(b)).map(([run, through]) => ({ run, through }));
  if (result.blocks.length) return result;
  const totals = { records: 0, profiles: 0, events: 0, sessions: 0 };
  for (const r of runs.values()) {
    const cutoff = keep.get(r.run) || 0;
    totals.records += r.records - cutoff;
    totals.profiles += r.profileEnds.filter(n => n > cutoff).length;
    totals.events += r.eventRecords.filter(n => n > cutoff).length;
    if (!keep.has(r.run)) totals.sessions++;
  }
  if (!Object.values(totals).every(Number.isSafeInteger)) { block('RESOURCE_LIMIT'); return result; }
  result.status = 'PREVIEW_ONLY';
  result.candidates = { kind: roots.some(r => r.universe === snapshot.universe) ? 'UNREACHABLE_HISTORY' : 'ORPHAN_UNIVERSE', ...totals };
  return result;
}
