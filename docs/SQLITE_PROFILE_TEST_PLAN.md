# Current correction after first owner test

The first native run at4cb0020 failed before profiling: SQLite committed the
startup record and wrote NEED_BASELINE, but no return acknowledgement reached
MD before its timeout. Zero station/ship/NPC profiles or gameplay event rows
were captured; only an incomplete staging DB exists. Original logs/status/DB
were preserved and the sidecar was stopped after X4 closed.

The earlier merged-vanilla-UI schema check proved XML shape only; it did not
prove registration or native loading. The adapter now registers through the
extension-root ui.xml, as documented in Egosoft's
[MD/Lua integration guide](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/UI%20Modding%20support/Talking%20with%20MD%20and%20AI%20scripts/).
It is a uniquely named menus addon with an ego_detailmonitor load dependency,
validated against the installed extension addon.xsd (not coreaddon.xsd).
The obsolete vanilla-addon diff is removed. This corrects a documented loading
contract; a new owner run must still establish the actual complete path.

The Lua adapter now emits per-run transport stages to a scoped diagnostic
listener: REQUEST_RECEIVED, WAITING_FOR_REPLY_FILE, INVALID_OR_MISMATCHED_REPLY,
NATIVE_READER_UNAVAILABLE and REPLY_FORWARDED. A missing native reader reports
ERROR rather than silently waiting. Diagnostics do not increment raw record
ordinals or create a feedback loop. No protected UI setting was changed.

The installed addon.xsd was extracted from900 catalog08, entry offset49681216,
size5132, MD5d163bb12d19848ca786e6c2d4dacc4c6, SHA256
67d318ee4a6892905198519df094b8abe357c84751166e3bc4af2ee19a826cca.
The schema explicitly restricts extension addon names, relative Lua filenames
and dependency loading. The previous source evidence remains below as history;
its native deployment readiness was superseded by this failed first test.

56collector/SQLite tests, LuaJIT standalone adapter tests (including health/error
stages), installed MD schema and extension-root registration schema checks pass
for the correction. Previous112 bridge tests are unchanged; no bridge code is
touched. Actual Windows FFI access inside X4, UI polling and reply dispatch
remain unverified. The separate old NPC observation diagnostic reports errors;
it remains untouched and is not established as the timeout cause.

---

# PR20: SQLite profile and selective event test

## Owner authority and baseline

Owner instruction 2026-10-21 authorises research with Qwen, development and deployment of all eight requirements for the first owner-run test. No merge or Codex gameplay launch is authorised. Requirements7/8 clarified: events belong to their affected ship/station/NPC profile, with cross-profile links through observed seeds, codes and references. Existing production docking/session schema and databases remain intact.

Implementation branch feat/sqlite-object-profiles starts from PR19 1d8bb9679135329b0bd54e6275e20dff6caf2666. PR17,18,19 were closed without merge, with owner-authorised findings comments and branches preserved. New PR targets main and therefore carries forward the unmerged recorder implementation/documentation intentionally.

## Requirements and acceptance

1. Query actual validated SQLite universe ownership/readiness before deciding whether a whole initial baseline is needed. A saved MD flag alone is not proof that the database exists. Existing ready universe -> no whole snapshot on load.
2. Profile newly created/acquired station, ship or NPC individually. Contextual personnel must remain contextual; never instantiate actors to collect them. Profile only missing new objects, record later assignment/role changes as event values.
3. Route by the saved Life Signs lsu1 ID and retain independent run/session provenance. Never overwrite the production s1 system or migrate its v1/v2 databases. Preserve save ancestry via saved committed checkpoint information; do not import a later branch's state into an older save.
4. Initial baseline start uses a centred, centred-text manual-dismissal help panel with the owner's exact welcome wording below.
5. Completion uses the owner's exact centred help panel only after the database has committed and been read back; a native SNAPSHOT_END alone is not a SQLite acknowledgement. Errors must not claim success.
6. Ship events include attack/attacked, role/order starts and commander/subordinate changes; append event type, game time and observed identifiers/context. No shield/hull damage subscriptions and no full snapshots on attack/order events.
7. Station attacked events belong to the station profile. No shield/hull damage capture.
8. NPC assignment, crew/control roles, manager/ship trader, unassigned, spacesuit/ejection and rescue observations belong to the NPC profile, linked to involved assets. Unsupported or missing native hooks/fields must remain explicit; do not infer death or a different person from representation absence.

