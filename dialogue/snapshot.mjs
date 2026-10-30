// Offline only. Never register, migrate, repair or construct a writable ProfileStore.
import fs from 'node:fs';
import path from 'node:path';
import {backup} from 'node:sqlite';
import {checkPath,checkSidecars} from '../bridge/src/session-path.js';
import {openDatabase,validateProduction,fileHash,digest} from '../profiles/production-contract.mjs';
import {maintenanceHandles} from '../profiles/maintenance-handles.mjs';

export function inspectSnapshot(binding) {
  if (!binding || binding.version!==1 || !/^[a-f0-9]{64}$/.test(binding.sha256||'')) throw Error('INVALID_SNAPSHOT_BINDING');
  if (binding.entry?.phase!=='READY') throw Error('SNAPSHOT_NOT_READY');
  checkPath(binding.file);checkSidecars(binding.file);
  if (fileHash(binding.file)!==binding.sha256) throw Error('SNAPSHOT_HASH_CHANGED');
  const db=openDatabase(binding.file);
  try {validateProduction(db,binding.universe,binding.rootId,binding.entry);}
  catch(e){db.close();throw e;}
  return db;
}

export async function captureSnapshot({source,destination,universe,entry,rootId=null}) {
  if(entry?.phase!=='READY')throw Error('SOURCE_NOT_READY');
  checkPath(source);checkSidecars(source);checkPath(path.dirname(destination),{directory:true});
  if(fs.existsSync(destination))throw Error('SNAPSHOT_DESTINATION_EXISTS');
  let guard,db;
  const started=performance.now();
  try {
    // Reuse the established Windows exclusion of already-open writable handles.
    if(process.platform==='win32')guard=await maintenanceHandles([source],{inputsOnly:true});
    const before=fileHash(source);db=openDatabase(source);validateProduction(db,universe,rootId,entry);
    const fd=fs.openSync(destination,'wx');fs.closeSync(fd);
    await backup(db,destination);db.close();db=null;guard?.assert();
    if(fileHash(source)!==before)throw Error('SOURCE_CHANGED_DURING_SNAPSHOT');
    const binding={version:1,file:path.resolve(destination),sha256:fileHash(destination),universe,rootId,entry:structuredClone(entry),sourceHash:before};
    const verify=inspectSnapshot(binding);verify.close();
    return {...binding,captureMs:performance.now()-started};
  } finally {db?.close();await guard?.close();}
}

export const snapshotId=b=>digest({version:b.version,sha256:b.sha256,universe:b.universe,rootId:b.rootId,entry:b.entry});
