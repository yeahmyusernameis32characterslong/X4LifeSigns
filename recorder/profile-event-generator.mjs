import { readFileSync } from 'node:fs';
export const profileEvents = JSON.parse(readFileSync(new URL('./profile-events.json', import.meta.url)));

export function generateProfileEvents(h, c) {
  const { tag, set, add, iff, otherwise, each, ret, run, lib, write, valid } = h;
  const owned = x => `${valid(x)} and ${x}.isplayerowned`;
  const key = (kind, seed) => `'$%s:%s'.[${kind}, ${seed}]`;
  const initialize = iff('not md.$LSPWatch?', tag('create_group', { groupname:'md.$LSPWatch' }))+
    tag('find_station',{name:'$WatchStations',space:'player.galaxy',trueowner:'faction.player',multiple:'true',checkoperational:'false'})+
    tag('find_ship',{name:'$WatchShips',space:'player.galaxy',trueowner:'faction.player',multiple:'true',recursive:'true',checkoperational:'false'})+
    tag('add_to_group',{groupname:'md.$LSPWatch',list:'$WatchStations',replace:'true'})+tag('add_to_group',{groupname:'md.$LSPWatch',list:'$WatchShips'})+
    ['NewProfiles','SettleEvents','KnownPending'].map(k=>set(`md.$LSP${k}`,'[]')).join('')+
    ['NewIndex','SettleIndex','KnownIndex'].map(k=>set(`md.$LSP${k}`,'1')).join('')+
    set('md.$LSPQueuedKeys','table[]')+set('md.$LSPEventsReady','false')+
    iff('not UniverseIdentity.$KnownProfileSeeds?',set('UniverseIdentity.$KnownProfileSeeds','table[]'))+
    tag('reset_cue',{cue:'ProfileEventBus'});
  const observedSeed = iff("$Field == 'seed' and $State == 'PRESENT'",set('md.$LSPCurrentSeed',"'%s'.[$Value]"));
  const begin = kind => set('md.$LSPCurrentKind',`'${kind}'`)+set('md.$LSPCurrentSeed',"''");
  const end = iff("md.$LSPCurrentSeed != ''",tag('append_to_list',{name:'md.$LSPKnownPending',exact:`[md.$LSPRecord, ${key('md.$LSPCurrentKind','md.$LSPCurrentSeed')}]`}));
  const acknowledge = tag('do_all',{exact:'md.$LSPKnownPending.count'},
    iff('md.$LSPKnownIndex gt md.$LSPKnownPending.count',tag('break'))+
    set('$KnownItem','md.$LSPKnownPending.{md.$LSPKnownIndex}')+
    iff('$KnownItem.{1} gt md.$LSPAcknowledged',tag('break'))+
    set('UniverseIdentity.$KnownProfileSeeds.{$KnownItem.{2}}','true')+add('md.$LSPKnownIndex'));

  const queue=lib('QueueNewProfile',{Object:'null',Host:'null',Template:'null',Target:'null'},
    iff('not md.$LSPReady or md.$LSPStopped',ret('false'))+
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
    iff('not ('+owned('$Host')+')',ret('false'))+
    set('$People','@$Host.people.list')+
    iff('typeof $People == datatype.list',tag('do_all',{exact:`[$People.count, ${c.personnelPerHost}].min`,counter:'$I'},run('QueueNewProfile',{Host:'$Host',Template:'$People.{$I}'})))+
    set('$Actors','@$Host.roleentities')+iff('typeof $Actors == datatype.list',each('$Actor','$Actors',run('QueueNewProfile',{Object:'$Actor',Host:'$Host'})))+
    run('QueueNewProfile',{Object:'@$Host.assignedaipilot',Host:'$Host'})+
    run('QueueNewProfile',{Object:'@$Host.tradenpc',Host:'$Host'})+run('QueueNewProfile',{Object:'@$Host.shiptrader',Host:'$Host'})+ret('true'));
  const fields = ['subject_seed','subject_idcode','subject_reference','host_seed','host_idcode','other_seed','other_idcode','other_reference','previous_reference','actual_role','control_post','requested_role','detail','detail_name'];
  const observe = lib('RecordEntityEvent',{Subject:'null',Host:'null',Template:'null',Other:'null',Previous:'null',Type:null,Detail:'null',DetailName:'null',Status:"'OBSERVED'",Npc:'false'},
    iff('not md.$LSPReady or md.$LSPStopped',ret('false'))+
    iff(valid('$Subject'),iff('$Subject.isclass.npc and not $Subject.isplayerowned',ret('false')))+
    set('$Kind',"''")+fields.map(f=>set('$'+f,"''")).join('')+
    iff(owned('$Subject'),
      iff('$Subject.isclass.ship',set('$Kind',"'SHIP'"))+otherwise(iff('$Subject.isclass.station',set('$Kind',"'STATION'"))+otherwise(iff('$Subject.isclass.npc',set('$Kind',"'NPC'")))))+
    iff("$Kind == '' and $Npc and ($Subject == null or not ("+valid('$Subject')+')) and '+owned('$Host'),set('$Kind',"'NPC'"))+
    iff("$Kind == ''",ret('false'))+
    iff("$Kind != 'SHIP' and ($Type == 'ATTACKING' or $Type == 'ORDER_READY' or $Type == 'COMMANDER_SET' or $Type == 'FLEET_ROLE_CHANGED')",ret('false'))+
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
    set('$detail','$Detail')+set('$detail_name','$DetailName')+
    iff("$Status == 'REQUESTED'",set('$requested_role','$Detail'))+
    iff("$Kind == 'NPC' and $Type == 'ENTITY_LEFT'",iff(valid('$Other'),iff('$Other.isclass.spacesuit',set('$Type',"'EJECTED'"))))+
    iff("$Kind == 'NPC' and $Type == 'ENTITY_ENTERED'",iff(valid('$Previous'),iff('$Previous.isclass.spacesuit',set('$Type',"'RESCUED'"))))+
    fields.map(f=>run('Escape',{Value:'$'+f},'$'+f)).join('')+
    write(`'ENTITY_EVENT|event_type=%s|subject_kind=%s|observation=%s|${fields.map(f=>f+'=%s').join('|')}'.[${['$Type','$Kind','$Status',...fields.map(f=>'$'+f)].join(', ')}]`)+ret('true'));

  const dispatch=lib('HandleProfileEvent',{Subject:'null',Host:'null',Other:'null',Previous:'null',Detail:'null',DetailName:'null',Target:'null',Type:null,Create:'false',Npc:'false',Assignment:'false'},
    iff('not md.$LSPReady or md.$LSPStopped',ret('false'))+
    set('$Template','null')+
    iff('typeof $Subject == datatype.list',
      iff('$Subject.count ge 2',set('$Host','$Subject.{1}')+set('$Template','$Subject.{2}')+set('$Subject','null'))+otherwise(ret('false')))+
    iff('$Npc and $Host == null',iff(valid('$Subject'),set('$Host','@$Subject.container')))+
    run('RecordEntityEvent',{Subject:'$Subject',Host:'$Host',Template:'$Template',Other:'if $Assignment then $Target else $Other',Previous:'$Previous',Type:'$Type',Detail:'$Detail',DetailName:'$DetailName',Status:"if $Assignment then 'REQUESTED' else 'OBSERVED'",Npc:'$Npc'})+
    iff('$Create',run('QueueNewProfile',{Object:'$Subject',Host:'$Host',Template:'$Template',Target:'$Target'}))+
    iff('$Assignment',tag('append_to_list',{name:'md.$LSPSettleEvents',exact:'[player.age + 1s,$Subject,$Host,$Template,$Target,$Detail]'}))+
    iff('$Npc',iff(valid('$Other'),iff('$Other.isclass.spacesuit',run('QueueNewProfile',{Object:'$Other'}))))+ret('true'));
  const process=lib('ProcessNewProfiles',{},
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
    tag('do_all',{exact:String(c.discoveryPerTick)},
      iff('md.$LSPSettleIndex gt md.$LSPSettleEvents.count',tag('break'))+
      set('$Item','md.$LSPSettleEvents.{md.$LSPSettleIndex}')+
      iff('player.age lt $Item.{1}',tag('break'))+add('md.$LSPSettleIndex')+
      set('$Host','$Item.{3}')+
      iff(valid('$Item.{5}'),iff('typeof $Item.{4} == datatype.npctemplate',iff('@$Item.{5}.people.{$Item.{4}}.exists',set('$Host','$Item.{5}'))))+
      run('RecordEntityEvent',{Subject:'$Item.{2}',Host:'$Host',Template:'$Item.{4}',Other:'$Item.{5}',Type:"'ASSIGNMENT_OBSERVED'",Detail:'$Item.{6}',Status:"'OBSERVED_AFTER_REQUEST'",Npc:'true'}))+
    iff('md.$LSPSettleIndex gt md.$LSPSettleEvents.count',set('md.$LSPSettleEvents','[]')+set('md.$LSPSettleIndex','1'))+ret('true'));
  const listeners=profileEvents.map((e,i)=>tag('cue',{name:'ProfileEvent'+i,instantiate:'true',namespace:'this'},
    tag('conditions',{},tag(e.name,e.selector))+tag('actions',{},run('HandleProfileEvent',{
      Subject:e.subject,Type:`'${e.type}'`,Host:e.host||'null',Other:e.other||'null',Previous:e.previous||'null',Detail:e.detail||'null',DetailName:e.detailName||'null',Target:e.target||'null',Create:String(Boolean(e.create)),Npc:String(Boolean(e.npc)),Assignment:String(Boolean(e.assignment))})))).join('');
  const cues=tag('cue',{name:'ProfileEventBus',checkinterval:'0.1s'},tag('conditions',{},tag('check_value',{value:'md.$LSPReady? and md.$LSPReady and md.$LSPWatch?'}))+tag('actions',{},set('md.$LSPEventsReady','true'))+tag('cues',{},listeners));
  return { initialize, observedSeed, begin, end, acknowledge, libraries:queue+crew+observe+dispatch+process+settle, cues };
}
