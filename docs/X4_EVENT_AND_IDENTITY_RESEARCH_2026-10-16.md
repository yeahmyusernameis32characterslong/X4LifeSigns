# X4 event and identity research: consolidated findings

Research recorded 16 October 2026. This report consolidates the owner-directed conversation and the local Qwen question sequence. It is **source research**, not an implemented four-entity probe or a live X4 test. Line numbers refer to the locally retained, hash-checked X4 9.00 corpus. The original installed sources remain authoritative; Qwen's answers were checked against cited lines. See [the research method report](QWEN_ONE_QUESTION_RESEARCH_METHOD_2026-10-16.md) for the interaction and its limits.

## What we are trying to observe

The proposed experiment follows one named NPC, two ships and one station through transfers, promotions, fleet changes, combat and possible death. It should preserve previous roles as history and record **where** the NPC takes a new role. The owner described moving Kobayashi from Gaia to a station manager post, back to ship crew, then to an escort destroyer, promoting her to captain, and losing that destroyer in combat. This is an experiment design, not a claim that the current listener already captures every such event.

The current docking bridge is narrower: it observes completed docking while the player personally controls the ship, writes a marked X4 debug line and acknowledges it in Node.js. It is not an all-event feed or a database for the proposed experiment. See [the bridge experiment](BRIDGE_EXPERIMENT.md). Opt-in `--auto-db` already provides automatic per-loaded-session docking routing, **Verified live in X4 9.00 with Node.js v24.21.0** under the approved practical local single-player `s1` assumption; see [automatic session routing](AUTOMATIC_SESSION_ROUTING.md). Save/universe lineage and continuity across sessions remain separate and unverified. This report changes neither routing nor identity rules.

## Identity evidence and boundaries

| Candidate | Source evidence | What remains unproved |
| --- | --- | --- |
| Ship/station object `.idcode` | `libraries/scriptproperties.xml:191-198` defines an object ID code string in `AAA-123` format. The completed docking event exposes ship and dock objects from which it can be read. | The property documentation does not promise permanent uniqueness, uniqueness across universes, or stability through every replacement. The [six-ship diagnostic](SHIP_IDENTITY_DIAGNOSTIC.md) verified only its recorded owner-run scenarios. |
| NPC seed | `libraries/scriptproperties.xml:2045-2047` calls the contextual NPC template seed a persistent pseudo-random seed used to generate and identify the NPC; line 48 documents an actual entity's seed. | This is a promising correlation key, not a proved global or lifelong person ID. Ordinary crew can be represented as templates or actual entities and transfer paths differ. See the local `local-data/npc-source-research/report.md`, especially sections 6-10. |
| NPC component reference | Shipped scripts can retain and later inspect an actual actor reference; the local NPC source report gives examples. | An actual component can be destroyed or replaced. A component reference alone is not a universal person identity contract. |

The save observations discussed in the conversation motivate following both the NPC seed and the object's ID code across scenarios. One observation across different custom starts is useful evidence, but cannot establish a general uniqueness rule. Do not treat a displayed code such as `HCN-842` as an NPC seed: the `AAA-123` format is documented for an **object** ID code. The NPC seed is a numeric value. The local save observations should be retained separately from public reports because they contain personal save details.

## Event candidates verified against source

`event.object` and `event.param*` below are the meanings documented by `libraries/common.xsd`. A generic event needs type and state checks before receiving a more specific Life Signs label.

