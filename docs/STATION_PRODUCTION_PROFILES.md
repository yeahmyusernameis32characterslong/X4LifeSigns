# Station production and resource profiles

Owner-authorised work, 7 November 2026. Implemented with automated/static
verification on `feat/station-production-profiles`, based on PR31 at `d27f4de`.
Implementation/testing are authorised; deployment, gameplay and merge are separate.

## Scope

Add station module identities/types, produced ware types and required resource
ware types. Include storage transport categories and habitation supply types,
keeping their meaning separate from manufacturing inputs. No stock quantities,
ware amounts, trade-offer amounts, recipe amounts or production rates.

Existing profile history remains immutable. New scalar VALUE fields fit the
existing profile protocol/SQLite schema; no migration is proposed. Existing
stations need a paced targeted profile upgrade after database readiness, with
saved acknowledgement tracking. Ships/NPCs do not need another whole baseline.
The existing 16,384-value per-profile ceiling stays a ceiling, never a target;
incomplete observations must remain explicit.

## Verified source findings

References are to the authorised X4 9.00 source corpus, which stays local.

| Source | Supported observation and caution |
| --- | --- |
| scriptproperties.xml:556-558 | modules.operational.list and modules.construction.list materialise existing component lists. This does not enumerate every future build-plan entry. |
| scriptproperties.xml:632-641 | Separate production/storage/build/processing/habitation and other module lists exist. |
| scriptproperties.xml:692-711 | Container products, resources, supplyresources and tradewares provide separate declared ware-type catalogues via .list. These are not inventory amounts. |
| scriptproperties.xml:1118-1136 | Production and processing modules expose products/resources as warelist pseudo-types. Read .list terminal to obtain a normal script list, never store the pseudo-type itself. |
| scriptproperties.xml:1104-1109 | Habitation modules expose workforce race and resource ware types. These are workforce supplies, not manufactured outputs. |
| scriptproperties.xml:1139-1142 | Storage modules expose waretransport categories. Storage compatibility is not a production recipe. No cargo lookup is required. |
| scriptproperties.xml:1897-1899,1987-1995 | Ware ID/name and warelist.list provide scalar identities without amounts. |
| scriptproperties.xml:997-1047 | Build modules expose buildable ship/equipment ware catalogues; buildresources needs a particular build. Do not substitute current shortages for a complete resource catalogue. |
| scriptproperties.xml:1948-1955 | Ware.resources is a default-method recipe; this must not be silently described as the station's selected method. |

Qwen independently researched UI and MD source. Initial tool-based passes ended
without a written conclusion; raw journals remain incomplete rather than proof
of absence. Codex verified the consequential property declarations directly.
Qwen's focused synthesis was checked against the schema: param is a build
processor, not a completed module; param2 is the list of completed components,
param3 is the build task. No name-based matching is necessary. Its suggestion
to guess build materials from a generic resource list was rejected.

The sparse module completion route is backed by common.xsd:15152-15162 and
rml_buildstation.xml:391-404, resolving the station via param.buildanchor.
Object destruction supports a group selector (common.xsd:13910 onward).
Native scheduling and coverage remain an owner live-test gate.

## Collection and refresh

The generated collector records module macro IDs, display names, real classes
and operational/construction state; per-module production/processing outputs
and inputs; habitation race and supply types; storage transport categories;
and separate station product/resource/supply/trade ware catalogues. Class
selectors use `storage` and `habitation`, not their datatype names.
Build-module resource coverage is explicitly marked build-specific rather than
expanding every ship/equipment blueprint or guessing a default recipe.

Existing stations receive a paced targeted upgrade after database readiness.
Only a database-acknowledged, fully observed metadata revision is saved as
complete. Partial profiles are not retried repeatedly in the same run. The
existing value ceiling stops further getters and preserves explicit partials.
No SQLite schema change, inventory getter, station/ship/NPC discovery rewrite,
personnel rescan or deployed file change is included.

