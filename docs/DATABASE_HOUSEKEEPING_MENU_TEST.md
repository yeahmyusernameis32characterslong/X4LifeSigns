# Isolated in-game housekeeping test

Owner-authorised implementation from Agent's menu integration brief. PR #25
baseline `1b0e94f`. Build and deploy the working initial-menu flow on copied real
save inputs and explicitly registered disposable database copies; do not merge.

## Implementation decisions

- Gameplay ingestion keeps its existing root and protocol. A separate explicit
  test registration selects only housekeeping inputs/targets. Missing or changed
  registration refuses; it never falls back to live cleanup.
- A fresh owned test root records immutable input provenance and bounded resource
  limits. Working copies are separate from source saves/databases and evidence.
  The temporary-lab APIs/restrictions remain unchanged; the menu uses a dedicated
  ownership-checked backend, not a redirected laboratory callback.
- Each universe has its own lease, operation state and verified backup/restore
  scope. Restoring it cannot roll back another universe or protection preferences.
- Normal profile ingestion explicitly refuses maintenance-owned roots. Test
  roots are never passed to the live consumer and never issue profile READY ACKs.
  No sealed-replay integration for real gameplay databases is implied.
- Scan/preview/apply/restore run in isolated worker processes. Protection and
  fresh-input checks precede confirmation and mutation. Confirmations identify
  the selected test universe and retained/candidate history. No orphan removal,
  purge or compaction; row counts are not a disk-space-reclamation promise.
- Initial-menu generation/load fencing remains enforced. Existing live routing,
  saves/logs/database bytes and deployment rollback are preserved. Unsupported
  interrupted states refuse with backup/evidence and actionable instructions.

## Delivery checks

Use actual copied native saves and matching database evidence at realistic sizes.
Verify exact retained raw/projection/session prefixes and ancestor union before
and after pruning, unique usable backups, selected-universe restoration, stale
inputs, protection, ownership/path/lease and interrupted-operation refusals.
Run Windows automated, Lua/native/schema/package/diff/privacy checks as applicable.
Deploy only with X4 closed. Supply exact owner menu steps and publish source,
copy provenance, validation, deployed SHA and limitations in the private handoff.
Owner performs the menu test; Agent reviews results. No merge.

## Implemented isolated increment

`profiles/maintenance-test.mjs` is the dedicated backend. It leaves the accepted
laboratory restrictions intact. The companion reads a separate, explicitly
created `local-data/housekeeping-menu-test.json` registration. Its UUID derives a
fresh child directory; the manifest digest, role markers, universe identity and
registered inventory must match. It never accepts a cleanup path from Lua.
Each working universe uses a short collision-checked directory alias and keeps
its full universe ID in the marker and database filename. Missing targets refuse.

Original inputs are copied once, hashed before/after and kept separately from
working targets. Only explicitly supplied native saves/databases are adopted into
this **test-copy role**. The save scan is cached in the immutable manifest; every
subsequent operation rechecks the copied input set and hashes. It cannot silently
use another save, a new source location or a changed file. Selected native archives
are the declared scope; unrelated extracted XML copies are not implicitly included.

Limits are deliberate: 4 GiB per file, 64 save files, 32 universe files,
4 MiB registration/metadata, existing 5-million-record/1-million-boundary inspector
limits, Windows conservative path budget, copy-space preflight and per-operation
backup/staging headroom. Hashing/table verification stream instead of loading a
gigabyte file into memory. No cloud hydration or account inventory is required.

Every target has its own lease/state and unique backups. Normal gameplay
`ProfileStore` refuses role-marked roots even before cleanup; cleaned test files
also use a distinct strict schema-v2 contract with append-refusal triggers and
retained/zero-cutoff run seals. No test file is ever routed to the live consumer.
The existing native profile ACK protocol is unchanged; HOUSEKEEPING uses its own
reserved reply files and frame type, never a profile persistence acknowledgement.

