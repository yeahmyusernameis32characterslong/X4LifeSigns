import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
export async function maintenanceHandles(paths,{inputsOnly=false}={}){
  if(process.platform!=='win32')throw Error('PRODUCTION_MAINTENANCE_REQUIRES_WINDOWS_HANDLES');
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./maintenance-handles.ps1',import.meta.url))],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let pending=null,text='',error='';child.stderr.on('data',d=>{error=(error+d).slice(-2048);});
  child.stdout.on('data',d=>{text+=d;for(let i;(i=text.indexOf('\n'))>=0;){const line=text.slice(0,i).trim();text=text.slice(i+1);if(pending){const p=pending;pending=null;clearTimeout(p.timer);line==='LOCKED'?p.resolve():p.reject(Error('WRITABLE_HANDLE_OR_PATH_REFUSED'));}}});
  child.on('error',e=>{if(pending){clearTimeout(pending.timer);pending.reject(e);pending=null;}});
  child.on('exit',()=>{if(pending){clearTimeout(pending.timer);pending.reject(Error('MAINTENANCE_HANDLE_PROCESS_EXITED'));pending=null;}});
  child.stdin.on('error',e=>{if(pending){clearTimeout(pending.timer);pending.reject(e);pending=null;}});
  const send=async command=>{if(pending)throw Error('HANDLE_REQUEST_BUSY');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending=null;child.stdin.end();reject(Error('HANDLE_ACQUISITION_TIMEOUT'));},30000);pending={resolve,reject,timer};child.stdin.write(JSON.stringify(command)+'\n');});};
  const guard={
    async add(paths,replaceable=true,rename=false){await send({command:'LOCK',paths,replaceable,rename});},
    async install(source,target){await send({command:'INSTALL',source,target});},
    assert(){if(child.exitCode!==null||child.signalCode!==null)throw Error('MAINTENANCE_HANDLE_LOST');},
    async close(){if(child.exitCode!==null)return;const exited=once(child,'exit');child.stdin.end(JSON.stringify({command:'CLOSE'})+'\n');await exited;},
  };
  try{if(inputsOnly)await guard.add(paths,false);else {await guard.add(paths.slice(0,1),true);if(paths.length>1)await guard.add(paths.slice(1),false);}return guard;}catch(e){await guard.close();throw e;}
}