## Work units

- Verify native return transport for database presence/commit acknowledgements; Qwen researches primary Lua/MD sources and Codex verifies consequential claims. First-test runtime behavior remains unverified until owner tests.
- Build additive owned SQLite profile/event storage and log consumer; transaction/readback, schema/ownership/path validation, session/checkpoint isolation and restart/idempotence tests.
- Add MD request/response gating, exact panels and lightweight native event listeners, with targeted created-object profile work. Observe events during baseline without launching another whole snapshot.
- Build supported UI/native response adapter if required. No new third-party binary dependencies. Keep Qwen development-only.
- Regenerate MD; run collector/bridge/profile tests, installed900 schema and event-selector validation, documentation/privacy/diff checks; commit coherent increments.
- Deploy only reviewed optional components and required sidecar under current owner approval; preserve prior installation, profile settings, saves and all logs. Publish scoped report/private status and return OWNER for the first game test. Do not launch X4 or merge.

## Exact welcome text

Welcome to Life Signs
A new database is being created and soon your X4 game will have a memory
Following the creation of this database you should save your game immediately
Saving your game will store a Life Signs ID into the save file
Creating a Life Signs database can take considerable time
A high performance desktop may take 5 minutes for existing games with 5,000 player owned assets
You will be notified when your database has been created and to save your game

## Exact completion text

Your Life Signs database has now been created and it's Life Signs ID generated
Please save your game immediately

The five-minute statement is owner-specified product text, not a new measured benchmark. Both panels use the existing verified screen-centre placement and centred text. Buffering and pause are outside this implementation unless strictly required by the eight requirements.

## Source findings and limitations

The Life Signs saved MD tag has been observed CREATED and then identical/EXISTING across one owner save/load cycle; no global uniqueness claim. The starting installed recorder was1d8bb96, per-load full-snapshot-only. Existing automatic session routing is tested for docking, not profile inheritance. Engine log actions do not acknowledge SQLite commits. Transport and event coverage investigations are active; findings and implementation status will be recorded incrementally here and in the private handoff. Allowance percentage is not visible; use conservative commit/check/publication checkpoints.

## Storage increment (implemented, not connected to X4 yet)

`profiles/store.mjs` and `profiles/service.mjs` add a separate experimental
profile store. Production docking v1/v2 routing/files are untouched. Profile
files are named by validated Life Signs universe ID, with isolated session rows
and saved parent-run/record checkpoints inside that universe database. This
retains independent session provenance while supporting universe-level lookup;
it does not collapse all sessions into one mutable current profile.

A baseline is staged separately and published under the universe database name
only after snapshot counts, transaction commit and readback succeed. Historical
profile versions and event rows retain exact engine text. Loading an earlier
checkpoint selects only that session's recorded ancestry, excluding later
versions. Existing/wrong-owner/corrupt/schema-incompatible data is refused.
No prior exploratory logs are imported without the explicit LSDB1 protocol.

Six real SQLite/temporary-file tests pass: baseline commit gating and exact
largeint/Unicode values; saved checkpoint isolation; restart/replay; ownership
and malformed/gapped input; replies after commit/error; partial UTF-8 tailing.
This is an automated storage gate, not native return-channel validation. MD,
Lua, selective events and deployment remain in progress.

## Database handshake and panels increment

The generated MD now waits for an LSDB1 database reply before starting the
baseline. READY suppresses a whole snapshot; NEED_BASELINE permits it. The
exact owner welcome/completion panels are centred and closable. Completion
waits for a committed/read-back SNAPSHOT_END record. Replies are matched to the
current run/universe and bounded by emitted/acknowledged record ordinals; saved
MD state retains that committed checkpoint for later session ancestry.

