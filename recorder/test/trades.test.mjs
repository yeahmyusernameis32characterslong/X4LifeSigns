import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {generateRecorder} from '../md-generator.mjs';import {harness} from './md-harness.mjs';
import {parseRecord} from '../log-format.mjs';import {ProfileStore} from '../../profiles/store.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url)));
const asset=(id,owned=true,klass='ship')=>({__type:'component',ref:id,class:klass,exists:true,isplayerowned:owned,seed:BigInt(id.replace(/\D/g,'')||1),idcode:id,knownname:id+' | %',owner:owned?'player':'argon',sector:{knownname:'Trade sector'}});
const setup=(ships=[],stations=[])=>{const h=harness(generateRecorder(config),{ships,stations,databaseState:'READY'});h.start();h.call('ProcessHistoryWork');return h;};
const rows=h=>h.output.filter(r=>r.name.startsWith('profiles-')).map(r=>parseRecord(r.line));
const trades=h=>rows(h).filter(r=>['TRADE_COMPLETED','TRADE_CANCELLED'].includes(r.fields.event_type));
function deal(buyer,seller,id='deal-1'){
 const ware={__type:'ware',ref:'energycells',name:'Energy | cells %'};
 const offer={__type:'trade',ref:'offer-'+id,exists:true,isoffer:true,isorder:false,buyer:null,seller,owner:seller,isselloffer:true,isbuyoffer:false,ware,amount:500,unitprice:12};
 return {offer,order:{__type:'trade',ref:id,exists:true,isorder:true,isoffer:false,buyer,seller,tradeoffer:offer,ware,amount:80,price:960,transferredamount:0}};
}
function callback(h,stage,side,ship,offer,order=null){h.cueVariables('TradeWatch').$TradeObject=ship;h.cueVariables(`Trade_${stage}_${side}`).event={param:offer,param2:order};h.cue(`Trade_${stage}_${side}`);}

test('shipped completion form retains original quantities/prices after offer deletion and amount reaches zero',()=>{
 const ship=asset('OUR-11'),station=asset('ARG-22',false,'station'),h=setup([ship]);const {offer,order}=deal(ship,station);
 callback(h,'started','buyer',ship,offer,order);order.amount=0;order.price=0;order.transferredamount=79;order.tradeoffer=null;
 callback(h,'completed','buyer',ship,order);const f=trades(h).at(-1).fields;
 assert.equal(f.buyer_idcode,'OUR-11');assert.equal(f.seller_idcode,'ARG-22');assert.equal(f.buyer_seed,'11');assert.equal(f.seller_name,station.knownname);
 assert.equal(f.ware,'energycells');assert.equal(f.ware_name,'Energy | cells %');assert.equal(f.offer_amount,'500');assert.equal(f.order_amount,'80');
 assert.equal(f.transferred_amount,'79');assert.equal(f.order_remaining_amount,'0');assert.equal(f.offer_unit_price,'12');assert.equal(f.order_price,'960');
 assert.equal(f.order_terms_basis,'OBSERVED_AT_TRADE_START');assert.equal(f.capture_route,'PLAYER_ASSET');assert.equal(f.trade_direction,'BUY');
 assert.equal(h.md.$LSPTradePending.size,0);
});

test('generic offer/order callback records a player seller and valid zero values without profit claims',()=>{
 const buyer=asset('ARG-22',false,'station'),seller=asset('OUR-11'),h=setup([seller]);const {offer,order}=deal(buyer,seller);
 offer.unitprice=0;offer.amount=0;order.price=0;order.amount=0;
 callback(h,'started','seller',seller,offer,order);callback(h,'completed','seller',seller,offer,order);
 const f=trades(h)[0].fields;assert.equal(f.subject_idcode,'OUR-11');assert.equal(f.buyer_idcode,'ARG-22');assert.equal(f.seller_idcode,'OUR-11');assert.equal(f.trade_direction,'SELL');
 for(const k of ['offer_amount','order_amount','transferred_amount','offer_unit_price','order_price']){assert.equal(f[k],'0');assert.equal(f[k+'_state'],'OBSERVED');}
 assert.equal(f.profit,undefined);assert.equal(f.terms_basis,'OBSERVED_TERMS_NOT_GUARANTEED_PROCEEDS');
});

test('two player sides and galaxy callback produce one canonical ship transaction, not two deliveries',()=>{
 const buyer=asset('STA-22',true,'station'),ship=asset('OUR-11'),h=setup([ship],[buyer]),{offer,order}=deal(buyer,ship);
 callback(h,'started','buyer',buyer,offer,order);callback(h,'started','seller',ship,offer,order);
 h.call('RecordHistoryTrade',{Offer:order,Type:'TRADE_COMPLETED',Source:'event_trade_completed'});
 callback(h,'completed','buyer',buyer,order);callback(h,'completed','seller',ship,order);
 assert.equal(trades(h).length,1);assert.equal(trades(h)[0].fields.subject_idcode,'OUR-11');assert.equal(trades(h)[0].fields.buyer_idcode,'STA-22');
 assert.ok(h.md.$LSPTradeShadowed>=2);
});

