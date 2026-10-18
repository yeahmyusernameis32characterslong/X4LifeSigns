# Snapshot-only object profile collector

## Authorised implementation task, 2026-10-18

Owner requested replacement of snapshot generation with independent station,
ship and NPC profiles, and explicitly excluded event listening until snapshots
are established. Starting branch `feat/broad-native-event-recorder`, PR19,
commit `4623bccc70974963325185bdfc2290362e5a6b79`, clean and matching remote.
The station, ship and NPC profile references define the requested fields.

### Plan and acceptance gates

1. Replace the optional experimental generator with snapshot-only MD: no
   gameplay, UI or lifecycle event subscriptions. Use polling for readiness and
   scheduled work. Capture initially when ready and then every 300 game seconds;
   never overlap collection runs. Document save/load continuity limitations.
2. Execute three ordered passes: stations, ships, NPCs. Each emits independent
   PROFILE_BEGIN / VALUE / PROFILE_END records. Station/ship profiles include
   scalar relationship fields but never nested NPC profiles. Discover NPC
   candidates separately during pass three, using source-supported actions and
   passive collections, with explicit discovery scope/limit markers.
3. Implement all supported reference-table reads, including contextual crew
   name/macro/race and direct actor seed/debugname. Preserve unsupported NPC
   idcode, unknown inclusive headcount and uncertain location/assignment as
   explicit states. Never infer seed from template text or force actor creation.
4. Bound work per tick and profile, preserve exact text framing, retain the
   2,000,000-row ceiling and explicit stop/partial markers. Match aliases only
   by observed component/template evidence; do not invent universal identity.
5. Regenerate XML, run meaningful generated-action tests for pass ordering,
   independent profiles, field/state coverage, aliases, non-ship NPC discovery,
   stale references, limits and scheduling. Run bridge regression and pinned
   installed X4 9.00 schema validation, including a zero-event-listener gate.
6. Update reference/implementation docs and offline inspection as needed, commit
   coherent units and publish the report through the private handoff for Agent.

Scope is the experimental optional collector only. No production bridge,
database, deployment scripts, installed extensions or logs change. No deployment,
X4 launch, gameplay test or merge is authorised by this implementation request.

## Status and delivery

### Performance work, owner-authorised 2026-10-18

Starting at `4b0a1ca`, reduce duplicate NPC reads/text processing, then refine
batching. No deployment or native benchmark is included. Contextual-only primary
and contextual seed/name/race/macro fields now reuse per-profile scalar
observations and availability states. Actor/contextual sources remain distinct;
no pseudo-entry or host-wide stale value is cached. Exhausted value budgets still
prevent getter evaluation and all output fields retain their normal budget cost.

Generated field names are validated as framing-safe at build time, so the writer
uses them directly. Escaped datatype labels are cached by their rendered type
within the recorder state. Dynamic values retain full escaping. This removes
repeated constant text work without changing record framing or batching writes.
The same types/values/states and two-million-row ceiling are preserved. Synthetic
tests verify scalar reuse, missing data and reserved/Unicode text; native speed
and FPS effects remain unmeasured.

The second increment uses a resumable personnel cursor. `discoveryPerTick` now
bounds individual cursor steps (one roster entry, control reference or stage
transition), rather than whole hosts. Host list getters remain native operations
without a measured time bound. A completed host releases its candidates for
profiling only after alias gathering, avoiding emission of a contextual profile
before its actor association is examined. Limits release the observed partial
candidate set explicitly; stale/changed ownership is checked as work resumes
and before profiling. Health adds discovery stage/entry progress.

NPC work requests two profiles per 0.1 game seconds by default; station/ship work
retains eight slots per one game second. This reduces per-tick NPC profile count
and increases nominal NPC throughput from eight to twenty per game second, while
spreading large rosters across ticks. It is **not** a measured FPS improvement or
native completion-time guarantee. Completion-based 300-second cadence, row/value
ceilings, field set and notification actions remain unchanged. Recorder state
version 2 restarts an observed older in-flight scan instead of interpreting old
cursor fields. Saved-cue engine migration remains unverified.

### Personnel List NPC correction, 2026-10-18

