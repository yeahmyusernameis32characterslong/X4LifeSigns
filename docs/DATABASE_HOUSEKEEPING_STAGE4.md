# Stage 4: disposable backup, pruning and restoration

Status: implemented and verified on synthetic disposable labs; Agent accepted
the bounded contract in review `f07b5f7`, with recovery incomplete at `20cb699`.
The [separate recovery follow-up](DATABASE_HOUSEKEEPING_RECOVERY.md) addresses the
recorded inside-transaction checkpoint. PR #25 baseline `ae57b0a`;
Agent accepted the bounded Stage 3 contract in review `fc2277f`.

## Execution brief

Implement offline APIs and synthetic temporary-lab tests for verified paired
backups, stale-plan rejection, actual per-universe pruning and explicit paired
restoration. Reuse Stage 3 registration, leases, schema-v2 seals and retained
maximum-prefix union. Keep all code experimental and outside production imports,
companion packaging and the menu. No owner databases, deployment, gameplay or merge.

A backup contains the root registration/marker, catalogue and every registered
database, with exact hashes and identity/generation receipts. Validate copies and
restore on a separate disposable lab before allowing a pruning operation. Keep
previous backups. Never claim raw file copies are safe without closed writers,
sidecar refusal and the lab lease; production all-writer exclusion remains open.

Plans bind roots, source bytes and the complete registered state. A changed root
list, database, catalogue or registration invalidates a plan. Prune records,
projections and sessions with updated seals/metadata in one SQLite transaction;
retain zero-cutoff tombstones and the original schema-v2 refusal path. Preserve
all retained-root profile/event/NPC-history views, completed baseline and parent
prefixes. Support repeated narrowing and new child runs; never widen a seal or
resurrect a retired run. Whole-universe removal/quarantine and compaction deferred.

Use explicit operation phases for interrupted work. Normal opens must remain
blocked until verified completion or explicit restoration/recovery. Restore the
complete paired set, reject modified/corrupt/missing backup members, and refuse
unexpected/new destination files instead of overwriting them. Exercise failures
before/inside/after commit, stale plans, locks, cancellation, disk-full simulation,
replay after actual pruning, repeated maintenance and independent reopen.

Run focused tests while developing, the complete profiles suite and existing
bridge/recorder regression suites at completion. Check cumulative diffs, links,
privacy and installed-file isolation. Record injected failures separately from
real process termination, and neither as power-loss durability proof. Node 24
SQLite and official SQLite backup/transaction documentation are the references.
Publish incremental coherent commits and the sanitised Stage 4 report/status in
the private handoff; next owner Agent reviews. Allowance telemetry is unavailable;
use verified-unit checkpoints and leave unresolved findings explicit.

## First verified implementation unit

The new `profiles/experimental/pruning-v2.mjs` operates only on factory-created
Stage 3 lab receipts. No arbitrary database path is accepted. Plans bind the
entire registered pair and exact retained views/rows. Existing seals may narrow;
retired tombstones persist. Child runs created since the previous operation are
sealed by the next operation. A root past an existing seal is always refused.

Unique backup sets contain registration, marker, catalogue and all registered
databases. Hashes, ownership, schema, generations and inventory are verified by
restoring to a separate new lab before any pruning reservation. Closed-file
copies run under the cooperating lab lease, after an SQLite exclusive-lock probe
and with source hashes checked again. This does **not** establish exclusion of
idle/unmanaged production handles or an SQLite online backup guarantee.

Pruning updates raw records, profile/event projections, sessions, tombstones and
per-database generation in one transaction. Exact row-prefix and retained-root
profile/event/NPC-history digests are checked inside the transaction and again on
an independent connection after commit. Both retained ancestors and leaf roots
are included. The original schema-v2 file stays in place. No automatic VACUUM.

The external lab operation record blocks ordinary opens and Stage 3 recovery
until Stage 4 completes or explicit paired restoration succeeds. Restoration
first validates its backup, preserves the complete current set in a unique
rollback directory and fully stages replacement bytes. Each member replacement
is atomic; the set is not cross-file atomic. An interrupted restore accepts only
known old/backup hashes and resumes explicitly. New/foreign destination files,
changed backup members and hot/unexplained SQLite sidecars refuse unchanged.

Initial Windows/Node 24.21.0 checks: 31 focused tests pass. Includes actual
pruning, repeated maintenance/new children, paired restore, every operation-phase
exception, real child-process exit after commit/during restoration, real
SQLITE_FULL on the pruning connection using a page cap, simulated backup/staging
ENOSPC/cancellation, corrupt backups, stale plans and independent reader locks.
This is not real disk exhaustion, power-loss testing or production acceptance.

## Final verification and open gates

Windows / Node.js v24.21.0: full profiles suite **149 passed**, including **35
Stage 4 checks**; bridge **112 passed**; recorder **89 passed**. Total **350
passed**, zero failures/skips. Later checks add multiple-universe backup coverage,
post-reservation source-change refusal, transaction-lock contention and an actual
process exit inside pruning. The earlier 31-check result above identifies the
first incremental implementation unit, not the final gate.

The last case intentionally refuses: a hard exit inside the transaction can
leave a hot journal. Ordinary opens, Stage 3 recovery and Stage 4 restore remain
blocked, with database/journal/backup evidence preserved. At `20cb699` no explicit
damaged-pair recovery API existed; the separately authorised follow-up linked
above adds a checkpoint-bound API without weakening these normal checks.
Cancellation and real SQLITE_FULL exceptions
roll back and can use the paired restoration API; do not equate those with
transaction-process-crash or power-loss recovery.

Backups and rollback/staging sets remain in the lab until fixture disposal;
pruning does not promise a reduction in total disk usage. No backup purge,
compaction, orphan-universe quarantine, production adoption, menu Apply, online
backup integration or native protocol change. Paired restoration rolls the whole
registered lab back together, including its other universes and catalogue; it
preserves the replaced set separately, rather than merging newer history.

Actual owner databases/saves/logs were not opened. Installed receipt `c29bb3f`
remains unchanged: 31 companion/three UI hashes match source. No new installed-X4
schema/native validation was run because MD/Lua/XML/native/runtime packaging did
not change. The added modules remain outside production imports and manifest.
Independent Linux execution of Stage 4 is for Agent review, not claimed here.

### Technical references and evidence boundary

- [SQLite backup documentation](https://www.sqlite.org/backup.html) describes
  shared-lock copying and online backup. This lab uses closed-file copying under
  its cooperating lease plus probes/hash checks; it does not hold a continuous
  SQLite lock through copying or establish safety against unmanaged writers.
- [SQLite transactions](https://www.sqlite.org/lang_transaction.html) inform the
  one-database transaction/rollback design. Cross-file catalogue/restore phases
  are explicit and blocked during interruption, not atomically committed as a set.
- [SQLite descriptor/locking hazards](https://www.sqlite.org/howtocorrupt.html#posix_close_bug)
  inform the rule against raw file-descriptor reads/closes while a write
  transaction holds locks; an independent contender process verifies contention.
- [Node v24.21.0 SQLite API](https://github.com/nodejs/node/blob/v24.21.0/doc/api/sqlite.md)
  is the tested runtime reference. No other runtime/platform guarantee inferred.

Production registration durability, closed/manual/old-writer exclusion and
coordinated service/native replay integration remain unsolved prerequisites for
eventual owner-data cleanup. These tests do not authorise such cleanup, deployment,
gameplay, merging or any next stage. Agent reviews this bounded disposable stage.
