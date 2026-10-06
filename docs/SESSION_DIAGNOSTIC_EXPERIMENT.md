# Disposable session lifecycle diagnostic

Status: **Experimental lifecycle/replacement gate passed in owner-reported live
X4 testing.** Fresh-game docking and old/corrected-save regression checks passed
at `1953110`. Automatic session separation and guaranteed token uniqueness remain
unverified. Original bridge/persistence results are unchanged.

Follow-up: [session-key source prerequisite](SESSION_KEY_SOURCE_GATE.md) records
the installed random-source inspection and an independent optional reload
diagnostic. Production remains blocked on random freshness and final key approval.

## Choice and installed evidence

One separate MD script observes all three lifecycle events with instantiated root
cues. Only `event_universe_generated` assigns the candidate: its installed
description covers both save loading and new-game generation. This tests whether
that callback replaces restored state before personally controlled docking.
Neither other observer nor docking creates or repairs a token. Lifecycle observers
use no delays, timers, cue resets or assumed callback ordering. Docking subscription
now waits separately for the controlled group to exist, as described below.

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

Existing `LIFESIGNS_BRIDGE_V1` records and reader are unchanged. Both MD docking
listeners now sit beneath a controlled-group readiness cue; their event filters
and output actions are unchanged. Diagnostic
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

