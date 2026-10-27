# Save-aware database housekeeping — Codex brief

Status: **Planned; research and retention design first.** Owner requested this workstream on 27 October 2026. No cleanup has run.

Inspected main: `546e1ed6d82f4e2ff462aeba24d035b9f0313526` (includes PR #24).
Continue on `feat/save-aware-database-housekeeping`; independently verify current main and branch before work.

## Goal

Give the player a Life Signs database-management screen, preferably in X4's initial main menu before any game is loaded. Show owned universe databases, the existing saves associated with them, retained history and proposed cleanup. Let the player explicitly remove unneeded databases and unreachable history.

**A universe must not lose its earlier history merely because its early saves were overwritten.**

The unit of retention is the union of histories reachable from every retained save, including their ancestor sessions and baseline. It is not "rows between currently existing save files", file age, the latest run, or the newest save alone. Events after one save remain necessary if a later retained save includes them. An unsaved tail is a cleanup candidate only when no retained save or required dependency reaches it.

This PR starts with a design brief, not a working cleaner. Root AGENTS.md requires approval of risky architectural changes before implementation. Codex's first deliverable is the evidence-backed plan and read-only inventory proposal; do not mutate owner databases or saves.

## Current implementation evidence

Read [DATABASE.md](../DATABASE.md), [completion record](SQLITE_PROFILE_COMPLETION.md), [profiles/store.mjs](../profiles/store.mjs), [service](../profiles/service.mjs), [watcher](../profiles/watch-x4.ps1), [history tests](../profiles/test/history-store.test.mjs), current recorder MD and Lua, plus AGENTS.md, ARCHITECTURE.md, TESTING.md, DECISIONS.md and relevant handoff findings.

The optional universe profile store is separate from docking v1/v2 databases:

- `local-data/profiles/`, saved `lsu1` universe ownership; application ID 1280528464 and schema version 1.
- `sessions(run_id, production_session, parent_run, parent_record, baseline)` represents ancestry.
- `records` stores exact payloads, keyed by run and record ordinal; `profile_versions` and `events` are projections with corresponding keys.
- `ProfileStore.ancestry()` follows parent pointers with per-run cutoffs; `eventsAt()`, `profilesAt()` and NPC history use that ancestry.
- Ingestion requires contiguous ordinals and exact replay equality. Published databases require a completed baseline; temporary `.building.db` files also exist.
- Recorder MD restores `UniverseIdentity.$CheckpointRun` and `$CheckpointRecord` into parent fields, then advances those values from database acknowledgements. These are committed-data cursors, **not proof a save file was successfully written**.
- The current code does not inventory all retained saves or prune history. Prior abandoned futures are intentionally stored and excluded from selected readbacks.

A production `s1` session key alone is not the cleanup root. The required candidate root is the exact **universe ID + recorder run + acknowledged record cutoff actually serialised in a retained save**. Codex must verify the installed save representation, cue location and value decoding; this brief does not establish their XML layout.

## First task: focused Qwen research and Codex verification

Follow the standing owner workflow: Codex asks concrete questions; Qwen performs broad authorised source discovery and returns plain-English findings, exact references and uncertainty. Codex verifies consequential citations and narrow dependencies. No new packet format, citation quota or research-depth cap.

Questions to resolve:

1. What installed X4 9.00 main-menu extension points can display this inventory before any game is loaded? How can the application reliably distinguish initial menu, loading, running game and return-to-menu, and prevent a load during cleanup?
2. How does X4 enumerate local manual, quick and autosaves? What happens with multiple profiles, backup saves, cloud synchronisation, offline placeholders, save replacement and external archives? Which sources can be enumerated legitimately through existing APIs?
3. How are the saved Life Signs universe ID and acknowledged run/record values serialised? Can they be extracted read-only from compressed saves without loading a game, using streaming parsing and exact value handling?
4. What completion/snapshot evidence distinguishes a stable complete save from a partial write, upload/download or inaccessible file? An unreadable save must never be counted as absent.
5. Can the current companion safely operate at the initial menu without needing a loaded universe? What exact existing Lua/native/Node transport can support a small maintenance UI without broad filesystem or arbitrary SQL access?
6. What happens if preserved raw logs are replayed after pruning? How can replay remain exact and contiguous without resurrecting deleted tails, weakening existing checks or rejecting retained-save loads?

Use synthetic save fixtures where possible. Existing owner-authorised local evidence may be inspected read-only within its established scope; do not scan unrelated personal folders or expand Qwen grants automatically. Report an access prerequisite if required. Raw saves, paths and extracted vendor material remain local.

## Proposed retention algorithm to validate

1. Inventory every declared save location in the selected scope. Identify scope explicitly; distinguish active save slots from registered backup/archive locations. Never imply absent from one directory means absent everywhere. External saves not inventoried may lose associated history; disclose that before player confirmation.
2. Extract and validate roots from stable complete saves. Record saves with missing identifiers, missing databases, unsupported formats, missing checkpoints or inconsistent ownership separately.
3. Validate each owned database and graph without repair. Starting at **every** valid save root, follow `parent_run/parent_record` to the baseline. Detect cycles, missing parents, impossible cutoffs, gaps and incomplete required baselines.
4. For each run, retain the maximum cutoff required by any root traversing it; retain its session and all prefix records through that cutoff, plus necessary profile/protocol dependencies. Preserve referenced ancestors even when no surviving save points directly to them.
5. Remove only the complement of that retained set, consistently across raw records and projections. Do not renumber ordinals, change IDs, splice ancestry or rewrite history to hide missing data.
6. A whole universe database becomes an orphan **candidate** only when the complete declared inventory contains no save root reaching it and no unresolved save could refer to it. No direct save-to-run match is insufficient evidence of an orphan.
7. Classify incomplete building databases, unknown files, corrupt/foreign schemas and unresolvable saves separately; never silently include them in normal cleanup.

Do not use game time, filesystem modification time, NPC seed or maximum database record as substitutes for checkpoint reachability. Do not remove old/dead entities whose profiles are needed by retained historical events.

Investigate checkpoint cuts within multi-record profiles or before baseline completion. Preserve necessary supporting records conservatively without exposing future events in a retained save view; if a safe rule is unproven, block that candidate and explain it. A partial or untrusted inventory must not produce destructive eligibility for potentially affected databases.

## Player flow and execution safety to design

Preferred entry: **Life Signs → Database housekeeping** in the initial main menu, before loading a game.

Display each owned universe database, associated save labels/checkpoints, inventory coverage/problems, preserved ancestors, candidate unsaved/abandoned branches, row counts and actual file size. Show previews before explicit player confirmation. Logical row deletion does not necessarily shrink SQLite files: distinguish logical cleanup from compaction; do not promise immediate disk-space recovery.

No automatic cleanup at launch, exit, load, inventory refresh or menu opening. Do not delete saves. Keep docking databases, raw evidence logs and unrelated files outside this feature.

Before eventual mutation: prove the collector/watcher cannot concurrently write or reopen a target, drain/close writers, acquire exclusive maintenance ownership, and prevent loading until completion. Initial-menu visibility by itself is not a database lock. Revalidate save inventory, database identity and plan immediately before apply; if anything changed, require a fresh preview. A previously loaded game returning to menu is not automatically a safe maintenance state.

Design verified backups and a usable restoration procedure before destructive testing. Row pruning must be atomic within each database, with consistent projections, integrity checks and before/after retained-view comparison. Whole-file removal must handle SQLite ownership, handles and sidecars safely; a recoverable quarantine is preferred for the first version. State what happens on cancellation, crash, disk full, lock failure and partial multi-database completion. Never report success before post-operation verification.

Explicitly solve ingestion replay and published READY/baseline semantics after pruning. Keeping old raw logs is required; do not delete logs to make tests pass. If tombstones, archival metadata or a schema migration are genuinely required, propose and justify them before implementation.

## Acceptance cases for the proposed implementation

Use small synthetic owned databases and save fixtures first; test the real extraction/menu/lifecycle with owner-run X4 separately.

- Only newest descendant save remains: all required ancestor history and baseline survive.
- Two retained branches: union preserved; neither branch's abandoned future leaks into the other.
- Multiple saves in one run: greatest reachable cutoff preserved; later unsaved tail alone is eligible.
- Earlier save overwritten, later save includes its events: no loss of earlier history.
- Whole universe has no roots in a complete inventory: preview offers orphan cleanup; another universe remains unchanged.
- Acknowledged rows never saved: eligible only if unreachable from every retained root.
- Save exists but database/checkpoint is missing, malformed, inaccessible, cloud-only or changing: visible uncertainty and no unsafe deletion.
- Unsupported/foreign/corrupt database, ownership mismatch, ancestry cycle, missing baseline, partial profile, sidecar/lock/path redirection: fail safely unchanged.
- Inventory or database changes between preview and apply; game load or collector restart attempted: stale plan cannot execute.
- Before/after `eventsAt`, `profilesAt` and relevant NPC history for **every retained root** match exactly; retained raw payloads, parent pointers and ordinals are unchanged.
- Replay of retained logs and loading each retained save do not restore pruned tails or break contiguous ingestion; existing fresh-baseline semantics remain honest.
- Crash/cancel/disk-full recovery, repeated cleanup, verified backup/restore and actual space reporting.
- Existing docking, profile ingestion, trade/combat capture and NPC kill reputation remain unaffected.

Run relevant Node v24.21.0 tests, generated-file freshness and diff/privacy checks. Changed MD/UI must pass effective installed X4 9.00 schema checks; changed Lua/native interfaces need applicable tests. Distinguish synthetic, installed-source and live evidence. No live verification claim from mocks.

## Deliverables and boundaries

First return an evidence-backed retention design, save-inventory mapping, menu/maintenance feasibility, replay strategy, precise unresolved questions and implementation/test plan. Add the design to this PR without changing production behaviour. Read-only prototype tests on synthetic files are within this planning phase; no destructive implementation or operation on owner data before design approval.

Expected future implementation is confined to profile-store maintenance, save inventory, necessary menu/companion integration and focused tests/docs. No automatic deletion, identity redesign, gameplay changes, Qwen runtime, unrelated schemas or docking migration.

Publish the sanitised Codex report in private handoff:
`database-housekeeping/DATABASE_HOUSEKEEPING_CODEX_RESEARCH_REPORT.md`.
Update its STATUS/EVIDENCE and return ownership to AGENT. Keep raw save extracts, inventory paths, databases, backups and model transcripts in ignored local-data. Do not deploy, launch X4, perform live cleanup or merge this PR.
