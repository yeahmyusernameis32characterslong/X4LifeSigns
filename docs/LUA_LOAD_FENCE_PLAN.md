# Lua load boundary and external session closure

Status: owner normal-load retest of deployed `0010aa4` passed the adapter
recreation gate on 24 October 2026. Automated checks and normal-route evidence
agree. Same-process/F9/queued-ACK coverage remains unverified; startup retry noted.
Owner explicitly approved implementation after the protocol proof at `4328f13`.
See [startup evidence](RECORDER_STARTUP.md) and the
[staged owner test](LUA_LOAD_FENCE_TEST.md).

## Goal and proposed sequence

### First native result and continuation

Normal Load Game produced HOOK_INSTALLED, matching PREPARE and DISPATCH markers
about0.41 seconds apart. The external ledger rotated its challenge and the
service published matching OPEN for the new run. Thirty-four contiguous raw/SQL
rows, one rename, no whole snapshot and clean shutdown were verified. All prior
SQL rows remained unchanged; old raw restoration noise still appeared as expected.
This fresh process had no eligible current-process old run to seal, so an empty
closure list is not evidence for same-process closure.

However, HOOK_INSTALLED appeared again with the UI clock reset after loading,
and NEW_RUN_ACCEPTED did not appear. The adapter chunk recreates its local load
table with blocked=false. Its post-load inhibition therefore does not survive
the observed adapter recreation. Normal capture succeeding does not prove the
OPEN gate protected replies. Already queued MD ACKs remain a separate open risk.

This initially held further Continue/reload/F9 acceptance tests. The correction
below addresses adapter recreation; actual queued-MD-ACK ordering still needs
explicit native evidence. The historical first run is not retroactively a pass.

### Correction: permission survives interpreter replacement

Every adapter instance starts blocked. Before forwarding a database reply it
reads the current service CHALLENGE and OPEN files and requires agreement on
run, universe and generation token. A previously successful local boolean or
cached token never authorises a later attempt. Missing/malformed/mismatched
controls block forwarding; restoring valid service permission allows normal
operation. Pending-load/timeout/error states still prohibit forwarding.

The existing service already rotates CHALLENGE before acknowledging a load, so
an old OPEN is invalid even when its ordinary READY file remains readable. The
same rule applies to a completely new Lua interpreter with no pre-load memory.
No protocol/DLL/schema change is needed. Two additional small read-only control
reads occur within the existing250ms status poll; no gameplay-event I/O is added.
The local permission string only deduplicates diagnostic markers, not authority.

`profiles/test/load_permission_lua_test.py` runs the actual Node/SQLite service,
existing native reader and three separately created/destroyed Lua states. Before
the correction it failed because recreated Lua forwarded stale READY. With the
correction it passes: NEED_BASELINE->READY startup, matching current OPEN,
restored old request rejection, malformed/missing/wrong-generation controls,
permission revocation after an earlier success, reply deduplication and unchanged
sealed-session SQL. It never launches X4 or writes installation/gameplay data.

This fixes the demonstrated local-state bypass in automated integration. It does
not retract an MD callback already queued, establish an atomic cross-process
check/send transaction or prove unhooked F9 coverage. Repeat the first ordinary
owner load on the corrected verified installation before extending route tests.

### Corrected normal-load native result

The recreated adapter now emitted SESSION_PERMISSION_BLOCKED followed by
NEW_RUN_ACCEPTED, matching the service OPEN and rotated challenge. PREPARE and
matching DISPATCH were about0.11 seconds apart. All35current raw records exactly
match contiguous SQL payloads; one fresh rename, no whole snapshot, expected
saved parent checkpoint retained, prior SQL unchanged and integrityok.
Thirty retained raw profile logs had no appended rows in this run; this is an
observation, not a guarantee that restoration cannot append raw noise.

