# Broad MD event recorder: source-checked design proposal

Research state: 17 October 2026, PR #18. **Proposed, not implemented or live
verified.** Read [the workstream findings](BROAD_MD_EVENT_CAPTURE_FINDINGS.md)
for the owner requirements and historical PR #17 boundary. Agent owns the
architecture and later acceptance plan. This document records verified source
constraints, a reviewable recorder shape and remaining decisions.

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

### Gameplay menu opening candidate

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
actually executes remain unverified. If the native signals cannot satisfy
every opening, Agent should propose a small extension UI Lua-to-MD signal
that fires in the show hook; compatibility and non-override integration must
be separately established. A menu-open record is an observation checkpoint,
not a durable pre-save guarantee.

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
3. Event, periodic and once-per-distinct-gameplay-menu-opening snapshots are
   all required. A menu-open snapshot reports the observed instant and can be
   deferred to protect menu responsiveness; the record must identify the
   actual capture time and any deferral. The exact installed UI signal and
   pause-time MD scheduling are unresolved. A UI Lua bridge, if needed, needs
   a separately reviewed compatibility design. No docking or Node reader is
   required to collect.
4. MD writes an ordinary event/snapshot stream and a separate logical
   diagnostic/error stream. Each record carries format version, run/session
   state, recorder sequence, event family or snapshot trigger, timing where
   available, typed availability states and bounded context. Sequences are
   recorder observations, not engine event IDs. A native write call is an
   attempt, not confirmation of persistence. File rotation, flush, disk-space
   detection and safe run-specific naming remain unverified.
5. Offline tools may stream/index local logs by run, sequence, event family,
   time and source offsets, then give Qwen bounded slices **after X4 exits**.
   Raw logs, source extracts and indexes remain ignored local-only. Existing
   production docking readers and SQLite schemas stay independent.

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
  retention policy after source and compatibility checks. Decide whether
  permanent health records remain in `OFF` and how that exception is worded.
- Verify listener event-expression lifetime, same-frame instance isolation,
  shared counter safety, and cleanup with a small separately authorised live
  check. Static schema acceptance is insufficient.
- Verify `-scriptlogfiles` readiness, file location, append/restart, actual
  error visibility, ordering, flush and disk-full behaviour before describing
  the result as durable collection.
- Find the exact gameplay Save/Load/Exit menu-open call site or design the
  smallest UI Lua-to-MD bridge. Confirm distinct opening, title-menu exclusion
  and MD scheduling while the menu is open in a later approved game check.
- Build a source-backed event coverage register and separate component,
  contextual-template and roster observations before choosing final listeners.
  The PR #17 missing destruction row remains unexplained by schema alone.

No implementation, deployment, X4 run, owner live test or merge is authorised
by this proposal.
