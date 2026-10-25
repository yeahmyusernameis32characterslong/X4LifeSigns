# NPC ship kill reputation

## Owner-approved scope

The owner authorises research, implementation and deployment of positive kill
reputation for player-owned NPC-controlled ships. The owner explicitly selects
**reputation only**: no additional bounty payments or assist rewards.

Starting revision: `70c7628e61b5e1ed68bd3b7a32621a0a9447806f`
(`feat/trade-transaction-capture`, draft PR23). Work is isolated on
`feat/npc-kill-reputation`, preserving the deployed recorder and companion.
No gameplay or merge is authorised by this implementation task.

[Enhanced Kill Credit](https://www.nexusmods.com/x4foundations/mods/2033) is a
functional reference. Its wider bounty/assist/scaling features are outside this
change. The author requires permission for modification and asset reuse; this
project will not copy or redistribute its code/assets. The implementation will
be independently based on verified installed X4 9.00 interfaces.

## Implementation plan

1. Qwen independently researches the native positive kill-reputation path.
   Codex verifies consequential cited gates, payloads, reward calculations and
   relation updates against the installed source and schemas.
2. Implement the smallest separately optional change that extends native
   reputation eligibility to NPC-controlled player ships. Reuse verified native
   eligibility and amounts; exclude personal kills already rewarded natively.
3. Check known kill-credit extensions before enabling overlapping reward logic.
   Handle unsupported or conflicting conditions explicitly.
4. Exercise eligibility, personally controlled kills, recipient/ownership
   exclusions, duplicate prevention and reload behaviour with relevant automated
   checks. Validate against the pinned installed X4 9.00 schemas. No per-hit
   damage tracking, polling or historical compensation.
5. Commit coherent verified units; publish an unmerged draft PR and sanitised
   private handoff. Deploy only the optional reputation component with X4 closed,
   existing installation/evidence preserved, and Qwen unloaded. Native acceptance
   belongs to the owner's subsequent test.

## Research and validation status

**In progress.** Native source research and the precise extension strategy are
not yet verified. This plan does not claim a working implementation or live
reputation awards. The final findings, commands and limits will replace this
status when the respective gates pass.
