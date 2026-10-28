# Database Management menu preview

PR #25 Stage 2 read-only menu/transport is accepted by Agent review on
28 October 2026. Owner-run observations confirm initial-menu access, save
scanning, satisfactory layout, checked-save counts and responsive protection
toggling without rescanning at the applicable deployed revisions through
`c29bb3f`. These are scoped observations, not every navigation/load route.
Back/detail-page retention, persistence across a real restart and the reported
minimise/restore flicker were not separately confirmed by the latest owner test.
Stage 1's read-only parser and retention policy remain in use. No deletion,
migration, quarantine, compaction or cleanup Apply exists. Full destructive
load/start blocking and maintenance writer exclusion remain future gates.

## Screen and scope

For offline layout experiments, open
[the standalone browser preview](../tools/menu-preview/index.html). Its
[usage guide](../tools/menu-preview/README.md) explains the fictional data,
font/column/spacing controls and layout export. It approximates the appearance;
it neither renders native X4 widgets nor edits the installed menu or game data.

The optional recorder adds **Life Signs** before the settings entry of the
initial main menu, opening **Database Management**:

> Manage your universe histories
>
> See which Life Signs databases belong to your local saves and identify history you may no longer need.

The table columns are Universe, Local saves, Database size and Status. Universe
numbers are temporary display labels mapped to exact underlying IDs in the
companion; they are not names or replacement identities. Status is In use,
Possibly unused, Protected or Needs attention. Uncertain saves never become
confirmed absence. Unknown dates/sizes remain Unknown. Size means current file
size, not reclaimable space. Sizes use decimal MB/GB (1 MB = 1,000,000 bytes;
1 GB = 1,000,000,000 bytes), with two decimal places. Small nonempty files below
0.01 MB display `<0.01 MB`; unavailable/invalid sizes remain Unknown. Exact byte
counts used by the inventory/planner are unchanged.

Selecting a universe opens associated save names and filesystem-modified UTC
dates with provenance, History needed by your saves, Potentially removable
history and Problems requiring attention. Save rows use the Section label
`File modified (UTC)` for the displayed date; Save location / source contains
only the selected-folder-relative source, without a date-provenance prefix.
The wider options frame and separate
list/detail column proportions give labels, dates and statuses more room.
Table headings, cells and selectable universe labels use font size 10 after
owner feedback that the previous table text was too large. Universe labels have
a narrower column; details give save locations/source more space, and Save
locations gives most width to folder paths. Refresh, Save locations, Cancel and
Back sit in a separate compact control row with a visible gap above the table;
their widths are independent of the data columns.
The screen now follows verified Extensions-menu conventions: a 13-size outlined
bold title/back arrow with a divider, 9-size information text, 10-size body text,
native-derived minimum row heights and offsets, a content gutter and heading dividers.
Previous/Page/Next has its own compact row, so paging buttons do not inherit
data-column widths. Footer height is reserved before limiting the scrollable
data area, and explicit table navigation links connect the interactive groups.
These changes address the owner's screenshot comparison; the owner confirmed
the layout renders nicely. Full keyboard/controller navigation remains
unconfirmed by the latest owner observation.
Universe lists contain up to ten rows per page; details and save locations retain
three rows per page for longer values. Compact list cells have smaller byte
budgets so even a full ten-row reply stays below the native 4096-byte limit.
Long values are visibly clipped with `...`; full paths
remain in the local settings file. Counts are technical overlapping categories,
not distinct activities to add together.

Controls: Refresh, Save locations, Cancel, Back, Previous/Next and a **Protect
this universe** checkbox in details. Refresh retains prior results with a stale
label. Selection/protection/paging are inactive while those results are stale.
Cancellation, errors, restarted/missing companions and changing settings have
explicit states. Back restores normal menu behaviour.

The screen includes the agreed explanatory text:

> Earlier history is preserved when a newer save still depends on it, even if the earlier save was overwritten.
>
> Prevent cleanup of this universe, including history not referenced by your current saves.
>
> Preview only. No databases or history will be changed.
>
> Only the selected local folders are checked. Cloud saves and copies stored elsewhere are not included.

Only player-selected local folders and optional registered local archive folders
are checked. There is no cloud account enumeration, credential request or global
remote inventory requirement. Outside-scope copies alone do not block the
preview; their history is not protected by its conclusions. Include available
local copies or protect the entire universe. Unreadable/changing inputs *inside*
the selected scope still block potentially affected counts. Provider-backed
local inputs retain Stage 1's metadata-only availability checks; no hydration.

## Local configuration and protection

This prototype uses companion configuration, not an unverified native folder
picker. Save locations displays the selected folders and tells the user to edit
`local-data/housekeeping-preview-v1.json` under the companion's database root.
With the companion stopped, create UTF-8 JSON without a BOM, replacing the path
placeholder with an explicitly selected absolute local directory:

