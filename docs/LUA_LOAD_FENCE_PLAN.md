# Lua load boundary and external session closure

Status: source-backed design with a passing disposable protocol proof,
23 October 2026. Not integrated, deployed or verified inside X4.
Baseline: `4e894da`, draft PR #20. See [startup evidence](RECORDER_STARTUP.md).

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

The model uses reserved fixture filenames and a synthetic control namespace.
These are not final production protocol allocations. Log parsing, installed
service integration, session inventory, interprocess ownership and menu input
handling were not tested end to end. Proof code/evidence remains ignored local
research material, indexed through the private handoff.

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

The owner approved this investigation and previously allowed implementation and
deployment when supported by strong evidence. Core protocol feasibility is now
demonstrated; actual interception coverage and queued-ACK safety remain the
deployment dependencies. No speculative installation or Codex gameplay launch
is implied. Slowdown remains parked; existing production history is preserved.
