// Additive profile test storage. Production docking v1/v2 files are never opened.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { universeId, runId, ordinal, APP, statements, validateProfileDatabase as validate } from './profile-schema.mjs';
export { universeId, runId, ordinal } from './profile-schema.mjs';
import { checkPath, checkSidecars, sameFile } from '../bridge/src/session-path.js';
import {registered,productionRoot,writerLease,validateProduction,updateCatalog} from './production-contract.mjs';

function refuseWal(file) {
  const fd = fs.openSync(file, 'r'); const header = Buffer.alloc(20);
  try { fs.readSync(fd, header, 0, 20, 0); } finally { fs.closeSync(fd); }
  if (header[18] === 2 || header[19] === 2) throw Error('WAL profile files are not supported');
}
function directory(root) {
  checkPath(root, { directory: true });
  for (const p of [path.join(root, 'local-data'), path.join(root, 'local-data', 'profiles')]) {
    if (!fs.existsSync(p)) fs.mkdirSync(p);
    checkPath(p, { directory: true });
  }
  return path.join(root, 'local-data', 'profiles');
}
export class ProfileStore {
  constructor(root, id, run) {
    if(fs.existsSync(path.join(root,'maintenance-owned.json')))throw Error('Maintenance test roots cannot receive gameplay ingestion');
    this.root=path.resolve(root);this.writerLease=writerLease(this.root);
    try {
    this.id = universeId(id); this.run = runId(run);
    const dir = directory(path.resolve(root));
    this.final = path.join(dir, id + '.db');
    if(registered(this.root)){
      const c=productionRoot(this.root);this.entry=c.catalog.universes[id];this.rootId=c.registration.id;
      if(this.entry?.phase!=='READY'&&this.entry)throw Error('RECOVERY_REQUIRED');
      if(this.entry&&!fs.existsSync(this.final))throw Error('Registered database missing; restoration required');
      if(!this.entry&&fs.existsSync(this.final))throw Error('Unregistered existing database');
    }
    this.file = fs.existsSync(this.final) ? this.final : path.join(dir, `${id}.${run}.building.db`);
    this.newBaseline = this.file !== this.final;
    checkSidecars(this.file);
    let created = false;
    this.info = checkPath(this.file, { missing: true });
    if (!this.info) { const fd = fs.openSync(this.file, 'wx'); try { this.info = fs.fstatSync(fd); created = true; } finally { fs.closeSync(fd); } }
    if (!created) {
      refuseWal(this.file); const ro = new DatabaseSync(this.file, { readOnly: true });
      try { const m = this.validate(ro); if (!this.newBaseline && !m.ready) throw Error('Published profile database is incomplete'); } finally { ro.close(); }
    }
    this.guard(); this.db = new DatabaseSync(this.file);
    if (created) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        for (const sql of statements) this.db.exec(sql);
        this.db.prepare("INSERT INTO universe_metadata VALUES(1,?,'LIFESIGNS_MD_V1',0)").run(id);
        this.db.exec(`PRAGMA application_id=${APP}; PRAGMA user_version=1; COMMIT`);
      } catch (e) { this.db.exec('ROLLBACK'); this.db.close(); throw e; }
    }
    this.configureWriter();this.validate(this.db); this.guard(); this.activeProfile = null;
    } catch(e){if(this.db?.isOpen)this.db.close();this.writerLease?.close();throw e;}
  }
  validate(db){return this.rootId?validateProduction(db,this.id,this.rootId,this.entry):validate(db,this.id);}
  configureWriter(){if(this.entry?.version===2)this.db.function('ls_housekeeping_generation',()=>this.entry.generation);}
  guard() {
    this.writerLease?.guard();
    if(this.rootId){const e=productionRoot(this.root).catalog.universes[this.id];if(this.entry&&(!e||e.phase!=='READY'||e.generation!==this.entry.generation))throw Error('Production registration changed');}
    if (!sameFile(this.info, checkPath(this.file))) throw Error('Profile database replaced'); checkSidecars(this.file);
  }
  close() { if (this.db?.isOpen) this.db.close();this.writerLease?.close(); }
  status() {
    if(this.entry?.version===2){const seal=this.db.prepare('SELECT cutoff FROM housekeeping_seals WHERE run_id=?').get(this.run);if(seal)return {universe:this.id,run:this.run,state:'SEALED_REPLAY',record:seal.cutoff};}
    const ready = this.db.prepare('SELECT ready FROM universe_metadata').get().ready;
    const record = this.db.prepare('SELECT coalesce(max(record_id),0) AS n FROM records WHERE run_id=?').get(this.run).n;
    return { universe: this.id, run: this.run, state: ready ? 'READY' : this.db.prepare("SELECT 1 FROM records WHERE run_id=? AND kind='SNAPSHOT_BEGIN'").get(this.run) ? 'BUILDING' : 'NEED_BASELINE', record };
  }
  ingest(rows) {
    this.guard(); const db = this.db;
    if(this.entry?.version===2){
      const seal=db.prepare('SELECT cutoff FROM housekeeping_seals WHERE run_id=?').get(this.run);
      if(seal){
        for(const row of rows){if(row.run!==this.run)throw Error('Run mismatch');const n=ordinal(row.fields.record);if(!n)throw Error('Invalid replay ordinal');if(n<=seal.cutoff&&db.prepare('SELECT payload FROM records WHERE run_id=? AND record_id=?').get(this.run,n)?.payload!==JSON.stringify(row))throw Error('Conflicting retained replay');}
        return {universe:this.id,run:this.run,state:'SEALED_REPLAY',record:seal.cutoff};
      }
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of rows) {
        if (row.run !== this.run) throw Error('Run mismatch');
        const n = ordinal(row.fields.record); if (!n) throw Error('Record ordinal must be positive');
        const payload = JSON.stringify(row);
        const prior = db.prepare('SELECT payload FROM records WHERE run_id=? AND record_id=?').get(this.run, n);
        if (prior) {
          if (prior.payload !== payload) throw Error('Conflicting replay');
          // Rebuild an unfinished profile when a service restart replays its prefix.
          if (row.kind === 'PROFILE_BEGIN') this.activeProfile = { number: row.fields.profile, kind: row.fields.kind, fields: {} };
          if (row.kind === 'VALUE' && this.activeProfile) this.activeProfile.fields[row.fields.field] = { value: row.fields.value, state: row.fields.state, type: row.fields.type };
          if (row.kind === 'PROFILE_END') this.activeProfile = null;
          continue;
        }
        if (!/^\d+(?:\.\d+)?$/.test(row.age)) throw Error('Invalid game time');
        const last = db.prepare('SELECT coalesce(max(record_id),0) AS n FROM records WHERE run_id=?').get(this.run).n;
        if (n !== last + 1) throw Error(`Non-contiguous profile stream: expected ${last + 1}, received ${n} (${row.kind})`);
        const f = row.fields;
        if (row.kind === 'RUN_BEGIN') {
          if (n !== 1 || f.lifesigns_universe_id !== this.id || f.database_protocol !== 'LSDB1') throw Error('Invalid profile startup');
          let parent = f.parent_run === 'NONE' ? null : runId(f.parent_run);
          let cursor = ordinal(f.parent_record);
          // Missing universe file requires a fresh baseline, even when a save carries
          // an older acknowledged checkpoint. Retain the raw startup provenance.
          if (this.newBaseline) { parent = null; cursor = 0; }
          if (!parent && !this.newBaseline) throw Error('Existing universe requires a saved committed checkpoint; refusing later history for a pre-database save');
          if (parent && !db.prepare('SELECT 1 FROM records WHERE run_id=? AND record_id=?').get(parent, cursor)) throw Error('Saved checkpoint not found in this universe database');
          if (parent && !this.ancestry(parent, cursor).some(p => db.prepare("SELECT 1 FROM records WHERE run_id=? AND record_id<=? AND kind='SNAPSHOT_END'").get(p.run, p.limit))) throw Error('Saved checkpoint predates completed baseline; save after database creation');
          db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(this.run, row.session, parent, cursor, this.newBaseline ? 1 : 0);
        } else if (!db.prepare('SELECT 1 FROM sessions WHERE run_id=?').get(this.run)) throw Error('Missing profile startup');
        db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(this.run, n, row.kind, row.age, payload);
        if (row.kind === 'PROFILE_BEGIN') {
          if (this.activeProfile) throw Error('Nested profile');
          if (!['STATION', 'SHIP', 'NPC', 'PLAYER'].includes(f.kind)) throw Error('Unknown profile kind');
          this.activeProfile = { number: f.profile, kind: f.kind, fields: {} };
        }
        if (row.kind === 'VALUE') {
          if (!this.activeProfile || this.activeProfile.number !== f.profile || Object.hasOwn(this.activeProfile.fields, f.field)) throw Error('Unmatched or duplicate profile value');
          this.activeProfile.fields[f.field] = { value: f.value, state: f.state, type: f.type };
        }
        if (row.kind === 'PROFILE_END') {
          const p = this.activeProfile; if (!p || p.number !== f.profile) throw Error('Unmatched profile end');
          const present = key => p.fields[key]?.state === 'PRESENT' ? p.fields[key].value : null;
          const seed = present('seed'), code = present('idcode') || (['NPC','PLAYER'].includes(p.kind) ? /\(([A-Z]{3}-[0-9]{3})\)/.exec(present('debugname') || '')?.[1] || null : null), ref = present('reference') || present('actor_reference');
          const key = seed ? `${p.kind}:seed:${seed}` : code ? `${p.kind}:idcode:${code}` : `${p.kind}:unresolved:${this.run}:${n}`;
          db.prepare('INSERT INTO profile_versions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(this.run, n, p.number, key, p.kind, seed, code, ref, row.age, JSON.stringify(p.fields), f.partial === '1' || f.partial === 'true' ? 1 : 0);
          this.activeProfile = null;
        }
        if (row.kind === 'ENTITY_EVENT') {
          if (!['SHIP', 'STATION', 'NPC', 'PLAYER', 'ASSET', 'UNIVERSE'].includes(f.subject_kind) || !/^[A-Z][A-Z_]+$/.test(f.event_type)) throw Error('Invalid entity event');
          const identifier = x => x && x !== 'null' && x !== 'UNAVAILABLE' ? x : null;
          db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(this.run, n, f.event_type, row.age, f.subject_kind, identifier(f.subject_seed), identifier(f.subject_idcode), identifier(f.subject_reference), identifier(f.host_seed), identifier(f.host_idcode), identifier(f.other_seed), identifier(f.other_idcode), JSON.stringify(f));
        }
        if (row.kind === 'SNAPSHOT_END') {
          if (this.activeProfile) throw Error('Snapshot ended with open profile');
          const count = db.prepare('SELECT count(*) AS n FROM profile_versions WHERE run_id=?').get(this.run).n;
          if (count !== ordinal(f.profiles)) throw Error('Snapshot count/readback mismatch');
          db.exec('UPDATE universe_metadata SET ready=1');
        }
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); this.activeProfile = null; throw e; }
    const result = this.status(); // Readback occurs only after COMMIT.
    if (result.state === 'READY' && this.newBaseline) {
      this.db.close(); this.guard(); checkSidecars(this.final); fs.copyFileSync(this.file, this.final, fs.constants.COPYFILE_EXCL);
      const ro = new DatabaseSync(this.final, { readOnly: true }); try { validate(ro, this.id); } finally { ro.close(); }
      if(this.rootId){const c=productionRoot(this.root);if(c.catalog.universes[this.id])throw Error('Universe already registered');this.entry={phase:'READY',version:1,generation:0,lastBackup:null};updateCatalog(c,{...c.catalog,universes:{...c.catalog.universes,[this.id]:this.entry}});}
      this.file = this.final; this.info = checkPath(this.file); this.newBaseline = false; this.db = new DatabaseSync(this.file); this.guard();
    }
    return result;
  }
  ancestry(run = this.run, record = Number.MAX_SAFE_INTEGER) {
    runId(run); ordinal(record);
    const chain = []; const seen = new Set();
    for (let cursor = run, limit = record; cursor;) {
      if (seen.has(cursor)) throw Error('Cyclic saved ancestry'); seen.add(cursor);
      chain.push({ run: cursor, limit }); const s = this.db.prepare('SELECT * FROM sessions WHERE run_id=?').get(cursor);
      if (!s) throw Error('Unknown saved session'); cursor = s.parent_run; limit = s.parent_record;
    }
    return chain;
  }
  eventsAt(run = this.run, record = Number.MAX_SAFE_INTEGER) {
    return this.ancestry(run, record).reverse().flatMap(p => this.db.prepare('SELECT * FROM events WHERE run_id=? AND record_id<=? ORDER BY record_id').all(p.run, p.limit).map(e => ({...e, fields:JSON.parse(e.fields_json)})));
  }
  historyForNpc(seed, {run=this.run, record=Number.MAX_SAFE_INTEGER, includeWorld=false}={}) {
    if(typeof seed!=='string'||!/^\-?\d+$/.test(seed))throw Error('NPC seed must be exact integer text');
    const chain=this.ancestry(run,record).reverse(),position=new Map(chain.map((p,i)=>[p.run,i]));
    const compare=(a,b)=>position.get(a.run_id)-position.get(b.run_id)||a.record_id-b.record_id;
    const npcProfiles=chain.flatMap(p=>this.db.prepare("SELECT * FROM profile_versions WHERE kind='NPC' AND seed=? AND run_id=? AND record_id<=? ORDER BY record_id").all(seed,p.run,p.limit));
    const events=this.eventsAt(run,record);
    // Asset identities are an offline read view, never a collector scan or mutable profile.
    const assets=chain.flatMap(p=>this.db.prepare("SELECT kind,seed,idcode,reference,run_id,record_id FROM profile_versions WHERE kind IN ('SHIP','STATION') AND run_id=? AND record_id<=? ORDER BY record_id").all(p.run,p.limit));
    const present=(f,k)=>f[k]?.state==='PRESENT'?f[k].value:null;
    const meaningful=x=>typeof x==='string'&&x!==''&&x!=='null'&&x!=='UNAVAILABLE';
    const resolve=(s,code,reference,point)=>{
      if(meaningful(s))return {seed:s,idcode:meaningful(code)?code:null,reference:meaningful(reference)?reference:null};
      const matches=assets.filter(a=>compare(a,point)<=0&&(meaningful(code)?a.idcode===code:meaningful(reference)&&a.run_id===point.run_id&&a.reference===reference));
      const keys=new Set(matches.map(a=>a.seed||a.idcode));
      if(keys.size===1){const a=matches.at(-1);return {seed:a.seed,idcode:a.idcode,reference:a.reference};}
      return meaningful(code)?{seed:null,idcode:code,reference:null}:null;
    };
    const matches=(identity,e,prefix='subject')=>identity&&(identity.seed?e[prefix+'_seed']===identity.seed:identity.idcode&&e[prefix+'_idcode']===identity.idcode);
    const direct=events.filter(e=>e.subject_kind==='NPC'&&e.subject_seed===seed);
    const timeline=[...npcProfiles.map(p=>({...p,profile:JSON.parse(p.fields_json)})),...direct].sort(compare);
    let assignment=null,presence=null,role=null,assignmentBasis='UNKNOWN',presenceBasis='UNKNOWN';
    const states=[];
    for(const item of timeline){
      if(item.profile){const f=item.profile;
        assignment=present(f,'assignment_basis')==='CONFLICTING_ACTOR_RELATIONSHIPS'?null:resolve(null,present(f,'assigned_ship_idcode'),present(f,'role_object_reference')||present(f,'assigned_controlled_reference'),item);
        assignmentBasis=present(f,'assignment_basis')||'UNKNOWN';
        presence=resolve(null,null,present(f,'container_reference'),item);
        presenceBasis=presence?'ACTOR_CONTAINER_OBSERVED':'UNKNOWN';
        if(!presence&&present(f,'location_basis')==='HOST_CURRENT_PERSONNEL_ENTRY'){
          presence=resolve(null,present(f,'context_host_idcode'),present(f,'context_host_reference'),item);presenceBasis=presence?'HOST_AVAILABLE_PERSONNEL_ENTRY':'UNKNOWN';
        }
        role=present(f,'controlpost_name')||present(f,'role_name')||role;
      }else{const f=item.fields;
        // Requests, boarding roster membership and generic presence changes never promote/reassign a person.
        if(['ASSIGNMENT_OBSERVED','CONTROL_ROLE_ASSIGNED','CONTROL_ROLE_REMOVED','CREW_ROLE_OBSERVED'].includes(item.event_type)){
          const observed=resolve(f.assigned_seed,f.assigned_idcode,f.assigned_reference,item);
          if(observed){assignment=observed;assignmentBasis=f.assignment_basis||'OBSERVED_RELATION';}
          else if(f.assignment_state==='NONE'){assignment=null;assignmentBasis='OBSERVED_UNASSIGNED';}
          else if(f.assignment_state==='AMBIGUOUS'){assignment=null;assignmentBasis='CONFLICTING_ACTOR_RELATIONSHIPS';}
          else if(item.event_type==='CONTROL_ROLE_REMOVED'){assignment=null;assignmentBasis='UNKNOWN_AFTER_CONTROL_REMOVAL';}
          if(meaningful(f.control_post)||meaningful(f.actual_role))role=meaningful(f.control_post)?f.control_post:f.actual_role;
        }
        const location=resolve(f.location_seed,f.location_idcode,f.location_reference,item);
        if(location){presence=location;presenceBasis=f.location_basis||'OBSERVED_LOCATION';}
        else if(['ENTITY_LEFT','EJECTED','RESCUED','ENTITY_ENTERED'].includes(item.event_type)){
          presence=null;presenceBasis='UNKNOWN_AFTER_MOVEMENT';
        }
      }
      states.push({run_id:item.run_id,record_id:item.record_id,game_time:item.game_time,assignment:assignment&&{...assignment},presence:presence&&{...presence},role,assignment_basis:assignmentBasis,presence_basis:presenceBasis});
    }
    const observations=[],contacts=[];let index=-1;
    for(const e of events){while(index+1<states.length&&compare(states[index+1],e)<=0)index++;
      const state=index>=0?states[index]:null;
      if(e.subject_kind==='NPC'){
        if(e.subject_seed===seed)observations.push({...e,relationship:'DIRECT_NPC_OBSERVATION'});
        continue;
      }
      if(e.subject_kind==='UNIVERSE'){
        if(includeWorld)observations.push({...e,relationship:'WORLD_CONTEXT_NOT_PERSONAL_KNOWLEDGE'});
        continue;
      }
      let relationship=null;
      if(state){
        if(matches(state.presence,e)||matches(state.presence,e,'other'))relationship='LAST_OBSERVED_PRESENT_ON_RELATED_ASSET';
        else if(matches(state.assignment,e)||matches(state.assignment,e,'other'))relationship=state.assignment_basis==='CONTEXT_HOST_ROSTER_ASSOCIATION'?'HOST_ROSTER_ASSOCIATION':'ASSIGNED_TO_RELATED_ASSET';
      }
      if(relationship){observations.push({...e,relationship,npc_role:state.role,assignment_basis:state.assignment_basis,presence_basis:state.presence_basis});
        if(['ATTACKED','ATTACKING'].includes(e.event_type)&&meaningful(e.other_seed))contacts.push({seed:e.other_seed,event:e,relationship});
      }else if(e.event_type==='RELATED_OBJECT_DESTROYED'){
        const contact=contacts.findLast(c=>c.seed===e.subject_seed&&Number(e.game_time)>=Number(c.event.game_time)&&Number(e.game_time)-Number(c.event.game_time)<=120);
        if(contact)observations.push({...e,relationship:'DERIVED_RELATED_CONTACT_OUTCOME',related_contact:{run_id:contact.event.run_id,record_id:contact.event.record_id},intent:'UNKNOWN'});
      }
    }
    return {npc_seed:seed,run_id:run,record,service_observations:states,observations,knowledge:'FACTS_AND_RELATIONSHIPS_NOT_ASSERTED_PERSONAL_RECOLLECTION'};
  }
  profilesAt(run = this.run, record = Number.MAX_SAFE_INTEGER) {
    const chain = this.ancestry(run, record);
    const objects = new Map();
    for (const item of chain) for (const p of this.db.prepare('SELECT * FROM profile_versions WHERE run_id=? AND record_id<=? ORDER BY record_id DESC').all(item.run, item.limit)) if (!objects.has(p.entity_key)) objects.set(p.entity_key, { ...p, fields: JSON.parse(p.fields_json) });
    const profiles = [...objects.values()];
    // Baseline/profile rows remain immutable. Apply only later observed names
    // on this save's ancestry, not names from an abandoned future branch.
    const position = new Map([...chain].reverse().map((p, i) => [p.run, i]));
    const seeds = new Map(), codes = new Map(), references = new Map();
    const index = (map, key, p) => { if (key) map.set(key, map.has(key) ? null : p); };
    for (const p of profiles) {
      index(seeds, p.seed && `${p.kind}:${p.seed}`, p);
      index(codes, p.idcode && `${p.kind}:${p.idcode}`, p);
      index(references, p.reference && `${p.run_id}:${p.kind}:${p.reference}`, p);
    }
    const names = this.db.prepare("SELECT * FROM events WHERE run_id=? AND record_id<=? AND event_type IN ('NAME_CHANGED','NAME_OBSERVED') AND subject_kind IN ('SHIP','STATION') ORDER BY record_id");
    const nameEvents = [...chain].reverse().flatMap(p => names.all(p.run, p.limit).map(e => ({ ...e, fields: JSON.parse(e.fields_json) })));
    for (const e of nameEvents) {
      if (!['SHIP', 'STATION'].includes(e.subject_kind) || !['NAME_CHANGED', 'NAME_OBSERVED'].includes(e.event_type) || e.fields.new_name_state !== 'PRESENT' || typeof e.fields.new_name !== 'string') continue;
      // A mismatching seed must never fall back to somebody else's ID code.
      const p = e.subject_seed ? seeds.get(`${e.subject_kind}:${e.subject_seed}`) : e.subject_idcode ? codes.get(`${e.subject_kind}:${e.subject_idcode}`) : references.get(`${e.run_id}:${e.subject_kind}:${e.subject_reference}`);
      if (!p || position.get(e.run_id) < position.get(p.run_id) || (e.run_id === p.run_id && e.record_id <= p.record_id)) continue;
      p.fields.name = { value: e.fields.new_name, state: 'PRESENT', type: 'string' };
      p.name_observation = { run_id: e.run_id, record_id: e.record_id, game_time: e.game_time, event_type: e.event_type };
    }
    return profiles;
  }
}