Owner authorised this correction from notification baseline `868d00d`, using the
verified Personnel List access research. Scope: replace NPC discovery with an
owned-asset employee inventory and stream standalone NPC profiles while it
progresses. Station/ship profile libraries, notification actions, configuration,
production components and installed extensions remain unchanged. Acceptance
checks cover UI-equivalent scalar access, raw-template contextual fields, owned
spacesuits, skipped ownership changes, incremental output, progress, identity
aliases, budgets and existing notification behavior. Deployment and native
testing require separate approval.

A recorder-state version guard interrupts an observed older active collection
with `PERSONNEL_COLLECTOR_UPDATE` and initialises new progress fields before
continuing. It prevents reuse of the old `NPC_DISCOVERY` phase when this Tick
code runs. Native loading of changed saved cues remains unverified; the guard
does not establish a new-run-on-every-load guarantee.

This correction is implemented with synthetic/static checks, **not verified in
X4**. Qwen researched the Personnel List source and Codex verified the MD getter
equivalents. The UI's Lua/native calls are not copied as MD actions. The prior
owner-run capture finished station/ship passes but did not produce NPC profiles;
it is not acceptance evidence for this corrected NPC pass.

**Implemented, native behaviour unverified.** Plan commit `846d9ae`; first
implementation/checkpoint `cebb4cb`, followed by the documentation and final
relationship/session checks. PR19 remains draft and unmerged. This replaces
the experimental event recorder in the source tree. The previously deployed
recorder is unchanged; this version has not been deployed or tested in X4.

The generated MD contains **zero event conditions**: no gameplay, lifecycle,
UI, hotkey or NPC-creation listener. The former event catalogue and its obsolete
event-specific tests were removed; Git history preserves that implementation.
The existing package/build/optional-extension paths are retained for tooling
continuity. The extension display name is now Life Signs Object Profile Collector.

## Collection sequence

### Snapshot notifications

Owner-requested snapshot notifications use the native, non-interactive message
ticker (`show_notification`). The collector requests **Life Signs: Snapshot
begun.** after the snapshot begin record, and **Life Signs: Snapshot completed.**
after all three passes and the snapshot end record. If collection finishes with
recorded gaps or partial profiles, the latter reads **Life Signs: Snapshot
completed (partial data).** Completion describes the collection cycle finishing;
it does not establish complete NPC discovery or confirmed disk writes.

Each notification requests five seconds at normal priority (1), with X4's default
generic notification sound. Higher-priority game messages can replace the ticker;
on-screen delivery/timing has not been verified in X4. Notifications are requested
once per transition, including periodic collections, independently of diagnostic
verbosity. A row-limit stop or interrupted snapshot does not request completion.
No listeners, interactive prompts, mission records or explicit logbook writes
are added. An unfinished NPC discovery pass therefore leaves only the start
notification. The Personnel List correction preserves these notification actions.

Source: installed X4 9.00 `libraries/common.xsd:36951` defines
`show_notification`, its required `text`, timeout, priority and default sound;
`:1049` defines ticker text. Shipped `md/gm_transport_passengers.xml:1425`
demonstrates the non-interactive action. Qwen located these references; Codex
verified their schema and callsite. Generated-action checks cover transition
ordering, repeated collections, partial completion, interruption and row stops.

## Ordered passes

Polling bootstrap waits for `player.entity.exists` and `player.galaxy`. It
initialises a recorder-local run and schedules an initial collection. Polling
ticks then perform ordered work:

1. Enumerate player-true-owned stations and emit station profiles.
2. Enumerate player-true-owned ships and emit ship profiles.
3. Build an NPC employee inventory and emit standalone NPC profiles in bounded
   batches while discovery proceeds. No station or ship profile contains nested
   personnel profiles. Finish only after discovery and all queued profiles end.

NPC discovery follows the owner-approved Personnel List route. It reuses the
already enumerated player-owned station/ship references as personnel contexts,
rechecking existence and ownership before reading them. It does not enumerate
foreign assets or call `find_object_component`. Owned spacesuits remain ship
candidates without copying the UI's display/ware filters; actual suit pilot and
crew availability remains a native test question.

`people.list` supplies raw templates, and `Host.people.{Template}` supplies the
documented contextual name, seed, race and role. Existing `roleentities` provides
passive actor aliases. The Personnel List's pilot, manager and ship-trader access
paths use `assignedaipilot`, `tradenpc` and `shiptrader`, with assigned control
entities/pilots supplementing them. Actor existence, NPC class and player
ownership are checked. No actor is created and no menu needs to be opened.

