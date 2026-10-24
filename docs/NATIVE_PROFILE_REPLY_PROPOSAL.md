# Approved native reader implementation checkpoint

Owner explicitly approved this proposal in chat on2026-10-21 ("I approve").
The earlier eight-requirement permission and its deployment scope remain.
Implementation uses one first-party Lua C module; no third-party binary or
Protected UI/configuration change. Initial compiled-module tests pass; native
X4 module loading remains the next OWNER main-menu-only gate.

Source: profiles/native/lifesigns_status.cpp. Build with the existing Windows
C++ Build Tools (x64, static CRT, warnings-as-errors, CFG/ASLR/NX). The build
script writes all outputs and source/DLL hashes under ignored local-data:

```powershell
powershell -NoProfile -File scripts/build-profile-status-native.ps1
python profiles/test/lua_adapter_test.py '<installed lua51_64.dll>' '<built lifesigns_status.dll>'
```

The C module resolves only the documented Lua5.1 API from the already-loaded
lua51_64.dll. It calls no X4 engine API. Canonical run filenames, fixed own
runtime location, regular-file/single-link checks, final handle-path comparison,
4095-byte limit and complete ASCII line checks constrain reads. Runtime directory
reparse points are refused. C++ path/file resources are destroyed before pushing
Lua results. Large path buffers are allocated on the heap rather than the game
thread's stack. Lua keeps strict LSDB1 parsing/run/universe/ordinal validation.

A synthetic owned reply is read locally at startup. It never emits READY to MD
or changes a checkpoint/database. Expected main-menu diagnostic:
NATIVE_MODULE_READY with probe=PASS. Sidecar stays stopped for that first native
check; only after owner confirms module loading/readback should a whole-profile
retest be prepared. Source/build instructions are committed; generated DLL,
object/import libraries, receipts, test fixtures and actual game IDs remain
ignored. The earlier proposal is preserved below as design history.

---

# Proposal: bounded native profile-status reader

Status: PROPOSED, not implemented or deployed. PR20 diagnostic code at4fff596
confirmed X4 rejects CreateFileA through FFI with "Access to FFI function
'CreateFileA' is restricted!". The configuration reports Protected UI=false.
Root addon loading and native MD/Lua event roundtrip work; the file reader does
not. Standalone LuaJIT success did not verify X4's FFI access policy.

The owner has authorised the eight SQLite/profile/event requirements. This
proposal adds a new in-process native binary to the reviewed Lua/MD/Node design.
Repository AGENTS.md requires a plan and approval before risky architectural
changes. Request specific approval for this native boundary before implementation
or deployment; existing approval for the original eight requirements remains.

## Proposed component and interface

Build a small first-party Life Signs Lua5.1-compatible C module from reviewed
source, using the existing local Windows C++ Build Tools. Install its one DLL
inside the optional recorder's native/ directory. Register through Lua's standard
package.loadlib interface, subject to X4's actual native-module loading rules.
No new third-party extension, library download or game configuration change is
part of this proposal. A prototype must establish native loading before another
whole-profile test is requested.

The module exposes only readReply(run). It obtains its own installed module
location using normal Windows APIs, resolves the optional extension's runtime/
directory, accepts only a canonical recorder-run filename, opens that one .reply
read-only and returns at most4095bytes. Reject traversal, arbitrary paths,
nonregular/link files, oversized/incomplete data and invalid argument types.
Close every file handle on every path. Return a small error code, never evaluate
file contents or accept executable commands. The Lua adapter retains strict
LSDB1 run/universe/state/ordinal parsing. SQLite commit/readback gating, saved
ancestry and all profile/event formats stay the same.

No game object pointers or engine functions are needed: the C API is used only
to receive the run string and return bytes/error. No process-memory access,
hooks, actor creation, gameplay mutation or save writes. Respect the runtime
native-module policy and fail explicitly if loading is unavailable. Do not use
ffi.load or namespace tricks to evade the restricted FFI call.

## Evidence supporting investigation, not a runtime guarantee

Lua C modules are an established interface:
[Lua5.1 manual](https://www.lua.org/manual/5.1/manual.html#pdf-package.loadlib).
A primary X4 mod-author example uses an extension-root UI registration and
package.loadlib with Protected UI disabled:
[X4Native loader source](https://github.com/eg3r/X4Native/blob/main/extension/ui/x4native.lua).
This is supporting evidence for the loader contract only. Its native hooking,
extension discovery and other components are not proposed dependencies or code
to copy. No third-party binary has been downloaded or installed.

A focused Qwen corpus search did not establish a supported dynamic MD text-file
reload route; broad output ended incomplete. There is no verified evidence that
MD can repeatedly reload sidecar-edited translation files as acknowledgements.
Do not invent a file-loading action or treat an incomplete search as impossibility.

## Build, review and verification before deployment

1. Check current PR20/source/installed state and permissions; preserve failures,
   databases, status files, saves and logs. Keep all generated binaries and local
   build artifacts ignored; commit source/build instructions and reviewed hashes.
2. Review the complete C module, Lua loader/error path and filename/size limits.
   Use only existing compiler/Windows SDK and the pinned installed Lua ABI.
3. Build into ignored local-data with compiler/source/output receipts. Verify
   exports, architecture, dependencies and reproducibility to the available gate.
4. Run the actual DLL with the installed LuaJIT library in a standalone process:
   valid statuses and exact IDs; Unicode installation path; malformed/traversal
   arguments; missing, oversized, truncated or linked files; stale run/universe
   replies; read-only byte/hash preservation and handle closure. Simulated tests
   do not establish native X4 module loading.
5. Run collector/real SQLite integration and relevant schema/UI checks. Keep
   existing production bridge tests/gates intact; do not migrate production data.
6. Under explicit approval, back up and install only optional recorder changes
   and that one DLL, verify all hashes, leave production components/settings
   untouched. Keep Qwen unloaded and the profile sidecar stopped for the first
   main-menu-only native module probe.
7. OWNER launches/exits. Codex verifies the module actually loaded and can read
   an owned synthetic reply before enabling another full baseline test. Codex
   does not launch X4. No merge.

## Review decision and remaining uncertainty

The new native binary can affect the game process if its ABI or code is wrong;
this is the material change requiring the repository's architecture gate. The
bounded read-only surface, full source review and actual-library tests reduce
that risk but are not a native gameplay proof. Exact X4 native-loader behavior,
ABI compatibility in that context and module lifecycle remain acceptance gates.

Next decision: owner approval of this specific first-party reader, or Agent
architecture review of a different supported return channel. Until then the
existing four-file diagnostic remains installed, sidecar stopped, and the
recorder is not ready for full profile tests.
