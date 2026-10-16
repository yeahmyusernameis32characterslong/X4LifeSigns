// Render a fixture-specific MD diagnostic only into ignored local-data.
// The source template and public documentation contain no owner save values.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const local=path.join(root,'local-data','npc-observation');
const configFile=path.join(local,'fixture.local.json');
const output=path.join(local,'generated','LifeSigns_NpcObservationDiagnostic.xml');
const template=path.join(root,'extension','md','LifeSigns_NpcObservationDiagnostic.xml');
const code=value=>{
  if(typeof value!=='string'||!/^([A-Z]{3}-[0-9]{3})$/.test(value))throw Error('INVALID_IDCODE');
  return value;
};
const name=value=>{
  if(typeof value!=='string'||!value||value.length>100||!/^[A-Za-z0-9 ._-]+$/.test(value))throw Error('INVALID_PERSON_NAME');
  return value;
};
export function render(templateText,fixture){
  if(!/^[a-f0-9]{64}$/i.test(fixture.sourceSaveSha256||''))throw Error('MISSING_SAVE_HASH');
  const replacements={
    '@SHIP_A_CODE@':code(fixture.shipA?.idcode),
    '@SHIP_B_CODE@':code(fixture.shipB?.idcode),
    '@STATION_CODE@':code(fixture.station?.idcode),
    '@PERSON_NAME@':name(fixture.person?.uiName)
  };
  if(new Set(Object.values(replacements).slice(0,3)).size!==3)throw Error('DUPLICATE_IDCODE');
  let xml=templateText;
  for(const [token,value] of Object.entries(replacements)){
    if(!xml.includes(token))throw Error('MISSING_TEMPLATE_TOKEN');
    xml=xml.replaceAll(token,value);
  }
  if(/@[A-Z_]+@/.test(xml))throw Error('UNRESOLVED_TEMPLATE_TOKEN');
  return xml;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const fixture=JSON.parse(fs.readFileSync(configFile,'utf8'));
  const xml=render(fs.readFileSync(template,'utf8'),fixture);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,xml,{flag:'w'});
  console.log('Rendered ignored local diagnostic from fixture with save SHA-256 '+fixture.sourceSaveSha256);
}
