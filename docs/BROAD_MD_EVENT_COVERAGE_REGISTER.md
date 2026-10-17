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

## Broad-first listener selection and discovery contract (owner-approved)

**This is an initial *research slice*, not a whitelist, implementation ceiling or
requirement to prove an event useful before collecting it.** The intended
recorder spans all qualifying player-faction ships, stations, subobjects and
NPC personnel and includes non-owned objects when directly participating
in player-faction incidents. Extend this register systematically toward
**every supported, safe relevant native event family** in effective installed
X4 9.00. The first separately approved recorder build may include the widest
safe source-checked candidate set then available **without waiting for the
full event inventory or individual gameplay usefulness tests**.

For each proposed listener, verify event name/source version and override,
MD versus AI/UI availability, correct source selector versus optional
filter, original typed `object`/`param*` payload, source/target lifetime,
any critical safe getter constraints and expected volume only if evidence
exists. Mark **SOURCE_VERIFIED** where syntax and scope are supported,
**UNVERIFIED_CANDIDATE** where incomplete, **SNAPSHOT_FALLBACK** where no
suitable event is demonstrated, **AI/UI_ONLY** where appropriate, and
**UNKNOWN** for unfinished searches. **NOT_SUPPORTED** requires positive
source evidence; a failed/bounded Qwen search does not establish absence.
No universal unscoped MD hook is assumed.

**Include repetitive and overlapping families** rather than sampling,
deduplicating or pre-classifying them away. Each selected occurrence should
preserve original typed values with safe context: object relationships;
ship/station `idcode` where available; owner, class, location and names;
NPC template/component/role/post distinctions; run/session, sequence,
timestamps and explicit `UNAVAILABLE`. An event often lacks an ID code
directly, and no permanent NPC identity follows from seed/name/reference
alone. Avoid expensive or side-effecting per-event enrichment. Defer
behaviour classification and incident matching to **offline local Qwen
analysis**, writing a separate derived dataset with precise raw-record
file hashes/offsets, and targeted Codex verification.

**Priority coverage still to inventory:** ship and station life cycles,
ownership, combat/damage/repair, movement/order/docking, fleet relations,
crew/role/post/transfer, trade/cargo/mining/production/storage,
conversations/interactions and relevant third-party participants. Broad
event capture should begin after appropriate separate authorisation as soon
as a safe supported base is available; keep broadening from observed logs.
No return to selected PR #17 entities or docking-gated events.

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

## Order lifecycle candidate slice

Qwen located `common.xsd:14498-14545`; Codex checked the event descriptions
and the inherited `objecteventsource` at `:7155-7165`. The `order`
attribute is an optional filter; the documented event payload is
`event.param`. These are AI-order events exposed as script conditions,
not a complete player command/history API. Order contents, object lifetime
and rate have not been checked live.

| Condition | Documented payload and timing | Selector and caution |
| --- | --- | --- |
| `event_object_order_ready` `:14498-14510` | `object` receiving order; `param` order. Fires when a queued/default order becomes enabled **or** an order should start, even if it was already enabled. | `object` or `group`; optional `order` filter. Do not count each row as a distinct newly created order. |
| `event_object_order_cancelled` `:14512-14532` | `object` order owner; `param` order; `param2` true if noncritical/immediately cancelled. When true, the order may already be reset or gone. | `object` or `group`; `order` and `immediate` filters. Snapshot the available primitive fields promptly; no guaranteed later dereference. |
| `event_object_order_finished` `:14534-14546` | `object` order owner; `param` order; the order may no longer exist. | `object` or `group`; `order` filter. Completion is a cue occurrence, not proof of a successful outcome without state/context checks. |

`event_object_order_param_edited` is also defined at `:14548` onward, but
its relevance and volume were not established in this focused slice. Order
queued/started/failed/cancelled transitions outside the three rows remain
open inventory items; do not manufacture a corresponding event name.

## Production and trade candidate slice

Qwen located player production/trade definitions in `common.xsd`; Codex
verified them and their object-scoped counterparts at the exact ranges
below. Qwen also described `eventcondition` as supplying `param` selector
attributes; `common.xsd:7190-7192` does **not** do that. `event.param*`
are documented event values; the listed attributes are optional filters.
All rows lack measured event rate or live delivery evidence.

| Condition and schema lines | Documented payload | Source/filter and limit |
| --- | --- | --- |
| `event_player_production_started` `:15212-15224` | `param` owned production module; `param2` product ware; `param3` research flag | No object/group selector; optional productionmodule/ware/research filters. |
| `event_player_production_finished` `:15226-15238` | Same fields for a completed owned production cycle | Distinct from start; no promised output quantity in this event. |
| `event_player_production_cancelled` `:15240-15251` | `param` owned production module; `param2` research cancellation flag; `param3` list of cancelled product wares | List content and later module availability need guarded encoding. |
| `event_object_production_finished` `:17213-17226` | `object` container or production module; `param` production module; `param2` ware; `param3` research flag | `object` or `group` plus optional productionmodule/ware/research filters; can concern non-owned objects. Validate overlap with owned event before offline deduplication. |
| `event_player_trade_started` / `event_player_trade_cancelled` / `event_player_trade_completed` `:16075-16130` | `param` trade offer | Buyer/seller/tradeoffer/ware and inherited trade-value filters. The schema says *player trade*; what set of owned-property trades it covers is a live/source follow-up. |
| `event_trade_completed` `:16765-16789` | `object` selected buyer/seller/space; `param` trade offer; `param2` trade order | Source precedence is documented: supplied tradeoffer owner, else seller before buyer, else space; no generic object group. Avoid a galaxy-wide assumption. |

Shipped `md/rml_largesupply.xml:121-138` listens for
`event_player_trade_completed` and checks the trade offer's seller for
player ownership. That is a source example of an owned seller within this
event family, not evidence that all owned trade activity is delivered.
Trade partner, amount, ware and credit changes require guarded reads of
the trade offer and/or separate snapshots; those fields are not all present
as `event.param2/3` in these player-trade definitions. Production and trade
records may overlap with other economy families; preserve raw rows first.

Before a **particular listener** is implemented, Agent/Codex should verify
that listener’s exact installed-version event name, source selector, typed
payload and safe context access, with provenance from relevant base and
DLC/extension overrides. Review the **initial broad source-valid selection**
without waiting for a complete catalogue of all possible events or for
live demonstrations of each event’s usefulness. Expand this register and
implement additional safe event families incrementally as research and
recorded data expose gaps. A separately authorised owner-run smoke test
should compare delivered rows and snapshots in ordinary gameplay; no
static source can certify lossless capture.
