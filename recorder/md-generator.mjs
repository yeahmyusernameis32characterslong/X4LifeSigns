import { catalog, levels, lightEvents } from './catalog.mjs';

const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const tag = (name, attrs = {}, body) => `<${name}${Object.entries(attrs).map(([k, v]) => ` ${k}="${xml(v)}"`).join('')}${body === undefined ? ' />' : `>${body}</${name}>`}`;
const set = (name, exact) => tag('set_value', { name, exact });
const add = (name, exact = '1L') => tag('set_value', { name, exact, operation: 'add' });
const iff = (value, body) => tag('do_if', { value }, body);
const each = (name, input, body) => tag('do_for_each', { name, in: input }, body);
const run = (ref, params = {}, result) => tag('run_actions', { ref, ...(result ? { result } : {}) }, Object.entries(params).map(([name, value]) => tag('param', { name, value })).join(''));
const lib = (name, params, actions) => tag('library', { name, purpose: 'run_actions' }, tag('params', {}, Object.entries(params).map(([name, value]) => tag('param', { name, ...(value === null ? {} : { default: value }) })).join('')) + tag('actions', {}, actions));
const ret = value => tag('return', { value });
const write = (body, seq = '$Seq') => run('Write', { Body: body, Seq: seq });
const value = (path, expression, available = 'true', enrich = 'false') => run('Value', { Path: path, Value: expression, Available: available, Seq: '$Seq', Budget: '$Budget', Depth: '0', Enrich: enrich });

export function validateConfig(c) {
  const expected = ['diagnostics', 'periodSeconds', 'reconcileSeconds', 'heartbeatSeconds', 'assetsPerTick', 'crewPerAsset', 'snapshotValueItems', 'eventValueItems', 'valueDepth', 'snapshotQueue', 'actorReferences', 'maxRowsPerRun'];
  if (!c || Object.keys(c).sort().join() !== expected.sort().join()) throw new Error('Unexpected recorder configuration keys');
  if (!levels.includes(c.diagnostics)) throw new Error('Invalid diagnostics level');
  const bounds = { periodSeconds: [10, 86400], reconcileSeconds: [5, 3600], heartbeatSeconds: [10, 3600], assetsPerTick: [1, 64], crewPerAsset: [1, 1024], snapshotValueItems: [16, 16384], eventValueItems: [16, 4096], valueDepth: [1, 8], snapshotQueue: [1, 64], actorReferences: [1, 100000], maxRowsPerRun: [1000, 10000000] };
  for (const [key, [min, max]] of Object.entries(bounds)) if (!Number.isSafeInteger(c[key]) || c[key] < min || c[key] > max) throw new Error(`Invalid ${key}`);
  return c;
}

