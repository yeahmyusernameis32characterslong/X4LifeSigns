// Dedicated process: synchronous metadata/SQLite checks cannot block ingestion.
import path from 'node:path';
import { housekeeping } from './housekeeping-cli.mjs';
import { previewModel } from './preview-model.mjs';
import {scanMenuTest,reviewMenuTest,executeMenuTest} from './maintenance-test.mjs';
process.once('message', async ({root,settings,testMode,task}) => {
  try {
    if(testMode&&task){
      const result=task.verb==='REVIEW'||task.verb==='RESTOREREVIEW'?
        await reviewMenuTest(root,task.universe,task.verb==='REVIEW'?'CLEAN':'RESTORE'):
        await executeMenuTest(root,task.confirmation,{onProgress:text=>process.send({actionProgress:text})});
      process.send({action:result},()=>process.disconnect());return;
    }
    let lastStage, lastAt=0;
    const onProgress=progress=>{
      const now=Date.now();
      if (progress.stage!==lastStage || progress.completed===progress.total || now-lastAt>=1000) {
        lastStage=progress.stage;lastAt=now;process.send({progress});
      }
    };
    const result=testMode?await scanMenuTest(root,{onProgress,ignoreProtection:true}):await housekeeping({saves:settings.saveLocations,profiles:path.join(root,'local-data','profiles'),pins:[],onProgress});
    const model=previewModel(result,{...settings,protectedUniverses:[]});
    if (Buffer.byteLength(JSON.stringify(model)) > 4 * 1024 * 1024) throw Error('Preview too large');
    process.send({model},()=>process.disconnect());
  } catch(e) {process.send({error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'TEST_OR_SCAN_FAILED'},()=>process.disconnect());}
});
