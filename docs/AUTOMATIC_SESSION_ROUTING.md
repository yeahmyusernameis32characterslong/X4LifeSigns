# Automatic session routing: production live acceptance

Status: **Implemented, unverified / in progress.** Automated synthetic tests and
installed X4 9.00 schema validation are separate from live verification. The owner
must complete this production matrix before automatic session separation can be
marked Verified under the approved practical `s1` assumption.

## Contract and limits

The production probe samples the local system clock once and executes exactly four
unseeded MD `set_value` draws from `0..2147483647` at
`event_universe_generated`. It publishes:

`s1-<YYYY-MM-DD_HH-MM-SS>-<r1>-<r2>-<r3>-<r4>`

`event_game_loaded` first invalidates restored readiness. Universe generation
replaces the saved key and sets readiness; game start does not assign another
key. Docking never generates, repairs or replaces it. The existing
`WaitForPlayerControlledGroup/PlayerControlledDockedReady` tree and personally
controlled completed-docking filter are preserved. The retired
`PlayerControlledDocked` name remains reserved.

Production state belongs to `md.$LifeSignsProductionSessionReady` and
`md.$LifeSignsProductionSessionKey`, independently of both optional diagnostics.
The `LIFESIGNS_SESSION_ROUTING_V1` messages expose `invalidated` (previous key,
ready=false), `assigned` (previous and current key, ready=true), or
`no_ready_session` (reason and docking IDs). Here V1 is the marker's first format
revision, not maturity or verification status. These messages are diagnostic
only and cannot create a database. Missing/not-ready/empty production state
suppresses V2 and emits the failure message; V1 is still emitted.

A ready eligible docking emits the unchanged V1 record and a V2 record:

```text
LIFESIGNS_BRIDGE_V1|docked|ship=ABC-123|destination=DEF-456|END
LIFESIGNS_BRIDGE_V2|docked|session=s1-2026-10-08_12-30-00-1-2-3-4|ship=ABC-123|destination=DEF-456|END
```

| Reader mode | Consumed records | Storage |
| --- | --- | --- |
| `--log <path>` | V1 only | Console acknowledgement only |
| `--log <path> --db <database>` | V1 only | Existing manual schema v1 |
| `--log <path> --auto-db` | V2 only | Owned schema-v2 file per session key |

`--db` and `--auto-db` conflict. The source-relative repository directory
`local-data/sessions/` is used regardless of the launch working directory.
The first handled valid V2 docking creates/opens `<session-key>.db`. Lifecycle
callbacks alone create nothing. Only one automatic store is active; a different
key closes it before opening the next owner. An identical complete key reuses
that owner with no invented filename suffix.

The entire V2 record is validated before storage. Malformed/missing session data
warns and skips without reusing the previous key. Storage, schema, ownership,
open, corruption, commit or readback errors terminate the writer with exit code 1
and no success acknowledgement for that record. A readback failure after commit
can leave a committed row without an acknowledgement; there is no retry.

The reader starts at EOF. Dockings while Node is stopped are not imported on
restart. Log replacement/truncation retains the original replay behaviour.
There are no checkpoints, deduplication or exactly-once guarantees.

The owner accepted the unquantified residual collision risk solely for practical
local single-player use. Identical complete keys from actual distinct sessions
are indistinguishable from a Node restart; ownership cannot detect them and
histories could mix. This is not proof of independent entropy, 124 random bits,
uniformity, reseeding, guaranteed uniqueness or permanent entity identity.
See [the closed source decision](SESSION_KEY_SOURCE_GATE.md) and
[database validation rules](../DATABASE.md).

## Prepare the owner-run test

Do not deploy automatically. Close X4 before using these manual commands from
the reviewed branch checkout. Replace placeholders locally. Every command below
is one PowerShell line. Use Node.js v24.21.0 and X4 9.00; record actual versions,
the deployed commit, enabled extensions, callback order and observations.

```powershell
git rev-parse HEAD
node --version
npm.cmd --prefix bridge test
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic
Test-Path -LiteralPath 'YOUR_X4_INSTALLATION\extensions\lifesigns_bridge_probe\md\LifeSigns_SessionDiagnostic.xml'
Test-Path -LiteralPath 'YOUR_X4_INSTALLATION\extensions\lifesigns_bridge_probe\md\LifeSigns_RandomSourceDiagnostic.xml'
```

Both Test-Path results must be False. Both optional diagnostics must remain
removed for the production matrix. Enable Life Signs Bridge Probe and retain
X4 launch options `-debug all -logfile debuglog.txt`. Use disposable saves only.
Do not overwrite existing fixtures or old databases.

Once X4 has created the log, start auto mode before each requested genuine
docking and wait for `Watching from current end:`:

```powershell
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG' --auto-db
```

Stop Node with Ctrl+C before independent readback or hashing. Replace
`SESSION_KEY` with the complete observed production key, not the diagnostic
token or a manually invented value:

```powershell
node .\bridge\src\read-stored-events.js --db '.\local-data\sessions\SESSION_KEY.db'
Get-FileHash -Algorithm SHA256 -LiteralPath '.\local-data\sessions\SESSION_KEY.db'
Select-String -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -SimpleMatch 'LIFESIGNS_SESSION_ROUTING_V1','LIFESIGNS_BRIDGE_V1','LIFESIGNS_BRIDGE_V2','LifeSigns_BridgeProbe'
```

Readback must show one ownership object (`singleton:1`, exact `session_key`,
`key_scheme:"s1"`), the expected rows and `Stored docking count`. Record the row
fields and hash for each completed history; recheck them after later sessions.
Keep raw evidence locally in ignored storage:

