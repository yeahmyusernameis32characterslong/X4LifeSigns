import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fileHash,readJson} from '../production-contract.mjs';

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ls-large-hash-'));
  t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});});
  return name=>path.join(root,name);
}
test('streamed hash supports a real file beyond 4 GiB with one fixed buffer and exact independent digest',{timeout:120000},t=>{
  const file=fixture(t)('large.bin');
  const expected=execFileSync('python',[fileURLToPath(new URL('./sparse-hash-fixture.py',import.meta.url)),file],{encoding:'utf8',timeout:90000,windowsHide:true}).trim();
  assert.equal(fs.statSync(file).size,4*1024**3+131);
  const buffers=new Set(),original=fs.readSync;let bytes=0;
  const read=t.mock.method(fs,'readSync',function(fd,buffer,...args){
    assert.equal(buffer.length,1024**2);buffers.add(buffer);
    const count=original.call(fs,fd,buffer,...args);bytes+=count;return count;
  });
  try{assert.equal(fileHash(file),expected);}finally{read.mock.restore();}
  assert.equal(bytes,fs.statSync(file).size);assert.equal(buffers.size,1);
});
test('empty and ordinary hashes stay compatible; changing input fails and read errors close descriptors',t=>{
  const file=fixture(t)('small.bin');fs.writeFileSync(file,'');assert.equal(fileHash(file),createHash('sha256').digest('hex'));
  fs.writeFileSync(file,'unchanged');assert.equal(fileHash(file),createHash('sha256').update('unchanged').digest('hex'));
  const original=fs.readSync;let changed=false;
  const read=t.mock.method(fs,'readSync',function(...args){const n=original.apply(fs,args);if(!changed){changed=true;fs.appendFileSync(file,'changed');}return n;});
  try{assert.throws(()=>fileHash(file),/FILE_CHANGED/);}finally{read.mock.restore();}
  const bad=t.mock.method(fs,'readSync',()=>{throw Error('INJECTED_READ_FAILURE');});
  const close=t.mock.method(fs,'closeSync');
  try{assert.throws(()=>fileHash(file),/INJECTED_READ_FAILURE/);assert.equal(close.mock.callCount(),1);}finally{bad.mock.restore();close.mock.restore();}
});
test('registration JSON keeps its separate bounded parsing guard',t=>{
  const file=fixture(t)('large.json');fs.writeFileSync(file,Buffer.alloc(4*1024**2+1,32));
  assert.throws(()=>readJson(file),/REGISTRATION_TOO_LARGE/);
});
test('a pathname replacement cannot silently return the old file digest',t=>{
  const target=fixture(t)('replace.bin'),old=target+'.old';fs.writeFileSync(target,'same');
  const original=fs.readSync;let replaced=false;
  const read=t.mock.method(fs,'readSync',function(...args){const n=original.apply(fs,args);if(!replaced){replaced=true;fs.renameSync(target,old);fs.writeFileSync(target,'same');}return n;});
  try{assert.throws(()=>fileHash(target),/FILE_CHANGED/);}finally{read.mock.restore();}
});
