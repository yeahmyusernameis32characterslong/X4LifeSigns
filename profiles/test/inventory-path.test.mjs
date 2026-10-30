import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { availability, availabilityMany, checkAvailability, metadataAvailability } from '../inventory-path.mjs';
function temp(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-metadata-'));
 t.after(()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true});});return dir;
}
test('batched Windows attributes preserve provider/reparse and unknown failures without path interpolation or cached observations',()=>{
 const paths=['C:/ordinary', 'C:/a "quote" $(must-not-run) & name', 'C:/missing'];let calls=0;
 const execute=(exe,args,options)=>{
  calls++;assert.equal(exe,'powershell.exe');
  if(args.includes('-ProbeAvailability')){assert.deepEqual(JSON.parse(options.env.LIFESIGNS_INVENTORY_ATTRIBUTE_PATHS),[paths[1]]);return '[null]';}
  assert.deepEqual(JSON.parse(options.env.LIFESIGNS_INVENTORY_ATTRIBUTE_PATHS),paths);
  assert.ok(!args.at(-1).includes(paths[1]));assert.equal(options.windowsHide,true);assert.equal(options.timeout,10000);
  return calls===1?'[32,1024,null]':'[4096,262144,4194304]';
 };
 assert.deepEqual(availabilityMany(paths,{platform:'win32',execute}),['LOCAL_METADATA_ONLY','PROVIDER_OR_REPARSE','UNKNOWN']);
 assert.deepEqual(availabilityMany(paths,{platform:'win32',execute}),Array(3).fill('PROVIDER_OR_REPARSE'));assert.equal(calls,3);
 for(const value of ['null','[32]','[32,32,"32"]','[32,32,1.5]','[32,32,4294967296]','bad-json']) {
  const result=availabilityMany(paths,{platform:'win32',execute:()=>value});assert.ok(result.includes('UNKNOWN'));
 }
 assert.deepEqual(availabilityMany(paths,{platform:'win32',execute:()=>{throw Error('timeout');}}),Array(3).fill('UNKNOWN'));
 const seen=[];const file=path.resolve('ordinary','save.xml');checkAvailability(file,p=>{seen.push(p);return 'LOCAL_METADATA_ONLY';});
 assert.equal(seen[0],file);assert.equal(seen.at(-1),path.parse(file).root);
 assert.throws(()=>checkAvailability(file,p=>p===seen[1]?'PROVIDER_OR_REPARSE':'LOCAL_METADATA_ONLY'));
});

test('cloud metadata permits only recognised fully resident placeholders, never pinning intent or partial data',()=>{
 const attrs=1056,tag=0x9000001a;
 for(const state of [9,13])assert.equal(metadataAvailability(attrs,[attrs,tag,state]),'LOCAL_METADATA_ONLY');
 for(const state of [0,2,16,17,33,49,0xffffffff])assert.equal(metadataAvailability(attrs,[attrs,tag,state]),'PROVIDER_OR_REPARSE');
 for(const flag of [0x1000,0x40000,0x400000])assert.equal(metadataAvailability(attrs|flag,[attrs|flag,tag,9]),'PROVIDER_OR_REPARSE');
 for(const row of [null,[attrs,0xa000000c,9],[attrs,tag,9.5],[attrs+1,tag,9],[attrs,tag,-1]])assert.equal(metadataAvailability(attrs,row),'PROVIDER_OR_REPARSE');
 assert.equal(metadataAvailability(attrs|0x80000),'PROVIDER_OR_REPARSE');
 assert.equal(metadataAvailability(32),'LOCAL_METADATA_ONLY');
 assert.equal(metadataAvailability(null),'UNKNOWN');
 const result=availabilityMany(['cloud'],{platform:'win32',execute:(_exe,args)=>args.includes('-ProbeAvailability')?'[[1056,2415919130,9]]':'[1056]'});
 assert.deepEqual(result,['LOCAL_METADATA_ONLY']);
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
