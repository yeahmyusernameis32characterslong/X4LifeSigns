// Player identity is observed directly, never discovered through an NPC roster.
export function generatePlayerProfile(h) {
  const {set,iff,otherwise,ret,run,lib,valid,eventReady,value,missing,beginProfile,endProfile} = h;
  const gate = `(${eventReady}) and md.$LSPPlayerVersion? and md.$LSPPlayerVersion == 1`;
  const initialize = set('md.$LSPPlayerVersion','1')+set('md.$LSPPlayerObserved','false')+
    set('md.$LSPPlayerDirty','true')+set('md.$LSPPlayerSource',"'RUN_START'")+
    set('md.$LSPPlayerPrevious','null')+set('md.$LSPNextPlayerPoll','player.age + 1s');
  const cache=(key,ref)=>['seed','idcode','reference'].map(k=>set('$State.$'+key+'_'+k,"''")).join('')+
    iff(valid(ref),set('$State.$'+key+'_reference',"'%s'.["+ref+']')+
      iff(ref+'.seed?',iff(ref+'.seed != null',set('$State.$'+key+'_seed',"'%s'.["+ref+'.seed]')))+
      iff(ref+'.idcode?',set('$State.$'+key+'_idcode','@'+ref+'.idcode')));
  const read = lib('ReadPlayerState',{},
    set('$State',"table[$entity=@player.entity,$container=@player.container,$occupied=@player.occupiedship,$controlled=@player.controlled,$spacesuit=@player.spacesuit,$sector=@player.sector,$occupied_known=player.occupiedship?,$container_known=player.container?,$controlled_known=player.controlled?,$mode='UNKNOWN']")+
    iff(valid('$State.$container'),iff('$State.$container.isclass.station',set('$State.$mode',"'ON_STATION'"))+
      otherwise(iff('$State.$container.isclass.ship',set('$State.$mode',"'ABOARD_SHIP'"))))+
    iff(valid('$State.$occupied'),iff('$State.$occupied.isclass.ship',set('$State.$mode',"'PILOTING_SHIP'")))+
    iff(valid('$State.$spacesuit'),set('$State.$mode',"'SPACESUIT'"))+
    cache('occupied','$State.$occupied')+cache('container','$State.$container')+cache('controlled','$State.$controlled')+ret('$State'));
  const relation=(prefix,ref,absent,known)=>value(prefix+'_reference',ref,known)+
    iff(valid(ref),value(prefix+'_seed',ref+'.seed')+value(prefix+'_idcode',ref+'.idcode')+
      value(prefix+'_name',ref+'.knownname'))+
    otherwise(['seed','idcode','name'].map(k=>value(prefix+'_'+k,'null','false',`if ${known} then '${absent}' else 'UNAVAILABLE'`)).join(''));
  const profile=lib('PlayerProfile',{State:null},beginProfile('PLAYER')+
    value('is_player','true','true')+value('reference','$State.$entity','true')+
    value('seed','$State.$entity.seed')+value('name','player.name')+
    value('debugname','$State.$entity.debugname')+value('race','$State.$entity.race.name')+
    value('sector_name','$State.$sector.name')+value('player_state','$State.$mode','true')+
    value('pilot_seat_observed','$State.$occupied_known','true')+
    relation('occupied_ship','$State.$occupied','NO_PILOT_SEAT_SHIP','$State.$occupied_known')+
    relation('container','$State.$container','NO_CONTAINER','$State.$container_known')+
    relation('controlled_object','$State.$controlled','NO_CONTROLLED_OBJECT','$State.$controlled_known')+
    value('spacesuit_reference','$State.$spacesuit','true')+endProfile);
  const request=lib('RequestPlayerObservation',{Source:null},
    iff(`not (${gate})`,ret('false'))+set('md.$LSPPlayerDirty','true')+
    set('md.$LSPPlayerSource','$Source')+ret('true'));
  // Native callbacks request an observation; profile writes stay in the serial tick.
  const process=lib('ProcessPlayerObservation',{},
    iff(`not (${gate}) or not md.$LSPPlayerDirty`,ret('false'))+
    run('ReadPlayerState',{},'$Current')+iff('not ('+valid('$Current.$entity')+')',ret('false'))+
    iff('not md.$LSPPlayerObserved',run('PlayerProfile',{State:'$Current'})+
      set('md.$LSPPlayerObserved','true'))+
    otherwise(run('RecordPlayerStateChange',{Current:'$Current',Previous:'md.$LSPPlayerPrevious',Source:'md.$LSPPlayerSource'}))+
    set('md.$LSPPlayerPrevious','$Current')+set('md.$LSPPlayerDirty','false')+ret('true'));
  const poll=lib('PollPlayerState',{},
    iff(`not (${gate}) or not md.$LSPPlayerObserved`,ret('false'))+
    iff('player.age lt md.$LSPNextPlayerPoll',ret('false'))+set('md.$LSPNextPlayerPoll','player.age + 1s')+
    run('RequestPlayerObservation',{Source:"'PERIODIC_PLAYER_OBSERVATION'"})+run('ProcessPlayerObservation')+ret('true'));
  const fields=['subject_seed','subject_reference','subject_name','sector_name','player_state',
    'occupied_ship_seed','occupied_ship_idcode','occupied_ship_name','occupied_ship_reference',
    'previous_occupied_ship_seed','previous_occupied_ship_idcode','previous_occupied_ship_reference',
    'host_seed','host_idcode','host_reference','host_name',
    'previous_host_seed','previous_host_idcode','previous_host_reference','previous_player_state',
    'controlled_seed','controlled_idcode','controlled_reference',
    'previous_controlled_seed','previous_controlled_idcode','previous_controlled_reference',
    'pilot_seat_observed','container_observed','controlled_object_observed','source_event'];
  const identify=(prefix,state,key)=>['seed','idcode','reference'].map(k=>set('$'+prefix+k,state+'.$'+key+'_'+k)).join('');
  const delta=lib('RecordPlayerStateChange',{Current:null,Previous:null,Source:null},
    iff(`not (${gate})`,ret('false'))+
    // Compare independently observed relationships, not assigned NPC pilot fields.
    iff('$Current.$entity == $Previous.$entity and $Current.$occupied == $Previous.$occupied and $Current.$container == $Previous.$container and $Current.$controlled == $Previous.$controlled and $Current.$sector == $Previous.$sector and $Current.$mode == $Previous.$mode and $Current.$occupied_known == $Previous.$occupied_known and $Current.$container_known == $Previous.$container_known and $Current.$controlled_known == $Previous.$controlled_known',ret('false'))+
    fields.map(k=>set('$'+k,"''")).join('')+
    set('$subject_seed',"'%s'.[@$Current.$entity.seed]")+set('$subject_reference',"'%s'.[$Current.$entity]")+
    set('$subject_name','@player.name')+set('$sector_name','@$Current.$sector.name')+
    set('$player_state','$Current.$mode')+set('$previous_player_state','$Previous.$mode')+set('$source_event','$Source')+
    set('$pilot_seat_observed','$Current.$occupied_known')+set('$container_observed','$Current.$container_known')+set('$controlled_object_observed','$Current.$controlled_known')+
    identify('occupied_ship_','$Current','occupied')+identify('previous_occupied_ship_','$Previous','occupied')+
    identify('host_','$Current','container')+identify('previous_host_','$Previous','container')+
    identify('controlled_','$Current','controlled')+identify('previous_controlled_','$Previous','controlled')+
    iff(valid('$Current.$occupied'),set('$occupied_ship_name','@$Current.$occupied.knownname'))+
    iff(valid('$Current.$container'),set('$host_name','@$Current.$container.knownname'))+
    fields.map(k=>run('Escape',{Value:'$'+k},'$'+k)).join('')+
    run('Write',{EventTrace:'true',Body:`'ENTITY_EVENT|event_type=PLAYER_STATE_CHANGED|subject_kind=PLAYER|observation=DEFERRED_CURRENT_STATE|${fields.map(k=>k+'=%s').join('|')}'.[${fields.map(k=>'$'+k).join(', ')}]`})+ret('true'));
  const nativeFields=['subject_seed','subject_reference','subject_name','host_seed','host_idcode','host_reference',
    'event_object_reference','previous_event_object_reference','detail','previous_detail','shortcut','source_event'];
  const native=lib('RecordPlayerNativeEvent',{Type:null,Source:null,Object:'null',Previous:'null',Detail:'null',PreviousDetail:'null',Shortcut:'null',Control:'false'},
    iff(`not (${gate})`,ret('false'))+run('RequestPlayerObservation',{Source:'$Source'})+
    iff('not ('+valid('player.entity')+')',ret('false'))+
    nativeFields.map(k=>set('$'+k,"''")).join('')+
    iff('player.entity.seed?',set('$subject_seed',"'%s'.[player.entity.seed]"))+
    set('$subject_reference',"'%s'.[player.entity]")+set('$subject_name','@player.name')+
    set('$event_object_reference',"'%s'.[$Object]")+set('$previous_event_object_reference',"'%s'.[$Previous]")+
    set('$detail','$Detail')+set('$previous_detail','$PreviousDetail')+set('$shortcut','$Shortcut')+set('$source_event','$Source')+
    iff('$Control and '+valid('$Object'),
      iff('$Object.seed?',set('$host_seed',"'%s'.[$Object.seed]"))+
      iff('$Object.idcode?',set('$host_idcode','$Object.idcode'))+set('$host_reference',"'%s'.[$Object]"))+
    nativeFields.map(k=>run('Escape',{Value:'$'+k},'$'+k)).join('')+
    run('Write',{EventTrace:'true',Body:`'ENTITY_EVENT|event_type=%s|subject_kind=PLAYER|observation=NATIVE_EVENT|${nativeFields.map(k=>k+'=%s').join('|')}'.[$Type,${nativeFields.map(k=>'$'+k).join(', ')}]`})+ret('true'));
  return {initialize, libraries:read+profile+request+process+poll+delta+native};
}
