import {executeSpace} from '../maintenance-space.mjs';
process.once('message',async ({root,confirmation,nativeSaveDirectory,phase})=>{
 try{await executeSpace(root,confirmation,{nativeSaveDirectory,onPhase(p){if(p===phase)process.exit(87);}});process.exit(0);}
 catch(e){process.stderr.write(e.message);process.exit(1);}
});
