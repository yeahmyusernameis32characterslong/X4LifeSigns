# NPC history events

## Owner-approved implementation plan (22 October 2026)

Baseline `44690a5`, `feat/sqlite-object-profiles`, draft PR20. The owner approved
the source-researched event catalogue and explicitly authorised implementation
and deployment. No X4 launch, gameplay automation or merge is authorised.

1. Extend the optional recorder's native catalogue with travel, docking, order
   completion/cancellation, command replacement, loss/abandonment/ownership,
   boarding, trade, cargo/mining, supply/build, scan and relationship observations.
   Preserve existing NPC assignment/role/transfer and manual rename observers.
2. Record factual context and counterpart identity at observation time. Cache
   watched asset identities for destruction/ownership loss. Limit repeated combat
   contacts and capture relevant outsiders rather than monitoring every ship.
   Marine operation entries remain contextual: resolve seed/name while available,
   never store the pseudo-type or create NPC actors. No hull/shield subscriptions.
3. Add ancestry-aware NPC history queries over immutable profiles and events.
   Shared asset events are stored once and related through time-valid assignment
   observations. Mark assignment, observed presence, derived links and uncertainty
   explicitly. No personal kill credit, invented promotion or inferred emotions.
4. Keep owned schema-v1 tables and production docking components unchanged.
   Additive event kinds/fields require no database migration. Retain strict stream
   continuity, committed acknowledgements and original names/profile payloads.
5. Test actual generated listeners and payloads, escaped text, expired references,
   combat volume, marine templates, factual outcome labels and save-branch isolation.
   Regenerate MD and validate against installed 9.00 MD/common and UI schemas;
   run Node/bridge and native reader/Lua fixtures. Review documentation/privacy.
6. Commit coherent increments, publish PR/handoff, preserve installations/logs/DBs,
   refresh only optional recorder and pinned companion files, verify idle automatic
   lifecycle. Leave native acceptance to the owner's next X4 run.

Source provenance and corrected Qwen interpretations are retained in the private
`sqlite-profiles/SQLITE_PROFILES_CODEX_NPC_HISTORY_EVENT_RESEARCH_REPORT.md`.
Native availability is source evidence, not proof of complete in-game coverage.
The old missing-row root cause and early-load restored-state raw append remain
open; this work does not waive stream validation or delete history.

## Implementation and verification

In progress. Exact coverage and native limitations will be recorded here before
deployment. There is no completed-save detector or unsaved-tail deletion.
