# Housekeeping menu visibility across restarts

7 November 2026. Owner-reported bug: Life Signs was absent after deleting saves
in X4's load menu, including on a subsequent fresh launch. This report does not
establish that deleting saves directly caused the bug.

## Scope and evidence

Isolated branch fix/housekeeping-stale-menu-status starts at main
759fcd65bb526e1a46c838df15b12d0bd937049b. The installed housekeeping Lua matches
that baseline. The station production work is separate and not deployed.

The menu's initial-screen predicate read the companion HELLO reply. If that file
ended in INACTIVE, it suppressed the Life Signs entry. Replies persist across X4
processes, so the file does not prove that the current Lua runtime entered a
world. Local lifecycle evidence shows a restart while the previous reader was
still draining, leaving that status during the new initial menu. A regression
test using installed LuaJIT reproduced the missing entry before the fix.

The fix removes disk status from the visibility predicate. Initial-menu identity
and the current runtime's world-observed exclusion remain. Opening the screen
with an old inactive reply shows an unavailable view, with no generation or
action permission. A valid INACTIVE observation immediately revokes live state,
pending requests and prior handshake data; it does not invent a permanent world
transition in a fresh Lua runtime. Fresh changing service heartbeats are required
again before automatically requesting a preview.

This is a menu visibility/readiness correction. It does not change watcher
shutdown/drain logic, service retries, load fencing, save scope, database history,
maintenance permissions, confirmation or backups. A slow shutdown or a truncated
log during a rapid restart remains a separate lifecycle observation, not a bug
claimed fixed by this patch. Maintenance after gameplay in the same X4 process
remains excluded; use an initial menu after a full restart.

## Validation

- New profiles/test/menu_startup_lua_test.py fails on the original source with
  the missing-entry assertion and passes on the corrected source in two fresh
  installed-LuaJIT states. It checks visibility, no requests/actions under stale
  status, two changing heartbeats, immediate inactive revocation, reconnection
  and preserved same-process gameplay exclusion.
- profiles/test/housekeeping_lua_test.py: all seven existing outcome groups pass,
  including actual Lua/native/Node preview, protection, confirmation, backup,
  prune, restore, compaction, restore-point deletion and folder controls on
  disposable fixtures. Original fixture inputs are preserved.
- node --test profiles/test/preview.test.mjs profiles/test/replies.test.mjs:
  35/35 pass, zero failed/skipped.
- git diff --check passes. No XML, MD, native DLL or storage code changes, so
  their unchanged schemas are not presented as new validation evidence.

Run the Lua checks with an installed lua51_64.dll; the existing full UI suite
also accepts the current native reader DLL. Commands use paths supplied locally,
not committed machine paths. Tests do not launch X4 or write to its installation.

## Delivery and owner acceptance

Implemented and offline verified; not deployed or native-gameplay verified.
No saves, live databases, existing logs or settings were changed. Raw diagnostic
copies remain local, with sanitised findings in the private handoff.

After a separately authorised deployment, start X4 and stay at the initial main
menu. Life Signs should remain visible even while its service is unavailable.
Open it and wait for automatic connection/preview. No save deletion, cleanup,
restore or gameplay is needed to test menu visibility. If the service does not
become ready, report that separately; the menu must not silently disappear.
