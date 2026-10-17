# Broad native recorder implementation

Baseline: owner-approved PR #18 commit
`6553cf973430ba533ba9f66b42d10d83c53981ba`. The owner authorised code,
automated/static checks and a separate draft implementation PR. Deployment,
gameplay testing and merge require separate approval.

## Implementation plan

1. Package an optional `lifesigns_event_recorder` extension independently of
   the production bridge. Generate its MD listeners from an explicit typed
   event catalogue, verifying each selector against installed X4 9.00 sources.
   Start broadly with global player-owned and safe group-scoped events;
   expand the catalogue without waiting for full event discovery.
2. Initialise after playable-universe readiness, rebuild owned-property
   membership on load and periodically, and read the production session key
   only when its existing readiness gate permits. Retain raw event parameters
   promptly in instance-local variables. Add guarded affected-object EVENT
   snapshots and scheduled faction-wide PERIODIC/requested snapshots.
3. Write separate native event and diagnostic streams. Support configurable
   OFF/ERROR/WARNING/INFO/DEBUG with genuine OFF, recorder-observed counters,
   explicit resource-limit/gap markers and no claim of confirmed disk writes.
   Preserve overlapping events. Keep all source logs and derived analysis local.
4. Research the independently optional Hotkeys extension input path. Implement
   source-supported signals and M5 snapshot handling in the recorder; report
   an unresolved binding mechanism rather than inventing native M-key support.
5. Test generated output, serialization and parsing with synthetic values,
   validate generated MD against the installed schemas, and check production
   isolation, documentation and privacy. Publish incremental commits, a draft
   PR and a sanitised private implementation report with remaining live gates.

## Status

Implementation in progress. No live deployment or X4 validation has occurred.
The completed implementation, configuration, commands and limits will be
recorded here as coherent units pass their checks.
