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


## Profile/storage increment

The separate `PLAYER` kind is implemented in the existing version-1 profile
schema; no DDL or migration. Player identity, name/race/debug name, sector,
pilot-seat ship, physical container, controlled object and spacesuit reference
are recorded with the existing availability and value-budget conventions.
The NPC discovery filters are unchanged. ID code, when present in debugname,
is derived offline using the same rule as NPCs.

At first database creation the player profile is part of the baseline count.
For an existing ready database the serial processing tick adds one current
player profile for that recorder run, without the welcome/completion panels or
another whole asset snapshot. A saved newer checkpoint includes that profile;
older checkpoints do not gain it retrospectively. Repeated loads refresh the
observation, and the existing profile projection selects the latest version
along that save's ancestry. Missing player component waits for a valid one.

The focused initial/core gate passed 52 tests, including a real SQLite fixture
created from an old NPC-only baseline, addition of PLAYER, another saved reload,
exact 64-bit identities, schema version/integrity and historical exclusion.
Generated MD validates against the pinned installed 9.00 schemas. Native
control/location trigger wiring and complete regression checks follow in the
next increment; no deployment or gameplay validation is claimed.

## Control and location history increment

The following native hooks are appended to the existing listener catalog. The
original 48 retired cue names and all existing active listener indices remain
stable; new hooks use new children of the current bus.

| Native source (`libraries/common.xsd`) | Recorded player event | Captured native fact |
| --- | --- | --- |
| `event_player_started_control`, 15990–15998 | `PLAYER_STARTED_CONTROL` | Controlled object from `event.param`. |
| `event_player_stopped_control`, 16001–16009 | `PLAYER_STOPPED_CONTROL` | Object whose control stopped, from `event.param`. |
| `event_player_changed_activity`, 15265–15275 | `PLAYER_ACTIVITY_CHANGED` | New and previous activity. |
| `event_player_teleport_successful`, 15315–15333 | `PLAYER_TELEPORT_REPORTED` | New/previous room and explicit shortcut flag; a shortcut is not asserted to be a real teleport. |
| `event_player_ejected`, 15365–15374 | `PLAYER_EMERGENCY_EJECTED` | Emergency ejection notification; does not manufacture a new location. |

Native facts are small `PLAYER` events at callback game time. They retain
start/stop events even if several arrive before the next processing tick. A
callback also requests a serial state observation, keeping profile emission
out of the callback. The next observation independently reads pilot-seat ship,
controlled object, physical container, spacesuit and sector. Getter timing
relative to callbacks is not guaranteed by the inspected schemas.

Changed observations emit `PLAYER_STATE_CHANGED` with
`observation=DEFERRED_CURRENT_STATE`, including prior/current relationship
identifiers and getter-availability flags. Rapid transitions can coalesce into
one observed final state; intermediate seat/location states are not invented.
Previous asset identifiers are cached when observed, so a later invalid or
destroyed component does not erase the last observed link.

A player-only fallback checks those same scalar relationships at most once per
advancing game second, including during the finer NPC processing interval.
Unchanged states emit no rows. It covers later-observed sector/container changes
without scanning personnel or assets; it does not promise every transient
transition or continuous coverage while paused. No repeated full player profile
is emitted for each event. `profilesAt()` returns the session's profile
observation; subsequent state changes remain in chronological `eventsAt()`.

Qwen independently located the primary definitions. Its two tool passes ended
without a prose answer; focused synthesis was partly truncated. Consequential
claims were checked directly. The suggestion to set occupancy/location merely
because ejection fired was rejected: only actual getters establish the observed
state. No generic guaranteed state-consistency claim is made for the fallback.

## Final automated gate and native limits

- 96 Node collector/SQLite tests passed. Eight player tests cover old-database
  addition/reload, exact seed text, escaping, unknown versus absent pilot seat,
  native facts versus coalesced observations, destroyed previous references,
  bounded idle checks, SQL event persistence and idempotent replay.
- 112 bridge tests passed.
- Generated MD and extension-root addon XML validated against pinned installed
  X4 9.00 schemas.
- The standalone installed LuaJIT/actual native-reader fixture passed. The tested
  reader binary matches the installed binary; neither DLL nor Lua changed.

The player fields, native delivery, callback/getter timing, player-seed continuity
and performance still need owner-run X4 verification after an approved deployment.
The earlier pre-invalidation startup limitation remains; this feature does not
claim to fix it. Missing fields retain their availability states. No old NPC
records are retroactively assigned to the player, and native creation-event
coverage for newly introduced NPCs remains a separate unverified gate.

Deployment must update both the optional MD and companion consumer, since an
older consumer rejects the new `PLAYER` kind. No deployment was performed for
this task. The slowdown idea remains parked, and no production component,
database schema, saved lineage format, damage hook or launch setting changed.

## First owner gameplay check and boolean literal correction

The owner-tested deployment at `1f567e1` added one PLAYER profile to an existing
ready database without repeating the whole snapshot. All 5,115 new-run raw rows
exactly matched contiguous SQLite records; integrity_check was ok. X4 and the
SQLite worker closed normally. The owner remained aboard the fleet command ship
outside its pilot seat, matching the recorded container and absent occupied ship.
No player control/location events were recorded; those transition paths remain
untested. One observed player seed matches an earlier ship pilot observation;
this is not a universal identity-stability guarantee.

Native parsing exposed `@true` in the generated `is_player` value. The optional
lookup operator requires a property lookup, so that marker was null despite the
other identity/location fields being captured. The generator now emits boolean
literals directly. Generated XML, the harness and PowerShell validator include
a regression guard for both boolean literals. All 96 collector/SQLite tests and
installed X4 9.00 MD schema validation pass. This correction is source-only,
not yet deployed or verified in X4. DLL, Lua, companion and schema are unchanged.

The known pre-invalidation startup limit recurred: 177 restored NPC callbacks
appended to an older raw log. Its original byte prefix and all 3,880 existing
SQL rows remained unchanged; automatic old-file filtering excluded the appended
rows. Do not treat those callbacks as confirmed new NPC births or replay the old
file. Startup isolation remains open. The run also retained unrelated existing
startup diagnostics; it is not classified as error-free.
