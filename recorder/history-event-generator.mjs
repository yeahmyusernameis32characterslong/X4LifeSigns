// Source-backed history observations. No engine mutation or personnel materialisation.
export function generateHistoryEvents(h, c) {
  const {tag,set,add,iff,otherwise,each,ret,run,lib,valid}=h;
  const owned=o=>`${valid(o)} and ${o}.isplayerowned`;
  const ref=o=>`'%s'.[${o}]`;
  const initialize=['Identities','Contacts','MarineStates','OperationHosts','OutsiderExpiry'].map(k=>set('md.$LSPHistory'+k,'table[]')).join('')+
    set('md.$LSPHistoryOutsiderQueue','[]')+set('md.$LSPHistoryOutsiderIndex','1')+
    set('md.$LSPHistoryContactReset','player.age + 60s')+set('md.$LSPHistoryContactKeys','[]')+set('md.$LSPHistoryContactIndex','1')+
    set('md.$LSPHistoryCacheQueue','[]')+each('$Object','$WatchStations',tag('append_to_list',{name:'md.$LSPHistoryCacheQueue',exact:'$Object'}))+
    each('$Object','$WatchShips',tag('append_to_list',{name:'md.$LSPHistoryCacheQueue',exact:'$Object'}))+
    set('md.$LSPHistoryCacheIndex','1')+set('md.$LSPHistoryMarineQueue','[]')+set('md.$LSPHistoryMarineIndex','1')+
    tag('create_group',{groupname:'md.$LSPHistoryOutsiders'})+
    tag('find_sector',{name:'$HistorySectors',space:'player.galaxy',multiple:'true'})+
    tag('create_group',{groupname:'md.$LSPHistorySectors'})+tag('add_to_group',{groupname:'md.$LSPHistorySectors',list:'$HistorySectors'});
  const identity=lib('HistoryIdentity',{Object:'null'},
    set('$Key',"'$ref:%s'.[$Object]")+set('$I',"table[$kind='ASSET',$seed='',$idcode='',$reference='%s'.[$Object],$name='',$faction='',$sector='',$known_player=false]")+
    iff('md.$LSPHistoryIdentities.{$Key}?',set('$I','md.$LSPHistoryIdentities.{$Key}'))+
    iff(valid('$Object'),
      set('$Seed',ref('@$Object.seed'))+
      iff("$Seed != 'null' and $I.$seed != '' and $I.$seed != $Seed",set('$I',"table[$kind='ASSET',$seed='',$idcode='',$reference='%s'.[$Object],$name='',$faction='',$sector='',$known_player=false]"))+
      iff("$Seed != 'null'",set('$I.$seed','$Seed'))+
      iff('$Object.isclass.ship',set('$I.$kind',"'SHIP'"))+
      tag('do_elseif',{value:'$Object.isclass.station'},set('$I.$kind',"'STATION'"))+
      tag('do_elseif',{value:'$Object.isclass.npc'},set('$I.$kind',"'NPC'"))+
      set('$I.$idcode',"if @$Object.idcode != null then $Object.idcode else ''")+
      set('$I.$name',"if @$Object.knownname != null then $Object.knownname else ''")+
      set('$I.$faction',"if @$Object.owner != null then '%s'.[$Object.owner] else ''")+
      set('$I.$sector',"if @$Object.sector.knownname != null then $Object.sector.knownname else ''")+
      iff('@$Object.isplayerowned',set('$I.$known_player','true'))+
      set('md.$LSPHistoryIdentities.{$Key}','$I'))+ret('$I'));
  const fields=['subject_seed','subject_idcode','subject_reference','subject_name','subject_faction','sector_name',
    'other_seed','other_idcode','other_reference','other_name','other_faction','other_kind',
    'previous_seed','previous_idcode','previous_reference','previous_name','detail','detail_name','source_event','scope','identity_state','external_loss_watch'];
  const observe=lib('RecordHistoryEvent',{Subject:'null',Other:'null',Previous:'null',Type:null,Source:"'UNKNOWN'",Detail:'null',DetailName:'null',Data:'table[]',Relevant:'false',World:'false',AllowExternal:'false',Coalesce:'false',TrackOther:'false',NpcSeed:'null',NpcName:'null'},
    iff('not md.$LSPReady or md.$LSPStopped or not md.$LSPHistoryIdentities?',ret('false'))+
    run('HistoryIdentity',{Object:'$Subject'},'$S')+
    iff('not $World and not $Relevant and not $AllowExternal and not $S.$known_player',ret('false'))+
    iff("not $World and $NpcSeed == null and not $AllowExternal and $Type != 'DESTROYED' and $Type != 'OWNER_CHANGED' and not ("+owned('$Subject')+')',ret('false'))+
    run('HistoryIdentity',{Object:'$Other'},'$O')+run('HistoryIdentity',{Object:'$Previous'},'$P')+
    set('$Kind','$S.$kind')+set('$Scope',"if $AllowExternal then 'RELATED_EXTERNAL' else 'PLAYER_ASSET'")+
    iff('$World',set('$Kind',"'UNIVERSE'")+set('$Scope',"'WORLD_CONTEXT'"))+
    iff('$NpcSeed != null',set('$Kind',"'NPC'")+set('$Scope',"'BOARDING_PARTICIPANT'"))+
    // Fixed-window first-contact observations. Never claim the window is an entire battle.
    iff('$Coalesce',set('$ContactKey',"'$contact:%s:%s:%s:%s'.[$Type,$S.$reference,$O.$reference,$Detail]")+
      iff('md.$LSPHistoryContacts.{$ContactKey}?',iff('player.age lt md.$LSPHistoryContacts.{$ContactKey}',ret('false')))+
      set('md.$LSPHistoryContacts.{$ContactKey}','player.age + 30s'))+
    set('$external_loss_watch',"'NOT_REQUESTED'")+
    iff('$TrackOther and '+valid('$Other'),iff('not $O.$known_player and ($Other.isclass.ship or $Other.isclass.station)',
      // Explicit cap protects listener growth. Contact facts remain recorded beyond it.
      set('$WatchKey',"'$ref:%s'.[$Other]")+set('$external_loss_watch',"'CAPACITY_EXCEEDED'")+
      iff('md.$LSPHistoryOutsiderExpiry.{$WatchKey}?',set('md.$LSPHistoryOutsiderExpiry.{$WatchKey}','player.age + 120s')+set('$external_loss_watch',"'ENROLLED'"))+
      otherwise(iff('md.$LSPHistoryOutsiders.count lt 256',tag('add_to_group',{groupname:'md.$LSPHistoryOutsiders',object:'$Other'})+
        set('md.$LSPHistoryOutsiderExpiry.{$WatchKey}','player.age + 120s')+set('$external_loss_watch',"'ENROLLED'")+
        tag('append_to_list',{name:'md.$LSPHistoryOutsiderQueue',exact:'[$Other,$WatchKey]'})))))+
    set('$subject_seed','$S.$seed')+set('$subject_idcode','$S.$idcode')+set('$subject_reference','$S.$reference')+
    set('$subject_name','$S.$name')+set('$subject_faction','$S.$faction')+set('$sector_name','$S.$sector')+
    iff('$NpcSeed != null',set('$subject_seed',ref('$NpcSeed'))+set('$subject_name',ref('$NpcName'))+set('$subject_idcode',"''")+set('$subject_reference',"''")+set('$subject_faction',"''"))+
    iff('$World',set('$subject_seed','md.$LSPUniverseIdText')+set('$subject_reference',"''"))+
    set('$other_seed','$O.$seed')+set('$other_idcode','$O.$idcode')+set('$other_reference','$O.$reference')+
    set('$other_name','$O.$name')+set('$other_faction','$O.$faction')+set('$other_kind','$O.$kind')+
    set('$previous_seed','$P.$seed')+set('$previous_idcode','$P.$idcode')+set('$previous_reference','$P.$reference')+set('$previous_name','$P.$name')+
    set('$detail',ref('$Detail'))+set('$detail_name',ref('$DetailName'))+set('$source_event','$Source')+set('$scope','$Scope')+
    set('$identity_state',"if $S.$seed != '' then 'OBSERVED_OR_CACHED' else 'UNKNOWN'")+
    set('$Body',"'ENTITY_EVENT|event_type=%s|subject_kind=%s|observation=OBSERVED'.[$Type,$Kind]")+
    fields.map(f=>run('Escape',{Value:'$'+f},'$Text')+set('$Body',`$Body + '|${f}=' + $Text`)).join('')+
    iff('typeof $Data == datatype.table',each('$Key','$Data.keys.list',set('$FieldKey',ref('$Key'))+tag('substitute_text',{text:'$FieldKey'},tag('replace',{string:"'$'",with:"''"}))+run('Escape',{Value:'@$Data.{$Key}'},'$Text')+set('$Body',"$Body + '|' + $FieldKey + '=' + $Text")))+
    iff('$Coalesce',set('$Body',"$Body + '|coalescing_window_seconds=30|count=UNKNOWN'"))+
    run('Write',{Body:'$Body',EventTrace:'true'})+ret('true'));
  const trade=lib('RecordHistoryTrade',{Offer:null,Order:'null',Type:null,Source:null},
    set('$T','$Offer')+iff('@$Order.exists',set('$T','$Order'))+
    set('$Buyer','@$T.buyer')+set('$Seller','@$T.seller')+
    iff('$Buyer == null',set('$Buyer','@$Offer.buyer'))+iff('$Seller == null',set('$Seller','@$Offer.seller'))+
    iff('$Buyer == null and @$Offer.isbuyoffer',set('$Buyer','@$Offer.owner'))+
    iff('$Seller == null and @$Offer.isselloffer',set('$Seller','@$Offer.owner'))+
    set('$Subject','$Buyer')+set('$Other','$Seller')+
    iff('not ('+owned('$Subject')+')',set('$Subject','$Seller')+set('$Other','$Buyer'))+
    iff('not ('+owned('$Subject')+')',ret('false'))+
    run('RecordHistoryEvent',{Subject:'$Subject',Other:'$Other',Type:'$Type',Source:'$Source',Detail:'@$T.ware',DetailName:'@$T.ware.name',
      Data:"table[$trade_reference=$T,$buyer_reference=$Buyer,$seller_reference=$Seller,$offer_amount=@$Offer.amount,$order_amount=@$Order.amount,$transferred_amount=@$Order.transferredamount,$offer_unit_price=@$Offer.unitprice,$order_price=@$Order.price,$terms_basis='OBSERVED_TERMS_NOT_GUARANTEED_PROCEEDS']"})+ret('true'));
  const supply=lib('RecordHistorySupply',{Object:null,Wares:null,Type:null,Source:null},
    iff('not ('+owned('$Object')+') or typeof $Wares != datatype.table',ret('false'))+
    each('$Ware','$Wares.keys.list',run('RecordHistoryEvent',{Subject:'$Object',Type:'$Type',Source:'$Source',Detail:'$Ware',DetailName:'@$Ware.name',Data:'table[$amount=@$Wares.{$Ware}]'}))+ret('true'));
  const boarding=lib('RecordHistoryBoarding',{Operation:null,Type:null,Phase:'null',PreviousPhase:'null'},
    iff('not md.$LSPReady or md.$LSPStopped',ret('false'))+
    set('$OpKey',"'$operation:%s'.[$Operation]")+set('$Target','@$Operation.boardee')+set('$Attacker','null')+set('$Subject','$Target')+
    set('$Attackers','@$Operation.attackers')+
    iff('typeof $Attackers == datatype.list',each('$A','$Attackers',iff(owned('$A'),set('$Attacker','$A'))))+
    iff('not ('+owned('$Subject')+')',set('$Subject','$Attacker'))+
    iff(valid('$Subject'),set('md.$LSPHistoryOperationHosts.{$OpKey}','$Subject'))+
    otherwise(iff('md.$LSPHistoryOperationHosts.{$OpKey}?',set('$Subject','md.$LSPHistoryOperationHosts.{$OpKey}')))+
    iff('$Subject == null',ret('false'))+
    run('RecordHistoryEvent',{Subject:'$Subject',Other:'$Target',Type:'$Type',Source:"'BOARDING_OPERATION'",Relevant:'true',Detail:'$Phase',Data:'table[$operation_reference=$Operation,$previous_phase=$PreviousPhase]'} )+
    ['infiltrating','fighting','killed'].map(state=>set('$List',`@$Operation.marines.${state}.list`)+
      iff('typeof $List == datatype.list',each('$Template','$List',
        set('$MarineKey',`'$marine:%s:%s:${state}'.[$Operation,$Template]`)+
        iff('not md.$LSPHistoryMarineStates.{$MarineKey}?',
          // Terminal pseudo-type access only; stored queue items are ordinary scalars.
          set('$Seed',`@$Operation.marines.${state}.{$Template}.seed`)+set('$Name',`@$Operation.marines.${state}.{$Template}.name`)+
          iff('$Seed != null',set('md.$LSPHistoryMarineStates.{$MarineKey}','true')+
            tag('append_to_list',{name:'md.$LSPHistoryMarineQueue',exact:`[$Subject,$Target,$Seed,$Name,'${state.toUpperCase()}',$OpKey]`})))))+
      otherwise(run('Write',{Diagnostic:'true',Body:`'BOARDING_ROSTER_GAP|operation=%s|state=${state}|availability=UNAVAILABLE'.[$Operation]`}))).join('')+ret('true'));
  const tick=lib('ProcessHistoryWork',{},
    iff('not md.$LSPHistoryIdentities?',ret('false'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},iff('md.$LSPHistoryOutsiderIndex gt md.$LSPHistoryOutsiderQueue.count',tag('break'))+
      set('$W','md.$LSPHistoryOutsiderQueue.{md.$LSPHistoryOutsiderIndex}')+
      iff('player.age lt md.$LSPHistoryOutsiderExpiry.{$W.{2}} and '+valid('$W.{1}'),tag('break'))+
      iff(valid('$W.{1}'),tag('remove_from_group',{group:'md.$LSPHistoryOutsiders',object:'$W.{1}'}))+
      tag('remove_value',{name:'md.$LSPHistoryOutsiderExpiry.{$W.{2}}'})+add('md.$LSPHistoryOutsiderIndex'))+
    iff('md.$LSPHistoryOutsiderIndex gt md.$LSPHistoryOutsiderQueue.count',set('md.$LSPHistoryOutsiderQueue','[]')+set('md.$LSPHistoryOutsiderIndex','1'))+
    iff('player.age ge md.$LSPHistoryContactReset and md.$LSPHistoryContactKeys.count == 0',set('md.$LSPHistoryContactKeys','md.$LSPHistoryContacts.keys.list')+set('md.$LSPHistoryContactIndex','1')+set('md.$LSPHistoryContactReset','player.age + 60s'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},iff('md.$LSPHistoryContactIndex gt md.$LSPHistoryContactKeys.count',tag('break'))+
      set('$K','md.$LSPHistoryContactKeys.{md.$LSPHistoryContactIndex}')+add('md.$LSPHistoryContactIndex')+
      iff('md.$LSPHistoryContacts.{$K}?',iff('player.age ge md.$LSPHistoryContacts.{$K}',tag('remove_value',{name:'md.$LSPHistoryContacts.{$K}'}))))+
    iff('md.$LSPHistoryContactIndex gt md.$LSPHistoryContactKeys.count',set('md.$LSPHistoryContactKeys','[]')+set('md.$LSPHistoryContactIndex','1'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},iff('md.$LSPHistoryCacheIndex gt md.$LSPHistoryCacheQueue.count',tag('break'))+
      run('HistoryIdentity',{Object:'md.$LSPHistoryCacheQueue.{md.$LSPHistoryCacheIndex}'})+add('md.$LSPHistoryCacheIndex'))+
    iff('md.$LSPHistoryCacheIndex gt md.$LSPHistoryCacheQueue.count',set('md.$LSPHistoryCacheQueue','[]')+set('md.$LSPHistoryCacheIndex','1'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},iff('md.$LSPHistoryMarineIndex gt md.$LSPHistoryMarineQueue.count',tag('break'))+
      set('$M','md.$LSPHistoryMarineQueue.{md.$LSPHistoryMarineIndex}')+add('md.$LSPHistoryMarineIndex')+
      run('RecordHistoryEvent',{Subject:'$M.{1}',Other:'$M.{2}',NpcSeed:'$M.{3}',NpcName:'$M.{4}',Type:"'BOARDING_MARINE_%s'.[$M.{5}]",Relevant:'true',Source:"'BOARDING_ROSTER'",Data:'table[$operation_reference=$M.{6}]'}))+
    iff('md.$LSPHistoryMarineIndex gt md.$LSPHistoryMarineQueue.count',set('md.$LSPHistoryMarineQueue','[]')+set('md.$LSPHistoryMarineIndex','1'))+ret('true'));
  return {initialize,libraries:identity+observe+trade+supply+boarding+tick};
}
