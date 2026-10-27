# Proposed save-aware retention design

Status: **Proposed; not implemented or approved for deletion.** PR #25 planning phase, 27 October 2026. Starting source `1a88cd55f3571846631be7b15734a0c7470ce989`, based on main `546e1ed6d82f4e2ff462aeba24d035b9f0313526`. Read the [Agent plan](DATABASE_HOUSEKEEPING_PLAN.md) first.

## Retention invariant

For every retained save, use its exact validated Life Signs universe ID, saved recorder run and acknowledged record cutoff. Walk that run's parent pointers back to a complete baseline. Take the **maximum required cutoff for each run across all retained roots**. Keep every record in each resulting prefix, its session row, and matching profile/event projections. Preserve identities, payloads, ordinals and parent pointers exactly. Never infer eligibility from game time, file age, entity death or a missing early save file.

A later save can retain an earlier run even after the earlier save file is overwritten. Two surviving branches retain their union. A newer save in the same run increases the prefix; an unreferenced future beyond it is only a candidate, not an instruction to delete.

A completed baseline is required on every root's ancestry. A partial snapshot flagged with unavailable profile fields is distinct from a missing SNAPSHOT_END: preserve published baseline/projection semantics, not a fictional complete-data guarantee.

## Conservative eligibility

| Situation | Proposed action |
| --- | --- |
| Complete declared inventory, all roots validated, graph valid | Show a proposed complement for explicit confirmation |
| Save inaccessible, changing, unsupported or cloud-only; incomplete directory enumeration | Block every potentially affected universe; an unidentifiable save blocks the whole declared scope |
| Root has universe but missing checkpoint/database | Show unresolved association and block that universe; do not silently treat as no root |
| No matching roots in a complete inventory | Orphan candidate only; quarantine preferred, never automatic removal |
| Unknown/foreign database, unsafe path/link/sidecars, building file | Separate unsupported/incomplete category; leave untouched |
| Missing parent, cycle, impossible cutoff, record gap, incomplete required baseline | Block candidate, no repair |
| Retained cutoff inside PROFILE_BEGIN..PROFILE_END | Block this universe in the first implementation until supporting-record policy is independently proven; do not move the save cutoff or expose future projections |
| Save has no Life Signs state | Only treat as unrelated after complete supported extraction; failed extraction is uncertainty |

The declared scope must include the selected profile's manual, quick and autosaves and any explicitly registered backup/archive sources. External copies outside that scope cannot be protected by inference; the UI must disclose this and permit archive registration or pinning before confirmation. A directory listing is not proof that all possible saves exist there.

## Source facts and read-only prototype

At the inspected source, [store.mjs](../profiles/store.mjs) validates an exact schema-v1 object set and ownership (lines 25?44), requires contiguous ordinal ingestion and exact payload replay (lines 99?119), verifies saved checkpoint/baseline on new runs (lines 120?130), and reads ancestry by run-specific prefixes (lines 161?177). profilesAt and NPC history also use those prefixes.

A planning-only local prototype created disposable synthetic owned stores and a separate retained candidate without deleting rows from any store. **19 checks passed**: descendant/overwritten ancestors; branch union; greatest same-run cutoff; acknowledged unsaved tail; complete/uncertain empty inventory; unknown save; missing root/cutoff/baseline; partial profile; cycle; exact actual eventsAt/profilesAt/historyForNpc equality for every retained root; raw payload/ordinal preservation; branch isolation; replay conflict; source-byte preservation.

One check intentionally demonstrates the current store-alone replay hazard: replaying an old raw stream into the shortened synthetic candidate reinserted its discarded tail. This is not a claim that the existing service load fence was bypassed. Its separate closed-run ledger and process-time eligibility are valuable, but they do not constitute a database-bound pruning policy. A future implementation must solve replay durably; deletion alone is unsafe.

Raw prototype source/output and synthetic fixtures remain ignored and local. These checks establish proposed graph semantics, not save XML extraction, main-menu operation, deletion safety, crash recovery or live X4 support.

## Decisions still to complete

Source-backed save inventory/menu feasibility, exact saved checkpoint decoding, maintenance exclusion, durable replay/schema proposal, backup/restore and staged acceptance tests will be recorded in the accompanying research/design before Agent review. No owner databases, logs or saves were changed. No production cleaner, schema migration, deployment, game launch or merge is authorised by this document.
