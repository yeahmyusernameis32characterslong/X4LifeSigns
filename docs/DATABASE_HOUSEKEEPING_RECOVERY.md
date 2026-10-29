# Disposable interrupted-prune recovery follow-up

Status: owner approved after Agent review `f07b5f7`; implementation in progress.
PR #25 baseline `20cb699`. No real databases, deployment, gameplay or merge.

## Execution brief

Close the demonstrated inside-transaction process-exit recovery gap on synthetic
factory-created labs. Implement a separate explicit recovery API that validates
the original registration/operation and full pre-operation backup, preserves the
damaged database and matching journal together, and restores the verified paired
set. Keep normal sidecar refusal unchanged. No repair of the original with SQLite,
automatic journal deletion, production adoption or implicit normal-open recovery.

Bind a recovery checkpoint to the exact rollback journal created by the known
transaction, after ownership and source validation. Unknown/missing/mismatched
ownership, journal, backup or operation still refuses. Preserve immutable forensic
copies before changing any active member. Fully stage backup replacements before
evacuating the known journal; keep its original alongside the preserved evidence.
Retain the database's routed path through atomic replacement. Normal opens stay
blocked throughout the multi-file operation; every resumed member must match the
recorded damaged or verified backup bytes. Cooperating laboratory writers are
excluded by the existing lease, not a claimed production all-writer barrier.

Test actual process exit inside pruning and during each declared recovery phase,
repeated interrupted resume, exact paired readback/retained views and forensic
preservation. Unknown sidecars, missing registration, corrupt receipts/backups,
changed damaged/staged/evidence members and live leases must refuse unchanged.
Run the full profiles regression suite and documentation/diff/privacy/installed
isolation checks. No MD/Lua/native changes or installed-schema tests anticipated.
Commit verified units incrementally, publish a sanitised private recovery report,
and return ownership to Agent for review. Allowance visibility unavailable; use
verified-unit checkpoints rather than claiming remaining percentages.

## Design boundary

Recovery uses a recorded, exact journal checkpoint. An arbitrary crash before
that checkpoint, or a sidecar that differs afterward, remains a refusal case.
Tests of this supported checkpoint are not proof of recovery from every crash or
power loss. SQLite documents that the damaged database and journal form a pair;
moving/deleting the journal alone defeats SQLite's original recovery path. This
API retains that pair and uses the independently verified backup for active state.

References: [SQLite corruption and journal pairing](https://sqlite.org/howtocorrupt.html),
[rollback journals and locking](https://sqlite.org/lockingv3.html),
[Stage 4 backup/pruning contract](DATABASE_HOUSEKEEPING_STAGE4.md).

## First verified implementation unit

The separate `profiles/experimental/recovery-v2.mjs` API restores a known
interrupted prune checkpoint. `pruning-v2.mjs` records the creating process,
database/journal file identities, journal hash and operation digest before the
existing `PRUNE_TRANSACTION` hook. The journal is read separately; no raw database
descriptor is opened/closed while SQLite holds the write transaction lock.

Recovery requires the checkpoint owner to be dead and acquires the cooperating
lab lease. It verifies registration, backup/plan binding, the pending catalogue
operation, marker, exact journal and unaffected registered files. The damaged
database is never opened with SQLite. The complete observed set, with database
and journal at their original relative names, is copied and verified in a unique
evidence directory. All backup replacements are staged before the operation moves
to `RECOVERING`. The original journal is then preserved separately in that evidence
directory; the complete damaged pair copy remains unchanged. Backup members are
atomically replaced while the ordinary-open barrier remains raised.

Explicit resume verifies evidence, backup, staging, active-member hashes and the
original-or-preserved journal location. Repeated successful resume is idempotent
while the restored pair is unchanged. No damaged file or recovery copy is purged.
Interruptions before `RECOVERING` leave active files unchanged and require a new
explicit recovery attempt; their partial evidence/staging directories remain.

Initial Windows/Node v24.21.0: **22 focused tests pass**. Real child processes exit
inside pruning with cache spilling enabled, producing changed database bytes and
a matching rollback journal. Exact backup readback and retained NPC/profile/event
views match after recovery. Real exits at all declared recovery boundaries and
repeated exits during resume pass. Unknown/missing/changed journals, identities,
registration, catalogue, marker, backup, active files, evidence and staging refuse;
live lease/checkpoint owners cannot be stolen. Full regression gate pending.
