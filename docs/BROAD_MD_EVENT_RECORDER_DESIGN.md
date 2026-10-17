# Broad MD event recorder: source-checked design proposal

Research state: 17 October 2026, PR #18. **Proposed, not implemented or live
verified.** Read [the workstream findings](BROAD_MD_EVENT_CAPTURE_FINDINGS.md)
for the owner requirements and historical PR #17 boundary. Agent owns the
architecture and later acceptance plan. This document records verified source
constraints, a reviewable recorder shape and remaining decisions.
The [initial event coverage register](BROAD_MD_EVENT_COVERAGE_REGISTER.md)
records one verified schema family and explicitly lists the remaining inventory.

## Source and confidence boundary

The installed base X4 9.00 `libraries/md.xsd` and `libraries/common.xsd` were
checked against the ignored local extraction manifest for `08.cat` (MD5
`d7ac24747687e15d9be608ff63b52ccd` and
`de2c08eabd2f3e22d705ed473b7940ce`). Local source paths below are
relative to that extracted base. This confirms the inspected bytes, not
runtime behaviour or effective DLC/extension overrides. No X4 run occurred
for this design.

| Design input | Installed evidence | What it supports |
| --- | --- | --- |
| Repeated isolated cue activations | `libraries/md.xsd:1052-1078,4583-4589`; [Egosoft MD guide, Instantiation and Namespaces](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/) | An instantiated cue keeps its static cue waiting; `namespace="this"` resolves local variables on each instance. It does not prove delivery of every emitted event. |
| File output | `libraries/common.xsd:26000-26044,7199-7215` | `debug_to_file` requires `text` and `name`; default append is true; `-scriptlogfiles` is required. The action has no result/flush/status field. |
| Scoped destruction | `libraries/common.xsd:7155-7165,13910-13921,15885-15897`; shipped `md/encounters.xml:205` and `md/boarding.xml:168` | `event_object_destroyed` uses an `object` or `group` source; `event_player_owned_destroyed` has a player-owned payload and no object/group selector. Exact unbound runtime behaviour and ordering need further checks. |
| Frame attribution | Qwen's bounded granted-source search found `libraries/md.xsd:4282` describing same-frame cue-signal dispatch, but no cited accessible current-frame ID. | No exact per-frame counter is proposed. Search incompleteness is not proof of absence elsewhere. |
| Gameplay menu UI signal | Installed base `ui/addons/ego_gameoptions/gameoptions.lua:388-389,418,12951-12962,13014-13063,5103-5113`; `ui/addons/ego_detailmonitorhelper/helper.lua:1907-1913`; `libraries/common.xsd:12023-12046` | The OptionsMenu submenu handler emits `menu_<option>` and the shared close path emits `menu_close`; MD can filter `event_ui_triggered` by screen/control. These are source call sites, not a verified one-per-opening runtime signal. |

The two UI Lua files above are in the same local base `08.cat` extraction
manifest (SHA-256 `cff978c89336297ce182ad0b0fb6937c994448396f53359be70efa94fc3ee58f`
and `d24a08b8da9f2c972794b60acb48ae36f38cb026c991249dab9f1164272d4df2`).
They are **outside the existing Qwen source grant**, so Codex inspected only
the relevant call sites; no Qwen UI-corpus access was assumed or added.

### Historic gameplay menu candidate (superseded by M5 on-demand request)

**Historical source finding, not an active design dependency.** The owner has replaced gameplay-menu-opening snapshots with an on-demand M5 hotkey signal. The following Lua research is preserved to explain why the menu route was rejected; it is **not** an implementation gate or a request to solve `GAME_MENU_OPENED`.

