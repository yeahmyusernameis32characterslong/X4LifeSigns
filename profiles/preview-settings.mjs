import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { checkPath } from '../bridge/src/session-path.js';
import { universeId } from './profile-schema.mjs';
import {checkAvailability} from './inventory-path.mjs';
export const SETTINGS_NAME = 'housekeeping-preview-v1.json';
export function validateSettings(value) {
  if (!value || Object.keys(value).sort().join() !== 'owner,protectedUniverses,saveLocations,version' || value.owner !== 'LifeSignsReadOnlyPreview' || value.version !== 1 || !Array.isArray(value.saveLocations) || value.saveLocations.length > 17 || !Array.isArray(value.protectedUniverses) || value.protectedUniverses.length > 1024) throw Error('Invalid preview settings');
  for (const p of value.saveLocations) if (typeof p !== 'string' || p.length > 1024 || /[\x00-\x1f]/.test(p) || !path.isAbsolute(p) || /^\\\\/.test(p) || p.startsWith('//')) throw Error('Invalid local save location');
  value.protectedUniverses.forEach(universeId);
  if (new Set(value.saveLocations).size !== value.saveLocations.length || new Set(value.protectedUniverses).size !== value.protectedUniverses.length) throw Error('Duplicate preview settings');
  return value;
}
export function readSettings(root) {
  const file = path.join(root,'local-data',SETTINGS_NAME);
  const info = checkPath(file,{missing:true});
  if (!info) return { value:{owner:'LifeSignsReadOnlyPreview',version:1,saveLocations:[],protectedUniverses:[]}, digest:'MISSING' };
  if (info.size > 256 * 1024) throw Error('Oversized preview settings');
  const text = fs.readFileSync(file,'utf8');
  return { value:validateSettings(JSON.parse(text)),digest:createHash('sha256').update(text).digest('hex') };
}
export function setProtection(root, expected, universe, enabled) {
  universeId(universe);const before=readSettings(root);if (before.digest !== expected) throw Error('Preview settings changed');
  const protectedUniverses = new Set(before.value.protectedUniverses);
  if (enabled) protectedUniverses.add(universe);else protectedUniverses.delete(universe);
  const value=validateSettings({...before.value,protectedUniverses:[...protectedUniverses].sort()});
  const dir=path.join(root,'local-data');checkPath(dir,{directory:true});const file=path.join(dir,SETTINGS_NAME),temp=file+'.'+randomUUID()+'.tmp';
  const fd=fs.openSync(temp,'wx');
  try {fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try { if (readSettings(root).digest !== expected) throw Error('Preview settings changed');checkPath(file,{missing:true});fs.renameSync(temp,file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  return readSettings(root);
}

export function normaliseLocations(locations) {
  const seen=new Set();return locations.map(p=>path.resolve(p)).filter(p=>{const key=process.platform==='win32'?p.toLowerCase():p;if(seen.has(key))return false;seen.add(key);return true;});
}
// nativeDirectory comes from the running installation's trusted load-control
// configuration, never from the menu request or a guessed Windows profile.
export function readMenuSettings(root,nativeDirectory=null) {
  const settings=readSettings(root);if(!nativeDirectory)return settings;
  if(!path.isAbsolute(nativeDirectory))throw Error('NATIVE_SAVE_DETECTION_FAILED');
  return {...settings,value:{...settings.value,saveLocations:normaliseLocations([nativeDirectory,...settings.value.saveLocations])}};
}
export function changeLocation(root,expected,nativeDirectory,{add=null,remove=null}={}) {
  if(!nativeDirectory)throw Error('NATIVE_SAVE_DETECTION_FAILED');
  const before=readMenuSettings(root,nativeDirectory);if(before.digest!==expected)throw Error('SETTINGS_CHANGED');
  let locations=before.value.saveLocations;
  if(add!==null){
    if(typeof add!=='string'||!add.trim()||Buffer.byteLength(add)>1024||/[\x00-\x1f\x7f]/.test(add)||!path.isAbsolute(add)||/^\\\\|^\/\//.test(add))throw Error('INVALID_LOCAL_FOLDER');
    add=path.resolve(add);checkAvailability(add);checkPath(add,{directory:true});locations=normaliseLocations([...locations,add]);
  }else{
    if(!Number.isInteger(remove)||remove<1||remove>=locations.length)throw Error('NATIVE_LOCATION_CANNOT_BE_REMOVED');
    locations=locations.filter((_,i)=>i!==remove);
  }
  const value=validateSettings({...before.value,saveLocations:locations}),file=path.join(root,'local-data',SETTINGS_NAME),temp=file+'.'+randomUUID()+'.tmp';
  checkPath(file);const fd=fs.openSync(temp,'wx');try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try{if(readSettings(root).digest!==expected)throw Error('SETTINGS_CHANGED');checkPath(file);fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return readMenuSettings(root,nativeDirectory);
}
