# Recorder startup safeguards

## Approved task and implementation plan

The owner approved correcting the startup sequence after the investigation of
`577d36e` on draft PR20. Implement and check the optional recorder; deployment
and native acceptance are separate. Preserve universe identity, saved checkpoint,
database ancestry, event scope and existing installations.

The native fault was restored NPC callbacks reaching missing history state before
the new run boundary. New group listeners also registered against absent groups.
The current run later committed all 7,755 records correctly. A synthetic action
reproduction shows that a table-presence guard prevents missing-table access but
does not identify a fresh session when saved tables already exist.

Plan:

1. Add shared defensive readiness checks before event work and file writes;
   history helpers must safely reject absent state even when called directly.
2. Prepare all run state, history tables and groups before publishing readiness.
   Replace the previous saved listener bus with an explicitly started bus, retain
   a retirement/migration path, and invalidate on the supported load callback.
3. Test older missing state, complete saved state, partial initialisation,
   retirement, stale replies/signals and normal event/SQLite continuity.
4. Regenerate MD, run Node/bridge tests, installed X4 9.00 schema validation and
   the existing native-reader/Lua fixture. Publish sanitised results and limits.

The schema does not guarantee that `event_game_loaded` precedes every restored
NPC callback; the latest native log demonstrates callbacks before that boundary.
Do not claim complete repeated-load isolation merely from saved flags, a version
patch or a delay. An earlier boundary or runtime gate needs source evidence and
native validation. Legitimate events before capture readiness need an explicit
coverage boundary, not an assertion of complete capture. No game slowdown or
pause is part of this correction.

## Implemented safeguards

The recorder closes readiness and pending work on its load callback and universe
boundary. `Initialize` prepares queues, tables, watch groups and run metadata
before publishing ready and writing `RUN_BEGIN`. It then arms the current run
and sends an ordinary deferred cue signal. `ProfileEventBusV2` consumes that
arming marker before enabling its children. No fixed delay is used as proof of
readiness.

The former `ProfileEventBus` and all former `ProfileEvent0` through
`ProfileEvent47` names remain inactive in their original tree. New children use
`ProfileEventV2_0` through `ProfileEventV2_47`. Migration patches cover waiting,
active, complete and cancelled older cue states; they preserve `UniverseIdentity`
and its checkpoint. Resetting the old tree cleans up its instances.

This follows the refresh/tree and cleanup rules in Egosoft's
[Mission Director Guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/).
Installed 9.00 schemas remain the feature-specific validation source. In that
schema, deferred `signal_cue` cannot carry a parameter; the one-use arming marker
supplies the run check. `check=false` is not used to conceal a missing listener.

Event handlers reject absent or incomplete startup state before accessing
history. `HistoryIdentity` independently returns an unresolved identity without
reading or writing a missing cache. The final writer rejects an invalid run
before advancing ordinals. Processing waits for the listener gate as well.
There are no service reads, object scans or new text conversions per event.
Existing baseline, individual profile and event payloads remain supported.

`RUN_BEGIN` declares `startup_protocol=STAGED_V1` and
`early_restore_coverage=UNVERIFIED`. At INFO/DEBUG the diagnostic log records
`LISTENER_BOOTSTRAP_READY` when the listener parent enables its children.
Capture rejected before readiness is not buffered or replayed; complete coverage
of legitimate early events is not claimed.

## Known remaining limitation

**This is a partial correction, not a verified fresh-runtime barrier.** An older
save without the new startup state is rejected safely. After the supported load
invalidation, complete saved state is also rejected until the new run is ready.
However, a newer save can contain every current ready flag and table. A callback
delivered before invalidation can still pass those checks and target the old
raw file. A regression deliberately demonstrates this remaining counterexample.
The existing SQL old-file filter remains important, and is not relaxed.

Native verification must establish actual callback/refresh ordering for the
new tree on first upgrade, subsequent same-process reloads and separate launches.
A reliable earlier invalidation or nonpersistent runtime gate remains open.
There is no claim that passing the generated-action harness proves this ordering.
No deployment or live test is part of this implementation task.

## Automated verification

The generated-action regressions exercise old missing state, staged readiness,
wrong-run arming, complete state after invalidation, direct helper safety,
retirement/migration and the remaining pre-invalidation counterexample. The real
SQLite handshake regression still verifies database reuse and saved ancestry.
Run `node --test recorder/test/*.test.mjs profiles/test/*.test.mjs` and
`npm.cmd --prefix bridge test`, then the installed MD/addon and native-reader/Lua
checks described in the project testing workflow. Native timing and performance
remain separate owner-run gates.

## Follow-up investigation: reload within one X4 process

Owner-authorised research on 23 October 2026 reproduced two additional limits
against `e2472b4`, using disposable synthetic data only:

- The consumer filters by file creation time since **X4 process start**, not
  since each save load. A log created during that process remains eligible.
  A synthetic stale callback with the next contiguous ordinal is accepted into
  the old session; a conflicting ordinal is rejected and prior SQL is preserved.
  A subsequent valid run still opens at its explicitly supplied saved checkpoint.
- In the generated-action harness, complete restored ready state accepts stale
  callbacks before invalidation. After they advance the old record counter, an
  old-run acknowledgement can pass `DatabaseReply` and advance the identity
  checkpoint. Actual native ordering of that acknowledgement is **unverified**.

These do not invalidate the verified separate-launch SQL comparisons. They do
mean the existing launch filter is not a general save-load barrier. A correction
must prevent stale writes **and** stale acknowledgement/checkpoint updates;
additional saved flags or a version patch alone do not establish freshness.
Qwen is investigating an earlier lifecycle boundary or nonpersistent runtime
check. No implementation, deployment, database repair or new live test is part
of this research checkpoint. Existing raw evidence and SQL history are preserved.

