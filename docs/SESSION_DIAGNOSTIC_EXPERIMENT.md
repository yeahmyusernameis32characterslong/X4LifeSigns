# Disposable session lifecycle diagnostic

Status: **Live loaded-save lifecycle/replacement behaviour observed; fresh-new-game
docking verification inconclusive.** Automatic session separation is not implemented
or verified. Original bridge/persistence results are unchanged.

## Choice and installed evidence

One separate MD script observes all three lifecycle events with instantiated root
cues. Only `event_universe_generated` assigns the candidate: its installed
description covers both save loading and new-game generation. This tests whether
that callback replaces restored state before personally controlled docking.
Neither other observer nor docking creates or repairs a token. No delays, timers,
cue resets or assumed callback ordering are used.

| Installed X4 9.00 file | Supporting evidence |
| --- | --- |
| `libraries/common.xsd:16506` | `event_game_loaded`: completed save load; parameters are version/build/original version. Warns newly added non-root listeners can miss the first load. |
| `libraries/common.xsd:16573` | `event_game_started`: new game started and universe populated; parameter is selected gamestart options. |
| `libraries/common.xsd:17280` | `event_universe_generated`: universe generation completed at game start or save loading. No unique token parameter. |
| `md/setup.xml:22` | Root instantiated save-load listener. |
| `md/cover.xml:4` | Root instantiated load/start-signal listener overwrites shared `md.$CoverDebug`. |
| `md/npc_usecases.xml:132` | Instantiated listener observes both direct game-start and game-load events. |
| `md/x4ep1_mentor_subscription.xml:963` | Universe-generated listener checks saved cue state and resets management cues. |
| `libraries/md.xsd:1052` | `namespace="this"` uses the instance; default root namespace is static. This diagnostic uses instance-local snapshots and explicitly shared `md.$LifeSignsSessionDiag*` variables. |
| `libraries/md.xsd:4584` | `instantiate` creates a cue instance on activation. |
| `libraries/scriptproperties.xml:2410`, `md/setup.xml:86` | Supported local-clock string property and shipped expression `player.systemtime.{'%Y-%m-%d_%H-%M-%S'}`. |
| `libraries/common.xsd:13924,25956` | Completed docking and debug output. The diagnostic copies the verified personally controlled filter from the original probe. |

Installation reports `900`. These schemas were extracted from installed
`08.cat/08.dat`; prior inspection checked later base and installed extension
schema overrides. Inspection copies are temporary. Schema MD5 values:
`md.xsd=d7ac24747687e15d9be608ff63b52ccd`,
`common.xsd=de2c08eabd2f3e22d705ed473b7940ce`,
`scriptproperties.xml=f03b6cf9076b60754beed0c02c50f80c`.

The candidate is a **local clock reading to the second**, not a guaranteed unique
identifier. Close callbacks, clock changes or repeated local times may collide.
Multiple universe-generated callbacks would assign multiple times; record that
as unexpected reassignment rather than hiding it. Shared MD state may be saved
and restored. The sequence and assignment counters can rewind and are not
globally monotonic. No random freshness or permanent identity is claimed.

## Records

Marker: `LIFESIGNS_SESSION_DIAG_V1`. Physical log order is observation order.
Every lifecycle invocation prints `phase=before`, with callback, incremented
observation `seq`, previous token, and all shared state at entry:
`state_seq`, `state_assignments`, `state_callback`, and `token`.
Absent state is explicitly `UNSET`. These are state snapshots, **not automatic
proof of restoration**. Correlate them with disposable save A's captured state.

The assigning callback then prints `phase=assigned` immediately after setting
the token, with the same seq, previous state, new token and assignment count.
The other observers print only before and never overwrite the token.
Docking increments the observation sequence and prints token, ship and
destination ID codes, even when token is UNSET. Docking never assigns a token.

Illustrative payloads (order and actual values must be observed):

```text
LIFESIGNS_SESSION_DIAG_V1|lifecycle|callback=event_universe_generated|phase=before|seq=8|previous=2026-10-06_12-00-00|state_seq=7|state_assignments=1|state_callback=event_game_loaded|token=2026-10-06_12-00-00|END
LIFESIGNS_SESSION_DIAG_V1|lifecycle|callback=event_universe_generated|phase=assigned|seq=8|previous=2026-10-06_12-00-00|state_seq=7|state_assignments=1|state_callback=event_game_loaded|token=2026-10-06_12-05-00|assignments=2|END
LIFESIGNS_SESSION_DIAG_V1|docked|seq=9|token=2026-10-06_12-05-00|ship=ABC-123|destination=DEF-456|END
```

Existing `LIFESIGNS_BRIDGE_V1` records and reader are unchanged. Diagnostic
records are inspected directly, never sent to SQLite. Use console-only Node.

## Deploy, observe and remove

From the checkout, replace placeholders locally; keep actual paths in ignored
SETUP.local.md. Close X4 before deployment or removal.

```powershell
git rev-parse HEAD
npm.cmd --prefix bridge test
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -SessionDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -SessionDiagnostic
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG'
```

