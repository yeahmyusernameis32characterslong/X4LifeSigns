// Station capabilities and ware TYPES only. No inventory, recipe amounts or rates.
export function generateStationProduction(h) {
  const {tag,set,add,iff,otherwise,each,ret,run,lib,valid} = h;
  const room = 'not md.$LSPStopped and md.$LSPRemaining gt 0';
  const field = (name, expression, available = `${expression}?`) => {
    const observed = ['null','true','false'].includes(expression) || expression.startsWith("'") ? expression : '@'+expression;
    return iff('not md.$LSPStopped',
      iff('md.$LSPRemaining gt 0',run('StationProductionScalar',{Field:name,Value:observed,Available:available}))+
      otherwise(run('StationProductionScalar',{Field:name,Value:'null',Available:'false'})));
  };
  const literal = (name, expression) => field(`'${name}'`,expression,'true');
  const scalar=lib('StationProductionScalar',{Field:null,Value:null,Available:'true'},
    iff('not $Available or $Value == null',set('md.$LSPStationProductionComplete','false'))+
    run('Value',{Field:'$Field',Value:'$Value',Available:'$Available'})+ret('true'));
  const wares=lib('StationProductionWares',{Prefix:null,Wares:null},
    iff('typeof $Wares != datatype.list',
      field("$Prefix + '_count'",'null','false')+ret('false'))+
    field("$Prefix + '_count'",'$Wares.count')+
    set('$WareIndex','0')+each('$Ware','$Wares',
      iff(`not (${room})`,run('Value',{Field:"$Prefix + '_limit'",Value:'null',Available:'false'})+tag('break'))+
      add('$WareIndex')+set('$WarePrefix',"'%s_%s'.[$Prefix,$WareIndex]")+
      field("$WarePrefix + '_id'",'$Ware.id')+field("$WarePrefix + '_name'",'$Ware.name'))+ret('true'));
  const state=lib('StationProductionModules',{Modules:null,State:null},
    iff('typeof $Modules != datatype.list',
      field("'station_modules_' + $State + '_count'",'null','false')+ret('false'))+
    field("'station_modules_' + $State + '_count'",'$Modules.count')+
    each('$Module','$Modules',
      iff(`not (${room})`,run('Value',{Field:"'station_module_limit'",Value:'null',Available:'false'})+tag('break'))+
      add('md.$LSPStationModuleCount')+set('$Prefix',"'module_%s'.[md.$LSPStationModuleCount]")+
      iff(valid('$Module'),
        field("$Prefix + '_macro'",'$Module.macro.id')+
        field("$Prefix + '_name'",'$Module.macro.name')+
        field("$Prefix + '_class'","'%s'.[$Module.realclass]",'$Module.realclass?')+
        field("$Prefix + '_state'",'$State','true')+
        iff(room,
          iff('$Module.isrealclass.production or $Module.isrealclass.processingmodule',
            run('StationProductionWares',{Prefix:"$Prefix + '_product'",Wares:'@$Module.products.list'})+
            iff(room,run('StationProductionWares',{Prefix:"$Prefix + '_resource'",Wares:'@$Module.resources.list'})))+
          tag('do_elseif',{value:'$Module.isrealclass.habitation'},
            field("$Prefix + '_workforce_race'",'$Module.workforce.race.name')+
            iff(room,run('StationProductionWares',{Prefix:"$Prefix + '_workforce_resource'",Wares:'@$Module.resources.list'})))+
          tag('do_elseif',{value:'$Module.isrealclass.storage'},
            set('$Transports','@$Module.waretransport')+
            iff('typeof $Transports == datatype.list',
              field("$Prefix + '_storage_transport_count'",'$Transports.count')+
              set('$TransportIndex','0')+each('$Transport','$Transports',
                iff(`not (${room})`,run('Value',{Field:"'station_transport_limit'",Value:'null',Available:'false'})+tag('break'))+
                add('$TransportIndex')+field("'%s_storage_transport_%s'.[$Prefix,$TransportIndex]","'%s'.[$Transport]",'true')))+
            otherwise(field("$Prefix + '_storage_transport_count'",'null','false')))+
          tag('do_elseif',{value:'$Module.isrealclass.buildmodule'},
            field("$Prefix + '_build_resource_scope'","'BUILD_SPECIFIC_NOT_ENUMERATED'",'true'))))+
      otherwise(field("$Prefix + '_reference_state'",'null','false')))+ret('true'));
  const profile=lib('StationProduction',{Station:null},
    set('md.$LSPStationProductionComplete','true')+set('md.$LSPStationModuleCount','0')+
    iff("md.$LSPCurrentSeed != ''",set("md.$LSPStationProductionAttempted.{'$STATION:' + md.$LSPCurrentSeed}",'true'))+
    literal('station_production_version','1')+
    literal('station_module_scope',"'EXISTING_OPERATIONAL_AND_CONSTRUCTION_COMPONENTS'")+
    literal('station_ware_scope',"'MODULE_DECLARED_TYPES_NOT_STOCKS_OR_RATES'")+
    ['product','resource','supply_resource','trade_ware'].map((prefix,i)=>
      iff(`${valid('$Station')} and ${room}`,run('StationProductionWares',{
        Prefix:`'station_${prefix}'`,Wares:`@$Station.${['products','resources','supplyresources','tradewares'][i]}.list`
      }))).join('')+
    iff(`${valid('$Station')} and ${room}`,
      run('StationProductionModules',{Modules:'@$Station.modules.operational.list',State:"'operational'"})+
      iff(room,run('StationProductionModules',{Modules:'@$Station.modules.construction.list',State:"'construction'"})))+
    otherwise(set('md.$LSPStationProductionComplete','false'))+
    set('md.$LSPStationProductionComplete','md.$LSPStationProductionComplete and not md.$LSPValueLimit and md.$LSPRemaining gt 0')+
    literal('station_production_complete','md.$LSPStationProductionComplete')+
    iff('md.$LSPValueLimit',set('md.$LSPStationProductionComplete','false'))+ret('true'));
  return {libraries:scalar+wares+state+profile};
}
