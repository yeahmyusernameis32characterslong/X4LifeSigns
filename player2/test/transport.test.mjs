import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Player2Transport,discoverEndpoint,loopbackEndpoint,jsonFrames} from '../transport.mjs';

async function server(t,handler){const s=http.createServer(handler);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>{s.closeAllConnections();s.close();});return 'http://127.0.0.1:'+s.address().port;}
test('discovery uses the observed port file and refuses remote/malformed endpoints',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ls-p2-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const portFile=path.join(dir,'api.port');
 await fs.writeFile(portFile,'4321\n');assert.equal(await discoverEndpoint({portFile}),'http://127.0.0.1:4321');
 for(const s of ['http://localhost:4315','https://127.0.0.1:4315','http://127.0.0.1:65536','http://127.0.0.1:0','http://127.0.0.1:4315/','http://example.com:4315'])assert.throws(()=>loopbackEndpoint(s),/INVALID_ENDPOINT/);
 await fs.writeFile(portFile,'4315/secret');await assert.rejects(discoverEndpoint({portFile}),/INVALID_PORT_FILE/);
 await assert.rejects(discoverEndpoint({portFile:path.join(dir,'missing')}),/NOT_DISCOVERED/);
});
test('real loopback requests send the configured game/resource identity and bound responses',async t=>{
 const calls=[];const endpoint=await server(t,(req,res)=>{calls.push(req);res.setHeader('content-type','application/json');res.end(JSON.stringify({client_version:'test'}));});
 const p=new Player2Transport({endpoint,gameClientId:'synthetic-game'});assert.equal((await p.health()).client_version,'test');assert.equal(calls[0].headers['player2-game-key'],'synthetic-game');assert.equal(calls[0].headers['player2-resource'],'npc-dialogue');
 await assert.rejects(p.json('/v1/health',{maxBytes:2}),/RESPONSE_LIMIT/);await assert.rejects(p.json('//elsewhere'),/INVALID_ROUTE/);
});
test('status failures remain distinct and generation is never automatically retried',async t=>{
 let n=0;const endpoint=await server(t,(req,res)=>{n++;res.writeHead(Number(req.url.split('/').at(-1)));res.end('private provider detail');});
 const p=new Player2Transport({endpoint});for(const [status,code]of [[401,'LOGIN_REQUIRED'],[403,'ACCESS_DENIED'],[402,'CREDITS_REQUIRED'],[429,'RATE_LIMITED'],[503,'PROVIDER_UNAVAILABLE']])await assert.rejects(p.json('/v1/status/'+status,{method:'POST',body:{}}),e=>e.code===code&&e.status===status&&!e.message.includes('private'));
 assert.equal(n,5);
});
test('timeouts, disconnects, caller cancellation and redirects fail without accepting partial replies',async t=>{
 const endpoint=await server(t,(req,res)=>{if(req.url.endsWith('redirect')){res.writeHead(302,{location:'http://example.com'});res.end();}else if(req.url.endsWith('disconnect'))req.socket.destroy();});
 const p=new Player2Transport({endpoint,timeoutMs:30});await assert.rejects(p.health(),/TIMEOUT/);
 const controller=new AbortController();const cancelled=p.health({signal:controller.signal});controller.abort();await assert.rejects(cancelled,/CANCELLED/);
 await assert.rejects(p.json('/v1/disconnect'),/CONNECTION_FAILED/);await assert.rejects(p.json('/v1/redirect'),/CONNECTION_FAILED/);
});
test('stream parser handles UTF-8 and network chunk splits, SSE events and NDJSON while rejecting truncation',async()=>{
 async function* chunks(text){const bytes=Buffer.from(text);for(const byte of bytes)yield Buffer.from([byte]);}
 const collect=async s=>{const a=[];for await(const v of s)a.push(v);return a;};
 assert.deepEqual(await collect(jsonFrames(chunks(': ping\r\nevent: answer\r\ndata: {"text":"é"}\r\n\r\ndata: [DONE]\n\n'))),[{text:'é'}]);
 assert.deepEqual(await collect(jsonFrames(chunks('{"x":1}\n{"x":2}'),{framing:'ndjson'})),[{x:1},{x:2}]);
 await assert.rejects(collect(jsonFrames(chunks('data: {"x":1}\n'))),/TRUNCATED_STREAM/);
 await assert.rejects(collect(jsonFrames(chunks('data: broken\n\n'))),/INVALID_STREAM_JSON/);
 await assert.rejects(collect(jsonFrames(chunks('data: '+JSON.stringify('long')+'\n\n'),{maxFrameBytes:3})),/STREAM_FRAME_LIMIT/);
});