Enable the existing Life Signs Bridge Probe extension and retain logging launch
options `-debug all -logfile debuglog.txt`. The opt-in adds only
`extensions\lifesigns_bridge_probe\md\LifeSigns_SessionDiagnostic.xml`.
Normal deployment still installs only the original two XML files. With the
diagnostic present, normal deployment refuses until retention/removal is explicit.

Inspect in physical line order (PowerShell line numbers help when seq rewinds):

```powershell
Select-String -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -SimpleMatch 'LIFESIGNS_SESSION_DIAG_V1'
Select-String -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -SimpleMatch 'LifeSigns_SessionDiagnostic'
New-Item -ItemType Directory -Path '.\local-data\session-diagnostic' -Force
Copy-Item -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -Destination '.\local-data\session-diagnostic\run-01-debuglog.txt'
```

Use a different run filename for each capture. Preserve every run before X4
overwrites its log on another launch. Capture again after exit and before restart
where possible. Logs/saves stay local and must not enter commits or PRs.

Rollback with X4 closed:

```powershell
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveSessionDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveSessionDiagnostic
Test-Path -LiteralPath 'YOUR_X4_INSTALLATION\extensions\lifesigns_bridge_probe\md\LifeSigns_SessionDiagnostic.xml'
```

Expect False. This removes only that diagnostic file and redeploys the original
manifest/probe. It does not delete extensions or edit saves. Saved diagnostic
state is not purged by file removal: discard disposable test saves and return to
a normal save that was never used with the diagnostic.

## Live procedure

Use disposable copies and separate save slots. Never overwrite the normal
playthrough. Record tested commit, X4 version, enabled extensions and diagnostic
flags. Loading an already-docked save may emit callbacks: retain them as evidence.

1. Load a disposable test save. Capture all lifecycle records in physical order.
   Personally complete two genuine dockings; undock between them. Both should
   use the same assigned token.
2. Stop Node with Ctrl+C, restart its console-only command without reloading X4,
   and dock again. Token should be unchanged; Node cannot assign MD state.
3. Create disposable **A** after token T0 is assigned, with diagnostic state
   present. Capture token/counters before saving; do not overwrite A thereafter.
   Reload that exact unchanged A three times, including two close together.
   After each load, genuinely dock. Show A's restored token/state before
   assignment, replacement assignment, then first docking using replacement.
   Each candidate must differ from restored T0 and every other observed session
   token. Retain failures rather than adding delays to evade collisions.
4. Load disposable **B** from another universe, ideally also saved with diagnostic
   state present; dock. Load A again; dock. Capture replacement and ordering in
   both transitions. If saved state cannot be demonstrated, restoration is
   inconclusive rather than passed.
5. Start a new game and reach personally controlled docking. Capture all
   lifecycle callbacks and their order, including multiple assignments. Complete
   another docking and check stability once docking is possible.
6. Exit X4 completely; preserve the log. Restart, load A and dock. Compare the
   replacement with every earlier token.
7. Include an already-docked save. Keep any load-time docking records; then
   personally undock and genuinely dock again. Do not treat save loading itself
   as the requested genuine docking.
8. Load a save while Node is stopped, start Node and genuinely dock. Raw X4 log
   must show assignment before docking: Node starts at EOF and ignores diagnostic
   markers, so its output cannot establish earlier lifecycle observations.

## Reporting and acceptance

Keep a local table with one row per transition, including all three A reloads:

| Scenario | Callback order | Restored token | Assigned token | First docking token | Later docking token | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Initial load / Node restart / A reload 1–3 / B / A return / new game / X4 restart / docked save / Node-stopped load | pending | pending | pending | pending | pending | pending |

Pass the observed lifecycle check only if callbacks continue through repeated
loads, saved diagnostic state is demonstrably observed then replaced, replacement
precedes every relevant docking, token stays stable within each uninterrupted
session, no observed candidate repeats, and no diagnostic MD errors occur.
Missing evidence is inconclusive. Repeated tokens, late replacement, unexpected
reassignment or docking with UNSET/restored state are failures. Unrelated
mod/save errors remain context unless they interfere.

Report separately: (1) lifecycle/replacement behaviour observed, (2) candidate
freshness observed in these runs, (3) evidence still needed before production.
Even a successful live test cannot prove universal token uniqueness. No
automatic routing, database changes or production fixes belong in this diagnostic.

## Automated validation

Installed MD schema validation checks XML structure/attributes, not runtime
expression evaluation, lifecycle ordering, save restoration or token uniqueness.
Run existing bridge/persistence tests plus opt-in deployment/rollback checks in a
temporary mock installation. No real game deployment is performed by these
checks. Owner-reported live results are recorded separately below.

Local automated results on Node.js v24.21.0: **43 tests passed, zero failures
or skips**; both MD scripts validated against the installed X4 9.00 md.xsd
and common.xsd; git diff --check passed. The added mock test covers opt-in,
redeployment, WhatIf, explicit removal, flag conflicts, default deployment and
preservation of another extension. Schema validation does not prove expression
evaluation or any live acceptance criterion.

## Live results: 6 October 2026

