import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {render} from '../../scripts/render-npc-observation.mjs';

const source=readFileSync(new URL('../../extension/md/LifeSigns_NpcObservationDiagnostic.xml',import.meta.url),'utf8');
const fixture={sourceSaveSha256:'a'.repeat(64),shipA:{idcode:'AAA-111'},shipB:{idcode:'BBB-222'},station:{idcode:'CCC-333'},person:{uiName:'Test Pilot'}};
const xml=render(source,fixture);
const DROP=Symbol('drop write');

// A deliberately narrow MD action harness. It executes the changed cue actions
// against fake objects; it cannot prove X4 event dispatch or native NPC lifetime.
function parse(text) {
  const root={children:[]}, stack=[root];
  for(const token of text.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<([^>]+)>/g)) {
    const tag=token[1];
    if(tag.startsWith('?'))continue;
    if(tag.startsWith('/')){stack.pop();continue;}
    const node={tag:tag.match(/^\w+/)[0],attrs:{},children:[]};
    for(const [,key,value] of tag.matchAll(/(\w+)="([^"]*)"/g))node.attrs[key]=value;
    stack.at(-1).children.push(node);
    if(!tag.endsWith('/'))stack.push(node);
  }
  return root;
}
function split(value,operator) {
  let quoted=false,depth=0,start=0;
  const out=[];
  for(let i=0;i<value.length;i++) {
    if(value[i]==="'")quoted=!quoted;
    if(quoted)continue;
    if('[{('.includes(value[i]))depth++;
    if(']})'.includes(value[i]))depth--;
    if(depth===0&&value.startsWith(operator,i)){
      out.push(value.slice(start,i));start=i+operator.length;i=start-1;
    }
  }
  return [...out,value.slice(start)];
}
function harness({pilotTemplate={kind:'npctemplate'},interceptWrite=(_path,value)=>value}={}) {
  const tree=parse(xml),md={},output=[],signals=[];
  let local={},event={},searches=0;
  const a={idcode:'AAA-111',exists:true,isclass:{ship:true}},
    b={idcode:'BBB-222',exists:true,isclass:{ship:true}},
    s={idcode:'CCC-333',exists:true,isclass:{station:true}};
  const pilot={exists:true,isclass:{npc:true},name:'Test Pilot',npctemplate:pilotTemplate,seed:123,
    role:'service',controlpost:'aipilot',roleobject:a,assignedcontrolled:a,container:a};
  a.assignedaipilot=pilot;
  let ships=[a,b],stations=[s];
  function get(object,key) {
    if(key==='exists'&&object==null)return false;
    if(object==null)throw Error(`Missing object for ${key}`);
    if(Array.isArray(object)){if(key==='count')return object.length;if(typeof key==='number')return object[key-1];}
    return object instanceof Map?object.get(key):object[key];
  }
  function evaluate(raw) {
    const value=raw.trim();
    for(const op of [' or ',' and ',' != ',' == ',' + ']) {
      const parts=split(value,op);
      if(parts.length>1){
        if(op===' or ')return parts.some(evaluate);
        if(op===' and ')return parts.every(evaluate);
        const left=evaluate(parts[0]),right=evaluate(parts.slice(1).join(op));
        if(op===' != ')return left!==right;
        if(op===' == ')return left===right;
        return left+right;
      }
    }
    if(value.startsWith('not '))return !evaluate(value.slice(4));
    if(value.startsWith('typeof ')){
      const x=evaluate(value.slice(7));
      return Array.isArray(x)?'list':x?.kind??(x?.isclass?'component':typeof x);
    }
    if(value==='true'||value==='false')return value==='true';
    if(/^\d+$/.test(value))return Number(value);
    if(value==='table[]')return new Map();
    if(value.startsWith('['))return split(value.slice(1,-1),',').map(evaluate);
    if(/^'[^']*'$/.test(value))return value.slice(1,-1);
    const format=value.match(/^'([^']*)'\.\[([\s\S]*)\]$/);
    if(format){
      const args=split(format[2],',').map(evaluate);
      return format[1].replace(/%s/g,()=>{const x=args.shift();return typeof x==='boolean'?Number(x):x;});
    }
    if(value.startsWith('datatype.'))return value.slice(9);
    const exists=value.endsWith('?');
    const parts=split(exists?value.slice(0,-1):value,'.');
    let result=parts[0]==='md'?md:parts[0]==='event'?event:local[parts[0]];
    for(const part of parts.slice(1)){
      if(exists&&result==null)return false;
      result=get(result,part.startsWith('{')?evaluate(part.slice(1,-1)):part);
    }
    if(exists)return result!==undefined&&result!==null;
    if(result===undefined)throw Error(`Missing value: ${value}`);
    return result;
  }
  function assign(path,value) {
    value=interceptWrite(path,value);
    if(value===DROP)return;
    const parts=split(path,'.');
    let target=parts[0]==='md'?md:local;
    const keys=parts[0]==='md'?parts.slice(1):parts;
    for(const part of keys.slice(0,-1))target=get(target,part);
    const key=keys.at(-1);
    if(target instanceof Map){assert.ok(key.startsWith('$'));target.set(key,value);}
    else target[key]=value;
  }
  function cue(name,node=tree){
    if(node.tag==='cue'&&node.attrs.name===name)return node;
    for(const child of node.children){const found=cue(name,child);if(found)return found;}
  }
  function actions(name){return cue(name).children.find(x=>x.tag==='actions').children;}
  function snapshot(param){
    const previousLocal=local,previousEvent=event;
    local={};event={param};
    const outer=actions('Snapshot')[0];
    assert.equal(outer.tag,'do_if');
    const prefix=outer.children;
    const stop=prefix.findIndex(x=>x.tag==='set_value'&&x.attrs.name==='$P1State');
    assert.ok(stop>0);
    assert.equal(evaluate(outer.attrs.value),true);
    run(prefix.slice(0,stop));
    local=previousLocal;event=previousEvent;
  }
  function run(nodes){
    let matched=false;
    for(const node of nodes){const x=node.attrs;
      switch(node.tag){
        case 'do_if':matched=Boolean(evaluate(x.value));if(matched)run(node.children);break;
        case 'do_elseif':if(!matched&&evaluate(x.value)){matched=true;run(node.children);}break;
        case 'do_else':if(!matched)run(node.children);break;
        case 'do_for_each':for(const item of evaluate(x.in)){assign(x.name,item);run(node.children);}break;
        case 'set_value':assign(x.name,evaluate(x.exact));break;
        case 'find_ship':searches++;assign(x.name,ships);break;
        case 'find_station_by_true_owner':searches++;assign(x.name,stations);break;
        case 'debug_text':output.push(evaluate(x.text));break;
        case 'signal_cue_instantly':{const param=evaluate(x.param);signals.push(param);snapshot(param);break;}
        default:assert.fail(`Unsupported action ${node.tag}`);
      }
    }
  }
  run(actions('InitialiseNpcObservation'));
  md.$LifeSignsProductionSessionReady=true;
  md.$LifeSignsProductionSessionKey='TEST_SESSION';
  return {md,output,signals,a,b,s,pilot,get searches(){return searches;},
    dock(nextShips=ships,nextStations=stations){ships=nextShips;stations=nextStations;local={};event={};const start=output.length;run(actions('Docked'));return output.slice(start);},
    conversation(actor){local={};event={object:actor};const start=output.length;run(actions('ConversationObserved'));return output.slice(start);}
  };
}

