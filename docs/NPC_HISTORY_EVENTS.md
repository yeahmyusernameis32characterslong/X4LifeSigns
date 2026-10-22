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

## Implemented capture

The generated catalogue has **48 native listeners**, plus the existing universe,
database and passive UI observers. `recorder/profile-events.json` is the exact
selector/payload inventory; `history-event-generator.mjs` compiles the new actions.

| Family | Recorded observations |
| --- | --- |
| Career | Existing actor/template assignment requests, later observed assignment, control-post changes, crew UI roles, movement/ejection/rescue; current assignment and physical container are separate fields. |
| Fleet | Existing commander/assignment/ready/running observations; group changes, command-ship replacement, finished and cancelled orders. |
| Names | Existing Map rename dialog/information edit observers preserve name history. |
| Combat/loss | Attacked/attacking contacts, killed object, watched asset destroyed or abandoned, owner changes, and recent outside participant destruction. |
| Boarding | Created/started/phase/removed observations and individual infiltrating/fighting/killed roster observations, deduplicated per operation/template/state. |
| Travel | Dock/undock, sector/gate transitions, scanner/scanned relationships, player discovery explicitly labelled world context. |
| Economy | Completed/cancelled trades; offer/order terms and transferred amount when exposed; cargo pickup, mining, supply requests added/removed, build started/finished/cancelled with task flags. |
| Relations | Player/entity and faction relation changes as universe context, never asserted personal knowledge or sentiment. |

New event fields preserve subject/counterparty name, faction, seed, ID code,
reference, sector, previous object and source hook. Missing data remains empty or
`null`/`UNKNOWN`; `identity_state` distinguishes unresolved identity. Cached names
and locations are last observed values, not guaranteed current at destruction.
No damage quantities, hull/shield subscriptions, NPC creation or extra full
snapshots are introduced. Existing configuration/one initial baseline remains.

Combat and mining observations are **first contact per subject/type/counterparty/
detail in a 30-second window**, not an exact hit count or a proven battle boundary.
The gate runs before repeated name/faction/location reads. Suppressed notification
counts are explicitly `UNKNOWN`. Expired contact keys are pruned in bounded tick
work. Relevant outside ships/stations receive loss watches for 120 seconds after
their last recorded contact, at most256 enrolled at once; `external_loss_watch`
reports enrolment or capacity exhaustion. Expiry work and identity warm-up process
eight entries per tick under the current configuration. Expired entries behind a
refreshed queue head may remain watched longer; derived contact-outcome queries
still enforce the120-second evidence interval.

Marine seeds/names are extracted through terminal contextual lookups during the
operation callback, then queued as ordinary scalars. Tick writes are bounded;
roster enumeration itself occurs at operation transitions, so extremely large
boarding operations remain a native performance test question. An unavailable
operation roster emits `BOARDING_ROSTER_GAP`; absence is never treated as a death.

## Storage and NPC history read view

Owned schema-v1 tables are unchanged. Additive event scope values `UNIVERSE`
(world context) and `ASSET` (expired/unclassified watched object) are accepted;
neither creates an object profile. Existing raw profile and event rows remain
immutable, and contiguous ordinal checks/commit acknowledgements are unchanged.

`ProfileStore.historyForNpc(seed, {run, record, includeWorld:false})` is an offline,
read-only view. Supply the exact integer seed as text. It follows saved ancestry,
returns direct NPC facts plus temporal assignment/presence observations and shared
asset events, and can relate a recently encountered opponent's loss to its contact
record. Relationship labels distinguish direct facts, roster association, assigned
asset, **last observed** physical presence, derived contact outcome and optional
world context. Requests do not change posting; boarding participation does not
assign a marine to the target ship. Unassigned is asserted only when explicitly
observed. Protective intent and personal recollection remain unknown. The view
does not write duplicated shared events or run in the gameplay ingestion loop.
It is not a benchmarked, fully indexed memory/search product; fleet-wide casualty
stories require an additional time-valid command-chain join over captured facts.

## Validation and native acceptance

76 Node collector/storage/lifecycle tests and112 bridge tests pass. Actual
generated-listener regressions cover repeated combat contacts without crew/text
rescans, reference expiry, trade participant fallback, cancellation payloads,
marine pseudo-type safety and exact signed64-bit seeds, world/scan/travel fields,
outsider expiry and no extra baseline. Real SQLite tests exercise unchanged
schema-v1 reopening, request/service/presence distinctions, contact outcomes,
as-of reads and older saves excluding later history. Installed9.00 MD/common and
extension addon schemas pass; the actual native reader/Lua adapter fixture passes.
These are automated/static checks, not live acceptance of the new native hooks.

Remaining native/source limits: not every contextual NPC birth or abstract crew
move has a proven universal hook; actor availability can be incomplete. A ready
order is not running and a finished order is not necessarily successful. Supply
removal is not delivery; mining events are not exhaustive yield accounting; owner
change is not proof of capture. Trade terms need not equal realised proceeds and
counterpart/order data may expire. Ship loss does not imply all crew died. Manual
rename routes do not establish automatic/mod naming coverage. The existing missing
row root cause and early-load old-file append remain open. Strict SQL rejection
is preserved. There is no completed-save detector or unsaved-tail deletion.

Qwen's focused review remained length-limited. Its assertion that a scanner group
requires manual iteration was rejected: the schema explicitly permits a group and
the event delivers the participating object. Likewise the mining selector uses
the documented sector group alternative, and terminal pseudo-type safety is a
datatype/lifetime constraint, not a new access-control requirement. Trade fallback
and cancellation/boarding lifetime concerns were independently verified and tested.
