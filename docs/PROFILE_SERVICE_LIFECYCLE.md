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