test('actual enrolment actions retain template and emit baseline from a separate observer docking',()=>{
  const h=harness(),rows=h.dock();
  assert.match(rows[0],/\|enrolment\|complete=1\|reason=COMPLETE\|/);
  assert.equal(h.signals.length,1,JSON.stringify({rows,signals:h.signals}));
  assert.match(rows[1],/\|batch\|session=TEST_SESSION\|seq=1\|trigger=OBSERVER_DOCK\|phase=begin\|/);
  assert.equal(h.md.$LifeSignsNpcObsOriginalP1,h.pilot);
  assert.equal(h.md.$LifeSignsNpcObsOriginalTemplate,h.pilot.npctemplate);
  assert.equal(h.signals.length,1);
  assert.equal(h.searches,2);
  const later=h.dock([],[]);
  assert.equal(later.length,1);
  assert.match(later[0],/\|seq=2\|trigger=OBSERVER_DOCK\|/);
  assert.equal(h.searches,2);
});

for(const [label,options,reason] of [
  ['missing template',{pilotTemplate:null},'TEMPLATE_MISSING'],
  ['wrong type',{pilotTemplate:'not a template'},'TEMPLATE_WRONG_TYPE'],
  ['dropped retained write',{interceptWrite:(p,v)=>p==='md.$LifeSignsNpcObsOriginalTemplate'?DROP:v},'RETAINED_REFERENCE_MISSING'],
  ['wrong retained type',{interceptWrite:(p,v)=>p==='md.$LifeSignsNpcObsOriginalTemplate'?'bad':v},'RETAINED_TEMPLATE_WRONG_TYPE'],
  ['failed retained equality',{interceptWrite:(p,v)=>p==='md.$LifeSignsNpcObsOriginalTemplate'?{kind:'npctemplate'}:v},'READBACK_MISMATCH']
])test(`${label} prevents complete and never retries`,()=>{
  const h=harness(options),first=h.dock();
  assert.match(first[0],new RegExp(`\\|enrolment\\|complete=0\\|reason=${reason}\\|`));
  assert.equal(h.md.$LifeSignsNpcObsEnrolled,false);
  assert.equal(h.signals.length,0);
  assert.deepEqual(h.dock(),[]);
  assert.equal(h.searches,2);
});