The first worker exited about1.13seconds after process start with the generic
LogTail error "Per-run profile log truncated". No current-process profile log
existed until about71.98seconds, so the truncated input was the control debuglog
(inference from timing/eligible inputs). Automatic restart recovered before the
load handshake; replacement worker stderr was empty and final shutdown exit0.
Do not describe the entire startup as error-free. Review control-log reset
handling separately; this native pass covers adapter recreation on normal load,
not same-process closure, F9 or already queued MD callback ordering.

Make the external service stop accepting the previous session **before** Lua
invokes the actual save load. Computer timestamps alone cannot establish this
ordering for reloads within the same X4 process.

1. The service publishes a fresh, durable, single-use challenge through a
   separate control reply. Lua reads it through the existing bounded reader.
2. On a covered load invocation, Lua holds the original call and its arguments,
   stops forwarding ordinary database acknowledgements, and sends one load
   preparation request containing the challenge through the diagnostic log.
3. The service finishes valid pending old-session ingestion, durably closes
   acceptance of the known old run/log identities, suppresses old reply
   publication, rotates the challenge and then acknowledges that exact request.
4. Lua polls only while a load is pending. Only a matching acknowledgement
   permits the original call, exactly once. A stale reply, timeout, service
   absence or cancellation must never silently perform an unfenced load.
5. The next session opens through the existing validated RUN_BEGIN, universe ID,
   saved parent checkpoint and strict ordinal rules. Raw restoration noise may
   remain in an old log; the closed session cannot import it into SQLite.

The service owns acceptance. The challenge is an ordering/correlation token,
not a new universe identifier or authentication mechanism. No schema migration,
entity identity change, timestamp heuristic, per-event disk read, damage-event
capture or repeated whole snapshot is proposed.

## Verified source constraints

Installed X4 9.00 readable source, independently checked after Qwen research:

| Source | Finding and limit |
| --- | --- |
| `ui/addons/ego_gameoptions/gameoptions.lua:408,2956-2965` | Registers loadSave and defers the global LoadGame call. A loadSave listener alone misses direct callers. |
| Same file,8022-8065 | Normal load and start-menu Continue reach the same global call. This does not establish F9 coverage or safe replacement of that global from our addon. |
| Game-options ui.xml and the recorder ui.xml | Both use the menus environment. Actual global visibility, mutability and lifetime still need native verification. |
| `ui/addons/ego_detailmonitorhelper/helper.lua:940-955` | The delayed helper releases input immediately after its callback returns. An asynchronous wrapper would return before loading; it cannot assume input stays blocked until acknowledgement. |
| `profiles/native/lifesigns_status.cpp:39-58,115-123` | The existing bounded reader accepts canonical reply filenames and a single printable LSDB1 line. Control replies need no new reader ABI or DLL. Application parsers must separate control from normal database acknowledgements. |

No source proof was found for F9 in the scoped readable files. A failed search
does not prove that route is absent. Qwen's recommendation to change the reader
was unnecessary; its input-blocking assumption was rejected after source review.

## Disposable proof results

Synthetic data only; no gameplay load, production database write or installed
file change. The external model uses the real ProfileConsumer/SQLite modules;
the client model uses X4's installed Lua runtime and an unchanged copy of the
existing native reader, with a simulated LoadGame function.

| Check | Result |
| --- | --- |
| Drain a legitimate old row before closure | Accepted; old session retains eight rows. |
| Contiguous stale row after closure | Rejected before consumer ingestion; old session remains unchanged. |
| Matching new session and saved checkpoint | Two new rows accepted; old-session future events excluded from inherited view. |
| Failure before closure persistence | No acknowledgement published. |
| Process restart after persistence but before reply | Closure restored and acknowledgement reconstructed. This is not a power-loss durability proof. |
| Replay of an already acknowledged request | Idempotent; cannot close the new session. |
| Strict ordinal gap | Still rejected by the existing store. |
| Real native reader and normal profile parser | Control reply readable; ordinary profile parser rejects it. |
| Stale acknowledgement / exact acknowledgement | No simulated load for stale reply; matching reply loads once, preserving arguments including nil. |
| Timeout, cancellation, absent reader, original-call error | No automatic fallback or retry. |

