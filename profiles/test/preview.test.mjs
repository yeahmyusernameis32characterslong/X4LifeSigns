import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { PreviewService } from '../preview-service.mjs';
import { PREVIEW_HELLO,PREVIEW_REPLY,parsePreviewRequest,previewReply,scanProgressRows } from '../preview-protocol.mjs';
import { previewModel,displaySize,applyProtection } from '../preview-model.mjs';
import { readSettings,setProtection,validateSettings,SETTINGS_NAME } from '../preview-settings.mjs';
import { ProfileStore } from '../store.mjs';
import { startService } from '../service.mjs';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const U='lsu1-2026-10-27_12-00-00-1-2-3-4',G='1'.repeat(32),C='2'.repeat(32),D='3'.repeat(32);
const request=(gen,seq,verb='REFRESH',item=0,enabled=0,page=0,client=C)=>`[x4] LSHK1|${gen}|${client}|${seq}|${verb}|${item}|${enabled}|${page}|END`;
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-preview-')),replies=path.join(root,'replies');fs.mkdirSync(replies);fs.mkdirSync(path.join(root,'local-data'));
 t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});});return {root,replies};
}
const settings={owner:'LifeSignsReadOnlyPreview',version:1,saveLocations:[],protectedUniverses:[]};
function fake(t) {
 const f=fixture(t),children=[];let clock=0;
 const service=new PreviewService({root:f.root,replyDirectory:f.replies,now:()=>clock,launch:()=>{const child=new EventEmitter();child.send=x=>child.input=x;child.kill=()=>{child.killed=true;queueMicrotask(()=>{child.emit('exit',0);child.emit('close',0);});};children.push(child);return child;}});
 t.after(()=>service.stop());return {...f,service,children,clock:x=>clock=x,text:()=>fs.readFileSync(path.join(f.replies,PREVIEW_REPLY+'.reply'),'utf8')};
}
const model={list:[['1','Universe 1','1','12 bytes','In use']],details:[[['KEEP','History needed by your saves','records','7','']]],ids:[U],locations:[],issues:[]};
test('fixed preview request grammar rejects paths, SQL, destructive verbs and malformed fields',()=>{
 assert.equal(parsePreviewRequest(request(G,1)).verb,'REFRESH');assert.equal(parsePreviewRequest(request(G,2,'PROTECT',1,1)).enabled,true);
 for(const v of [request(G,1,'DELETE'),request(G,0),request(G,1,'DETAIL'),request(G,1,'LIST',1),request(G,1,'REFRESH',0,1),request(G,1)+' junk',request(G,1).replace('REFRESH','../path'),request(G,1).replace('|0|0|0|','|SELECT|0|0|')])assert.equal(parsePreviewRequest(v),null,v);
});
test('bounded pages encode pipes, newlines, Unicode and hostile text as data',()=>{
 const rows=Array.from({length:8},(_,i)=>[String(i),'A|B\n"\\船', 'x'.repeat(500),'\x1bRED','']);const req={client:C,seq:1};
 const p=previewReply(G,req,'READY',rows,2);assert.ok(Buffer.byteLength(p)<4096);const fields=p.trim().split('|');assert.deepEqual(fields.slice(5,9),['READY','2','3','2']);assert.equal(Buffer.from(fields[10],'hex').toString(),'A|B "\\船');assert.ok(!p.includes('RED'));
 assert.throws(()=>previewReply(G,req,'READY',rows,3));assert.throws(()=>previewReply(G,req,'DELETE'));
});
test('ten compact universes fit the native buffer; details retain their wider cells',()=>{
 const rows=Array.from({length:21},(_,i)=>[String(i+1), '船'.repeat(80), 'x'.repeat(200), 'x'.repeat(200), 'x'.repeat(200)]);
 for(const verb of ['REFRESH','LIST']) {
  const req={client:C,seq:999999999,verb};
  const first=previewReply(G,req,'READY',rows,0),last=previewReply(G,req,'READY',rows,2);
  assert.ok(Buffer.byteLength(first)<4096);assert.deepEqual(first.trim().split('|').slice(5,9),['READY','0','3','10']);
  assert.deepEqual(last.trim().split('|').slice(5,9),['READY','2','3','1']);
  assert.equal(Buffer.from(last.trim().split('|')[9],'hex').toString(),'21');
  assert.ok(!Buffer.from(first.trim().split('|')[10],'hex').toString().includes('\ufffd'));
  assert.throws(()=>previewReply(G,req,'READY',rows,3));
 }
 const details=previewReply(G,{client:C,seq:1,verb:'DETAIL'},'READY',rows,0).trim().split('|');
 assert.equal(details[8],'3');assert.equal(Buffer.from(details[11],'hex').length,96);
});
test('database size uses decimal MB/GB in list and details without rounding small files to zero',()=>{
 for(const [input,expected] of [[0,'0 MB'],[1,'<0.01 MB'],[10000,'0.01 MB'],[1000000,'1.00 MB'],[1250000000,'1.25 GB'],[undefined,'Unknown'],[-1,'Unknown'],[NaN,'Unknown'],[Number.MAX_SAFE_INTEGER+1,'Unknown']]) assert.equal(displaySize(input),expected);
 const r={inventory:{complete:true,roots:[],saves:[],unknowns:[]},databases:[{universe:U,status:'PREVIEW_ONLY',bytes:1250000000}],unknowns:[]};
 const m=previewModel(r,settings);assert.equal(m.list[0][3],'1.25 GB');assert.equal(m.details[0].find(r=>r[1]==='Database size')[2],'1.25 GB');assert.equal(r.databases[0].bytes,1250000000);
});
test('model wording distinguishes in-use, uncertain, unmatched and whole-universe protection without guessed dates',()=>{
 const result={inventory:{complete:true,roots:[],saves:[{name:'save.xml',source:'location-1/save.xml',root:{universe:U}}],unknowns:[]},databases:[{universe:U,status:'PREVIEW_ONLY',bytes:12,retained:[{through:7}],candidates:{records:3,profiles:1,events:2,sessions:0},blocks:[]}],unknowns:[]};
 let m=previewModel(result,settings);assert.equal(m.list[0][4],'In use');assert.equal(m.details[0].find(r=>r[0]==='SAVE')[3],'Unknown');
 result.inventory.saves=[];m=previewModel(result,settings);assert.equal(m.list[0][4],'Possibly unused');
 result.inventory.unknowns=[{code:'UNREADABLE_SAVE'}];m=previewModel(result,settings);assert.equal(m.list[0][4],'Needs attention');assert.match(m.list[0][2],/Unknown/);
 m=previewModel(result,{...settings,protectedUniverses:[U]});assert.equal(m.list[0][4],'Protected');
 result.databases.push({file:'foreign.db',universe:null,status:'BLOCKED',blocks:['INVALID_UNIVERSE'],retained:[]});m=previewModel(result,settings);
 const unknown=m.list.findIndex(r=>r[1]==='Unknown database');assert.ok(unknown>=0);assert.equal(m.ids[unknown],null);assert.equal(m.details[unknown][1][2],'Unknown');
});
test('settings validate paths/ownership and persist protection across restart without touching databases',t=>{
 const {root}=fixture(t);let s=readSettings(root);assert.equal(s.digest,'MISSING');s=setProtection(root,s.digest,U,true);assert.deepEqual(readSettings(root).value.protectedUniverses,[U]);
 assert.throws(()=>setProtection(root,'old',U,false));s=setProtection(root,s.digest,U,false);assert.deepEqual(s.value.protectedUniverses,[]);
 for(const v of [{...settings,owner:'foreign'},{...settings,saveLocations:['relative']},{...settings,saveLocations:['\\\\server\\remote']},{...settings,saveLocations:['//server/share']},{...settings,protectedUniverses:['bad']}])assert.throws(()=>validateSettings(v));
 assert.equal(fs.existsSync(path.join(root,'local-data','profiles')),false);
});
test('generation, sequence, client replacement and cancellation fence duplicate/out-of-order/late results',t=>{
 const f=fake(t),s=f.service;assert.equal(s.handle(request(G,1)),false);assert.equal(f.children.length,0);
 s.handle(request(s.gen,1));const child=f.children[0];assert.match(f.text(),/SCANNING/);s.handle(request(s.gen,1));assert.equal(f.children.length,1);
 s.handle(request(s.gen,2,'CANCEL'));assert.equal(child.killed,true);child.emit('message',{model});assert.match(f.text(),/CANCELLED/);
 s.handle(request(s.gen,3));const child2=f.children[1];s.handle(request(s.gen,1,'REFRESH',0,0,0,D));assert.equal(child2.killed,true);child2.emit('message',{model});assert.match(f.text(),new RegExp(D));
});
test('scan results, bad page/selection, missing companion restart and protection use distinct matched replies',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));f.children[0].emit('message',{model});assert.match(f.text(),/READY/);
 s.handle(request(s.gen,2,'DETAIL',1));assert.match(f.text(),/READY/);s.handle(request(s.gen,3,'DETAIL',99));assert.match(f.text(),/ERROR/);
 s.handle(request(s.gen,4,'LIST',0,0,99));assert.match(f.text(),/ERROR/);
 s.handle(request(s.gen,5,'PROTECT',1,1));assert.deepEqual(readSettings(f.root).value.protectedUniverses,[U]);assert.match(f.text(),/READY/);assert.equal(f.children.length,1);
 const old=s.gen;s.stop();const restart=new PreviewService({root:f.root,replyDirectory:f.replies});t.after(()=>restart.stop());assert.notEqual(restart.gen,old);assert.equal(restart.handle(request(old,6)),false);
});
test('external configuration change makes completion stale; worker errors remain preview errors',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));fs.writeFileSync(path.join(f.root,'local-data',SETTINGS_NAME),JSON.stringify(settings));f.children[0].emit('message',{model});assert.match(f.text(),/STALE/);
 s.handle(request(s.gen,2));f.children[1].emit('error',Error('synthetic'));assert.match(f.text(),/ERROR/);
 s.handle(request(s.gen,3,'LOCATIONS'));assert.match(f.text(),/READY/);
});
test('load/world observation cancels scans and disallows later queued requests for this service generation',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));s.suspend();assert.equal(f.children[0].killed,true);assert.match(fs.readFileSync(path.join(f.replies,PREVIEW_HELLO+'.reply'),'utf8'),/INACTIVE/);
 s.handle(request(s.gen,2));assert.equal(f.children.length,1);assert.match(f.text(),/STALE/);
});
test('heartbeat continues independently of the scan, stops on close and never uses profile ACK files',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));const file=path.join(f.replies,PREVIEW_HELLO+'.reply'),a=fs.readFileSync(file,'utf8');f.clock(1100);s.poll();assert.notEqual(fs.readFileSync(file,'utf8'),a);
 assert.deepEqual(fs.readdirSync(f.replies).sort(),[PREVIEW_HELLO+'.reply',PREVIEW_REPLY+'.reply'].sort());s.stop();const last=fs.readFileSync(file,'utf8');f.clock(3000);s.poll();assert.equal(fs.readFileSync(file,'utf8'),last);
});
test('real cancellable scan process reuses Stage 1 on disposable inputs and preserves bytes', {timeout:90000},async t=>{
 const {root,replies}=fixture(t),run='session-1-2-loaded-2026-10-27_12-00-00';const store=new ProfileStore(root,U,run);
 const row=(n,kind,fields={})=>({run,session:'UNAVAILABLE',seq:'1',age:String(n),kind,fields:{record:String(n),...fields}});
 store.ingest([row(1,'RUN_BEGIN',{database_protocol:'LSDB1',lifesigns_universe_id:U,parent_run:'NONE',parent_record:'0'}),row(2,'SNAPSHOT_BEGIN'),row(3,'SNAPSHOT_END',{profiles:'0'})]);const file=store.final;store.close();const before=hash(file);
 const saves=path.join(root,'saves');fs.mkdirSync(saves);fs.writeFileSync(path.join(root,'local-data',SETTINGS_NAME),JSON.stringify({...settings,saveLocations:[saves],protectedUniverses:[U]}));const service=new PreviewService({root,replyDirectory:replies});t.after(()=>service.stop());const launch=service.launch;let launches=0;service.launch=()=>{launches++;return launch();};service.handle(request(service.gen,1));
 const deadline=Date.now()+70000;let reply='';
 while(Date.now()<deadline){service.poll();reply=fs.readFileSync(path.join(replies,PREVIEW_REPLY+'.reply'),'utf8');if(!service.scanning&&reply.includes('|READY|'))break;await new Promise(r=>setTimeout(r,30));}
 assert.equal(service.scanning,false);assert.match(reply,/\|READY\|/);
 const i=service.model.ids.indexOf(U);assert.ok(i>=0);assert.equal(service.model.list[i][4],'Protected');
 service.handle(request(service.gen,2,'PROTECT',i+1,0));assert.equal(service.model.list[i][4],'Possibly unused');
 assert.equal(service.model.details[i].find(r=>r[0]==='TAIL'&&r[2]==='records')[3],'3');assert.equal(launches,1);assert.equal(hash(file),before);
});
test('cancellation terminates a real scan process without replacing its cancelled reply', {timeout:20000},async t=>{
 const {root,replies}=fixture(t),s=new PreviewService({root,replyDirectory:replies});t.after(()=>s.stop());s.handle(request(s.gen,1));const child=s.child;const exited=once(child,'close');s.handle(request(s.gen,2,'CANCEL'));assert.equal(s.hasReaders(),true);await exited;assert.equal(s.hasReaders(),false);
 assert.match(fs.readFileSync(path.join(replies,PREVIEW_REPLY+'.reply'),'utf8'),/CANCELLED/);assert.equal(s.scanning,false);
});
test('service stop waits for its real preview reader before completing drain',{timeout:20000},async t=>{
 const {root,replies}=fixture(t),logs=path.join(root,'logs'),debugLog=path.join(root,'debuglog.txt');fs.mkdirSync(logs);fs.writeFileSync(debugLog,'');
 const service=startService({root,replyDirectory:replies,logDirectory:logs,debugLog,notBefore:0,interval:100000});
 const gen=fs.readFileSync(path.join(replies,PREVIEW_HELLO+'.reply'),'utf8').split('|')[3];fs.appendFileSync(debugLog,request(gen,1)+'\n');service.poll();
 const stopped=service.stop();assert.equal(typeof stopped?.then,'function');await stopped;assert.equal(service.poll(),false);
});
test('real service consumes preview requests from debuglog and load fencing cancels queued work',t=>{
 const {root,replies}=fixture(t),logs=path.join(root,'logs'),debugLog=path.join(root,'debuglog.txt');fs.mkdirSync(logs);fs.writeFileSync(debugLog,'');
 const service=startService({root,replyDirectory:replies,logDirectory:logs,debugLog,notBefore:0,interval:100000});t.after(()=>service.stop({drain:false}));
 const hello=fs.readFileSync(path.join(replies,PREVIEW_HELLO+'.reply'),'utf8'),gen=hello.split('|')[3];fs.appendFileSync(debugLog,request(gen,1)+'\n');service.poll();assert.match(fs.readFileSync(path.join(replies,PREVIEW_REPLY+'.reply'),'utf8'),/SCANNING/);
 const token=fs.readFileSync(path.join(replies,'session-0-1-loaded-2000-01-01_00-00-00.reply'),'utf8').split('|')[4];fs.appendFileSync(debugLog,`LSLOAD1|PREPARE|${token}|END\n`+request(gen,2)+'\n');service.poll();
 assert.match(fs.readFileSync(path.join(replies,PREVIEW_HELLO+'.reply'),'utf8'),/INACTIVE/);assert.equal(fs.existsSync(path.join(root,'local-data','profiles')),false);
});
test('future companion package manifest resolves the complete read-only scan dependency tree on a disposable copy',{timeout:30000},async t=>{
 const repo=fileURLToPath(new URL('../../',import.meta.url)),{root}=fixture(t),manifest=JSON.parse(fs.readFileSync(path.join(repo,'profiles/companion-files.json')));
 for(const relative of manifest.files){assert.ok(!relative.includes('..'));const target=path.join(root,'bundle',relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repo,relative),target);}
 const child=fork(path.join(root,'bundle/profiles/preview-scan-worker.mjs'),[],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true,execArgv:[]});let stderr='';child.stderr.on('data',d=>stderr+=d);const progress=[];let result;child.on('message',m=>{if(m.progress)progress.push(m.progress);else result=m;});const exited=once(child,'exit');child.send({root,settings});await exited;assert.ok(result?.model,JSON.stringify(result)+stderr);assert.ok(progress.length);progress.forEach(scanProgressRows);
 // SAXES is required only by the nested save scanner; verify its shipped runtime files too.
 const {createRequire}=await import('node:module');const require=createRequire(path.join(root,'bundle/profiles/preview-scan-worker.mjs'));assert.equal(typeof require('saxes').SaxesParser,'function');
});

