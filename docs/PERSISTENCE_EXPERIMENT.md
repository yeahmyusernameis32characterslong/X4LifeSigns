# Docking SQLite experiment

Status: **Implemented, live X4 verification pending.**

This extends the [verified docking bridge](BRIDGE_EXPERIMENT.md) with optional
SQLite persistence. A new docking is inserted, committed, read back by event_id
and acknowledged using the stored values. A separate read-only process retrieves
it after the writer stops. The MD probe, record format, deployment script and
console-only command are unchanged. No probe redeployment is needed.

## Environment and scope

Node.js `v24.21.0` was confirmed locally. Built-in `node:sqlite` loaded and
reported SQLite `3.53.4`. There is no npm database package, separate server or
dependency installation. The official
[Node v24 documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
labels the module **release candidate** and documents file-backed DatabaseSync,
prepared statements and read-only connections. The package targets
`>=24.21.0 <25`; only v24.21.0 was tested locally.

Keep X4 running throughout the initial test. Reuse one file across Node restarts
in one controlled history. Use a **fresh database filename** for a different
save/universe or any game reload, including reloading the same save. This is
manual separation, not automatic save identification. ID codes are sufficient
for the controlled session, not permanently unique. Record IDs identify rows
only within their own database. No identity continuity across reloads is claimed.

## Schema and behaviour

[DATABASE.md](../DATABASE.md) defines one strict docking_events table and
schema version 1 (`PRAGMA user_version`). The fields are event_id (integer
primary key), event_type (fixed docked), ship_idcode, destination_idcode and
received_at_utc (Node receipt time in ISO UTC, not exact game time).

Only an empty database is initialised: version 0, application ID 0 and no schema
objects. Initialisation and version setting are transactional. Missing parent
folders are created by the writer. Existing files are validated **read-only
before a writable connection opens**. They must pass integrity validation and
match version 1 and the exact schema (whitespace aside), with no extra schema
objects. Version/column/constraint/trigger/index changes are incompatible. The
writer rechecks inside its initial transaction. There is no migration, repair,
overwrite or deletion of an incompatible database.

Each parameterised insert gets its own transaction. After COMMIT, the row is
selected by event_id and used for the `Docking persisted` acknowledgement.
Identical ship/destination pairs are separate events, not duplicate keys.
The read-only command prints JSON rows in event-ID order and their count. It
needs neither X4 nor its log, never creates a missing database/folder, and rejects
an uninitialised empty database.

Database open, validation, insert, commit and readback errors stop the process
with a clear error and nonzero exit status. No false persisted acknowledgement
is printed. Only malformed log parsing is caught as a recoverable warning.
If commit succeeded but subsequent readback failed, a row may already exist;
inspect it before retrying. Normal Ctrl+C/SIGTERM shutdown and handled errors
close the database. Force termination cannot run cleanup.

The original log limitations remain. Startup begins at current EOF: no historical
import and no capture while stopped. Replacement recovery may replay copied
records, which would become extra rows. There is no durable capture checkpoint,
deduplication or exactly-once delivery. Identical ID pairs cannot distinguish
replayed records from real repeated dockings. `--db` cannot alias `--log`, even
through existing hard links. Keep paths stable during the test. This is not a
production transport or crash/power-loss guarantee.

## Commands and manual live test

From the checkout, replace the log placeholder locally and keep actual paths
only in ignored SETUP.local.md. Choose a new filename if the example database
has already been used for another history; do not delete an incompatible file.

```powershell
npm.cmd --prefix bridge test
node .\bridge\src\read-events.js --log '<X4 user data folder>\debuglog.txt' --db '.\local-data\docking-test.db'
```

Console-only mode remains:

```powershell
node .\bridge\src\read-events.js --log '<X4 user data folder>\debuglog.txt'
```

1. Run the tests. Keep the verified probe installed and enabled. Launch X4 with
   its existing debug logging and load the separate test save. Choose a fresh
   database filename. **Keep X4 running for steps 2–5.**
2. Start the reader with --log and --db. Wait for `Watching from current end`.
   Personally pilot and complete one new docking. If already docked, undock
   first. Expect one persisted acknowledgement and note all five stored fields.
3. Stop Node with Ctrl+C and run a separate readback process:

   ```powershell
   node .\bridge\src\read-stored-events.js --db '.\local-data\docking-test.db'
   ```

   Expect one identical row: same event_id, event type, IDs and timestamp, count 1.
4. Restart the writer against the same log/database while still docked. Wait
   briefly without docking, stop it, then repeat readback. Count stays 1 and the
   original row is unchanged.
5. Restart the writer, personally undock and dock again, stop Node, and read back.
   Expect two rows with distinct event IDs. The first remains unchanged and
   ship/destination IDs should match the actual test.
6. Record `git rev-parse HEAD`, Node/X4 versions, counts and whether row values
   matched. Publish sanitised results, not raw logs, personal paths or save files.
   Unrelated mod/save errors are context unless they interfere with this test.

Illustrative output (actual IDs/time come from the test):

```text
Docking persisted: {"event_id":1,"event_type":"docked","ship_idcode":"ABC-123","destination_idcode":"DEF-456","received_at_utc":"2026-10-05T12:00:00.000Z"}
```

Readback prints the same JSON object and then:

```text
Stored docking count: 1
```

## Automated evidence

Tests use temporary databases, synthetic logs and the existing mock installation.
They verify parameterised values, committed visibility to another connection,
stored timestamps, repeated rows, isolated histories, incompatible/corrupt files
remaining byte-for-byte unchanged, read-only refusal, lock-induced failures,
graceful writer shutdown, separate-process identical readback, EOF restart,
no capture while stopped, malformed/unrelated lines, CLI failures and log aliases.
On Windows, test-only IPC emits the real SIGINT handler to exercise graceful
shutdown; the production writer has no IPC channel.

**42 tests passed, zero failures or skips**, on Node.js v24.21.0. Synthetic
Node-restart persistence is verified; live persistence remains pending. The
original bridge's live verification record is preserved in BRIDGE_EXPERIMENT.md.

Excluded: AI, Ollama, ChatGPT, voice, Aria, return-channel communication, broader
memories, automatic save detection, identity across reloads and production
delivery guarantees.
