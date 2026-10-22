// Database-aware recorder compiler: scalar events and targeted new-object profiles.
import { WELCOME, CREATED, DATABASE_ERROR } from './profile-messages.mjs';
import { generateProfileEvents, profileEvents } from './profile-event-generator.mjs';
import { generatePlayerProfile } from './player-profile-generator.mjs';
const xml = v => String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const tag = (name, attrs = {}, body) => `<${name}${Object.entries(attrs).map(([k,v]) => ` ${k}="${xml(v)}"`).join('')}${body === undefined ? ' />' : `>${body}</${name}>`}`;
const set = (name, exact) => tag('set_value', {name, exact});
const add = (name, exact = '1L') => tag('set_value', {name, exact, operation:'add'});
const iff = (value, body) => tag('do_if', {value}, body);
const otherwise = body => tag('do_else', {}, body);
const each = (name, input, body) => tag('do_for_each', {name, in:input}, body);
const ret = value => tag('return', {value});
const run = (ref, params = {}, result) => tag('run_actions', {ref, ...(result ? {result} : {})}, Object.entries(params).map(([name,value]) => tag('param',{name,value})).join(''));
const lib = (name, params, actions) => tag('library',{name,purpose:'run_actions'},tag('params',{},Object.entries(params).map(([name,value])=>tag('param',{name,...(value===null?{}:{default:value})})).join(''))+tag('actions',{},actions));
const write = body => run('Write', {Body:body});
const literal = text => "'" + text.replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('\n','\\n') + "'";
const completionPanel = text => tag('show_help', {custom:literal(text),position:'4',halign:"'center'",allowclose:'true',timeout:'false',log:'false'});
const value = (field, expression, available = `${expression}?`, state = "'AUTO'") => {
  if (!/^[a-z0-9_]+$/.test(field)) throw Error('Generated field name must be framing-safe');
  // @ suppresses unavailable property lookups; it is invalid before literals.
  const observed = expression === 'null' || expression.startsWith("'") ? expression : `@${expression}`;
  return iff('not md.$LSPStopped', iff('md.$LSPRemaining gt 0', run('Value',{Field:`'${field}'`,Value:observed,Available:available,State:state})) + otherwise(run('Value',{Field:`'${field}'`,Value:'null',Available:'false',State:state})));
};
const missing = (field, state) => value(field,'null','false',`'${state}'`);
const valid = ref => `typeof ${ref} == datatype.component and ${ref}.exists`;
// Saved flags alone do not prove a fresh runtime; load invalidation and listener
// retirement are separate lifecycle operations. Every entry point also checks
// that this build finished preparing the run it is about to use.
const ready = "md.$LSPReady? and md.$LSPReady and md.$LSPStopped? and not md.$LSPStopped and md.$LSPStartupVersion? and md.$LSPStartupVersion == 1 and md.$LSPInitialisedRun? and md.$LSPRun? and md.$LSPInitialisedRun == md.$LSPRun";
const eventReady = `(${ready}) and md.$LSPEventsReady? and md.$LSPEventsReady and md.$LSPWatch? and md.$LSPHistorySectors? and md.$LSPHistoryOutsiders? and ${['Identities','Contacts','MarineStates','OperationHosts','OutsiderExpiry'].map(k=>`typeof @md.$LSPHistory${k} == datatype.table`).join(' and ')}`;
const levels = ['OFF','ERROR','WARNING','INFO','DEBUG'];
export function validateConfig(c) {
  const bounds = {heartbeatSeconds:[10,3600],profilesPerTick:[1,64],npcProfilesPerTick:[1,64],discoveryPerTick:[1,64],personnelPerHost:[1,1024],profileValueItems:[16,16384],maxCandidates:[1,100000],maxDiscoveryHosts:[1,100000]};
  if (!c || Object.keys(c).sort().join() !== ['diagnostics','npcTickSeconds',...Object.keys(bounds)].sort().join()) throw Error('Unexpected profile configuration keys');
  if (!Number.isFinite(c.npcTickSeconds) || c.npcTickSeconds < 0.05 || c.npcTickSeconds > 1) throw Error('Invalid NPC tick interval');
  if (!levels.includes(c.diagnostics)) throw Error('Invalid diagnostics level');
  for (const [k,[min,max]] of Object.entries(bounds)) if(!Number.isSafeInteger(c[k])||c[k]<min||c[k]>max)throw Error(`Invalid ${k}`);
  return c;
}
export function generateRecorder(config) {
  const c=validateConfig(config);
  const events=generateProfileEvents({tag,set,add,iff,otherwise,each,ret,run,lib,write,valid,ready,eventReady},c);
  // This static cue is a save-lineage namespace, never part of the per-run reset.
  const identity=tag('cue',{name:'UniverseIdentity'},tag('actions',{}));
  const identityMetadata=(body,args=[])=>`'${body}|lifesigns_universe_id=%s|lifesigns_universe_id_state=%s|identity_basis=LIFESIGNS_MD_V1|identity_save_confirmation=UNAVAILABLE|database_protocol=LSDB1|parent_run=%s|parent_record=%s'.[${[...args,'md.$LSPUniverseIdText','md.$LSPUniverseIdState','md.$LSPParentRun','md.$LSPParentRecord'].join(', ')}]`;
  const escape=lib('Escape',{Value:null},set('$Text',"'%s'.[$Value]")+[['%','%25'],['|','%7C'],['\\n','%0A'],['\\r','%0D'],['\\t','%09']].map(([a,b])=>tag('substitute_text',{text:'$Text'},tag('replace',{string:`'${a}'`,with:`'${b}'`}))).join('')+ret('$Text'));
  const ensureIdentity=lib('EnsureUniverseIdentity',{},
    set('md.$LSPUniverseIdText',"''")+set('md.$LSPUniverseIdState',"'INVALID'")+
    iff('not UniverseIdentity.$Id?',
      ['A','B','C','D'].map(k=>tag('set_value',{name:`$Random${k}`,min:'0',max:'2147483647'})).join('')+
      set('UniverseIdentity.$Id',"'lsu1-%s-%s-%s-%s-%s'.[md.$LSPLoadedAt, $RandomA, $RandomB, $RandomC, $RandomD]")+
      set('md.$LSPUniverseIdState',"'CREATED'"))+
    iff('typeof UniverseIdentity.$Id == datatype.string',iff("UniverseIdentity.$Id != ''",
      run('Escape',{Value:'UniverseIdentity.$Id'},'md.$LSPUniverseIdText')+
      iff("md.$LSPUniverseIdState != 'CREATED'",set('md.$LSPUniverseIdState',"'EXISTING'"))))+ret('true'));
  const writeTrace=phase=>iff('not $Diagnostic and $EventTrace and md.$LSPLevel ge 3',tag('debug_text',{text:`'LSPWRITE1|phase=${phase}|run=%s|record=%s|row=%s'.[md.$LSPRun, md.$LSPRecord, $Line]`}));
  const writer=lib('Write',{Body:null,Diagnostic:'false',EventTrace:'false'},
    iff(`not (${ready})`,ret('false'))+
    iff('$Diagnostic and md.$LSPLevel == 0',ret('false'))+
    iff('md.$LSPStopped',ret('false'))+
    set('$Session',"'UNAVAILABLE'")+
    iff('md.$LifeSignsProductionSessionReady? and md.$LifeSignsProductionSessionKey?',iff("md.$LifeSignsProductionSessionReady and md.$LifeSignsProductionSessionKey != ''",set('$Session','md.$LifeSignsProductionSessionKey')))+
    iff('not $Diagnostic',add('md.$LSPRecord'))+
    set('$Line',"'LSEV1|run=%s|session=%s|seq=%s|age=%s|%s|record=%s|END'.[md.$LSPRun, $Session, md.$LSPSeq, player.age, $Body, md.$LSPRecord]")+
    writeTrace('BEFORE')+
    iff('$Diagnostic',add('md.$LSPDiagnosticRows')+tag('debug_to_file',{name:'md.$LSPDiagnosticFile',directory:"'lifesigns-event-recorder'",append:'true',text:'$Line'}))+
    otherwise(add('md.$LSPRows')+tag('debug_to_file',{name:'md.$LSPProfileFile',directory:"'lifesigns-event-recorder'",append:'true',text:'$Line'}))+writeTrace('AFTER')+ret('true'));
  const val=lib('Value',{Field:null,Value:null,Available:'true',State:"'AUTO'"},
    iff('md.$LSPStopped',ret('false'))+
    iff('md.$LSPRemaining le 0',iff('not md.$LSPValueLimit',set('md.$LSPValueLimit','true')+set('md.$LSPProfilePartial','true')+write("'PROFILE_LIMIT|reason=VALUE_BUDGET'"))+ret('false'))+
    add('md.$LSPRemaining','-1')+set('$Type',"'UNAVAILABLE'")+set('$Text',"''")+
    iff("$State == 'AUTO'",set('$State',"'UNAVAILABLE'")+
      iff('$Available',set('$Type','typeof $Value')+set('$State',"'PRESENT'")+set('$Text',"'%s'.[$Value]")+
        iff('typeof $Value == datatype.null',set('$State',"'NULL'"))+
        iff('typeof $Value == datatype.component',iff('not $Value.exists',set('$State',"'UNAVAILABLE_REFERENCE'")))))+
    iff("$State == 'UNAVAILABLE' or $State == 'UNAVAILABLE_REFERENCE' or $State == 'UNVERIFIED' or $State == 'AMBIGUOUS_ASSIGNMENT'",set('md.$LSPProfilePartial','true'))+
    events.observedSeed+set('$FieldText','$Field')+run('Escape',{Value:'$Text'},'$Text')+
    iff('not md.$LSPTypeEscapes?',set('md.$LSPTypeEscapes','table[]'))+set('$TypeKey',"'$%s'.[$Type]")+
    iff('md.$LSPTypeEscapes.{$TypeKey}?',set('$TypeText','md.$LSPTypeEscapes.{$TypeKey}'))+
    otherwise(run('Escape',{Value:'$Type'},'$TypeText')+set('md.$LSPTypeEscapes.{$TypeKey}','$TypeText'))+
    write("'VALUE|profile=%s|field=%s|type=%s|state=%s|render=ENGINE_TEXT_UNVERIFIED|value=%s'.[md.$LSPProfile, $FieldText, $TypeText, $State, $Text]")+ret('true'));
  const beginProfile=type=>events.begin(type)+set('md.$LSPProfilePartial','false')+set('md.$LSPValueLimit','false')+set('md.$LSPRemaining',String(c.profileValueItems))+add('md.$LSPProfile')+write(`'PROFILE_BEGIN|profile=%s|kind=${type}|atomic=false'.[md.$LSPProfile]`);
  const endProfile=write("'PROFILE_END|profile=%s|partial=%s'.[md.$LSPProfile, md.$LSPProfilePartial]")+events.end+iff('md.$LSPProfilePartial',set('md.$LSPSnapshotPartial','true'))+ret('true');
  const playerProfile=generatePlayerProfile({tag,set,iff,otherwise,ret,run,lib,write,valid,eventReady,value,missing,beginProfile,endProfile});
  const base=ref=>value('reference',ref,'true')+value('seed',`${ref}.seed`)+value('idcode',`${ref}.idcode`)+value('name',`${ref}.knownname`)+value('sector_name',`${ref}.sector.name`);
  const station=lib('StationProfile',{Station:null},beginProfile('STATION')+
    iff(`not md.$LSPStopped and ${valid('$Station')}`,base('$Station')+value('station_type','$Station.primarypurpose.name')+value('station_model_name','$Station.macro.name')+
      set('$Manager','null')+iff('not md.$LSPStopped and md.$LSPRemaining gt 0',set('$Manager','@$Station.assignedcontrolentity.{controlpost.manager}'))+value('manager_reference','$Manager','true')+
      iff(valid('$Manager'),value('manager_seed','$Manager.seed'))+otherwise(missing('manager_seed','NO_ASSIGNED_MANAGER')))+
    otherwise(missing('reference','UNAVAILABLE_REFERENCE'))+endProfile);
  const ship=lib('ShipProfile',{Ship:null},beginProfile('SHIP')+
    iff(`not md.$LSPStopped and ${valid('$Ship')}`,base('$Ship')+value('model_name','$Ship.macro.name')+
      set('$Captain','null')+set('$Pilot','null')+set('$Commander','null')+iff('not md.$LSPStopped and md.$LSPRemaining gt 0',set('$Captain','@$Ship.assignedcontrolentity.{controlpost.aipilot}')+set('$Pilot','@$Ship.assignedpilot')+set('$Commander','@$Ship.commander'))+
      value('captain_reference','$Captain','true')+value('pilot_reference','$Pilot','true')+
      iff(valid('$Captain'),value('captain_seed','$Captain.seed'))+otherwise(missing('captain_seed','NO_ASSIGNED_CAPTAIN'))+
      iff(valid('$Pilot'),value('pilot_seed','$Pilot.seed'))+otherwise(missing('pilot_seed','NO_ASSIGNED_PILOT'))+
      value('onboard_template_personnel','$Ship.availablepeople.count')+value('assigned_template_personnel','$Ship.people.count')+
      value('commander_reference','$Commander','true')+
      iff(valid('$Commander'),value('commander_idcode','$Commander.idcode')+value('commander_class','$Commander.class'))+otherwise(missing('commander_idcode','NO_COMMANDER')+missing('commander_class','NO_COMMANDER'))+
      value('fleet_assignment','$Ship.assignment')+value('fleet_role','$Ship.assignment.name'))+
    otherwise(missing('reference','UNAVAILABLE_REFERENCE'))+endProfile);
  const contextCaches={seed:'Seed',name:'Name','race.name':'Race',macro:'Macro'};
  const contextField=(field,terminal)=>{
    const key=contextCaches[terminal],expression=`$Host.people.{$Template}.${terminal}`;
    if (!key) return value(field,expression);
    return iff('not md.$LSPStopped and md.$LSPRemaining gt 0',
      iff(`not $Cached${key}Ready`,set(`$Cached${key}Available`,`${expression}?`)+set(`$Cached${key}`,'null')+
        iff(`$Cached${key}Available`,set(`$Cached${key}`,`@${expression}`))+set(`$Cached${key}Ready`,'true'))+
      value(field,`$Cached${key}`,`$Cached${key}Available`))+
      otherwise(value(field,'null','false'));
  };
  const npc=lib('NpcProfile',{Candidate:null},beginProfile('NPC')+
    set('$Actor','$Candidate.$actor')+set('$Host','$Candidate.$host')+set('$Template','$Candidate.$template')+
    Object.values(contextCaches).map(k=>set(`$Cached${k}Ready`,'false')).join('')+
    value('actor_reference','$Actor','true')+value('context_host_reference','$Host','true')+value('npctemplate','$Template','true')+value('discovery_origin','$Candidate.$origin')+
    set('$HasActor','false')+iff(`not md.$LSPStopped and md.$LSPRemaining gt 0 and ${valid('$Actor')}`,iff('$Actor.isclass.npc and $Actor.isplayerowned',set('$HasActor','true')))+
    set('$HasContext','false')+iff(`not md.$LSPStopped and md.$LSPRemaining gt 0 and ${valid('$Host')}`,iff('$Host.isplayerowned and typeof $Template == datatype.npctemplate',iff('@$Host.people.{$Template}.exists',set('$HasContext','true'))))+
    iff('$HasActor',value('seed','$Actor.seed')+value('debugname','$Actor.debugname')+value('name','$Actor.knownname')+value('race','$Actor.race.name')+
      value('sector_name','$Actor.sector.name')+value('role','$Actor.role')+value('role_name','$Actor.role.name')+value('controlpost','$Actor.controlpost')+value('controlpost_name','$Actor.controlpost.name')+
      value('owner','$Actor.owner')+value('trueowner','$Actor.trueowner')+value('container_reference','$Actor.container')+value('macro','$Actor.macro')+
      set('$RoleObject','null')+set('$Controlled','null')+iff('not md.$LSPStopped and md.$LSPRemaining gt 0',set('$RoleObject','@$Actor.roleobject')+set('$Controlled','@$Actor.assignedcontrolled'))+
      value('role_object_reference','$RoleObject','true')+value('assigned_controlled_reference','$Controlled','true')+
      // Two independent relationship fields; never silently choose a container as assignment.
      iff(valid('$RoleObject'),iff('$RoleObject.isclass.ship',value('role_ship_idcode','$RoleObject.idcode'))+otherwise(missing('role_ship_idcode','ASSIGNED_OBJECT_NOT_SHIP')))+otherwise(missing('role_ship_idcode','NO_ROLE_ASSIGNMENT'))+
      iff(valid('$Controlled'),iff('$Controlled.isclass.ship',value('controlled_ship_idcode','$Controlled.idcode'))+otherwise(missing('controlled_ship_idcode','ASSIGNED_OBJECT_NOT_SHIP')))+otherwise(missing('controlled_ship_idcode','NO_CONTROL_ASSIGNMENT'))+
      set('$AssignedShip','null')+set('$AssignmentConflict','false')+
      iff(valid('$RoleObject'),iff('$RoleObject.isclass.ship',set('$AssignedShip','$RoleObject')))+
      iff(valid('$Controlled'),iff('$Controlled.isclass.ship',iff('$AssignedShip == null',set('$AssignedShip','$Controlled'))+otherwise(iff('$AssignedShip != $Controlled',set('$AssignmentConflict','true')))))+
      iff('$AssignmentConflict',missing('assigned_ship_idcode','AMBIGUOUS_ASSIGNMENT')+value('assignment_basis',"'CONFLICTING_ACTOR_RELATIONSHIPS'",'true'))+
      otherwise(iff(valid('$AssignedShip'),value('assigned_ship_idcode','$AssignedShip.idcode')+value('assignment_basis',"'ACTOR_ROLE_OR_CONTROL_RELATIONSHIP'",'true'))+otherwise(missing('assigned_ship_idcode','NO_SHIP_ASSIGNMENT')+value('assignment_basis',"'NO_ACTOR_SHIP_ASSIGNMENT'",'true'))))+
    otherwise(
      iff('$HasContext',contextField('seed','seed')+contextField('name','name')+contextField('race','race.name')+contextField('macro','macro')+contextField('role','role')+contextField('role_name','role.name'))+
      otherwise(['seed','name','race','macro','role','role_name'].map(f=>missing(f,'UNAVAILABLE')).join(''))+
      missing('debugname','NO_ACTOR_OBSERVED')+missing('controlpost','NO_ACTOR_OBSERVED')+missing('controlpost_name','NO_ACTOR_OBSERVED')+
      set('$Onboard','false')+iff('not md.$LSPStopped and md.$LSPRemaining gt 0 and $HasContext',iff('@$Host.availablepeople.{$Template}.exists',iff('not @$Host.people.{$Template}.isintransit',set('$Onboard','true'))))+
      iff('$Onboard',value('sector_name','$Host.sector.name')+value('location_basis',"'HOST_CURRENT_PERSONNEL_ENTRY'",'true'))+
      otherwise(missing('sector_name','UNVERIFIED')+value('location_basis',"'HOST_LOCATION_NOT_ASSERTED'",'true'))+
      iff('$HasContext',iff('$Host.isclass.ship',value('assigned_ship_idcode','$Host.idcode')+value('assignment_basis',"'CONTEXT_HOST_ROSTER_ASSOCIATION'",'true'))+
        otherwise(missing('assigned_ship_idcode','HOST_NOT_SHIP')+value('assignment_basis',"'CONTEXT_HOST_NOT_SHIP'",'true')))+
      otherwise(missing('assigned_ship_idcode','UNAVAILABLE')+value('assignment_basis',"'NO_CONTEXT_ENTRY'",'true')))+
    iff('$HasContext',contextField('contextual_seed','seed')+contextField('contextual_name','name')+contextField('contextual_race','race.name')+contextField('contextual_macro','macro')+
      ['isintransit','istransferscheduled','istemporary'].map(f=>contextField(f,f)).join('')+
      value('context_host_idcode','$Host.idcode')+iff('$Host.isclass.ship',value('roster_ship_idcode','$Host.idcode'))+otherwise(missing('roster_ship_idcode','HOST_NOT_SHIP')))+
    otherwise(missing('contextual_seed','NO_CONTEXT_ENTRY')+missing('contextual_name','NO_CONTEXT_ENTRY'))+endProfile);
  const limited=reason=>set('md.$LSPSnapshotPartial','true')+write(`'DISCOVERY_LIMIT|reason=${reason}'`);
  const addContext=lib('AddContext',{Host:null,Template:null},
    iff('md.$LSPStopped',ret('false'))+
    iff('not md.$LSPContexts.{$Host}?',set('md.$LSPContexts.{$Host}','table[]'))+
    iff('md.$LSPContexts.{$Host}.{$Template}?',ret('true'))+
    iff(`md.$LSPCandidates.count ge ${c.maxCandidates}`,iff('not md.$LSPCandidateLimit',set('md.$LSPCandidateLimit','true')+limited('NPC_CANDIDATES'))+ret('false'))+
    tag('append_to_list',{name:'md.$LSPCandidates',exact:"table[$actor=null, $host=$Host, $template=$Template, $origin='OWNED_HOST_PERSONNEL']"})+
    set('md.$LSPContexts.{$Host}.{$Template}','md.$LSPCandidates.count')+ret('true'));
  const addActor=lib('AddActor',{Actor:null,Host:null,Origin:null},
    iff('md.$LSPStopped',ret('false'))+
    iff(`not (${valid('$Actor')})`,ret('false'))+
    iff('not $Actor.isclass.npc or not $Actor.isplayerowned',ret('false'))+
    iff('md.$LSPActors.{$Actor}?',ret('true'))+
    set('$Template','@$Actor.npctemplate')+set('$Index','0')+
    iff('md.$LSPContexts.{$Host}?',iff('md.$LSPContexts.{$Host}.{$Template}?',set('$Index','md.$LSPContexts.{$Host}.{$Template}')))+
    iff('$Index gt 0',iff('md.$LSPCandidates.{$Index}.$actor == null',set('md.$LSPCandidates.{$Index}.$actor','$Actor')+set('md.$LSPCandidates.{$Index}.$origin',"'CONTEXT_AND_ACTOR'")+set('md.$LSPActors.{$Actor}','$Index')+ret('true')))+
    iff(`md.$LSPCandidates.count ge ${c.maxCandidates}`,iff('not md.$LSPCandidateLimit',set('md.$LSPCandidateLimit','true')+limited('NPC_CANDIDATES'))+ret('false'))+
    tag('append_to_list',{name:'md.$LSPCandidates',exact:'table[$actor=$Actor, $host=$Host, $template=$Template, $origin=$Origin]'})+
    set('md.$LSPActors.{$Actor}','md.$LSPCandidates.count')+ret('true'));
  const finishHost=lib('FinishDiscoveryHost',{},
    write("'DISCOVERY_HOST|host_index=%s|host_reference=%s|state=END|templates_found=%s|roster_actors_found=%s|candidates_added=%s|candidates_total=%s|limited=%s'.[md.$LSPHostIndex, md.$LSPHost, md.$LSPPeopleCount, md.$LSPActorCount, md.$LSPCandidates.count - md.$LSPHostBefore, md.$LSPCandidates.count, md.$LSPCandidateLimit]")+
    set('md.$LSPReadyCandidates','md.$LSPCandidates.count')+add('md.$LSPHostIndex')+add('md.$LSPHostsVisited')+
    set('md.$LSPDiscoveryStage',"'HOST'")+set('md.$LSPHost','null')+
    ['People','RosterActors','Posts'].map(k=>set('md.$LSP'+k,'[]')).join('')+ret('true'));
  const hostGap=reason=>add('md.$LSPHostsSkipped')+set('md.$LSPSnapshotPartial','true')+
    write("'DISCOVERY_GAP|reason="+reason+"|host_index=%s|host_reference=%s'.[md.$LSPHostIndex, md.$LSPHost]")+run('FinishDiscoveryHost')+ret('false');
  const collection=(name,expression,count,limit,reason)=>set(name,'@'+expression)+
    iff('typeof '+name+' == datatype.list',set(count,name+'.count')+set(limit,'['+name+'.count, '+c.personnelPerHost+'].min')+
      iff(name+'.count gt '+limit,limited(reason)))+
    otherwise(set(name,'[]')+set(limit,'0')+set('md.$LSPSnapshotPartial','true')+write("'DISCOVERY_GAP|reason="+reason+"_UNAVAILABLE'"));
  const discover=lib('DiscoveryStep',{},
    iff('md.$LSPStopped',ret('false'))+
    iff("md.$LSPDiscoveryStage == 'HOST'",
      set('md.$LSPHost','md.$LSPHosts.{md.$LSPHostIndex}')+set('md.$LSPHostBefore','md.$LSPCandidates.count')+
      set('md.$LSPPeopleCount',"'UNAVAILABLE'")+set('md.$LSPActorCount',"'UNAVAILABLE'")+
      write("'DISCOVERY_HOST|host_index=%s|host_reference=%s|state=BEGIN'.[md.$LSPHostIndex, md.$LSPHost]")+
      iff('md.$LSPStopped',ret('false'))+
      iff('not ('+valid('md.$LSPHost')+')',hostGap('HOST_UNAVAILABLE'))+
      iff('not md.$LSPHost.isplayerowned',hostGap('HOST_NOT_PLAYER_OWNED'))+
      collection('md.$LSPPeople','md.$LSPHost.people.list','md.$LSPPeopleCount','md.$LSPPeopleLimit','CONTEXTUAL_ROSTER')+
      iff('md.$LSPStopped',ret('false'))+
      collection('md.$LSPRosterActors','md.$LSPHost.roleentities','md.$LSPActorCount','md.$LSPActorLimit','ACTOR_RESULTS')+
      iff('md.$LSPStopped',ret('false'))+
      collection('md.$LSPPosts','md.$LSPHost.controlposts.all','$PostCount','md.$LSPPostLimit','CONTROL_POSTS')+
      iff('md.$LSPStopped',ret('false'))+
      set('md.$LSPEntry','1')+set('md.$LSPDiscoveryStage',"'PEOPLE'")+ret('true'))+
    iff('not ('+valid('md.$LSPHost')+')',hostGap('HOST_UNAVAILABLE'))+
    iff('not md.$LSPHost.isplayerowned',hostGap('HOST_NOT_PLAYER_OWNED'))+
    iff("md.$LSPDiscoveryStage == 'PEOPLE'",
      iff('md.$LSPEntry le md.$LSPPeopleLimit',run('AddContext',{Host:'md.$LSPHost',Template:'md.$LSPPeople.{md.$LSPEntry}'})+add('md.$LSPEntry'))+
      otherwise(set('md.$LSPEntry','1')+set('md.$LSPDiscoveryStage',"'ACTORS'"))+ret('true'))+
    iff("md.$LSPDiscoveryStage == 'ACTORS'",
      iff('md.$LSPEntry le md.$LSPActorLimit',run('AddActor',{Host:'md.$LSPHost',Actor:'md.$LSPRosterActors.{md.$LSPEntry}',Origin:"'PERSONNEL_ROSTER_ACTOR'"})+add('md.$LSPEntry'))+
      otherwise(set('md.$LSPDiscoveryStage',"'PILOT'"))+ret('true'))+
    iff("md.$LSPDiscoveryStage == 'PILOT'",run('AddActor',{Host:'md.$LSPHost',Actor:'@md.$LSPHost.assignedaipilot',Origin:"'PERSONNEL_PILOT'"})+set('md.$LSPDiscoveryStage',"'MANAGER'")+ret('true'))+
    iff("md.$LSPDiscoveryStage == 'MANAGER'",iff('md.$LSPHost.isclass.station',run('AddActor',{Host:'md.$LSPHost',Actor:'@md.$LSPHost.tradenpc',Origin:"'PERSONNEL_MANAGER'"}))+set('md.$LSPDiscoveryStage',"'TRADER'")+ret('true'))+
    iff("md.$LSPDiscoveryStage == 'TRADER'",iff('md.$LSPHost.isclass.station',run('AddActor',{Host:'md.$LSPHost',Actor:'@md.$LSPHost.shiptrader',Origin:"'PERSONNEL_SHIPTRADER'"}))+set('md.$LSPEntry','1')+set('md.$LSPDiscoveryStage',"'POSTS'")+ret('true'))+
    iff("md.$LSPDiscoveryStage == 'POSTS'",
      iff('md.$LSPEntry le md.$LSPPostLimit',run('AddActor',{Host:'md.$LSPHost',Actor:'@md.$LSPHost.assignedcontrolentity.{md.$LSPPosts.{md.$LSPEntry}}',Origin:"'CONTROL_ASSIGNMENT'"})+add('md.$LSPEntry'))+
      otherwise(set('md.$LSPDiscoveryStage',"'ASSIGNED_PILOT'"))+ret('true'))+
    run('AddActor',{Host:'md.$LSPHost',Actor:'@md.$LSPHost.assignedpilot',Origin:"'PILOT_ASSIGNMENT'"})+run('FinishDiscoveryHost')+ret('true'));
  const find=(kind,name,owned)=>tag(`find_${kind}`,{name,space:'player.galaxy',...(owned?{trueowner:'faction.player'}:{}),multiple:'true',...(kind === 'ship' ? {recursive:'true'} : {}),checkoperational:'false'});
  const begin=lib('BeginSnapshot',{},iff('md.$LSPSnapshotStarted or not md.$LSPNeedBaseline or not md.$LSPEventsReady',ret('false'))+set('md.$LSPSnapshotStarted','true')+add('md.$LSPSeq')+set('md.$LSPProfile','0L')+set('md.$LSPSnapshotPartial','false')+set('md.$LSPActive','true')+set('md.$LSPPass',"'STATIONS'")+set('md.$LSPIndex','1')+
    find('station','md.$LSPStations',true)+find('ship','md.$LSPShips',true)+
    write(identityMetadata('SNAPSHOT_BEGIN|mode=OBJECT_PROFILES|passes=STATIONS,SHIPS,NPCS|atomic=false|discovery_complete=UNVERIFIED'))+
    iff('not md.$LSPStopped',completionPanel(WELCOME))+
    iff('not md.$LSPStopped',run('ProcessPlayerObservation'))+
    write("'PASS_BEGIN|kind=STATIONS'"));
  const startNpc= set('md.$LSPHosts','md.$LSPStations.clone')+
    each('$Host','md.$LSPShips',iff('md.$LSPHosts.indexof.{$Host} == 0',tag('append_to_list',{name:'md.$LSPHosts',exact:'$Host'})))+
    set('md.$LSPHostCount',`[md.$LSPHosts.count, ${c.maxDiscoveryHosts}].min`)+iff('md.$LSPHosts.count gt md.$LSPHostCount',limited('HOSTS'))+
    set('md.$LSPHostIndex','1')+set('md.$LSPHostsVisited','0')+set('md.$LSPHostsSkipped','0')+set('md.$LSPNpcProfiles','0')+
    set('md.$LSPReadyCandidates','0')+set('md.$LSPDiscoveryStage',"'HOST'")+set('md.$LSPEntry','1')+
    set('md.$LSPIndex','1')+set('md.$LSPDiscoveryDone','false')+set('md.$LSPCandidates','[]')+set('md.$LSPContexts','table[]')+set('md.$LSPActors','table[]')+set('md.$LSPCandidateLimit','false')+
    set('md.$LSPPass',"'NPCS'")+write("'DISCOVERY_BEGIN|scope=PLAYER_OWNED_PERSONNEL_LIST|actor_filter=PLAYER_TRUEOWNER|context_filter=OWNED_HOST_PROXY|hosts_available=%s|hosts_limit=%s|global_registry=UNAVAILABLE|spacesuits=SHIP_SUBCLASS'.[md.$LSPHosts.count, md.$LSPHostCount]");
  const advance=lib('Advance',{},
    iff("md.$LSPPass == 'STATIONS'",write("'PASS_END|kind=STATIONS'")+set('md.$LSPPass',"'SHIPS'")+set('md.$LSPIndex','1')+write("'PASS_BEGIN|kind=SHIPS'")+ret('true'))+
    iff("md.$LSPPass == 'SHIPS'",write("'PASS_END|kind=SHIPS'")+write("'PASS_BEGIN|kind=NPCS'")+startNpc+ret('true'))+
    iff("md.$LSPPass == 'NPCS'",write("'PASS_END|kind=NPCS'")+write("'SNAPSHOT_END|mode=OBJECT_PROFILES|profiles=%s|partial=%s|atomic=false|discovery_complete=UNVERIFIED'.[md.$LSPProfile, md.$LSPSnapshotPartial]")+
      set('md.$LSPActive','false')+set('md.$LSPAwaitCommit','true')+set('md.$LSPEndRecord','md.$LSPRecord')+
      ['Stations','Ships','Hosts','Candidates'].map(k=>set(`md.$LSP${k}`,'[]')).join('')+set('md.$LSPActors','table[]')+set('md.$LSPContexts','table[]')+ret('true'))+ret('false'));
  const invalidate=lib('InvalidateRecorder',{},
    set('md.$LSPReady','false')+set('md.$LSPActive','false')+set('md.$LSPStopped','true')+set('md.$LSPEventsReady','false')+set('md.$LSPPending','false')+
    iff('md.$LSPInitialisedRun?',tag('remove_value',{name:'md.$LSPInitialisedRun'}))+
    iff('md.$LSPBusArmedRun?',tag('remove_value',{name:'md.$LSPBusArmedRun'}))+
    tag('reset_cue',{cue:'ProfileEventBus'})+tag('cancel_cue',{cue:'ProfileEventBusV2'})+ret('true'));
  const queueRun=lib('QueueRun',{},
    // A restored save is not permission to append retrospective rows to its old files.
    run('InvalidateRecorder')+tag('reset_cue',{cue:'ProfileEventBusV2'})+
    set('md.$LSPPendingLoadedAt',"player.systemtime.{'%Y-%m-%d_%H-%M-%S'}")+
    tag('set_value',{name:'$NonceA',min:'0',max:'2147483647'})+tag('set_value',{name:'$NonceB',min:'0',max:'2147483647'})+
    set('md.$LSPPendingRun',"'session-%s-%s-loaded-%s'.[$NonceA, $NonceB, md.$LSPPendingLoadedAt]")+
    set('md.$LSPPending','true')+tag('reset_cue',{cue:'Bootstrap'})+ret('true'));
  const initialize=lib('Initialize',{},
    iff('not md.$LSPPending',ret('false'))+
    set('md.$LSPReady','false')+set('md.$LSPStopped','true')+set('md.$LSPEventsReady','false')+
    set('md.$LSPRun','md.$LSPPendingRun')+set('md.$LSPLoadedAt','md.$LSPPendingLoadedAt')+
    set('md.$LSPProfileFile',"'profiles-%s.log'.[md.$LSPRun]")+
    set('md.$LSPDiagnosticFile',"'profile-diagnostics-%s.log'.[md.$LSPRun]")+set('md.$LSPPending','false')+
    ['Seq','Rows','DiagnosticRows','Profile','Record','Acknowledged'].map(k=>set(`md.$LSP${k}`,'0L')).join('')+set('md.$LSPActive','false')+set('md.$LSPLevel',String(levels.indexOf(c.diagnostics)))+
    set('md.$LSPDatabaseState',"'WAITING'")+set('md.$LSPAwaitCommit','false')+set('md.$LSPNeedBaseline','false')+set('md.$LSPDatabasePoll','player.age')+set('md.$LSPDatabaseDeadline','player.age + 30s')+
    set('md.$LSPParentRun',"'NONE'")+set('md.$LSPParentRecord','0L')+
    iff('UniverseIdentity.$CheckpointRun? and UniverseIdentity.$CheckpointRecord?',
      set('md.$LSPParentRun','UniverseIdentity.$CheckpointRun')+set('md.$LSPParentRecord','UniverseIdentity.$CheckpointRecord'))+
    set('md.$LSPLastAge','player.age')+set('md.$LSPSnapshotStarted','false')+set('md.$LSPNextHeartbeat',`player.age + ${c.heartbeatSeconds}s`)+
    set('md.$LSPPass',"'IDLE'")+set('md.$LSPHostsVisited','0')+set('md.$LSPHostsSkipped','0')+set('md.$LSPHostCount','0')+set('md.$LSPNpcProfiles','0')+set('md.$LSPCandidates','[]')+
    set('md.$LSPPersonnelVersion','3')+set('md.$LSPNextAssetTick','player.age')+
    set('md.$LSPDiscoveryStage',"'HOST'")+set('md.$LSPEntry','1')+set('md.$LSPTypeEscapes','table[]')+
    run('EnsureUniverseIdentity')+events.initialize+playerProfile.initialize+
    set('md.$LSPStartupVersion','1')+set('md.$LSPInitialisedRun','md.$LSPRun')+set('md.$LSPStopped','false')+set('md.$LSPReady','true')+
    write(identityMetadata(`RUN_BEGIN|collector=OBJECT_PROFILES|gameplay_listeners=${profileEvents.length}|lifecycle_listeners=2|startup_protocol=STAGED_V1|early_restore_coverage=UNVERIFIED|max_rows=NONE|snapshot_schedule=DATABASE_INITIAL_ONLY|session_basis=RECORDER_LOCAL|loaded_at=%s|load_time_basis=UNIVERSE_GENERATED_CALLBACK|write_confirmation=UNAVAILABLE`,['md.$LSPLoadedAt']))+
    run('Write',{Diagnostic:'true',Body:identityMetadata('RUN_BEGIN|collector=OBJECT_PROFILES|snapshot_schedule=INITIAL_ONLY|session_basis=RECORDER_LOCAL|loaded_at=%s',['md.$LSPLoadedAt'])})+
    set('md.$LSPBusArmedRun','md.$LSPRun')+tag('signal_cue',{cue:'ProfileEventBusV2'})+ret('true'));
  const tick=lib('Tick',{},
    iff(`not (${eventReady})`,ret('false'))+
    iff('not md.$LSPPersonnelVersion?',ret('false'))+
    iff('md.$LSPPersonnelVersion != 3',ret('false'))+
    iff('player.age lt md.$LSPLastAge',iff('md.$LSPActive',write("'SNAPSHOT_INTERRUPTED|reason=CLOCK_REGRESSION'"))+
      set('md.$LSPActive','false')+set('md.$LSPStopped','true')+set('md.$LSPReady','false')+ret('false'))+set('md.$LSPLastAge','player.age')+
    iff('md.$LSPStopped',ret('false'))+
    iff("md.$LSPDatabaseState == 'READY' or md.$LSPActive",run('ProcessPlayerObservation'))+
    run('ProcessHistoryWork')+
    iff("(not md.$LSPActive or md.$LSPPass != 'NPCS') and player.age lt md.$LSPNextAssetTick",ret('false'))+
    iff("not md.$LSPActive or md.$LSPPass != 'NPCS'",set('md.$LSPNextAssetTick','player.age + 1s'))+
    iff("md.$LSPDatabaseState == 'READY' or md.$LSPActive",run('PollPlayerState'))+
    iff("md.$LSPDatabaseState != 'READY' and player.age ge md.$LSPDatabasePoll",
      set('md.$LSPDatabasePoll','player.age + 1s')+tag('raise_lua_event',{name:"'LifeSignsDatabaseRequest'",param:"'%s|%s'.[md.$LSPRun, md.$LSPUniverseIdText]"}))+
    iff("md.$LSPDatabaseState == 'WAITING' and player.age ge md.$LSPDatabaseDeadline",completionPanel(DATABASE_ERROR)+set('md.$LSPStopped','true')+ret('false'))+
    run('ProcessAssignmentObservations')+
    run('ProcessCrewRoleObservations')+
    run('ProcessOrderObservations')+
    iff('not md.$LSPSnapshotStarted and md.$LSPNeedBaseline',run('BeginSnapshot'))+
    iff('not md.$LSPActive',run('ProcessNewProfiles'))+
    iff('not md.$LSPActive',ret('true'))+
    iff("md.$LSPPass == 'NPCS' and md.$LSPActive and not md.$LSPDiscoveryDone",
      tag('do_all',{exact:String(c.discoveryPerTick)},iff('md.$LSPStopped or md.$LSPHostIndex gt md.$LSPHostCount or md.$LSPCandidateLimit',tag('break'))+
        run('DiscoveryStep'))+
      iff('md.$LSPHostIndex gt md.$LSPHostCount or md.$LSPCandidateLimit',
        iff("md.$LSPCandidateLimit and md.$LSPDiscoveryStage != 'HOST'",run('FinishDiscoveryHost'))+
        set('md.$LSPReadyCandidates','md.$LSPCandidates.count')+
        write("'DISCOVERY_END|hosts_visited=%s|hosts_skipped=%s|candidates=%s|complete=UNVERIFIED'.[md.$LSPHostsVisited, md.$LSPHostsSkipped, md.$LSPCandidates.count]")+set('md.$LSPDiscoveryDone','true')))+
    tag('do_all',{exact:`if md.$LSPPass == 'NPCS' then ${c.npcProfilesPerTick} else ${c.profilesPerTick}`},iff('md.$LSPStopped or not md.$LSPActive',tag('break'))+
      iff("md.$LSPPass == 'STATIONS'",iff('md.$LSPIndex le md.$LSPStations.count',run('StationProfile',{Station:'md.$LSPStations.{md.$LSPIndex}'})+add('md.$LSPIndex'))+otherwise(run('Advance')))+
      tag('do_elseif',{value:"md.$LSPPass == 'SHIPS'"},iff('md.$LSPIndex le md.$LSPShips.count',run('ShipProfile',{Ship:'md.$LSPShips.{md.$LSPIndex}'})+add('md.$LSPIndex'))+otherwise(run('Advance')))+
      tag('do_elseif',{value:"md.$LSPPass == 'NPCS'"},iff('md.$LSPIndex le md.$LSPReadyCandidates',run('NpcProfile',{Candidate:'md.$LSPCandidates.{md.$LSPIndex}'})+add('md.$LSPIndex')+add('md.$LSPNpcProfiles'))+otherwise(iff('md.$LSPDiscoveryDone',run('Advance'))+otherwise(tag('break'))))+
      otherwise(tag('break')))+
    iff('player.age ge md.$LSPNextHeartbeat',set('md.$LSPNextHeartbeat',`player.age + ${c.heartbeatSeconds}s`)+iff('md.$LSPLevel ge 3',run('Write',{Diagnostic:'true',Body:"'HEALTH|collector=OBJECT_PROFILES|gameplay_listeners="+profileEvents.length+"|rows_attempted=%s|writes_confirmed=UNAVAILABLE|native_getter_errors=UNAVAILABLE|active=%s|phase=%s|hosts_visited=%s|hosts_limit=%s|hosts_skipped=%s|npc_candidates_buffered=%s|npc_profiles_attempted=%s|discovery_stage=%s|discovery_entry=%s'.[md.$LSPRows, md.$LSPActive, md.$LSPPass, md.$LSPHostsVisited, md.$LSPHostCount, md.$LSPHostsSkipped, md.$LSPCandidates.count, md.$LSPNpcProfiles, md.$LSPDiscoveryStage, md.$LSPEntry]"})))+ret('true'));
  const lifecycle=tag('cue',{name:'RunBoundary',instantiate:'true'},tag('conditions',{},tag('event_universe_generated'))+tag('actions',{},run('QueueRun')));
  const loaded=tag('cue',{name:'InvalidateLoadedRecorder',instantiate:'true'},tag('conditions',{},tag('event_game_loaded'))+tag('actions',{},run('InvalidateRecorder')));
  const databaseReply=lib('DatabaseReply',{Response:null},
    iff(`not (${ready})`,ret('false'))+
    iff('typeof $Response != datatype.list',ret('false'))+iff('$Response.count != 4',ret('false'))+
    iff('$Response.{1} != md.$LSPRun or $Response.{2} != md.$LSPUniverseIdText',ret('false'))+
    iff('not (typeof $Response.{4}).isnumeric',ret('false'))+
    iff('$Response.{4} lt 0 or $Response.{4} gt md.$LSPRecord',ret('false'))+
    iff("$Response.{3} == 'ERROR'",completionPanel(DATABASE_ERROR)+set('md.$LSPStopped','true')+ret('false'))+
    iff('$Response.{4} lt md.$LSPAcknowledged',ret('false'))+
    iff("$Response.{3} != 'READY' and $Response.{3} != 'NEED_BASELINE' and $Response.{3} != 'BUILDING'",ret('false'))+
    set('md.$LSPAcknowledged','$Response.{4}')+
    events.acknowledge+
    set('UniverseIdentity.$CheckpointRun','md.$LSPRun')+set('UniverseIdentity.$CheckpointRecord','$Response.{4}')+
    set('md.$LSPDatabaseState','$Response.{3}')+
    iff("$Response.{3} == 'NEED_BASELINE' and not md.$LSPSnapshotStarted",set('md.$LSPNeedBaseline','true'))+
    iff("$Response.{3} == 'READY'",set('md.$LSPNeedBaseline','false')+
      iff('md.$LSPAwaitCommit',iff('$Response.{4} ge md.$LSPEndRecord',set('md.$LSPAwaitCommit','false')+completionPanel(CREATED))))+ret('true'));
  const databaseListener=tag('cue',{name:'DatabaseResponse',instantiate:'true'},tag('conditions',{},tag('event_ui_triggered',{screen:"'LifeSignsDatabase'",control:"'reply'"}))+tag('actions',{},run('DatabaseReply',{Response:'event.param3'})));
  const databaseHealth=tag('cue',{name:'DatabaseHealth',instantiate:'true'},tag('conditions',{},tag('event_ui_triggered',{screen:"'LifeSignsDatabase'",control:"'health'"}))+tag('actions',{},
    iff('md.$LSPReady? and md.$LSPReady and typeof event.param3 == datatype.list',iff('event.param3.count == 3',
      iff('event.param3.{1} == md.$LSPRun and event.param3.{2} == md.$LSPUniverseIdText',
        run('Write',{Diagnostic:'true',Body:"'DATABASE_TRANSPORT|stage=%s'.[event.param3.{3}]"}))))));
  const polling=tag('cue',{name:'Bootstrap',checkinterval:'1s'},tag('conditions',{},tag('check_value',{value:'md.$LSPPending? and md.$LSPPending and player.entity.exists and player.galaxy'}))+tag('actions',{},run('Initialize'))+
    tag('cues',{},tag('cue',{name:'ProcessingTick',instantiate:'true',checkinterval:`${c.npcTickSeconds}s`},tag('conditions',{},tag('check_value',{value:'md.$LSPReady and not md.$LSPStopped'}))+tag('actions',{},run('Tick')))));
  return `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated database-aware collector. Edit recorder/md-generator.mjs, then rebuild. -->\n<mdscript name="LifeSigns_EventRecorder" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="../../libraries/md.xsd"><cues>${identity}${lifecycle}${databaseListener}${databaseHealth}${events.crewListener}${events.renameListener}${polling}${events.cues}${loaded}${escape}${ensureIdentity}${writer}${val}${station}${ship}${npc}${addContext}${addActor}${finishHost}${discover}${begin}${advance}${queueRun}${invalidate}${initialize}${databaseReply}${tick}${events.libraries}${playerProfile.libraries}</cues></mdscript>\n`.replaceAll('><','>\n<');
}