test('scan progress stays scanning, bounded and correlated through cancellation, load fencing and completion',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));const child=f.children[0];
 child.emit('message',{progress:{stage:'SAVES',completed:2,total:null}});
 assert.equal(s.scanning,true);assert.equal(s.child,child);assert.equal(s.model,null);assert.equal(s.hasReaders(),true);
 assert.match(f.text(),/\|SCANNING\|/);assert.ok(f.text().includes(Buffer.from('PROGRESS').toString('hex')));assert.ok(Buffer.byteLength(f.text())<4096);
 const before=f.text();child.emit('message',{progress:{stage:'SAVES',completed:-1,total:null}});assert.equal(f.text(),before);
 child.emit('message',{model});assert.equal(s.scanning,false);assert.match(f.text(),/\|READY\|/);
 child.emit('message',{progress:{stage:'DATABASES',completed:1,total:2}});assert.match(f.text(),/\|READY\|/);
 child.emit('exit',0);child.emit('close',0);assert.equal(s.hasReaders(),false);
 s.handle(request(s.gen,2));const next=f.children[1];s.handle(request(s.gen,3,'CANCEL'));
 next.emit('message',{progress:{stage:'DATABASES',completed:0,total:1}});assert.match(f.text(),/CANCELLED/);
 s.handle(request(s.gen,4));const last=f.children[2];s.suspend();const cancelled=f.text();
 last.emit('message',{progress:{stage:'DATABASES',completed:0,total:1}});assert.equal(f.text(),cancelled);
});