`gameoptions.lua:1246-1280` identifies the main options page with in-session
Save/Load entries and a title-menu distinction via `menu.isStartmenu`.
`onShowMenu` normally routes to `submenuHandler("main")` or a supplied option;
the latter emits `OptionsMenu` / `menu_<option>` at `:5112`.
`menu.refresh()` can call the same handler at `:5062-5093`, so `menu_main`
alone is **not** once per opening. A shipped MD script itself listens for
`OptionsMenu` / `menu_main` at `md/tutorial_inputdev.xml:425-430`, confirming
this event is intended for MD consumption.

**Candidate, pending live verification:** an MD listener for
`event_ui_triggered screen="'OptionsMenu'"` accepts the first opening-related
`menu_*` event after a matched `menu_close`, only while a playable universe
and recorder run are ready. It latches until that close, ignoring redraws and
submenus, then rearms for reopening. This can cover direct submenu entry as
well as main-page entry. It must exclude title/start menu and startup restore
paths; `onShowMenu` has a restore/question branch that may not emit a
`menu_*` event at all. The precise close/open pairing, behaviour after load,
whether MD handles UI signals during `Pause()`, and when a queued snapshot
actually executes remain unverified. **These old menu unknowns no longer block
the recorder.** Preserve the original investigation but do not build a menu
trigger as part of the revised PR #18 requirement.

### Destruction coverage and PR #17 interpretation

Qwen found `libraries/common.xsd:7155-7165,1027-1035,13910-13921` and
shipped scoped examples. Codex checked the lines: the `objecteventsource`
documentation says `object` is required if `group` is absent; a `group` may
be empty and can have members added or removed after the event condition is
set. The XSD attribute declarations themselves do **not** encode that
either/or requirement (`use="required"` is absent), so schema acceptance of
an unbound `<event_object_destroyed />` proves little. Qwen called it
unsupported outright; the narrower verified conclusion is that an unbound
listener has no documented source and its runtime delivery is **unverified**.
Shipped base examples at `md/encounters.xml:205` and
`md/boarding.xml:168` supply an object and group respectively; neither
shows a universal selector. PR #17's unbound listener is a plausible cause
of missing destruction coverage, **not an established explanation** for its
missing record.

For owned-property loss, `event_player_owned_destroyed` is a distinct
candidate with `param` killed object, `param2` killer and `param3` method
(`common.xsd:15885-15897`). The [Egosoft 6.00 breaking-change note](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Breaking%20Changes/)
says it fires before corresponding `event_object_destroyed`, so an early
record might preserve still-available commander/subordinate relationships.
This version note does not prove the listener will receive every event in
the installed 9.00 runtime. A future coverage test should observe the two
families separately, preserve their raw rows and mark any deduplicated
incident as an offline interpretation. Membership and former-owner context
must be retained before destruction; testing only current ownership after
the event risks dropping the relevant object.

### Dynamic source-group membership

Qwen located `common.xsd:1027-1045,7155-7165`; Codex checked those lines
and the narrow action dependency at `:20768-20822`. The schema documents
adding or removing members **after** an event has been set up; the group
must exist but may be empty. `add_to_group` can create a missing group,
can add an object/list/group, and `replace="true"` can repopulate it with
less remove/re-add overhead. It also documents automatic removal when a
destroyed object becomes a wreck (`:20798-20804`). Shipped `md/setup.xml`
uses `add_to_group` for player-controlled and player-ship groups at
`:577-590,641,665-666`, and `remove_from_group` for a visitor group at
`:763-773`. These are evidence of supported dynamic membership, not proof
that a proposed broad recorder's group is complete at every instant.

**Proposed lifecycle:** create a recorder-owned group on playable-universe
readiness, reconcile all currently relevant owned ships/stations and bounded
subobjects, then update it on observed acquisition/loss and periodically.
Record membership-generation and reconciliation markers. A destruction
handler must use a pre-event ownership/membership observation or the dedicated
player-owned event; a destroyed object can leave a group before later context
is queried. On each load, invalidate stale recorder readiness and rebuild
membership before claiming coverage. The inspected schema does not establish
whether group contents survive save/reload or exactly when registration
restarts; that must be tested. A delayed bootstrap should be marked as a
coverage gap rather than hidden. This design reuses the production session
key read-only and leaves its gate unchanged.

