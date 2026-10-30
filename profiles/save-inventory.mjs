import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { SaxesParser } from 'saxes';
import { checkPath } from '../bridge/src/session-path.js';
import { readOnlyInput, availability, sameSnapshot, checkAvailabilityPaths } from './inventory-path.mjs';

// Only a positively identified different XML root is discounted. Malformed,
// ambiguous or long headers remain candidates and fail closed in inspectSave.
export function isSaveCandidate(file){
  const info=checkPath(file),fd=fs.openSync(file,'r'),buf=Buffer.alloc(4096);let root;
  try{
    const n=fs.readSync(fd,buf,0,buf.length,0);
    if(buf[0]===31&&buf[1]===139)return true;
    const parser=new SaxesParser({xmlns:true}),stop=Error('ROOT_FOUND');
    parser.on('opentag',node=>{root=node.local;throw stop;});parser.on('doctype',()=>{throw Error('DTD');});
    try{parser.write(buf.subarray(0,n).toString('utf8'));}catch(e){if(e!==stop)return true;}
    if(!sameSnapshot(info,fs.fstatSync(fd))||!sameSnapshot(info,checkPath(file)))throw Error('INPUT_CHANGED');
    return !root||root==='savegame';
  }finally{fs.closeSync(fd);}
}

export function discoverSaveInputs(locations,{onProgress=()=>{},getAvailability=availability,maxEntries=1000000,now=Date.now,maxMilliseconds=Infinity}={}){
  const queue=locations.map((folder,i)=>({file:path.resolve(folder),location:'location-'+(i+1),relative:''})),seen=new Set(),directories=[],files=[];let entries=0;const started=now();
  const progress=()=>{onProgress({stage:'FOLDERS',completed:entries,total:null});if(now()-started>=maxMilliseconds)throw Error('SAVE_SCOPE_TOO_BROAD');};
  let head=0;
  while(head<queue.length){
    progress();const batch=[];
    while(head<queue.length&&batch.length<32){const d=queue[head++],key=process.platform==='win32'?d.file.toLowerCase():d.file;if(!seen.has(key)){seen.add(key);batch.push(d);}}
    checkAvailabilityPaths(batch.map(d=>d.file),getAvailability);
    for(const dir of batch){
      checkPath(dir.file,{directory:true});const items=fs.readdirSync(dir.file,{withFileTypes:true});
      directories.push({...dir,listing:items.map(i=>i.name).sort()});
      for(const item of items){
        if(++entries>maxEntries)throw Error('SAVE_SCOPE_TOO_BROAD');progress();
        const file=path.join(dir.file,item.name),relative=dir.relative?dir.relative+'/'+item.name:item.name;
        if(item.isDirectory())queue.push({...dir,file,relative});
        else if(item.isSymbolicLink()){const error=Error('LINKED_SAVE_SUBFOLDER');error.input=file;throw error;}
        else if(/\.xml(?:\.gz)?$/i.test(item.name))files.push({file,relative,location:dir.location});
      }
    }
  }
  const candidates=[];
  onProgress({stage:'XML_HEADERS',completed:0,total:files.length});
  for(let i=0;i<files.length;i+=32){const batch=files.slice(i,i+32);checkAvailabilityPaths(batch.map(f=>f.file),getAvailability);for(const f of batch)if(isSaveCandidate(f.file))candidates.push(f);onProgress({stage:'XML_HEADERS',completed:i+batch.length,total:files.length});}
  return {files:candidates,directories};
}

