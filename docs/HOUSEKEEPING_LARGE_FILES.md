# Housekeeping checksums for large histories

7 November 2026. Owner-reported cleanup REVIEW produced a generic blocked-action
message. Isolated branch fix/housekeeping-large-files starts at main759fcd6.
Bug investigation and reversible implementation/testing follow the owner report;
deployment, gameplay, real cleanup and merge are separate.

## Finding and correction

production-contract.mjs fileHash streamed data through a fixed1 MiB buffer but
refused any file above4 GiB before reading it. The installed function directly
reproduced RESOURCE_LIMIT_4_GIB for the selected history. Cleanup review needs
this checksum to bind its confirmation to the exact database, so larger valid
histories could not complete that review. The worker returned a bounded code,
but the UI's generic fallback hid the useful reason and no service diagnostic
retained that code.

The obsolete file-size cap is removed. Hashing still uses one fixed1 MiB buffer,
reads to EOF, closes the descriptor even on read failure, and rejects changed
inode/size/mtime. The final pathname is now also rechecked against the original
identity, so replacement during hashing cannot silently return an old digest.
File sizes must remain non-negative safe integers. Hash format is unchanged.

The independent4 MiB registration-JSON parsing guard remains, along with save
inventory/resource limits and every existing maintenance safeguard. No schema,
identity, protocol, retention/ancestry, protection, load/writer exclusion,
backup/restore, selected confirmation or free-space rule changes. Cleanup still
requires a fresh preview, explicit owner confirmation and verified backup.

Known file-change/unsupported-size/legacy-size refusals have bounded friendly
wording. Action worker refusals are logged locally as a sanitised uppercase code
only; arbitrary error text/paths are not displayed or copied into diagnostics.

## Verification

- A real disposable sparse file of4 GiB+131 bytes passes the corrected hash,
  matching an independent Python SHA256. The test asserts all bytes are read
  using the same single1 MiB buffer. It does not allocate the whole file in RAM.
- Empty/ordinary checksum compatibility, changing input, pathname replacement,
  descriptor closure on injected read failure and the independent JSON guard
  pass. The sparse fixture explicitly deallocates zero ranges on Windows and
  verifies its final disk allocation remains below2 MiB.
- A read-only checksum of the affected larger history matches an independent
  Windows/.NET checksum; file identity, size and modification time are unchanged.
  No SQLite maintenance or confirmation plan was executed for this check.
- Full profiles suite:221/221 pass, zero failed/skipped. Focused hash/preview/
  reply set:39/39 pass. Python3 is needed for the independent sparse fixture.
- All seven existing installed-LuaJIT/native/Node housekeeping outcome groups
  pass on disposable databases, including backup, prune, selected restore,
  compaction, protection and save-location controls. These are smaller synthetic
  databases; a full large owner-database cleanup is not claimed.
- Diff/privacy checks pass. XML/MD/native DLL and UI code are unchanged.

## Delivery and acceptance

Implemented/offline verified, not deployed, no live X4 test or merge. This change
is independent of the missing-menu correction and station production work.
No owner data, settings, logs or installation was changed. Diagnostic copies and
read-only results stay local; the saved-scope diagnostic is not a new cleanup
plan or authority to delete data.

Deploy only after owner approval through the existing companion installer and
code-hash safeguards. Do not edit an immutable installed bundle or bypass its
manifest. Preserve the current recorder/police/UI/native components and rollback.
For acceptance, owner starts X4 at its initial menu, opens Life Signs, refreshes,
then selects Clean for the intended universe. A review should now reach its
confirmation screen for a valid larger history. Cancelling there is sufficient
to test this fix; actual cleanup remains a separate explicit in-menu decision.
