# Proposed housekeeping implementation and evidence gates

Status: **Proposed for Agent review; no cleaner implemented.** PR #25, 27 October 2026. Read the [task plan](DATABASE_HOUSEKEEPING_PLAN.md) and [retention design](DATABASE_HOUSEKEEPING_RETENTION_DESIGN.md). Existing databases, schemas, saves, logs and installations remain unchanged.

Stage 1 is now owner-approved and implemented as an offline read-only inventory
and preview, documented [separately](DATABASE_HOUSEKEEPING_STAGE1.md). The menu,
schema-v2, catalogue and destructive operations below remain proposals. Source
ranges in this planning record refer to `dcb4317` and its installed-source research.

## Recommendation

Implement a deterministic read-only inventory and preview first. Preserve the union of retained-save ancestry. Add destructive operations only after approval of the versioned replay policy and after save extraction and maintenance exclusion have passed their separate acceptance gates. Do not silently reduce the goal to latest-save-only cleanup or promise that a large reachable history will become small.

The preferred player entry remains **Life Signs > Database housekeeping** in the initial main menu. Display scope, owned universes, associated saves/checkpoints, retained ancestor runs, candidate prefixes/branches, blocked items and actual sizes. Opening, refreshing or closing this screen never cleans anything. Apply remains disabled when prerequisites are unproved or inventory is uncertain. There is no age-based deletion or automatic cleanup on launch/exit/load.

An external, X4-closed maintenance action is an alternative for Agent/owner selection if full main-menu exclusion cannot be demonstrated. It is not selected or implemented here and still needs writer/startup exclusion, inventory revalidation and recovery tests.

## Installed-source findings

The following are exact logical paths in the existing privately extracted X4 9.00 source. They are not newly published vendor source or live verification.

| Question | Verified finding | Boundary |
| --- | --- | --- |
| Initial menu detection | ui/addons/ego_gameoptions/gameoptions.lua:264,404-418 declares IsStartmenu and captures it during menu initialisation | A menu sample does not prove no world has previously loaded or that no load is queued |
| Entry feasibility | gameoptions.lua:1258-1298 defines Continue, Load, Save, tutorials and New Game entries with callbacks/selectability/display conditions | A custom entry is a proposed integration; no public extension API or compatibility with every other menu mod is proved |
| Recognised save slots | ui/addons/ego_detailmonitorhelper/helper.lua:881-889 lists online_save, quicksave, three autosaves and ten manual slots | Not an inventory of every profile, backup, archive, custom filename or remote copy |
| Native list readiness | gameoptions.lua:11605-11638 calls GetSaveList after IsSaveListLoadingComplete and groups quick/autosaves;13142-13157 refreshes the list | List readiness is not proof of file completion, local hydration or stable disk content |
| Metadata | gameoptions.lua:71-87 defines UISaveInfo header metadata;11625-11650 consumes Lua save-list entries, including extra online flags | Do not assume the Lua list is exactly this C structure. Neither inspected use exposes the custom saved MD checkpoint triple |
| Load routes | gameoptions.lua:2956-2964 and8022-8046 schedule global LoadGame;274-275 declares separate NewGame/NewMultiplayerGame calls | Existing LoadGame interception does not prove all new-game/tutorial/engine routes are excluded |
| Online inventory check | gameoptions.lua:8023-8043 checks player wares/online items | This is unrelated to completeness of a save-file inventory or a cloud file lock |

Qwen independently searched/read the authorised corpus. Its first helper repeated searches and was stopped as incomplete; a focused continuation on its own deduplicated numbered reads completed. Consequential claims above were checked at their cited locations. An absent getter in inspected code is not proof no engine API exists.

## Save inventory and checkpoint extraction

