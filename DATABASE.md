# X4LifeSigns persistence requirements

## Current status

The optional docking experiment is implemented using Node.js v24.21.0 and
built-in `node:sqlite`. **Verified with live X4 docking across Node.js restarts.** Automated
tests prove synthetic persistence across Node restarts; the live test keeps X4
running. No migration system or broader memory schema exists.

## Docking schema version 1

One file contains one strict `docking_events` table. `PRAGMA user_version = 1`
identifies the schema; there is no separate version table.

| Field | SQLite type | Meaning |
| --- | --- | --- |
| event_id | INTEGER PRIMARY KEY | Row identifier, local to this database |
| event_type | TEXT NOT NULL | Fixed `docked`, enforced by CHECK |
| ship_idcode | TEXT NOT NULL | Existing game-derived ship code |
| destination_idcode | TEXT NOT NULL | Existing game-derived destination code |
| received_at_utc | TEXT NOT NULL | Node receipt time in ISO UTC, not exact game time |

The reader validates the existing marker/ID format. Inserts use parameters,
commit individually and select the stored row by event_id before acknowledgement.
Repeated ship/destination pairs remain separate rows; there is no uniqueness
constraint or deduplication on those fields.

Only an empty database (version 0, application ID 0, no schema objects) is
initialised. Existing databases must match version 1 and the exact schema
(whitespace aside), contain no extra objects and pass integrity validation.
Incompatible/corrupt databases are rejected without modification or repair.
Readback is read-only and never creates a missing file.

Reuse one file across Node restarts for one controlled test history while X4
stays running. Choose a fresh file for another save/universe or game reload.
This is manual separation, not permanent ID-code uniqueness or identity
continuity across reloads. A replaced log can replay records and add rows.
There is no durable capture checkpoint or production delivery guarantee.
Database files and journals belong in ignored `local-data/`. See
[PERSISTENCE_EXPERIMENT.md](docs/PERSISTENCE_EXPERIMENT.md).

## Initial requirements

For the proposed first milestone, persistence should:

- associate a real captured event with the entity involved
- retain enough event context to produce a truthful text acknowledgement
- keep the record readable after a service restart
- preserve the association with the same entity when it is encountered again
- keep histories from separate game universes from being mixed

The docking schema addresses controlled-session storage only. Wider identity
formats, automatic save identification, migration mechanics and production
duplicate handling remain undecided. Identity stability and save/reload
behaviour must be verified rather than assumed.

## Conversations and voice

The database may store text conversation history where it is useful for character memory or context.

Raw microphone audio and generated speech audio should not normally be stored permanently.

If voice-related data is stored, it should preferably be limited to useful metadata such as:

- transcribed player speech
- NPC text response
- speaker identity
- selected voice
- conversation timestamp
- related NPC or entity ID
- significant conversation events

Voice data should only be retained when it serves a clear gameplay or debugging purpose.

Temporary generated audio should normally be treated as cache data rather than persistent Life Signs data.
