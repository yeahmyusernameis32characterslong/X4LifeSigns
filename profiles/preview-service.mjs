import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { checkPath } from '../bridge/src/session-path.js';
import { PREVIEW_HELLO, PREVIEW_REPLY, parsePreviewRequest, previewReply, scanProgressRows } from './preview-protocol.mjs';
import { applyProtection } from './preview-model.mjs';
import { readSettings, setProtection } from './preview-settings.mjs';
import {TEST_REGISTRATION,testRegistration} from './maintenance-test.mjs';
import {registered,productionRoot} from './production-contract.mjs';

export class PreviewService {
  constructor({root,replyDirectory,launch = () => fork(new URL('./preview-scan-worker.mjs',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=384']}),now=Date.now}) {
    checkPath(root,{directory:true});checkPath(replyDirectory,{directory:true});
    this.root=root;this.replyDirectory=replyDirectory;this.launch=launch;this.now=now;
    this.productionMode=registered(root);this.testMode=!this.productionMode&&fs.existsSync(path.join(root,'local-data',TEST_REGISTRATION));this.settingsRoot=root;
    if(this.productionMode)try{this.settingsRoot=productionRoot(root).directory;}catch{this.testError=true;}
    if(this.testMode)try{this.settingsRoot=testRegistration(root).root;}catch{this.testError=true;}
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
      this.pending.set(PREVIEW_HELLO,`LSDB1|HOUSEKEEPING|HELLO|${this.gen}|${++this.heartbeat}|${this.suspended?'INACTIVE':this.productionMode?'PRODUCTION':this.testMode?'TEST':'INITIAL'}|END\n`);
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
    this.ticket=null;this.confirmation=null;this.progressRows=[];
    if(this.mutating){this.scanning=true;return;}
    this.scanning=false;
    if(this.child){this.child.kill();this.child=null;}
  }
  stop() {this.stopped=true;this.cancel();this.pending.clear();}
  hasReaders() {return this.readers.size>0;}
  waitForExit() {return Promise.all([...this.readers.values()]);}
  suspend() {if(this.suspended)return;this.suspended=true;this.cancel();this.model=null;this.baseModel=null;this.pending.delete(PREVIEW_REPLY);this.lastHeartbeat=undefined;this.poll();}
  readSettings(){if(this.productionMode&&(this.testError||productionRoot(this.root).directory!==this.settingsRoot))throw Error('PRODUCTION_CONFIG_CHANGED');if(this.testMode&&(this.testError||testRegistration(this.root).root!==this.settingsRoot))throw Error('TEST_CONFIG_CHANGED');return readSettings(this.settingsRoot);}
  scan(request,settings) {
    this.cancel();const ticket={request,settings};this.ticket=ticket;this.scanning=true;
    this.progressRows=[];this.reply(request,'SCANNING');
    let child;
    try {child=this.launch();this.child=child;}
    catch {this.scanning=false;this.reply(request,'ERROR');return;}
    let release;
    const exited=new Promise(resolve=>{let done=false;release=()=>{if(!done){done=true;this.readers.delete(child);resolve();}};});
    this.readers.set(child,exited);
    child.once('close',release);
    child.once('error',()=>{if(!child.pid)release();});
    let answered=false;
    child.on('message',message=>{
      if(this.stopped || this.ticket!==ticket)return;
      if (answered) return;
      if (message?.progress) {
        try { this.progressRows=scanProgressRows(message.progress);this.reply(request,'SCANNING',this.progressRows); } catch { /* Malformed progress cannot complete a scan. */ }
        return;
      }
      answered=true;this.scanning=false;this.child=null;
      try {
        if(this.readSettings().digest!==settings.digest){this.model=null;this.baseModel=null;this.reply(request,'STALE');return;}
        if(message.error || !message.model)throw Error('Scan failed');
        this.baseModel=message.model;this.model=applyProtection(this.baseModel,settings.value);this.settings=settings;this.reply(request,'READY',this.model.list);
      } catch {this.model=null;this.baseModel=null;this.reply(request,'ERROR',this.productionMode?[['ERROR','History scan blocked',message.error||'SCAN_FAILED','Check configured local save scope','No cleanup performed']]:this.testMode?[['ERROR','Test scan blocked',message.error||'SCAN_FAILED','Close X4 and report to Codex','Preserve test copies and backups']]:[]);}
    });
    const failed=()=>{if(!answered && !this.stopped && this.ticket===ticket){this.scanning=false;this.child=null;this.reply(request,'ERROR');}};
    child.on('error',failed);child.on('close',failed);
    child.send({root:this.root,settings:settings.value,testMode:this.testMode,productionMode:this.productionMode});
  }
  action(request,settings) {
    const id=this.model?.ids[request.item-1];if((!this.testMode&&!this.productionMode)||!id||this.scanning)throw Error('ACTION_NOT_AVAILABLE');
    const execute=['APPLY','RESTORE'].includes(request.verb),kind=request.verb==='APPLY'?'CLEAN':'RESTORE';
    const confirmation=this.confirmation;
    if(execute&&(!confirmation||confirmation.client!==request.client||confirmation.id!==id||!(confirmation.value.plan.kind===kind||kind==='RESTORE'&&confirmation.value.plan.kind==='RECOVER')||this.now()-confirmation.created>600000))throw Error('CONFIRMATION_REQUIRED');
    this.cancel();const ticket={request,settings};this.ticket=ticket;this.scanning=true;this.mutating=execute;this.reply(request,'SCANNING');
    let child;try{child=this.launch();}catch(e){this.scanning=false;this.mutating=false;throw e;}this.child=child;let answered=false,resolve;const promise=new Promise(r=>resolve=r);this.readers.set(child,promise);
    const release=()=>{if(!this.readers.has(child))return;this.readers.delete(child);if(this.child===child){this.child=null;this.mutating=false;this.scanning=false;if(this.mutationWaiter&&!this.stopped&&!this.suspended)this.reply(this.mutationWaiter,'STALE');this.mutationWaiter=null;}resolve();};
    const failed=()=>{if(!answered&&!this.stopped&&this.ticket===ticket){answered=true;this.scanning=false;this.reply(request,'ERROR',[['ERROR',this.productionMode?'History operation interrupted':'Test operation interrupted',this.productionMode?'Refresh to inspect recovery state':'Close X4 and report to Codex','Preserve backups and evidence','']]);}};
    // exit can precede draining the final IPC message. Wait for close before
    // declaring failure or releasing the tracked mutating worker.
    child.once('close',()=>{failed();release();});
    child.on('error',()=>{if(!child.pid)release();failed();});
    child.on('message',message=>{
      if(this.stopped||this.ticket!==ticket||answered)return;
      if(message?.actionProgress){this.reply(request,'SCANNING',[['ACTION','Progress',message.actionProgress,this.productionMode?'Selected universe history':'Test copies only','']]);return;}
      answered=true;this.scanning=false;this.mutating=false;
      if(message.error||!message.action){this.reply(request,'ERROR',[['ERROR',this.productionMode?'History action blocked':'Test action blocked',message.error||'ACTION_FAILED',this.productionMode?'Refresh to inspect current state':'Close X4 and report to Codex','Preserve backups and evidence']]);return;}
      if(!execute)this.confirmation={client:request.client,id,created:this.now(),value:message.action};
      else {this.model=null;this.baseModel=null;this.confirmation=null;}
      this.reply(request,'READY',message.action.rows);
    });
    child.send({root:this.root,settings:settings.value,testMode:this.testMode,productionMode:this.productionMode,task:{verb:request.verb,universe:id,confirmation:execute?confirmation.value:null}});
  }
  handle(line) {
    const r=parsePreviewRequest(line);if(!r || r.gen!==this.gen || this.stopped)return false;
    const last=this.sequences.get(r.client)||0;if(r.seq<=last)return true;
    if(this.sequences.size>=64 && !this.sequences.has(r.client)){this.reply(r,'ERROR');return true;}
    this.sequences.set(r.client,r.seq);
    if(this.suspended){this.reply(r,'STALE');return true;}
    if(this.client!==r.client){this.cancel();this.model=null;this.baseModel=null;this.client=r.client;}
    try {
      if(r.verb==='CANCEL'){if(this.mutating){this.reply(r,'SCANNING');return true;}this.cancel();this.reply(r,'CANCELLED');return true;}
      const settings=this.readSettings();
      if(this.mutating){this.mutationWaiter=r;this.reply(r,'SCANNING');return true;}
      if(r.verb==='REFRESH'){this.scan(r,settings);return true;}
      if(r.verb==='LOCATIONS') {
        const rows=settings.value.saveLocations.map((p,i)=>[String(i+1),'Local folder '+(i+1),p,'Selected local scope','']);
        rows.push(this.productionMode?['0','Save scope','Selected local folders only','External copies are not inventoried','Refresh before cleanup']:['0','Configure locations','Edit local-data/housekeeping-preview-v1.json','Restart companion, then Refresh','No folder picker is used']);
        this.reply(r,'READY',rows,r.page);return true;
      }
      if(this.scanning){this.reply(r,'SCANNING',this.progressRows);return true;}
      if(!this.model || settings.digest!==this.settings.digest){this.model=null;this.baseModel=null;this.reply(r,'STALE');return true;}
      if(['REVIEW','RESTOREREVIEW','APPLY','RESTORE'].includes(r.verb)){this.action(r,settings);return true;}
      if(r.verb==='PROTECT') {
        const universe=this.model.ids[r.item-1];if(!universe)throw Error('Unknown universe');
        // Validate selection/page before changing even the preference file.
        previewReply(this.gen,r,'READY',this.model.details[r.item-1],r.page);
        const updated=setProtection(this.settingsRoot,settings.digest,universe,r.enabled);this.confirmation=null;
        this.settings=updated;this.model=applyProtection(this.baseModel,updated.value);
        this.reply(r,'READY',this.model.details[r.item-1],r.page);return true;
      }
      const rows=r.verb==='LIST'?this.model.list:this.model.details[r.item-1];
      if(!rows)throw Error('Unknown selection');this.reply(r,'READY',rows,r.page);
    } catch {this.reply(r,'ERROR');}
    return true;
  }
}
