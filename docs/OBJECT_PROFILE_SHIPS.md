# Ship object profile reference

Updated: 2026-10-18. **Implemented in the snapshot-only collector with
automated/static checks; native results and coverage remain unverified.**
Recorder baseline inspected: `63de14d5631e61d4ec691c0e13f59ac1c1fa7178`.
This living reference defines requested fields and current collection candidates.
It is not a database schema. See the [collector implementation](OBJECT_PROFILE_COLLECTOR_IMPLEMENTATION.md)
for the output fields, current checks and remaining native gates.

## Collection model

The owner-directed order is [stations](OBJECT_PROFILE_STATIONS.md), ships, then
[NPCs](OBJECT_PROFILE_NPCS.md), each producing independent object profiles.
The ship pass reads ship details and scalar relationship identifiers/counts;
it does not recursively build personnel profiles as subordinate ship records.
A snapshot can span ticks; preserve each profile's observation time.

## Requested fields

`$Ship` is a validated ship reference. For these assigned-relationship fields:

- `$Captain` is `$Ship.assignedcontrolentity.{controlpost.aipilot}`.
- `$Pilot` is `$Ship.assignedpilot`.
- `$Commander` is `$Ship.commander`, the immediate commander if present.

Captain and pilot references can identify the same actor. These are assignment
reads; `$Ship.pilot` reports the current pilot and `$Ship.assignedaipilot` selects
the assigned AI pilot. Do not silently equate these meanings or assume every
pilot reference is an NPC. Validate the returned reference/type before enrichment.
Source locations below refer to the installed X4 9.00 reference.

| Requested field | Documented collection candidate | Meaning and limitations | Source |
| --- | --- | --- | --- |
| Seed | `$Ship.seed` | Persistent pseudo-random seed; not proof of universal uniqueness. | `scriptproperties.xml:48` |
| Idcode | `$Ship.idcode` | Object ID code inherited by ships. | `scriptproperties.xml:198,301,426,654,767` |
| Ship name | `$Ship.knownname` | Individual name, including custom naming. | `scriptproperties.xml:50-52` |
| Ship model name | `$Ship.macro.name` | Macro's display name, separate from the individual ship name. | `scriptproperties.xml:30,2072` |
| Sector name | `$Ship.sector.name` | Display name of the observed sector, if available. | `scriptproperties.xml:40,50,1253,1309` |
| Captain seed | `$Captain.seed` | Read directly from a validated assigned actor; do not derive it from template text. | `scriptproperties.xml:48,315,1358`; `common.xsd:3565` |
| Pilot seed | `$Pilot.seed` | Assigned-pilot actor seed; keep current-pilot versus assigned-AI-pilot distinctions explicit. | `scriptproperties.xml:48,302-305,1358` |
| Number of personnel onboard | `$Ship.availablepeople.count` supplies a currently onboard template-personnel count | **Partial answer:** a complete total including separately represented control actors is not verified. `$Ship.people.count` is another documented template-personnel count; neither is proven to be an inclusive headcount. | `scriptproperties.xml:374,395` |
| Commander idcode | `$Commander.idcode` | Immediate commander, not top-level fleet commander. It can be a station; record type and do not mislabel it as a ship. | `scriptproperties.xml:198,332-333,355` |
| Role in fleet | `$Ship.assignment` and `$Ship.assignment.name` | Assignment under its commander, including Defence, Interception and Bombardment. Not an NPC role or the ship's instantaneous AI command. | `scriptproperties.xml:334,2305-2308`; `common.xsd:3682,3696,3703` |

## Personnel-count boundary

The requested field is the number of people onboard, not a count of raw rows,
actor aliases, crew capacity or inbound transfers. Do not blindly add
`people.count`, `roleentities.count`, captain and pilot: an instantiated actor
can represent a personnel entry and captain/pilot can be the same actor.
The exact inclusive counting rule remains open. Preserve named source counts
and their meanings until it has been verified.

## Read and identity rules

- Check actor, commander and sector references before terminal reads. Preserve
  missing relationships, NULL, unsupported fields and failed reads separately.
- Keep large seeds exact, plus collection/run context and observation time.
  Matching names, references or seeds alone do not prove permanent identity.
- Keep captain and pilot link fields even when equal; equality is evidence of
  an alias, not a reason to invent two people or discard relationship meaning.
- Template-only or missing actor output describes collected evidence. It does
  not prove X4 lacked that NPC's information or actor representation.

## Open work and maintenance

Verify discovery scope, captain/pilot relationship semantics, actual getter
results, complete onboard counting and any exact UI fleet-label mapping before
claiming native correctness. Record corrections and field-by-field evidence in
this table. Retain unavailable requested fields as visible gaps.

## Evidence provenance

Qwen corpus research was followed by targeted source/type checks. Draft claims
that sector names or model display names were unsupported were rejected against
the actual definitions. Vendor files and raw model/log evidence remain local.

- X4 9.00 `libraries/scriptproperties.xml` SHA256:
  `1b641b638c8892284bbf5943f9ed283e0adf79f696341a2f00a2361f16485a8f`.
- X4 9.00 `libraries/common.xsd` SHA256:
  `8eec878511d06dd2be88a7054eb54556b29e481bf0feba20fe2cf3c6eabd3452`.

The [profile collector](OBJECT_PROFILE_COLLECTOR_IMPLEMENTATION.md) implements
these reads with explicit uncertainty for inclusive personnel count. Native
acceptance and existing database contracts are unaffected by the source checks.