### Personnel observation boundary

Qwen located `libraries/scriptproperties.xml:301-318,373-379,2042-2060`
and shipped `md/rml_deliver_crew.xml:315-323`; Codex checked those lines.
`people.list` enumerates raw NPC templates, `people.count` explicitly counts
templates **rather than actual NPCs**, and `people.{$Template}` supplies a
contextual `npctemplateentry` on an object. That entry exposes role,
in-transit and transfer-scheduled flags, but does not alone prove completed
placement. `roleentities` is a list of already instanced entities;
`roleentity.{$Template}` denotes an instanced entity representing that
entry. Assigned control entities and assigned AI pilot are separate
properties; an assigned pilot may not currently be piloting.

**Proposed snapshot shape:** for each bounded relevant property object,
record template roster entries and their contextual fields separately from
actual component references and control-post occupants. Preserve role,
post, assignment, transfer flag and current container as distinct observed
fields; never merge two entries on seed alone. Guard unavailable/destroyed
references and encode an `UNAVAILABLE` state rather than interpreting it as
death. Sample only the affected object's roster on event triggers; use
scheduled bounded reconciliation for wider membership/crew changes.

The inspected source does **not** guarantee that every getter is free of
materialisation or other side effects. Qwen described template reads as
side-effect-free without a cited guarantee; that stronger claim is rejected.
The shipped delivery script checks a `roleentity` lookup before acting on it,
but that is not a proof of passive lookup semantics. Agent should choose
which getters may be used in the recorder only after focused source/runtime
verification, and must not deliberately instantiate an NPC just to log it.

## Proposed recorder boundaries

1. An optional extension initialises after the playable universe is ready,
   reconstructs watched player-property membership on load, and marks each
   recorder run. It reads the existing production `s1` session key **only when
   its current readiness state permits**; it never assigns or changes that
   key. `UNAVAILABLE` is an explicit session state. A run marker must not
   claim save ancestry or permanent universe identity.
2. Event-conditioned MD cues use `instantiate="true"` and
   `namespace="this"`. Their first actions copy event parameters and
   static-condition results into instance-local values. They emit a cheap
   event row promptly, then schedule a guarded snapshot of affected property
   and personnel where safe. Component references, roster entries, contextual
   templates, roles and assignments remain distinct observations. An event
   may precede a settled transfer; unavailable values remain unavailable.
3. **EVENT**, **PERIODIC** and **ON_DEMAND_HOTKEY (M5)** are the three
   requested snapshot modes. Event snapshots are bounded to affected
   participants; periodic snapshots reconcile all qualifying player assets
   at a configurable cadence; the M5 hotkey requests a **player-faction-wide**
   safely scheduled snapshot and records the real capture time and any
   deferral. The independent Life Signs Hotkeys extension supplies only the
   custom MD input signal; the recorder owns all actual snapshot actions.
   Disabling the hotkey extension must not disable event or periodic
   capture. `GAME_MENU_OPENED` is superseded. No docking or Node reader is
   required to collect.
4. MD writes an ordinary event/snapshot stream and a separate logical
   diagnostic/error stream. Each record carries format version, run/session
   state, recorder sequence, event family or snapshot trigger, timing where
   available, typed availability states and bounded context. Sequences are
   recorder observations, not engine event IDs. A native write call is an
   attempt, not confirmation of persistence. File rotation, flush, disk-space
   detection and safe run-specific naming remain unverified.
5. Offline tools may stream/index local logs by run, sequence, event family,
   time, **available ship/station `idcode`, NPC representation** and exact
   source offsets/hashes, then give Qwen bounded slices **after X4 exits**.
   Qwen classifies observed event families, links neighbouring evidence and
   proposes tentative ship/station/personnel histories in a **separate derived
   dataset** without modifying raw records. Codex verifies consequential
   inferences against original slices. Raw logs, source extracts and indexes
   remain ignored local-only. Existing production docking readers and SQLite
   schemas stay independent.