For player-owned hosts, contextual personnel lists supply candidates with
host/template provenance. This is explicitly an **owned-host proxy**, not proof
that every contextual entry has independently verified NPC ownership. Actor
aliases are merged by actual component equality. A contextual entry and actor
merge only by exact host/template association. Equal seeds or names do not
merge profiles. Template lookup never stores a pseudo-entry or forces an actor.

Discovery has bounded host/candidate/detail traversal and explicit limit/gap
markers. The owned asset enumeration and personnel getters can return lists
before traversal limits apply; this is not a native performance/memory bound.
There is no verified global NPC registry. Coverage of NPCs outside the owned
personnel graph, transfers and exact UI/MD inventory equivalence remain native
questions. Every collection records `discovery_complete=UNVERIFIED`, even without
limit markers. The collector does not claim comprehensive NPC enumeration.

`DISCOVERY_BEGIN` records owned host availability and the traversal ceiling.
Each host emits `DISCOVERY_HOST` begin/end with its reference, list counts and
new candidate count. Empty lists report zero; unavailable lists remain explicit.
Skipped hosts report their index/reference and reason. `DISCOVERY_END` reports
visited/skipped hosts and candidate count. INFO/DEBUG health includes phase,
host progress, buffered candidates and attempted NPC profiles, independently of
confirmed writes. These observations help distinguish empty from unfinished
discovery; they do not establish engine getter timing or output durability.

Source mapping: shipped `ui/addons/ego_detailmonitor/menu_playerinfo.lua:3717`
builds the employee list; `:3744` supplies pilots, `:3751-3777` contextual crew,
and `:3787-3796` station managers/traders. Installed
`libraries/scriptproperties.xml:301-318,373-398,841,2045-2067` documents the MD
actor/personnel getters, spacesuit subtype and contextual fields. Component
references and actor/contextual seeds remain separate observations.

## Profile fields and evidence states

The living [station](OBJECT_PROFILE_STATIONS.md), [ship](OBJECT_PROFILE_SHIPS.md)
and [NPC](OBJECT_PROFILE_NPCS.md) tables define required reads.

- Station profiles include seed/idcode/name, purpose/model labels, sector name
  and manager seed/reference. No manager-idcode field is generated.
- Ship profiles include seed/idcode/name/model/sector, captain/pilot seeds and
  references, commander idcode/class and fleet assignment value/name. No captain
  or pilot idcode field is generated.
- Inclusive `personnel_onboard` is explicitly UNVERIFIED. Separate currently
  onboard and assigned template counts are collected without asserting that
  adding actors/captain would produce a correct total.
- NPC profiles read actor seed/name/race/sector, role/post, assignment references,
  attempted idcode and raw debugname. Contextual entries read seed/name/race/macro,
  role and transfer/temporary flags. When both representations match, additional
  `contextual_*` fields retain their distinct values.
- `assigned_ship_idcode` uses actor role/control relationships, with the source
  recorded in `assignment_basis`. Conflicting ship relationships produce
  AMBIGUOUS_ASSIGNMENT and preserve both underlying ship codes. Contextual-only
  profiles label their candidate relationship CONTEXT_HOST_ROSTER_ASSOCIATION.
  Manager/station assignment is not silently converted into ship assignment.
- Contextual location is host-derived only with a current onboard entry and no
  observed transit. Otherwise sector is UNVERIFIED. Current container is not
  substituted for assigned ship.
- States distinguish PRESENT, NULL, UNAVAILABLE, UNAVAILABLE_REFERENCE,
  UNVERIFIED, missing assignments and representation-specific absence. Missing
  requested reads and uncertainty mark profiles partial. No captured actor is
  not proof X4 lacks an actor or generated information.
- IDs/seeds are engine-rendered text, with type and ENGINE_TEXT_UNVERIFIED
  provenance. No JavaScript numeric conversion is used for native values. Actual
  native rendering and identity lifetime still need verification.

## Scheduling, limits and persistence

