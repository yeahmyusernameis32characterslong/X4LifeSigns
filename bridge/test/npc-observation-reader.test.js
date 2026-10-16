import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,appendFileSync,existsSync,rmSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createCapture,createObservationReader,parseProbeLine,LOG_DIRECTORY} from '../src/read-npc-observation.js';

const key='s1-2026-10-08_12-30-00-0-1-2-2147483647';
const other='s1-2026-10-08_12-30-00-0-1-2-2147483646';
const marker='LIFESIGNS_NPC_OBS_V1';
const line=(type,fields)=>`${marker}|${type}|${Object.entries(fields).map(([k,v])=>`${k}=${v}`).join('|')}|END`;
const prefix=value=>`[General] 12.3 ${value}`;
const begin=(session=key,seq=1)=>line('batch',{session,seq,trigger:'OBSERVER_DOCK',phase:'begin'});
const end=(session=key,seq=1,records=7)=>line('batch',{session,seq,trigger:'OBSERVER_DOCK',phase:'end',records});
const anchor=(session=key,seq=1)=>line('anchor',{session,seq,ref:'PRESENT',component_seed_text:'123',role:'service',post:'aipilot',roleobject:'A',assignedcontrolled:'A',container:'A',temporary:'0',in_transit:'0',transfer_scheduled:'0',seed_render:'UNVERIFIED'});
const context=(object,session=key,seq=1)=>line('context',{session,seq,object,object_ref:'PRESENT',template:'RAW_TEMPLATE',entry:'ABSENT',entry_seed_text:'UNAVAILABLE',entry_role:'UNAVAILABLE',instance:'UNAVAILABLE',instance_equal_original:'UNKNOWN',seed_render:'UNVERIFIED'});
const post=(object,session=key,seq=1)=>line('post',{session,seq,object,object_ref:'PRESENT',post:'aipilot',occupant:'PRESENT',occupant_equal_original:'NO',occupant_seed_text:'234',occupant_role:'service',seed_render:'UNVERIFIED'});
const batch=(session=key,seq=1)=>[begin(session,seq),anchor(session,seq),...['A','B','S'].map(x=>context(x,session,seq)),...['A','B','S'].map(x=>post(x,session,seq)),end(session,seq)];
const enrolment=line('enrolment',{complete:1,reason:'COMPLETE',ship_a_matches:1,ship_b_matches:1,station_matches:1});

function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'npc-observation-reader-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const log=join(root,'debuglog.txt'),directory=join(root,'local-data/npc-observation/logs');
  writeFileSync(log,'existing debug history\n');
  return {root,log,directory,session:(session=key)=>join(directory,`${session}.log`)};
}
const append=(log,lines)=>appendFileSync(log,lines.map(prefix).join('\n')+'\n');

test('filters unrelated debug output and keeps complete original probe lines in order',async t=>{
  const f=fixture(t),reader=await createObservationReader(f.log,{directory:f.directory});
  const rows=batch();
  appendFileSync(f.log,'ordinary chatter\nLIFESIGNS_BRIDGE_V2|not-this-probe\n');
  append(f.log,rows);
  const debugBytes=readFileSync(f.log);
  await reader.poll();reader.close();
  assert.deepEqual(readFileSync(f.log),debugBytes);
  assert.equal(readFileSync(f.session(),'utf8'),rows.map(prefix).join('\n')+'\n');
  assert.equal(existsSync(join(f.directory,'ordinary chatter.log')),false);
});

test('reader restart appends same session and routes another canonical session separately',async t=>{
  const f=fixture(t),first=await createObservationReader(f.log,{directory:f.directory});
  append(f.log,batch(key,1));await first.poll();first.close();
  const second=await createObservationReader(f.log,{directory:f.directory});
  append(f.log,[...batch(key,2),...batch(other,1)]);await second.poll();second.close();
  assert.equal(readFileSync(f.session(),'utf8'),[...batch(key,1),...batch(key,2)].map(prefix).join('\n')+'\n');
  assert.equal(readFileSync(f.session(other),'utf8'),batch(other,1).map(prefix).join('\n')+'\n');
  assert.notEqual(first.runPath,second.runPath);
});

test('rejects unsafe sessions and malformed rows without creating filenames from record text',async t=>{
  const f=fixture(t),warnings=[];
  const reader=await createObservationReader(f.log,{directory:f.directory,onWarning:x=>warnings.push(x)});
  const unsafe=begin('../escape'),invalid=anchor().replace('|ref=PRESENT|','|'),badType=`${marker}|fiction|session=${key}|seq=1|END`;
  append(f.log,[unsafe,invalid,badType]);await reader.poll();reader.close();
  const run=readFileSync(reader.runPath,'utf8');
  for(const raw of [unsafe,invalid,badType])assert.ok(run.includes(prefix(raw)));
  assert.match(run,/UNSAFE_SESSION/);assert.match(run,/MALFORMED_RECORD/);
  assert.ok(warnings.some(x=>x.includes('UNSAFE_SESSION')));
  assert.equal(existsSync(f.session()),false);
  assert.equal(existsSync(join(f.root,'escape.log')),false);
});