test('fresh component selection shares the next snapshot session and sequence',()=>{
  const h=harness();h.dock();
  const fresh={exists:true,kind:'component',isclass:{npc:true},npctemplate:h.pilot.npctemplate,seed:456,
    role:'service',controlpost:'aipilot',roleobject:h.b,assignedcontrolled:h.b,container:h.b};
  const rows=h.conversation(fresh);
  assert.equal(rows.length,2);
  assert.match(rows[0],/\|batch\|session=TEST_SESSION\|seq=2\|trigger=CONVERSATION\|phase=begin\|/);
  assert.match(rows[1],/\|selection\|session=TEST_SESSION\|seq=2\|payload=COMPONENT\|context=B\|instance=PRESENT\|equal_original=NO\|template_equal_original=YES\|/);
  assert.match(rows[1],/\|role=service\|post=aipilot\|roleobject=B\|assignedcontrolled=B\|container=B\|/);
  assert.equal(h.md.$LifeSignsNpcObsOriginalP1,h.pilot);
});

test('contextual conversation stays distinct from a fresh instanced component',()=>{
  const h=harness();h.dock();
  const template=h.pilot.npctemplate;
  const fresh={exists:true,isclass:{npc:true},npctemplate:template,seed:789,
    role:'service',controlpost:'manager',roleobject:h.s,assignedcontrolled:h.s,container:h.s};
  h.s.people=new Map([[template,{exists:true,seed:456,role:'worker'}]]);
  h.s.roleentity=new Map([[template,fresh]]);
  const rows=h.conversation([h.s,template]);
  assert.equal(rows.length,2);
  assert.match(rows[0],/\|seq=2\|trigger=CONVERSATION\|phase=begin\|/);
  assert.match(rows[1],/\|payload=CONTEXTUAL\|context=S\|instance=PRESENT\|equal_original=NO\|template_equal_original=YES\|component_seed_text=789\|entry_seed_text=456\|/);
  assert.match(rows[1],/\|roleobject=S\|assignedcontrolled=S\|container=S\|/);
  assert.equal(h.md.$LifeSignsNpcObsOriginalP1,h.pilot);
});