| Configuration | Default | Meaning |
| --- | ---: | --- |
| `periodSeconds` | 300 | Wait after a completed collection before the next; no queue or overlap. |
| `profilesPerTick` | 8 | Maximum station/ship profile/phase work slots per one-second asset tick. |
| `npcProfilesPerTick` | 2 | Maximum NPC profile/phase work slots per NPC tick. |
| `npcTickSeconds` | 0.1 | Requested NPC polling interval; asset work retains a one-second gate. |
| `discoveryPerTick` | 8 | Maximum NPC cursor steps per NPC tick, including entry/control/stage work. |
| `personnelPerHost` | 500 | Separate contextual, actor-result and control-post traversal ceilings. |
| `profileValueItems` | 16384 | Ceiling per independent profile, not a target; no padding. |
| `maxCandidates` | 10000 | NPC candidates per collection. |
| `maxDiscoveryHosts` | 10000 | NPC discovery hosts visited per collection. |
| `maxRowsPerRun` | 2000000 | Ordinary raw profile-log rows, plus one final MAX_ROWS stop marker. |
| `heartbeatSeconds` | 60 | Optional observed-counter diagnostic interval. |
| `diagnostics` | DEBUG | OFF disables optional diagnostics; INFO/DEBUG emit health counters. |

ERROR/WARNING levels currently have no optional messages; discovery failures
and limits are always raw evidence markers. Separate diagnostic write attempts
are capped by maxRowsPerRun. Disk writes and native getter errors are not
confirmed by these counters. The value guard stops terminal value evaluation
when its budget is exhausted; each new profile starts with a fresh budget.

With no lifecycle events, this version cannot guarantee a new run or an initial
snapshot on every save load. Saved polling state, progress, counters and schedule
may resume; replay/duplicate history is possible. Observed game-clock regression
interrupts the active snapshot and reinitialises the run, but is not a complete
load detector. Old recorder cue restoration/migration and removal of saved
event subscriptions have not been tested. A later approved deployment/native
test must establish these behaviours; source listener count is not proof about
restored engine state. No permanent identity or save compatibility is claimed.

## Output and offline inspection

Native output requires the owner's `-scriptlogfiles` prerequisite. New files in
the native `lifesigns-event-recorder` output directory are `profiles.log` and
`profile-diagnostics.log`; old event/diagnostic files are not rewritten.
LSEV1 framing is retained, with run, optional read-only production-session
correlation (otherwise UNAVAILABLE), snapshot sequence and game age. No Node
reader is needed during collection.

Raw records include RUN_BEGIN, SNAPSHOT_BEGIN/END, PASS_BEGIN/END,
DISCOVERY_BEGIN/END, PROFILE_BEGIN/END, VALUE, explicit discovery/value limits,
and the final row-cap stop marker. Profile numbers are snapshot-local record
identifiers, not permanent object IDs. The offline checker tracks profile IDs,
pass kinds, unclosed/interrupted batches and explicit partial/limit counts:

```powershell
node recorder/check-log.mjs --profiles <preserved-profiles.log>
```

The historical `--events` input alias and legacy batch parsing remain available
for preserved old captures; they do not enable native event listeners.

## Source support and verification

Installed X4 9.00 references: `common.xsd:27987-28017` documents component
search and its host context; `28349` and `28405` define ship/station searches;
`scriptproperties.xml:841` defines spacesuit as a ship; `315,358,377` define
assigned control entities, control posts and contextual personnel. Field/type
citations and pinned hashes remain in the profile references.

Qwen researched discovery; Codex verified the relevant schema definitions and
dependencies. Rejected draft claims that trueowner on component search filters
the host, that future periodic scans cannot see newly added NPCs, and that
spacesuit inheritance was unsupported. The first tool conversation ended
without a conclusion; a focused follow-up reused its evidence. No new grant.

Checks on Windows / Node.js v24.21.0:

```powershell
node scripts/build-event-recorder.mjs
node --test recorder/test/*.test.mjs
npm test --prefix bridge
powershell -NoProfile -File scripts/validate-event-recorder.ps1 -SchemaDirectory <X4-9.00-libraries>
git diff --check
```

Generated-action/offline tests, 112 bridge regressions and pinned installed
schema validation passed. Schema validation explicitly rejects every event
condition and NPC creation action. Tests cover ordered independent profiles,
missing fields, exact large text seeds, aliases, foreign-host/spacesuit candidates,
assignment ambiguity, transit location, stale references, budgets, limits,
cadence, clock regression, framing and optional session correlation.
These are synthetic/static results, not native getter, scheduling, completeness,
save/load, performance or crash-resolution proof. Both installed optional
recorder files still match the prior deployment receipt. Nothing was deployed.