The separate random-source diagnostic has independent `-RandomSourceDiagnostic`
and `-RemoveRandomSourceDiagnostic` options. If it is installed, add one of those
choices to each deployment/rollback command here (including WhatIf). See its
[deployment and rollback commands](SESSION_KEY_SOURCE_GATE.md#deployment-and-rollback).

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
confirm the deployed checkout SHA for those initial runs or inspect raw logs/saves.
The final retest below explicitly reports revision `1953110`. Tokens below are local-clock
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
| Fresh new game | Universe → Started; Started saw assigned token; no duplicate assignment observed | `2026-10-06_14-01-17` | Neither listener emitted docking output. Follow-up identified premature group lookup during startup; initial docking was inconclusive; the final corrected retest below passed. |
| Full X4 restart / later load | A restored saved diagnostic state | `2026-10-06_15-27-36`, later `2026-10-06_15-30-28` | First observed docking used the latter token; no docking confirmation reported for the former. |
| Already-docked save load | Restored `2026-10-06_20-43-37`, then replaced; no false docking on load | `2026-10-06_20-47-39` | Later genuine docking produced normal bridge and diagnostic records using replacement. |
| Node absent, then started later | Both markers emitted in raw X4 log without Node | Current MD token unaffected by Node | Reader started at current end, replayed no prior bridge records and acknowledged the next genuine docking. |

### Lifecycle and replacement assessment

The loaded-save observations support recurring listeners, visible restored state,
replacement by universe generation before the observed genuine dockings, and
stable state during an uninterrupted loaded game including a Node restart.
Sequence rewind is expected restoration behaviour, not a new-session identifier.
Raw-log output establishes that MD emission is independent of Node.

The initial fresh-game run established ordering and a single assignment but
could not establish docking behaviour. Follow-up identified the shared startup
subscription defect; final corrected fresh-game docking passed below. Treat
these as results from different revisions, not a token replacement failure.

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

### Fresh-game startup defect and correction

The owner's targeted fresh unsaved new game produced these errors at game time
`0.00` in both `md.LifeSigns_BridgeProbe.PlayerControlledDocked` and
`md.LifeSigns_SessionDiagnostic.PlayerControlledDocked`:

```text
Property lookup failed: global.$PlayerControlledGroup
Evaluated value 'null' is not of type group
```

Immediately afterwards universe generation assigned
`2026-10-06_21-09-20` from UNSET (seq 1, assignments 1), then game start
observed that same token (seq 2). Only one assignment occurred. This supports
normal token lifecycle behaviour while identifying premature evaluation of the
docking event's group before shipped setup creates it. Loaded-save docking
remains verified at the earlier tested revisions.

Both scripts now put the unchanged instantiated docking listener under one
non-instantiated `WaitForPlayerControlledGroup` cue, with `checkinterval="1s"`
and `check_value value="global.$PlayerControlledGroup?"`. The existence lookup
does not dereference the absent group. The child subscription is enabled only
after that condition succeeds. The readiness cue completes once, so it does not
continually create subscriptions; the child remains instantiated for repeated
dockings. Nothing creates/replaces the shipped group or assigns a token here.

The [Egosoft Mission Director Guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
documents child conditions becoming enabled after parent activation, and
repeated non-event condition checks using `checkinterval`. This gates on actual
existence rather than assuming a fixed startup delay or callback order.
Registration can wait up to a polling interval after group creation; dockings
before registration are not captured. Production delivery guarantees remain
outside this experiment.

The gated listener is named `PlayerControlledDockedReady`. Do not reuse the old
`PlayerControlledDocked` name at a new position in the cue tree. Earlier diagnostic
saves are deliberately included in the retest below; no save editing or purging
is required.
The installed X4 9.00 schemas are unavailable in this remote review environment,
so the corrected scripts still require local installed-schema validation.
XML well-formedness and Node tests cannot prove MD runtime behaviour.

### Retest of 12e357f: fresh-game pass, loaded-save regression failure

Owner-reported test of corrected revision `12e357f`:

| Scenario | Observed evidence | Result |
| --- | --- | --- |
| Fresh unsaved new game | No Life Signs missing-group/null-group errors. Token `2026-10-06_21-29-42` assigned once and retained by game start. | Readiness fix passed this startup test. |
| First fresh-game docking | Ship `BQN-936`, destination `VYM-975`; diagnostic seq 3 used startup token; matching normal bridge record and Node acknowledgement. | Passed. |
| Second fresh-game docking | Same ship, destination `LQZ-367`; diagnostic seq 4 used the same startup token; matching bridge record and acknowledgement. | Passed; token stable. |
| Load earlier diagnostic save | Both scripts reported duplicate cue name `PlayerControlledDocked` (bridge line 11, diagnostic line 68); no docking records or Node acknowledgement followed. | **Loaded-save regression failed.** |
| Lifecycle after that load | Saved token `2026-10-06_20-43-37` restored and replaced by `2026-10-06_21-40-13`. | Replacement still observed despite docking import failure. |

The earlier loaded-save results remain historical evidence at their tested
revisions. They do not establish that revision 12e357f works on those saves.

### Saved-cue correction

The MD guide's **MD refreshing and patching / Details and restrictions** explains
that saved MD state is refreshed against current scripts on load. A cue cannot
move between parents under its existing name: it must receive a new name.
Removed cue nodes and their instances are removed; new names create new cues.

The readiness patch moved `PlayerControlledDocked` from the root into
`WaitForPlayerControlledGroup` while retaining its name. This violates that
documented refresh restriction and matches the reported duplicate-name errors.
There is only one such name in each source XML; this is a saved-tree refresh
conflict, not two duplicate definitions in the source.

The smallest correction renames the gated child in both scripts to
`PlayerControlledDockedReady`. The readiness parent stays in place.
No event condition, player filter, action, record, lifecycle cue or token
expression changes. Refresh is expected to remove the old listener instances
and add the new gated child. This must be verified against old diagnostic saves,
including absence of duplicate records. No manual save manipulation or cleanup
load is part of the test. Reserve the retired name; do not reuse it in a future
cue position. This is a disposable experiment correction, not a general save
migration system.

### Gate decision and minimum retest

**Fresh-game readiness at 12e357f passed; loaded-save regression failed.**
The following correction retest was prescribed; final results are recorded below:

1. With X4 closed, validate both corrected MD files against the installed X4 9.00
   schema, record the deployed SHA and redeploy with `-SessionDiagnostic`.
2. Start a completely fresh disposable new game. Confirm no Life Signs MD errors,
   including missing/null-group and duplicate-cue errors. Complete two genuine
   personally controlled dockings without saving/reloading. Expect exactly two
   records per marker and two Node acknowledgements; both diagnostic records
   must use the single startup token.
3. Load unchanged disposable A from the original root-listener diagnostic revision,
   preserving its old saved cue state. Confirm no Life Signs import/runtime errors.
   Show restored token, replacement assignment, then two genuine dockings using
   the replacement token. Expect one normal record, one diagnostic record and
   one Node acknowledgement per docking, with no surviving duplicate listener.
4. Save a new disposable copy under this correction, reload it once and genuinely
   dock. Confirm recurring subscription, token replacement and exactly one record
   per marker. Do not overwrite A.
5. If a disposable save made at 12e357f exists, also load it unchanged and genuinely
   dock once. This checks refresh from the previous nested-listener layout as well
   as the original root layout; record if no such fixture is available.

Keep X4 logs and saves local. Report revision, errors checked, callback order,
restored/replacement tokens and record counts. Unrelated mod/save errors remain
context unless they interfere.

Renaming alone was not proof of successful refresh; the live retest below supplies
the observed fresh-game and saved-state evidence. Independent installed-schema
validation of the final revision was not supplied in the owner's retest report.

PR #9 remains unmerged for review. Automatic session separation remains
unverified; token design, routing and SQLite schema remain unchanged.

Correction validation: the name-only XML changes preserve the readiness gate,
docking conditions/actions and lifecycle logic. XML well-formedness and diff
whitespace are checked remotely; installed-schema/runtime save refresh require
local validation. Earlier remote suite results were 41 passes and two Windows
deployment skips on Node.js v24.19.0; original Windows results remain separate.

### Final correction retest: 1953110

The owner reports successful X4 9.00 retesting at
`195311073d568984bca4bb2094dac25e83dbf3eb`. These are reported live results,
not independent inspection of the owner's raw logs or save files.

| Scenario | Observed result | Assessment |
| --- | --- | --- |
| Fresh unsaved game | Two genuine dockings used the same startup token; no Life Signs controlled-group/null-group or duplicate-cue errors. | Passed fresh-game readiness and docking stability. |
| Unchanged old diagnostic save A | Restored token replaced correctly; two genuine dockings each produced exactly one bridge and one diagnostic record; no duplicate-cue regression. | Passed refresh from old diagnostic state and replacement before docking. |
| Corrected-copy save B reload | Restored `2026-10-06_21-58-34`; replacement `2026-10-06_22-06-47`; first docking used replacement and produced exactly one record per marker plus a reader acknowledgement; no Life Signs duplicate-cue or controlled-group errors. | Passed corrected-save restoration, replacement and recurring docking subscription. |

B in this final retest is a corrected-copy save, not the earlier
different-universe B fixture. The owner supplied no exact tokens for the final
fresh-game or A runs; do not fill them from earlier revisions. A separate
12e357f-era save fixture was not reported; that optional transition is not
claimed tested.

**The experimental lifecycle/replacement gate is now passed for the tested
scenarios.** Earlier observations establish repeated loads, full X4 restart,
Node restart/late startup and loaded-save ordering. The final corrected retest
closes the fresh-game docking and saved-cue regression gaps. It establishes
observed replacement before docking and stable use within uninterrupted sessions,
not a universal callback-order or delivery guarantee.

**PR #9 is ready to merge as a disposable diagnostic and docking-startup
correction**, based on final diff review, recorded automated checks and the
owner-reported live retest. No further live repeat is required for this scoped
gate. Final-revision installed-schema validation was not separately confirmed;
do not represent the earlier schema checks as checks of this revision.

No newly assigned token repeats were reported, but wall-clock uniqueness remains
unproven and the seconds-resolution candidate is not a guaranteed production key.
Automatic database separation, production session routing, permanent identity,
AI, voice and return communication are not implemented or verified by this PR.
The next step may be a separate session-separation design with explicit freshness
and ambiguity handling. Keep this PR unmerged until the owner chooses to merge.
