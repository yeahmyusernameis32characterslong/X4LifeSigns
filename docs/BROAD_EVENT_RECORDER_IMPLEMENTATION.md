# Broad native recorder implementation

The event-recorder implementation below is historical. PR #19 independent
profiles and then PR #20 database-aware baseline/selective events supersede it.
See [current implementation and verification](SQLITE_PROFILE_COMPLETION.md).
Earlier zero-listener, recurring-snapshot and row-cap statements describe their
recorded revisions, not the current source.

Baseline: owner-approved PR #18 commit
`6553cf973430ba533ba9f66b42d10d83c53981ba`, reconciled with the latest
snapshot requirements at `ac3553836614f968d90ea9067baacf3c50744b3f`.
Continuation began from PR #19 at `887a60eb089fdd2f7dd8c8a02ee2bfc7dda8fcd8`.
The owner authorised code,
automated/static checks and a separate draft implementation PR. Deployment,
gameplay testing and merge require separate approval.

## Implementation plan

1. Package an optional `lifesigns_event_recorder` extension independently of
   the production bridge. Generate its MD listeners from an explicit typed
   event catalogue, verifying each selector against installed X4 9.00 sources.
   Start broadly with global player-owned and safe group-scoped events;
   expand the catalogue without waiting for full event discovery.
2. Initialise after playable-universe readiness, rebuild owned-property
   membership on load and periodically, and read the production session key
   only when its existing readiness gate permits. Retain raw event parameters
   promptly in instance-local variables. Add guarded affected-object EVENT
   snapshots and scheduled faction-wide PERIODIC/requested snapshots.
3. Write separate native event and diagnostic streams. Support configurable
   OFF/ERROR/WARNING/INFO/DEBUG with genuine OFF, recorder-observed counters,
   explicit resource-limit/gap markers and no claim of confirmed disk writes.
   Preserve overlapping events. Keep all source logs and derived analysis local.
4. Research the independently optional Hotkeys extension input path. Implement
   source-supported signals and M5 snapshot handling in the recorder; report
   an unresolved binding mechanism rather than inventing native M-key support.
5. Test generated output, serialization and parsing with synthetic values,
   validate generated MD against the installed schemas, and check production
   isolation, documentation and privacy. Publish incremental commits, a draft
   PR and a sanitised private implementation report with remaining live gates.

## Status

