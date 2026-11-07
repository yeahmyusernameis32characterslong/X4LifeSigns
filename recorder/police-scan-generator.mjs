// Sparse observations from the game's police routine. No inventory enumeration.
export function generatePoliceScans(h){
  const {lib,iff,ret,run,set,valid}=h;
  const owned=x=>`${valid(x)} and ${x}.isplayerowned and ${x}.isclass.ship`;
  const scan=lib('RecordPoliceScan',{Subject:'null',Payload:'null'},
    iff('not ('+owned('$Subject')+')',ret('false'))+
    iff('typeof $Payload != datatype.list',ret('false'))+
    iff('$Payload.count != 8',ret('false'))+
    iff('not ('+valid('$Payload.{1}')+')',ret('false'))+
    iff("$Payload.{2} != 'STARTED' and $Payload.{2} != 'RESULT'",ret('false'))+
    iff("$Payload.{2} == 'RESULT'",[4,5,6,7].map(i=>iff(`typeof $Payload.{${i}} != datatype.integer`,ret('false'))+iff(`$Payload.{${i}} != 0 and $Payload.{${i}} != 1`,ret('false'))).join(''))+
    set('$Data',"table[$scan_phase=$Payload.{2},$scan_mode=$Payload.{3},$police_faction=$Payload.{8},$observation_basis='GAME_POLICE_SCRIPT_FLAGS',$inventory_contents_recorded='false']")+
    ['cargo_finding','combined_illegal_finding','trouble_flag_before_response','may_attack_at_result'].map(k=>set('$Data.$'+k,"'NOT_EVALUATED'")).join('')+
    iff("$Payload.{2} == 'RESULT'",set('$Data.$cargo_finding',"if $Payload.{4} == 1 then 'DETECTED' else 'NO_DETECTION_REPORTED'")+
      set('$Data.$combined_illegal_finding',"if $Payload.{5} == 1 then 'DETECTED' else 'NO_DETECTION_REPORTED'")+
      set('$Data.$trouble_flag_before_response',"'%s'.[$Payload.{6}]")+set('$Data.$may_attack_at_result',"'%s'.[$Payload.{7}]"))+
    run('RecordHistoryEvent',{Subject:'$Subject',Other:'$Payload.{1}',Type:"if $Payload.{2} == 'STARTED' then 'POLICE_SCAN_STARTED' else 'POLICE_SCAN_RESULT'",Source:"'order.move.recon:LifeSignsPoliceScanV1'",Data:'$Data'})+ret('true'));
  const response=lib('RecordPoliceResponse',{Subject:'null',Other:'null'},
    iff('not ('+owned('$Subject')+') or not ('+valid('$Other')+')',ret('false'))+
    run('RecordHistoryEvent',{Subject:'$Subject',Other:'$Other',Type:"'POLICE_RESPONSE_REQUESTED'",Source:"'event_object_signalled:police'",Data:"table[$observation_basis='GAME_SECTOR_POLICE_SIGNAL',$reason='NOT_PROVIDED_BY_SIGNAL',$execution='NOT_ESTABLISHED']"})+ret('true'));
  return scan+response;
}
