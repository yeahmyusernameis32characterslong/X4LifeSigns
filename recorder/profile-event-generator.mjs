import { readFileSync } from 'node:fs';
import { generateHistoryEvents } from './history-event-generator.mjs';
export const profileEvents = JSON.parse(readFileSync(new URL('./profile-events.json', import.meta.url)));

export function generateProfileEvents(h, c) {
  const { tag, set, add, iff, otherwise, each, ret, run, lib, write, valid, ready, eventReady } = h;
  const history=generateHistoryEvents(h,c);
  const owned = x => `${valid(x)} and ${x}.isplayerowned`;
  const eventWrite=body=>run('Write',{Body:body,EventTrace:'true'});
  const key = (kind, seed) => `'$%s:%s'.[${kind}, ${seed}]`;
  const initialize = iff('not md.$LSPWatch?', tag('create_group', { groupname:'md.$LSPWatch' }))+
    tag('find_station',{name:'$WatchStations',space:'player.galaxy',trueowner:'faction.player',multiple:'true',checkoperational:'false'})+
    tag('find_ship',{name:'$WatchShips',space:'player.galaxy',trueowner:'faction.player',multiple:'true',recursive:'true',checkoperational:'false'})+
    tag('add_to_group',{groupname:'md.$LSPWatch',list:'$WatchStations',replace:'true'})+tag('add_to_group',{groupname:'md.$LSPWatch',list:'$WatchShips'})+
    ['NewProfiles','SettleEvents','KnownPending','CrewChanges','OrderChecks'].map(k=>set(`md.$LSP${k}`,'[]')).join('')+
    ['NewIndex','SettleIndex','KnownIndex','CrewIndex','OrderIndex'].map(k=>set(`md.$LSP${k}`,'1')).join('')+
    set('md.$LSPQueuedKeys','table[]')+set('md.$LSPEventsReady','false')+
    iff('not UniverseIdentity.$KnownProfileSeeds?',set('UniverseIdentity.$KnownProfileSeeds','table[]'))+
    history.initialize;
  const observedSeed = iff("$Field == 'seed' and $State == 'PRESENT'",set('md.$LSPCurrentSeed',"'%s'.[$Value]"));
  const begin = kind => set('md.$LSPCurrentKind',`'${kind}'`)+set('md.$LSPCurrentSeed',"''");
  const end = iff("md.$LSPCurrentSeed != ''",tag('append_to_list',{name:'md.$LSPKnownPending',exact:`[md.$LSPRecord, ${key('md.$LSPCurrentKind','md.$LSPCurrentSeed')}]`}));
  const acknowledge = tag('do_all',{exact:'md.$LSPKnownPending.count'},
    iff('md.$LSPKnownIndex gt md.$LSPKnownPending.count',tag('break'))+
    set('$KnownItem','md.$LSPKnownPending.{md.$LSPKnownIndex}')+
    iff('$KnownItem.{1} gt md.$LSPAcknowledged',tag('break'))+
    set('UniverseIdentity.$KnownProfileSeeds.{$KnownItem.{2}}','true')+
    iff('md.$LSPQueuedKeys.{$KnownItem.{2}}?',tag('remove_value',{name:'md.$LSPQueuedKeys.{$KnownItem.{2}}'}))+add('md.$LSPKnownIndex'))+
    iff('md.$LSPKnownIndex gt md.$LSPKnownPending.count',set('md.$LSPKnownPending','[]')+set('md.$LSPKnownIndex','1'));

  const queue=lib('QueueNewProfile',{Object:'null',Host:'null',Template:'null',Target:'null'},
    iff(`not (${eventReady})`,ret('false'))+
    set('$Kind',"''")+set('$Seed',"''")+set('$Actor','null')+
    iff(owned('$Object'),
      iff('$Object.isclass.ship',set('$Kind',"'SHIP'"))+
      otherwise(iff('$Object.isclass.station',set('$Kind',"'STATION'"))+
        otherwise(iff('$Object.isclass.npc',set('$Kind',"'NPC'")+set('$Actor','$Object')+iff('$Host == null',set('$Host','@$Object.container'))+set('$Template','@$Object.npctemplate'))))+
      iff('$Object.seed?',set('$Seed',"'%s'.[$Object.seed]")))+
    iff("$Kind == '' and typeof $Template == datatype.npctemplate and "+owned('$Host'),
      iff('@$Host.people.{$Template}.exists',set('$Kind',"'NPC'")+set('$Seed',"'%s'.[$Host.people.{$Template}.seed]")))+
    iff("$Kind == ''",ret('false'))+
    set('$Key',key('$Kind','$Seed'))+
    iff("$Seed == ''",set('$Key',"'$%s:%s:%s:%s'.[$Kind,$Object,$Host,$Template]"))+
    iff("$Seed != '' and UniverseIdentity.$KnownProfileSeeds.{$Key}?",ret('true'))+
    iff('md.$LSPQueuedKeys.{$Key}?',ret('true'))+
    tag('append_to_list',{name:'md.$LSPNewProfiles',exact:"table[$kind=$Kind,$object=$Object,$actor=$Actor,$host=$Host,$template=$Template,$key=$Key,$target=$Target,$origin='NEW_OBJECT_EVENT']"})+
    set('md.$LSPQueuedKeys.{$Key}','md.$LSPNewProfiles.count')+
    iff("$Kind == 'SHIP' or $Kind == 'STATION'",tag('add_to_group',{groupname:'md.$LSPWatch',object:'$Object'}))+ret('true'));
  const crew=lib('QueueNewHostPersonnel',{Host:null},
    iff(`not (${eventReady})`,ret('false'))+
    iff('not ('+owned('$Host')+')',ret('false'))+
    set('$People','@$Host.people.list')+
    iff('typeof $People == datatype.list',tag('do_all',{exact:`[$People.count, ${c.personnelPerHost}].min`,counter:'$I'},run('QueueNewProfile',{Host:'$Host',Template:'$People.{$I}'})))+
    set('$Actors','@$Host.roleentities')+iff('typeof $Actors == datatype.list',each('$Actor','$Actors',run('QueueNewProfile',{Object:'$Actor',Host:'$Host'})))+
    run('QueueNewProfile',{Object:'@$Host.assignedaipilot',Host:'$Host'})+
    run('QueueNewProfile',{Object:'@$Host.tradenpc',Host:'$Host'})+run('QueueNewProfile',{Object:'@$Host.shiptrader',Host:'$Host'})+ret('true'));
  const fields = ['subject_seed','subject_idcode','subject_reference','host_seed','host_idcode','other_seed','other_idcode','other_reference','previous_reference','actual_role','control_post','requested_role','detail','detail_name',
    'subject_name','subject_faction','sector_name','host_reference','host_kind','other_kind','other_faction','previous_seed','previous_idcode',
    'assigned_seed','assigned_idcode','assigned_reference','assignment_basis','assignment_state','location_seed','location_idcode','location_reference','location_basis'];
  const observe = lib('RecordEntityEvent',{Subject:'null',Host:'null',Template:'null',Other:'null',Previous:'null',Type:null,Detail:'null',DetailName:'null',Status:"'OBSERVED'",Npc:'false',SeedText:"''",RoleText:"''"},
    iff(`not (${eventReady})`,ret('false'))+
    iff(valid('$Subject'),iff('$Subject.isclass.npc and not $Subject.isplayerowned',ret('false')))+
    set('$Kind',"''")+fields.map(f=>set('$'+f,"''")).join('')+
    iff(owned('$Subject'),
      iff('$Subject.isclass.ship',set('$Kind',"'SHIP'"))+otherwise(iff('$Subject.isclass.station',set('$Kind',"'STATION'"))+otherwise(iff('$Subject.isclass.npc',set('$Kind',"'NPC'")))))+
    iff("$Kind == '' and $Npc and ($Subject == null or not ("+valid('$Subject')+')) and '+owned('$Host'),set('$Kind',"'NPC'"))+
    iff("$Kind == ''",ret('false'))+
    run('HistoryIdentity',{Object:'$Subject'})+
    iff("$Kind != 'SHIP' and ($Type == 'ATTACKING' or $Type == 'ORDER_READY' or $Type == 'ORDER_RUNNING_OBSERVED' or $Type == 'COMMANDER_SET' or $Type == 'FLEET_ROLE_CHANGED')",ret('false'))+
    set('$subject_reference',"'%s'.[$Subject]")+
    iff(valid('$Subject'),
      iff('$Subject.seed?',set('$subject_seed',"'%s'.[$Subject.seed]"))+
      iff("$Kind != 'NPC'",iff('$Subject.idcode?',set('$subject_idcode','$Subject.idcode')))+
      iff("$Kind == 'NPC'",set('$actual_role','@$Subject.role.name')+set('$control_post','@$Subject.controlpost.name')))+
    iff(owned('$Host'),
      set('$host_seed',"'%s'.[@$Host.seed]")+set('$host_idcode','@$Host.idcode')+
      iff('typeof $Template == datatype.npctemplate',iff('@$Host.people.{$Template}.exists',
        set('$subject_seed',"'%s'.[$Host.people.{$Template}.seed]")+set('$actual_role','@$Host.people.{$Template}.role.name'))))+
    set('$other_reference',"'%s'.[$Other]")+set('$previous_reference',"'%s'.[$Previous]")+
    iff(valid('$Other'),set('$other_seed',"'%s'.[@$Other.seed]")+set('$other_idcode','@$Other.idcode'))+
    iff("$Kind == 'NPC' and $SeedText != ''",set('$subject_seed','$SeedText')+set('$actual_role','$RoleText'))+
    iff(valid('$Subject'),set('$subject_name','@$Subject.knownname')+set('$subject_faction',"'%s'.[@$Subject.owner]")+set('$sector_name','@$Subject.sector.name'))+
    set('$host_reference',"'%s'.[$Host]")+
    iff(valid('$Host'),set('$host_kind',"if $Host.isclass.station then 'STATION' else 'SHIP'"))+
    iff(valid('$Other'),set('$other_kind',"'ASSET'")+iff('$Other.isclass.station',set('$other_kind',"'STATION'"))+iff('$Other.isclass.npc',set('$other_kind',"'NPC'"))+iff('$Other.isclass.ship',set('$other_kind',"'SHIP'"))+set('$other_faction',"'%s'.[@$Other.owner]"))+
    iff(valid('$Previous'),set('$previous_seed',"'%s'.[@$Previous.seed]")+set('$previous_idcode','@$Previous.idcode'))+
    set('$Assigned','null')+set('$Location','null')+set('$assignment_basis',"'UNKNOWN'")+set('$assignment_state',"'UNKNOWN'")+set('$location_basis',"'UNKNOWN'")+
    iff("$Kind == 'NPC'",iff(valid('$Subject'),
      set('$RoleObject','@$Subject.roleobject')+set('$ControlledObject','@$Subject.assignedcontrolled')+
      set('$Assigned','$RoleObject')+iff('$Assigned == null',set('$Assigned','$ControlledObject'))+
      iff('$Subject.roleobject? and $Subject.assignedcontrolled?',iff('$Subject.roleobject == null and $Subject.assignedcontrolled == null',set('$assignment_state',"'NONE'")))+
      set('$assignment_basis',"'ACTOR_ROLE_OR_CONTROL_OBSERVED'")+
      iff(valid('$RoleObject')+' and '+valid('$ControlledObject')+' and $RoleObject != $ControlledObject',set('$Assigned','null')+set('$assignment_state',"'AMBIGUOUS'")+set('$assignment_basis',"'CONFLICTING_ACTOR_RELATIONSHIPS'"))+
      set('$Location','@$Subject.container')+set('$location_basis',"'ACTOR_CONTAINER_OBSERVED'"))+
      otherwise(iff(owned('$Host'),
        iff('typeof $Template == datatype.npctemplate',iff('@$Host.people.{$Template}.exists',
          set('$Assigned','$Host')+set('$assignment_basis',"'CONTEXT_ROSTER_ASSOCIATION'")+
          iff('@$Host.availablepeople.{$Template}.exists and not @$Host.people.{$Template}.isintransit',set('$Location','$Host')+set('$location_basis',"'HOST_AVAILABLE_PERSONNEL_ENTRY'"))))+
        iff("$SeedText != ''",set('$Assigned','$Host')+set('$assignment_basis',"'UI_ROLE_ON_HOST_OBSERVED'")))))+
    iff(valid('$Assigned'),set('$assigned_seed',"'%s'.[@$Assigned.seed]")+set('$assigned_idcode','@$Assigned.idcode')+set('$assigned_reference',"'%s'.[$Assigned]")+set('$assignment_state',"'OBSERVED_RELATION'"))+
    iff(valid('$Location'),set('$location_seed',"'%s'.[@$Location.seed]")+set('$location_idcode','@$Location.idcode')+set('$location_reference',"'%s'.[$Location]"))+
    set('$detail','$Detail')+set('$detail_name','$DetailName')+
    iff("$Status == 'REQUESTED' or $Status == 'OBSERVED_AFTER_UI_CONFIRM'",set('$requested_role','$Detail'))+
    iff("$Kind == 'NPC' and $Type == 'ENTITY_LEFT'",iff(valid('$Other'),iff('$Other.isclass.spacesuit',set('$Type',"'EJECTED'"))))+
    iff("$Kind == 'NPC' and $Type == 'ENTITY_ENTERED'",iff(valid('$Previous'),iff('$Previous.isclass.spacesuit',set('$Type',"'RESCUED'"))))+
    fields.map(f=>run('Escape',{Value:'$'+f},'$'+f)).join('')+
    eventWrite(`'ENTITY_EVENT|event_type=%s|subject_kind=%s|observation=%s|${fields.map(f=>f+'=%s').join('|')}'.[${['$Type','$Kind','$Status',...fields.map(f=>'$'+f)].join(', ')}]`)+ret('true'));

  const dispatch=lib('HandleProfileEvent',{Subject:'null',Host:'null',Other:'null',Previous:'null',Detail:'null',DetailName:'null',Target:'null',Order:'null',Type:null,Create:'false',Npc:'false',Assignment:'false'},
    iff(`not (${eventReady})`,ret('false'))+
    set('$Template','null')+
    iff('typeof $Subject == datatype.list',
      iff('$Subject.count ge 2',set('$Host','$Subject.{1}')+set('$Template','$Subject.{2}')+set('$Subject','null'))+otherwise(ret('false')))+
    iff('$Npc and $Host == null',iff(valid('$Subject'),set('$Host','@$Subject.container')))+
    run('RecordEntityEvent',{Subject:'$Subject',Host:'$Host',Template:'$Template',Other:'if $Assignment then $Target else $Other',Previous:'$Previous',Type:'$Type',Detail:'$Detail',DetailName:'$DetailName',Status:"if $Assignment then 'REQUESTED' else 'OBSERVED'",Npc:'$Npc'})+
    iff('$Create',run('QueueNewProfile',{Object:'$Subject',Host:'$Host',Template:'$Template',Target:'$Target'}))+
    iff('$Assignment',tag('append_to_list',{name:'md.$LSPSettleEvents',exact:'[player.age + 1s,$Subject,$Host,$Template,$Target,$Detail]'}))+
    iff("$Type == 'ORDER_READY' and $Order != null",tag('append_to_list',{name:'md.$LSPOrderChecks',exact:'[player.age + 1s,$Subject,$Order]'}))+
    iff('$Npc',iff(valid('$Other'),iff('$Other.isclass.spacesuit',run('QueueNewProfile',{Object:'$Other'}))))+ret('true'));
  const process=lib('ProcessNewProfiles',{},
    iff(`not (${eventReady})`,ret('false'))+
    iff("md.$LSPDatabaseState != 'READY' or md.$LSPAwaitCommit or md.$LSPActive",ret('false'))+
    tag('do_all',{exact:String(c.profilesPerTick)},
      iff('md.$LSPNewIndex gt md.$LSPNewProfiles.count',tag('break'))+
      set('$Item','md.$LSPNewProfiles.{md.$LSPNewIndex}')+add('md.$LSPNewIndex')+
      iff('not UniverseIdentity.$KnownProfileSeeds.{$Item.$key}?',
        iff("$Item.$kind == 'STATION'",run('StationProfile',{Station:'$Item.$object'})+run('QueueNewHostPersonnel',{Host:'$Item.$object'}))+
        tag('do_elseif',{value:"$Item.$kind == 'SHIP'"},run('ShipProfile',{Ship:'$Item.$object'})+run('QueueNewHostPersonnel',{Host:'$Item.$object'}))+
        otherwise(
          iff(valid('$Item.$target'),iff('@$Item.$target.people.{$Item.$template}.exists',set('$Item.$host','$Item.$target')))+
          run('NpcProfile',{Candidate:'$Item'}))))+
    iff('md.$LSPNewIndex gt md.$LSPNewProfiles.count',set('md.$LSPNewProfiles','[]')+set('md.$LSPNewIndex','1'))+ret('true'));
  const settle=lib('ProcessAssignmentObservations',{},
    iff(`not (${eventReady})`,ret('false'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},
      iff('md.$LSPSettleIndex gt md.$LSPSettleEvents.count',tag('break'))+
      set('$Item','md.$LSPSettleEvents.{md.$LSPSettleIndex}')+
      iff('player.age lt $Item.{1}',tag('break'))+add('md.$LSPSettleIndex')+
      set('$Host','$Item.{3}')+
      iff(valid('$Item.{5}'),iff('typeof $Item.{4} == datatype.npctemplate',iff('@$Item.{5}.people.{$Item.{4}}.exists',set('$Host','$Item.{5}'))))+
      run('RecordEntityEvent',{Subject:'$Item.{2}',Host:'$Host',Template:'$Item.{4}',Other:'$Item.{5}',Type:"'ASSIGNMENT_OBSERVED'",Detail:'$Item.{6}',Status:"'OBSERVED_AFTER_REQUEST'",Npc:'true'}))+
    iff('md.$LSPSettleIndex gt md.$LSPSettleEvents.count',set('md.$LSPSettleEvents','[]')+set('md.$LSPSettleIndex','1'))+ret('true'));
  const crewChange=lib('QueueCrewRoleObservation',{Host:null,Seed:null,Role:null,ActualRole:"'UNAVAILABLE'"},
    iff(`not (${eventReady}) or not (`+owned('$Host')+')',ret('false'))+
    iff('typeof $Seed != datatype.string or typeof $Role != datatype.string',ret('false'))+
    run('RecordEntityEvent',{Host:'$Host',Type:"'CREW_ROLE_OBSERVED'",Detail:'$Role',SeedText:'$Seed',RoleText:'$ActualRole',Status:"'OBSERVED_AFTER_UI_CONFIRM'",Npc:'true'})+
    iff('not UniverseIdentity.$KnownProfileSeeds.{'+key("'NPC'",'$Seed')+'}?',tag('append_to_list',{name:'md.$LSPCrewChanges',exact:'[$Host,$Seed,$Role,1]'}))+ret('true'));
  const processCrew=lib('ProcessCrewRoleObservations',{},
    iff(`not (${eventReady})`,ret('false'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},
      iff('md.$LSPCrewIndex gt md.$LSPCrewChanges.count',tag('break'))+
      set('$Change','md.$LSPCrewChanges.{md.$LSPCrewIndex}')+set('$Host','$Change.{1}')+
      iff('not ('+owned('$Host')+')',add('md.$LSPCrewIndex')+tag('continue'))+
      set('$People','@$Host.people.list')+
      iff('typeof $People != datatype.list',add('md.$LSPCrewIndex')+tag('continue'))+
      iff('$Change.{4} gt $People.count',write("'DISCOVERY_GAP|reason=CREW_ROLE_SEED_NOT_FOUND|seed=%s'.[$Change.{2}]")+add('md.$LSPCrewIndex')+tag('continue'))+
      set('$Template','$People.{$Change.{4}}')+add('$Change.{4}')+
      iff('@$Host.people.{$Template}.exists',iff("'%s'.[$Host.people.{$Template}.seed] == $Change.{2}",
        run('QueueNewProfile',{Host:'$Host',Template:'$Template'})+add('md.$LSPCrewIndex'))))+
    iff('md.$LSPCrewIndex gt md.$LSPCrewChanges.count',set('md.$LSPCrewChanges','[]')+set('md.$LSPCrewIndex','1'))+ret('true'));
  const crewListener=tag('cue',{name:'PersonnelRoleResponse',instantiate:'true'},tag('conditions',{},tag('event_ui_triggered',{screen:"'LifeSignsPersonnel'",control:"'role_changed'"}))+tag('actions',{},
    iff('typeof event.param3 == datatype.list',iff('event.param3.count == 4',iff('typeof event.param3.{1} == datatype.component',run('QueueCrewRoleObservation',{Host:'event.param3.{1}',Seed:'event.param3.{2}',Role:'event.param3.{3}',ActualRole:'event.param3.{4}'}))))));
  const renameFields=['subject_seed','subject_idcode','subject_reference','old_name','old_name_state','new_name','new_name_state','requested_name','name_source'];
  const rename=lib('RecordNameObservation',{Object:null,Before:null,BeforeState:null,Requested:null,Source:null},
    iff(`not (${eventReady}) or not (`+owned('$Object')+')',ret('false'))+
    iff('not ($Object.isclass.ship or $Object.isclass.station)',ret('false'))+
    iff('typeof $Before != datatype.string or typeof $Requested != datatype.string',ret('false'))+
    iff("$BeforeState != 'PRESENT' and $BeforeState != 'UNKNOWN'",ret('false'))+
    iff("$Source != 'MAP_RENAME_DIALOG' and $Source != 'MAP_INFO_EDIT'",ret('false'))+
    set('$Kind',"if $Object.isclass.station then 'STATION' else 'SHIP'")+
    set('$Type',"'NAME_CHANGE_REQUESTED'")+set('$new_name',"''")+set('$new_name_state',"'UNKNOWN'")+
    iff('$Object.knownname?',iff('typeof $Object.knownname == datatype.string',
      set('$new_name','$Object.knownname')+set('$new_name_state',"'PRESENT'")+
      iff("$BeforeState == 'PRESENT'",iff('$Before == $new_name',ret('false'))+set('$Type',"'NAME_CHANGED'"))+
      otherwise(set('$Type',"'NAME_OBSERVED'"))))+
    set('$subject_seed',"'%s'.[@$Object.seed]")+set('$subject_idcode','@$Object.idcode')+
    set('$subject_reference',"'%s'.[$Object]")+set('$old_name','$Before')+set('$old_name_state','$BeforeState')+
    set('$requested_name','$Requested')+set('$name_source','$Source')+
    renameFields.map(f=>run('Escape',{Value:'$'+f},'$'+f)).join('')+
    eventWrite(`'ENTITY_EVENT|event_type=%s|subject_kind=%s|observation=OBSERVED_AFTER_UI_RENAME|${renameFields.map(f=>f+'=%s').join('|')}'.[${['$Type','$Kind',...renameFields.map(f=>'$'+f)].join(', ')}]`)+ret('true'));
  const renameListener=tag('cue',{name:'ProfileNameResponse',instantiate:'true'},tag('conditions',{},tag('event_ui_triggered',{screen:"'LifeSignsProfiles'",control:"'name_changed'"}))+tag('actions',{},
    iff('typeof event.param3 == datatype.list',iff('event.param3.count == 5',iff('typeof event.param3.{1} == datatype.component',run('RecordNameObservation',{Object:'event.param3.{1}',Before:'event.param3.{2}',BeforeState:'event.param3.{3}',Requested:'event.param3.{4}',Source:'event.param3.{5}'}))))));
  const orderChecks=lib('ProcessOrderObservations',{},
    iff(`not (${eventReady})`,ret('false'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},
      iff('md.$LSPOrderIndex gt md.$LSPOrderChecks.count',tag('break'))+
      set('$Item','md.$LSPOrderChecks.{md.$LSPOrderIndex}')+iff('player.age lt $Item.{1}',tag('break'))+add('md.$LSPOrderIndex')+
      iff('@$Item.{3}.isrunning',run('RecordEntityEvent',{Subject:'$Item.{2}',Type:"'ORDER_RUNNING_OBSERVED'",Detail:'@$Item.{3}.id',DetailName:'@$Item.{3}.name'})))+
    iff('md.$LSPOrderIndex gt md.$LSPOrderChecks.count',set('md.$LSPOrderChecks','[]')+set('md.$LSPOrderIndex','1'))+ret('true'));
  const listeners=profileEvents.map((e,i)=>tag('cue',{name:'ProfileEventV2_'+i,instantiate:'true',namespace:'this'},
    tag('conditions',{},tag(e.name,e.selector))+tag('actions',{},e.handler?run(e.handler,e.params):run('HandleProfileEvent',{
      Subject:e.subject,Type:`'${e.type}'`,Host:e.host||'null',Other:e.other||'null',Previous:e.previous||'null',Detail:e.detail||'null',DetailName:e.detailName||'null',Target:e.target||'null',Order:e.order||'null',Create:String(Boolean(e.create)),Npc:String(Boolean(e.npc)),Assignment:String(Boolean(e.assignment))})))).join('');
  const patches=['waiting','active','complete','cancelled'].map(state=>tag('patch',{sinceversion:'1',state},run('InvalidateRecorder'))).join('');
  // Reserve every old name in its original parent. Changing an existing cue's
  // parent is not supported by MD refresh; inactive placeholders have no events.
  const retiredChildren=profileEvents.map((_,i)=>tag('cue',{name:'ProfileEvent'+i,instantiate:'false',onfail:'cancel',comment:'Deprecated; name reserved for saved games'},tag('conditions',{},tag('check_value',{value:'false'})))).join('');
  const retired=tag('cue',{name:'ProfileEventBus',version:'1',onfail:'cancel'},tag('conditions',{},tag('check_value',{value:'false'}))+patches+tag('cues',{},retiredChildren));
  const cues=retired+tag('cue',{name:'ProfileEventBusV2',version:'1'},
    tag('conditions',{},tag('event_cue_signalled',{cue:'ProfileEventBusV2'})+
      tag('check_value',{value:`(${ready}) and md.$LSPBusArmedRun? and md.$LSPBusArmedRun == md.$LSPRun and md.$LSPWatch? and md.$LSPHistorySectors? and md.$LSPHistoryOutsiders?`}))+
    tag('actions',{},set('md.$LSPEventsReady','true')+tag('remove_value',{name:'md.$LSPBusArmedRun'})+
      iff('md.$LSPLevel ge 3',run('Write',{Diagnostic:'true',Body:"'LISTENER_BOOTSTRAP_READY|startup_protocol=STAGED_V1|early_restore_coverage=UNVERIFIED'"})))+patches+tag('cues',{},listeners));
  return { initialize, observedSeed, begin, end, acknowledge, libraries:queue+crew+observe+dispatch+process+settle+crewChange+processCrew+orderChecks+rename+history.libraries, cues, crewListener, renameListener };
}
