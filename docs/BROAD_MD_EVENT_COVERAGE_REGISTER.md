# Broad event capture: initial source coverage register

Research state: 17 October 2026, PR #18. **Installed-schema candidates,
not a complete listener set or runtime coverage claim.** This initial slice
records the eight `event_player_owned_*` conditions Qwen found in the
authorised base X4 9.00 `libraries/common.xsd`; Codex checked each cited
definition. The file's SHA-256 is
`8eec878511d06dd2be88a7054eb54556b29e481bf0feba20fe2cf3c6eabd3452`
(base `08.cat` manifest). See [the recorder design](BROAD_MD_EVENT_RECORDER_DESIGN.md)
for lifecycle and diagnostic limits.

The `param` columns below are the schema's *documented event payload*, not
attributes to specify on the listener. An event's optional attributes can
filter a subscription; none of these eight definitions has an
`object`/`group` source selector. That distinction corrects Qwen's answer,
which called `claimed` and `pilot` source selectors. Exact dispatch timing,
duplicate relation, event rate, loss behaviour and source lifetime are
**unverified in X4** for every row. The schema is evidence of an available
condition, not a delivered event in the proposed recorder.

| Condition and schema lines | Documented event payload | Optional filters in definition | Coverage role and unresolved point |
| --- | --- | --- | --- |
| `event_player_owned_attacked` `:15376-15387` | `object` attacked owned object; `param` attacker; `param2` kill method; `param3` attacked component | `attacker`, `method` | Incoming combat; may be frequent. Relationship to object-scoped attack events and actual volume need live observation. |
| `event_player_owned_attacked_object` `:15389-15401` | `param` owned attacker (including player); `param2` attacked object; `param3` kill method | `attacker`, `attacked`, `method` | Outgoing combat involving another faction; frequency and duplication unmeasured. |
| `event_player_owned_claimed_object` `:15403-15414` | `param` claimed object; `param2` pilot, possibly null | `claimed`, `pilot` | Ownership/acquisition candidate. Claim timing versus completed settled ownership needs observation. |
| `event_player_owned_dropped_objects` `:15416-15425` | `object` dropping owned object; `param2` list of dropped objects; **no `param` is documented here** | None beyond generic event condition | Logistics candidate; list encoding, lifetime and volume unknown. Do not invent a missing `param`. |
| `event_player_owned_collected_resource` `:15866-15883` | `object` collecting owned object; `param` ware; `param2` amount | `ware`, `amount` | Mining/economy candidate; amount type is `expression`, not a verified external unit. Rate unmeasured. |
| `event_player_owned_destroyed` `:15885-15897` | `param` killed owned object; `param2` killer object; `param3` kill method | `killed`, `killer`, `method` | Early loss context candidate. [Egosoft's 6.00 change note](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Breaking%20Changes/) says it precedes corresponding `event_object_destroyed`; check installed runtime and missing/invalid refs. |
| `event_player_owned_killed_object` `:15899-15911` | `param` owned killer (including player); `param2` killed object; `param3` kill method | `killer`, `killed`, `method` | Outgoing kill candidate with non-owned target; same ordering note and runtime gap as above. |
| `event_player_owned_money_updated` `:15913-15924` | `object` owned account holder; `param` old amount; `param2` new amount | `oldamount`, `newamount` | Economy candidate. High volume is plausible but unmeasured; currency/rounding and reason are not supplied here. |

## Selection and verification implications

- Begin with raw distinct rows for each selected family, including source,
  target, null/unavailable states, run/session and recorder sequence. Defer
  incident deduplication to offline interpretation. A player-owned and an
  object-scoped event may describe the same incident.
- Preserve non-owned attackers, targets and partners where an event provides
  them. Do not filter solely on *current* ownership after a destruction.
- Apply guarded, relevant event snapshots and periodic reconciliation for
  transitions that these payloads do not establish. Event callbacks may
  precede completion of a transfer or other state change.
- `event_player_owned_*` is one family only. Property creation/sale, order
  lifecycle, docking/movement, production/trade, personnel post/role/transfer,
  conversation, stations/fleets and UI interactions still need a source
  inventory with exact selectors and payloads. AI-only and Lua-only signals
  must be marked separately. No absence is inferred from this slice.

## Existing scoped and personnel candidates rechecked

These rows reuse the [16 October source research](X4_EVENT_AND_IDENTITY_RESEARCH_2026-10-16.md)
and Codex's targeted reread of the cited installed `common.xsd` definitions.
They are **event-level observations**, not proof of person continuity or a
completed crew transfer. All require an `object` or `group` source where
`objecteventsource` is cited. Delivery, event rate, timing after game state
changes and duplicate relation remain unverified.

| Condition and schema lines | Documented payload | Selector / interpretation limit |
| --- | --- | --- |
| `event_control_entity_added` `:12575-12586` | `object` controllable or entity; `param` added entity | `objecteventsource`; `entity` filter. Check the post and tracked object before calling this a new pilot/manager. |
| `event_control_entity_removed` `:12588-12600` | `object` controllable or entity; `param` removed entity; `param2` kill method | `objecteventsource`; `entity`, `method` filters. Removal does not prove death. |
| `event_object_commander_set` `:13773-13788` | `object` subordinate; `param` new commander; `param2` previous commander, possibly null; `param3` new assignment | `objecteventsource`; commander/previous filters. Commander change is not, by itself, an NPC promotion. |
| `event_object_subordinate_added` `:14629-14640` | `object` new commander; `param` subordinate; `param2` new assignment | `objecteventsource`; subordinate/assignment filters. Confirm assignment before calling it escort. |
| `event_object_docking_started` `:13938-13950` | `object` docking object; `param` dock; `param2` zone; `param3` bay | `objecteventsource`; dock/zone filters. Start is not completion. |
| `event_object_docked` `:13924-13935` | `object` docking object; `param` dock; `param2` zone; `param3` bay | `objecteventsource`; dock/zone filters. A verified narrow production bridge already uses this family, but broad group capture is not live verified. |
| `event_object_undocked` `:14709-14720` | `object` undocking object; `param` dock; `param2` zone; `param3` bay | `objecteventsource`; dock/zone filters. Correlation with earlier dock is an offline interpretation. |
| `event_object_abandoned` `:13134-13143` | `object` abandoned ship | `objecteventsource`. Does not supply each escaping NPC or ordinary crew-transfer departure. |
| `event_player_assigned_hired_actor` `:16469-16480` | `param` actor entity or context/template list; `param2` target; `param3` post or role | Player assignment request; documentation explicitly says actual assignment follows the event. No general completed-transfer proof. |
| `event_object_changed_owner` `:13213-13225` | `object` changed object; `param` new owner faction; `param2` previous owner faction | `objecteventsource`; `owner`/`previous` filters. Record before/after without equating this with a legal transfer. |
| `event_object_changed_true_owner` `:13241-13253` | `object` changed object; `param` new true-owner faction; `param2` previous true-owner faction | Same source/filter shape. Useful for owned-property membership changes; permanence and all transfer causes are unproven. |

For personnel snapshots, `scriptproperties.xml:305,315,317,373,1362,
1377-1380,1429-1430,2045-2058` distinguishes assigned AI pilot,
control-post occupant, contextual `people` entry, role entity, raw template,
role and transfer flags. These values need guarded, bounded observation.
Enumerating a contextual entry is not proof of a stable NPC component or
of side-effect-free materialisation; an unavailable reference is not death.

Qwen located the two owner-change definitions but inferred that ordinary
`owner` means the current controlling faction and `true owner` is permanent
legal title. The cited schema does **not** define those semantics. The
installed `scriptproperties.xml:71,74` instead says `.owner` is a *cover
owner if set, otherwise true owner*, while `.isplayerowned` tests true
owner. Shipped `md/cover.xml:289-325` treats true-owner change as distinct
from cover behaviour. The recorder should preserve both named event fields,
the observed `.owner` and guarded player-owned state, without relabelling a
cover-owner change as permanent acquisition. Reconstruct membership after
reload and retain previous-owner event parameters for lost property.

Before listener implementation, Agent should review a fuller register that
adds installed base and effective DLC/extension provenance, MD versus AI
applicability, source lifetime and expected load for each chosen event. A
separately authorised owner-run smoke test should compare delivered rows and
snapshots in ordinary gameplay; no static source can certify lossless capture.
