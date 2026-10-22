# Profile acknowledgement publication

## Correction plan

The owner test after startup-safeguard deployment produced 1,054 contiguous raw
records with no recorder MD errors. SQLite committed the first 1,052 exactly.
Windows refused a reply-file replacement with `EPERM`; the service treated that
transport failure as a rejected log and published ERROR. The final two rows remain
in preserved raw evidence. Existing owner databases are not repaired or replayed
by this correction.

Keep the existing atomic reply protocol and strict SQL checks. Separate a
successful SQL commit from acknowledgement delivery. Retry only rename failures
reported as EPERM/EACCES/EBUSY on subsequent service polls. Retain at most one
staged temporary reply per run and coalesce newer desired acknowledgements.
Do not block X4, busy-wait, truncate the published reply, change permissions or
replace the native reader. A genuine ingestion error still produces ERROR;
other publication errors stop the worker as transport failures.

Verify a real Windows handle that denies delete sharing, eventual recovery
without new log rows, continued ingestion while blocked, bounded temporary files,
latest committed acknowledgement and unchanged gap rejection. Run Node, bridge,
schema and native-reader/Lua checks before publishing/deploying the correction.

## Implemented behaviour and limits

`ProfileConsumer` keeps the database transaction result separate from reply
publication. A rename refused with EPERM/EACCES/EBUSY leaves one owned temporary
file and one desired acknowledgement per run. Subsequent normal service polls
retry, including polls with no new raw records. New committed progress supersedes
the pending acknowledgement; a later genuine ERROR supersedes pending success.
Only the latest desired reply is published after recovery. A warning is emitted
once for each delayed pending reply, rather than for every polling attempt.

The previous published file remains intact until atomic replacement succeeds.
There is no sleep, per-event game call, permissions change or weakened path
validation. Superseded temporary files created by this consumer are removed;
unrelated retained files are never discovered or deleted. A blocked final reply
may remain staged when the game exits, preserving evidence. No delivery deadline
or eventual unlock is guaranteed.

Other publication failures are reported as transport failures and stop the
worker. They do not fabricate a SQL ERROR after a successful commit. Genuine
ownership, ancestry, parsing and continuity errors retain their rejection path.
The existing initial MD connection timeout and strict committed checkpoint rules
remain unchanged. No existing database or failed-run tail is repaired implicitly.

The native reader already opens replies with read/write/delete sharing. The
observed EPERM does not identify the process or policy responsible. The real
Windows lock fixture demonstrates one reproducible cause and verifies recovery;
it does not prove that the fixture's cause produced the owner's failure.
See Microsoft's [file replacement guidance](https://learn.microsoft.com/en-us/windows/win32/fileio/moving-and-replacing-files).

Six regressions exercise all three retry codes, coalescing, superseded success,
non-retryable errors, strict gap rejection, service error classification and an
actual Windows handle denying delete sharing. The latter proves continued SQL
commits while blocked and recovery without additional log rows. This changes
only the external companion; the optional MD/native DLL/Lua and reply format
remain unchanged. The separate pre-invalidation MD routing limit remains open.
