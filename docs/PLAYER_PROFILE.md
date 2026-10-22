# Player profile

## Authorised task and plan

The owner requested a separate player profile, including support for existing
saves and universe databases. Starting revision: `350148a` on draft PR20,
`feat/sqlite-object-profiles`. Research uses Qwen with targeted source checks.
Implementation and automated tests are authorised; deployment, a Codex game
launch and merge are outside this task. The slowdown investigation stays parked.

Use the existing profile/event stream and SQLite tables. Add the `PLAYER` kind
without changing the database schema or existing NPC identities. Capture one
player profile for each new recorder run after the database handshake and
listener preparation. An existing ready database must gain this profile without
repeating station, ship or NPC discovery. A new database includes it in its
initial profile count. Saved committed ancestry continues to select history.

Read player identity directly, independently of the NPC personnel pass. Keep
location, current controlled object and pilot-seat occupancy separate. Never
infer player piloting from an absent NPC captain. Missing values remain unknown;
do not manufacture a seed or reconstruct earlier unobserved player history.

Planned work units:

1. Verify identity, pilot-seat and native control/location sources with Qwen.
2. Add player profile/state capture and the additive store kind support; generate
   MD and cover initial database creation and existing-save database reuse.
3. Verify transitions, unavailable identities, escaping/exact seeds, saved
   ancestry, retry/replay and acknowledgement continuity. Record any native
   coverage limits explicitly.
4. Run Node/bridge tests, installed X4 9.00 MD/addon schema validation and the
   existing native-reader/Lua fixture. Review privacy and production isolation;
   publish the implementation report and stop before deployment.

## Verified source foundations

Installed X4 9.00 `libraries/scriptproperties.xml`:

| Source | Meaning |
| --- | --- |
| `player.entity`, line 2421 | Player component; bypass the NPC-only discovery filter. |
| `player.name`, line 2407 | Player character name. |
| Component `seed`/`debugname`, lines 48/54 | Identity observations, preserving exact engine text and availability. |
| `player.container`, line 2413 | Physical ship/station context; does not establish piloting. |
| `player.occupiedship`, line 2416 | Ship whose pilot seat the player occupies, or null. |
| `player.spacesuit`, line 2417 | Separate spacesuit observation. |
| `player.controlled`, line 2418 | Current controlled object; not necessarily the physical location. |
| `player.sector`, line 2423 | Sector context; may be null in a superhighway. |

Native event coverage and exact parameter contracts are still under research at
this planning checkpoint. Source support and automated results do not establish
actual delivery or seed persistence across native reloads. Older saves without
a valid committed post-baseline checkpoint retain the existing refusal; this
feature must not waive ancestry validation to make an old save appear supported.

This exercises adding a new profile type to an existing database. It does not
by itself verify the separate native event hooks for newly created NPCs.
