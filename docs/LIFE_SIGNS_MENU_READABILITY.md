# Life Signs menu readability — Codex implementation brief

Owner-authorised, 29 October 2026. Original implementation brief below; see the
delivery section for implementation, verification and deployment status.

## Starting point and dependency

Use branch `ui/life-signs-menu-readability`, based on PR #25 head
`b6be29505f20d431835f552aa4ed70d075a5ce7f`.
This is a separate stacked PR targeting `feat/save-aware-database-housekeeping`.
PR #25 is ON HOLD and unmerged: preserve its implementation/evidence and do not resume housekeeping functionality or merge either PR. The stacked base keeps the menu-only diff reviewable; integration into main requires a later owner decision.

Read current root/nested AGENTS.md, the current branch, relevant menu docs and private menu-readability STATUS. Independently verify branch tips and local cleanliness; preserve unrelated work.

## Implement now

Improve the actual native Life Signs / Database Management table, not just the browser approximation.

- Use font size **10** for table cell text and column headings, including relevant explanatory table rows. Keep the existing title hierarchy outside the table.
- Add dark row/background shading sufficient for white text over X4's animated background. Subtle alternating rows are appropriate if supported. Preserve clear selection, hover, disabled-action and focus states; avoid clipping at the owner's UI scale.
- Keep usage and protection independent: a protected universe associated with saves must still visibly say **In use**, with **Protected** alongside or in a distinct field. Do not mask unknown/attention states, and do not imply a loaded game merely because a universe has associated saves.
- Replace ambiguous **backup** wording with a clear, verified meaning, such as **Restore point available** with concise help explaining that it is a database-history copy made before maintenance, not an X4 save. Establish the actual backing state before choosing final copy. Separate this from usage/protection.
- Remove **Categories overlap; do not sum** from **Save location / source**. That column should contain locations/sources only, or be renamed/restructured coherently if it serves broader detail content. Present useful player-facing history totals without adding overlapping table/projection counts. Put any necessary technical breakdown/explanation in secondary details/help, not the primary source column.
- Review nearby labels for player usefulness without changing retention, counting, backup, restoration or safety semantics.

Owner screenshot references: **InUseBackup**, **CatogeriesOverlapDoNotSum**. Locate these locally if available. Agent has the owner's descriptions, not direct screenshot inspection; do not claim otherwise. Keep screenshots local.

## Important existing coupling

Inspect `profiles/preview-model.mjs`, `profiles/maintenance-test.mjs`,
`profiles/preview-protocol.mjs`, the preview service/worker and
`extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/lifesigns_housekeeping.lua`.

Current protection replaces the displayed status with Protected. Lua also derives
Clean/Restore availability from prefixes/substrings of that status (In use,
Protected, backup). Do not make a wording fix that enables protected actions or
disables valid ones. Make the smallest consistent presentation/eligibility change,
preserving backend checks and wire compatibility where possible. If a minimal
explicit presentation flag is needed, update both ends and their tests together;
do not redesign the maintenance protocol.

Codex may resolve ordinary layout/copy/implementation choices and use Qwen for
installed X4 menu/style discovery under the standing research workflow. Qwen
researches authorised sources broadly; Codex verifies consequential citations and
narrow dependencies. No new research caps or packet requirements.

## Acceptance and validation

- Protected + in-use remains visibly In use and Protected; protection still prevents Clean and Restore where current policy requires it. Unprotect restores the appropriate actions without corrupting cached state.
- Backup available/unavailable, uncertain/stale/error, zero candidates and busy states remain correctly represented and enforced.
- Table text is size10; readable shading and states are verified in actual X4 by the owner. Native screenshot evidence remains local. Browser mocks and widget tests do not establish rendered acceptance.
- No misleading unique-history total from summing raw records, projections, profiles and sessions. Save/source cells no longer carry the overlapping-category disclaimer.
- Preserve refresh, pagination, selection, confirmation, generation correlation and selected-universe behaviour.
- Run relevant preview/model/native-Lua tests and package/generated-file checks required by the changed files; run regression suites appropriate to any action-state changes. Validate installed schemas if XML changes; otherwise record unchanged/not rerun. Check diff, links and privacy.
- No schema/identity/retention/pruning/recovery changes, new data mutation, gameplay work or unrelated redesign.

## Delivery

Commit implementation/tests/docs on this UI branch and update this PR. Provide
exact owner visual-test steps and test-build/deployment instructions, preserving
the existing isolated-copy configuration and rollback. Do not autonomously launch
X4, perform cleanup/restore operations or merge. Do not treat the paused PR25
task as authority to resume its implementation or deployment.

Publish `menu-readability/MENU_READABILITY_CODEX_IMPLEMENTATION_REPORT.md`
in the private handoff with starting/resulting SHAs, changed files, source
verification, tests, remaining visual questions and PR state. Update shared
STATUS/EVIDENCE after rereading them, verify remote readback and return to AGENT.
Raw local evidence stays ignored and uncommitted.

