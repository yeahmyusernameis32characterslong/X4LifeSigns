# Station object profile reference

Updated: 2026-10-18. **Implemented in the snapshot-only collector with
automated/static checks; native results and coverage remain unverified.**
Recorder baseline inspected: `63de14d5631e61d4ec691c0e13f59ac1c1fa7178`.
This living reference defines requested fields and current collection candidates.
It is not a database schema. See the [collector implementation](OBJECT_PROFILE_COLLECTOR_IMPLEMENTATION.md)
for the output fields, current checks and remaining native gates.

## Collection model

The owner-directed profile collection has three separate passes:

1. Stations, producing independent station profiles.
2. Ships, producing independent [ship profiles](OBJECT_PROFILE_SHIPS.md).
3. NPCs, producing independent [NPC profiles](OBJECT_PROFILE_NPCS.md).

Give each discovered object its own profile. The station pass collects station
details and scalar relationship identifiers, including its manager's seed; it
does not recursively collect that manager's full profile. NPC discovery and
profile construction are separate concerns. A snapshot is one collection pass
set, potentially spanning ticks, not a guarantee of simultaneous world state.

## Requested fields

`$Station` is a validated station reference. `$Manager` is the actual entity
returned by `$Station.assignedcontrolentity.{controlpost.manager}`, if present.
Expressions below identify reads, not executable unguarded collection code.
Source locations refer to the installed X4 9.00 reference, not files in this repo.

| Requested field | Documented collection candidate | Meaning and limitations | Source |
| --- | --- | --- | --- |
| Seed | `$Station.seed` | Persistent pseudo-random seed; global uniqueness and lifetime across every lifecycle are not established. | `scriptproperties.xml:48` |
| Idcode | `$Station.idcode` | Object ID code. Station inherits this property through container, defensible, controllable and object. | `scriptproperties.xml:198,301,426,654,848` |
| Station name | `$Station.knownname` | Individual display name ignoring unknown status, including custom naming. | `scriptproperties.xml:50-52` |
| Station type | `$Station.primarypurpose.name` | Functional classification. `$Station.macro.name` is a separate model/design display label; retain both if needed. An exact UI station-type equivalent is not yet verified. | `scriptproperties.xml:30,184,2072,2312-2313` |
| Sector name | `$Station.sector.name` | Resolve the sector reference and its display name. Sector inherits component name via space. | `scriptproperties.xml:40,50,1253,1309` |
| Manager seed | `$Manager.seed` | Read directly from the assigned manager actor; a missing manager is an explicit missing relationship, not a fabricated seed. | `scriptproperties.xml:48,315,1358`; `common.xsd:3567` |

## Read and identity rules

- Validate references and check field availability before using these chains.
  Distinguish no manager assigned, NULL, unsupported field and failed read.
- Record seed values without lossy numeric conversion. Formatting and native
  read success need verification; a documented getter is not a runtime result.
- Include observation time, collection/run context and discovery provenance.
  Cross-reference manager identity without assuming names are unique.
- Seed persistence wording does not establish a permanent global database key.
  Do not change the existing database or production identity contract here.

## Open work and maintenance

- Verify the station discovery scope, including non-operational owned stations,
  against the newer collector's intended coverage. Existing recorder enumeration
  is a reference, not proof of complete profile discovery.
- Verify manager lookup, seed read, names, field states and station-type meaning
  in the later approved validation.
- Keep these rows current with exact expressions, evidence and verification
  status. Correct unsupported assumptions explicitly rather than deleting the
  requested field or treating an unrequested field as absent from X4.

## Evidence provenance

Qwen corpus research was followed by targeted source checks. Draft model errors
about station idcode inheritance and sector-name support were corrected against
the actual type definitions. Extracted vendor files and raw model/log evidence
remain local and are not included in this repository.

- X4 9.00 `libraries/scriptproperties.xml` SHA256:
  `1b641b638c8892284bbf5943f9ed283e0adf79f696341a2f00a2361f16485a8f`.
- X4 9.00 `libraries/common.xsd` SHA256:
  `8eec878511d06dd2be88a7054eb54556b29e481bf0feba20fe2cf3c6eabd3452`.

The [former recorder](BROAD_EVENT_RECORDER_IMPLEMENTATION.md) used nested asset
collection. The current [profile collector](OBJECT_PROFILE_COLLECTOR_IMPLEMENTATION.md)
implements the three passes; these source references do not establish native
success or authorise deployment.
