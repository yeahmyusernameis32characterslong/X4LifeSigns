const number = x => Number.isSafeInteger(x) && x >= 0 ? String(x) : 'Unknown';
const problem = x => String(x).toLowerCase().replaceAll('_', ' ');
export function previewModel(result, settings) {
  const inventory = result.inventory;
  const items = result.databases.map(d => ({ ...d }));
  for (const r of inventory.roots) if (!items.some(d => d.universe === r.universe)) items.push({ universe: r.universe, status: 'BLOCKED', blocks: ['MISSING_UNIVERSE_DATABASE'], retained: [] });
  items.sort((a,b) => String(a.universe || a.file).localeCompare(String(b.universe || b.file)));
  const details = [], list = [], ids = [];
  for (const [i,d] of items.entries()) {
    const id = String(i + 1), label = 'Universe ' + id, saves = inventory.saves.filter(s => s.root?.universe === d.universe);
    const pinned = settings.protectedUniverses.includes(d.universe);
    const uncertain = !inventory.complete || inventory.unknowns.some(u => !u.universe || u.universe === d.universe);
    const status = pinned ? 'Protected' : d.status !== 'PREVIEW_ONLY' || uncertain ? 'Needs attention' : saves.length ? 'In use' : 'Possibly unused';
    list.push([id, label, uncertain ? `${saves.length} known; Unknown` : String(saves.length), d.bytes === undefined ? 'Unknown' : `${number(d.bytes)} bytes`, status]);
    ids.push(d.universe || null);
    const rows = [['INFO','Universe',label,status,''],['INFO','Protection',pinned ? 'Protected' : 'Not protected','Whole universe',''],['INFO','Database size',d.bytes === undefined ? 'Unknown' : `${number(d.bytes)} bytes`,'Current file size','']];
    for (const s of saves) rows.push(['SAVE','Local saves',s.name,s.modifiedUtc || 'Unknown','Filesystem modified UTC; '+s.source]);
    if (!saves.length) rows.push(['SAVE','Local saves',uncertain ? 'Unknown' : 'No matching saves','','Selected local folders only']);
    const retained = (d.retained || []).reduce((n,r) => n + r.through,0);
    rows.push(['KEEP','History needed by your saves','Raw record prefix count', d.status === 'BLOCKED' || pinned ? 'Unknown' : number(retained),'Ancestor history included']);
    for (const key of ['records','profiles','events','sessions']) rows.push(['TAIL','Potentially removable history',key, d.candidates ? number(d.candidates[key]) : 'Unknown','Categories overlap; do not sum']);
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
