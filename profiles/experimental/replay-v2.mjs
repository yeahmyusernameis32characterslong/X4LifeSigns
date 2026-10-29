// Offline disposable-copy adapter. Production ProfileStore remains schema v1.
import { ProfileStore } from '../store.mjs';
import { runId, ordinal, universeId } from '../profile-schema.mjs';
import { checkPath, checkSidecars, sameFile } from '../../bridge/src/session-path.js';
import { acquireLease, assertReady, openLab, openRegisteredV2 } from './maintenance-v2.mjs';

const fail = code => { throw Error(code); };
export class ReplayV2 {
  constructor(lab,id,run) {
    lab=openLab(lab.receipt);this.lab=lab;this.id=universeId(id);this.run=runId(run);this.lease=acquireLease(lab);
    try {Object.assign(this,openRegisteredV2(lab,id,this.lease));this.final=this.file;this.newBaseline=false;this.activeProfile=null;}
    catch(e){this.lease.close();throw e;}
  }
  guard() {
    this.lease.guard();
    // assertReady reads file headers on separate descriptors. On POSIX, closing
    // those during an SQLite transaction can release this process's locks.
    if(!this.ingesting)assertReady(this.lab);
    if(!sameFile(this.info,checkPath(this.file)))fail('DATABASE_REPLACED');checkSidecars(this.file);
  }
  close() {if(this.db?.isOpen)this.db.close();this.lease.close();}
  disposition(run=this.run) {return this.db.prepare('SELECT cutoff FROM sealed_runs WHERE run_id=?').get(runId(run));}
  status() {
    this.guard();const seal=this.disposition();
    if(seal)return {state:seal.cutoff?'SEALED':'RETIRED',retainedCutoff:seal.cutoff};
    if(!this.db.prepare('SELECT 1 FROM sessions WHERE run_id=?').get(this.run))return {state:'NEED_CHILD',record:0};
    return ProfileStore.prototype.status.call(this);
  }
  append(rows) {
    this.guard();if(this.disposition())fail('SEALED_RUN');if(!Array.isArray(rows)||!rows.length)fail('EMPTY_BATCH');
    let result;this.ingesting=true;
    try{result=ProfileStore.prototype.ingest.call(this,rows);}finally{this.ingesting=false;}
    this.guard();return result;
  }
  replay(rows) {
    this.guard();const seal=this.disposition();if(!seal)fail('NOT_A_SEALED_RUN');
    let retained=0,archived=0;
    for(const row of rows) {
      if(row.run!==this.run)fail('RUN_MISMATCH');const n=ordinal(row.fields.record);if(!n)fail('INVALID_ORDINAL');
      if(n>seal.cutoff){archived++;continue;}
      const prior=this.db.prepare('SELECT payload FROM records WHERE run_id=? AND record_id=?').get(this.run,n);
      if(!prior || prior.payload!==JSON.stringify(row))fail('CONFLICTING_RETAINED_REPLAY');retained++;
    }
    // No READY or later ACK cursor. The consumer must handle this terminal
    // classification separately; it must never feed archived rows to append.
    return {state:seal.cutoff?'SEALED_REPLAY':'RETIRED_REPLAY',retainedCutoff:seal.cutoff,retained,archived};
  }
  ancestry(run=this.run,record=Number.MAX_SAFE_INTEGER) {
    this.guard();runId(run);ordinal(record);const chain=[],seen=new Set();
    for(let cursor=run,limit=record;cursor;) {
      if(seen.has(cursor))fail('ANCESTRY_CYCLE');seen.add(cursor);
      const seal=this.disposition(cursor);if(seal?.cutoff===0)fail('RETIRED_PARENT');
      const s=this.db.prepare('SELECT * FROM sessions WHERE run_id=?').get(cursor);
      if(!s)fail('MISSING_PARENT');
      const head=this.db.prepare('SELECT coalesce(max(record_id),0) n FROM records WHERE run_id=?').get(cursor).n;
      const ceiling=seal?seal.cutoff:head;
      if(limit===Number.MAX_SAFE_INTEGER && cursor===run)limit=ceiling;
      if(!limit || limit>ceiling)fail('PARENT_BEYOND_RETAINED_CUTOFF');
      chain.push({run:cursor,limit});cursor=s.parent_run;limit=s.parent_record;
    }
    return chain;
  }
  eventsAt(...args) {return ProfileStore.prototype.eventsAt.apply(this,args);}
  profilesAt(...args) {return ProfileStore.prototype.profilesAt.apply(this,args);}
  historyForNpc(...args) {return ProfileStore.prototype.historyForNpc.apply(this,args);}
}