## Broad discovery and raw context contract (revised owner scope)

**The recorder is an evidence collector, not a pre-classified catalogue.**
Listen across **all qualifying player-faction ships, stations, relevant
subobjects and NPC/personnel representations**, with non-owned counterparts
included where directly involved. Register every practically useful,
source-supported event family whose selectors and handling are valid and safe,
even if its gameplay meaning and frequency have not yet been tested. There is
**no generic MD listen-to-everything event**. A source-grounded candidate may
enter staged implementation before the global inventory is complete; continue
expanding the register rather than blocking first instrumentation. Do not
restrict collection to the eight initially researched player-owned conditions,
nor to named fixtures or PR #17's observer-docking flow.

**Early raw + context fields:** exact event name; typed original
`event.object` / `event.param*` fields and guarded unavailability; source,
target and related actor/object references; available ship/station ID codes,
name/class, sector/location, owner and true owner when separately supported;
associated NPC template versus component, role, post and assignment; safe
practical session/run and per-recorder sequence/time. Capture safe primitive
values before ephemeral references expire. Do not require a specific `idcode`
for every event, invent permanent NPC identity or force getter materialisation
simply to increase row completeness. Avoid whole-universe/whole-crew work per
event; periodic/on-demand work may cover a wider state slice on a schedule.

Preserve every selected raw occurrence, even overlapping/repeated families,
and keep **Qwen's later classification/history in separate derived files**
pointing to original source offsets/hashes. Discovery-stage overhead is
expected and measurable; avoid catastrophic stalls/unbounded storage, but do
not silently sample or deduplicate native occurrences.

## Separately enabled Life Signs Hotkeys extension (planned)

The owner's **Life Signs Hotkeys** concept is a distinct optional X4 extension
with its own `content.xml` and Extensions-menu toggle, not input code embedded
inside the recorder. Verify supported packaging, signal path, cross-extension
dependency/saves and safe enable/disable, rather than asserting they already
work. The hotkey extension only emits **namespaced custom input signals**;
the recorder or later Aria subsystem owns the resulting action. No dependency
on a separately running Node keyboard service or general-purpose external
hotkey mod. Third-party code must not be copied/redistributed without licence
or permission. A minimal original implementation is preferred.

| Requested Razer macro key | Planned custom command | Target |
| --- | --- | --- |
| M1 | `DIAGNOSTICS_ERROR` | Set recorder optional diagnostic threshold to ERROR |
| M2 | `DIAGNOSTICS_WARNING` | Set threshold to WARNING |
| M3 | `DIAGNOSTICS_INFO` | Set threshold to INFO |
| M4 | `DIAGNOSTICS_DEBUG` | Set threshold to DEBUG |
| M5 | `SNAPSHOT_REQUESTED` | Request guarded faction-wide `ON_DEMAND_HOTKEY` snapshot |
| M6 | `ARIA_CALL_REQUESTED` | **Reserved only** for future Aria implementation |

Razer Synapse may map M1–M6 to supported ordinary keyboard shortcuts; X4
does not have verified native distinct M-key input. Codex must research a
supported, conflict-aware original binding/action mechanism and MD dispatch
before writing input code. Hotkeys must be configurable for other keyboards
later. When Hotkeys is disabled, broad event recording, EVENT and PERIODIC
snapshots and ordinary diagnostics remain functional; M5 and M1–M4 merely
provide optional runtime control. ERROR as a possible future minimum
verbosity is **not yet an approved release decision**; keep OFF available
in the design until the owner decides.

## Deliverables and completion distinction

