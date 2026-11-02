// Metadata-only external instrumentation. Draft sentences NEVER authorise speech.
export class LatencyTrace {
  constructor({now=()=>performance.now(),maxEvents=20000}={}){this.now=now;this.started=now();this.events=[];this.maxEvents=maxEvents;this.dropped=0;}
  record(event){const allowed=['stage','bytes','status','contentType','samples','sampleRate','model'];const safe={ms:this.now()-this.started};for(const k of allowed)if(event[k]!==undefined)safe[k]=event[k];if(this.events.length<this.maxEvents)this.events.push(safe);else this.dropped++;}
  first(stage){return this.events.find(e=>e.stage===stage)?.ms??null;}
}

// Locate only a top-level JSON object's text string. Decode complete escapes;
// a partial unicode escape is withheld. This is a diagnostic, never a parser gate.
export function naturalPrefix(raw){
  let i=0;const ws=()=>{while(/\s/.test(raw[i]||'')&&i<raw.length)i++;};
  const str=()=>{let s='';if(raw[i++]!=='"')return null;while(i<raw.length){const c=raw[i++];if(c==='"')return {s,closed:true};if(c==='\\'){const e=raw[i++];if(e==='u'){const h=raw.slice(i,i+4);if(!/^[0-9a-f]{4}$/i.test(h))return {s,closed:false};s+=String.fromCharCode(parseInt(h,16));i+=4;}else {const map={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};if(!(e in map))return {s,closed:false};s+=map[e];}}else {if(c<' ')return null;s+=c;}}return {s,closed:false};};
  ws();if(raw[i++]!=='{')return null;
  while(i<raw.length){ws();const key=str();if(!key?.closed)return null;ws();if(raw[i++]!==':')return null;ws();if(key.s==='text')return str();
    // Skip other complete JSON values, respecting nested strings and escapes.
    let depth=0,quoted=false,escape=false;const start=i;
    for(;i<raw.length;i++){const c=raw[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='['||c==='{')depth++;else if(c===']'||c==='}') {if(depth===0)return null;depth--;}else if(c===','&&depth===0)break;}
    if(i===raw.length)return null;try{JSON.parse(raw.slice(start,i));}catch{return null;}i++;
  }return null;
}
export function completedSentence(prefix){
  if(!prefix)return null;let quotes=0;
  for(let i=0;i<prefix.s.length;i++){const c=prefix.s[i];if(c==='"'||c==='“'||c==='”')quotes^=1;if(!quotes&&/[.!?]/.test(c)&&(i+1<prefix.s.length?/\s/.test(prefix.s[i+1]):prefix.closed)){const s=prefix.s.slice(0,i+1);if(!/\bR\d+:\d+\b/.test(s))return s;}}
  return null;
}
