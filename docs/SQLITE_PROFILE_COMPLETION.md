# PR #20: SQLite integration completion

The owner accepted SQLite integration on 24 October 2026, initially closed
PR #20 without merge, and then authorised integration of PRs #18, #19 and #20
into `main`. Their ordered history is preserved; PR #17's disposable probe
remains superseded and excluded. Historical closure statements describe that
earlier decision, not an instruction to keep completed work off `main`.

The verified deployed executable snapshot is
`0010aa4f9546587ff6e9ad794bf601ae8e6896e8`. Subsequent documentation and the
integration-only test-fixture correction do not change those executable files.
This integration authorises no deployment or changes to existing databases/logs.

## Current collection behaviour

The optional recorder and Windows companion perform a completed initial baseline
when the owned universe database needs one, reuse ready databases after load,
and retain selective lightweight events and individual created-object profiles.
There is no recurring whole-faction snapshot schedule, full crew snapshot per
attack, shield/hull damage subscription, physical M-key binding or active
million/two-million-row setting in the current configuration. Earlier designs
remain historical; do not reintroduce them from PR #18/#19 prose. Existing
production docking/session databases and protocols remain separate.

## Delivered

- Station, ship, NPC and later player profile storage, with indexed event context
  and exact identifier text. Existing production docking databases remain separate.
- Universe database selection by saved Life Signs MD ID. Confirmed ready databases
  skip whole baselines on load; missing databases require a completed initial one.
- Strict contiguous ingestion, owned schema checks, transactions/readback, bounded
  native reply reading and commit acknowledgement. No false success on known gaps.
- Automatic service lifecycle, retryable reply publication and graceful shutdown.
- Mutable display-name history and saved session/checkpoint ancestry. An unsaved
  branch remains stored but is excluded from a reloaded save's selected history.
- Acknowledged load boundary, durable old-session closure and service-owned reply
  permission that survives adapter recreation. Continue, menu reload within one
  process and F9 have passing owner-tested cases.

## Verification summary

| Evidence | Verified result |
| --- | --- |
| Initial native baseline | 1 station,47ships,1,093NPCs;1,141profiles and32,594exact contiguous raw/SQL records, ready1/integrityok. Historical snapshot before player-profile addition. |
| Existing-database event runs | Saved checkpoint reuse, no repeated baseline, exact raw/SQL equality. Historical examples include197rename/order records,7,755history records and3,880reply-delivery records. |
| Player addition | Existing universe acquired a player profile; corrected native is_player and410exact contiguous records. Not every possible player transition tested natively. |
| Corrected Continue | Fresh adapter blocked then accepted current service OPEN;35exact records, prior history intact. Route explicitly clarified by owner. |
| Menu reload in one process |32+32exact records; first session closed, second history excludes its unsaved branch. |
| Quicksave/F9 |32+69exact records; saved checkpoint31 excludes unsaved rename32 while retaining current-session rename. |
| Automated recorder/profile suite | Latest applicable full run102/102PASS. |
| Separate production bridge suite | Latest full recheck112/112PASS; earlier concurrency-test failure and isolated recheck retained in handoff. |
| Lua/native and lifecycle | Actual installed Lua/native-reader fixture; real Node/SQLite with three independent Lua states; Windows watcher/restart/drain checks PASS. |
| Static/schema/install checks | Hash-checked X4 9.00 MD/UI schemas, generated freshness, diff/privacy and deployment hashes PASS. |

Counts are individual historical observations, not an aggregate coverage percentage
or a claim that every event/getter combination works in X4. No new regression or
gameplay run was performed solely to close the PR; executable code is unchanged
from the last verified snapshot.

The private `sqlite-profiles/SQLITE_PROFILES_CODEX_SQL_TEST_RESULTS.md` consolidates
test definitions, repeatable commands, results, revisions and earlier failures.
Raw logs, saves, databases, model journals and machine paths stay local; the
handoff contains sanitised summaries and evidence pointers, not those artefacts.

## Follow-ups preserved beyond this objective

- Control-debuglog reset caused a recoverable startup worker exit in earlier
  launches; the last F9 launch was clean. Reliability follow-up remains open.
- Tested route coverage is not universal proof of every queued MD callback or
  save/load interleaving. Raw restoration noise can remain outside accepted SQL.
- Native coverage of every new-object, personnel, station rename and player
  transition path is not established by the automated tests or these owner runs.
- Retained branches have no automatic pruning. Save inventory/retention design,
  cleanup implementation and deletion require their own scope and verification.
- Game slowdown remains parked; voice/local-dialogue work is not this objective.

No merge, database repair/pruning, game launch or new deployment accompanies
closeout. Existing installations, logs, history, prior failed-run evidence and
the source branch are preserved.

See the [original test plan](SQLITE_PROFILE_TEST_PLAN.md),
[load-boundary findings](LUA_LOAD_FENCE_PLAN.md) and
[route test procedure](LUA_LOAD_FENCE_TEST.md) for the detailed progression.