| From PR #18 (documentation/design, now) | Intended later under separate authorisation |
| --- | --- |
| Source-backed recorder architecture and unresolved constraints | Running broad MD collector and native game log files |
| Progressive coverage register, including unknown event families | Incrementally expanding applicable event listeners |
| Typed raw/context schema and offline provenance requirements | Captured context-rich event/snapshot records |
| Three snapshot modes: EVENT, PERIODIC, ON_DEMAND_HOTKEY | Live-checked event/periodic/M5 snapshot behaviour |
| Diagnostic and optional hotkey-interface design | Independent toggleable hotkey extension and working runtime levels |
| Qwen indexing/classification workflow design and evidence rules | Offline classification and candidate object/NPC histories |

PR #18 **does not yet implement, deploy, validate in X4 or merge** any of
these future behaviours; subsequent owner permission is required.

## Diagnostics and counting contract

The mode controls **optional** diagnostic detail; it never changes event
listener registration, raw-event selection or the three snapshot triggers.
The design needs a verified X4-side configuration and persistence mechanism
before implementation. Do not assume an MD variable survives every launch or
that UI settings can be read from MD.

| Mode | Proposed optional diagnostic output |
| --- | --- |
| `OFF` | No optional diagnostic records or optional per-event trace work. A mandatory error/health stream is an explicit exception if Agent retains permanent error reporting; document that exception in the user setting. Ordinary capture continues. |
| `ERROR` | Observable recorder faults and incomplete/invalid processing. |
| `WARNING` | `ERROR` plus observed discontinuities, suspicious duplication or workload warnings. |
| `INFO` | `WARNING` plus compact startup/readiness and configurable heartbeat summaries. |
| `DEBUG` | `INFO` plus bounded detailed counters and processing context for development. |

The proposed permanent error/health channel and `OFF` wording need Agent
review: if health markers remain enabled under `OFF`, the setting must say so
plainly. A missing `-scriptlogfiles` flag or disk failure may prevent **both**
streams. An external setup/readiness check and later owner-run observation are
needed; MD must not report file success solely because it dispatched an
action. No diagnostic mode silently samples raw events.

Count at the earliest safe listener action by **family** and run:
`listener_received`, `records_prepared`, `writes_attempted`,
`recorder_controlled_drops`, `malformed_or_incomplete` and
`observable_failures`. A confirmed-write count is `UNAVAILABLE` unless a
separate supported acknowledgement is verified. A counter update may itself
fail or race under busy same-frame activity; validate its behaviour before
using it as an exact tally. If an event never reaches the listener, the
recorder cannot count it. If logging fails, a heartbeat may not persist.

The installed-source Qwen frame search was inconclusive. Label any volume
metric with a defined time or processing window, such as listener arrivals
per elapsed game-time interval, until a true frame identifier is verified.
Never label a window `per_frame`, compare it to engine-emitted events, or use
`NO_DETECTED_ERRORS` to mean lossless capture. Heartbeat cadence is
configurable; about 60 seconds is only a candidate for profiling. Summary
rows should carry start/end window, mode, run/session state, listener counts,
the counters above, and explicit `UNAVAILABLE` fields. A natural busy-play
test should compare elapsed time, frame-time impact where measurable, log
growth and missed/late recorder observations; no fixed synthetic event count
is prescribed.

## Agent decisions and later verification

- Choose the concrete X4-side configuration mechanism, run filename and
  retention policy after source and compatibility checks. `OFF` presently
  means no optional diagnostics, while ordinary recording remains enabled.
  The **owner reserves the right to make ERROR the minimum release level**;
  do not silently remove the OFF design option or settle that later choice.
- Verify listener event-expression lifetime, same-frame instance isolation,
  shared counter safety, and cleanup with a small separately authorised live
  check. Static schema acceptance is insufficient.
- Verify `-scriptlogfiles` readiness, file location, append/restart, actual
  error visibility, ordering, flush and disk-full behaviour before describing
  the result as durable collection.
