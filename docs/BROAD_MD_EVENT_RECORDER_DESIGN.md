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