1. **Declare scope.** Select explicitly configured save roots/profiles and registered backup/archive sources. Do not silently discover unrelated user directories. Include hidden supported files, quick/autosaves, compressed/uncompressed variants and replacement/backup variants conservatively. Unsupported archive containers remain uncertainty unless expanded through an approved supported reader. Show excluded locations and allow universe pinning. Files copied into the repository for research are not a complete live-save inventory.
2. **Reconcile evidence.** Use native slot labels/status as a cross-check; the companion inventories the configured filesystem roots. A slot listed by the game but absent locally is unresolved. A local file absent from the game list is not disposable. Inventory errors affect the corresponding known universe; unresolved ownership can affect all universes in scope.
3. **Check availability before content access.** Offline/recall/provider-managed files and directories are visible uncertainty; do not silently hydrate them, reset cloud attributes or treat them as absent. Pinned intent alone is not proof of fully available data. Path ancestry, realpath, regular single-link files and sidecar policy must meet existing protections. Synced/provider roots stay preview-only until stable-content and external-writer exclusion are proved for that provider.
4. **Read a stable complete stream.** Capture file identity/size/metadata, use a proven read handle excluding replacement/writes where supported, stream plain XML or supported gzip through full end-of-document and compression integrity checks, and bind the full content digest to extracted facts. Disable DTD/external entities; bounded-resource failures are UNKNOWN, never ABSENT. Do not stop after a header or after finding the first token. Recheck handle/file identity. Two equal timestamps or two directory scans alone do not establish an atomic inventory.
5. **Decode exact saved state.** Locate the correct saved recorder script/cue and decode UniverseIdentity.$Id, $CheckpointRun and $CheckpointRecord as an exact triple. Reject duplicate/ambiguous states, malformed types/IDs/ordinals, inconsistent owners and unrecognised layouts. Apply the existing universe/run grammar and safe-ordinal bound, not lossy integer conversion. No expression evaluation, GUID substitution or inferred cutoff from game time/max record.
6. **Known layout prerequisite.** Project MD establishes the logical variable names, not their on-disk XML representation. The earlier scan of an older save did not establish an extractor. Stage 1 subsequently validated the exact typed-reference layout against ten specifically supplied native X4 900 archives using independently expected checkpoints, with one plain XML equivalent also matched. See the [supported layout and limits](DATABASE_HOUSEKEEPING_STAGE1.md). Other layouts remain unknown; native menu save-list cross-checking is not implemented by the offline tool.
7. **Bind a preview.** Persist a finite, versioned manifest of scope, file identities/content digests, extracted roots/problems, database identity/content generation and policy version. A changed inventory invalidates the plan. Keep handles/leases needed for the eventual apply interval. Reliable exclusion of new files arriving from cloud/external writers during apply remains a separate gate; monitoring/rescans alone are not atomic exclusion.

The logical saved state is source-backed: recorder MD lines5,1547-1561 hold/create the stable ID;4439-4441 restore the checkpoint as parent;4581-4609 accept NEED_BASELINE/BUILDING/READY responses and update the checkpoint before the READY-specific branch. Thus an acknowledged checkpoint can predate baseline completion. Such a root must be reported as unsupported/incomplete and block cleanup; the ACK is not a successful-save receipt.

A save is an authoritative root only because the exact checkpoint was decoded from its stable complete content. A database acknowledgement or a successful save-button callback is not proof that a save file was fully written.

## Retention execution model

Compute the per-run maximum-prefix union described in the retention design. Validate ownership, strict schema, graph, contiguous raw records, projection correspondence and completed baseline for **each root**, not one favourable descendant. Compare every retained root's eventsAt, profilesAt and NPC-history views before/after, with stable composite keys and exact payloads. Preserve historical profiles even for dead or absent entities.

First version blocks a universe if any required cutoff lies within a multi-record profile. This is an unsupported cleanup boundary, not a declaration that the save is corrupt, and may limit cleanup availability for otherwise valid saves. Supporting-profile extension could be investigated later; never advance the root itself, renumber rows or expose future projections to avoid a validation failure. Incomplete .building.db files and foreign/corrupt/unsupported stores are listed separately and left unchanged. No normal cleanup of docking stores, raw logs, saves or unrelated files.

