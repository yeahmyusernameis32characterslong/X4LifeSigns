// Deterministic recorder vocabulary, not an incident interpretation or dialogue.
// See the generated MD callbacks and combat-context-generator participant swap.
export function eventMeaning(type,fields={}) {
  if(type==='ATTACKED')return {direction:'OTHER_TO_SUBJECT',subjectRole:'recorded contact recipient',otherRole:'recorded attacker/contact counterpart',intent:'UNKNOWN',warning:'May be collision or coalesced contact; not a shot count or proof of deliberate hostility.'};
  if(type==='ATTACKING')return {direction:'SUBJECT_TO_OTHER',subjectRole:'recorded attacking asset',otherRole:'recorded target',intent:'UNKNOWN',warning:'Do not infer first shot, order issuer, manoeuvres or shot count.'};
  if(type==='KILLED_OBJECT')return {direction:'SUBJECT_KILLED_OTHER',subjectRole:'asset credited with kill',otherRole:'destroyed object',warning:'Not proof of NPC death; paired destruction observations are not another loss.'};
  if(type==='RELATED_OBJECT_DESTROYED')return {subjectRole:'destroyed object',otherRole:'recorded killer if identified',warning:'Not proof of NPC death; paired kill/destruction observations may describe one loss.'};
  if(type.startsWith('ORDER_'))return {subjectRole:'asset with recorded order state',orderState:fields.order_state||fields.subject_order_state||null,issuer:'UNKNOWN_UNLESS_EXPLICITLY_RECORDED',warning:'An order is not a hit or proof of who issued it, intent or first shot.'};
  if(type==='DISTRESS_CALL')return fields.participant_role==='ATTACKER_IN_DISTRESS_REPORT'?{subjectRole:'attacker described by the distress report',otherRole:'distress caller',intent:'UNKNOWN'}:{subjectRole:'distress caller',otherRole:'reported attacker if identified',intent:'UNKNOWN'};
  return null;
}