```json
{
  "owner": "LifeSignsReadOnlyPreview",
  "version": 1,
  "saveLocations": ["<absolute-local-save-folder>"],
  "protectedUniverses": []
}
```

Restart the companion, then Refresh. Up to 16 selected folders are supported;
UNC network paths are rejected. Missing configuration selects no folders and
shows attention/guidance, not a guessed personal save path. Invalid configuration
is an error, not permission to scan elsewhere.

The checkbox persists whole-universe protection atomically in this separate
ignored settings file and rescans. It preserves all history, including abandoned
branches. A changed settings digest makes an in-flight result stale. These
preferences are not the proposed retirement catalogue, a DB migration or a save
change. A later destructive executor would still need independent approval and
must honour these preferences. No cleanup can be performed in this prototype.

## Implementation boundary

The menu wraps the existing OptionsMenu methods; it does not replace vendor Lua
or assume a numeric menu slot. The insertion anchor is the source's `settings`
option ID. While the preview is active it uses the existing options frame/layer
and isolates its callbacks. Original methods remain active for vanilla screens.
The addon declares both ego_detailmonitor and ego_gameoptions dependencies.

Installed X4 9.00 source supports the candidate hooks at
`ui/addons/ego_gameoptions/gameoptions.lua`: initial capture/registration 404-439,
main options/settings 1246-1325, frame construction 3615-3629, option rendering
4713 onward, table construction 9345-9404, update 13109 onward and close 13671
onward. `ui/addons/ego_detailmonitorhelper/helper.lua:1406-1436` dispatches menu
updates through the menu table. These are source observations, not an official
stable extension API or proof of compatibility with every other menu mod.

Typed LSHK1 requests go through the existing debuglog and a separate preview
adapter. A fresh random service generation, client nonce and increasing request
sequence correlate replies. Only REFRESH, LIST, DETAIL, LOCATIONS, PROTECT and
CANCEL are accepted; selection uses companion-owned indices, never UI paths,
SQL or commands. Replies use two reserved run filenames through the unchanged
first-party native reader. Profile ACK and LSLOAD1 fencing remain separate.
Five hex-encoded UTF-8 fields per row provide bounded pages without evaluating
runtime text. The Lua parser validates frame identity, page/count bounds,
hex/UTF-8 and states. A changing heartbeat is required before scans begin; an
old reply left on disk is not a live companion.

The companion performs full scans in a separate disposable Node process.
Synchronous Windows metadata/SQLite checks cannot block menu/ingestion polling.
Cancellation terminates that process and ignores its late replies. Normal
load fencing or observed profile ingestion cancels/inactivates the preview for
the remainder of that service generation. Lua also invalidates it at the
existing LoadGame wrapper and world-side adapter request, and cancels on menu
close/submenu/show/cleanup. This is an availability precaution, **not** a proven
all-route writer/load exclusion barrier. Returned-menu, tutorial/new-game and
interpreter-recreation behaviour remain native acceptance gates.

Before constructing an ingestion writer, the service cancels any preview and
waits for its read process to exit, leaving log offsets untouched until then.
This prevents a preview read transaction competing with the first world-side
write. Shutdown also waits for reader exit before draining ingestion. This does
not hold or delay native LoadGame/NewGame dispatch.

## Build and automated checks

```powershell
npm ci --prefix profiles --ignore-scripts --no-audit --no-fund
npm test --prefix profiles
npm test --prefix recorder
npm test --prefix bridge
python profiles/test/housekeeping_lua_test.py '<installed lua51_64.dll>' '<verified reader DLL>'
python profiles/test/lua_adapter_test.py '<installed lua51_64.dll>' '<verified reader DLL>'
python profiles/test/load_permission_lua_test.py '<installed lua51_64.dll>' '<verified reader DLL>'
powershell -NoProfile -File scripts/validate-profile-ui.ps1 -SourceDirectory '<verified installed UI schema extraction>'
powershell -NoProfile -File scripts/validate-event-recorder.ps1 -SchemaDirectory '<verified installed MD schema extraction>'
```

The new tests cover protocol grammar, pagination/escaping, stale/out-of-order
replies, missing/restarted companions, cancellation/late worker results, local
settings persistence, model wording, actual service/debuglog dispatch and load
cancellation. The installed LuaJIT tests mock X4 widgets, then cross the real
Node service/native reader/Lua path with synthetic gzip and SQLite inputs,
including persisted protection and exact input hashes. They do not launch X4.

Future companion packaging uses `profiles/companion-files.json`, including all
preview/parser modules and the locked runtime dependencies. The installer
preflights these files/versions before changing an existing watcher and records
their hashes. Dependency installation is an explicit build step, never an
implicit network operation during deployment. A disposable package-copy test
checks runtime resolution. The installer itself has not been executed for this
stage; deployment remains separately gated.

