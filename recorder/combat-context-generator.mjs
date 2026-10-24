// Read-only observations. Never call relation-changing actions or infer intent.
export function generateCombatContext(h) {
  const {tag,set,add,iff,otherwise,each,ret,run,lib,valid,eventReady}=h;
  const owned=o=>`${valid(o)} and ${o}.isplayerowned`;
  const text=o=>`'%s'.[${o}]`;
  const targetFields=(prefix,obj)=>set(`$D.$${prefix}_reference`,text(obj))+
    iff(valid(obj),set(`$D.$${prefix}_seed`,text('@'+obj+'.seed'))+set(`$D.$${prefix}_idcode`,'@'+obj+'.idcode'));
  const state=lib('CombatState',{Object:'null',Order:'null'},
    set('$D',"table[$controller_state='UNAVAILABLE',$command=null,$order_id=null,$order_internal=null,$order_state=null,$response_id=null]")+
    iff(`not (${eventReady}) or not (${valid('$Object')})`,ret('$D'))+
    set('$D.$owner',text('@$Object.owner'))+set('$D.$true_owner',text('@$Object.trueowner'))+
    set('$D.$response_id',"@$Object.signal.{'attacked'}.response.id")+
    set('$Pilot','null')+
    iff('$Object.isclass.ship',
      iff('$Object == player.occupiedship',set('$D.$controller_state',"'PLAYER'"))+
      otherwise(set('$Pilot','@$Object.aipilot')+
        iff(valid('$Pilot'),set('$D.$controller_state',"'AI_OBSERVED'")+set('$D.$command','@$Pilot.command.value')+
          // A command parameter is not generally an object. Only interpret the verified attack command.
          iff('@$Pilot.command.value == command.attackobject',set('$Target','@$Pilot.command.param')+targetFields('command_target','$Target')))))+
    iff('$Order == null',set('$Order','@$Object.order'))+
    iff('@$Order.exists',set('$D.$order_id','@$Order.id')+set('$D.$order_state','@$Order.state')+
      set('$D.$order_priority','@$Order.haspriority')+set('$D.$order_override','@$Order.isoverride')+
      iff("@$Order.id == 'Attack' or @$Order.id == 'Attack_Player'",
        set('$D.$order_internal','@$Order.$internalorder')+set('$Target','@$Order.$primarytarget')+targetFields('order_target','$Target'))+
      iff("@$Order.id == 'Flee'",set('$D.$flee_method','@$Order.$method')+set('$Target','@$Order.$attacker')+targetFields('flee_attacker','$Target')))+ret('$D'));
  const context=lib('ReadCombatContext',{Subject:'null',Other:'null',Method:'null',Payload:'null',Weapon:'null',Missile:'null',Type:null,Order:'null'},
    set('$D',"table[$intent='UNKNOWN',$context_basis='CALLBACK_OBSERVATION',$method=$Method,$component_reference=null,$weapon_reference=null,$missile_reference=null]")+
    // Locks use per-object selectors, not an undocumented group expression.
    // Enrol only assets participating in retained combat observations, at most 64/run.
    run('EnrolCombatLockWatch',{Object:'$Subject'},'$D.$subject_lock_watch_enrolled')+run('EnrolCombatLockWatch',{Object:'$Other'},'$D.$other_lock_watch_enrolled')+
    set('$D.$lock_watch_limit','64')+set('$D.$lock_watch_scope',"'COMBAT_ENROLLED_ONLY'")+
    set('$Component','$Payload')+
    iff("$Type == 'ATTACKING'",set('$Component','null')+
      iff('typeof $Payload == datatype.list',set('$Component','@$Payload.{1}')+set('$Weapon','@$Payload.{2}')))+
    // Convert ordinary component references to scalars here; no pseudo-types, crew or turret enumeration.
    set('$D.$component_reference',text('$Component'))+set('$D.$weapon_reference',text('$Weapon'))+
    set('$D.$missile_reference',text('$Missile'))+
    iff(valid('$Weapon'),set('$D.$weapon_macro',text('@$Weapon.macro')))+
    run('CombatState',{Object:'$Subject',Order:'$Order'},'$S')+run('CombatState',{Object:'$Other'},'$O')+
    each('$K','$S.keys.list',set('$Key',"'$subject_%s'.[$K]")+h.tag('substitute_text',{text:'$Key'},h.tag('replace',{string:"'_$'",with:"'_'"}))+set('$D.{$Key}','@$S.{$K}'))+
    each('$K','$O.keys.list',set('$Key',"'$other_%s'.[$K]")+h.tag('substitute_text',{text:'$Key'},h.tag('replace',{string:"'_$'",with:"'_'"}))+set('$D.{$Key}','@$O.{$K}'))+
    iff(valid('$Subject')+' and '+valid('$Other'),
      set('$D.$subject_may_attack_other','@$Subject.mayattack.{$Other}')+
      set('$D.$other_may_attack_subject','@$Other.mayattack.{$Subject}')+
      set('$D.$subject_relation_to_other','@$Subject.relationto.{$Other}')+
      iff('@$Subject.trueowner != null and @$Other.trueowner != null',set('$D.$same_true_owner','$Subject.trueowner == $Other.trueowner')))+ret('$D'));
  const observation=lib('RecordCombatObservation',{Subject:'null',Other:'null',Type:null,Source:null,Payload:'null',Weapon:'null',Missile:'null',Faction:'null',Data:'table[]',Detail:'null'},
    iff(`not (${eventReady})`,ret('false'))+
    set('$Role',"if $Type == 'DISTRESS_CALL' then 'DISTRESS_CALLER' else 'SUBJECT'")+
    iff("$Type == 'DISTRESS_CALL' and not ("+owned('$Subject')+')',
      iff('not ('+owned('$Other')+')',ret('false'))+
      set('$Swap','$Subject')+set('$Subject','$Other')+set('$Other','$Swap')+set('$Role',"'ATTACKER_IN_DISTRESS_REPORT'"))+
    iff('not ('+owned('$Subject')+')',ret('false'))+
    // Reject unrelated global signals before any counterpart/context reads.
    // Missile payloads can name contained target components; profile the enclosing asset.
    iff(valid('$Other'),iff('not ($Other.isclass.ship or $Other.isclass.station)',
      set('$Container','@$Other.defensible')+iff(valid('$Container'),set('$Other','$Container'))))+
    set('$Data.$participant_role','$Role')+
    run('RecordHistoryEvent',{Subject:'$Subject',Other:'$Other',Type:'$Type',Source:'$Source',Combat:'true',ContextEvent:'true',
      Payload:'$Payload',Weapon:'$Weapon',Missile:'$Missile',Faction:'$Faction',Detail:'if $Faction != null then $Faction else $Detail',Coalesce:'true',
      Data:'$Data'} )+ret('true'));
  const enrol=lib('EnrolCombatLockWatch',{Object:'null'},
    iff(`not (${eventReady}) or not (`+owned('$Object')+')',ret('false'))+
    iff('not ($Object.isclass.ship or $Object.isclass.station) or typeof @md.$LSPCombatLockKeys != datatype.table',ret('false'))+
    set('$Key',"'$ref:%s'.[$Object]")+
    iff('md.$LSPCombatLockKeys.{$Key}?',ret('true'))+
    iff('md.$LSPCombatLockKeys.keys.count ge 64',ret('false'))+
    set('md.$LSPCombatLockKeys.{$Key}','true')+
    tag('signal_cue_instantly',{cue:'CombatLockWatch',param:'$Object'})+ret('true'));
  const lockChildren=['initiated','acquired'].flatMap(stage=>['attacker','target'].map(side=>
    tag('cue',{name:`CombatLock_${stage}_${side}`,instantiate:'true',namespace:'this'},
      tag('conditions',{},tag('event_lock_'+stage,{[side]:'parent.$LockObject'}))+
      tag('actions',{},run('RecordCombatObservation',{Subject:'parent.$LockObject',Type:`'LOCK_${stage.toUpperCase()}'`,Source:`'event_lock_${stage}'`,Weapon:'@event.param2',Payload:'@event.param3',Detail:`'${side}:%s:%s'.[event.object,event.param]`,
        // Preserve raw fields: target-only schema/AI usage differs on object/param orientation.
        Data:`table[$watch_role='${side.toUpperCase()}',$native_object_reference='%s'.[event.object],$native_param_reference='%s'.[event.param],$counterparty_resolution='UNVERIFIED',$lock_watch_limit=64]`})))
  )).join('');
  const cues=tag('cue',{name:'CombatLockWatch',instantiate:'true',namespace:'this'},
    tag('conditions',{},tag('event_cue_signalled',{cue:'CombatLockWatch'})+tag('check_value',{value:eventReady}))+
    tag('actions',{},set('$LockObject','event.param'))+tag('cues',{},lockChildren));
  const budget=lib('CombatContextBudget',{},
    iff(`not (${eventReady}) or not md.$LSPCombatBudgetUntil? or not md.$LSPCombatBudgetCount? or not md.$LSPCombatLimitNext?`,ret('false'))+
    iff('player.age ge md.$LSPCombatBudgetUntil',set('md.$LSPCombatBudgetUntil','player.age + 1s')+set('md.$LSPCombatBudgetCount','0'))+
    iff('md.$LSPCombatBudgetCount ge 32',
      iff('player.age ge md.$LSPCombatLimitNext',set('md.$LSPCombatLimitNext','player.age + 30s')+
        run('Write',{Body:"'ENTITY_EVENT|event_type=COMBAT_CONTEXT_LIMIT|subject_kind=UNIVERSE|scope=WORLD_CONTEXT|subject_seed=%s|limit_per_game_second=32|suppressed_count=UNKNOWN'.[md.$LSPUniverseIdText]",EventTrace:'true'}))+ret('false'))+
    add('md.$LSPCombatBudgetCount')+ret('true'));
  return {initialize:set('md.$LSPCombatBudgetUntil','player.age + 1s')+set('md.$LSPCombatBudgetCount','0')+set('md.$LSPCombatLimitNext','0')+set('md.$LSPCombatLockKeys','table[]'),libraries:state+context+observation+budget+enrol,cues};
}

