# Production housekeeping completion

Owner-authorised production integration, 30 October 2026; baseline `e7b5614`,
including the accepted PR27 interface. Implemented for actual initial-menu use
without automatic cleanup or merge. The newer direct owner instruction
supersedes the smaller resumption brief's deployment boundary. Deployment and
owner observations are recorded separately in the private handoff.

The additional menu-managed save locations, compaction, restore-point deletion
and orphan-retirement actions are specified in
[Space and save locations](DATABASE_HOUSEKEEPING_SPACE_AND_LOCATIONS.md).
That owner-approved increment supersedes the original no-space-action boundary.

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
   silent rewind of gameplay added since maintenance. Space actions and permanent removals require their own explicit review and
   confirmation; there is no automatic prune.
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

## Implemented ownership, writers and recovery

`production-contract.mjs` pairs an owned root registration and catalogue with an
anchor in the lifecycle state directory. The installed watcher also binds the
expected root ID and anchor, so a missing registration cannot silently select a
new baseline or the old test mode. Known interrupted metadata publication can
finish its recorded pair after the originating process exits. Unknown/changed
generations refuse. Database metadata independently binds root, operation and
generation; rolling back a catalogue pair cannot reopen a newer migrated file.

Supported stores share one process-refcounted root writer lease. Main-menu
maintenance takes the same lease and refuses live owners; dead-owner coordination
files are preserved. Win32 deny-write handles additionally refuse already-open
unmanaged SQLite writers. Save input handles also deny replacement while parsing.
The active database and its verified replacement stay protected during a native
`SetFileInformationByHandle` installation. Old binaries reject schema v2 and
unknown connection-generation SQL guards prevent writes from unregistered old
connections. This is local managed maintenance, not protection against an
administrator deliberately changing the schema or rolling back every anchor.

Seals include zero-cutoff tombstones even after a run's rows disappear. Actual
`ProfileConsumer` replay verifies retained payloads and classifies archived tails
without normal READY replies or a later persistence cursor. Fresh child runs can
append only from an existing retained checkpoint. Registered missing databases
refuse an implicit replacement baseline. Views and original IDs remain unchanged.

The existing LoadGame wrapper refuses dispatch while confirmed maintenance is
active, allowing a later attempt without corrupting its load state. The service
also waits for workers before ingestion and before publishing a load-fence ACK,
including the previously uncovered empty-log path. Other world/start routes
cannot construct writers or publish persistence permission ahead of maintenance.
No claim that Life Signs pauses simulation or controls every third-party menu
mod is made. All autonomous validation uses temporary processes, not X4 gameplay.

Cleanup uses a verified online backup, a separate staging transaction and a
retained-row/ancestry digest before installation. Created backup/stage files are
flushed. A staging crash leaves active bytes unchanged and the damaged stage
journal intact. A prepared/installed interruption blocks ingestion until an
explicit Restore review/confirmation recovers the selected known target, retaining
the interrupted file. Unknown target changes, sidecars or bad backup receipts
refuse with evidence preserved. Normal restoration refuses silent rewind after
new gameplay changes the cleaned database. Restoration restores original history
rows, while retaining the current production schema and a new generation.

Failed stages and unrelated evidence are retained. Backups remain until their
explicitly confirmed deletion. Compaction and verified orphan retirement follow
the separate space-action contract; saves/logs are never deletion targets.
Unsupported/partial/incomplete save cutoffs remain ineligible. A complete
zero-matching-save result can offer Delete orphan universe, with protection
and fresh-scope safeguards. Missing files,
unrecognised damage and complete anchor loss require assisted recovery rather
than a guessed repair. Code rollback after migration must not downgrade a database
or copy a backup over it independently of its registered state.

## Save scope and performance

Production settings are separate from the old preview/test settings. The Save
locations menu always includes the detected native profile folder and lets the
player add/remove additional archives without editing JSON. Deployment
preserves existing locations and protection, adds the installed X4 profile's local
save folder, and carries forward protection selected on matching test-universe
IDs. Check **Save locations** before the first cleanup. Cloud/external copies
outside the declared locations are not part of the retention decision.

The first complete XML/gzip inventory can take time. A successful inventory is
cached with its exact locations, input hashes, modification metadata and result
digest. Every reuse hashes and checks the current input set under deny-write
handles; changed or unknown inputs are reparsed. No timestamp-only cache is used.
New files arriving during staged work invalidate the operation before install.
This does not promise a cross-volume atomic filesystem snapshot: save copies
introduced after maintenance may need their retained backup restored. Such a
checkpoint cannot silently create a new baseline or acknowledge missing history.
The exact `steam_autocloud.vdf` administrative filename is excluded from save
counts, as documented by [Valve](https://partner.steamgames.com/doc/features/cloud).
It is preserved and included in input-change checks. Other unexpected files still
make the inventory uncertain; this is not a blanket exclusion of VDF or cloud data.

Windows cloud reparse points are accepted only when a metadata-only CfAPI probe
recognises a cloud placeholder, confirms fully resident data and finds no
offline, recall or partial flags. Pinning intent alone is insufficient. Unknown
providers, redirects and unavailable files refuse; inventory does not download
files or change synchronisation settings. Native input handles use NO_RECALL.
See Microsoft's [placeholder metadata query](https://learn.microsoft.com/en-us/windows/win32/api/cfapi/nf-cfapi-cfgetplaceholderstatefromattributetag)
and [placeholder states](https://learn.microsoft.com/en-us/windows/win32/api/cfapi/ne-cfapi-cf_placeholder_state).

## First real cleanup

1. Start X4 and remain at its initial menu. Open **Life Signs**.
2. Confirm **Manage actual Life Signs universe history** and inspect **Save
   locations**. Opening or refreshing never cleans history.
3. Open the intended universe's details. Check its associated saves and retained/
   removable history counts. Leave other universes protected. Unknown/attention
   or protected items cannot be cleaned; a zero count needs no cleanup.
4. Press that universe's **Clean...**. Check its full ID, exact keep/remove count
   and selected-universe scope, then explicitly press **Confirm cleanup**.
5. Wait for **Cleanup completed / Verified**. A verified restoration backup was
   created before installation. Back/Refresh should show no remaining candidates
   for that same save scope. File size may stay unchanged; backups use space.
6. Exit normally and report the result. No gameplay is required for this first
   cleanup. **Restore...** is a separate deliberate review/confirmation, not an
   action needed to finish cleanup. It affects that universe only.

If interrupted, Refresh to inspect **Recovery required** and explicitly review
Restore. If the target/backup is unknown or changed, preserve the files and
report the code. Do not delete registration, journals or backups to bypass a
refusal. This is not permission for unattended cleanup by a supporting tool.

## Validation references

Windows Node v24.21.0 and installed LuaJIT/native-reader tests cover production
confirmation transport, paired registration, writer contention, sealed replay,
child ancestry, new-save/stale/protection refusals, stage/installation process
exits, explicit recovery, backup corruption and selected restoration. Actual
copied 235 MB, 132 MB and 994 MB databases restored all original history rows;
peer files and immutable source inputs stayed unchanged. Full exact results,
source/deployed revisions and local-only evidence pointers are in the handoff.
Owner-rendered production labels and the first actual cleanup remain separate
owner observations; no game launch is part of automated validation.

Primary references: [Node v24.21.0 SQLite](https://github.com/nodejs/node/blob/v24.21.0/doc/api/sqlite.md),
[Win32 file sharing](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew),
[handle-based file information](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle),
[rename information](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_rename_info).
The Windows handle and replacement behaviour was tested on this installation's
filesystem; no generic power-loss guarantee is inferred from these references.
