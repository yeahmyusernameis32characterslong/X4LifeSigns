import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { availability, availabilityMany, checkAvailability } from '../inventory-path.mjs';
function temp(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-metadata-'));
 t.after(()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true});});return dir;
}
test('batched Windows attributes preserve provider/reparse and unknown failures without path interpolation or cached observations',()=>{
 const paths=['C:/ordinary', 'C:/a "quote" $(must-not-run) & name', 'C:/missing'];let calls=0;
 const execute=(exe,args,options)=>{
  calls++;assert.equal(exe,'powershell.exe');assert.deepEqual(JSON.parse(options.env.LIFESIGNS_INVENTORY_ATTRIBUTE_PATHS),paths);
  assert.ok(!args.at(-1).includes(paths[1]));assert.equal(options.windowsHide,true);assert.equal(options.timeout,10000);
  return calls===1?'[32,1024,null]':'[4096,262144,4194304]';
 };
 assert.deepEqual(availabilityMany(paths,{platform:'win32',execute}),['LOCAL_METADATA_ONLY','PROVIDER_OR_REPARSE','UNKNOWN']);
 assert.deepEqual(availabilityMany(paths,{platform:'win32',execute}),Array(3).fill('PROVIDER_OR_REPARSE'));assert.equal(calls,2);
 for(const value of ['null','[32]','[32,32,"32"]','[32,32,1.5]','[32,32,4294967296]','bad-json']) {
  const result=availabilityMany(paths,{platform:'win32',execute:()=>value});assert.ok(result.includes('UNKNOWN'));
 }
 assert.deepEqual(availabilityMany(paths,{platform:'win32',execute:()=>{throw Error('timeout');}}),Array(3).fill('UNKNOWN'));
 const seen=[];const file=path.resolve('ordinary','save.xml');checkAvailability(file,p=>{seen.push(p);return 'LOCAL_METADATA_ONLY';});
 assert.equal(seen[0],file);assert.equal(seen.at(-1),path.parse(file).root);
 assert.throws(()=>checkAvailability(file,p=>p===seen[1]?'PROVIDER_OR_REPARSE':'LOCAL_METADATA_ONLY'));
});

test('real Windows batch metadata agrees with individual probes and rechecks fresh ancestor attributes',{skip:process.platform!=='win32'},t=>{
 const dir=temp(t);
 // Windows forbids quotes in filenames: special shell syntax is exercised by
 // the fake transport test above; this actual file still includes $() and &.
 const actual=path.join(dir,'literal $(not-a-command) & data.xml');fs.writeFileSync(actual,'read-only fixture');
 const paths=[actual,dir,path.parse(dir).root,path.join(dir,'absent')];
 assert.deepEqual(availabilityMany(paths),paths.map(availability));
 assert.deepEqual(availabilityMany([actual]),['LOCAL_METADATA_ONLY']);
 assert.deepEqual(availabilityMany([path.join(dir,'absent')]),['UNKNOWN']);
 checkAvailability(actual);fs.unlinkSync(actual);assert.throws(()=>checkAvailability(actual));
});
