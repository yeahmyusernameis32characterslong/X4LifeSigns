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

## Automatic session schema version 2

Opt-in `--auto-db` is **implemented, unverified / in progress** pending the
[production live matrix](docs/AUTOMATIC_SESSION_ROUTING.md). It uses the exact
same `docking_events` table semantics and adds exactly one ownership table:

```sql
CREATE TABLE session_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  session_key TEXT NOT NULL,
  key_scheme TEXT NOT NULL CHECK (key_scheme = 's1')
) STRICT;
```

`PRAGMA user_version = 2`; application ID remains 0. Exactly those two schema
objects must exist, with the expected SQL (whitespace aside), and integrity
validation must pass. There must be exactly one metadata row with singleton 1,
scheme `s1` and a canonical session key. Automatic routing compares the entire
stored owner against the incoming key. Independent readback validates and shows
the stored owner without requiring an incoming key or matching filename.

The canonical key is
`s1-YYYY-MM-DD_HH-MM-SS-r1-r2-r3-r4`, at most 66 ASCII characters. The parser
requires the exact clock spelling (including valid calendar/time fields) and
exactly four decimal integers in `0..2147483647`. Signs, leading zeroes except
`0`, whitespace, separators, traversal, suffixes and extra fields are rejected,
never sanitised. The entire V2 docking record, including both ID codes, is
validated before any storage operation. Malformed/missing session data produces
a warning and no file, row or success acknowledgement; no previous key is reused.

Files live only under `local-data/sessions/<session-key>.db`, resolved from the
reader source's repository root, never the current working directory. Nothing is
created until a valid V2 docking is handled. The router closes its sole current
store before switching to another key. Node restarts reuse the same key's file;
different keys select different files. Identical complete keys always mean the
same owner, including the accepted residual risk of indistinguishable collisions
across actual X4 sessions. No suffix, alternate source or retry repairs collisions.

Only a newly and exclusively created target may be initialised. Creation uses
`wx`; an existing/racing target is never truncated and must pass read-only
validation before writable access. Existing empty files, uninitialised SQLite,
v1 files, wrong owners/schemes, unexpected objects, incompatible schemas and
corruption fail unchanged. Schema, ownership and user_version are created in
one transaction; existing schema/ownership are rechecked in the writable
transaction, and again for each docking. No migration, repair, deletion or
silent upgrade is performed. A failed initialisation can leave an empty target;
later attempts refuse it rather than initialise an existing file.

Containment checks walk all path ancestors, refuse symbolic links/junctions and
realpath redirection, and require a single-link regular database file. File
identity and path safety are rechecked before writes. Existing journal/WAL/SHM
objects (including dangling links) are refused, never removed. Automatic files
use SQLite's default rollback-journal format; WAL-format targets are rejected by
header inspection before SQLite because even a read-only WAL connection can
create shared-memory sidecars ([SQLite WAL documentation](https://sqlite.org/wal.html#read_only_databases)).
These safeguards address existing filesystem objects and exclusive creation
races; this local development tool is not a defence against hostile concurrent
filesystem replacement by another process. Keep the repository on local,
non-synchronised storage.

Each docking commits transactionally, then selects the committed row before
acknowledgement. Storage/open/validation/lock/write/commit/readback failures stop
auto persistence with a non-zero exit and no false success. A post-commit
readback failure may leave a committed row without acknowledgement. Automatic
readback is read-only and never creates/repairs a missing or invalid file; v1
readback and `openEventStore` manual behaviour remain unchanged.

All modes still start at EOF. Log replacement can replay events; there is no
deduplication, checkpoint or exactly-once promise. Permanent entity identity and
guaranteed session uniqueness remain unestablished. Both schema versions and
their journal files remain ignored by Git.

## Initial requirements

For the proposed first milestone, persistence should:

- associate a real captured event with the entity involved
- retain enough event context to produce a truthful text acknowledgement
- keep the record readable after a service restart
- preserve the association with the same entity when it is encountered again
- keep histories from separate game universes from being mixed

The docking schema addresses controlled-session storage only. Wider identity
formats, save continuity, migration mechanics and production duplicate handling
remain undecided. Automatic routing separates sessions only under the approved
practical s1 assumption; it does not identify a save permanently. Identity stability and save/reload
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
