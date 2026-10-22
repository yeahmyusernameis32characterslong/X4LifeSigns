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