## Proposed durable replay contract - requires design approval

Deleting a tail is insufficient: current schema-v1 store ingress can append it again. The existing process filter and load-fence closed-run ledger reduce replay, but are not the authoritative retention boundary for a changed database.

Propose an **explicit schema-v2 migration**, retaining the same universe identity/application ID and existing immutable table contents, plus validated maintenance metadata:

- A maintenance generation/operation record bound to inventory/policy digest, backup receipt and committed outcome.
- A per-historical-run disposition containing the original run ID, retained cutoff (zero for a wholly retired run) and sealed status. Keep tombstones even when the session/raw/projection rows are removed. No rewriting parent pointers.
- A separate owned maintenance catalogue for whole-universe quarantine/retirement and operation recovery. A missing database alone currently triggers a fresh baseline; quarantine must instead require explicit restoration. A future forget/reset action would need its own design while retaining old-log replay protection. Catalogue loss/corruption cannot silently reset retirement knowledge.

Before opening an ingestion writer, check maintenance ownership and DB/catalogue generation. Old binaries reject schema-v2 stores through existing strict version/schema validation on opening. A version bump does not revoke an already-open connection, so all existing writers must be closed under the exclusion barrier first. Upgrade coordinated service/watcher integration and validate the unchanged native transport after explicit migration approval. No automatic mutation just to open an inventory screen. Downgrading a pruned database to schema-v1 is unsafe; recovery restores the verified pre-maintenance backup and corresponding catalogue state.

For a retained historical run, replay of present rows still requires exact payload equality. Rows beyond its retained cutoff are terminal archived data: do not insert them, renumber them or publish a misleading later READY cursor. Retired run IDs cannot recreate sessions. Consumer preflight skips or reports sealed replay separately from active-run failure; the store independently refuses append to sealed runs. Keep raw logs intact.

A newly loaded retained save uses a **new recorder run** with its exact preserved parent cutoff. The parent must exist and pass the same baseline/ancestry validation; no tombstone bypass. New events start at ordinal1 in the new run and maintain contiguous/exact checks. Missing pruned history requires restoration, not an implicit fresh READY database. Do not mark a published store ready unless its retained graph still contains the completed baseline required by every root.

Two targeted disposable-fixture checks passed: adding a synthetic metadata table and setting version2 left all existing table contents exact; the unmodified v1 constructor refused that file without modifying its bytes. This rebuts a Qwen review overstatement that old binaries need patching to reject version2 or that a renamed universe file is mandatory. Do not rename the routed universe file or depend only on a service-layer guard.

This is a proposal, not a schema definition or tested migration. Details of catalogue durability and replay-status integration need Agent approval and focused synthetic failure tests before implementation.

### Retirement and catalogue prerequisites clarified after Agent review

Old schema-v1 binaries refuse an existing v2 database, but cannot consult a new
external catalogue. If quarantine removes the original routed path, an old or
manual writer could interpret it as a missing database and create a fresh
baseline. A future retirement protocol must either leave a durable owned refusal
object at that original path, which every supported old writer demonstrably
rejects, or exclude all old/manual writers for the entire retirement lifetime.
An absent path plus a catalogue entry alone does not prove compatibility.
Test the exact unmodified v1 missing-path case before implementing quarantine.

Catalogue bootstrap must distinguish a root that has never supported maintenance
from an unexpectedly missing catalogue. A proposed ordering is: exclusive writer
barrier; durable root maintenance marker; initialise and verify the catalogue
and its matching generation; then permit migration/reservations. Marker without
catalogue, catalogue without matching marker, incomplete operation phase, or
generation mismatch means recovery required and writers remain excluded.
Backups/restores pair the root marker, catalogue generation, per-DB metadata and
operation receipt. Before quarantine, reserve and durably record its operation;
install/verify the old-path refusal barrier before releasing exclusion; verify
and commit the final phase before resuming supported writers. Cross-file atomicity
is not established by a SQLite transaction. Marker durability, every crash
boundary and old-writer refusal still need design approval and injected-failure
tests. Loss of both marker and catalogue cannot be detected from their absence
alone; an additional independently durable anchor or refusal policy is required
before making any catalogue-loss guarantee. None of this state is created by
Stage 1.