**Corrections implemented, unverified in X4.** The recorder is on separate
draft [PR #19](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns/pull/19),
stacked on documentation PR #18. PR #18 remains documentation-only. An earlier
owner-run experimental capture exposed personnel getter errors, interrupted
startup and owner-reported performance problems. These corrections have only
automated/static validation; they have not been deployed or tested in gameplay.
The independently optional
Hotkeys extension is **not implemented**: keyboard registration is unresolved.
The recorder-side M1–M5 signal handlers are implemented and tested synthetically.

## Package and behaviour

`extensions/lifesigns_event_recorder/` contains its own optional `save="0"`
extension and generated `LifeSigns_EventRecorder.xml`. It has no dependency
on the production bridge or a keyboard extension. Existing production files,
session generation/readiness, Node readers and SQLite remain unchanged.

`recorder/catalog.mjs` currently selects **52 subscriptions**: 34 owned-asset
group conditions, 17 global player-related conditions and one destroyed-object
condition on previously observed personnel components. The set spans combat,
damage/repair, ownership, movement/docking, commander/subordinates, orders,
production/building, resource collection, trade, money, assignment and relation
events. It is an initial broad implementation, not exhaustive coverage. The
generator and schema gate reject unsupported names/selectors; discovery can
continue without replacing the recorder with a fixture-specific probe.

Only a delivered root `event_universe_generated` creates a recorder epoch and
permits the child bootstrap to wait for playable-universe readiness. A restored
polling flag cannot bootstrap a new run. The recorder creates a run marker, rebuilds
all current player-owned ships/stations in the galaxy and enables listeners
only after their source groups exist. Ship enumeration includes contained
ships; station enumeration uses its separately supported selector syntax.
`event_game_loaded` invalidates and resets the recorder tree; generation starts
the next epoch. Bootstrap is idempotent within an epoch; equal game ages do not
deduplicate legitimate reloads. Listeners and processing ticks retain their
parent epoch; capture, asset and queue libraries reject stale epochs. Queues
and staged scans are cleared on invalidation and rebuilt on bootstrap.
Before discarding an open run, best-effort `RUN_INTERRUPTED` and, if needed,
`SNAPSHOT_INTERRUPTED` markers use its old run/sequence, source callback and
`ACTIVE_OR_RESTORED_UNKNOWN` provenance. They do not assert that restored
saved state was still actively collecting. Row stops/native write failures
can prevent these markers; the offline checker still reports open batches.
It counts an explicit snapshot interruption once as incomplete, never complete.

If `game_loaded` unexpectedly arrives after generation/bootstrap, the recorder
fails closed until another generation event. No arbitrary delay or production
session key is used to infer readiness. Native callback ordering, descendant
reset/parent-epoch semantics and save compatibility remain owner-run X4 gates.
Adding/enabling the extension mid-session without a delivered generation event
does not start capture; use a later separately approved load/start.

Every listener copies event values and lookup availability into its own
namespace before calling shared action libraries. Raw repeated/overlapping
occurrences are retained. Available component context includes references,
ID codes, names, class, owner/true owner, sector/container and entity role/post
where supported. Each EVENT_BEGIN declares its asset capture policy.
`LIGHT_CONTEXT` applies to `event_object_shield_damaged`,
`event_object_hull_damaged`, `event_object_attacked`,
`event_object_attacked_object`, `event_player_owned_attacked`, and
`event_player_owned_attacked_object`: every typed occurrence/context remains,
but full assigned-control/personnel enrichment is omitted for these families.
All other selected events use `RICH_DISTINCT`. Current owned or cached affected assets get EVENT snapshots;
the recorder performs no whole-galaxy lookup per event. Ownership/claim/build
events request membership reconciliation on the next processing tick; other
acquisition paths can remain uncovered until scheduled reconciliation.

Within one rich event, equal actual component references are traversed once.
`ASSET_ALIAS` links each repeated `affected.N` path to its first rich path in
the same run/sequence; raw object/param values remain independently recorded.
Names, ID codes, rendered reference text and previous events are not dedup keys.
Destruction, ownership, assignment and control-entity changes retain immediate
typed context and eligible rich asset detail. No general deferred/coalesced
snapshot system or event sampling is introduced. PERIODIC/requested rich
checkpoints remain independent. This policy reduces repeated rich work but
can omit short-lived roster state during frequent hits; later checkpoints
must not be interpreted as exact earlier event-time state. CPU/FPS benefit
has not been measured.

PERIODIC and accepted ON_DEMAND_HOTKEY requests produce faction-wide snapshots
over several processing ticks. The snapshot keeps its own sequence while
native events interleave, records requested and actual timing, and marks
`atomic=false`. Each asset's contextual templates, assigned control entities
and already instanced `roleentities` are recorded separately. The code does
not call `roleentity.{$Template}` or instantiate actors. The side effects of
even these passive getters and the lifetime of copied references remain live
unknowns. Destroyed components and missing contextual entries are unavailable
observations; they do not establish person death or identity continuity.

## Configuration and resource bounds

The post-test personnel correction uses complete
`people.{template}.exists/seed/role/...` terminal chains. The contextual entry
is a non-storable pseudo-type, never an intermediate script value. Missing
entries or terminal fields mark the asset partial; false, zero and null remain
recorded values. Detail traversal stops before further personnel reads when
the value budget or raw capture allowance has stopped it. The synthetic harness
rejects pseudo-type storage; native getter correctness still requires a later
separately approved X4 test.

Edit `recorder/config.json`, then rebuild **before a later authorised
installation**. No Node process is needed during collection. Configuration is
compiled into the optional extension and applied on each recorder bootstrap;
runtime M1–M4 changes do not override that setting permanently across loads.

| Setting | Initial value | Meaning |
| --- | --- | --- |
| `diagnostics` | `DEBUG` | Development default. OFF, ERROR, WARNING, INFO and DEBUG are supported. |
| `periodSeconds` | 300 | Game-time interval (5 minutes) between periodic requests. Pauses can defer processing. |
| `reconcileSeconds` | 30 | Game-time interval for full owned-property membership reconciliation. |
| `heartbeatSeconds` | 60 | Optional health interval; no frame-level rate claim. |
| `assetsPerTick` | 8 | Assets processed per one-second snapshot tick. |
| `crewPerAsset` | 500 | Maximum contextual-template entries **and**, separately, instanced-personnel entries visited per asset snapshot. |
| `snapshotValueItems` | 16384 | Fresh value-node ceiling for each asset snapshot, shared by property, contextual and instantiated-personnel values. |
| `eventValueItems` | 1024 | Independent immediate parameter/context value-node ceiling per delivered native event. |
| `valueDepth` | 3 | Nested collection depth bound. |
| `snapshotQueue` | 16 | Queued full snapshots; excess requests produce a visible gap marker. |
| `actorReferences` | 10000 | Run-local retained personnel component references. Previously observed association is not proof of current ownership. |
| `maxRowsPerRun` | 2000000 | Raw row attempts before an additional explicit LIMIT marker stops capture for that run. Diagnostics have a separate equal row allowance. |

Owner-requested discovery configuration (2026-10-17): periodic snapshots
are scheduled every **300 seconds of X4 game time**, and each asset can now
examine up to **500 contextual personnel templates and 500 instantiated
personnel entries**, separately. Each asset invocation has a fresh **16,384**
snapshot value-node ceiling; immediate event parameters retain their separate
**1,024** ceiling. **16,384 is a ceiling, not a target**: only available,
visited values are emitted, without padding or extra reads to fill it. This
does not guarantee complete crew records: nested values and other independent
limits can still leave a partial snapshot. The obsolete shared `valueItems`
configuration key is rejected; snapshot validation permits 16–16,384 nodes,
and event validation retains the earlier configurable 16–4,096 range.
`assetsPerTick=8` is unchanged. The owner-approved correction raises the raw
row allowance to **2,000,000 per run**; one final MAX_ROWS marker is additional
to that allowance. Diagnostic output independently shares the configured
threshold (2,000,000 diagnostic rows), retaining its existing semantics.
The cap is neither a native-event count nor a byte/word limit. To gauge scan duration after a separately approved
gameplay test, compare each `SNAPSHOT_BEGIN` and `SNAPSHOT_END` record's
`age` header for the same run/sequence. That measures elapsed **game time**;
it is not a profiler measurement or necessarily real-world wall-clock time.

These are tunable engineering defaults, **not performance results**. Payload,
roster and membership limits produce explicit partial/omitted markers; they
do not sample native event arrivals. A raw row cap intentionally interrupts
capture and can leave an incomplete batch. Further delivered events are counted
as recorder-controlled drops, while optional health output continues. No
diagnostic threshold reduces the raw capture allowance. OFF suppresses every
optional diagnostic/error/health write; ordinary raw provenance and gap markers
continue. The owner has not decided the eventual release minimum level.

The row cap bounds attempts per run, not bytes or total historical disk use.
Fixed files append across runs and native MD cannot confirm disk space, flush,
write errors or successful persistence through the inspected action. Archive
and retention remain an explicit pre-deployment decision. There is no automatic
deletion or overwrite, no final-write guarantee on exit/crash and no claim of
losslessness. `-scriptlogfiles` is required; this build cannot detect that flag
inside MD. The optional offline checker observes actual file output instead.

## Native files and typed rows

Expected native output is the X4 personal-folder `logs/lifesigns-event-recorder/`
directory, with `events.log` and `diagnostics.log`. Exact native framing,
encoding, append/reopen and flushing require live verification. All captures
remain private/local; never add them to Git or the handoff repository.

The `LSEV1` format carries run, practical production session or UNAVAILABLE,
recorder sequence, current game age, row kind and fields. `VALUE` rows retain
the engine type, lookup availability, null/unavailable-reference state and
engine-rendered text. Lists/tables use typed child rows with bounded recursion.
Percent, delimiter, CR, LF and tab are escaped in five successive native
`substitute_text` operations. Numeric/seed/reference string rendering is
explicitly `ENGINE_TEXT_UNVERIFIED`, not promised lossless binary serialization.
The parser retains sequence and value text without JavaScript numeric coercion.

Every asset invocation emits two `PERSONNEL_AVAILABILITY` rows immediately
after `ASSET_BEGIN`, before any budgeted `VALUE` rows. They carry the ordinary
run/session/sequence headers plus trigger, asset field path, escaped native
reference and guarded ID code, asset state, representation (`CONTEXTUAL` or
`INSTANTIATED`), available collection length and collection state. Missing ID
codes use `UNAVAILABLE`; the native reference/path still correlate the batch.
Counts describe observed `people.list` and `roleentities` lengths, never
verified distinct living people or crew capacity. Empty readable lists report
zero. Inaccessible collections/counts report `available=UNAVAILABLE` with
`COLLECTION_UNAVAILABLE` or `COUNT_UNAVAILABLE`; dead references and unsupported
inputs report `UNAVAILABLE_REFERENCE` or `UNSUPPORTED_ASSET`. Unavailable
observations mark the asset partial. Both observed lists/counts are reused
for bounded detail traversal. `ROSTER_LIMIT` identifies `.people` and
`.instances` separately. Value-budget exhaustion cannot hide availability,
although the independent raw-row stop or an unobserved native write failure
can still prevent any row from persisting.

The installed `scriptproperties.xml:318,373–377,1760–1762` definitions back
these collection getters and list lengths (SHA-256
`1b641b638c8892284bbf5943f9ed283e0adf79f696341a2f00a2361f16485a8f`).
These declarations do not prove getter side effects or runtime availability.
After a separately approved test has ended and X4 has closed, Qwen may infer
entries examined, values recorded and limit outcomes from unchanged raw rows,
availability baselines and partial/limit/gap markers, retaining file hashes
and offsets and labelling uncertain results. No new native examination/value
counters, current log analysis or Qwen access permission is implied.

Consequential serialization syntax was verified against installed
`common.xsd:37586-37635` (`substitute_text`),
`md.xsd:3044-3088` (`run_actions` separate contexts), and
`scriptproperties.xml:1760-1784,2258-2261` (collections and type tests).
Shipped `md/lib_create_ships.xml:486` onward supplies a recursive action-library
example. Qwen's null/boolean advice was not used as a guarantee: the official
[MD guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
documents `typeof null` and C-style string escapes. Engine rendering and live
library/event scheduling remain separate verification questions.

Health counts delivered listener entries, per-family entries, prepared rows,
write attempts, observable recorder limits/faults and controlled drops. It
reports confirmed writes and exact per-frame metrics as UNAVAILABLE. An
undelivered engine event or native disk failure may be entirely invisible.
`native_getter_errors=UNAVAILABLE` explicitly separates engine errors from
observable recorder failures. A zero recorder failure counter is not a clean
engine-error report; ordinary contextual unavailability marks partial capture
without being promoted to a fabricated native engine failure.

## Optional input protocol and remaining Hotkeys work

The recorder listens for `event_ui_triggered` on screen `LifeSigns.Hotkeys`:
`DIAGNOSTICS_ERROR`, `DIAGNOSTICS_WARNING`, `DIAGNOSTICS_INFO`,
`DIAGNOSTICS_DEBUG`, and `SNAPSHOT_REQUESTED`. Each received request is handled
by the recorder. A future independently enabled input-only extension may emit
these using `AddUITriggeredEvent`; it must not contain recorder logic. M6 is
reserved; there is no Aria action. This receiver does not bind keyboard keys.

Qwen's bounded authorised-corpus searches did not establish a custom native
binding registration path. Its `show_input_help` lead at `common.xsd:36513`
is a display action, **not an input event or binding registration API**. The
corpus references `inputmap.xml` but does not grant that file. A separate
original binding implementation therefore remains unresolved; no third-party
hotkey source, menu override or external keyboard service was introduced.
This gap does not prevent core EVENT/PERIODIC collection or configuration OFF.

## Build and checks

From the repository root:

```powershell
node scripts/build-event-recorder.mjs
node --test recorder/test/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-event-recorder.ps1 -SchemaDirectory '<local extracted X4 libraries directory>'
npm.cmd --prefix bridge test
```

The schema check pins the inspected installed 9.00 MD/common SHA-256 values,
validates the generated XML and verifies every listener's source attributes.
The 28 synthetic tests execute the actual generated action libraries through
a limited interpreter and test offline framing/readback. The interpreter
cannot prove X4 scheduling, event-expression lifetime, native getter effects,
same-frame atomicity, disk durability, performance or hotkey delivery.
The unchanged bridge regression suite passed **112/112** on Node.js v24.21.0.
The correction tests include unsupported pseudo-storage, terminal false/zero/
null/unavailable states, same-reference versus identical-label traversal,
all six light families, rich critical events, generation/reload epochs,
interrupted/stale jobs, stopped/budgeted getter work and an injected exact
2,000,000-row boundary. No two-million-row fixture is generated.

After a later approved capture and X4 exit, optional read-only inspection is:

```powershell
node recorder/check-log.mjs --events '<native events.log>' --run '<expected RUN_BEGIN marker>'
```

Without an expected run, existing logs are labelled HISTORICAL_OUTPUT_ONLY.
The checker streams UTF-8/CRLF data, preserves file bytes, hashes the input,
bounds oversized lines and reports incomplete batches. It never detects the
launch flag or confirms every engine event. No real game log was read to test
this tool; tests use invented temporary captures only.

## Next gates

Agent review is needed before requesting deployment or gameplay acceptance.
The separate hotkey input mechanism, native file readiness/retention, callback
ordering, reference/getter semantics, broad membership coverage and measured
performance remain open. The first owner test is historical evidence for the
older build, not acceptance of these corrections. Quiet personnel/lifecycle
verification should precede performance conclusions from any later approved
capture. Further event families and subobject scopes can be added progressively
after source validity checks. This correction task performed no deployment,
live gameplay, production change or merge.