Review binds the selected universe, generation, settings/protection, copied-save
manifest and current bytes. Apply rechecks these, makes an SQLite online backup,
verifies its schema/ownership and complete row digest, and only then prunes within
an exclusive SQLite transaction. Retained raw/projection/session prefixes and
parent links are checked before commit and independently afterward. This preserves
each selected root and its maximum-prefix ancestor union. Whole-universe removal,
orphan retirement, compaction and backup purge remain unavailable.

SQLite's backup API can change opaque header counters in the tested Node runtime.
Backup validation therefore compares every table row/schema and hashes the
resulting backup itself, rather than demanding source/backup byte equality.
Restoration verifies those prior rows and exact backup output bytes. It affects
only the selected test universe and preserves the replaced state in another
verified backup; other universes and protection preferences are not rolled back.

Scans/reviews can be cancelled. A mutation is non-cancellable once its worker is
started; Cancel/load/close clear its ticket but drain its tracked exit. Final IPC
messages are drained before a worker is declared failed. Late results cannot
reappear after a new client or world/load observation. Normal gameplay routing
remains unchanged. Interrupted or unknown state refuses; preserve test files,
close X4 and report the displayed code to Codex. General production recovery,
unmanaged/manual/old-writer exclusion and independently durable registration are
not established by this isolated role and remain future production gates.

## Owner menu test

1. Launch X4 normally and remain at its initial menu. Open **Life Signs**.
2. Check **ISOLATED MAINTENANCE TEST - disposable copies only** appears. Refresh
   should list the registered test universes. The companion starts automatically.
3. Open one universe's details. Enable **Protect this universe**, return to the
   list and confirm its **Clean...** action is unavailable. Unprotect it again.
4. Use the compact **Clean...** button beside that universe. Review its full ID,
   retained/removable raw-row counts and selected-test-universe scope. Choose
   **Confirm cleanup**. Wait for **Cleanup completed / Verified**, then Refresh.
5. Its candidates should become zero, with a retained backup. Other universes
   should retain their counts. The database size may stay the same; no compaction
   or disk-space reclamation is promised.
6. Use **Restore...** beside the same universe, review the selected-only scope and
   confirm restoration. Wait for **Restoration completed**, then Refresh. Its prior
   removable counts should return and other universes should still be unchanged.
7. Exit X4 normally and report the result. Do not delete test backups or change
   source folders. A save/gameplay load is not needed for this menu test.

If the test label is absent, stop before any cleanup action and report it. If an
error/recovery code appears, leave its evidence intact and report the code rather
than editing registration/state files. This test does not clean real history.

## Validation evidence

Real copied inputs: ten native archives, three owned databases approximately
132 MB,235 MB and994 MB. Automated cleanup followed by restoration passed on all
three; complete prior table rows and every other universe's bytes were verified,
and original source hashes stayed unchanged. Candidate raw counts were2,718,
49,411 and13,494 respectively. These are data-set evidence, not generic expected
counts for other installations.

Windows Node v24.21.0 regression and actual installed LuaJIT/native-reader tests
exercise the real Lua confirmation buttons through debug transport, companion
workers, SQLite backup/pruning/restoration and native replies. They do not prove
the final X4-rendered appearance; that is the owner menu test above. MD/XML/native
source remains unchanged, so no regenerated MD or schema change is required.

Final Node suites: profiles181, bridge112, recorder89: **382 passed**, zero
failures/skips. Includes seven new backend/real-worker tests and two worker-drain
regressions. The separate LuaJIT/native script also covers the isolated confirm,
apply and restore button path. Owner-rendered X4 acceptance remains pending.

Technical reference: [Node v24.21.0 SQLite backup API](https://github.com/nodejs/node/blob/v24.21.0/doc/api/sqlite.md)
and [SQLite backups](https://sqlite.org/backup.html). Deployment records and copy
provenance remain local-only; sanitised results are in the private handoff.