test('progress rows admit fixed stages and numeric counts only, without provisional retention results',()=>{
 for(const progress of [{stage:'SAVES',completed:999999999,total:null},{stage:'DATABASES',completed:2,total:3},{stage:'SAVE_RECHECK',completed:0,total:0},{stage:'DATABASE_RECHECK',completed:3,total:3}]) {
  const rows=scanProgressRows(progress);assert.equal(rows.length,1);
  assert.ok(Buffer.byteLength(previewReply(G,{client:C,seq:1,verb:'REFRESH'},'SCANNING',rows))<4096);
 }
 for(const progress of [null,{stage:'PATH',completed:0,total:0},{stage:'SAVES',completed:0,total:3},{stage:'SAVES',completed:NaN,total:null},{stage:'DATABASES',completed:4,total:3},{stage:'DATABASES',completed:0,total:null},{stage:'SAVE_RECHECK',completed:1000000000,total:1000000000}])assert.throws(()=>scanProgressRows(progress));
});

test('progress alone cannot hide scan failure or stale settings, and old-client updates are fenced',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));const child=f.children[0];
 child.emit('message',{progress:{stage:'SAVES',completed:0,total:null}});child.emit('exit',1);child.emit('close',1);
 assert.match(f.text(),/ERROR/);assert.equal(s.scanning,false);assert.equal(s.hasReaders(),false);
 s.handle(request(s.gen,2));const old=f.children[1];s.handle(request(s.gen,1,'REFRESH',0,0,0,D));
 const current=f.children[2],before=f.text();old.emit('message',{progress:{stage:'DATABASES',completed:0,total:1}});assert.equal(f.text(),before);
 fs.writeFileSync(path.join(f.root,'local-data',SETTINGS_NAME),JSON.stringify(settings));
 current.emit('message',{progress:{stage:'DATABASES',completed:1,total:1}});assert.equal(s.scanning,true);
 current.emit('message',{model});assert.match(f.text(),/STALE/);assert.equal(s.model,null);
});