| Question | Event and source | Supported observation and qualification |
| --- | --- | --- |
| Ship finishes docking | `event_object_docked`, `common.xsd:13924-13935` | `object` is docking object; `param` is dock object, with zone and bay in `param2/3`. Distinct from `event_object_docking_started` at 13938. `event_object_docked_at` at 13952 reverses the perspective: container is `object`, docking object is `param`. |
| Ship undocks | `event_object_undocked`, `common.xsd:14709-14720` | Undocking object, dock, zone and bay. |
| Ship is attacked | `event_object_attacked`, `common.xsd:13040`; `md/rml_retrieveitem.xml:91-101` | Shipped cue listens for attack on `$TargetShip` and reads `event.param` as attacker. This supports a tracked-ship attack trigger; it does not imply every action or every damage detail is logged. |
| Ship destroys another ship | `event_object_killed_object`, `common.xsd:14445-14455` | Killer is `object`, killed object/component is `param`, method is `param2`. Check both sides are ships before labelling ship-to-ship combat. |
| Ship is destroyed | `event_object_destroyed`, `common.xsd:13910-13920` | Destroyed object is `object`, killer is `param`, method is `param2`. Filter the object as a ship. |
| Actor/component is destroyed; person death unresolved | `event_object_destroyed`, same schema; `md/setup.xml:830-832` | A shipped cue watches `parent.$actor` with this event. This establishes a component-destruction observation, not confirmed gameplay-person death. Temporary actor cleanup or representation turnover must be distinguished from death; the cited usage does not establish that semantic boundary. An unavailable retained reference likewise does not prove death. |
| Ship is abandoned / pilot ejects | `event_object_abandoned`, `common.xsd:13134-13143`; `md/rml_retrieveitem.xml:94-98` | Reports the **ship** being abandoned by its NPCs. The example calls it pilot ejection. It does not supply the identity of each escaping NPC and must not be used as a normal crew-transfer departure event. |
| Control entity takes/leaves a post | `event_control_entity_added` and `event_control_entity_removed`, `common.xsd:12575-12594` | Generic controllable/entity relationship. Inspect the tracked ship or station and the resulting post to determine pilot or manager changes. The event name alone does not say promotion, demotion or reassignment. |
| Player requests an NPC assignment | `event_player_assigned_hired_actor`, `common.xsd:16469-16479` | Reports actor, target object and post or role. The documentation says actual assignment **happens as a result of** the event, so it is not proof that movement and assignment completed. Scope is player assignment, not every autonomous role change. |
| Ship gains a commander | `event_object_commander_set`, `common.xsd:13773-13783` | Subordinate, new commander, previous commander and new assignment are available. |
| Commander gains a subordinate | `event_object_subordinate_added`, `common.xsd:14629-14640` | New commander, subordinate and assignment are available. Check assignment before calling it an escort relationship. `event_object_subordinate_promoted` at 14643 describes a narrower promotion of a subordinate in place of an old commander; it does not establish a general fleet-leader event. |

The schema enumerates NPC roles `service`, `marine`, `passenger`, `prisoner`, `trainee_group`, `worker`, `unassigned` at `common.xsd:4517-4526`; control posts include `aipilot`, `defence`, `manager`, `engineer`, `shadyguy`, `shiptrader`, `trainee_individual` at `common.xsd:3561-3572`. These are schema values, not a complete account of every player-facing job title. For example, calling every `defence` post a marine or every `shadyguy` a pirate would overstate the cited lines. “Admiral” needs a separate mapping to fleet state and/or post semantics.

## Gaps and the next evidence needed

The one-question searches did **not** verify a general event for transfer requested, ordinary NPC departure, arrival after transfer, completed NPC-to-ship/station assignment, arbitrary crew role change, or becoming fleet leader. The snippets found for arrival described actions such as scheduling a transfer pod, not an arrival notification. Failure to find a matching event within the bounded corpus search does not prove none exists.

Before claiming an NPC career timeline, test a small observer against controlled in-game changes. For each step record the tracked NPC's seed and current representation, current ship/station, role and control post, both ships' and station's ID codes, event names and `event.object/param*` values, and the actual result after any transfer delay. Capture previous role/location before overwriting current state. Verify the ordinary-crew and actual-actor paths separately, then save/reload and repeat. The ship destruction case must establish whether the NPC died, escaped, became uninstantiated, or was reassigned; the ship's destroyed event alone cannot decide this.

No new probe, production routing, model runtime, or database schema was implemented by this research.
