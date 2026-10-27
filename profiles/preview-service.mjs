import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { checkPath } from '../bridge/src/session-path.js';
import { PREVIEW_HELLO, PREVIEW_REPLY, parsePreviewRequest, previewReply } from './preview-protocol.mjs';
import { readSettings, setProtection } from './preview-settings.mjs';

export class PreviewService {
  constructor({root,replyDirectory,launch = () => fork(new URL('./preview-scan-worker.mjs',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=384']}),now=Date.now}) {
    checkPath(root,{directory:true});checkPath(replyDirectory,{directory:true});
    this.root=root;this.replyDirectory=replyDirectory;this.launch=launch;this.now=now;
    this.gen=randomUUID().replaceAll('-','');this.heartbeat=0;this.pending=new Map();this.sequences=new Map();this.readers=new Map();
    this.poll();
  }
  write(run,text) {
    const target=path.join(this.replyDirectory,run+'.reply');checkPath(target,{missing:true});
    const temp=target+'.'+randomUUID()+'.tmp',fd=fs.openSync(temp,'wx');
    try {fs.writeFileSync(fd,text);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    try {checkPath(target,{missing:true});fs.renameSync(temp,target);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
  poll() {
    if(this.stopped)return;
    const now=this.now();
    if(this.lastHeartbeat===undefined || now-this.lastHeartbeat>=1000) {
      this.lastHeartbeat=now;
      this.pending.set(PREVIEW_HELLO,`LSDB1|HOUSEKEEPING|HELLO|${this.gen}|${++this.heartbeat}|${this.suspended?'INACTIVE':'INITIAL'}|END\n`);
    }
    for(const [run,text] of this.pending) {
      try {this.write(run,text);this.pending.delete(run);}catch { /* Separate preview transport cannot stop profile ingestion. Retry next poll. */ }
    }
  }
  reply(request,state,rows=[],page=0) {
    try {this.pending.set(PREVIEW_REPLY,previewReply(this.gen,request,state,rows,page));}
    catch {this.pending.set(PREVIEW_REPLY,previewReply(this.gen,request,'ERROR'));}
    this.poll();
  }
  cancel() {
    this.ticket=null;this.scanning=false;
    if(this.child){this.child.kill();this.child=null;}
  }
  stop() {this.stopped=true;this.cancel();this.pending.clear();}
  hasReaders() {return this.readers.size>0;}
  waitForExit() {return Promise.all([...this.readers.values()]);}
  suspend() {if(this.suspended)return;this.suspended=true;this.cancel();this.model=null;this.pending.delete(PREVIEW_REPLY);this.lastHeartbeat=undefined;this.poll();}
  scan(request,settings) {
    this.cancel();const ticket={request,settings};this.ticket=ticket;this.scanning=true;
    this.reply(request,'SCANNING');
    let child;
    try {child=this.launch();this.child=child;}
    catch {this.scanning=false;this.reply(request,'ERROR');return;}
    let release;
    const exited=new Promise(resolve=>{let done=false;release=()=>{if(!done){done=true;this.readers.delete(child);resolve();}};});
    this.readers.set(child,exited);
    child.once('exit',release);child.once('close',release);
    child.once('error',()=>{if(!child.pid)release();});
    let answered=false;
    child.on('message',message=>{
      if(this.stopped || this.ticket!==ticket)return;
      answered=true;this.scanning=false;this.child=null;
      try {
        if(readSettings(this.root).digest!==settings.digest){this.model=null;this.reply(request,'STALE');return;}
        if(message.error || !message.model)throw Error('Scan failed');
        this.model=message.model;this.settings=settings;this.reply(request,'READY',this.model.list);
      } catch {this.model=null;this.reply(request,'ERROR');}
    });
    const failed=()=>{if(!answered && !this.stopped && this.ticket===ticket){this.scanning=false;this.child=null;this.reply(request,'ERROR');}};
    child.on('error',failed);child.on('exit',failed);
    child.send({root:this.root,settings:settings.value});
  }
  handle(line) {
    const r=parsePreviewRequest(line);if(!r || r.gen!==this.gen || this.stopped)return false;
    const last=this.sequences.get(r.client)||0;if(r.seq<=last)return true;
    if(this.sequences.size>=64 && !this.sequences.has(r.client)){this.reply(r,'ERROR');return true;}
    this.sequences.set(r.client,r.seq);
    if(this.suspended){this.reply(r,'STALE');return true;}
    if(this.client!==r.client){this.cancel();this.model=null;this.client=r.client;}
    try {
      if(r.verb==='CANCEL'){this.cancel();this.reply(r,'CANCELLED');return true;}
      const settings=readSettings(this.root);
      if(r.verb==='REFRESH'){this.scan(r,settings);return true;}
      if(r.verb==='LOCATIONS') {
        const rows=settings.value.saveLocations.map((p,i)=>[String(i+1),'Local folder '+(i+1),p,'Selected local scope','']);
        rows.push(['0','Configure locations','Edit local-data/housekeeping-preview-v1.json','Restart companion, then Refresh','No folder picker is used']);
        this.reply(r,'READY',rows,r.page);return true;
      }
      if(this.scanning){this.reply(r,'SCANNING');return true;}
      if(!this.model || settings.digest!==this.settings.digest){this.model=null;this.reply(r,'STALE');return true;}
      if(r.verb==='PROTECT') {
        const universe=this.model.ids[r.item-1];if(!universe)throw Error('Unknown universe');
        const updated=setProtection(this.root,settings.digest,universe,r.enabled);this.scan(r,updated);return true;
      }
      const rows=r.verb==='LIST'?this.model.list:this.model.details[r.item-1];
      if(!rows)throw Error('Unknown selection');this.reply(r,'READY',rows,r.page);
    } catch {this.reply(r,'ERROR');}
    return true;
  }
}
