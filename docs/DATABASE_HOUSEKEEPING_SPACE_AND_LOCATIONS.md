# Menu save locations and disk-space actions

Owner-authorised PR25 addendum, 30 October 2026, baseline `5f1cb98`.
Implementation and deployment evidence will be reported separately; this initial
contract does not claim the actions are implemented.

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