test('protection overlay restores exact counts and uncertainty without mutating the completed base preview',()=>{
 const result={inventory:{complete:true,roots:[],saves:[{name:'save.xml',source:'location-1/save.xml',root:{universe:U}}],unknowns:[]},databases:[{universe:U,status:'PREVIEW_ONLY',bytes:12,retained:[{through:7}],candidates:{records:3,profiles:1,events:2,sessions:0},blocks:[]}],unknowns:[]};
 for(const uncertain of [false,true]) {
  if(uncertain){result.inventory.unknowns=[{code:'UNREADABLE_SAVE'}];result.databases[0].status='BLOCKED';result.databases[0].candidates=null;}
  const base=previewModel(result,settings),snapshot=JSON.stringify(base),pinned=applyProtection(base,{...settings,protectedUniverses:[U]});
  assert.equal(pinned.list[0][4],'Protected');assert.equal(pinned.details[0].find(r=>r[1]==='Protection')[2],'Protected');
  assert.ok(pinned.details[0].filter(r=>r[0]==='TAIL').every(r=>r[3]==='0'));
  assert.deepEqual(applyProtection(base,settings),base);assert.equal(JSON.stringify(base),snapshot);
  if(uncertain)assert.ok(applyProtection(base,settings).details[0].filter(r=>r[0]==='TAIL').every(r=>r[3]==='Unknown'));
 }
});

