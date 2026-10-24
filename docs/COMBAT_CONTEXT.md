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
