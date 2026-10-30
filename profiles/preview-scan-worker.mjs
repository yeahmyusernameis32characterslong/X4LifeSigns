// Dedicated process: synchronous metadata/SQLite checks cannot block ingestion.
import path from 'node:path';
import { housekeeping } from './housekeeping-cli.mjs';
import { previewModel } from './preview-model.mjs';
import {scanMenuTest,reviewMenuTest,executeMenuTest} from './maintenance-test.mjs';
import {backupRows,reviewSpace,executeSpace} from './maintenance-space.mjs';
import {scanProduction,reviewProduction,executeProduction} from './maintenance-production.mjs';
process.once('message', async ({root,settings,testMode,productionMode,task,nativeSaveDirectory=null}) => {
  try {
    if((testMode||productionMode)&&task){
      if(productionMode){
        const opts={nativeSaveDirectory,onProgress:text=>process.send({actionProgress:text})};let action;
        if(task.verb==='BACKUPS')action={rows:backupRows(root,task.universe)};
        else if(['DELETEREVIEW','BACKUPREVIEW'].includes(task.verb))action=await reviewSpace(root,task.universe,task.verb==='DELETEREVIEW'?'DELETEUNIVERSE':'BACKUPDELETE',{...opts,backupId:task.backupId});
        else if(['DELETEUNIVERSE','BACKUPDELETE'].includes(task.verb))action=await executeSpace(root,task.confirmation,opts);
        else if(['REVIEW','RESTOREREVIEW','COMPACTREVIEW','BACKUPRESTOREREVIEW'].includes(task.verb))action=await reviewProduction(root,task.universe,task.verb==='REVIEW'?'CLEAN':task.verb==='COMPACTREVIEW'?'COMPACT':'RESTORE',{...opts,backupId:task.backupId});
        else action=await executeProduction(root,task.confirmation,opts);
        process.send({action},()=>process.disconnect());return;
      }
      const review=productionMode?reviewProduction:reviewMenuTest,execute=productionMode?executeProduction:executeMenuTest;
      const result=task.verb==='REVIEW'||task.verb==='RESTOREREVIEW'?
        await review(root,task.universe,task.verb==='REVIEW'?'CLEAN':'RESTORE'):
        await execute(root,task.confirmation,{onProgress:text=>process.send({actionProgress:text})});
      process.send({action:result},()=>process.disconnect());return;
    }
    let lastStage, lastAt=0;
    const onProgress=progress=>{
      const now=Date.now();
      if (progress.stage!==lastStage || progress.completed===progress.total || now-lastAt>=1000) {
        lastStage=progress.stage;lastAt=now;process.send({progress});
      }
    };
    const result=productionMode?await scanProduction(root,{onProgress,nativeSaveDirectory}):testMode?await scanMenuTest(root,{onProgress,ignoreProtection:true}):await housekeeping({saves:settings.saveLocations,profiles:path.join(root,'local-data','profiles'),pins:[],onProgress});
    const model=previewModel(result,{...settings,protectedUniverses:[]});
    if (Buffer.byteLength(JSON.stringify(model)) > 4 * 1024 * 1024) throw Error('Preview too large');
    process.send({model},()=>process.disconnect());
  } catch(e) {process.send({error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'TEST_OR_SCAN_FAILED'},()=>process.disconnect());}
});