test('protect/unprotect and Back list use one completed scan and retain the requested detail page',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));const base={...model,details:[[...model.details[0],['INFO','Protection','Not protected','Whole universe',''],['TAIL','Potentially removable history','records','3',''],['SAVE','File modified (UTC)','save.xml','Unknown','location-1/save.xml']]]};
 f.children[0].emit('message',{model:base});
 s.handle(request(s.gen,2,'PROTECT',1,1,1));assert.match(f.text(),/\|READY\|1\|2\|1\|/);assert.equal(s.model.list[0][4],'Protected');
 s.handle(request(s.gen,3,'CANCEL'));s.handle(request(s.gen,4,'LIST'));assert.match(f.text(),/READY/);assert.equal(f.children.length,1);
 s.handle(request(s.gen,5,'PROTECT',1,0,99));assert.match(f.text(),/ERROR/);assert.deepEqual(readSettings(f.root).value.protectedUniverses,[U]);
 s.handle(request(s.gen,6,'PROTECT',1,0,0));assert.match(f.text(),/READY/);assert.equal(s.model.details[0][2][3],'3');assert.deepEqual(readSettings(f.root).value.protectedUniverses,[]);
 s.handle(request(s.gen,7,'CANCEL'));s.handle(request(s.gen,8,'LIST'));assert.match(f.text(),/READY/);assert.equal(f.children.length,1);
 fs.writeFileSync(path.join(f.root,'local-data',SETTINGS_NAME),JSON.stringify({...settings,saveLocations:[f.root]}));
 s.handle(request(s.gen,9,'PROTECT',1,1));assert.match(f.text(),/STALE/);assert.deepEqual(readSettings(f.root).value.protectedUniverses,[]);
});