Module completion marks the affected station dirty; ship-build callbacks are
excluded. An enrolled-module destruction callback uses its cached host, even if
the module reference is no longer live. Requests coalesce by station seed, then
use the existing serial profile queue after readiness. A change arriving before
an earlier acknowledgement remains pending. Ownership is rechecked before
refresh reads. Module-loss watches are restored on load even when the saved
metadata revision means another profile is unnecessary. No hit/damage listener,
periodic whole snapshot or periodic station profile scan is added.

New observations create immutable profile versions. SQLite's existing ancestry
projection selects the appropriate version for each saved branch. Older rows
are retained and historical missing production fields are not filled with
current values.

## Recorded fields

Indices are local to one observation, not persistent module identities.
Module counts describe components; ware counts describe listed types, not units
held in storage. Existing station identity and manager fields remain.

| Fields | Meaning |
| --- | --- |
| station_production_version / station_production_complete | Metadata revision and whether its declared observations completed. Not a guarantee that every possible shipyard recipe was enumerated. |
| station_module_scope / station_ware_scope | Existing operational/construction components and declared types, excluding inventory and rates. |
| station_modules_operational_count / station_modules_construction_count | Number of existing module component instances in each state. |
| module_N_macro / module_N_name / module_N_class / module_N_state | Internal macro ID, display name, real class and observed module state. |
| module_N_product_count / module_N_product_I_id / module_N_product_I_name | Production/processing output types. |
| module_N_resource_count / module_N_resource_I_id / module_N_resource_I_name | Production/processing input types, retaining their module association. |
| module_N_workforce_race / module_N_workforce_resource_count / module_N_workforce_resource_I_id / module_N_workforce_resource_I_name | Habitation race and workforce supply types. |
| module_N_storage_transport_count / module_N_storage_transport_I | Storage categories such as container, solid or liquid; not stocked wares. |
| module_N_build_resource_scope | BUILD_SPECIFIC_NOT_ENUMERATED for build modules. No default-method recipe is invented. |
| station_product_count / station_product_I_id / station_product_I_name | Station-wide declared produced ware types. |
| station_resource_count / station_resource_I_id / station_resource_I_name | Station-wide declared inputs, including intermediate types. |
| station_supply_resource_count / station_supply_resource_I_id / station_supply_resource_I_name | Unit/ammunition supply resource types, separate from production. |
| station_trade_ware_count / station_trade_ware_I_id / station_trade_ware_I_name | Additional traded ware types that are neither product nor resource. |

## Limits and native acceptance

- Future plan-only modules without a component are outside the scope. A module
  under construction may not yet expose operational recipe data; unavailable
  getters are explicit partial observations, not empty recipes.
- Build modules are identified, but a complete station-selected ship/equipment
  recipe catalogue is not enumerated. The UI uses GetContainerBuildResources
  (menu_station_overview.lua:178,193,577-583); no unverified Lua transport or
  default-ware recipe substitution is introduced here. Station resource types
  retain their documented container meaning, without claiming a complete
  shipyard recipe. This specialised catalogue remains a follow-up.
- Production/build method changes and deconstruction without a destruction or
  completion callback are not proven refresh triggers. Do not claim coverage.
- Native optional getters, construction state behaviour, module destruction
  registration, save/load refresh and performance require an owner-approved
  X4 test. This work does not authorise deployment or gameplay.

## Validation

- node --test recorder/test/*.test.mjs: 104/104 pass, including eleven station
  tests for quantities exclusion, limits, upgrades, ACK races, ownership,
  restoration of watches and real SQLite replay/checkpoint/branch behaviour.
- npm test --prefix profiles: 217/217 pass on disposable fixtures.
- npm test --prefix bridge: 112/112 pass on disposable fixtures.
- scripts/validate-event-recorder.ps1: passes against hash-checked installed
  X4 9.00 md.xsd/common.xsd, with two new scoped hooks explicitly reviewed.
- Generated artifact matches the compiler; diff/privacy checks pass.

Source provenance: scriptproperties.xml SHA256
1b641b638c8892284bbf5943f9ed283e0adf79f696341a2f00a2361f16485a8f;
schema hashes remain pinned in the validation script. Raw corpus and model
research stay local. No native execution or deployment is claimed.
