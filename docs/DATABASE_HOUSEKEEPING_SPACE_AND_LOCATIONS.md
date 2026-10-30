# Menu save locations and disk-space actions

Owner-authorised PR25 addendum, 30 October 2026, baseline `5f1cb98`.
The menu editor and explicit actions below are implemented on the PR25 branch.
Deployment revisions and owner observations are recorded separately in the handoff.

## Decisions before destructive implementation

- Keep the installed profile's detected save folder mandatory. Persist additional
  folders through native menu text entry, normalise/deduplicate paths, and scan
  subfolders recursively. Removing a location never changes its contents.
  Choose folders containing saves rather than a whole project tree or drive.
  Only `.xml` and `.xml.gz` save candidates receive file availability, content
  checks. Other regular files are ignored without opening their contents.
  Plain XML candidates receive a bounded 4KB root-element probe: a positively
  identified non-save root is discounted before hashing or full parsing.
  Ambiguous, malformed, DTD or unsupported save headers remain candidates and
  fail closed. Directories and candidates receive fresh batched Windows
  metadata checks; links remain blocked and are never followed silently.
  Folder discovery reports entries checked; securing inputs, content hashes,
  save parsing and final content verification report their own scan stages.
  The earlier 90-second/10,000-entry discovery restriction is removed. Root
  folders are supported, with a one-million-entry resource guard and the
  worker's existing memory limit. An incomplete scope never authorises cleanup or classifies
  a universe as orphaned. Save candidates are not skipped to fit these limits.
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
  A negative reduction means combined storage grew because a backup was kept.
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
transport values are unchanged. Blocked actions display friendly instructions
rather than raw worker error codes. In particular, remaining cleanup candidates
explain that unused history must be cleaned before reclaiming disk space.

Back from the universe list cancels the preview and restores the native options
update callback. That callback consumes its own delayed-refresh flag on a later
engine update; Life Signs no longer synchronously rebuilds the main menu from
its Back handler. The installed X4 9.00 Helper reads `menu.onUpdate` dynamically
(helper.lua:1406–1411); gameoptions.lua:13133–13138 consumes `delayedRefresh`.
This avoids the observed extension call path into a restricted online API
without replacing that API or modifying verified game files. Lua tests verify
the deferred return and reopening; absence of the engine warning still needs
the owner's native X4 check.

The realistic disposable proof compacted a 993,861,632-byte cleaned database by
49,541,120 bytes, preserving all history and replay seals. Its new backup used
993,862,282 bytes, so net file-byte reduction was -944,321,162 until that separately
selected backup was deleted. An explicitly selected earlier backup then restored
the original history and seals. A 132,431,872-byte orphan copy and its restore
points were removed, leaving a 216-byte retirement marker; peers, immutable source
inputs and every live database stayed unchanged. This proof uses copies, not an
owner observation of the new native X4 controls.

## Remaining owner acceptance checks

Remain at the initial X4 menu, without loading a save. Open **Life Signs >
Database Management** and wait for a complete scan of your configured folders.
Select the surviving universe; keep its current save-location scope unchanged.

1. Choose **Reclaim disk space...**, review the selected database, estimated
   free pages and retained safety backup, then choose **Confirm compaction**.
   Wait for **Compaction completed**. Note the database reduction, new backup
   size and net file reduction separately: keeping the backup may increase
   combined storage. If blocked, do not force the operation; retain the message.
2. Return to the list, select that universe and open **Restore points...**.
   After successful compaction, identify a restore point you no longer need by
   its date and status. Choose its **Delete...**, check the selected date/size
   and loss-of-restoration warning, then **Confirm delete restore point**.
   Keep at least one other verified restore point. Wait for **Restore point
   deleted**, then reopen the list to check that only the chosen point is gone.
   This action is permanent for that backup; current history and saves remain.
3. Use **Back** to return to the main menu, reopen Life Signs, and repeat with
   keyboard Back/Escape. Exit X4 and report both action results for journal,
   exact retained-history/seal, backup and warning verification.

Automated disposable-copy passes do not complete these owner acceptance gates.
Do not repeat previously accepted orphan-universe deletion for this check.