export function generateRecorder(config) {
  const c = validateConfig(config);
  const capture = catalog.map(({ event, scope }, i) => {
    const attrs = scope === 'player' ? {} : { group: scope === 'assets' ? 'md.$LSERAssets' : 'md.$LSERActors' };
    // Copy all event expressions before invoking helpers. No delayed event expressions.
    const copies = ['object', 'param', 'param2', 'param3'].map((field, j) => set(`$V${j}`, `@event.${field}`) + set(`$A${j}`, `event.${field}?`)).join('');
    return tag('cue', { name: `Listen${i + 1}`, instantiate: 'true', namespace: 'this' }, tag('conditions', {}, tag(event, attrs) + tag('check_value', { value: 'md.$LSERReady and parent.$Epoch == md.$LSEREpoch' })) + tag('actions', {}, copies + set('$Name', 'event.name') + set('$Age', 'player.age') + run('Capture', { Name: '$Name', Values: '[$V0, $V1, $V2, $V3]', Available: '[$A0, $A1, $A2, $A3]', Age: '$Age', Scope: `'${scope}'`, Epoch: 'parent.$Epoch' })));
  }).join('');

  const escape = lib('Escape', { Value: null }, set('$Text', "'%s'.[$Value]") +
    [ ['%', '%25'], ['|', '%7C'], ['\n', '%0A'], ['\r', '%0D'], ['\t', '%09'] ].map(([a, b]) => tag('substitute_text', { text: '$Text' }, tag('replace', { string: `'${a.replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t')}'`, with: `'${b}'` }))).join('') + ret('$Text'));

  const writer = lib('Write', { Body: null, Seq: null, Diagnostic: 'false', Level: '0' },
    iff('$Diagnostic and (md.$LSERLevel == 0 or $Level gt md.$LSERLevel)', ret('false')) +
    iff('not $Diagnostic', add('md.$LSERPrepared')) +
    iff('not $Diagnostic and md.$LSERStopped', add('md.$LSERRowsSuppressed') + ret('false')) +
    set('$Session', "'UNAVAILABLE'") + iff('md.$LifeSignsProductionSessionReady? and md.$LifeSignsProductionSessionKey?', iff("md.$LifeSignsProductionSessionReady and md.$LifeSignsProductionSessionKey != ''", set('$Session', 'md.$LifeSignsProductionSessionKey'))) +
    iff(`not $Diagnostic and md.$LSERWrites ge ${c.maxRowsPerRun}L`, set('md.$LSERStopped', 'true') + add('md.$LSERFailures') + add('md.$LSERIncomplete') + add('md.$LSERWrites') + tag('debug_to_file', { name: "'events.log'", directory: "'lifesigns-event-recorder'", append: 'true', text: "'LSEV1|run=%s|session=%s|seq=%s|age=%s|LIMIT|reason=MAX_ROWS|capture_stopped=true|END'.[md.$LSERRun, $Session, $Seq, player.age]" }) + run('Write', { Seq: '$Seq', Diagnostic: 'true', Level: '1', Body: "'FAULT|reason=MAX_ROWS|capture_stopped=true'" }) + ret('false')) +
    iff(`$Diagnostic and md.$LSERDiagnosticWrites ge ${c.maxRowsPerRun}L`, ret('false')) +
    set('$Line', "'LSEV1|run=%s|session=%s|seq=%s|age=%s|%s|END'.[md.$LSERRun, $Session, $Seq, player.age, $Body]") +
    iff('$Diagnostic', add('md.$LSERDiagnosticWrites') + tag('debug_to_file', { name: "'diagnostics.log'", directory: "'lifesigns-event-recorder'", text: '$Line', append: 'true' })) +
    tag('do_else', {}, add('md.$LSERWrites') + tag('debug_to_file', { name: "'events.log'", directory: "'lifesigns-event-recorder'", text: '$Line', append: 'true' })) + ret('true'));

  const fields = ['idcode', 'knownname', 'class', 'owner', 'trueowner', 'sector', 'container'];
  const budgetLimit = iff('not $Budget.$limited', set('$Budget.$limited', 'true') + set('$Budget.$reported', 'true') + add('md.$LSERIncomplete') + write("'PAYLOAD_LIMIT|reason=VALUE_BUDGET'"));
  const stopDetails = iff('md.$LSERStopped', tag('break')) + iff('$Budget.$remaining le 0', budgetLimit + tag('break'));
  const context = fields.map(field => value(`$Path + '.${field}'`, `@$Value.${field}`, `$Value.${field}?`)).join('') +
    iff('$Value.isclass.entity', ['role', 'roleobject', 'assignedcontrolled', 'controlpost', 'npctemplate'].map(field => value(`$Path + '.${field}'`, `@$Value.${field}`, `$Value.${field}?`)).join(''));
  const val = lib('Value', { Path: null, Value: null, Available: 'true', Seq: null, Budget: null, Depth: '0', Enrich: 'false' },
    iff('md.$LSERStopped', ret('false')) +
    iff('$Budget.$remaining le 0', budgetLimit + ret('false')) +
    add('$Budget.$remaining', '-1') + run('Escape', { Value: '$Path' }, '$Field') +
    set('$Type', "'UNAVAILABLE'") + set('$Text', "''") + set('$State', "'UNAVAILABLE'") +
    iff('$Available', set('$Type', 'typeof $Value') + set('$State', "'PRESENT'") +
      iff('typeof $Value == datatype.list', set('$Text', '$Value.count')) +
      tag('do_elseif', { value: 'typeof $Value == datatype.table' }, set('$Text', '$Value.keys.count')) +
      tag('do_else', {}, set('$Text', "'%s'.[$Value]")) +
      iff('typeof $Value == datatype.null', set('$State', "'NULL'")) +
      iff('typeof $Value == datatype.component', iff('not $Value.exists', set('$State', "'UNAVAILABLE_REFERENCE'")))) +
    run('Escape', { Value: '$Text' }, '$Text') + run('Escape', { Value: '$Type' }, '$TypeText') +
    write("'VALUE|field=%s|type=%s|state=%s|render=ENGINE_TEXT_UNVERIFIED|value=%s'.[$Field, $TypeText, $State, $Text]") +
    iff('$Available and (typeof $Value == datatype.list or typeof $Value == datatype.table)',
      iff(`$Depth ge ${c.valueDepth}`, set('$Budget.$reported', 'true') + add('md.$LSERIncomplete') + write("'PAYLOAD_LIMIT|field=%s|reason=DEPTH'.[$Field]") + ret('false')) +
      set('$Items', 'if typeof $Value == datatype.list then $Value else $Value.keys.list') + set('$Index', '0') +
      each('$Item', '$Items', iff('md.$LSERStopped', tag('break')) + iff('$Budget.$remaining le 0', set('$Budget.$reported', 'true') + add('md.$LSERIncomplete') + write("'PAYLOAD_LIMIT|field=%s|reason=ITEMS|remaining=%s'.[$Field, $Items.count - $Index]") + tag('break')) + add('$Index', '1') +
        iff('typeof $Value == datatype.table', run('Value', { Path: "$Path + '.entry' + $Index + '.key'", Value: '$Item', Seq: '$Seq', Budget: '$Budget', Depth: '$Depth + 1' }) + run('Value', { Path: "$Path + '.entry' + $Index + '.value'", Value: '$Value.{$Item}', Seq: '$Seq', Budget: '$Budget', Depth: '$Depth + 1' })) +
        tag('do_else', {}, run('Value', { Path: "$Path + '.' + $Index", Value: '$Item', Seq: '$Seq', Budget: '$Budget', Depth: '$Depth + 1', Enrich: '$Enrich' })))) +
    iff('$Available and $Enrich and typeof $Value == datatype.component', iff('$Value.exists and ($Value.isclass.ship or $Value.isclass.station or $Value.isclass.entity)', context)) + ret('true'));

  // Availability is outside the value budget, before any enrichment. Reuse the
  // observed collections for details; neither representation materialises NPCs.
  const availability = set('$People', 'null') + set('$Actors', 'null') +
    set('$AssetState', "'UNSUPPORTED_ASSET'") + set('$AssetId', "'UNAVAILABLE'") +
    iff('typeof $Asset == datatype.component', set('$AssetState', "'UNAVAILABLE_REFERENCE'") +
      iff('$Asset.exists and ($Asset.isclass.ship or $Asset.isclass.station)', set('$AssetState', "'AVAILABLE'") +
        iff('$Asset.idcode?', set('$AssetId', '$Asset.idcode')) +
        set('$People', '@$Asset.people.list') + set('$Actors', '@$Asset.roleentities'))) +
    run('Escape', { Value: '$Asset' }, '$AssetRef') + run('Escape', { Value: '$AssetId' }, '$AssetId') +
    run('Escape', { Value: '$Path' }, '$AssetField') +
    [['People', 'CONTEXTUAL'], ['Actors', 'INSTANTIATED']].map(([name, representation]) =>
      set(`$${name}Count`, "'UNAVAILABLE'") + set(`$${name}State`, '$AssetState') +
      iff("$AssetState == 'AVAILABLE'", set(`$${name}State`, "'COLLECTION_UNAVAILABLE'") +
        iff(`typeof $${name} == datatype.list`, set(`$${name}State`, "'COUNT_UNAVAILABLE'") +
          iff(`$${name}.count?`, set(`$${name}Count`, `$${name}.count`) + set(`$${name}State`, "'AVAILABLE'")))) +
      write(`'PERSONNEL_AVAILABILITY|trigger=%s|field=%s|asset_ref=%s|asset_id=%s|asset_state=%s|representation=${representation}|available=%s|state=%s'.[$Trigger, $AssetField, $AssetRef, $AssetId, $AssetState, $${name}Count, $${name}State]`) +
      iff(`$${name}State != 'AVAILABLE'`, set('$Budget.$reported', 'true') + add('md.$LSERIncomplete'))
    ).join('');
  const actorSnapshot = iff("$ActorsState == 'AVAILABLE'",
    set('$ActorCount', `[$ActorsCount, ${c.crewPerAsset}].min`) +
    tag('do_all', { exact: '$ActorCount', counter: '$ActorIndex' }, stopDetails + set('$Actor', '$Actors.{$ActorIndex}') +
      value("$Path + '.instances.' + $ActorIndex", '$Actor', 'true', 'true') +
      iff('typeof $Actor == datatype.component', iff('$Actor.exists and md.$LSERActorsSeen.indexof.{$Actor} == 0',
        iff(`md.$LSERActorsSeen.count lt ${c.actorReferences}`, tag('append_to_list', { name: 'md.$LSERActorsSeen', exact: '$Actor' }) + tag('add_to_group', { groupname: 'md.$LSERActors', object: '$Actor' })) +
        tag('do_else', {}, set('$Budget.$reported', 'true') + add('md.$LSERIncomplete') + write("'MEMBERSHIP_LIMIT|kind=personnel'"))))) +
    iff('$ActorsCount gt $ActorCount', set('$Budget.$reported', 'true') + add('md.$LSERIncomplete') + write("'ROSTER_LIMIT|field=%s.instances|omitted=%s'.[$Path, $ActorsCount - $ActorCount]")));
  const snapshot = lib('Asset', { Asset: null, Seq: null, Trigger: null, Path: "'asset'", Epoch: 'md.$LSEREpoch' },
    iff('not md.$LSERReady or $Epoch != md.$LSEREpoch or md.$LSERStopped', ret('true')) +
    set('$Budget', `table[$remaining=${c.snapshotValueItems}, $reported=false, $limited=false]`) + write("'ASSET_BEGIN|trigger=%s|field=%s|atomic=false'.[$Trigger, $Path]") + availability +
    value('$Path', '$Asset', 'true', 'true') +
    iff('typeof $Asset == datatype.component', iff('$Asset.exists and ($Asset.isclass.ship or $Asset.isclass.station)',
      value("$Path + '.assignedaipilot'", '@$Asset.assignedaipilot', '$Asset.assignedaipilot?', 'true') +
      value("$Path + '.assignedcontrolentity'", '@$Asset.assignedcontrolentity.default', '$Asset.assignedcontrolentity.default?', 'true') +
      iff("$PeopleState == 'AVAILABLE'",
        set('$Count', `[$PeopleCount, ${c.crewPerAsset}].min`) +
        tag('do_all', { exact: '$Count', counter: '$Index' }, stopDetails + set('$Template', '$People.{$Index}') +
          value("$Path + '.people.' + $Index + '.template'", '$Template') +
          iff('@$Asset.people.{$Template}.exists', ['seed', 'role', 'isintransit', 'istransferscheduled', 'istemporary'].map(field =>
            iff('not md.$LSERStopped and $Budget.$remaining gt 0',
              iff(`not $Asset.people.{$Template}.${field}?`, set('$Budget.$reported', 'true') + add('md.$LSERIncomplete')) +
              value(`$Path + '.people.' + $Index + '.${field}'`, `@$Asset.people.{$Template}.${field}`, `$Asset.people.{$Template}.${field}?`)) +
            tag('do_else', {}, iff('not md.$LSERStopped', budgetLimit))).join('')) +
          tag('do_else', {}, set('$Budget.$reported', 'true') + add('md.$LSERIncomplete') + value("$Path + '.people.' + $Index + '.entry'", 'null', 'false'))) +
        iff('$PeopleCount gt $Count', set('$Budget.$reported', 'true') + add('md.$LSERIncomplete') + write("'ROSTER_LIMIT|field=%s.people|omitted=%s'.[$Path, $PeopleCount - $Count]"))) +
      actorSnapshot)) +
    write("'ASSET_END|trigger=%s|field=%s|partial=%s'.[$Trigger, $Path, $Budget.$reported]") + ret('$Budget.$reported'));

  const reconcile = lib('Reconcile', {},
    tag('find_ship', { name: '$Ships', space: 'player.galaxy', trueowner: 'faction.player', multiple: 'true', recursive: 'true', checkoperational: 'false' }) +
    tag('find_station', { name: '$Stations', space: 'player.galaxy', trueowner: 'faction.player', multiple: 'true', checkoperational: 'false' }) +
    set('md.$LSERAssetList', '$Ships.clone') + each('$Station', '$Stations', tag('append_to_list', { name: 'md.$LSERAssetList', exact: '$Station' })) +
    tag('add_to_group', { groupname: 'md.$LSERAssets', list: 'md.$LSERAssetList', replace: 'true' }) + set('md.$LSERNextReconcile', `player.age + ${c.reconcileSeconds}s`));

  const queue = lib('QueueSnapshot', { Trigger: null, Requested: null, Cause: '0L', Epoch: 'md.$LSEREpoch' },
    iff('not md.$LSERReady or $Epoch != md.$LSEREpoch', ret('false')) +
    iff('md.$LSERStopped', add('md.$LSERDroppedSnapshots') + ret('false')) +
    iff(`md.$LSERRequests.count ge ${c.snapshotQueue}`, add('md.$LSERDroppedSnapshots') + write("'SNAPSHOT_GAP|reason=QUEUE_FULL|trigger=%s|requested=%s'.[$Trigger, $Requested]", 'md.$LSERSeq') + run('Write', { Seq: 'md.$LSERSeq', Diagnostic: 'true', Level: '2', Body: "'WARNING|reason=SNAPSHOT_QUEUE_FULL'" }) + ret('false')) +
    tag('append_to_list', { name: 'md.$LSERRequests', exact: '[$Trigger, $Requested, $Cause, $Epoch]' }) + ret('true'));

  const captureLib = lib('Capture', { Name: null, Values: null, Available: null, Age: null, Scope: null, Epoch: 'md.$LSEREpoch' },
    iff('not md.$LSERReady or $Epoch != md.$LSEREpoch', ret('false')) + add('md.$LSERReceived') +
    iff("['event_object_changed_owner', 'event_object_changed_true_owner', 'event_player_owned_claimed_object', 'event_object_built_ship', 'event_object_built_station'].indexof.{$Name} gt 0", set('md.$LSERNextReconcile', 'player.age')) +
    set('$Key', "'$' + $Name") + iff('not md.$LSERFamilies.{$Key}?', set('md.$LSERFamilies.{$Key}', '0L')) + add('md.$LSERFamilies.{$Key}') +
    iff('md.$LSERStopped', add('md.$LSERDroppedEvents') + ret('false')) + add('md.$LSERSeq') + set('$Seq', 'md.$LSERSeq') + set('$Budget', `table[$remaining=${c.eventValueItems}, $reported=false, $limited=false]`) +
    set('$Light', `[${lightEvents.map(name => `'${name}'`).join(', ')}].indexof.{$Name} gt 0`) +
    set('$Policy', "if $Light then 'LIGHT_CONTEXT' else 'RICH_DISTINCT'") +
    write("'EVENT_BEGIN|event=%s|scope=%s|observed_age=%s|asset_policy=%s'.[$Name, $Scope, $Age, $Policy]") +
    tag('do_all', { exact: '4', counter: '$Index' }, run('Value', { Path: "['object', 'param', 'param2', 'param3'].{$Index}", Value: '$Values.{$Index}', Available: '$Available.{$Index}', Seq: '$Seq', Budget: '$Budget', Enrich: 'true' })) +
    set('$RichSeen', '[]') + set('$RichPaths', '[]') +
    iff('not $Light', tag('do_all', { exact: '4', counter: '$Index' }, iff('md.$LSERStopped', tag('break')) + set('$Object', '$Values.{$Index}') +
      iff('typeof $Object == datatype.component', iff('$Object.exists and ($Object.isclass.ship or $Object.isclass.station)', iff('$Object.isplayerowned or md.$LSERAssetList.indexof.{$Object} gt 0',
        set('$SeenIndex', '$RichSeen.indexof.{$Object}') + set('$RichPath', "'affected.' + $Index") +
        iff('$SeenIndex == 0', tag('append_to_list', { name: '$RichSeen', exact: '$Object' }) + tag('append_to_list', { name: '$RichPaths', exact: '$RichPath' }) +
          run('Asset', { Asset: '$Object', Seq: '$Seq', Trigger: "'EVENT'", Path: '$RichPath', Epoch: '$Epoch' }, '$Partial') + iff('$Partial', set('$Budget.$reported', 'true'))) +
        tag('do_else', {}, write("'ASSET_ALIAS|field=%s|target=%s|reason=SAME_COMPONENT_WITHIN_EVENT'.[$RichPath, $RichPaths.{$SeenIndex}]"))))))) +
    write("'EVENT_END|event=%s|partial=%s'.[$Name, $Budget.$reported]") + ret('true'));

  const healthActions = iff('player.age ge md.$LSERNextHeartbeat', set('md.$LSERNextHeartbeat', `player.age + ${c.heartbeatSeconds}s`) +
    iff('md.$LSERLevel ge 3', run('Write', { Seq: 'md.$LSERSeq', Diagnostic: 'true', Level: '3', Body: "'HEALTH|received=%s|prepared=%s|writes_attempted=%s|writes_confirmed=UNAVAILABLE|observable_failures=%s|native_getter_errors=UNAVAILABLE|dropped_events=%s|dropped_snapshots=%s|incomplete=%s|window=GAME_TIME|per_frame=UNAVAILABLE|status=OBSERVED_COUNTERS_ONLY'.[md.$LSERReceived, md.$LSERPrepared, md.$LSERWrites, md.$LSERFailures, md.$LSERDroppedEvents, md.$LSERDroppedSnapshots, md.$LSERIncomplete]" })) +
    iff('md.$LSERLevel ge 4', each('$Family', 'md.$LSERFamilies.keys.list', run('Write', { Seq: 'md.$LSERSeq', Diagnostic: 'true', Level: '4', Body: "'FAMILY|key=%s|received=%s'.[$Family, md.$LSERFamilies.{$Family}]" }))));
  const health = lib('Health', {}, healthActions);
  const tick = lib('Tick', { Epoch: 'md.$LSEREpoch' },
    iff('not md.$LSERReady or $Epoch != md.$LSEREpoch', ret('false')) +
    iff('md.$LSERStopped', run('Health') + ret('false')) +
    iff('player.age ge md.$LSERNextReconcile', run('Reconcile')) +
    iff('player.age ge md.$LSERNextPeriodic', set('md.$LSERNextPeriodic', `player.age + ${c.periodSeconds}s`) + run('QueueSnapshot', { Trigger: "'PERIODIC'", Requested: 'player.age' })) +
    iff('not md.$LSERSnapshotActive and md.$LSERRequests.count gt 0',
      set('$Request', 'md.$LSERRequests.{1}') + tag('remove_value', { name: 'md.$LSERRequests.{1}' }) +
      iff('$Request.{4} != $Epoch', add('md.$LSERDroppedSnapshots') + write("'SNAPSHOT_GAP|reason=STALE_EPOCH'", 'md.$LSERSeq') + ret('false')) +
      run('Reconcile') + set('md.$LSERSnapshotEpoch', '$Epoch') + set('md.$LSERSnapshotAssets', 'md.$LSERAssetList.clone') + set('md.$LSERSnapshotIndex', '1') + set('md.$LSERSnapshotTrigger', '$Request.{1}') + set('md.$LSERSnapshotPartial', 'false') + add('md.$LSERSeq') + set('md.$LSERSnapshotSeq', 'md.$LSERSeq') + set('md.$LSERSnapshotActive', 'true') +
      write("'SNAPSHOT_BEGIN|trigger=%s|requested=%s|actual=%s|assets=%s|atomic=false|cause_seq=%s'.[$Request.{1}, $Request.{2}, player.age, md.$LSERSnapshotAssets.count, $Request.{3}]", 'md.$LSERSnapshotSeq')) +
    iff('md.$LSERSnapshotActive and md.$LSERSnapshotEpoch != $Epoch', set('md.$LSERSnapshotActive', 'false') + add('md.$LSERDroppedSnapshots') + write("'SNAPSHOT_GAP|reason=STALE_EPOCH'", 'md.$LSERSeq')) +
    iff('md.$LSERSnapshotActive', tag('do_all', { exact: String(c.assetsPerTick) },
      iff('md.$LSERStopped or $Epoch != md.$LSEREpoch or md.$LSERSnapshotIndex gt md.$LSERSnapshotAssets.count', tag('break')) +
      run('Asset', { Asset: 'md.$LSERSnapshotAssets.{md.$LSERSnapshotIndex}', Seq: 'md.$LSERSnapshotSeq', Trigger: 'md.$LSERSnapshotTrigger', Path: "'assets.' + md.$LSERSnapshotIndex", Epoch: '$Epoch' }, '$Partial') + iff('$Partial', set('md.$LSERSnapshotPartial', 'true')) + add('md.$LSERSnapshotIndex', '1')) +
      iff('md.$LSERSnapshotIndex gt md.$LSERSnapshotAssets.count', write("'SNAPSHOT_END|trigger=%s|assets=%s|atomic=false|partial=%s'.[md.$LSERSnapshotTrigger, md.$LSERSnapshotAssets.count, md.$LSERSnapshotPartial]", 'md.$LSERSnapshotSeq') + set('md.$LSERSnapshotActive', 'false') + set('md.$LSERSnapshotAssets', '[]'))) +
    run('Health') + ret('true'));

  const lifecycle = lib('Lifecycle', { Source: null },
    set('md.$LSERReady', 'false') +
    iff('md.$LSERRun? and md.$LSERSeq? and md.$LSERStopped? and (not md.$LSERRunOpen? or md.$LSERRunOpen)',
      iff('md.$LSERSnapshotActive', write("'SNAPSHOT_INTERRUPTED|reason=LIFECYCLE_RESET|source=%s|provenance=ACTIVE_OR_RESTORED_UNKNOWN'.[$Source]", 'md.$LSERSnapshotSeq')) +
      write("'RUN_INTERRUPTED|reason=LIFECYCLE_RESET|source=%s|queued=%s|provenance=ACTIVE_OR_RESTORED_UNKNOWN'.[$Source, md.$LSERRequests.count]", 'md.$LSERSeq') + set('md.$LSERRunOpen', 'false')) +
    iff('not md.$LSEREpoch?', set('md.$LSEREpoch', '0L')) + add('md.$LSEREpoch') +
    set('md.$LSERSnapshotActive', 'false') + set('md.$LSERSnapshotAssets', '[]') + set('md.$LSERRequests', '[]') + ret('md.$LSEREpoch'));
  const initial = [set('$Epoch', 'parent.$Epoch'), set('md.$LSERRunEpoch', '$Epoch'), set('$Nonce', '0'), tag('set_value', { name: '$Nonce', min: '0', max: '2147483647' }), set('md.$LSERRun', "'%s-%s-%s'.[player.systemtime.{'%Y-%m-%d_%H-%M-%S'}, $Nonce, $Epoch]"), set('md.$LSERLevel', String(levels.indexOf(c.diagnostics))), ...['Seq', 'Received', 'Prepared', 'Writes', 'DiagnosticWrites', 'DroppedEvents', 'DroppedSnapshots', 'RowsSuppressed', 'Incomplete', 'Failures'].map(k => set(`md.$LSER${k}`, '0L')), set('md.$LSERStopped', 'false'), set('md.$LSERSnapshotActive', 'false'), set('md.$LSERRequests', '[]'), set('md.$LSERActorsSeen', '[]'), set('md.$LSERFamilies', 'table[]'), tag('create_group', { groupname: 'md.$LSERActors' }), tag('add_to_group', { groupname: 'md.$LSERActors', list: '[]', replace: 'true' }), run('Reconcile'), set('md.$LSERNextPeriodic', `player.age + ${c.periodSeconds}s`), set('md.$LSERNextHeartbeat', `player.age + ${c.heartbeatSeconds}s`), set('md.$LSERReady', 'true'), write(`'RUN_BEGIN|protocol=1|listeners=${catalog.length}|baseline=6553cf9|write_confirmation=UNAVAILABLE|rebuild=true|diagnostics=${c.diagnostics}|max_rows=${c.maxRowsPerRun}|epoch=%s'.[$Epoch]`, '0'), run('QueueSnapshot', { Trigger: "'PERIODIC'", Requested: 'player.age', Epoch: '$Epoch' })].join('');

  const controls = ['DIAGNOSTICS_ERROR', 'DIAGNOSTICS_WARNING', 'DIAGNOSTICS_INFO', 'DIAGNOSTICS_DEBUG', 'SNAPSHOT_REQUESTED'].map((command, i) => tag('cue', { name: `Input${i + 1}`, instantiate: 'true', namespace: 'this' },
    tag('conditions', {}, tag('event_ui_triggered', { screen: "'LifeSigns.Hotkeys'", control: `'${command}'` }) + tag('check_value', { value: 'md.$LSERReady and parent.$Epoch == md.$LSEREpoch' })) + tag('actions', {},
      add('md.$LSERSeq') + set('$Seq', 'md.$LSERSeq') + write(`'INPUT_REQUEST|event=event_ui_triggered|screen=LifeSigns.Hotkeys|control=${command}'`) +
      (i < 4 ? set('md.$LSERLevel', String(i + 1)) + write(`'CONFIG_CHANGED|diagnostics=${levels[i + 1]}'`) : run('QueueSnapshot', { Trigger: "'ON_DEMAND_HOTKEY'", Requested: 'player.age', Cause: '$Seq' }))))).join('');
  const reset = tag('cue', { name: 'Invalidate0', instantiate: 'true', namespace: 'this' }, tag('conditions', {}, tag('event_game_loaded')) + tag('actions', {}, run('Lifecycle', { Source: "'event_game_loaded'" }) + tag('reset_cue', { cue: 'Runtime' })));
  const ready = tag('cue', { name: 'ListenersReady', checkinterval: '1s', namespace: 'this' }, tag('conditions', {}, tag('check_value', { value: 'md.$LSERReady? and md.$LSERReady and md.$LSERAssets? and md.$LSERActors? and parent.$Epoch == md.$LSEREpoch' })) + tag('actions', {}, set('$Epoch', 'parent.$Epoch')) + tag('cues', {}, capture + controls + tag('cue', { name: 'ProcessingTick', instantiate: 'true', namespace: 'this', checkinterval: '1s' }, tag('conditions', {}, tag('check_value', { value: 'md.$LSERReady and parent.$Epoch == md.$LSEREpoch' })) + tag('actions', {}, run('Tick', { Epoch: 'parent.$Epoch' })))));
  const bootstrap = tag('cue', { name: 'Bootstrap', checkinterval: '1s', namespace: 'this' }, tag('conditions', {}, tag('check_value', { value: 'parent.$Epoch? and player.entity.exists and player.galaxy and parent.$Epoch == md.$LSEREpoch' })) + tag('actions', {}, iff('not md.$LSERReady or not md.$LSERRunEpoch? or md.$LSERRunEpoch != parent.$Epoch', initial + set('md.$LSERRunOpen', 'true'))) + tag('cues', {}, ready));
  // A restored polling flag cannot start a run: a delivered generation event is required.
  const runtime = tag('cue', { name: 'Runtime', instantiate: 'true', namespace: 'this' }, tag('conditions', {}, tag('event_universe_generated')) + tag('actions', {}, run('Lifecycle', { Source: "'event_universe_generated'" }, '$Epoch')) + tag('cues', {}, bootstrap));
  const source = `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by scripts/build-event-recorder.mjs. Edit recorder sources, then rebuild. -->\n<mdscript name="LifeSigns_EventRecorder" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="../../libraries/md.xsd"><cues>${reset}${runtime}${escape}${writer}${val}${snapshot}${reconcile}${queue}${captureLib}${health}${tick}${lifecycle}</cues></mdscript>\n`;
  return source.replaceAll('><', '>\n<');
}
