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
