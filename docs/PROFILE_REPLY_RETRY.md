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