Owner-reported observations from the X4 9.00 diagnostic introduced by PR #9
at `7d0eaa714c8faab97e390e7e5e3afcdee59e922d`. The report does not independently
confirm the deployed checkout SHA or inspect raw logs/saves; confirm the tested
revision when completing the remaining check. Tokens below are local-clock
diagnostic values, not personal paths or production identifiers.

In the table, **Loaded → Universe** means `event_game_loaded` followed by
`event_universe_generated`; **Universe → Started** means
`event_universe_generated` followed by `event_game_started`.

| Scenario | Lifecycle / restored state | Assigned token | Docking / result |
| --- | --- | --- | --- |
| Initial loaded save | Loaded → Universe; UNSET | `2026-10-06_10-53-55` | Multiple genuine dockings used the same token. |
| Node restart, no X4 reload | MD state retained; docking sequence continued | Unchanged `2026-10-06_10-53-55` | Docking token stayed stable; Node restart had no effect. |
| Unchanged A reload 1 | Loaded → Universe; restored `2026-10-06_11-04-49` | `2026-10-06_13-48-07` | First docking used replacement. |
| Unchanged A reload 2 | Loaded → Universe; same restored token | `2026-10-06_13-49-03` | First docking used replacement. |
| Unchanged A reload 3 | Loaded → Universe; same restored token | `2026-10-06_13-52-02` | First docking used replacement; sequence rewound with saved state as expected. |
| Different-universe B | Loaded → Universe; UNSET | `2026-10-06_13-54-24` | First docking used assigned token; B does not prove restoration of diagnostic state. |
| B → A | Restored A token `2026-10-06_11-04-49`, then replaced | `2026-10-06_13-57-40` | First docking used replacement. |
| Fresh new game | Universe → Started; Started saw assigned token; no duplicate assignment observed | `2026-10-06_14-01-17` | Neither listener emitted docking output in the fresh unsaved universe. **Docking inconclusive**, not an observed token failure. |
| Full X4 restart / later load | A restored saved diagnostic state | `2026-10-06_15-27-36`, later `2026-10-06_15-30-28` | First observed docking used the latter token; no docking confirmation reported for the former. |
| Already-docked save load | Restored `2026-10-06_20-43-37`, then replaced; no false docking on load | `2026-10-06_20-47-39` | Later genuine docking produced normal bridge and diagnostic records using replacement. |
| Node absent, then started later | Both markers emitted in raw X4 log without Node | Current MD token unaffected by Node | Reader started at current end, replayed no prior bridge records and acknowledged the next genuine docking. |

### Lifecycle and replacement assessment

The loaded-save observations support recurring listeners, visible restored state,
replacement by universe generation before the observed genuine dockings, and
stable state during an uninterrupted loaded game including a Node restart.
Sequence rewind is expected restoration behaviour, not a new-session identifier.
Raw-log output establishes that MD emission is independent of Node.

The fresh new game establishes observed lifecycle ordering and a single assignment,
but does not establish token availability or stability at docking. Because both
the normal and diagnostic listeners were silent, the report does not isolate the
cause. Do not classify the silence as a token replacement failure or a passed
docking test. Absence of diagnostic MD errors was not explicitly confirmed in this
report and remains a completion check.

### Candidate freshness assessment

No newly assigned token repeated among the reported tests. Reappearance of A's
saved token before replacement is expected and is not reuse of an assigned
session token. These observations do **not** prove universal uniqueness.

The candidate still has seconds resolution and uses a local wall clock; repeated
clock values, clock changes or multiple assignments in one second can collide.
The three A reloads were separated by at least 56 seconds and do not demonstrate
same-second collision resistance. Production design must explicitly address
freshness and safe handling of ambiguity rather than adopt this timestamp alone
as a guaranteed unique session key.

### Gate decision and one remaining targeted check

**Loaded-save lifecycle/replacement sub-gate supported by the reported observations.
The complete load/start-to-docking gate remains open.** One targeted fresh-new-game
check is required before calling that complete gate passed. Production design
discussion may proceed using these findings, but production implementation and
Verified status must wait for the remaining evidence and a suitable token design.

1. Confirm the deployed revision, diagnostic opt-in and logging with X4 closed.
   Start a disposable new game that permits personally controlled ship docking.
   Keep this universe uninterrupted and do not save/reload to obtain a docking
   result; a reload would exercise the already tested loaded-save path.
2. Capture Universe → Started records and their assigned token. Personally
   complete two dockings, undocking between them, and inspect the raw log for
   both markers. Both diagnostic docking records must use the startup token,
   with no intervening assignment or UNSET/restored token.
3. Check the log for errors mentioning either probe. Confirm no diagnostic MD
   errors in the retained earlier runs too. Unrelated save/mod errors remain
   context unless they interfere.
4. If both listeners are still silent, retain the log and verify player control,
   completed docking and controlled-group availability against installed evidence.
   Report the shared docking-listener gap separately. Do not modify token logic
   or production handling merely to make this check pass.

Retain PR #9 unmerged for review. Automatic session separation remains unverified;
no automatic routing, schema changes or production session handling is added.
