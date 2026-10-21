# PR20: SQLite profile and selective event test

## Owner authority and baseline

Owner instruction 2026-10-21 authorises research with Qwen, development and deployment of all eight requirements for the first owner-run test. No merge or Codex gameplay launch is authorised. Requirements7/8 clarified: events belong to their affected ship/station/NPC profile, with cross-profile links through observed seeds, codes and references. Existing production docking/session schema and databases remain intact.

Implementation branch feat/sqlite-object-profiles starts from PR19 1d8bb9679135329b0bd54e6275e20dff6caf2666. PR17,18,19 were closed without merge, with owner-authorised findings comments and branches preserved. New PR targets main and therefore carries forward the unmerged recorder implementation/documentation intentionally.

## Requirements and acceptance

1. Query actual validated SQLite universe ownership/readiness before deciding whether a whole initial baseline is needed. A saved MD flag alone is not proof that the database exists. Existing ready universe -> no whole snapshot on load.
2. Profile newly created/acquired station, ship or NPC individually. Contextual personnel must remain contextual; never instantiate actors to collect them. Profile only missing new objects, record later assignment/role changes as event values.
3. Route by the saved Life Signs lsu1 ID and retain independent run/session provenance. Never overwrite the production s1 system or migrate its v1/v2 databases. Preserve save ancestry via saved committed checkpoint information; do not import a later branch's state into an older save.
4. Initial baseline start uses a centred, centred-text manual-dismissal help panel with the owner's exact welcome wording below.
5. Completion uses the owner's exact centred help panel only after the database has committed and been read back; a native SNAPSHOT_END alone is not a SQLite acknowledgement. Errors must not claim success.
6. Ship events include attack/attacked, role/order starts and commander/subordinate changes; append event type, game time and observed identifiers/context. No shield/hull damage subscriptions and no full snapshots on attack/order events.
7. Station attacked events belong to the station profile. No shield/hull damage capture.
8. NPC assignment, crew/control roles, manager/ship trader, unassigned, spacesuit/ejection and rescue observations belong to the NPC profile, linked to involved assets. Unsupported or missing native hooks/fields must remain explicit; do not infer death or a different person from representation absence.

## Work units

- Verify native return transport for database presence/commit acknowledgements; Qwen researches primary Lua/MD sources and Codex verifies consequential claims. First-test runtime behavior remains unverified until owner tests.
- Build additive owned SQLite profile/event storage and log consumer; transaction/readback, schema/ownership/path validation, session/checkpoint isolation and restart/idempotence tests.
- Add MD request/response gating, exact panels and lightweight native event listeners, with targeted created-object profile work. Observe events during baseline without launching another whole snapshot.
- Build supported UI/native response adapter if required. No new third-party binary dependencies. Keep Qwen development-only.
- Regenerate MD; run collector/bridge/profile tests, installed900 schema and event-selector validation, documentation/privacy/diff checks; commit coherent increments.
- Deploy only reviewed optional components and required sidecar under current owner approval; preserve prior installation, profile settings, saves and all logs. Publish scoped report/private status and return OWNER for the first game test. Do not launch X4 or merge.

## Exact welcome text

Welcome to Life Signs
A new database is being created and soon your X4 game will have a memory
Following the creation of this database you should save your game immediately
Saving your game will store a Life Signs ID into the save file
Creating a Life Signs database can take considerable time
A high performance desktop may take 5 minutes for existing games with 5,000 player owned assets
You will be notified when your database has been created and to save your game

## Exact completion text

Your Life Signs database has now been created and it's Life Signs ID generated
Please save your game immediately

The five-minute statement is owner-specified product text, not a new measured benchmark. Both panels use the existing verified screen-centre placement and centred text. Buffering and pause are outside this implementation unless strictly required by the eight requirements.

## Source findings and limitations

The Life Signs saved MD tag has been observed CREATED and then identical/EXISTING across one owner save/load cycle; no global uniqueness claim. Current installed recorder is1d8bb96, still per-load full-snapshot-only. Existing automatic session routing is tested for docking, not profile inheritance. Engine log actions do not acknowledge SQLite commits. Transport and event coverage investigations are active; findings and implementation status will be recorded incrementally here and in the private handoff. Allowance percentage is not visible; use conservative commit/check/publication checkpoints.

## Storage increment (implemented, not connected to X4 yet)

`profiles/store.mjs` and `profiles/service.mjs` add a separate experimental
profile store. Production docking v1/v2 routing/files are untouched. Profile
files are named by validated Life Signs universe ID, with isolated session rows
and saved parent-run/record checkpoints inside that universe database. This
retains independent session provenance while supporting universe-level lookup;
it does not collapse all sessions into one mutable current profile.

A baseline is staged separately and published under the universe database name
only after snapshot counts, transaction commit and readback succeed. Historical
profile versions and event rows retain exact engine text. Loading an earlier
checkpoint selects only that session's recorded ancestry, excluding later
versions. Existing/wrong-owner/corrupt/schema-incompatible data is refused.
No prior exploratory logs are imported without the explicit LSDB1 protocol.

Six real SQLite/temporary-file tests pass: baseline commit gating and exact
largeint/Unicode values; saved checkpoint isolation; restart/replay; ownership
and malformed/gapped input; replies after commit/error; partial UTF-8 tailing.
This is an automated storage gate, not native return-channel validation. MD,
Lua, selective events and deployment remain in progress.
