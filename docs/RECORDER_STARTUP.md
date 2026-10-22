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
