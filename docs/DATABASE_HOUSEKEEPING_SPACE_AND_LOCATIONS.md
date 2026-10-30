# Menu save locations and disk-space actions

Owner-authorised PR25 addendum, 30 October 2026, baseline `5f1cb98`.
The menu editor and explicit actions below are implemented on the PR25 branch.
Deployment revisions and owner observations are recorded separately in the handoff.

## Decisions before destructive implementation

- Keep the installed profile's detected save folder mandatory. Persist additional
  folders through native menu text entry, normalise/deduplicate paths, and scan
  subfolders recursively. Removing a location never changes its contents.
  Detection failure makes the inventory incomplete. Settings changes invalidate
  prior confirmations and are excluded during maintenance.
- Compaction works on a verified staging copy, outside its SQL transaction. Keep
  all remaining rows and seals, update the registered generation, and install by
  the existing protected replacement protocol. A verified backup precedes install.
  Report database bytes reclaimed and backup storage separately; neither raw-row
  counts nor file sizes are exact reclaimable-space promises.
- Restore-point deletion selects an identified, verified maintenance backup only.
  Record intent before unlinking, clear its restore pointer consistently, and
  resume only known matching interrupted deletions. Refuse unfinished recovery;
  never purge other evidence or folders. Explain the lost restoration option.
- Orphan deletion requires a new complete configured-scope scan, zero matching
  saves and no protection. Confirm selected database and explicitly selected
  associated restore-point scope. Preserve a minimal permanent retirement entry
  before unlinking anything, so old logs cannot recreate a baseline or receive
  persistence permission. Interrupted removals remain blocked and resume only
  from known recorded file hashes. Saves and unrelated evidence are never targets.
  The original database pathname is atomically replaced by a tiny non-SQLite
  retirement marker before its backups are removed. This keeps older ordinary
  store code from treating an absent filename as permission to rebuild a baseline.
  The marker's hash is bound into the catalogue; it contains no history rows.
  Permanent confirmation includes every associated maintenance restore point,
  including the newly verified safety copy. It does not claim secure erasure or
  removal of unrelated incomplete/building databases.
- Keep existing ancestry, overwritten-save history, writer/load barriers,
  registration identity and explicit menu confirmation. Validate all destructive
  operations on disposable copies before deployment. No autonomous live cleanup,
  gameplay launch or PR25 merge.

## Required evidence

Location persistence/native retention, Unicode/invalid/duplicate paths, unavailable
scope and stale confirmations; compaction row/identity/seal equality; backup and
retirement interruption, writer contention, disk failure, replay refusal and
unaffected peers; native bounded transport/widgets, generated/package/schema and
privacy/diff checks. Preserve separate wrapping/navigation warning findings.

## Player controls

Open **Life Signs > Save locations** at the initial menu. The **X4 saves
(required)** row is detected from the running installation's load-control profile;
it cannot be removed. Enter the full local archive-folder path, leave the text
field and select **Add folder**. **Remove** stops scanning an additional location;
it never removes that folder or its files. All subfolders are included. Paths
are normalised and deduplicated; existing extra locations/protection are retained.
Up to 16 additional folders are supported. Long paths are displayed over multiple
rows. The next **Rescan** or Back after a change starts a fresh scan. Missing or
unavailable required/configured folders produce **Scan incomplete**, not orphanhood.

The text entry uses installed Helper `createEditBox():setText()` and
`onEditBoxDeactivated(_, text)` conventions. A bounded, strictly decoded UTF-8
hex payload carries data only. No paths are evaluated as Lua, SQL or shell code.
The Windows native-handle helper explicitly decodes UTF-8 on its redirected
console channel. Existing native reply size and DLL interfaces are unchanged.

Select a universe to reach its space controls:

- **Reclaim disk space...** is available for an unprotected universe with detected
  saves and no remaining cleanup candidates. Review its database size and free-page
  estimate, then **Confirm compaction**. Remaining rows, identities and replay seals
  are checked after staged compaction. The result separates database-byte reduction,
  newly retained backup size and net file-byte reduction, which can be negative.
  Existing restore points are not automatically deleted.
- **Restore points...** lists individual backup dates, sizes and current/earlier
  status. A selected **Restore...** retains the existing no-silent-rewind guard.
  **Delete... > Confirm delete restore point** permanently removes only that
  verified selected restore point. It clears the normal Restore pointer only if
  that selected point was current. Other history/backups/evidence remain.
- **Delete orphan universe...** is available only for a complete fresh scan with
  no matching saves and no protection. It confirms the database, all associated
  maintenance restore points and the required permanent-deletion wording. A
  verified safety copy precedes replacement by a tiny non-SQLite retirement stub;
  the explicitly confirmed backup scope includes removing that safety copy.
  Incomplete building files and unrelated evidence are not targets. Saves are
  never removed. This permanent operation deliberately has no restore option.

Known interrupted permanent removals show **Deletion pending**. **Resume
deletion...** reviews the previously confirmed scope and requires a new explicit
confirmation. An immutable hash-bound journal and permanent retirement state
prevent target guessing and replay resurrection. Unknown changes refuse.
Nothing permanently deletes merely by launching, scanning or changing folders.

Sizes use MB/GB. Free database pages are an estimate, not a disk guarantee;
SQLite can also compact partly filled pages. Removal results distinguish selected
file bytes from observed volume-free-space change, which other activity can affect.
There is no secure-erasure guarantee or automatic purge of failed-stage evidence.

The staged `VACUUM` runs outside the transaction, consistent with
[SQLite's documented requirements](https://www.sqlite.org/lang_vacuum.html).
If interrupted, it can damage only the disposable stage; the registered active
database is untouched until its verified replacement is installed.

## Verification boundaries

Windows Node24.21 tests exercise real file handles, independent writers, complete
scope checks, disk failure, anchored-journal tampering, actual process termination
between removals, retained history/ancestry/seal equality and old-store/consumer
retirement refusal. Installed LuaJIT/native-reader tests use real typed transport
and Node workers with mocked widgets, including Unicode entry, compaction,
selected restore-point deletion and orphan confirmation. Native X4 keyboard and
rendering observations still belong to the owner test after deployment.

Long universe IDs are spaced for wrapping only in display text; stored IDs and
transport values are unchanged. The separately observed restricted online API
warning on returning to the vanilla main menu remains a focused unresolved
finding. No unsupported privileged-call workaround is claimed by this increment.
