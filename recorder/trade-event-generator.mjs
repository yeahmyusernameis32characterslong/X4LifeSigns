// Passive transaction observations; trade terms are not proof of credited money.
export function generateTradeEvents(h,c) {
  const {tag,set,add,iff,otherwise,each,ret,run,lib,valid,eventReady}=h;
  const owned=o=>`${valid(o)} and ${o}.isplayerowned`;
  const ref=o=>`'%s'.[${o}]`;
  const watchKey=o=>`'$trade:%s:%s'.[${o},@${o}.seed]`;
  const initialize=set('md.$LSPTradeWatches','table[]')+set('md.$LSPTradePending','table[]')+
    set('md.$LSPTradeInitial','[]')+each('$Object','$WatchShips',tag('append_to_list',{name:'md.$LSPTradeInitial',exact:'$Object'}))+
    each('$Object','$WatchStations',tag('append_to_list',{name:'md.$LSPTradeInitial',exact:'$Object'}))+
    ['GalaxyCallbacks','AssetCallbacks','Written','Unresolved','Shadowed'].map(k=>set('md.$LSPTrade'+k,'0L')).join('')+
    set('md.$LSPTradeLastHealthCount','0L')+
    set('md.$LSPTradeHealthNext','player.age + 60s')+set('md.$LSPTradeSweepNext','player.age + 10s')+
    set('md.$LSPTradeSweepKeys','[]')+set('md.$LSPTradeSweepIndex','1');
  const enrol=lib('EnrolTradeWatch',{Object:'null'},
    iff(`not (${eventReady}) or not (`+owned('$Object')+')',ret('false'))+
    iff('not ($Object.isclass.ship or $Object.isclass.station) or typeof @md.$LSPTradeWatches != datatype.table',ret('false'))+
    set('$Key',watchKey('$Object'))+iff('md.$LSPTradeWatches.{$Key}?',ret('true'))+
    set('md.$LSPTradeWatches.{$Key}','true')+tag('signal_cue_instantly',{cue:'TradeWatch',param:'$Object'})+ret('true'));
  const terms=lib('ReadTradeTerms',{Offer:'null',Deal:'null'},
    set('$D',"table[$offer_amount=@$Offer.amount,$order_amount=@$Deal.amount,$offer_unit_price=@$Offer.unitprice,$order_price=@$Deal.price]")+ret('$D'));
  const observe=lib('RecordHistoryTrade',{Offer:'null',Order:'null',Watched:'null',Side:"'GALAXY'",Type:null,Source:null},
    iff('typeof @md.$LSPTradePending != datatype.table or typeof @md.$LSPTradeWatches != datatype.table',ret('false'))+
    iff('$Watched == null',add('md.$LSPTradeGalaxyCallbacks'))+otherwise(add('md.$LSPTradeAssetCallbacks'))+
    iff(`not (${eventReady})`,ret('false'))+
    iff('$Watched != null and not ('+owned('$Watched')+')',ret('false'))+
    // Shipped RML documents a completed deal in event.param, not only param2.
    set('$Deal','$Order')+iff('$Deal == null and @$Offer.isorder',set('$Deal','$Offer'))+
    set('$SourceOffer','$Offer')+iff('@$Offer.isorder',set('$SourceOffer','@$Offer.tradeoffer'))+
    set('$Buyer','@$Deal.buyer')+set('$Seller','@$Deal.seller')+
    iff('$Buyer == null',set('$Buyer','@$Offer.buyer'))+iff('$Seller == null',set('$Seller','@$Offer.seller'))+
    iff('$Buyer == null and @$SourceOffer.isbuyoffer',set('$Buyer','@$SourceOffer.owner'))+
    iff('$Seller == null and @$SourceOffer.isselloffer',set('$Seller','@$SourceOffer.owner'))+
    set('$Key',"'$deal:%s'.[$Deal]")+set('$Cached','null')+
    iff('$Deal != null and md.$LSPTradePending.{$Key}?',set('$Cached','md.$LSPTradePending.{$Key}')+
      iff('$Buyer == null',set('$Buyer','@$Cached.$buyer'))+iff('$Seller == null',set('$Seller','@$Cached.$seller')))+
    iff("$Side == 'BUYER' and $Buyer == null",set('$Buyer','$Watched'))+
    iff("$Side == 'SELLER' and $Seller == null",set('$Seller','$Watched'))+
    // One canonical player participant: prefer a ship, then buyer over seller.
    set('$Subject','$Buyer')+set('$Other','$Seller')+
    iff('not ('+owned('$Buyer')+') or (not @$Buyer.isclass.ship and '+owned('$Seller')+' and @$Seller.isclass.ship)',
      set('$Subject','$Seller')+set('$Other','$Buyer'))+
    iff('not ('+owned('$Subject')+')',add('md.$LSPTradeUnresolved')+ret('false'))+
    iff('$Watched != null and $Watched != $Subject',add('md.$LSPTradeShadowed')+ret('false'))+
    // Galaxy fallback remains for not-yet-enrolled subjects. Do not double-write
    // the direct buyer/seller callbacks; counters expose both routes to diagnosis.
    set('$WatchKey',watchKey('$Subject'))+
    iff('$Watched == null and md.$LSPTradeWatches.{$WatchKey}?',add('md.$LSPTradeShadowed')+ret('false'))+
    iff("$Type == 'TRADE_STARTED'",
      iff('$Deal != null and $Cached == null',run('HistoryIdentity',{Object:'$Buyer'})+run('HistoryIdentity',{Object:'$Seller'})+
        run('ReadTradeTerms',{Offer:'$SourceOffer',Deal:'$Deal'},'$D')+
        set('$D.$deal','$Deal')+set('$D.$buyer','$Buyer')+set('$D.$seller','$Seller')+
        set('$D.$ware','@$Deal.ware')+
        set('md.$LSPTradePending.{$Key}','$D'))+ret('true'))+
    run('ReadTradeTerms',{Offer:'$SourceOffer',Deal:'$Deal'},'$D')+
    set('$D.$order_amount','null')+set('$D.$order_price','null')+
    set('$D.$order_terms_basis',"'UNKNOWN_NO_START_OBSERVATION'")+
    iff('$Cached != null',
      set('$D.$order_amount','@$Cached.$order_amount')+set('$D.$order_price','@$Cached.$order_price')+
      set('$D.$offer_amount','@$Cached.$offer_amount')+set('$D.$offer_unit_price','@$Cached.$offer_unit_price')+
      set('$D.$order_terms_basis',"'OBSERVED_AT_TRADE_START'")+
      set('$D.$offer_terms_basis',"'OBSERVED_AT_TRADE_START'"))+
    otherwise(set('$D.$offer_terms_basis',"'OBSERVED_AT_CALLBACK'"))+
    set('$D.$order_remaining_amount','@$Deal.amount')+
    set('$D.$transferred_amount','@$Deal.transferredamount')+
    set('$D.$trade_reference',ref('$Deal'))+set('$D.$offer_reference',ref('$SourceOffer'))+
    set('$D.$callback_offer_reference',ref('$Offer'))+set('$D.$callback_order_reference',ref('$Order'))+
    set('$D.$capture_route',"if $Watched == null then 'GALAXY_FALLBACK' else 'PLAYER_ASSET'")+
    set('$D.$terms_basis',"'OBSERVED_TERMS_NOT_GUARANTEED_PROCEEDS'")+
    set('$D.$trade_direction',"if $Subject == $Buyer then 'BUY' else 'SELL'")+
    // Independent named sides avoid interpreting subject ordering as buyer/seller.
    run('HistoryIdentity',{Object:'$Buyer'},'$B')+run('HistoryIdentity',{Object:'$Seller'},'$S')+
    ['buyer','seller'].map((side,i)=>['seed','idcode','reference','name','faction','sector'].map(f=>
      set(`$D.$${side}_${f}`,`$${i?'S':'B'}.$${f}`)).join('')).join('')+
    set('$Ware','@$Deal.ware')+iff('$Ware == null',set('$Ware','@$Offer.ware'))+
    iff('$Ware == null and $Cached != null',set('$Ware','@$Cached.$ware'))+
    set('$D.$ware',ref('$Ware'))+set('$D.$ware_name','@$Ware.name')+
    ['offer_amount','order_amount','transferred_amount','offer_unit_price','order_price'].map(f=>
      set(`$D.$${f}_state`,`if $D.$${f} == null then 'UNKNOWN' else 'OBSERVED'`)).join('')+
    run('RecordHistoryEvent',{Subject:'$Subject',Other:'$Other',Type:'$Type',Source:'$Source',Detail:'$Ware',DetailName:'@$Ware.name',Data:'$D'},'$Written')+
    iff('$Written',add('md.$LSPTradeWritten')+iff('$Deal != null and md.$LSPTradePending.{$Key}?',tag('remove_value',{name:'md.$LSPTradePending.{$Key}'})))+
    ret('$Written'));
  const work=lib('ProcessTradeWork',{},
    iff(`not (${eventReady})`,ret('false'))+
    each('$Object','md.$LSPTradeInitial',run('EnrolTradeWatch',{Object:'$Object'}))+set('md.$LSPTradeInitial','[]')+
    iff('player.age ge md.$LSPTradeSweepNext',set('md.$LSPTradeSweepNext','player.age + 10s')+
      set('md.$LSPTradeSweepKeys','md.$LSPTradePending.keys.list')+set('md.$LSPTradeSweepIndex','1'))+
    tag('do_all',{exact:String(c.discoveryPerTick)},
      iff('md.$LSPTradeSweepIndex gt md.$LSPTradeSweepKeys.count',tag('break'))+
      set('$Key','md.$LSPTradeSweepKeys.{md.$LSPTradeSweepIndex}')+add('md.$LSPTradeSweepIndex')+
      iff('md.$LSPTradePending.{$Key}?',iff('not @md.$LSPTradePending.{$Key}.$deal.exists',tag('remove_value',{name:'md.$LSPTradePending.{$Key}'}))))+
    iff('player.age ge md.$LSPTradeHealthNext',set('md.$LSPTradeHealthNext','player.age + 60s')+
      iff('md.$LSPLevel ge 3 and md.$LSPTradeLastHealthCount != md.$LSPTradeGalaxyCallbacks + md.$LSPTradeAssetCallbacks',
        set('md.$LSPTradeLastHealthCount','md.$LSPTradeGalaxyCallbacks + md.$LSPTradeAssetCallbacks')+
        run('Write',{Diagnostic:'true',Body:"'TRADE_HEALTH|galaxy_callbacks=%s|asset_callbacks=%s|written=%s|unresolved=%s|shadowed=%s|watches=%s|pending=%s'.[md.$LSPTradeGalaxyCallbacks,md.$LSPTradeAssetCallbacks,md.$LSPTradeWritten,md.$LSPTradeUnresolved,md.$LSPTradeShadowed,md.$LSPTradeWatches.keys.count,md.$LSPTradePending.keys.count]"})))+ret('true'));
  const children=['started','completed','cancelled'].flatMap(stage=>['buyer','seller'].map(side=>
    tag('cue',{name:`Trade_${stage}_${side}`,instantiate:'true',namespace:'this'},
      tag('conditions',{},tag('event_trade_'+stage,{[side]:'parent.$TradeObject'}))+
      tag('actions',{},run('RecordHistoryTrade',{Offer:'@event.param',Order:stage==='cancelled'?'null':'@event.param2',Watched:'parent.$TradeObject',Side:`'${side.toUpperCase()}'`,Type:`'TRADE_${stage.toUpperCase()}'`,Source:`'event_trade_${stage}'`})))))
    .join('');
  const cues=tag('cue',{name:'TradeWatch',instantiate:'true',namespace:'this'},
    tag('conditions',{},tag('event_cue_signalled',{cue:'TradeWatch'})+tag('check_value',{value:eventReady}))+
    tag('actions',{},set('$TradeObject','event.param'))+tag('cues',{},children));
  return {initialize,libraries:enrol+terms+observe+work,cues};
}