## Maintenance ownership and proposed transport

The watcher currently starts the service when X4 exists and the recorder is installed, including the initial menu; it can restart a failed worker. Its watcher mutex alone does not exclude every manual service/store writer. Add a shared root-specific maintenance lease consulted by watcher, all service/direct-writer entry points, new-run acceptance, migration and recovery. Drain complete rows, close all target handles and prevent reopen before apply. Reader/UI availability is not permission to collect.

A possible bounded menu transport reuses the existing local request-log/status-file pattern. Lua submits fixed verbs and opaque operation/selection tokens; Node resolves configured roots and typed operations. Never accept SQL or filesystem paths from menu payloads. Bind every response/page to request nonce, process generation, plan digest and maintenance state. Normal profile ACK and load-fence messages remain separate.

The first-party native reader already restricts canonical run filenames and a single ASCII LSDB1-prefixed line shorter than4096bytes (profiles/native/lifesigns_status.cpp:38-60,115-123). Reserved maintenance response pages could use that envelope without a new filesystem-capable DLL. Inventory and validation work must be incremental/cancellable in the companion with bounded UI polling; do not busy-wait on file parsing or copy the native list-loading busy loop. New Lua parsing, pagination/escaping, reserved identifiers and service dispatch are still required and unverified; no arbitrary JSON/file-reading fallback. AddUITriggeredEvent via MD is not an established pre-universe request transport.

Proposed states: IDLE -> INVENTORY -> PREVIEW -> ACQUIRE -> REVALIDATE -> BACKUP -> APPLY -> VERIFY -> COMPLETE. Failure/cancellation before apply releases safely; after apply begins use rollback/recovery, never an automatic lease timeout that resumes writers over an uncertain commit. A crash leaves a durable recovery-required marker. Returning from a loaded world to the menu is not automatically eligible. Full blocking of queued loads, Continue, menu/F9, new game/tutorial and instance recreation is **not proved** by the existing wrapper. Until this and external-save mutation exclusion are established, destructive Apply stays unavailable.

## Backup, rollback and space

Before eventual mutation: obtain exclusive maintenance ownership, validate the database read-only without repair, close/drain writers, reject unexplained WAL/journal/SHM files and produce a unique complete backup plus manifest. Verify ownership, integrity, content and a usable restore path before apply. Never overwrite a prior backup. Include maintenance catalogue/generation state in the recovery set. An open SQLite handle or an initial-menu flag is not sufficient backup exclusion.

Prune raw/projection/session rows and commit their replay dispositions within **one transaction per database**, with precommit checks and postcommit independent verification before reporting success. Backups do not make a failed operation successful. Separate universes are independent operations with visible per-item outcomes; do not claim batch atomicity. Failure before commit rolls back; uncertain postcommit/crash states require inspection/restore under the retained maintenance barrier. Disk-full, locks, cancellation and restore need injected-failure tests.

For whole-universe removal, prefer recoverable same-volume quarantine after backup and durable catalogue reservation, with phase records and no open handles/sidecars. Restoration validates the complete recovery set and resolves any newly created universe file instead of overwriting it. Quarantine and backup are retained until a separate explicit purge action; neither frees its full disk space immediately.