## Codex delivery

Implemented on the stacked UI branch; **not deployed**. PR #25 remains on hold
and both PRs remain unmerged. Only presentation/model/action-eligibility code
changes; no maintenance algorithm, schema, retention or recovery changes.

- Native table headings, cells, buttons and explanatory rows use size10. The
  existing size13 title and outlined/bold hierarchy remain.
- Dark92%-opacity alternating data rows and a98%-opacity heading use native
  Helper row `bgColor`. No global colour is modified; native table selection,
  button hover/highlight and disabled styles retain their defaults. Final
  brightness, wrapping and focus legibility need owner observation in X4.
- Usage remains visible alongside protection and restore-point information.
  `In use` means matching selected local saves, not a currently loaded game.
  Unknown/attention states remain visible when protected.
- `Restore point recorded` means the existing maintenance state references a
  database-history backup created before maintenance. It is **not an X4 save**.
  The scan does not freshly validate that backup; selecting Restore runs the
  existing complete ownership/hash/schema/content validation before confirmation.
  Missing/corrupt restore points still refuse. No new availability guarantee is
  inferred from a pointer.
- Zero candidates display `No cleanup needed` alongside usage. Only raw history
  records appear in the retained/removable totals; profiles/events/sessions are
  overlapping projections, not extra unique history. The underlying counters
  and cleanup calculations remain unchanged. Detail history rows have empty
  source cells; the broader detail column is now `Location / context`.
- Exact independent status labels gate row buttons. Protected, attention,
  stale/error/busy/unavailable rows cannot start actions; zero candidates disable
  Clean while a recorded restore point can still be reviewed. Existing backend
  checks, confirmation, generation and selected-universe scope remain.
- The five-cell wire shape, verbs and native reader are unchanged. List status
  capacity rises from32 to80 bytes to preserve all independent labels; ten rows
  at maximum cell budgets remain below4096 bytes. Deploy the matching companion
  and Lua together so older status-driven controls are never mixed.

### Test build and deployment instructions

This task prepares the build and instructions; deployment requires a later owner
request. Use the exact reviewed PR27 commit and its32-file
`profiles/companion-files.json` bundle, together with the optional recorder's
`lifesigns_housekeeping.lua`. Do not copy a newer file into an older companion.

Follow the existing [isolated menu deployment contract](DATABASE_HOUSEKEEPING_MENU_TEST.md):
X4 closed, owned watcher idle, installed receipt/source hashes checked first.
Back up configuration, startup link, receipts and replaced UI; stage a fresh
source-hashed companion directory, stop only the owned watcher normally, copy
the matching UI and update the companion path/receipt, then restart the watcher
hidden and verify idle. Retain the currently registered isolated-copy root,
protection settings, original database/log/save routes and all backups. Do not
recreate the test root, reset protection or invoke cleanup/restoration for this
presentation test. On a failed deployment restore the preserved prior bundle/UI/
configuration/startup link and verify idle; do not repair evidence by deletion.

### Owner visual acceptance after authorised deployment

1. Launch X4 normally, remain at its initial menu, open Life Signs. Do not load
   a save or run Clean/Restore for this visual review.
2. Confirm the isolated-copy label, size10 body/headings, readable shading over
   the bright animated background, normal title, row selection/hover/focus and
   clearly disabled actions. Check long statuses wrap without clipping.
3. Confirm an in-use protected universe still says `In use` and `Protected`.
   Toggle protection in details and return: actions disable/re-enable correctly,
   usage/restore labels remain and no rescan is triggered.
4. Verify `Restore point recorded` is explained as database history, not a game
   save; it is rechecked when selected. Inspect details/paging/save locations:
   history rows contain one record count and no category disclaimer in the source
   cells. Actual save rows still show their relative source.
5. Report appearance/navigation/status issues and exit. Screenshots stay local.
   Widget/native tests establish properties/transport, not final X4 rendering.

### Verification

Windows Node v24.21.0: **183 profile tests pass**, zero failures/skips, including
26 preview/model/transport tests. Tests cover independent status labels,
protection/unprotection without base-cache mutation, uncertainty, zero candidates,
full ten-row native buffer budgets, stale/generation handling and existing backend
refusal/confirmation behaviour on disposable fixtures.

Installed LuaJIT and the existing native DLL: four checks pass, including actual
Node/native/Lua preview and confirmation transport on temporary fixtures. Added
Lua assertions cover size10 text, alternating backgrounds, unchanged native
highlight/button defaults, and protected/attention/zero/busy/stale/error/unavailable
action states. Generated recorder matches,32-file package closure passes, and
links/diff/privacy checks pass. XML/MD/native source is unchanged, so installed
schema/native compilation is not rerun. Installed PR25 files/routes remain
unchanged; no new owner-data cleanup/restore or X4 launch occurred.
