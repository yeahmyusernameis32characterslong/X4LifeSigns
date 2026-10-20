# Snapshot-only object profile collector

## Saved Life Signs universe ID, 2026-10-20

Owner-authorised implementation starts from PR19 `d003dc6` on
`feat/broad-native-event-recorder`. Goal: one create-once Life Signs lineage tag
available before the first snapshot, held in saved MD state and reported at
startup alongside existing run/session correlation. No native GUID or database
routing claim. Acceptance: absent-state creation, retained-state reuse across
run resets and synthetic fresh-interpreter restoration, invalid-state
preservation, unchanged profiles/pacing/panels, deterministic generated XML and
installed X4 9.00 schema gates. Deployment and native testing remain separate.

The dedicated non-instantiated root cue `UniverseIdentity` holds `$Id`. Its name
and location are a save-compatibility contract: do not rename, reset, cancel or
remove it. It has empty actions and creates no objects or listeners. The
initialization helper creates the variable only when absent, using local
creation time plus four unseeded integer draws in `0..2147483647`, formatted as
`lsu1-<YYYY-MM-DD_HH-MM-SS>-<a>-<b>-<c>-<d>`. This reuses the project's existing
source syntax; it is not a cryptographic UUID or proof of independent entropy,
a collision rate, or absolute uniqueness. Draws can perturb engine RNG state.

The ID is usable in memory before any save exists. Saving preserves the MD
state; loading a tagged save should restore the same ID. This persistence is
source-backed and synthetically checked, **not yet verified in X4**. Older
pre-tag saves loaded independently get independent tags; they cannot recover a
shared historical ID. Copies/branches of a tagged save inherit its lineage.
Exiting without saving loses a newly created tag. Mod removal/reinstallation
persistence is not promised.

Raw and enabled diagnostic `RUN_BEGIN`, and raw `SNAPSHOT_BEGIN`, contain:

| Field | Meaning |
| --- | --- |
| `lifesigns_universe_id` | Escaped stored tag; empty if invalid. |
| `lifesigns_universe_id_state` | `CREATED`, `EXISTING`, or `INVALID`. Existing means present in cue state, not a confirmation of a disk save. |
| `identity_basis` | `LIFESIGNS_MD_V1`; generated Life Signs lineage, not the native GUID. |
| `identity_save_confirmation` | `UNAVAILABLE`; the recorder does not confirm a save operation. |

An existing null, empty or non-string value is retained and reported INVALID;
it is never silently replaced. A nonempty stored string is reused and escaped;
no new per-object reads or per-row ID field is added. Profiles join to this
startup metadata through the unchanged run key. Optional production session
correlation is read-only; no SQLite or identity-routing changes.

