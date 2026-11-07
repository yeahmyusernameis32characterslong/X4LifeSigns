# Station production and resource profiles

Owner-authorised work, 7 November 2026. In progress on
`feat/station-production-profiles`, based on PR31 at `d27f4de`.
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
The existing16384-value per-profile ceiling stays a ceiling, never a target;
incomplete observations must remain explicit.

## Verified source findings

References are to the authorised X4 9.00 source corpus, which stays local.

| Source | Supported observation and caution |
| --- | --- |
| scriptproperties.xml:556-558 | modules.operational.list and modules.construction.list materialise existing component lists. This does not enumerate every future build-plan entry. |
| scriptproperties.xml:632-641 | Separate production/storage/build/processing/habitation and other module lists exist. |
| scriptproperties.xml:1118-1136 | Production and processing modules expose products/resources as warelist pseudo-types. Read .list terminal to obtain a normal script list, never store the pseudo-type itself. |
| scriptproperties.xml:1104-1109 | Habitation modules expose workforce race and resource ware types. These are workforce supplies, not manufactured outputs. |
| scriptproperties.xml:1139-1142 | Storage modules expose waretransport categories. Storage compatibility is not a production recipe. No cargo lookup is required. |
| scriptproperties.xml:1897-1899,1987-1995 | Ware ID/name and warelist.list provide scalar identities without amounts. |
| scriptproperties.xml:997-1047 | Build modules expose buildable ship/equipment ware catalogues; buildresources needs a particular build. Do not substitute current shortages for a complete resource catalogue. |
| scriptproperties.xml:1948-1955 | Ware.resources is a default-method recipe; this must not be silently described as the station's selected method. |

Qwen independently researched UI and MD source. Initial tool-based passes ended
without a written conclusion; raw journals remain incomplete rather than proof
of absence. Codex verified the consequential property declarations directly.
Sparse refresh hooks and shipyard resource-method coverage remain under research.

No native execution or new deployment is claimed by these source findings.