The optional UI XML diff adds one original Lua file to the existing menus
environment. MD sends a string request through raise_lua_event. Lua reads a
strict ASCII reply file and returns a list via AddUITriggeredEvent; MD consumes
screen parameters. The adapter derives the installation directory from the
process executable using GetModuleFileNameA, avoiding a working-directory
assumption. It uses the existing LuaJIT ffi.C binding to Windows kernel32 for
read-only CreateFileA/ReadFile/CloseHandle, not a new third-party DLL.

41 collector tests and seven real SQLite/profile tests pass, including generated
MD -> SQLite -> reply -> generated MD creation and saved-state reload. The
installed X4 9.00 schema gate passes. A standalone test loads the installed
lua51_64.dll without starting X4 and verifies compilation, real Win32 file reads,
parsing, stale identity rejection and mocked UI callback/polling. This does not
prove that the full X4 UI environment loads the addon or dispatches the custom
reply; the first owner test must establish that. Missing/unavailable transport
cannot announce a created database.

Primary references: installed common.xsd12023-12046/31309-31332, helptext.lua
RegisterEvent/SetScript call sites and the hash-verified ego_detailmonitor addon
XML/coreaddon schema. Standard APIs: [LuaJIT FFI](https://luajit.org/ext_ffi_api.html),
[CreateFileA](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea),
[ReadFile](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile),
[GetModuleFileNameA](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-getmodulefilenamea).
Qwen broad searches ended incomplete; a focused source review supported the
transport contract. Its CWD concern is addressed by executable-path discovery;
its performance acceptability suggestion is unmeasured. The MD request is a
string: raise_lua_event does not document list parameters.

## Selective native event increment

A reviewed JSON catalog now registers17 native lifecycle/gameplay selectors:
player construction, GOD-created owned assets, owned-property acquisition,
NPC actor creation, control-post add/remove, entity enter/leave, hired-actor
assignment requests, attack/attacking, order-ready and commander/assignment
changes. Grouped selectors follow current owned station/ship assets; new owned
assets are added to that group. The event bus is enabled before baseline work.
No shield/hull damage event is subscribed.

Each event emits a small typed subject/context record with game time and exact
seed/code/reference text. It does not enter profile getters or traverse crew on
attack, order or fleet events. Created/acquired unknown seeds are queued for
individual profiles; new-asset personnel are discovered on that one asset and
profiled separately. Seeds known from acknowledged profiles are retained in MD
save state. Contextual assignments preserve requested role and a later observed
role, distinguished from settled control-post events. Spacesuit ejection/rescue
labels require observed spacesuit contexts; other moves retain raw enter/leave
context without invented death or transfer conclusions.

45collector tests plus seven SQLite/profile tests pass, including attack events
with throwing personnel getters, new-ship/new-NPC-only profiling, no second
baseline, contextual role observations and spacesuit movement. All selected
filters validate against installed900schemas. Native dispatch/coverage remains
unverified; NPC templates have no verified universal birth hook. The bulk crew
role UI path is now observed as described below. These are first-test candidates, not an
exhaustive event guarantee. Order READY means enabled/ready as documented; it
is not renamed to proof of execution. Primary definitions are in common.xsd
12428-12454,12575-12600,13040-13068,13443-13508,13773-13815,14498-14510,
14777-14852,14917-14954,15177-15198,16469-16482; npc_created is md.xsd2068-2077.
Historical raw broad-research conclusions were checked against those definitions
rather than treated as runtime guarantees.

## Final pre-deployment gate (2026-10-21)

The later increments supersede the earlier in-progress counts: 47 collector tests
and nine SQLite/profile tests pass (56 total), plus 112 existing bridge tests.
One initial concurrent bridge invocation failed an assertion; the full rerun
passed all112. No production bridge change was made to obtain that result.
Generated MD validates against the hash-pinned installed900 MD/common schemas.
The scoped UI diff merged into the hash-pinned original addon XML validates
against coreaddon.xsd. The installed LuaJIT DLL compiles/runs the adapter in a
standalone test with real Win32 reads and mocked X4 callbacks. None is a native
X4 gameplay result.

Bulk Marine/service/unassigned role changes use a passive wrapper of MapMenu's
infoSubmenuConfirmCrewChanges, identified in first-party menu_map.lua17618-17652.
It captures seed/host/requested role before the original clears each pending
persons list, calls the original exactly once, preserves returns and errors,
then reads GetPersonRole(seed,host) (declaration757, caller26143). It emits a
separate NPC scalar event with actual and requested role. uint64 seed text never
passes through a Lua number. Observer failures cannot prevent the original
operation. Known NPCs need no roster scan or profile refresh. Only an unknown
seed queues a bounded host-local search for its individual profile.

Qwen's focused review correctly identified the absence of a native setter
success acknowledgement, but incorrectly said the pending persons lists were
not cleared and evaluated the supplied original as though it were our wrapper.
Those claims were rejected against the source. The actual role getter is the
observation; normal return of the UI callback alone is not proof of reassignment.
Broader Qwen searches that ended blank/repeated/HTTP failures remain incomplete,
not evidence that a hook does not exist.

ORDER_READY retains its documented meaning (enabled/ready to start). A delayed
scalar read records ORDER_RUNNING_OBSERVED only when that order's isrunning
property is true (scriptproperties.xml1701); no false start timestamp is
invented. Rapid orders ending before that check may have only a ready event.
NPC acquisition is included. New crew existing only as contextual templates are
covered by initial personnel discovery, new-host discovery and observed
assignment/role paths; exhaustive template creation coverage is not established.

Saved checkpoints gate both profile and event ancestry. Existing databases
reject saves from before the baseline completed instead of silently importing
future history. When the universe file is absent, a fresh baseline is staged,
even if the save holds an unavailable older checkpoint; raw startup provenance
is retained. Save immediately after the created panel, then use that save for
reload testing. Profile/event lookup must use profilesAt/eventsAt (or equivalent
ancestry-aware SQL), never a global maximum-record query across sessions.

Event records belong to subject_kind SHIP, STATION or NPC. Indexed subject,
host and other seed/code columns link the corresponding profile_versions;
fields_json retains exact additional context. NPC ID codes are derived offline
only from a canonical code in debugname parentheses; no NPC idcode getter was
restored. Unresolved identities remain unresolved. Existing partial-profile and
personnel limits remain explicit; a partial initial baseline can be a committed
database, and does not silently trigger repeated full snapshots.

### Running the experimental sidecar

Run from the checkout with Node24.21.x; the optional recorder and its UI files
must be installed. Keep production docking readers/databases unchanged.

```powershell
node profiles/service.mjs --logs '<X4 user data folder>/logs/lifesigns-event-recorder' --replies '<X4 installation>/extensions/lifesigns_event_recorder/runtime'
```

The sidecar reads per-run logs and writes only ignored local-data/profiles
SQLite files and strict reply files in the optional extension runtime directory.
Old logs without LSDB1 are preserved and not imported. No Qwen process is needed
at runtime. A missing/failed reply cannot announce database creation. The native
MD/Lua custom event path, all event dispatch coverage, first-baseline duration
and UI coexistence with other extensions require the owner-run test. There is
no pause, auto-save, historical-event reconstruction, deployment to production
bridge components or merge in this task.

### Repeatable checks

```powershell
node scripts/build-event-recorder.mjs
node --test recorder/test/*.test.mjs profiles/test/*.test.mjs
# From bridge/: node --test test/*.test.js
powershell -NoProfile -File scripts/validate-event-recorder.ps1 -SchemaDirectory '<verified installed-schema extraction>'
powershell -NoProfile -File scripts/validate-profile-ui.ps1 -SourceDirectory '<verified UI extraction root>'
python profiles/test/lua_adapter_test.py '<verified installed lua51_64.dll>'
git diff --check
```

Source extraction and local evidence are LOCAL-ONLY. The private sqlite-profiles
handoff carries deployment status, installed hashes and the exact next owner
action; it is coordination, not a substitute for this source branch.
