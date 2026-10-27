# Combat context observations

## Owner-approved implementation plan

Baseline: main `8eb9faaf3ff8b5abb1453664b0d4228332b670d1`.
The owner approved implementation and deployment following the source inquiry.
Work is isolated on `feat/combat-context`; no merge or automated gameplay.

1. Preserve attack direction and add native method/component/weapon context,
   observed controller/command/target and guarded Attack/Flee order parameters.
2. Add player-relevant distress and local relation-range observations. Add bounded
   missile/lock observations only with verified selector/payload support.
3. Gate extra reads after readiness, player relevance and contact coalescing.
   Bound added event volume; disclose suppression. Do not add hull/shield hooks,
   polling, intent verdicts, schema migrations or full snapshots.
4. Exercise generated MD actions with missing/expired references, bursts,
   hostile/own-faction contacts, order parameters and reload readiness. Verify
   SQLite retention and existing tests; regenerate MD and validate installed
   X4 9.00 MD/common and addon schemas.
5. Commit coherent units, publish a draft PR and private handoff. Deploy only the
   optional recorder after checking X4/readers are closed and preserving files,
   logs, databases and lifecycle configuration. Owner performs native acceptance.

The native event declarations and shipped AI source support observations, not
universal intent or first-shot attribution. A turret may target something else;
an internal reactive Attack order does not establish the converse that every
non-internal order was issued by the player. Runtime cost remains unmeasured.

## Implemented observation policy

Existing attack contacts retain their 30-second subject/type/counterparty window.
Method, affected component and outgoing weapon are retained, with current command,
target, order parameters, controller availability and mutual attack-permission
context. These extra reads occur after coalescing. Ready/running orders retain
their own native order parameters, even if another order is current later.

New events: `DISTRESS_CALL`, `LOCAL_RELATION_RANGE_CHANGED`, `INCOMING_MISSILE`,
`MISSILE_LAUNCHED`, `LOCK_INITIATED`, `LOCK_ACQUIRED`. Only player assets or a
distress report involving a player asset are recorded. Missile component targets
are associated with their enclosing defensible asset when available. Distress
listens only on the galaxy channel, avoiding the duplicate sector broadcast.

Added events share a maximum of 32 retained observations per game-second window,
with 30-second per-subject/type/counterparty/detail coalescing. Saturation emits
`COMBAT_CONTEXT_LIMIT` as world context at most once per 30 game seconds; the
suppressed count is unknown. This is a bounded capture policy, not evidence that
native callbacks or database writes are free. Original attack/loss/order capture
does not consume that added-event budget. No hull/shield subscriptions.

Lock selectors document individual objects, not groups. Player ships/stations
encountered by retained combat-context observations are enrolled once per run,
four native handlers each, within the existing resettable listener bus. Following
owner approval on 25 October 2026, there is no enrolled-asset count ceiling.
There is no all-fleet startup lock scan, eviction or claim of initial-lock
coverage before enrolment. Rows report enrolment status, scope and
`lock_watch_limit=UNLIMITED`. The 32-observation rate budget and 30-second
coalescing still apply; native subscription cost grows with enrolled participants
and performance with larger fleets needs owner testing. Lock rows preserve
watch role and raw native object/param references: schema wording and a shipped
target-side AI consumer differ on their orientation, so no attacker identity is
asserted from those fields. The harness does not simulate independent native cue
instances; actual registration/refresh remains owner-test unverified.

## Source basis

Installed X4 9.00 declarations: `libraries/common.xsd:569–584,12921–12948,
13040–13066,13384–13394,14431–14441,14471–14481`; state properties in
`libraries/scriptproperties.xml:91–131,302–305,1410–1414,1686–1708`.
Shipped AI: `aiscripts/interrupt.attacked.xml:12–41,144–153,198–205,210–263`,
`aiscripts/order.fight.attack.object.xml:749–762` and
`aiscripts/interrupt.missilelock.xml:15–24`. Parameterised cue signals use
`signal_cue_instantly`, documented in `libraries/md.xsd:4299–4323`.
The private combat-context workstream retains sanitised research/provenance.

## Validation status

Generated-action and real SQLite tests cover contact payload shape, missing
controllers, player piloting, repeat-read suppression, distress direction/scope,
burst saturation, contiguous ordinals, component normalisation, actual order
parameters and lock enrolment/readiness guards. Schema validation establishes
syntax, not native event completeness or acceptable live performance. The first
owner run must check errors, captured volume, lock registration and frame times.

At implementation validation: 110 recorder/profile Node tests and 112 Windows
bridge tests pass, zero failures/skips. Generated MD passes the hash-pinned
installed 9.00 MD/common schemas; the unchanged extension registration passes
the installed addon schema. Actual installed Lua/native-reader fixtures and
three-independent-Lua-state load-permission/SQLite fixture pass. These fixtures
do not launch X4 or establish native lock scheduling/instance isolation.
