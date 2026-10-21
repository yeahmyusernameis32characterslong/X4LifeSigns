import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync,spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {DatabaseSync} from 'node:sqlite';
const repo=fileURLToPath(new URL('../../',import.meta.url));
test('Windows watcher follows a real disposable process and drains/recovers SQLite', {skip:process.platform!=='win32',timeout:90000},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-watcher-'));
 const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const r=spawnSync(ps,['-NoProfile','-NonInteractive','-File',path.join(repo,'profiles/test/watcher-fixture.ps1'),'-Root',root,'-Repo',repo,'-Node',process.execPath],{encoding:'utf8',windowsHide:true,timeout:80000});
 // Preserve failed fixture evidence instead of deleting paths with possibly open handles.
 assert.equal(r.status,0,`${r.stdout}\n${r.stderr}\nFixture: ${root}`);
 const name=fs.readdirSync(path.join(root,'local-data/profiles')).find(n=>n.endsWith('.db')&&!n.endsWith('.building.db'));
 const db=new DatabaseSync(path.join(root,'local-data/profiles',name));assert.equal(db.prepare('SELECT count(*) AS n FROM records').get().n,8);assert.equal(db.prepare('SELECT count(*) AS n FROM profile_versions').get().n,1);assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n,1);db.exec('BEGIN EXCLUSIVE;ROLLBACK');db.close();
 assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});
});

test('managed CLI stdin EOF closes a real service without the watcher',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifesigns-stdin-'));const logs=path.join(root,'logs'),replies=path.join(root,'replies');fs.mkdirSync(logs);fs.mkdirSync(replies);
 const child=spawn(process.execPath,[path.join(repo,'profiles/service.mjs'),'--logs',logs,'--replies',replies,'--since',new Date().toISOString(),'--control-stdin','--root',root],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const exited=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));});
 child.stdin.end();const timeout=setTimeout(()=>child.kill(),8000);const result=await exited;clearTimeout(timeout);assert.equal(result.code,0);assert.equal(result.signal,null);assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true});
});
