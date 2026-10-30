# Production housekeeping completion

Owner-authorised task,30 October2026; baseline `e7b5614`, including accepted
PR27 interface. Complete PR25 for actual initial-menu use without automatic
cleanup or merge. The newer direct owner instruction supersedes the smaller
resumption brief's deployment boundary.

## Implementation contract

1. Register the real root without changing existing database contents. Pair an
   owned catalogue with an independently located lifecycle anchor. Incomplete,
   missing or mismatched registration blocks supported writers. New published
   universes join the catalogue through the same coordinated writer path.
2. Share a root lease between supported stores and maintenance. On Windows hold
   deny-write native handles on the selected database and observed save files.
   Existing unmanaged writable SQLite handles must prevent maintenance acquisition.
   Keep the original and replacement handles protected across atomic installation.
3. Compute retention from every configured local save and its full ancestor
   prefix union. Revalidate scope, settings and bytes at confirmation/execution.
   Unknown, incomplete, protected, unsupported or changed inputs refuse.
4. Create and verify an immutable backup before changes. Build the pruned database
   in a separate staging file: a crash during SQL never gives the active database
   a maintenance hot journal. Verify retained rows before atomic replacement.
5. Migrate only the confirmed target to the strict production versioned schema,
   with per-run seals/tombstones and connection-generation write guards. Old
   binaries reject the new schema; already-open writers are excluded before
   installation. Actual consumer replay must classify sealed logs without READY.
6. Journal prepared old/new identities before installation; interrupted operations
   remain blocked until explicit preview/confirmation restores a verified backup,
   preserving interrupted evidence. Restore only the selected universe and refuse
   silent rewind of gameplay added since maintenance. Keep backups; no compaction,
   orphan-universe deletion or automatic prune.
7. Drain maintenance before constructing gameplay writers or publishing load
   acknowledgements, including every supported load route. Existing UI layout
   stays; production labels and confirmation identify actual live-history scope.

## Verification and delivery

Test registration loss/rollback, real independent writer contention, sealed
replay/no false acknowledgement, valid child ancestry, interruption before/during/
after installation, backup/restore and unchanged peers on disposable data. Repeat
realistic copied-save/database proofs, native Lua transport, package/generated/
schema/diff/privacy checks as applicable. Deploy with X4 closed only after gates
pass, preserving data/settings/rollback. First actual cleanup is owner-operated
through a fresh preview and explicit confirmation with verified backup.

Selected local folders define scope; cloud/external saves outside them are not
claimed inventoried. Complete loss/hostile rollback of all independent anchors
cannot be inferred from absence alone. No promise of compaction or power-loss
atomicity across volumes. These limits must be visible in documentation and
failure states, never treated as success.
