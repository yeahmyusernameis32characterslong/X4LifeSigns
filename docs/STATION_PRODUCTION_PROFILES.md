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
Sparse refresh hooks and shipyard resource-method coverage remain under research.

## First implementation unit

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

Offline checkpoint: all99 recorder tests pass, including six new station tests.
The installed X4 schema gate passes; native getter execution still needs a
separately authorised owner test. Further refresh integration and SQLite
round-trip checks are in progress.

No native execution or new deployment is claimed by these source findings.
