// Snapshot-only MD compiler. No native/UI/lifecycle event subscriptions.
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
const value = (field, expression, available = `${expression}?`, state = "'AUTO'") => iff('not md.$LSPStopped', iff('md.$LSPRemaining gt 0', run('Value',{Field:`'${field}'`,Value:`@${expression}`,Available:available,State:state})) + otherwise(run('Value',{Field:`'${field}'`,Value:'null',Available:'false',State:state})));
const missing = (field, state) => value(field,'null','false',`'${state}'`);
const valid = ref => `typeof ${ref} == datatype.component and ${ref}.exists`;
const levels = ['OFF','ERROR','WARNING','INFO','DEBUG'];
export function validateConfig(c) {
  const bounds = {periodSeconds:[10,86400],heartbeatSeconds:[10,3600],profilesPerTick:[1,64],discoveryPerTick:[1,64],personnelPerHost:[1,1024],profileValueItems:[16,16384],maxCandidates:[1,100000],maxDiscoveryHosts:[1,100000],maxRowsPerRun:[1000,10000000]};
  if (!c || Object.keys(c).sort().join() !== ['diagnostics',...Object.keys(bounds)].sort().join()) throw Error('Unexpected profile configuration keys');
  if (!levels.includes(c.diagnostics)) throw Error('Invalid diagnostics level');
  for (const [k,[min,max]] of Object.entries(bounds)) if(!Number.isSafeInteger(c[k])||c[k]<min||c[k]>max)throw Error(`Invalid ${k}`);
  return c;
}
export function generateRecorder(config) {
  const c=validateConfig(config);
  const escape=lib('Escape',{Value:null},set('$Text',"'%s'.[$Value]")+[['%','%25'],['|','%7C'],['\\n','%0A'],['\\r','%0D'],['\\t','%09']].map(([a,b])=>tag('substitute_text',{text:'$Text'},tag('replace',{string:`'${a}'`,with:`'${b}'`}))).join('')+ret('$Text'));
  const writer=lib('Write',{Body:null,Diagnostic:'false'},
    iff('$Diagnostic and md.$LSPLevel == 0',ret('false'))+
    iff('md.$LSPStopped',ret('false'))+
    set('$Session',"'UNAVAILABLE'")+
    iff('md.$LifeSignsProductionSessionReady? and md.$LifeSignsProductionSessionKey?',iff("md.$LifeSignsProductionSessionReady and md.$LifeSignsProductionSessionKey != ''",set('$Session','md.$LifeSignsProductionSessionKey')))+
    iff(`not $Diagnostic and md.$LSPRows ge ${c.maxRowsPerRun}L`,
      set('md.$LSPStopped','true')+tag('debug_to_file',{name:"'profiles.log'",directory:"'lifesigns-event-recorder'",append:'true',text:"'LSEV1|run=%s|session=%s|seq=%s|age=%s|LIMIT|reason=MAX_ROWS|capture_stopped=true|END'.[md.$LSPRun, $Session, md.$LSPSeq, player.age]"})+ret('false'))+
    iff(`$Diagnostic and md.$LSPDiagnosticRows ge ${c.maxRowsPerRun}L`,ret('false'))+
    set('$Line',"'LSEV1|run=%s|session=%s|seq=%s|age=%s|%s|END'.[md.$LSPRun, $Session, md.$LSPSeq, player.age, $Body]")+
    iff('$Diagnostic',add('md.$LSPDiagnosticRows')+tag('debug_to_file',{name:"'profile-diagnostics.log'",directory:"'lifesigns-event-recorder'",append:'true',text:'$Line'}))+
    otherwise(add('md.$LSPRows')+tag('debug_to_file',{name:"'profiles.log'",directory:"'lifesigns-event-recorder'",append:'true',text:'$Line'}))+ret('true'));
  const val=lib('Value',{Field:null,Value:null,Available:'true',State:"'AUTO'"},
    iff('md.$LSPStopped',ret('false'))+
    iff('md.$LSPRemaining le 0',iff('not md.$LSPValueLimit',set('md.$LSPValueLimit','true')+set('md.$LSPProfilePartial','true')+write("'PROFILE_LIMIT|reason=VALUE_BUDGET'"))+ret('false'))+
    add('md.$LSPRemaining','-1')+set('$Type',"'UNAVAILABLE'")+set('$Text',"''")+
    iff("$State == 'AUTO'",set('$State',"'UNAVAILABLE'")+
      iff('$Available',set('$Type','typeof $Value')+set('$State',"'PRESENT'")+set('$Text',"'%s'.[$Value]")+
        iff('typeof $Value == datatype.null',set('$State',"'NULL'"))+
        iff('typeof $Value == datatype.component',iff('not $Value.exists',set('$State',"'UNAVAILABLE_REFERENCE'")))))+
    iff("$State == 'UNAVAILABLE' or $State == 'UNAVAILABLE_REFERENCE' or $State == 'UNVERIFIED' or $State == 'AMBIGUOUS_ASSIGNMENT'",set('md.$LSPProfilePartial','true'))+
    run('Escape',{Value:'$Field'},'$FieldText')+run('Escape',{Value:'$Text'},'$Text')+run('Escape',{Value:'$Type'},'$TypeText')+
    write("'VALUE|profile=%s|field=%s|type=%s|state=%s|render=ENGINE_TEXT_UNVERIFIED|value=%s'.[md.$LSPProfile, $FieldText, $TypeText, $State, $Text]")+ret('true'));
  const beginProfile=type=>set('md.$LSPProfilePartial','false')+set('md.$LSPValueLimit','false')+set('md.$LSPRemaining',String(c.profileValueItems))+add('md.$LSPProfile')+write(`'PROFILE_BEGIN|profile=%s|kind=${type}|atomic=false'.[md.$LSPProfile]`);
  const endProfile=write("'PROFILE_END|profile=%s|partial=%s'.[md.$LSPProfile, md.$LSPProfilePartial]")+iff('md.$LSPProfilePartial',set('md.$LSPSnapshotPartial','true'))+ret('true');
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
      missing('personnel_onboard','UNVERIFIED')+value('onboard_template_personnel','$Ship.availablepeople.count')+value('assigned_template_personnel','$Ship.people.count')+
      value('commander_reference','$Commander','true')+
      iff(valid('$Commander'),value('commander_idcode','$Commander.idcode')+value('commander_class','$Commander.class'))+otherwise(missing('commander_idcode','NO_COMMANDER')+missing('commander_class','NO_COMMANDER'))+
      value('fleet_assignment','$Ship.assignment')+value('fleet_role','$Ship.assignment.name'))+
    otherwise(missing('reference','UNAVAILABLE_REFERENCE'))+endProfile);
  const contextField=(field,terminal)=>value(field,`$Host.people.{$Template}.${terminal}`);
  const npc=lib('NpcProfile',{Candidate:null},beginProfile('NPC')+
    set('$Actor','$Candidate.$actor')+set('$Host','$Candidate.$host')+set('$Template','$Candidate.$template')+
    value('actor_reference','$Actor','true')+value('context_host_reference','$Host','true')+value('npctemplate','$Template','true')+value('discovery_origin','$Candidate.$origin')+
    set('$HasActor','false')+iff(`not md.$LSPStopped and md.$LSPRemaining gt 0 and ${valid('$Actor')}`,iff('$Actor.isclass.npc',set('$HasActor','true')))+
    set('$HasContext','false')+iff(`not md.$LSPStopped and md.$LSPRemaining gt 0 and ${valid('$Host')}`,iff('typeof $Template == datatype.npctemplate',iff('@$Host.people.{$Template}.exists',set('$HasContext','true'))))+
    iff('$HasActor',value('seed','$Actor.seed')+value('idcode','$Actor.idcode')+value('debugname','$Actor.debugname')+value('name','$Actor.knownname')+value('race','$Actor.race.name')+
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
      missing('idcode','UNVERIFIED')+missing('debugname','NO_ACTOR_OBSERVED')+missing('controlpost','NO_ACTOR_OBSERVED')+missing('controlpost_name','NO_ACTOR_OBSERVED')+
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
  const discover=lib('DiscoverHost',{Host:null},
    iff('md.$LSPStopped',ret('false'))+iff(`not (${valid('$Host')})`,set('md.$LSPSnapshotPartial','true')+write("'DISCOVERY_GAP|reason=HOST_UNAVAILABLE'")+ret('false'))+
    iff('$Host.isplayerowned',set('$People','@$Host.people.list')+
      iff('typeof $People == datatype.list',set('$Count',`[$People.count, ${c.personnelPerHost}].min`)+
        tag('do_all',{exact:'$Count',counter:'$Index'},iff('md.$LSPStopped or md.$LSPCandidateLimit',tag('break'))+run('AddContext',{Host:'$Host',Template:'$People.{$Index}'}))+
        iff('$People.count gt $Count',limited('CONTEXTUAL_ROSTER')))+otherwise(set('md.$LSPSnapshotPartial','true')+write("'DISCOVERY_GAP|reason=CONTEXTUAL_COLLECTION_UNAVAILABLE'")))+
    // Passive component search also finds player actors on non-player discovery hosts.
    tag('find_object_component',{name:'$Actors',object:'$Host',class:'class.npc',trueowner:'faction.player',multiple:'true',recursive:'true',checkoperational:'false'})+
    iff('typeof $Actors == datatype.list',set('$Count',`[$Actors.count, ${c.personnelPerHost}].min`)+
      tag('do_all',{exact:'$Count',counter:'$Index'},iff('md.$LSPStopped or md.$LSPCandidateLimit',tag('break'))+run('AddActor',{Actor:'$Actors.{$Index}',Host:'$Host',Origin:"'COMPONENT_SEARCH'"}))+
      iff('$Actors.count gt $Count',limited('ACTOR_RESULTS')))+otherwise(set('md.$LSPSnapshotPartial','true')+write("'DISCOVERY_GAP|reason=ACTOR_COLLECTION_UNAVAILABLE'"))+
    // Scalar assignment references supplement search results; deduplicate by actual component.
    set('$Posts','@$Host.controlposts.all')+
    iff('typeof $Posts == datatype.list',set('$Count',`[$Posts.count, ${c.personnelPerHost}].min`)+
      tag('do_all',{exact:'$Count',counter:'$Index'},iff('md.$LSPStopped or md.$LSPCandidateLimit',tag('break'))+run('AddActor',{Actor:'@$Host.assignedcontrolentity.{$Posts.{$Index}}',Host:'$Host',Origin:"'CONTROL_ASSIGNMENT'"}))+
      iff('$Posts.count gt $Count',limited('CONTROL_POSTS')))+otherwise(set('md.$LSPSnapshotPartial','true')+write("'DISCOVERY_GAP|reason=CONTROL_POST_COLLECTION_UNAVAILABLE'"))+
    run('AddActor',{Actor:'@$Host.assignedpilot',Host:'$Host',Origin:"'PILOT_ASSIGNMENT'"})+ret('true'));
  const find=(kind,name,owned)=>tag(`find_${kind}`,{name,space:'player.galaxy',...(owned?{trueowner:'faction.player'}:{}),multiple:'true',...(kind === 'ship' ? {recursive:'true'} : {}),checkoperational:'false'});
  const begin=lib('BeginSnapshot',{},add('md.$LSPSeq')+set('md.$LSPProfile','0L')+set('md.$LSPSnapshotPartial','false')+set('md.$LSPActive','true')+set('md.$LSPPass',"'STATIONS'")+set('md.$LSPIndex','1')+
    find('station','md.$LSPStations',true)+find('ship','md.$LSPShips',true)+
    write("'SNAPSHOT_BEGIN|mode=OBJECT_PROFILES|passes=STATIONS,SHIPS,NPCS|atomic=false|discovery_complete=UNVERIFIED'")+
    write("'PASS_BEGIN|kind=STATIONS'"));
  const startNpc= find('station','$AllStations',false)+find('ship','$AllShips',false)+set('md.$LSPHosts','$AllStations.clone')+
    each('$Host','$AllShips',iff('md.$LSPHosts.indexof.{$Host} == 0',tag('append_to_list',{name:'md.$LSPHosts',exact:'$Host'})))+
    set('md.$LSPHostCount',`[md.$LSPHosts.count, ${c.maxDiscoveryHosts}].min`)+iff('md.$LSPHosts.count gt md.$LSPHostCount',limited('HOSTS'))+
    set('md.$LSPHostIndex','1')+set('md.$LSPCandidates','[]')+set('md.$LSPContexts','table[]')+set('md.$LSPActors','table[]')+set('md.$LSPCandidateLimit','false')+
    set('md.$LSPPass',"'NPC_DISCOVERY'")+write("'DISCOVERY_BEGIN|scope=ALL_ENUMERATED_SHIP_STATION_HOSTS|actor_filter=PLAYER_TRUEOWNER|context_filter=OWNED_HOST_PROXY|global_registry=UNAVAILABLE|spacesuits=SHIP_SUBCLASS'");
  const advance=lib('Advance',{},
    iff("md.$LSPPass == 'STATIONS'",write("'PASS_END|kind=STATIONS'")+set('md.$LSPPass',"'SHIPS'")+set('md.$LSPIndex','1')+write("'PASS_BEGIN|kind=SHIPS'")+ret('true'))+
    iff("md.$LSPPass == 'SHIPS'",write("'PASS_END|kind=SHIPS'")+write("'PASS_BEGIN|kind=NPCS'")+startNpc+ret('true'))+
    iff("md.$LSPPass == 'NPCS'",write("'PASS_END|kind=NPCS'")+write("'SNAPSHOT_END|mode=OBJECT_PROFILES|profiles=%s|partial=%s|atomic=false|discovery_complete=UNVERIFIED'.[md.$LSPProfile, md.$LSPSnapshotPartial]")+
      set('md.$LSPActive','false')+set('md.$LSPNextSnapshot',`player.age + ${c.periodSeconds}s`)+
      ['Stations','Ships','Hosts','Candidates'].map(k=>set(`md.$LSP${k}`,'[]')).join('')+set('md.$LSPActors','table[]')+set('md.$LSPContexts','table[]')+ret('true'))+ret('false'));
  const initialize=lib('Initialize',{},
    iff('md.$LSPReady? and md.$LSPReady',iff('md.$LSPActive',write("'SNAPSHOT_INTERRUPTED|reason=CLOCK_REGRESSION'")))+
    set('md.$LSPReady','false')+set('$Nonce','0')+tag('set_value',{name:'$Nonce',min:'0',max:'2147483647'})+
    set('md.$LSPRun',"'%s-%s'.[player.systemtime.{'%Y-%m-%d_%H-%M-%S'}, $Nonce]")+
    ['Seq','Rows','DiagnosticRows','Profile'].map(k=>set(`md.$LSP${k}`,'0L')).join('')+set('md.$LSPStopped','false')+set('md.$LSPActive','false')+set('md.$LSPLevel',String(levels.indexOf(c.diagnostics)))+
    set('md.$LSPLastAge','player.age')+set('md.$LSPNextSnapshot','player.age')+set('md.$LSPNextHeartbeat',`player.age + ${c.heartbeatSeconds}s`)+set('md.$LSPReady','true')+
    write(`'RUN_BEGIN|collector=OBJECT_PROFILES|listeners=0|max_rows=${c.maxRowsPerRun}|write_confirmation=UNAVAILABLE|load_boundary=UNVERIFIED'`)+ret('true'));
  const tick=lib('Tick',{},
    iff('not md.$LSPReady',ret('false'))+
    iff('player.age lt md.$LSPLastAge',run('Initialize')+ret('false'))+set('md.$LSPLastAge','player.age')+
    iff('md.$LSPStopped',ret('false'))+
    iff('not md.$LSPActive and player.age ge md.$LSPNextSnapshot',run('BeginSnapshot'))+
    iff("md.$LSPPass == 'NPC_DISCOVERY' and md.$LSPActive",
      tag('do_all',{exact:String(c.discoveryPerTick)},iff('md.$LSPStopped or md.$LSPHostIndex gt md.$LSPHostCount or md.$LSPCandidateLimit',tag('break'))+
        run('DiscoverHost',{Host:'md.$LSPHosts.{md.$LSPHostIndex}'})+add('md.$LSPHostIndex'))+
      iff('md.$LSPHostIndex gt md.$LSPHostCount or md.$LSPCandidateLimit',write("'DISCOVERY_END|candidates=%s|complete=UNVERIFIED'.[md.$LSPCandidates.count]")+set('md.$LSPPass',"'NPCS'")+set('md.$LSPIndex','1')))+
    tag('do_all',{exact:String(c.profilesPerTick)},iff('md.$LSPStopped or not md.$LSPActive',tag('break'))+
      iff("md.$LSPPass == 'STATIONS'",iff('md.$LSPIndex le md.$LSPStations.count',run('StationProfile',{Station:'md.$LSPStations.{md.$LSPIndex}'})+add('md.$LSPIndex'))+otherwise(run('Advance')))+
      tag('do_elseif',{value:"md.$LSPPass == 'SHIPS'"},iff('md.$LSPIndex le md.$LSPShips.count',run('ShipProfile',{Ship:'md.$LSPShips.{md.$LSPIndex}'})+add('md.$LSPIndex'))+otherwise(run('Advance')))+
      tag('do_elseif',{value:"md.$LSPPass == 'NPCS'"},iff('md.$LSPIndex le md.$LSPCandidates.count',run('NpcProfile',{Candidate:'md.$LSPCandidates.{md.$LSPIndex}'})+add('md.$LSPIndex'))+otherwise(run('Advance')))+
      otherwise(tag('break')))+
    iff('player.age ge md.$LSPNextHeartbeat',set('md.$LSPNextHeartbeat',`player.age + ${c.heartbeatSeconds}s`)+iff('md.$LSPLevel ge 3',run('Write',{Diagnostic:'true',Body:"'HEALTH|collector=OBJECT_PROFILES|listeners=0|rows_attempted=%s|writes_confirmed=UNAVAILABLE|native_getter_errors=UNAVAILABLE|active=%s'.[md.$LSPRows, md.$LSPActive]"})))+ret('true'));
  const polling=tag('cue',{name:'Bootstrap',checkinterval:'1s'},tag('conditions',{},tag('check_value',{value:'player.entity.exists and player.galaxy'}))+tag('actions',{},run('Initialize'))+
    tag('cues',{},tag('cue',{name:'ProcessingTick',instantiate:'true',checkinterval:'1s'},tag('conditions',{},tag('check_value',{value:'md.$LSPReady'}))+tag('actions',{},run('Tick')))));
  return `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated snapshot-only collector. Edit recorder/md-generator.mjs, then rebuild. -->\n<mdscript name="LifeSigns_EventRecorder" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="../../libraries/md.xsd"><cues>${polling}${escape}${writer}${val}${station}${ship}${npc}${addContext}${addActor}${discover}${begin}${advance}${initialize}${tick}</cues></mdscript>\n`.replaceAll('><','>\n<');
}
