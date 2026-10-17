# Broad native recorder implementation

Baseline: owner-approved PR #18 commit
`6553cf973430ba533ba9f66b42d10d83c53981ba`. The owner authorised code,
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

**Implemented, unverified in X4.** The first recorder increment is on separate
draft [PR #19](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns/pull/19),
stacked on documentation PR #18. PR #18 remains documentation-only. No live
deployment or gameplay validation has occurred. The independently optional
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

On playable-universe readiness, the recorder creates a run marker, rebuilds
all current player-owned ships/stations in the galaxy and enables listeners
only after their source groups exist. Ship enumeration includes contained
ships; station enumeration uses its separately supported selector syntax.
Load/universe-generation callbacks invalidate and reset the recorder tree.
The next bootstrap discards restored recorder counters, queues and membership.
Actual callback ordering and save compatibility still need owner-run X4 checks.

Every listener copies event values and lookup availability into its own
namespace before calling shared action libraries. Raw repeated/overlapping
occurrences are retained. Available component context includes references,
ID codes, names, class, owner/true owner, sector/container and entity role/post
where supported. Current owned or cached affected assets get EVENT snapshots;
the recorder performs no whole-galaxy lookup per event. Ownership/claim/build
events request membership reconciliation on the next processing tick; other
acquisition paths can remain uncovered until scheduled reconciliation.

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

Edit `recorder/config.json`, then rebuild **before a later authorised
installation**. No Node process is needed during collection. Configuration is
compiled into the optional extension and applied on each recorder bootstrap;
runtime M1–M4 changes do not override that setting permanently across loads.

| Setting | Initial value | Meaning |
| --- | --- | --- |
| `diagnostics` | `DEBUG` | Development default. OFF, ERROR, WARNING, INFO and DEBUG are supported. |
| `periodSeconds` | 120 | Game-time interval between periodic requests. Pauses can defer processing. |
| `reconcileSeconds` | 30 | Game-time interval for full owned-property membership reconciliation. |
| `heartbeatSeconds` | 60 | Optional health interval; no frame-level rate claim. |
| `assetsPerTick` | 8 | Assets processed per one-second snapshot tick. |
| `crewPerAsset` | 64 | Maximum template entries and instanced entries visited per asset snapshot. |
| `valueItems` / `valueDepth` | 1024 / 3 | Shared value-node budget and nested collection depth per event/asset. |
| `snapshotQueue` | 16 | Queued full snapshots; excess requests produce a visible gap marker. |
| `actorReferences` | 10000 | Run-local retained personnel component references. Previously observed association is not proof of current ownership. |
| `maxRowsPerRun` | 1000000 | Raw row attempts before an explicit LIMIT marker stops capture for that run. Diagnostics have a separate equal row allowance. |

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
The 14 synthetic tests execute the actual generated action libraries through
a limited interpreter and test offline framing/readback. The interpreter
cannot prove X4 scheduling, event-expression lifetime, native getter effects,
same-frame atomicity, disk durability, performance or hotkey delivery.
The unchanged bridge regression suite passed **112/112** on Node.js v24.21.0.

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
performance remain open. Further event families and subobject scopes can be
added progressively after source validity checks. No live deployment, gameplay
test, production change or merge has occurred.
