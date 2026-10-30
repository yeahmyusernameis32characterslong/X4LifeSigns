const number = x => Number.isSafeInteger(x) && x >= 0 ? String(x) : 'Unknown';
const problem = x => x==='SAVE_SCOPE_TOO_BROAD'?'Folder entry safety limit reached':x==='LINKED_SAVE_SUBFOLDER'?'Linked folder or file found; scan cannot follow links':String(x).toLowerCase().replaceAll('_', ' ');
// Decimal display units only; inventory and retention continue to use exact bytes.
export function displaySize(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return 'Unknown';
  if (bytes === 0) return '0 MB';
  if (bytes < 10000) return '<0.01 MB';
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(2)} MB`;
}
export function previewModel(result, settings) {
  const inventory = result.inventory;
  const items = result.databases.map(d => ({ ...d }));
  for (const r of inventory.roots) if (!items.some(d => d.universe === r.universe)) items.push({ universe: r.universe, status: 'BLOCKED', blocks: ['MISSING_UNIVERSE_DATABASE'], retained: [] });
  items.sort((a,b) => String(a.universe || a.file).localeCompare(String(b.universe || b.file)));
  const details = [], list = [], ids = [];
  for (const [i,d] of items.entries()) {
    const id = String(i + 1), label = d.universe ? 'Universe ' + id : 'Unknown database', saves = inventory.saves.filter(s => s.root?.universe === d.universe);
    const pinned = settings.protectedUniverses.includes(d.universe);
    const uncertain = !d.universe || !inventory.complete || inventory.unknowns.some(u => !u.universe || u.universe === d.universe);
    // Usage, protection and recorded restore points are independent facts.
    // A recorded point is fully verified by the existing Restore review, not by
    // this inventory's lastBackup pointer. Do not label it verified/available.
    const usage = d.deletionPending ? 'Deletion pending' : result.mode==='PRODUCTION_MENU'&&uncertain?'Scan incomplete': d.recovery ? 'Recovery required' : d.status !== 'PREVIEW_ONLY' || uncertain ? 'Needs attention' : saves.length ? 'In use' : result.mode==='PRODUCTION_MENU'?'Orphaned':'Possibly unused';
    const status = [usage, pinned && 'Protected', ['ISOLATED_MENU_TEST','PRODUCTION_MENU'].includes(result.mode) && d.status === 'PREVIEW_ONLY' && !uncertain && d.candidates?.records === 0 && 'No cleanup needed', d.hasBackup && 'Restore point recorded'].filter(Boolean).join('; ');
    list.push([id, label, uncertain ? `${saves.length} known; Unknown` : String(saves.length), displaySize(d.bytes), status]);
    ids.push(d.universe || null);
    const rows = [['INFO','Universe',label,status,''],['INFO','Protection',!d.universe ? 'Unknown' : pinned ? 'Protected' : 'Not protected','Whole universe',''],['INFO','Database size',displaySize(d.bytes),'Current file size','']];
    if (['ISOLATED_MENU_TEST','PRODUCTION_MENU'].includes(result.mode)) rows.push(['INFO','Restore point',d.hasBackup ? 'Recorded' : 'None recorded',d.hasBackup ? 'Checked when Restore is selected' : 'Created before maintenance','']);
    if(result.mode==='PRODUCTION_MENU'){rows.push(['INFO','Restore-point space',displaySize(d.backupBytes),'Separate backup files','']);rows.push(['INFO','Compaction estimate',displaySize(d.compactEstimate),'Free database pages','Actual space is measured after compaction']);}
    for (const s of saves) rows.push(['SAVE','File modified (UTC)',s.name,s.modifiedUtc || 'Unknown',s.source]);
    if (!saves.length) rows.push(['SAVE','Local saves',uncertain ? 'Unknown' : 'No matching saves','','Selected local folders only']);
    const retained = (d.retained || []).reduce((n,r) => n + r.through,0);
    rows.push(['KEEP','History needed by your saves','History records', d.status === 'BLOCKED' || pinned ? 'Unknown' : number(retained),'']);
    // Raw history records are the one player-facing count. Projections and
    // sessions overlap those records; never sum or present them as extra history.
    rows.push(['TAIL','Potentially removable history','History records', d.candidates ? number(d.candidates.records) : 'Unknown','']);
    for (const b of [...(d.blocks || []),...inventory.unknowns.filter(u=>!u.universe || u.universe===d.universe).map(u=>u.code),...result.unknowns.filter(u=>!u.universe || u.universe===d.universe).map(u=>u.code)]) rows.push(['PROBLEM','Problems requiring attention',problem(b),'','']);
    details.push(rows);
  }
  const locations = settings.saveLocations.map((p,i)=>[String(i+1),'Local folder '+(i+1),p,'Selected local scope','']);
  if (!locations.length) locations.push(['0','No save locations configured','Unknown','','']);
  locations.push(['0','Configure locations','Edit local-data/housekeeping-preview-v1.json','Restart companion, then Refresh','No folder picker is used']);
  const issues = [...inventory.unknowns,...result.unknowns].map(u=>['0','Needs attention',problem(u.code),u.source || u.file || 'Selected local scope','']);
  if (!list.length) list.push(['0',issues.length ? 'Needs attention' : 'No databases found','Unknown','Unknown',issues.length ? 'Needs attention' : 'No databases found']);
  return { list, details, ids, locations, issues };
}

// Preference-only overlay on the completed unprotected preview. Keep the base
// untouched so removing protection restores exact prior counts/uncertainty.
export function applyProtection(base, settings) {
  const model = { ...base, list: base.list.map(row => [...row]),
    details: base.details.map(rows => rows.map(row => [...row])) };
  for (const [i,id] of base.ids.entries()) {
    if (!id || !settings.protectedUniverses.includes(id)) continue;
    const protectedStatus = base.list[i][4].split('; ').includes('Protected') ? base.list[i][4] : base.list[i][4] + '; Protected';
    model.list[i][4] = protectedStatus;
    for (const row of model.details[i]) {
      if (row[0] === 'INFO' && row[1] === 'Universe') row[3] = protectedStatus;
      if (row[0] === 'INFO' && row[1] === 'Protection') row[2] = 'Protected';
      if (row[0] === 'KEEP') row[3] = 'Unknown';
      if (row[0] === 'TAIL') row[3] = '0';
    }
  }
  return model;
}