The [official MD guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
documents saved-state restoration, stable static cues, named remote variables
and guards for variables absent from older saves. Random ranges and formatting
use the source already documented in [SESSION_KEY_SOURCE_GATE.md](SESSION_KEY_SOURCE_GATE.md);
its RNG limitations apply here too. Pending owner test: new unsaved game,
save/reload, fresh-process reload and another universe, checking retained and
separate tags without conflating run/session keys.

## Startup identifiers, 2026-10-19

The owner has removed the unsuccessful `player.galaxy.idcode` and
`player.entity.idcode` experiments. Their reads, cached observations and startup
fields are no longer generated. In the observed native test both availability
checks reported UNAVAILABLE; this does not establish every possible engine
context. Historical logs/findings remain intact.

`gamestart.seed` collection remains removed. Object/NPC identity seeds and
ship/station ID codes remain profile fields. Existing recorder `run=` and
optional read-only production `session=` correlation, filenames and scheduling
are unchanged. Both completion panels retain centred placement and text,
manual dismissal and disabled automatic expiry.

At that revision a persistent Life Signs lineage marker was a proposal only;
the 2026-10-20 implementation above supersedes that status. No physical objects
are spawned. Native save GUID access remains unresolved.

## Datatype-cache investigation, 2026-10-19

**Correction implemented; native retest pending.** The cache renders
type labels into string keys such as `component` and `string`. Egosoft's
[MD guide, Tables section](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/#HTables)
requires string table keys to begin with `$`. The previous key formatter omitted
that prefix, explaining the repeated cache assignment errors. This restriction
concerns the resulting key value, not the variable name `$TypeKey`.

The correction prefixes only the internal cache key with a
literal `$`; recorded datatype labels and profile values remain unchanged.
Component/template keys in the other discovery maps are typed references, not
these rendered strings, and should retain their existing representation.

A local research reproduction enforces the documented string-key rule: the
current key fails, while an in-memory prefixed-key candidate completes four
synthetic profiles with all 77 VALUE rows, types/states/framing identical to the
permissive baseline. The committed harness now rejects invalid string/null table
keys; a regression rejects the old formatter and checks repeated-type reuse,
unchanged Unicode/reserved text and unavailable/null states. The literal fix is
retained. This is a source-backed correction with automated checks, not a native
retest or measured performance gain. Slot 10 was not
accessed; no save data is needed to explain this language-rule violation.

## Literal-expression correction, 2026-10-18

The larger-save native debug log exposed 44 generated expression errors:
36 `@null` placeholders and eight `@`-prefixed quoted relationship/location
labels. The generator now emits these literals directly, retaining optional
property-lookup handling for observed values. The synthetic harness rejects the
reported invalid literal syntax at load time, and the installed-schema validator
adds an explicit expression check because XSD alone did not catch it.
This focused source correction does not resolve the independently observed
datatype-cache assignment errors or establish why the earlier capture ended.
Native validation after an approved deployment remains required.

## Owner-directed larger-save preparation, 2026-10-18

First increment removes standalone NPC `idcode` reads/placeholders and the ship
`personnel_onboard` placeholder. Raw NPC debugname and both assigned/onboard
template counts remain. Derive an NPC code offline from its parenthesised
debugname value when available; absence leaves it unknown. These fields and
their reference tables supersede the historical initial plan below.

The collector takes one initial snapshot per loaded gameplay run and never
reschedules after completion. There is no aggregate raw or diagnostic row cap;
`periodSeconds` and `maxRowsPerRun` are removed from configuration. Per-profile,
roster, candidate, host and per-tick limits remain unchanged.

One root `event_universe_generated` lifecycle hook queues a new recorder-local
session at game start or save load. It resets polling and waits for playable
readiness, then starts one station/ship/NPC collection. There are **no gameplay
or UI event subscriptions**. This narrow lifecycle hook replaces the older
zero-listener polling design to meet the owner's per-load requirement.

Output uses `profiles-session-<nonceA>-<nonceB>-loaded-<YYYY-MM-DD_HH-MM-SS>.log`
and the corresponding `profile-diagnostics-session-...log`. The timestamp is
local system time observed by the universe-generated callback, not a measured
load-complete instant. The recorder session token is independent of optional,
read-only production-session correlation in each row. Only generated numeric
nonces/time enter filenames; private asset labels and external session strings
do not. Two random nonces distinguish rapid same-second loads probabilistically,
not with an absolute uniqueness guarantee. Append mode preserves any existing
file on a rare collision; no previous run files are truncated or deleted.

Restored work is abandoned at the lifecycle boundary without appending invented
interruption rows to an old run file. A prior unfinished file stays visibly
unfinished. An unexplained clock regression during active work emits an
interruption in the current file and stops until a genuine load/start boundary.
Version 3 rejects older processing state until that lifecycle reset. Native
saved-cue migration and callback scheduling still require an approved X4 test.
Diagnostics stop growing when collection completes; OFF creates no diagnostic
file. Start/completed/partial-data notifications are retained.

No deployment or new gameplay is included. Historical periodic/cap descriptions
below record earlier versions and are superseded by this section.

## Historical initial implementation task, 2026-10-18

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

### Historical performance work, owner-authorised 2026-10-18

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

That initial snapshot-only version contained zero event conditions. The current
per-load version adds only the universe-generated lifecycle boundary, with no
gameplay/UI subscriptions or NPC creation. The former gameplay event catalogue
and obsolete event-specific tests remain preserved in Git history.
The existing package/build/optional-extension paths are retained for tooling
continuity. The extension display name is now Life Signs Object Profile Collector.

## Collection sequence

### Snapshot notifications

The start notification remains the native message ticker (`show_notification`):
**Life Signs: Snapshot begun.**, requested after the snapshot begin record for
five seconds at priority 1 with the default generic notification sound.

Completion uses a native closable help-message panel (`show_help`), requested
after all three passes and the snapshot end record:

- **Life Signs: Snapshot completed.**
- **Life Signs: Snapshot completed — partial data.** when recorded gaps or
  partial profiles remain.

Panels use custom text, `position="4"`, `halign="'center'"`, `allowclose="true"`,
`timeout="false"`, and `log="false"`. Installed X4 9.00
`libraries/parameters.xml:1370-1381` defines position 4 at 50% screen width/height;
shipped helptext.lua:405-418 subtracts half the panel dimensions to centre the
frame there. Text alignment is separate. The former default position 0 was
top-left, which explains the reported placement. Relevant installed DLC patches
do not change this position table. This enables the close button and disables
automatic expiry. No custom
Lua, response listener, global help removal or explicit logbook write is added.
The native UI handles dismissal. Exact appearance, help queue/menu interaction
and on-screen delivery still require an owner-run X4 test; no automatic pause
or modal behaviour is claimed.

Messages are requested once per transition of the single initial collection,
independently of diagnostic verbosity. Interrupted/stopped or unfinished
snapshots do not request completion. Completion describes the collection cycle
finishing, not complete NPC discovery or confirmed disk writes.

Qwen reviewed the invocation against installed X4 9.00
`libraries/common.xsd:36448` (`show_help`) and `:7658` (`showhelp` attributes).
Codex verified those definitions and the close-button implementation in shipped
`ui/addons/ego_helptext/helptext.lua:448`. Generated-action checks cover the
panel attributes, transition ordering, repetition, partial completion and
interruption. Deployment and native panel verification remain pending.

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
- The owner removed inclusive `personnel_onboard` collection. Currently onboard
  and assigned template counts remain separate; rescued, unassigned personnel
  can make physical presence differ from the assigned roster.
- NPC profiles read actor seed/name/race/sector, role/post, assignment references,
  and raw debugname. No standalone NPC `idcode` read or placeholder is emitted;
  derive the parenthesised code offline when available, otherwise leave unknown.
  Contextual entries read seed/name/race/macro,
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
| `profilesPerTick` | 8 | Maximum station/ship profile/phase work slots per one-second asset tick. |
| `npcProfilesPerTick` | 2 | Maximum NPC profile/phase work slots per NPC tick. |
| `npcTickSeconds` | 0.1 | Requested NPC polling interval; asset work retains a one-second gate. |
| `discoveryPerTick` | 8 | Maximum NPC cursor steps per NPC tick, including entry/control/stage work. |
| `personnelPerHost` | 500 | Separate contextual, actor-result and control-post traversal ceilings. |
| `profileValueItems` | 16384 | Ceiling per independent profile, not a target; no padding. |
| `maxCandidates` | 10000 | NPC candidates per collection. |
| `maxDiscoveryHosts` | 10000 | NPC discovery hosts visited per collection. |
| `heartbeatSeconds` | 60 | Optional observed-counter diagnostic interval. |
| `diagnostics` | DEBUG | OFF disables optional diagnostics; INFO/DEBUG emit health counters. |

ERROR/WARNING levels currently have no optional messages; discovery failures
and limits are always raw evidence markers. There is no aggregate raw or
diagnostic row ceiling. Disk writes and native getter errors are not
confirmed by these counters. The value guard stops terminal value evaluation
when its budget is exhausted; each new profile starts with a fresh budget.

One root universe-generated lifecycle hook resets queued work on game start or
save load; playable readiness is polled before the one initial collection.
Completion never queues another snapshot. Saved-cue restoration/migration and
event-versus-poll ordering remain native test gates; schema validation and the
synthetic action harness do not prove engine scheduling. The other independent
discovery/value limits still emit explicit markers when reached in a large save.

## Output and offline inspection

Native output requires the owner's `-scriptlogfiles` prerequisite. New files in
the native `lifesigns-event-recorder` output directory are
`profiles-session-<nonceA>-<nonceB>-loaded-<timestamp>.log` and
`profile-diagnostics-session-<nonceA>-<nonceB>-loaded-<timestamp>.log`.
Previous fixed-name profile logs and old event/diagnostic files are not rewritten.
LSEV1 framing is retained, with run, optional read-only production-session
correlation (otherwise UNAVAILABLE), snapshot sequence and game age. No Node
reader is needed during collection.

Raw records include RUN_BEGIN, SNAPSHOT_BEGIN/END, PASS_BEGIN/END,
DISCOVERY_BEGIN/END, PROFILE_BEGIN/END, VALUE, explicit discovery/value limits,
and explicit interruption markers. No total-row stop marker is generated.
Profile numbers are snapshot-local record
identifiers, not permanent object IDs. The offline checker tracks profile IDs,
pass kinds, unclosed/interrupted batches and explicit partial/limit counts:

```powershell
node recorder/check-log.mjs --profiles <preserved-profiles.log>
```

The historical `--events` input alias and legacy batch parsing remain available
for preserved old captures; they do not enable native event listeners.

The offline checker streams the selected file and bounds its line buffer; it
does not require loading a large capture into memory. It is explicitly offline
and is not started automatically. Select the run-specific file after X4 exits;
older fixed-file historical-prefix subtraction is unnecessary for a new file.
No automatic log deletion, rollover, archive service or disk-byte cap is added.

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

For per-load output, Qwen researched the existing authorised schema corpus;
Codex verified `common.xsd:16506-16515,17280-17290,26000-26042`,
`scriptproperties.xml:2410` and `md.xsd:4584-4600`. The universe-generated event
documents new-game/save-load coverage; debug_to_file name/directory are
expressions, `.log` is allowed and append defaults true. These facts support
the design, not runtime acceptance or absolute token uniqueness. Repeated
off-target searches were stopped and concluded from the retrieved schema.
No new corpus access or model access was granted.

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
