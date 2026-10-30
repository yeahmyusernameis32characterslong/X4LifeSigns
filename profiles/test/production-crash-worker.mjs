import {executeProduction} from '../maintenance-production.mjs';
process.once('message',async ({root,confirmation,phase})=>{
 try{await executeProduction(root,confirmation,{onPhase(p,db){if(p===phase){if(db)db.exec('PRAGMA cache_size=2;UPDATE records SET payload=payload||hex(randomblob(16384))');process.exit(87);}}});process.exit(0);}
 catch(e){process.stderr.write(e.message);process.exit(1);}
});
