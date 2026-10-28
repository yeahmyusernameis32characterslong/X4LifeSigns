// Dedicated process: synchronous metadata/SQLite checks cannot block ingestion.
import path from 'node:path';
import { housekeeping } from './housekeeping-cli.mjs';
import { previewModel } from './preview-model.mjs';
process.once('message', async ({root,settings}) => {
  try {
    let lastStage, lastAt=0;
    const onProgress=progress=>{
      const now=Date.now();
      if (progress.stage!==lastStage || progress.completed===progress.total || now-lastAt>=1000) {
        lastStage=progress.stage;lastAt=now;process.send({progress});
      }
    };
    const result=await housekeeping({saves:settings.saveLocations,profiles:path.join(root,'local-data','profiles'),pins:[],onProgress});
    const model=previewModel(result,{...settings,protectedUniverses:[]});
    if (Buffer.byteLength(JSON.stringify(model)) > 4 * 1024 * 1024) throw Error('Preview too large');
    process.send({model},()=>process.disconnect());
  } catch {process.send({error:'SCAN_FAILED'},()=>process.disconnect());}
});
