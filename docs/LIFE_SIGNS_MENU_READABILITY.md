# Life Signs menu readability — Codex implementation brief

Owner-authorised, 29 October 2026. Status: implementation requested; UI changes not yet implemented or visually verified.

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