- **Supersede the gameplay-menu trigger gate.** Instead verify how a
  minimal, separately enabled *Life Signs Hotkeys* extension can receive
  configurable keyboard input (including a Razer Synapse M-key mapping) and
  emit distinct MD signals without depending on another mod or on a Windows
  keyboard process. Do not assume X4 sees the M keys as native keys; determine
  supported action slots, bindings and cross-extension signal delivery.
  No unlicensed third-party source reuse.
- Build a source-backed event coverage register and separate component,
  contextual-template and roster observations before choosing final listeners.
  The PR #17 missing destruction row remains unexplained by schema alone.

## Proposed phases and acceptance evidence

1. **Continue source discovery alongside implementation planning:** expand
   the event-family inventory against effective installed files/overrides,
   verify each selected listener's syntax and safety, examine independent
   M-key→MD feasibility, and establish diagnostic setting, native file naming
   and retention choices. **Do not require a complete event inventory or
   demonstrated gameplay usefulness before separately approved broad
   instrumentation can begin.** Unverified mechanics remain explicit
   engineering gates to their own code paths, never fictitious successes.
2. **Later separately authorised broad-first build:** implement an optional
   native extension with the **widest safe set of source-checked event
   listeners**, not a selected-entity probe. Preserve raw typed parameters
   and available asset/personnel context. Implement automatic startup,
   safe player-property groups, guarded EVENT and PERIODIC snapshots and
   event/diagnostic streams; connect the M5 ON_DEMAND_HOTKEY input when its
   separate extension is source-supported. Extend coverage incrementally
   rather than waiting for a complete inventory. Reuse production `s1`
   read-only; keep production MD, Node readers and SQLite untouched. Static
   XML validation and privacy/diff checks are required, but do not establish
   in-game event delivery or disk durability.
3. **Later separately approved owner-run X4 check:** launch normally with
   `-scriptlogfiles`, confirm broad recorder startup without Node or docking,
   observe naturally occurring relevant events throughout owned property,
   wait for PERIODIC snapshots, and, once the independent hotkey extension
   is ready, press M5 and confirm a single `ON_DEMAND_HOTKEY` request results
   in a recorded faction-wide snapshot. Verify M1–M4 diagnostic signals when
   implemented, hotkey-disabled fallback, save/load run markers, rebuilt
   membership, diagnostics OFF (while it remains supported), and missing-flag
   file readiness. Measure log growth, game responsiveness and capture limits.
   **No menu-opening checkpoint or fixed synthetic burst test is required.**
   These are future acceptance criteria, **not tests performed for PR #18**.
4. **Offline classification and coverage expansion:** after X4 exits,
   archive/hash local captures and index by run, family, sequence, source
   offset, available object `idcode` and NPC representation. Qwen classifies
   actual delivered events, links surrounding context/snapshots, suggests
   tentative entity histories and identifies missing coverage in a derived
   analysis dataset. Codex verifies consequential findings against originals.
   Revisit listeners/context based on evidence, preserving all raw rows and
   uncertainty about permanent person identity.

`debug_to_file` offers append/overwrite but no documented rotation or
file-size query in its element. A safe provisional approach is distinct,
fixed event and diagnostic filenames with run markers, followed by offline
archiving/retention after X4 exits. It does **not** bound growth during one
long game run. A recorder-controlled per-run cap could make a gap explicit,
but it would intentionally stop capture and might fail to write its own stop
marker. Agent must set and test a measurable policy before any live release.
The source also does not expose an MD query for `-scriptlogfiles` or a write
acknowledgement, so the owner's missing-flag visibility requirement remains
an architecture gap. A one-time setup or external readiness check can observe
file appearance, but no unverified in-game success indicator should be
promised. The requirement remains open until Agent chooses and verifies a
usable mechanism.

No implementation, deployment, X4 run, owner live test or merge is authorised
by this proposal.
