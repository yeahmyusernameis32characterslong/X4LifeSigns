# NPC object profile reference

Updated: 2026-10-18. **Implemented in the snapshot-only collector with
automated/static checks; native results and coverage remain unverified.**
Recorder baseline inspected: `63de14d5631e61d4ec691c0e13f59ac1c1fa7178`.
This living reference defines requested fields and current collection candidates.
It is not a database schema. See the [collector implementation](OBJECT_PROFILE_COLLECTOR_IMPLEMENTATION.md)
for the output fields, current checks and remaining native gates.

## Collection model

The owner-directed passes are [stations](OBJECT_PROFILE_STATIONS.md),
[ships](OBJECT_PROFILE_SHIPS.md), then NPCs. Each NPC receives an independent
profile; it is not subordinate output nested within a ship's profile.
Discovering a candidate through a personnel list is distinct from deciding when
and how to build its profile. Complete independent NPC discovery remains open,
including NPCs outside ships/stations and those associated with spacesuits.

Do not infer engine non-instantiation, missing generated identity information or
role-based exclusion from an incomplete recorder. The former recorder omitted
documented contextual name/macro/race fields and direct actor seed. A missing
field can mean unrequested, unavailable, unsupported, NULL or a failed read;
these must remain distinct observations.

## Requested fields

`$NPC` is a validated actual actor reference. `$Host` is the object providing a
contextual personnel entry and `$Template` is its raw template value. Complete
`$Host.people.{$Template}.<field>` chains are required: the intermediate
npctemplateentry is a pseudo-type and must not be assigned to a script variable.
Source locations below refer to the installed X4 9.00 reference.

| Requested field | Actor collection candidate | Contextual personnel candidate and limitations | Source |
| --- | --- | --- | --- |
| Seed | `$NPC.seed` | `$Host.people.{$Template}.seed`. Read it; never infer it from template numeric text. Actor/contextual equivalence and lifetime require evidence. | `scriptproperties.xml:48,1358,2047` |
| Idcode | Standalone NPC `.idcode` getter remains unverified; also collect `$NPC.debugname` as raw diagnostic evidence | Owner-supplied save evidence confirms a code exists for an NPC. Inherited debugname is documented to include name, idcode and ID, but its actual NPC output and safe extraction of a standalone code need verification. No contextual idcode property is documented. | `scriptproperties.xml:54,198,1358,1427-1429,2042-2068` |
| NPC name | `$NPC.knownname` | `$Host.people.{$Template}.name`. Lack of a captured actor is not proof that the contextual name is unavailable. | `scriptproperties.xml:52,2049` |
| Race | `$NPC.race.name` | `$Host.people.{$Template}.race.name`. | `scriptproperties.xml:1369,1884,2050` |
| Sector name | `$NPC.sector.name` | `$Host.sector.name` is only a host-derived location candidate when onboard presence is established. Do not assert it as actual NPC location during transit or from assignment alone. | `scriptproperties.xml:40,50,394-398,1253,1309,2055` |
| Idcode of assigned ship | `$NPC.roleobject.idcode` or `$NPC.assignedcontrolled.idcode`, preserving which relationship applies | `$Host.idcode` supplies a contextual roster relationship if the host is a ship. Validate type and relationship semantics; manager assignment can be to a station, and current container is not automatically assignment. | `scriptproperties.xml:198,373,377-379,1364,1401` |
| Service crew / marine role | `$NPC.role` and `$NPC.role.name` | `$Host.people.{$Template}.role` and its `.name`; preserve NULL or unavailable instead of guessing. | `scriptproperties.xml:1363,2053,2271` |
| Captain / pilot / manager post | `$NPC.controlpost` and `$NPC.controlpost.name` | No equivalent contextual controlpost property found. Retain actor/control-assignment evidence where available; do not reinterpret an entityrole as a controlpost. | `scriptproperties.xml:314-315,1362,2293` |

## Discovery and ownership questions

- Comprehensive NPC enumeration has not been verified. Investigate appropriate
  discovery mechanisms instead of assuming personnel lists are the only option.
- A literal MD `player.owned` collection was not found in the reviewed
  script-property reference. This is not proof that no equivalent API exists.
  Check exact syntax, API layer, returned types and coverage before rejecting
  ownership-based discovery or claiming it enumerates every player NPC.
- Component `.isplayerowned` is a documented true-owner test
  (`scriptproperties.xml:74`), not itself an enumerator. It can filter an actual
  discovered component; do not invent that getter on a raw template/pseudo-entry.
- Keep discovery provenance, available representations and ownership evidence
  in each profile. Do not force actor creation merely to obtain a crew name.

## Save code, component ID and seed

An owner-supplied NPC save component contains both an AAA-123-format `code`
attribute and a bracketed hexadecimal `id` attribute. This is evidence that the
specific saved NPC has a code; missing MD getter documentation or an unavailable
recorded `.idcode` read must not be described as proof NPC codes do not exist.
The private example's name and actual identifiers are intentionally not copied.

Component `.debugname` (`scriptproperties.xml:54`) is documented as combining
knownname, idcode and ID. NPC actors inherit it through entity/component. Record
its complete raw value as an additional candidate observation rather than
assuming a delimiter, parsing a permanent ID, or promising it exposes every NPC
code in practice. Actual output and any standalone getter still need validation.

The bracketed hex save ID resembles a component reference, not an established
encoding of the seed. Converting hex to decimal only changes notation; it does
not prove that value equals `.seed`. Preserve saved code, component reference,
raw debugname and the separately requested actor seed as distinct evidence.
The reviewed corpus has not established save-ID/runtime-reference equivalence
or lifetime across all lifecycle operations.

## Identity, availability and validation

- Validate actual actor references, contextual entry existence and each terminal
  getter. A pseudo entry is tested through its documented terminal properties.
- Preserve large seeds exactly, observation time and collection/run context.
  Neither seed wording nor same-run associations prove universal uniqueness,
  cross-save permanence, or raw-template interchangeability with actor seeds.
- Match representations only with explicit evidence. Actor `.npctemplate`
  (`scriptproperties.xml:1430`) is an association candidate; retain ambiguity.
- Profile completeness must be measured against requested fields. An existing
  recorder's partial=0 flag does not prove every supported NPC field was read.
- Verify discovery, native getters, relationship meanings and lifecycle cases
  before declaring complete player-NPC coverage. No database key or migration
  is selected by this reference.

## Evidence provenance and maintenance

Qwen researched the authorised corpus; consequential expressions and inheritance
were checked against the actual X4 9.00 reference. Corrected model drafts are
not independent runtime proof. Vendor files and raw log/model evidence remain
local and are not published here.

- `libraries/scriptproperties.xml` SHA256:
  `1b641b638c8892284bbf5943f9ed283e0adf79f696341a2f00a2361f16485a8f`.

Add/correct fields, evidence and verification status here as research proceeds.
The [snapshot-only collector](OBJECT_PROFILE_COLLECTOR_IMPLEMENTATION.md) now
requests these fields. This source implementation does not establish native
getter success or authorise deployment or a test.