```powershell
New-Item -ItemType Directory -Path '.\local-data\production-routing-evidence' -Force
Copy-Item -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -Destination '.\local-data\production-routing-evidence\RUN_ID-debuglog.txt'
```

Choose a fresh RUN_ID for each capture. Preserve logs before a full X4 restart
overwrites them. Saves remain private in the owner's save location; do not parse
or edit them. Do not commit logs, databases, saves, profile IDs or private paths.

## Required production matrix

For every eligible docking, correlate one V1 and one V2 log record with exactly
one auto persistence acknowledgement, then check the stored row independently.
The clock and complete candidate rendering have **not** been verified statically:
check the literal V2 key for canonical decimal limbs, exact clock spelling,
no whitespace/padding/scientific notation, and agreement with ownership.

1. **A: two dockings.** Load a disposable universe/save and observe production
   assignment. Now save a disposable **A after production state is present**,
   note its saved key K0 and retain A unchanged throughout this matrix. Complete
   two genuine personally controlled dockings without reloading. Expect K0 for
   both, one K0 database and two rows. Loading/assignment alone creates no row
   or database. Stop Node, read back and record both rows.
2. **Node restart only.** Leave that X4 session loaded. Restart Node, observe no
   replay/acknowledgement at startup, then genuinely dock once. Expect K0, the
   same database and three rows, with the first two unchanged. Stop Node and
   record readback plus the completed K0 database hash.
3. **Reload unchanged A twice.** On each load, show `invalidated` with restored
   K0 and ready=false, then one `assigned` replacement before any V2 docking.
   Start/keep Node running and dock once per load. Expect distinct keys K1 and
   K2 (also distinct from K0), separate owned databases with one row each, and
   unchanged prior rows/hashes. Do not save over A between loads. This single
   test covers repeated reloads **and restoration/invalidation/replacement of
   saved production state**; no duplicate restoration test is needed.
4. **Another universe B, then A again.** Load a disposable save from a different
   universe B, genuinely dock, then load unchanged A and dock. Expect a new owned
   key/database for each loaded session; all previous histories remain unchanged.
5. **Fresh new game.** Start a completely fresh disposable unsaved game. Observe
   one assignment at universe generation, with no second assignment from game
   start. Personally complete two genuine dockings. Both use the same startup
   key/database and produce two rows. There must be no premature controlled-group
   lookup/null-group errors and no duplicate saved-cue errors.
6. **Full X4 restart.** Preserve the log, fully exit X4, restart it and load
   unchanged A. The restored K0 must be invalidated/replaced, and the next genuine
   docking must use a new key/database rather than the saved K0. Check prior
   histories remain unchanged.
7. **Node absent during load.** Stop Node, load unchanged A, observe assignment
   in the raw log, then start Node and genuinely dock. Expect the new active key's
   database even though Node missed the lifecycle callbacks. No old rows are
   imported; the V2 docking itself supplies the key.
8. **Already-docked load.** Save a separate disposable copy while docked (do not
   overwrite A), then load it. Record invalidation/replacement. Loading alone
   creates no docking row or new database. Undock and genuinely dock again;
   that docking must route to the new owned database normally.
9. **Filter and V1 compatibility.** Check an AI-controlled ship's completed
   docking, including while the player is a passenger, produces no eligible
   player-controlled docking record. Personally controlled completed docking
   must still produce one V1 and one V2. Run console-only mode for a new genuine
   docking: one V1 console acknowledgement. Separately run manual `--db` with a
   fresh disposable manual file for another genuine docking: one schema-v1 row,
   unchanged manual readback. Do not count these dockings as auto-mode rows;
   auto is stopped for these checks. Check no relevant Life Signs MD/runtime
   errors, no `no_ready_session` on the valid matrix, no malformed V2 warnings
   and no duplicate assignment/acknowledgement.
10. **Independent final audit.** Stop Node (X4 and the live log are not needed).
    Read every resulting v2 database using the independent command; compare
    ownership, row counts, fields and hashes for all prior completed histories.
    Record the matrix results, reviewed/deployed SHA, X4/Node versions, canonical
    full keys, and relevant-error check in a sanitised report. Keep raw evidence
    private. The existing unsigned loose-development `.sig` warning may be
    recorded as context unless behaviour changes.

For the manual compatibility check only:

```powershell
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG'
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG' --db '.\local-data\production-routing-manual-check.db'
node .\bridge\src\read-stored-events.js --db '.\local-data\production-routing-manual-check.db'
```

Stop one mode before starting another. Use a fresh manual file after reloads.

Any repeated **complete key across actual new X4 sessions**, missing invalidation,
late replacement, duplicate assignment, noncanonical rendering, wrong database,
unexpected history changes or relevant runtime errors fails this matrix. Stop and
report the observed contradiction; do not repair a key, add suffixes, retry draws
or substitute sources. Passing verifies automatic session isolation **under the
approved practical s1 key assumption**, within the tested scenarios only.

## Validation record

The implementation is on a separate branch from PR #10's merged baseline
`d42a06259ca425d140bfd26ae5449f90c04e487f`. Existing optional diagnostic scripts
remain unchanged. The changed production probe validates against installed
X4 9.00 `md.xsd` and `common.xsd`; their MD5 values match the installed 08.cat
entries recorded by the source prerequisite. This checks XML structure, not
clock/key rendering or live callback behaviour.

Automated results are recorded in [TESTING.md](../TESTING.md). **No production
live acceptance result is claimed.** Leave the implementation PR unmerged for
review and owner-run verification.
