# Lua load boundary and external session closure

Status: experimental implementation added at `0d367c1`, 23 October 2026;
automated integration checks pass. Not deployed or verified inside X4.
Owner explicitly approved implementation after the protocol proof at `4328f13`.
See [startup evidence](RECORDER_STARTUP.md) and the
[staged owner test](LUA_LOAD_FENCE_TEST.md).

## Goal and proposed sequence

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

The owner approved implementation and test instructions after reviewing the
proof. Earlier conditional deployment permission is retained. No deployment or
Codex gameplay launch was performed for this implementation task. Native hook
coverage and queued-ACK checkpoint safety remain experimental acceptance gates;
do not report the complete startup defect fixed. Slowdown remains parked.