Logical pruning and physical compaction are separate choices. SQLite normally retains freed pages; VACUUM may reclaim them, while VACUUM INTO makes a separate compact copy. Budget backups, rollback/temporary space and output before starting; interruption can leave an incomplete output. First implementation should not compact automatically. Report active bytes, retained backup/quarantine bytes and actual measured net change, not deleted-row counts as promised megabytes. Public references: [SQLite transactions](https://www.sqlite.org/lang_transaction.html), [backup](https://www.sqlite.org/backup.html), [VACUUM](https://www.sqlite.org/lang_vacuum.html), [Node v24.21.0 SQLite API](https://github.com/nodejs/node/blob/v24.21.0/doc/api/sqlite.md), [Windows cloud/offline attributes](https://learn.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants), [Windows file sharing](https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-createfilea).

## Proposed implementation areas

| Area | Proposed responsibility |
| --- | --- |
| profiles/save-inventory.mjs (new) | Configured scope, supported stable streaming extraction, exact roots, uncertainty and content-bound manifests; no SQL writes |
| profiles/retention-plan.mjs (new) | Pure deterministic graph validation, maximum-prefix union, conservative blocks and preview; no filesystem mutation |
| profiles/maintenance.mjs (new) | Approved lease/revalidation, versioned migration, backup, transaction/quarantine, journalled recovery and restore |
| profiles/store.mjs | Separate read-only validation from writable construction; explicit v1/v2 support and database-bound sealed-run enforcement |
| profiles/service.mjs and load-fence.mjs | Fixed maintenance requests, request-bound paged replies, sealed replay handling and independent collection/load permission |
| profiles/watch-x4.ps1 | Shared maintenance lease; no restart/reopen while maintenance or recovery is outstanding |
| Optional recorder UI registration/Lua and focused tests | Initial-menu preview, lifecycle distinction, confirmation tokens and native route gates; exact integration point requires prototype proof |

Inventory must use a read-only connection and read-only validation helpers, not instantiate the current ProfileStore against an owner's database: its constructor can create a missing store and opens a writable connection. Planned request verbs are INVENTORY, PREVIEW, CONFIRM, STATUS, CANCEL and RESTORE, each with a bounded typed schema; roots come from companion configuration, never untrusted request paths. CONFIRM binds the exact server-owned plan/selection and is refused unless all prerequisites still hold. Protocol and schema additions require approval and native acceptance before enabling Apply.

## Smallest staged implementation and approval gates

| Stage | Deliverable | Gate before continuing |
| --- | --- | --- |
| 1 | Supported save-format mapping; read-only inventory/retention preview; deterministic diagnostics | Agent accepts scope; correct post-ID fixture and unknown handling; existing data remains byte-identical |
| 2 | Disposable menu/transport/lifecycle prototype | Initial-menu entry, return-to-menu distinction, all required load/start routes and writer exclusion demonstrated; no destructive Apply |
| 3 | Versioned replay/maintenance schema and catalogue on disposable copies | Explicit risky-change approval; exact retained replay, tombstone, new child-run and recovery tests pass |
| 4 | Backup/quarantine/pruning only on synthetic or approved disposable copies | Every retained-root view matches; atomicity/stale-plan/concurrent-writer/crash/disk-full/restore checks pass |
| 5 | Separately approved deployment and owner-run preview | No deletion implied by deployment/preview approval; owner checks inventory and labels |
| 6 | Explicitly authorised maintenance on selected owner data | Complete supported inventory, exclusions proved, verified recovery set and exact fresh preview confirmation |

Pending acceptance cases include all cases in the Agent plan, plus replay of wholly retired runs, unknown/new save appearance during apply, lost catalogue, old-binary refusal, partial-profile blocking, separately retained restoration backups and compaction accounting. Retained logs are never deleted to make a test pass.

## Exact decisions for Agent

Approve or revise the schema-v2/sealed-run/catalogue proposal; choose whether a closed-game apply fallback is acceptable; define supported save/profile/archive scope and pinning; arrange a post-checkpoint fixture for exact decoding; agree that uncertain roots and mid-profile checkpoints block deletion; select the first read-only stage. No current instruction authorises destructive implementation, schema migration, deployment, game launch, owner-data pruning or merge.