test('protection replies use detail budgets, never a compact universe-list page',()=>{
 const rows=Array.from({length:7},()=>['TAIL','Potentially removable history','x'.repeat(100),'1','']);
 const frame=previewReply(G,{client:C,seq:1,verb:'PROTECT'},'READY',rows,1),fields=frame.trim().split('|');
 assert.deepEqual(fields.slice(5,9),['READY','1','3','3']);assert.equal(Buffer.from(fields[11],'hex').length,96);assert.ok(Buffer.byteLength(frame)<4096);
});

test('mutating worker drains after CANCEL/load/stop and exit cannot race its final IPC message',async t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));f.children[0].emit('message',{model});f.children[0].emit('exit',0);f.children[0].emit('close',0);
 s.testMode=true;s.readSettings=()=>readSettings(f.root);s.handle(request(s.gen,2,'REVIEW',1));const review=f.children[1];
 review.emit('message',{action:{plan:{kind:'CLEAN'},token:'x',rows:[]}});review.emit('close',0);s.handle(request(s.gen,3,'APPLY',1,1));const worker=f.children[2];
 assert.equal(s.mutating,true);s.handle(request(s.gen,4,'CANCEL'));assert.equal(worker.killed,undefined);s.suspend();s.stop();assert.equal(worker.killed,undefined);assert.equal(s.hasReaders(),true);
 const before=f.text();worker.emit('exit',0);assert.equal(s.hasReaders(),true);worker.emit('message',{action:{rows:[['RESULT','Done','','','']]}});assert.equal(f.text(),before);worker.emit('close',0);await s.waitForExit();assert.equal(s.hasReaders(),false);
});

test('a final action reply arriving after exit is accepted until close, without a false failure',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));f.children[0].emit('message',{model});f.children[0].emit('exit',0);f.children[0].emit('close',0);s.testMode=true;s.readSettings=()=>readSettings(f.root);
 s.handle(request(s.gen,2,'REVIEW',1));const worker=f.children[1];worker.emit('exit',0);assert.equal(s.hasReaders(),true);assert.match(f.text(),/SCANNING/);
 worker.emit('message',{action:{plan:{kind:'CLEAN'},token:'x',rows:[]}});worker.emit('close',0);assert.match(f.text(),/READY/);assert.equal(s.hasReaders(),false);assert.ok(s.confirmation);
});

test('scan IPC may arrive after exit, and isolated scan errors retain an actionable code',t=>{
 const f=fake(t),s=f.service;s.handle(request(s.gen,1));const worker=f.children[0];worker.emit('exit',0);assert.match(f.text(),/SCANNING/);worker.emit('message',{model});worker.emit('close',0);assert.match(f.text(),/READY/);
 s.testMode=true;s.readSettings=()=>readSettings(f.root);s.handle(request(s.gen,2));f.children[1].emit('message',{error:'EVIDENCE_CHANGED'});assert.match(f.text(),/ERROR/);assert.ok(f.text().includes(Buffer.from('EVIDENCE_CHANGED').toString('hex')));f.children[1].emit('close',0);
});
