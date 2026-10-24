# Ship and station rename events

## Approved task

Owner authorises Qwen source research, implementation and deployment of ship and
station rename capture (2026-10-21). Baseline `f8d778b`,
`feat/sqlite-object-profiles`, draft PR20. No Codex gameplay launch or merge.

## Plan and acceptance

- Verify the exact native event, selectors, payload and name semantics against
  the installed X4 9.00 corpus. Do not infer an old-name payload from its position.
- Record one small subject-owned name-change event with game time, seed/ID code,
  observed new name and an explicit old-name provenance/unknown state.
- Preserve prior names when directly supplied or previously observed; do not
  invent an old name for a newly encountered object. Scope to player ships and
  stations, without rescanning personnel or taking another profile/snapshot.
- Persist through the existing events table. Project observed name changes onto
  profile reads using existing save ancestry, retaining original profile rows
  and rename history. No schema/identity migration or new native DLL capability.
- Test escaping, multiple changes, ownership/type filtering, no full-profile
  capture, saved-branch name history, SQL replay and native schema compatibility.
- Deploy only the reviewed optional recorder/companion updates while X4 is
  closed. Preserve databases/logs, refresh the automatic watcher's pinned code
  safely, verify idle readiness, then hand the live rename check to the owner.

Native rename delivery, automatic naming coverage and actual game display-name
semantics remain unverified until source research and a separate owner-run test.

## Verified source and implementation

Reviewed installed X4 9.00 `ui/addons/ego_detailmonitor/menu_map.lua`, SHA256
`6c56ba3881495ad8ee7db3a144c16079f2b2eaad56a3a1e5efe171f899fd6865`:

- Lines24302–24321 initialise the rename dialog from `GetComponentName`, wire
  edit-box/confirm callbacks, and keep fleet labels on a separate route.
- Lines25031–25044: `buttonRenameConfirm(isconfirmed)` calls `SetComponentName`
  only when confirmed, pending text exists and this is not a fleet-label rename.
- Lines28940–28947: `infoChangeObjectName(objectid,text,textchanged)` calls that
  setter only when `textchanged` is true. Actual edit-box bindings occur at
  lines13756,14173,14800,14927; this is UI Lua, not an MD callback pattern.
- `libraries/scriptproperties.xml` lines48–54 document seed, display `name`,
  `knownname` (ignores unknown status) and the separate renamed flag. Source hash
  `1b641b638c8892284bbf5943f9ed283e0adf79f696341a2f00a2361f16485a8f`.

Qwen found the two setter routes; consequential locations were independently
verified. The MD searches did not establish a native name-change signal. This is
not proof none exists. Global setter replacement is not verified or required;
the implementation passively wraps the two menu callbacks, preserving original
arguments, exactly one original call, nil return holes and original exceptions.
Observer/getter failures do not prevent the original rename.

The Lua observer reads the old component name before the original callback and
forwards the object reference, old-name availability, requested text and route
afterwards. MD checks current ownership/type and reads the actual `knownname`.
Seed, ID code and game time are recorded by MD, not reconstructed from a name.
Text is escaped through the existing recorder framing. No roster or full-profile
capture runs for a rename.

| Record type | Evidence |
| --- | --- |
| `NAME_CHANGED` | Old and current names observed and different. |
| `NAME_OBSERVED` | Current name observed after the rename callback; old name unknown. |
| `NAME_CHANGE_REQUESTED` | Callback completed but current name could not be read; requested text is not asserted as the actual name. |

Equal old/current names are suppressed. Dialog cancellation, missing pending
text and fleet-label renames are excluded. The information-panel route follows
its actual `textchanged` guard; it does not invent a confirmation parameter.
Names assigned through other menus, AI/MD scripts or other mods are outside the
verified coverage. Actual timing of the setter/name read remains an owner test.

## Database semantics

Display name is mutable; seed/ID code identify the ship/station. Existing raw
profile versions remain immutable. Every name observation is appended to the
existing `events` table, including old/new availability and game time. No schema
change or migration is needed. `eventsAt()` exposes that history.

`profilesAt(run,record)` returns the latest applicable observed name by applying
later rename events on exactly that save ancestry. It selects only name events
in SQL, not every attack/order row. A future abandoned branch cannot rename an
older loaded save. A later complete profile supersedes earlier rename events.
Seed equality takes priority: a conflicting seed cannot fall back to another
object's ID code. Missing-seed fallback requires a unique ID code, or a reference
within the same run. NPC names are not changed by this feature.

Returned `fields.name` is the projected current display name; `name_observation`
identifies its event run, ordinal and time. `fields_json` remains the original
profile payload. Unknown actual names never overwrite known names. Replaying the
same log is idempotent; earlier names/history remain available.

## First native load/rename check and diagnostic continuation

The owner-run test at `914d417` verified automatic service start/drain/exit and
reuse of the ready database with the saved committed checkpoint; no new full
snapshot ran. The later database error was a rejected event stream: records1–10
committed, raw record11 absent, then12–15 present. Original baseline/database
integrity remain intact. Do not describe this as failed initial database loading.

Eight rename callbacks failed before recording: `ConvertStringToLuaID` already
arrives in MD as a component. Wrapping it in `component.{...}` performed a second
conversion. Rename and personnel UI listeners now require datatype.component and
pass it directly. A regression test delivers that native payload type through
the actual generated listener, including rejection of malformed payloads.

The missing ordinal's cause is **unverified** and must not be attributed to the
rename failure. SQL continuity remains strict; no records are manufactured or
renumbered. Current DEBUG diagnostics add `LSPWRITE1` BEFORE/AFTER traces around
scalar event `debug_to_file` calls in the regular scripts debug output. Snapshot
rows are not mirrored. These traces prove action progress, not durable file or
SQL commit, and need an owner-run repeat to compare generation/file/SQL evidence.
They depend on the scripts debug filter; existing launch logging must be checked
before asking for a diagnostic repeat. Remove/reduce this diagnostic after the
native write-path investigation. A separate early-load observation appended NPC
events to a restored old raw log before the new run boundary; automatic creation-
time filtering prevented their import. That lifecycle ordering remains open.