Offline verification: 268 Node regressions passed (67 profiles, 89 recorder,
112 bridge), followed by focused checks of the final network-path and unknown
database fixes. The full LuaJIT/native/companion preview check passed after
those fixes. Existing adapter and three-interpreter load-permission checks,
hash-pinned installed X4 9.00 UI/MD schemas, generator freshness and installer
syntax also passed. This evidence does not establish native widget rendering,
initial-versus-returned menu dispatch or compatibility with other UI mods.

## First owner observation and refinement

On 28 October the owner confirmed that Life Signs appeared without loading a
save and that scanning worked. The table was cramped, raw byte sizes were hard
to read and three universes per page were too few. The refinements above address
those observations; offline layout tests mock widgets and cannot prove visual
fit at a particular screen resolution or UI scale.

The owner also observed flicker between X4 and the desktop while restoring the
minimised game. Its cause is unresolved. The inspected run contains a date
line-wrap warning and a restricted vanilla online-status function warning on
return from the custom menu; neither proves a cause for the focus behaviour.
No graphics, window mode or focus settings were changed. A mocked idle-update
check verifies that unchanged preview state does not repeatedly display frames,
but does not reproduce Windows minimise/restore behaviour.

## Owner-run tests after separate deployment approval

1. Start at the initial menu. Confirm one Life Signs entry before Settings and
   the exact title, introduction, notices and table columns. Check layout,
   keyboard/controller navigation, mouse activation, wrapping and scrolling.
   Confirm up to ten universes on a list page, readable MB/GB sizes and no
   clipped date/status columns in details at the chosen resolution/UI scale.
   Compare minimise/restore on the vanilla main menu and on the preview; record
   which screen was active if the reported desktop/X4 flicker recurs.
2. Confirm unavailable companion state with an absent/restarted companion.
   After it becomes live, Refresh should scan only the configured folders.
3. Open details; verify real names, dates/provenance, current sizes and statuses.
   Exercise all pages. Unknown inputs must show Needs attention/Unknown.
4. Refresh and cancel during a substantial scan. Prior results must remain
   visibly stale and inactive. Close/reopen; late replies must not replace the
   new screen. A companion restart must require a new refresh.
5. Protect a universe, wait for the rescan, restart the companion and confirm
   protection persisted. Unprotect and repeat. No save/DB content may change.
6. Save locations must show only configured local folders and honest file-edit
   guidance. Out-of-scope cloud/external copies must not require credentials or
   block the selected local scope merely by existing elsewhere.
7. Back to vanilla menus. Exercise Continue, Load, New Game/tutorial navigation
   and exit without preview interference. After entering/returning from a world,
   the initial-menu preview must not resume old jobs. Interpreter/UI reload,
   queued transition and other-menu-mod compatibility need explicit observation.

These are instructions only; no deployment, game launch or live test is
authorised by this document. Return observations to Agent before later work.

## Scan progress and Windows metadata batching

While the inventory runs, the status line shows completed save checks, then
save-input rechecks, database checks and database rechecks. Save totals are not
known until traversal finishes, so this phase shows a completed count rather
than an invented percentage. Rechecks include directory observations. Counts
include inspected inputs that may require attention; they do not mean every
input passed validation. Results remain stale and unavailable for selection
until the complete planner result arrives.

The scan process emits bounded, count-only progress through existing correlated
SCANNING replies. Updates are limited to about once per second, plus stage
changes and known-total completion. They contain no filenames, paths or
provisional retention conclusions. Cancellation, companion generation changes
and world/load fencing still invalidate late replies. No new native API or
reply-file namespace is required.

On Windows, each ancestor chain is checked in one hidden PowerShell process;
every path still receives a fresh attribute check in each original before/after
phase. Provider/reparse/unavailable or failed probes remain conservative blocks.
There is no cross-refresh metadata/result cache. Full save parsing and database
validation remain necessary, so large selected save folders can still take
minutes. The owner confirmed the native layout, checked-save count display
and responsive protection toggling. No full loading-duration measurement was
provided.

## Protection and Back without another scan

Changing Protect this universe saves that preference and immediately updates the
already completed preview. It keeps the selected detail page. The scan worker
builds an unprotected base preview even for protected universes, so unchecking
restores the previous exact counts or Unknown values. Protection excludes all
history from potential removal; its displayed zero candidates are a policy
exclusion, not new evidence that an uncertain database passed validation.

Back from details or save locations requests the existing universe list. The
button and keyboard/controller close action share that behaviour; Back from the
list exits to the main menu. These actions do not launch a scan. Refresh and
opening a new preview still perform the full checks. External settings changes,
service/client replacement and world/load fencing invalidate the completed
preview as before. No evidence is cached persistently or given destructive
authority; changed saves/databases require Refresh for updated observations.
