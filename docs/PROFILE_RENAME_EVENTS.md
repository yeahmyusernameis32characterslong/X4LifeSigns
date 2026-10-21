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