Those original proof results remain separate from the implementation checks.
The implementation now allocates canonical year-2000 control reply filenames
with nonce pairs 0/1, 0/2 and 0/3 for CHALLENGE, FENCED and OPEN respectively;
the service rejects those reserved names as profile runs. OPEN binds the new run,
universe and rotated challenge before Lua resumes normal reply forwarding.
The durable closure ledger is `local-data/profile-load-fence-v1.json`, outside
universe databases. It retains closed run IDs across launches and bounds history
at 10,000 entries; reaching capacity fails closed and requires reviewed maintenance.
It is not a database migration or a general multiple-service lock.

The service scans control before profiles, drains a fixed file-size boundary in
bounded chunks, closes known sessions durably, suppresses pending old replies,
then publishes the exact ACK. Restart reuses the challenge within a process and
rotates it on a new process start. Replayed old intents cannot close a new run.
Closed raw logs are preserved and skipped. The installer now requires an explicit
debuglog path and pins the new service module with its other companion files.

Lua wraps a visible global LoadGame and holds arguments until ACK, polling at
most every 100ms while pending. Normal profile polling remains 250ms. It blocks
duplicate load requests, times out after 15 UI-clock seconds, never falls back
to an unfenced load and diagnoses missing/replaced hooks. Calls are asynchronous;
known source callers ignore return values, but arbitrary callers are unverified.
No global input setter is added: other menu controls remain interactive. During
the short wait the test operator must not start another operation. Timeout/error
requires exiting X4; this build does not silently reopen the closed old run.
Where MD is active, failure requests a centred help panel. A main-menu failure
may have no panel; debuglog records the reason. This UX limit is explicit.

Real-service tests now cover old-row rejection, pending valid-row drain, control
backlog, worker restart/replay, ledger/publication failure, ordinal enforcement
and filename/run consistency. The actual Lua/native adapter test additionally
covers challenge rotation, OPEN matching, duplicate/timeout/original-error paths.
These do not prove native hook coverage or remove already queued MD callbacks.

## Smallest implementation and acceptance plan

1. Verify addon access to LoadGame and every intended load route, preserving
   actual argument/return semantics and other wrappers. Observe fresh-process
   load, Continue, same-process menu reload and F9; include failed/cancelled load.
2. Trace acknowledgements already queued before the boundary. Blocking future
   Lua forwarding does not remove an already queued MD callback. Demonstrate
   protection of the saved checkpoint, or add a separately verified mechanism
   before claiming the complete defect fixed.
3. Integrate a bounded control-log reader and durable service-owned closure
   ledger. Validate its ownership/version, atomic recovery, known run/log scope,
   replay handling and reply suppression. Never derive old-session authority
   from request-supplied arbitrary paths or IDs. Keep normal profile validation.
4. Integrate the asynchronous Lua holder with explicit duplicate, cancellation,
   timeout and visible failure behaviour. Resolve UI input ownership rather than
   relying on the delayed helper. Never busy-wait on the game thread. Define
   recovery after a closed session's load fails without reopening it implicitly.
5. Run targeted Node, bridge/Lua/native protocol and recovery tests, documentation
   and privacy checks. Validate generated MD against installed X4 9.00 if MD
   changes are necessary. Then use owner-run X4 evidence for route coverage,
   ordering, normal event continuity and checkpoint protection before promotion.

The owner explicitly approved implementing and deploying the adapter correction.
Verify its installation receipt before another owner run. Native route coverage
and queued-ACK checkpoint safety remain experimental acceptance gates; do not
report the complete startup defect fixed. No Codex gameplay launch or merge.
Slowdown remains parked.
