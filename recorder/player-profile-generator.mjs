// Player identity is observed directly, never discovered through an NPC roster.
export function generatePlayerProfile(h) {
  const {set,iff,otherwise,ret,run,lib,valid,eventReady,value,missing,beginProfile,endProfile} = h;
  const gate = `(${eventReady}) and md.$LSPPlayerVersion? and md.$LSPPlayerVersion == 1`;
  const initialize = set('md.$LSPPlayerVersion','1')+set('md.$LSPPlayerObserved','false')+
    set('md.$LSPPlayerDirty','true')+set('md.$LSPPlayerSource',"'RUN_START'")+
    set('md.$LSPPlayerPrevious','null');
  const read = lib('ReadPlayerState',{},
    set('$State',"table[$entity=@player.entity,$container=@player.container,$occupied=@player.occupiedship,$controlled=@player.controlled,$spacesuit=@player.spacesuit,$sector=@player.sector,$occupied_known=player.occupiedship?,$container_known=player.container?,$controlled_known=player.controlled?,$mode='UNKNOWN']")+
    iff(valid('$State.$container'),iff('$State.$container.isclass.station',set('$State.$mode',"'ON_STATION'"))+
      otherwise(iff('$State.$container.isclass.ship',set('$State.$mode',"'ABOARD_SHIP'"))))+
    iff(valid('$State.$occupied'),iff('$State.$occupied.isclass.ship',set('$State.$mode',"'PILOTING_SHIP'")))+
    iff(valid('$State.$spacesuit'),set('$State.$mode',"'SPACESUIT'"))+ret('$State'));
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
  const fields=['subject_seed','subject_reference','subject_name','sector_name','player_state',
    'occupied_ship_seed','occupied_ship_idcode','occupied_ship_name','occupied_ship_reference',
    'previous_occupied_ship_seed','previous_occupied_ship_idcode','previous_occupied_ship_reference',
    'host_seed','host_idcode','host_reference','host_name',
    'previous_host_seed','previous_host_idcode','previous_host_reference',
    'controlled_seed','controlled_idcode','controlled_reference','source_event'];
  const identify=(prefix,ref)=>iff(valid(ref),
    set('$'+prefix+'seed',"'%s'.[@"+ref+'.seed]')+set('$'+prefix+'idcode','@'+ref+'.idcode')+
    set('$'+prefix+'reference',"'%s'.["+ref+']'));
  const delta=lib('RecordPlayerStateChange',{Current:null,Previous:null,Source:null},
    iff(`not (${gate})`,ret('false'))+
    // Compare independently observed relationships, not assigned NPC pilot fields.
    iff('$Current.$entity == $Previous.$entity and $Current.$occupied == $Previous.$occupied and $Current.$container == $Previous.$container and $Current.$controlled == $Previous.$controlled and $Current.$sector == $Previous.$sector and $Current.$mode == $Previous.$mode and $Current.$occupied_known == $Previous.$occupied_known and $Current.$container_known == $Previous.$container_known and $Current.$controlled_known == $Previous.$controlled_known',ret('false'))+
    fields.map(k=>set('$'+k,"''")).join('')+
    set('$subject_seed',"'%s'.[@$Current.$entity.seed]")+set('$subject_reference',"'%s'.[$Current.$entity]")+
    set('$subject_name','@player.name')+set('$sector_name','@$Current.$sector.name')+
    set('$player_state','$Current.$mode')+set('$source_event','$Source')+
    identify('occupied_ship_','$Current.$occupied')+identify('previous_occupied_ship_','$Previous.$occupied')+
    identify('host_','$Current.$container')+identify('previous_host_','$Previous.$container')+
    identify('controlled_','$Current.$controlled')+
    iff(valid('$Current.$occupied'),set('$occupied_ship_name','@$Current.$occupied.knownname'))+
    iff(valid('$Current.$container'),set('$host_name','@$Current.$container.knownname'))+
    fields.map(k=>run('Escape',{Value:'$'+k},'$'+k)).join('')+
    run('Write',{EventTrace:'true',Body:`'ENTITY_EVENT|event_type=PLAYER_STATE_CHANGED|subject_kind=PLAYER|observation=DEFERRED_CURRENT_STATE|${fields.map(k=>k+'=%s').join('|')}'.[${fields.map(k=>'$'+k).join(', ')}]`})+ret('true'));
  return {initialize, libraries:read+profile+request+process+delta};
}
