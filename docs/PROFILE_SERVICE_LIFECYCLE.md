# Automatic profile-service lifecycle

## Approved task and baseline

Owner authorises implementation and deployment of automatic SQLite startup when
X4 opens with the optional Life Signs recorder installed, and shutdown when X4
exits (2026-10-21). Starting revision: `fdebcd7`, draft PR20,
`feat/sqlite-object-profiles`. Existing native recorder and database schema stay
compatible. No Codex gameplay launch or merge.

## Implementation plan

1. Install a hidden, per-user Windows watcher and a Startup shortcut. The watcher
   remains idle outside X4; the Node SQLite process and database handles do not.
   Use the exact configured executable path, process ID and start time, and the
   installed recorder identity/files. A named mutex prevents duplicate watchers.
2. Start one Node profile service for that X4 launch. Select logs created since
   the process start; do not import retained logs from previous launches. A
   service restart within the same X4 process replays that launch idempotently.
3. Isolate a rejected run from other runs without weakening saved-checkpoint,
   identity, schema or replay checks. Send ERROR for that run; continue watching
   for later loads/new universes. Preserve original logs and existing databases.
4. On game exit or extension removal, send a graceful stop through the child's
   private stdin pipe. Drain complete final rows, close all SQLite handles and
   exit. Pipe closure also stops an orphaned child. Record local lifecycle state.
5. Verify log selection, failed-run isolation, restart recovery and shutdown
   with real SQLite and a disposable process fixture; never launch X4 for tests.
   Preserve current installation/receipts/logs before deployment. Check idle
   watcher state, no active SQL service, and startup registration afterwards.

No external program launch is added to the native reader DLL. The Windows
watcher is a separately installed local companion, uses the current user's
permissions and starts hidden. No admin task, engine hook, process injection,
production component change, schema migration, pause or autosave is introduced.

## Primary references

- [.NET Process.StartTime](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.starttime)
  identifies a process generation as well as its PID; failure to inspect a
  matching process must not be treated as evidence that X4 exited.
- [Windows Startup folder](https://support.microsoft.com/en-us/windows/configure-startup-applications-in-windows-115a420a-0bff-4a6f-90e0-1934c844e473)
  supports a per-user companion at sign-in without changing the owner's Steam
  shortcut or launch options.
- [Node child process pipes](https://nodejs.org/docs/latest-v24.x/api/child_process.html)
  and local Node24.21.0 tests establish the pipe/exit and shutdown contract.

Actual X4 automatic start/exit and subsequent baseline/reload acceptance remain
owner-test gates. Automated process fixtures do not establish gameplay behaviour.

## Installed behaviour

The companion is separate from the read-only native DLL. A current-user Startup
shortcut starts the hidden PowerShell watcher at Windows sign-in; installation
also starts it immediately. It checks once per second using .NET process APIs.
When idle it has no Node child and no SQLite database open. It does not start X4
or change Steam launch options. The checkout must remain at its configured
database location; companion code is copied into an ignored, hash-pinned install
directory so a later source checkout cannot silently change the deployed worker.

The exact game executable path and its PID/start time identify each launch.
Another executable with the same filename is ignored; inaccessible/ambiguous
process information blocks transitions instead of pretending the game exited.
The recorder content identity, enabled content flag and five required files must
be present. A duplicate watcher for the same extension exits under a named mutex.
Do not run a separate manual profile-service process while automatic mode is active.

The worker uses the Windows creation time of each per-run log, compared with the
X4 process UTC start time. Retained older files are never consumed by automatic
mode, even when their modification time changes. Restarting the worker within
one game launch can replay that launch's files using existing SQL idempotence.
A rejected run receives ERROR and remains rejected for that worker lifetime;
later loads/new universes remain eligible. Invalid paths/global I/O failure still
stop the worker. No saved-ancestry check is weakened.

Game exit or recorder removal closes the private control pipe after a stop
request. The worker drains complete rows in bounded chunks, closes SQLite, then
exits; it is never forcibly terminated by normal shutdown. Incomplete final rows
cannot claim successful completion. Unexpected watcher loss closes the pipe and
also stops the child. A crashed worker is retried after five seconds, at most
three starts per game generation; persistent failure is recorded locally.

## Install, inspect and remove

From the clean approved checkout, with X4 and any manual profile service closed:

```powershell
./scripts/install-profile-service.ps1 -GameRoot '<X4 installation>' -LogDirectory '<X4 user data>/logs/lifesigns-event-recorder' -ApprovedCommit '<full reviewed SHA>'
```

This installs only the optional local companion and its owned Startup shortcut;
it does not replace game extension files. Local state, transition history,
receipts and child stdout/stderr are under
`local-data/profile-service-lifecycle/`. `watcher-state.local.json` records IDLE,
SERVICE_RUNNING, DRAINING, rejection/retry or inspection failure states. Child
stdout/stderr are preserved after each child exits. `installed.local.json`
records hashes and Startup registration. No private paths enter shared docs.

To disable automatic mode, remove only its owned **Life Signs SQLite Profiles**
Startup shortcut, then create `stop-watcher.local` in that state directory. The
watcher drains/closes any child before exiting. Keep databases, native logs,
install receipts and evidence. Reinstallation backs up prior owned registration,
configuration and watcher state; unrelated shortcuts are refused.

Checks: `node --test recorder/test/*.test.mjs profiles/test/*.test.mjs`. Windows
watcher tests use a renamed but unmodified signed system executable as a process
fixture, loopback only. They cover idle/absent extension, wrong executable path,
duplicate exclusion, real SQL commit, crash recovery, final-row drain, extension
removal and orphan pipe EOF. No application-control setting is changed.