test('keeps enrolment and unavailable-session rows in a separate reader-run file',async t=>{
  const f=fixture(t),reader=await createObservationReader(f.log,{directory:f.directory});
  const unavailable=[begin('UNAVAILABLE'),end('UNAVAILABLE',1,0)];
  append(f.log,[enrolment,...unavailable]);await reader.poll();reader.close();
  const run=readFileSync(reader.runPath,'utf8');
  for(const raw of [enrolment,...unavailable])assert.ok(run.includes(prefix(raw)));
  assert.match(run,/ENROLMENT_NO_SESSION/);
  assert.match(run,/SESSION_UNAVAILABLE.*correlation limited/);
  assert.equal(existsSync(f.session()),false);
  assert.equal(existsSync(join(f.directory,'UNAVAILABLE.log')),false);
});

test('write failure propagates and never announces or counts a logged batch',t=>{
  const f=fixture(t),announced=[];
  const capture=createCapture({directory:f.directory,onBatch:x=>announced.push(x),
    write:(path,value)=>{
      if(path.endsWith(`${key}.log`))throw Error('synthetic disk write failure');
      appendFileSync(path,value+'\n');
    }});
  assert.throws(()=>capture.accept(parseProbeLine(begin())),/synthetic disk write failure/);
  assert.equal(capture.logged,0);
  assert.deepEqual(announced,[]);
  capture.close();
});

test('failed batch-end flush cannot announce completion',t=>{
  const f=fixture(t),announced=[];
  const capture=createCapture({directory:f.directory,onBatch:x=>announced.push(x),
    write:(path,value,flush)=>{
      appendFileSync(path,value+'\n');
      if(path.endsWith(`${key}.log`)&&flush)throw Error('synthetic flush failure');
    }});
  for(const raw of batch().slice(0,-1))capture.accept(parseProbeLine(raw));
  assert.throws(()=>capture.accept(parseProbeLine(end())),/synthetic flush failure/);
  assert.deepEqual(announced,[]);
  capture.close();
});

test('startup opening failure is nonzero and an output path that is a file is refused',t=>{
  const f=fixture(t),script=fileURLToPath(new URL('../src/read-npc-observation.js',import.meta.url));
  const result=spawnSync(process.execPath,[script,'--log',join(f.root,'missing.txt')],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/NPC observation reader error/);
  mkdirSync(join(f.root,'blocked'));
  const blocked=join(f.root,'blocked/local-data/npc-observation/logs');
  mkdirSync(join(f.root,'blocked/local-data/npc-observation'),{recursive:true});
  writeFileSync(blocked,'not a directory');
  assert.throws(()=>createCapture({directory:blocked}));
});

test('reports incomplete batches at stop, truncation and replacement without inventing rows',async t=>{
  const f=fixture(t),warnings=[];
  const reader=await createObservationReader(f.log,{directory:f.directory,onWarning:x=>warnings.push(x)});
  append(f.log,[begin(),anchor()]);await reader.poll();
  writeFileSync(f.log,'replacement noise\n');await reader.poll();
  assert.ok(warnings.some(x=>x.includes('INCOMPLETE_BATCH')));
  assert.ok(warnings.some(x=>x.includes('truncated/rewritten')));
  append(f.log,[begin(key,2)]);await reader.poll();
  renameSync(f.log,join(f.root,'previous.txt'));
  writeFileSync(f.log,'new file\n');await reader.poll();reader.close();
  const run=readFileSync(reader.runPath,'utf8');
  assert.match(run,/INCOMPLETE_BATCH.*input discontinuity/);
  assert.match(run,/INPUT_WARNING Log replaced\/reappeared/);
  const logged=readFileSync(f.session(),'utf8');
  assert.equal(logged,[begin(),anchor(),begin(key,2)].map(prefix).join('\n')+'\n');
});

test('completed end with too few rows is reported incomplete, not padded',async t=>{
  const f=fixture(t),reader=await createObservationReader(f.log,{directory:f.directory});
  append(f.log,[begin(),anchor(),end()]);await reader.poll();reader.close();
  assert.match(readFileSync(reader.runPath,'utf8'),/INCOMPLETE_BATCH.*expected_rows=7/);
  assert.equal(readFileSync(f.session(),'utf8'),[begin(),anchor(),end()].map(prefix).join('\n')+'\n');
});

test('default output is source-relative even when a process starts elsewhere',t=>{
  const f=fixture(t),moduleUrl=new URL('../src/read-npc-observation.js',import.meta.url);
  const program=`import {createCapture} from ${JSON.stringify(moduleUrl.href)};const x=createCapture();console.log(x.runPath);x.close();`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',program],{cwd:f.root,encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  const path=child.stdout.trim();
  assert.equal(resolve(path).startsWith(LOG_DIRECTORY),true);
  assert.equal(existsSync(path),true);
  rmSync(path);
});
