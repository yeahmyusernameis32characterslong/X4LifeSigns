# Stage 3: offline replay and maintenance contract

Status: owner-approved, in progress. Baseline `b935d56`; PR #25 remains draft.
Stage 2 acceptance does not establish a destructive maintenance barrier.

## Execution brief

Build a schema-v2 replay/maintenance prototype under `profiles/experimental/`,
with automated synthetic/disposable-copy tests. Keep it out of the companion
manifest and all production store/service/watcher/menu imports. No owner data,
deployment, gameplay, pruning, quarantine, compaction or merge.

The prototype must preserve every retained save's maximum-prefix ancestor union,
exact payloads/ordinals, profiles, events and NPC-history views. Historical run
IDs receive sealed cutoffs or zero-cutoff retirement markers. Exact retained
replay is recognised separately from archived tail replay; neither may advance a
READY acknowledgement beyond the cutoff. New child runs use existing retained
parents; retired/missing/future parents require restoration rather than baseline
recreation. Schema-v1 files and production behaviour remain unchanged.

## Registration and recovery decisions to verify

- Only a factory-created temporary lab and its fixture source copies are writable.
  Reopening requires its explicit registration receipt and separate anchor.
- Bootstrap is explicit and exclusive. Missing marker/catalogue after READY means
  recovery required, including loss of both while registration remains. Loss of
  every independent registration cannot be inferred from absence alone.
- Catalogue reservation, per-database transaction, marker publication and
  completion have explicit phases; no cross-file atomicity is claimed.
  Interrupted operations block writers until explicit verified recovery.
- Keep the original routed v2 database as the retirement refusal object. No
  quarantine or path removal. Prove that an unmodified v1 constructor refuses
  it, and separately demonstrate the unsafe missing-path baseline recreation.
- An old connection already open before a version bump is not revoked by that
  bump. The lab lease only coordinates prototype callers. Full production
  writer/load exclusion remains a separate future gate.

## Evidence gates

Require tests for source-copy preservation, exact views at every retained root,
branch/overwritten-ancestor preservation, conflicting replay, retained/archived
classification, retired-run non-recreation, new child ancestry, invalid roots
and mid-profile cuts, missing/corrupt/mismatched catalogue/marker/anchor, phase
interruption/recovery, old-writer refusal and lease contention. Record process
restart results separately from power-loss durability, which is not established
by ordinary tests. Run the relevant regression suites and publish a sanitised
report for Agent review. No new X4 schema validation is needed unless game files
change.

References: the [implementation design](DATABASE_HOUSEKEEPING_IMPLEMENTATION_DESIGN.md),
[retention policy](DATABASE_HOUSEKEEPING_RETENTION_DESIGN.md),
[SQLite transaction boundaries](https://www.sqlite.org/lang_transaction.html),
and [application/user version pragmas](https://www.sqlite.org/pragma.html).
SQLite's application-set user_version is an identification field; enforcement
comes from the validated store contract.