test('missing start leaves historical order terms unknown; offer-only cancellation does not invent transferred quantity',()=>{
 const ship=asset('OUR-11'),station=asset('ARG-22',false,'station'),h=setup([ship]),{offer,order}=deal(ship,station);
 order.amount=0;order.transferredamount=23;callback(h,'completed','buyer',ship,order);
 let f=trades(h)[0].fields;assert.equal(f.order_amount_state,'UNKNOWN');assert.equal(f.order_price_state,'UNKNOWN');assert.equal(f.transferred_amount,'23');
 callback(h,'cancelled','buyer',ship,offer);f=trades(h).at(-1).fields;
 assert.equal(f.event_type,'TRADE_CANCELLED');assert.equal(f.transferred_amount_state,'UNKNOWN');assert.equal(f.order_amount_state,'UNKNOWN');assert.equal(f.buyer_idcode,'OUR-11');
});

test('consecutive independent trades in the same second are retained and pending terms reset across load',()=>{
 const ship=asset('OUR-11'),station=asset('ARG-22',false,'station'),h=setup([ship]);
 for(let i=1;i<=2;i++){const {offer,order}=deal(ship,station,'deal-'+i);callback(h,'started','buyer',ship,offer,order);order.transferredamount=5;callback(h,'completed','buyer',ship,order);}
 assert.equal(trades(h).length,2);assert.equal(trades(h)[0].fields.coalescing_window_seconds,undefined);
 const {offer,order}=deal(ship,station,'unfinished');callback(h,'started','buyer',ship,offer,order);assert.equal(h.md.$LSPTradePending.size,1);
 h.load();assert.equal(h.md.$LSPTradePending.size,0);assert.equal(h.md.$LSPTradeWatches.size,0);
 h.call('ProcessHistoryWork');assert.equal(h.md.$LSPTradeWatches.size,1);
 const before=trades(h).length;h.cue('InvalidateLoadedRecorder');callback(h,'completed','buyer',ship,order);assert.equal(trades(h).length,before);
});

test('cancelled deal retains partial delivery and original terms without inventing a failure reason',()=>{
 const ship=asset('OUR-11'),station=asset('ARG-22',false,'station'),h=setup([ship]),{offer,order}=deal(ship,station);
 callback(h,'started','buyer',ship,offer,order);order.amount=60;order.transferredamount=20;
 callback(h,'cancelled','buyer',ship,order);const f=trades(h)[0].fields;
 assert.equal(f.event_type,'TRADE_CANCELLED');assert.equal(f.order_amount,'80');assert.equal(f.order_price,'960');assert.equal(f.transferred_amount,'20');
 assert.equal(f.failure_reason,undefined);assert.equal(h.md.$LSPTradePending.size,0);
 const before=trades(h).length;delete h.md.$LSPTradeWatches;callback(h,'completed','buyer',ship,order);assert.equal(trades(h).length,before);
});

test('new known assets enrol without new baseline; vanished pending deals are swept and health counters are diagnostic only',()=>{
 const ship=asset('OUR-11'),station=asset('ARG-22',false,'station'),h=setup();
 assert.equal(h.call('EnrolTradeWatch',{Object:station}),false);h.call('QueueNewProfile',{Object:ship});assert.equal(h.md.$LSPTradeWatches.size,1);
 const {offer,order}=deal(ship,station);callback(h,'started','buyer',ship,offer,order);order.exists=false;h.player.age+=61;h.call('ProcessTradeWork');
 assert.equal(h.md.$LSPTradePending.size,0);assert.ok(h.output.some(r=>r.line.includes('|TRADE_HEALTH|')));
 assert.equal(rows(h).some(r=>r.kind==='SNAPSHOT_BEGIN'),false);
});

test('transaction fields survive real SQLite ingestion with exact quantities and identities',t=>{
 const ship=asset('OUR-11'),station=asset('ARG-22',false,'station'),h=setup([ship]),{offer,order}=deal(ship,station);
 callback(h,'started','buyer',ship,offer,order);order.amount=0;order.transferredamount=80;callback(h,'completed','buyer',ship,order);
 const records=rows(h),root=fs.mkdtempSync(path.join(os.tmpdir(),'ls-trade-'));let store;
 t.after(()=>{store?.close();fs.rmSync(root,{recursive:true});});store=new ProfileStore(root,records[0].fields.lifesigns_universe_id,records[0].run);store.ingest(records);
 const f=store.eventsAt().at(-1).fields;assert.equal(f.order_amount,'80');assert.equal(f.buyer_idcode,'OUR-11');assert.equal(f.seller_idcode,'ARG-22');assert.equal(f.order_price,'960');
 assert.equal(store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});