export async function inspectSave(file, { getAvailability = availability, maxBytes = 8 * 1024 ** 3,
  maxRefs = 2000000, maxDepth = 256, timeout = 600000, heapMb = 256, beforeVerify } = {}) {
  const name = path.basename(file); let input, worker;
  try {
    if (![maxBytes, maxRefs, maxDepth, timeout, heapMb].every(n => Number.isSafeInteger(n) && n > 0)) throw Error('INVALID_RESOURCE_LIMIT');
    input = readOnlyInput(file, getAvailability);
    const h = Buffer.alloc(2); fs.readSync(input.fd, h, 0, 2, 0);
    const gzip = h[0] === 31 && h[1] === 139;
    if (name.endsWith('.gz') && !gzip) throw Error('UNSUPPORTED_CONTAINER');
    const result = await new Promise(resolve => {
      let message, finished = false;
      const done = result => { if (!finished) { finished = true; clearTimeout(timer); resolve(result); } };
      worker = new Worker(new URL('./save-scan-worker.mjs', import.meta.url), {
        workerData: { file, info: input.info, gzip, maxBytes, maxRefs, maxDepth }, resourceLimits: { maxOldGenerationSizeMb: heapMb }, execArgv: []
      });
      const timer = setTimeout(() => { worker.terminate().then(() => done({ status: 'UNKNOWN', code: 'RESOURCE_LIMIT' })); }, timeout);
      worker.on('message', m => { message = m; });
      worker.on('error', () => { message = { status: 'UNKNOWN', code: 'WORKER_RESOURCE_OR_PARSE_FAILURE' }; });
      worker.on('exit', code => done(code === 0 && message ? message : { status: 'UNKNOWN', code: message?.code || 'WORKER_FAILED' }));
    });
    await beforeVerify?.(file);
    if (!sameSnapshot(input.info, fs.fstatSync(input.fd)) || !sameSnapshot(input.info, checkPath(file))) throw Error('INPUT_CHANGED');
    if (getAvailability(file) !== 'LOCAL_METADATA_ONLY') throw Error('INPUT_AVAILABILITY_CHANGED');
    return { name, bytes: input.info.size, modifiedUtc: new Date(input.info.mtimeMs).toISOString(), ...result };
  } catch (e) { return { name, status: 'UNKNOWN', code: /^[A-Z_]+$/.test(e.message) ? e.message : 'UNREADABLE_OR_UNSAFE_SAVE' }; }
  finally { if (worker) await worker.terminate(); if (input) fs.closeSync(input.fd); }
}

export async function inventorySaves(locations, options = {}) {
  const output = { mode: 'READ_ONLY_PREVIEW', coverage: 'DECLARED_LOCATIONS_ONLY', atomicInventory: false,
    complete: true, locations: [], saves: [], roots: [], unknowns: [], warnings: ['External/unregistered saves are outside this inventory.', 'Inventory does not modify saves or databases.'] };
  const getAvailability = options.getAvailability || availability;
  let checked = 0;
  options.onProgress?.({ stage: 'SAVES', completed: 0, total: null });
  if (!Array.isArray(locations) || !locations.length) { output.complete = false; output.unknowns.push({ code: 'NO_DECLARED_SAVE_LOCATIONS' }); return output; }
  const observations=[],seenRoots=new Set();
  output.locations=locations.map((folder,i)=>({label:'location-'+(i+1),path:path.resolve(folder)}));
  // Keep each root independent: a failed archive does not erase known native
  // checkpoints, but still blocks every destructive conclusion.
  for(const [i,folder] of locations.entries()){
    const key=path.resolve(folder);if(seenRoots.has(key))continue;seenRoots.add(key);
    const label='location-'+(i+1);
    try{
      const discovered=discoverSaveInputs([folder],{...options,getAvailability,onProgress:options.onProgress});
      observations.push(...discovered.directories.map(d=>({file:d.file,listing:d.listing})));
      for(const input of discovered.files){
        const info=checkPath(input.file);observations.push({file:input.file,info});
        const entry=await inspectSave(input.file,{...options,getAvailability});
        entry.source=label+'/'+input.relative;output.saves.push(entry);
        options.onProgress?.({stage:'SAVES',completed:++checked,total:null});
        if(entry.status==='CHECKPOINT')output.roots.push({...entry.root,source:entry.source});
        if(entry.status==='UNKNOWN')output.unknowns.push({source:entry.source,universe:entry.universe,code:entry.code});
      }
    }catch(e){output.complete=false;output.unknowns.push({source:label,code:/^[A-Z_]+$/.test(e.message)?e.message:'UNREADABLE_SAVE_LOCATION'});}
  }
  // A later scan may outlast a change to an earlier file/location. Recheck all
  // metadata/listings before publishing; this is still not an atomic snapshot.
  let rechecked = 0;
  options.onProgress?.({ stage: 'SAVE_RECHECK', completed: 0, total: observations.length });
  try{checkAvailabilityPaths(observations.map(o=>o.file),getAvailability);}catch{output.complete=false;output.unknowns.push({code:'INVENTORY_CHANGED'});}
  for (const o of observations) {
    try {
      if (o.listing ? JSON.stringify(o.listing) !== JSON.stringify(fs.readdirSync(o.file).sort()) : !sameSnapshot(o.info, checkPath(o.file))) throw Error('INVENTORY_CHANGED');
      options.onProgress?.({ stage: 'SAVE_RECHECK', completed: ++rechecked, total: observations.length });
    } catch { output.complete = false; output.unknowns.push({ code: 'INVENTORY_CHANGED' }); break; }
  }
  output.saves.sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0);
  output.roots.sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0);
  output.manifestDigest = createHash('sha256').update(JSON.stringify(output)).digest('hex');
  return output;
}
