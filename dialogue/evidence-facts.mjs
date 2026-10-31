// Interpret recorder fields after authorisation. Never discover new participants
// or join by display name, time proximity, faction or a model's interpretation.
export function evidenceFacts(e) {
  const f=e.fields, entity=side=>({kind:e[side+'_kind']||f[side+'_kind']||null,seed:e[side+'_seed']||null,idcode:e[side+'_idcode']||null,name:f[side+'_name']||null});
  const subject=entity('subject'),other=entity('other');
  const relation=(predicate,roles,notEstablished)=>({predicate,roles,notEstablished,certainty:'RECORDED_OBSERVATION'});
  switch(e.event_type){
    case 'ATTACKED':return relation('CONTACT_RECEIVED',{recipient:subject,source:other},['deliberate hostility','first shot','shot count','cause of later events']);
    case 'ATTACKING':return relation('ATTACK_OBSERVED',{attackingAsset:subject,target:other},['first shot','successful hit','order issuer','cause of later destruction']);
    case 'KILLED_OBJECT':return relation('DESTRUCTION_CREDITED',{creditedAsset:subject,destroyedObject:other},['credited asset survival','NPC death','sole contribution']);
    case 'RELATED_OBJECT_DESTROYED':return relation('SUBJECT_DESTROYED',{destroyedObject:subject,recordedKiller:other},['NPC death','an additional loss if paired with a kill credit']);
    case 'DOCKED':return relation('DOCKING_RECORDED',{dockingAsset:subject,destination:other},['NPC personally aboard','new assignment','reason for docking']);
    case 'ASSIGNMENT_OBSERVED':return relation('ASSIGNMENT_OBSERVED',{person:subject,assignment:{seed:f.assigned_seed||null,idcode:f.assigned_idcode||null}},['arrival or docking','command role unless separately recorded']);
    case 'CONTROL_ROLE_ASSIGNED':case 'CONTROL_ROLE_REMOVED':case 'CREW_ROLE_OBSERVED':return relation(e.event_type,{person:subject,assignment:{seed:f.assigned_seed||null,idcode:f.assigned_idcode||null},role:f.control_post||f.actual_role||null},['personal perception','events outside the evidenced role period']);
    default:if(e.event_type.startsWith('ORDER_'))return relation('ORDER_STATE_OBSERVED',{orderHolder:subject,order:f.order_name||f.subject_order_name||null,state:f.order_state||f.subject_order_state||null},['order issue time','issuer','intent','active execution from ready state alone','first shot']);
  }
  return relation('UNINTERPRETED_RECORD',{subject,other},['any interpretation beyond the recorded fields']);
}

function sameEntity(a,b){
  // Contradictory populated identifiers never become a positive link.
  if(a.kind&&b.kind&&a.kind!==b.kind)return false;
  if(a.seed&&b.seed&&a.seed!==b.seed)return false;
  if(a.idcode&&b.idcode&&a.idcode!==b.idcode)return false;
  if(a.seed&&b.seed)return true;
  // ID-code permanence is not guaranteed; keep it an observed match only.
  if(a.idcode&&b.idcode)return true;
  return null;
}

export function evidenceSequence(rows,offset=0){
  return rows.map((r,i)=>({step:offset+i+1,ref:r.ref,previousRef:i?rows[i-1].ref:null,
    order:'SAVED_ANCESTRY_THEN_RECORD',
    relationToPrevious:i?{sameRecordedSubject:sameEntity(rows[i-1].subject,r.subject),sameRecordedCounterpart:sameEntity(rows[i-1].other,r.other),
      clockMovedBackwards:Number(r.gameTime)<Number(rows[i-1].gameTime),causation:'NOT_ESTABLISHED'}:null}));
}
