# Isolated in-game housekeeping test

Owner-authorised implementation from Agent's menu integration brief. PR #25
baseline `1b0e94f`. Build and deploy the working initial-menu flow on copied real
save inputs and explicitly registered disposable database copies; do not merge.

## Implementation decisions

- Gameplay ingestion keeps its existing root and protocol. A separate explicit
  test registration selects only housekeeping inputs/targets. Missing or changed
  registration refuses; it never falls back to live cleanup.
- A fresh owned test root records immutable input provenance and bounded resource
  limits. Working copies are separate from source saves/databases and evidence.
  The temporary-lab APIs/restrictions remain unchanged; the menu uses a dedicated
  ownership-checked backend, not a redirected laboratory callback.
- Each universe has its own lease, operation state and verified backup/restore
  scope. Restoring it cannot roll back another universe or protection preferences.
- Normal profile ingestion explicitly refuses maintenance-owned roots. Test
  roots are never passed to the live consumer and never issue profile READY ACKs.
  No sealed-replay integration for real gameplay databases is implied.
- Scan/preview/apply/restore run in isolated worker processes. Protection and
  fresh-input checks precede confirmation and mutation. Confirmations identify
  the selected test universe and retained/candidate history. No orphan removal,
  purge or compaction; row counts are not a disk-space-reclamation promise.
- Initial-menu generation/load fencing remains enforced. Existing live routing,
  saves/logs/database bytes and deployment rollback are preserved. Unsupported
  interrupted states refuse with backup/evidence and actionable instructions.

## Delivery checks

Use actual copied native saves and matching database evidence at realistic sizes.
Verify exact retained raw/projection/session prefixes and ancestor union before
and after pruning, unique usable backups, selected-universe restoration, stale
inputs, protection, ownership/path/lease and interrupted-operation refusals.
Run Windows automated, Lua/native/schema/package/diff/privacy checks as applicable.
Deploy only with X4 closed. Supply exact owner menu steps and publish source,
copy provenance, validation, deployed SHA and limitations in the private handoff.
Owner performs the menu test; Agent reviews results. No merge.