### Source-supported candidate and next evidence gate

Qwen independently located an earlier UI route in installed X4 9.00:
`ui/addons/ego_gameoptions/gameoptions.lua:408` registers `loadSave`;
2956-2964 handles that request and schedules `LoadGame(filename)`.
The normal menu path at8022-8046 schedules the same call directly, and
8050-8064 routes Continue through that menu path. Observing only `loadSave`
therefore does not establish coverage of all these call sites, let alone F9.
Codex verified the cited source locations. This establishes candidate call
sites, not that the optional detailmonitor addon can safely intercept them.

`ui/core/lua/loading.lua:240` registers a loading-completion event, and269
reads a value named loadCount. Neither proves a monotonic per-load identity,
optional-addon accessibility or ordering before restored MD callbacks.
A process-only marker also cannot distinguish reloads in the same process.
No synchronously readable MD-to-Lua freshness contract was established.

Proposed next step: verify optional-addon access and lifecycle context, then
prepare a bounded observational diagnostic of the actual load invocation and
runtime generation against the first restored callback, write and ACK. Include
fresh launch, normal load, Continue, same-process reload and quickload, plus
cancelled/failed load behaviour. Pass only if every covered load changes or
closes runtime permission before stale writes/checkpoint updates, and reopens
for the matching new run. Resetting a saved MD flag before restoration is not
sufficient: restoration can overwrite it. Keep early-event coverage explicit.

The proposed correction would use runtime-owned permission for each load,
protecting both file writes and reply/checkpoint acceptance. How MD accesses
that permission remains an open design dependency. Moving all writes through
a runtime-owned bridge would be a larger alternative, not an approved change.
Do not add per-event disk reads or UI traffic to compensate for an unproved gate.
No implementation or deployment follows from these source findings alone.

### Conditional-deployment investigation: evidence assessment

The owner subsequently authorised further investigation and implementation/
deployment **if strong evidence supports a solution**. That condition has not
been met by the source evidence below. No recorder implementation or installation
was changed in this investigation.

| Option | Established evidence | Remaining deployment dependency |
| --- | --- | --- |
| Direct MD runtime marker | Existing saved flags, cue versions and process-only markers cannot identify every reload. No suitable getter was established in the scoped investigation. | A documented synchronously readable value that distinguishes every load; this is not a global API-absence finding. |
| UI load-start observer and runtime permission | The two source-shown pre-LoadGame routes exist. | Optional-addon visibility, quickload/other route coverage, and an enforceable check covering both writes and acknowledgements. |
| Deferred listener actions and acknowledgements | MD supports delayed actions and cancelling/resetting cue instances. | Ordering of restored active/due delays versus load notifications, unchanged event facts, queue/instance cost and checkpoint protection. |

The [official Mission Director Guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
describes delayed actions and refresh of saved cue state; it does not establish
the required restoration-order guarantee. Installed9.00 md.xsd1680-1688 and
4687-4695 support the delay mechanism. Its cancel/reset contracts at2520-2530
and3241-3251 take effect after the executing action block. Neither schema
validity nor a simulated scheduler proves actual loading order.

Delaying object getters could lose transient destruction/assignment facts.
Although the documented event keyword has no time member in
scriptproperties.xml3204-3210, cue.time at2198 exposes activation time and is a
possible way to retain the timestamp. This improves the candidate; it does not
resolve restoration ordering or preserve every other mutable field.
The event_npc_created element is in md.xsd2068-2077, not common.xsd. It exposes
the NPC actor; its eventcondition/condition attribute groups add no documented
load-origin filter. A failed search in the wrong file is not evidence.

Before implementing the deferred option, an isolated native diagnostic must
exercise waiting cues receiving restoration events, already-active saved delay
instances, due timers, old replies and cancelled instances. It must show no old
write or checkpoint advance, exact retained event time/facts and bounded cost,
then demonstrate normal new-run capture. Cover fresh process and same-process
menu/Continue/quickload routes, cancellation/failure, paused gameplay and a
save with pending work. The test must observe the proposed mechanism, not merely
repeat the already verified fact that current load notifications are late.
A runtime-check diagnostic must additionally prove access and route coverage.

This is a source-assessed proposal, not a deployed fix or native validation.
Existing separate-launch continuity findings remain valid. No database repair,
replay relaxation, slowdown, recurring baseline or production change is implied.

### Lua and external service handshake proof

Subsequent owner-requested work with Qwen established a concrete
[load-boundary implementation plan](LUA_LOAD_FENCE_PLAN.md). A disposable proof
passed with real SQLite, the installed Lua runtime and the unchanged native
reader: durable old-session closure precedes a matching acknowledgement; stale
replies cannot dispatch the simulated load; restart/replay and ordinal checks
pass. This is protocol feasibility, not production integration or native load
coverage. F9/global interception, asynchronous menu handling and already queued
MD acknowledgements remain explicit deployment dependencies. No installation or
production database was changed.

### Experimental implementation

The owner subsequently approved implementation and test instructions. Commit
`0d367c1` integrates the Lua load holder and durable external closure ledger;
the [implementation plan](LUA_LOAD_FENCE_PLAN.md) now records the actual protocol
and limits. See the [staged owner test](LUA_LOAD_FENCE_TEST.md) before any launch.
Automated service/Lua tests pass; F9/global visibility and already queued MD
acknowledgements still require native acceptance. Implementation is not deployment.
