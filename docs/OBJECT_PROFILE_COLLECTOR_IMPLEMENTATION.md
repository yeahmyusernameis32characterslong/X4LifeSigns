# Snapshot-only object profile collector

## Authorised implementation task, 2026-10-18

Owner requested replacement of snapshot generation with independent station,
ship and NPC profiles, and explicitly excluded event listening until snapshots
are established. Starting branch `feat/broad-native-event-recorder`, PR19,
commit `4623bccc70974963325185bdfc2290362e5a6b79`, clean and matching remote.
The station, ship and NPC profile references define the requested fields.

### Plan and acceptance gates

1. Replace the optional experimental generator with snapshot-only MD: no
   gameplay, UI or lifecycle event subscriptions. Use polling for readiness and
   scheduled work. Capture initially when ready and then every 300 game seconds;
   never overlap collection runs. Document save/load continuity limitations.
2. Execute three ordered passes: stations, ships, NPCs. Each emits independent
   PROFILE_BEGIN / VALUE / PROFILE_END records. Station/ship profiles include
   scalar relationship fields but never nested NPC profiles. Discover NPC
   candidates separately during pass three, using source-supported actions and
   passive collections, with explicit discovery scope/limit markers.
3. Implement all supported reference-table reads, including contextual crew
   name/macro/race and direct actor seed/debugname. Preserve unsupported NPC
   idcode, unknown inclusive headcount and uncertain location/assignment as
   explicit states. Never infer seed from template text or force actor creation.
4. Bound work per tick and profile, preserve exact text framing, retain the
   2,000,000-row ceiling and explicit stop/partial markers. Match aliases only
   by observed component/template evidence; do not invent universal identity.
5. Regenerate XML, run meaningful generated-action tests for pass ordering,
   independent profiles, field/state coverage, aliases, non-ship NPC discovery,
   stale references, limits and scheduling. Run bridge regression and pinned
   installed X4 9.00 schema validation, including a zero-event-listener gate.
6. Update reference/implementation docs and offline inspection as needed, commit
   coherent units and publish the report through the private handoff for Agent.

Scope is the experimental optional collector only. No production bridge,
database, deployment scripts, installed extensions or logs change. No deployment,
X4 launch, gameplay test or merge is authorised by this implementation request.

## Status

In progress. Source-supported discovery and lifecycle limitations are being
verified with Qwen before their implementation. This plan is not runtime proof.
