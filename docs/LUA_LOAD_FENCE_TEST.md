# Experimental load-boundary test

Status: recreation correction implemented at `3a556d2`; first ordinary-load
retest is the next native gate after its verified deployment. The partial run
on `0203a30` remains documented in the
[native result](LUA_LOAD_FENCE_PLAN.md#first-native-result-and-continuation).
Confirm the corrected installation receipt before launching; implementation alone
does not mean installation is complete. Hold the later route matrix until review.

## Preparation

Codex prepares the test installation while X4 is closed: preserve existing saves,
databases, logs and optional-extension originals; back up the external closure
ledger if present; deploy the optional recorder Lua/generated MD and the matching
companion together. The native reader is unchanged. Never install only one half.

The companion install uses the existing reviewed procedure with explicit
`-DebugLog '<X4 user data folder>/debuglog.txt'` as well as GameRoot, LogDirectory
and ApprovedCommit. Retain existing logging launch options. Confirm the watcher
is IDLE before launch and SERVICE_RUNNING after launch, no unexpected worker,
and all installed hashes match. Save an evidence/hash manifest before the test.
Do not delete the closure ledger to bypass a failure or manually reopen runs.

Use a copy of an existing test save with a ready Life Signs database and a saved
Life Signs ID/checkpoint. Do not overwrite your main save. A whole snapshot should
not run for that ready universe. No slow-game mechanism is included.

## First test: one ordinary load

1. Launch X4 normally. Wait about ten seconds at the main menu for the service.
2. Choose the test save through **Load Game**. Select it once and let loading
   proceed. Do not press quickload, choose another save, start a new game or
   navigate other menu actions while the load is being prepared.
3. If loading does not begin within about 20 seconds, or any Life Signs error
   appears, stop the test and exit X4. A main-menu failure may have no help panel.
   Do not keep retrying or save over the original; keep all logs for diagnosis.
4. Once loaded, wait about 30 seconds. Rename one test ship to an easily
   recognisable temporary name and allow several seconds for recording.
5. Exit X4 normally without overwriting the source save. Tell Codex the test is
   complete, which load route you used, and whether loading or any panel differed.

Codex checks the evidence before asking for further runs. No new database-created
panel is expected for a ready database. Absence of an error panel alone is not a
pass. The ship rename supplies a simple current-session capture check.

## Subsequent route tests, after first-run review

| Test | Owner action | Purpose |
| --- | --- | --- |
| Continue | Fresh X4 process; wait at menu, then Continue into the same test universe. | Establish that Continue reaches the installed hook. |
| Same-process reload | Load test save, wait for readiness, rename a test ship, then load the same unchanged save again without closing X4. Wait, rename again, exit. | Prove old-session rows stop importing even when their file was created in the same process; preserve saved ancestry. |
| Quickload | Use a disposable quicksave only after readiness, rename a test ship, then F9 and confirm once. Wait, rename again, exit. | Determine actual F9 hook coverage; it is not assumed. |
| Cancel selection | Open Load Game and cancel before confirming, then perform a rename in the original run. | No fence should close the current session for a cancelled selection. |
| Unavailable service / invalid load | Separate supervised failure test arranged by Codex after successful routes. | No original load on missing ACK, no silent fallback/reopen, visible failure where MD is active. Do not kill a real SQLite worker yourself. |

Report each route separately. Keep fresh-launch and same-process evidence distinct.
Do not perform battle scenarios, deliberate corruption or save edits for this test.

## Codex acceptance checks

- debuglog contains HOOK_INSTALLED, one matching PREPARE and DISPATCH per confirmed
  covered load, followed by NEW_RUN_ACCEPTED from the recreated adapter. A second
  HOOK_INSTALLED during loading is expected from the observed UI lifecycle; it
  must not bypass current OPEN permission. SESSION_PERMISSION_BLOCKED may appear
  while waiting and must not flood. HOOK_UNAVAILABLE/HOOK_REPLACED,
  timeout, duplicate dispatch or a missing PREPARE is a failed/unsupported route.
- Service's durable ledger and matching control files show closure before the
  exact ACK; the new OPEN agrees on run, universe and rotated challenge.
- Old-session SQL maximum/count/payload stays fixed after closure, even if old
  raw logs grow. Current raw rows and SQL have exact contiguous ordinals and the
  rename belongs to the current profile/run. Existing strict validation remains.
- Saved parent checkpoint is preserved: inspect the next RUN_BEGIN and actual
  persisted parent record/payload. Specifically look for any old acknowledgement
  already queued inside MD advancing the restored checkpoint. This unresolved
  native ordering cannot be signed off from the service tests alone.
- The Life Signs ID/database selection is unchanged; no repeated whole baseline
  for a ready universe, missing-row repair, future-branch inheritance or damage
  listener is introduced. SQLite integrity passes and workers close after exit.

Unsupported F9/global access or unsafe queued-ACK ordering means the experimental
build has not met acceptance. Preserve evidence and revert through backed-up
optional-extension/companion files while X4 is closed if needed. Keep historical
databases and ledger for review; rollback is not permission to rewrite history.
