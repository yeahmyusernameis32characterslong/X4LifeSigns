# Stage 3: offline replay and maintenance contract

Status: implemented and verified offline on synthetic temporary copies; Agent
review pending. Baseline `b935d56`; PR #25 remains draft. No production wiring.
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

## Implemented contract

The experimental modules are [maintenance-v2](../profiles/experimental/maintenance-v2.mjs)
and [replay-v2](../profiles/experimental/replay-v2.mjs). Importing them creates
nothing. Only `createLab()` allocates a new, exclusive temporary workspace.
`openLab(receipt)` requires its existing registration, validates fixed paths,
and never bootstraps a missing registered root. The registration anchor is
outside the managed subdirectory; it is not a claim of independently durable
production storage. A live lease cannot be stolen or timed out. Explicit recovery
may reclaim an owned lease only when its recorded process no longer exists.

The lab copies ready schema-v1 fixtures from its own source subdirectory into a
managed routed path. It never accepts an owner database path as a migration
argument. Files are bounded to 64 MiB and roots to 10,000 for this prototype.
Schemas/application IDs are checked exactly; unexpected journals/WAL, links,
registration identities, generations, files or operation digests block access.

### Version and replay

Schema-v2 retains the profile application ID and all existing table contents.
It adds `maintenance_metadata`, `sealed_runs` and two insert guards. Metadata
binds registration IDs, operation generation, manifest digest and retirement.
The manifest identifies contract `LS_PROFILE_MAINTENANCE_V2_LAB1`, policy
`MAX_PREFIX_UNION_V1`, exact synthetic roots/root digest, source digest and every
historical run's retained cutoff. No session parent pointers or payloads change.

| Input | Prototype result |
| --- | --- |
| Exact replay at/below a sealed cutoff | Verify exact stored payload; report SEALED_REPLAY, not READY |
| Historical replay above cutoff | Count separately as archived; do not insert or acknowledge a later cursor |
| Wholly retired run | Zero-cutoff tombstone; RETIRED_REPLAY; append/session recreation refused even when disposable raw/session rows are absent |
| Fresh run from retained parent | Normal contiguous ingestion/projections, with exact parent cutoff and completed-baseline ancestry |
| Missing, retired, future or unsupported parent/root | Refuse; no implicit baseline or restoration |
| Retired universe | Keep original v2 file, refuse prototype writer opens; no quarantine or disk-space claim |

The adapter reuses existing ingest/read-view logic while enforcing the lab lease
and retained ancestry. SQL guards independently prevent sealed inserts and
parents beyond a sealed cutoff. The separate replay classification is an offline
consumer contract, not a new native LSDB1 acknowledgement or service integration.

### Catalogue phases

Bootstrap records BOOTSTRAP registration, creates/verifies the catalogue and
marker, then publishes READY registration. Explicit bootstrap recovery requires
an empty managed inventory and matching generation-zero state; it does not
overwrite unexplained files. Once READY, missing registration/catalogue/marker
is a refusal, even if both catalogue and marker disappear. There is no automatic
reconstruction or first-run fallback for an existing receipt.

| Operation phase | Recorded evidence / recovery outcome |
| --- | --- |
| Reservation | Catalogue PREPARED with manifest and incremented generation; normal opens blocked |
| Marker prepared | Matching PREPARED marker; normal opens remain blocked |
| Database transaction | Add v2 metadata/seals atomically within this one SQLite file |
| Database committed | Explicit recovery validates manifest, ownership and dispositions before rolling forward |
| Catalogue verified | Per-universe generation/state recorded; root still blocked |
| Marker ready | Marker published; catalogue remains blocked until completion |
| Complete | Catalogue/root READY; ordinary prototype writer opens allowed only for ACTIVE universes |

A still-exact v1 copy after a clean transaction rollback permits explicit abort
of the reserved operation. A committed matching v2 copy permits explicit
roll-forward. A hot/unexplained journal, unsupported schema or inconsistent
receipt blocks recovery; no implicit SQLite repair or invented metadata. Backup
creation and paired restoration are future work. Failed/partial recovery does
not authorise reopening a writer.

### Compatibility evidence and remaining gates

An unmodified v1 constructor refuses the existing v2 file unchanged. In the
counterexample test, moving that file out of its routed path lets the same old
writer create a new v1 baseline **while the catalogue still says RETIRED**.
Consequently the original refusal path must remain present, and future production
integration must exclude old/manual writers rather than trusting catalogue
awareness they do not have. A v1 connection opened before migration can also
return its old READY cursor for existing replay; a version bump does not revoke
that connection. Tests demonstrate both limitations deliberately.

The prototype supports the first v1-copy migration per universe; repeated v2
resealing is explicitly refused. Multiple universe registrations have separate
per-database generations. No production adoption, UI Apply, pruning, quarantine,
compaction or minimal refusal-file replacement is implemented. Future repeated
maintenance, backup/restore pairing, production registration/durability and all
writer/load routes need their own implementation/evidence gate before real use.
Power-loss durability and total loss/rollback of all independent registration
state remain unproved; the lab cannot solve those by inspecting absence.

## Verification

On Windows / Node v24.21.0: 114 profile checks (36 new Stage3 checks), 112 bridge
checks and 89 recorder checks passed, with no failures or skips: 315 total.
The final profile suite includes the strengthened catalogue-still-RETIRED
missing-path counterexample and independent-process locking checks. Tests compare complete raw tables and exact
profiles/events/NPC-history views for retained branches, verify source hashes,
exercise new children and tombstones, and inject bootstrap/operation failures.
A real child process is terminated after DB commit and recovered explicitly;
a hard exit inside SQL leaves journal evidence that is refused unchanged.
These are controlled fixture/process results, not power-loss or gameplay tests.

No game/native/MD/XML/production module changes; no new X4 schema validation or
native build required. The experimental modules are absent from the companion
manifest. Existing deployed runtime files remain identical to source. Stage4
and deployment/owner-data maintenance are not authorised by these results.

### POSIX descriptor/lock review

The final review moved raw hashing before the SQLite migration transaction and
kept raw header/registration reads outside child ingestion transactions. Under
the held prototype lease, ingestion checks registration before and after the
transaction; inside it, only lease/path guards and the same SQLite connection
are used. The reader-lock fixture uses a separate process, and two contender
processes verify locks during migration and child ancestry validation. See
[SQLite's POSIX close/lock warning](https://sqlite.org/howtocorrupt.html#posix_close_bug).
These checks passed on Windows; no independent Linux run is claimed here.
