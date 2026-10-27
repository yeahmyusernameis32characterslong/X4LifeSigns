// Dedicated process: synchronous metadata/SQLite checks cannot block ingestion.
import path from 'node:path';
import { housekeeping } from './housekeeping-cli.mjs';
import { previewModel } from './preview-model.mjs';
process.once('message', async ({root,settings}) => {
  try {
    const result=await housekeeping({saves:settings.saveLocations,profiles:path.join(root,'local-data','profiles'),pins:settings.protectedUniverses});
    const model=previewModel(result,settings);
    if (Buffer.byteLength(JSON.stringify(model)) > 4 * 1024 * 1024) throw Error('Preview too large');
    process.send({model},()=>process.disconnect());
  } catch {process.send({error:'SCAN_FAILED'},()=>process.disconnect());}
});
