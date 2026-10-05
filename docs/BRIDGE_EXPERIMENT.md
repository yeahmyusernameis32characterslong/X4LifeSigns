# Docking debug-log experiment

Status: **Implemented, live X4 verification pending.**

This experiment observes completed docking while the player is personally at the
ship's controls, writes one marked X4 debug record and acknowledges it in a local
Node.js console. It is one-way and contains no database, AI, voice, networking,
Lua or response into X4. The log is experimental transport, not a production
delivery or persistence guarantee.

## Installed X4 9.00 evidence

The inspected installation reports `900` in `version.dat`. The relevant files
are packed in `08.cat` / `08.dat`; later base catalogs contain no replacements
for these schemas. Relevant installed extension catalog indexes were also
checked for schema/property replacements; none were found. Inspection copies
are temporary and are not committed. Catalog byte offsets and lengths were used
to read the entries without writing to the installation.

| Installed file | Evidence used |
| --- | --- |
| `libraries/md.xsd:4` | Includes `common.xsd`; cue attribute `instantiate` is defined at line 4584. |
| `libraries/common.xsd:13924` | `event_object_docked` is separate from `event_object_docking_started`. `event.object` is the docking object; `event.param` is the dock object; `event.param2` is the zone; `event.param3` is the docking bay. |
| `libraries/common.xsd`, `objecteventsource` and `eventcondition` definitions | Event attributes: `object` or `group`, `check`, `dock`, `zone`, and inherited `chance`/`comment`. The probe supplies `group`, with a separate `check_value` condition. |
| `libraries/scriptproperties.xml` | `player.controlled` means the current object controlled by the player, or null. Object `.idcode` is documented as a string in `AAA-123` format. |
| `md/setup.xml:44,583,658,665` | Creates and maintains `global.$PlayerControlledGroup` from `player.controlled`, including control changes. |
| `md/gm_unlockshadyguy.xml:527` | Shipped `PlayerDocked` cue uses `instantiate="true"` with `event_object_docked group="global.$PlayerControlledGroup"` and a `dock` filter. |
| `md/notifications.xml:706` | Shipped repeated `OnDocked` cue uses `instantiate="true"` and reads `event.param` as the destination. Its occupied-ship group is broader than this experiment needs. |
| `md/lib_generic.xml:4535` | Another shipped instantiated docking listener tests `event.param` against its target. |
| `libraries/common.xsd:25956` | Supported `debug_text` action has required `text`, optional `context`, and `filter` including `general`. Shipped scripts use `'...%s...'.[values]` formatting. |
| `extensions/ego_dlc_boron/content.xml` | Real X4 manifest supplies `id`, `name`, `description`, `version`, `author`, `enabled`, `save` and a game-version dependency. The owner resolved the minimum metadata question using Egosoft documentation and explicitly authorised proceeding. |

MD5 hashes of the inspected schema/property entries, matching the installed
catalog records:

- `libraries/md.xsd`: `d7ac24747687e15d9be608ff63b52ccd`
- `libraries/common.xsd`: `de2c08eabd2f3e22d705ed473b7940ce`
- `libraries/scriptproperties.xml`: `f03b6cf9076b60754beed0c02c50f80c`

The probe follows the shipped controlled-group and instantiation pattern. It
also checks `event.object == player.controlled`, requires a ship and excludes
spacesuits. No delay is introduced before reading the event values. It reports
destination ID codes for stations or carrier ships; it does not invent names or
use docking-bay identifiers as station identifiers.

`idcode` is a verified game-derived display identifier. This experiment makes
no claim about its uniqueness across saves or its suitability as a permanent
Life Signs database key. Permanent entity identity remains undecided.

The manifest identifies only `lifesigns_bridge_probe`, requires game version
`900`, and uses `save="0"` so this diagnostic extension is not declared as a
required save dependency. This is not a guarantee that running MD leaves no
cue state in a save. Use the separate test save.

## Record format and reader behaviour

Example payload (IDs below are illustrative):

```text
LIFESIGNS_BRIDGE_V1|docked|ship=ABC-123|destination=DEF-456|END
```

X4 can prepend timestamps/filter labels. The reader finds the marker and accepts
only the fixed event, fields, ID-code format and terminator. Display names are
excluded to avoid delimiter and quoting problems. A malformed marked record
produces a warning and reading continues. An ID code differing from the
documented format also produces a warning; capture that evidence rather than
silently changing the protocol.

The reader requires `--log`, opens the file read-only, starts at its current end
and polls every 250 ms. It buffers bytes until LF, supports CRLF and split UTF-8,
and ignores the remainder of a partial line that predates startup. Lines above
64 KiB are discarded with a warning to bound memory use.

On truncation, replacement or reappearance, it clears the old partial line,
warns and reads the new log from byte zero. File identity, size and a 64-byte
anchor behind the current offset detect ordinary replacements and
truncate-and-regrow. If the file disappears after startup, it waits. A missing
file at initial startup is an explicit error; launch X4 first. Other file errors
stop the reader with a readable error.

Recovery may replay records copied into a replacement log. A rewrite preserving
file identity, size and the anchor bytes can evade detection, and writes racing
with reads can lose events. There is no exactly-once delivery, deduplication or
durable checkpoint. These are deliberate limits of this first experiment.

## Commands

Use Node.js 22 or newer. No dependency installation is needed. From the repository:

```powershell
npm.cmd --prefix bridge test
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION'
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG'
```

Replace the two placeholders with local paths. They are intentionally not
committed. The deployer requires `X4.exe`, writes only
`extensions\lifesigns_bridge_probe\content.xml` and
`extensions\lifesigns_bridge_probe\md\LifeSigns_BridgeProbe.xml`, checks the
existing extension identity, refuses unexpected files and rejects linked target
paths. It supports redeployment of this probe and `-WhatIf`. Close X4 before
deployment. If Windows denies writing to the installation, run the deployment
command from an elevated PowerShell window.

## Manual X4 test

1. Review the branch/PR and deploy the probe with X4 closed.
2. Enable debug logging in Steam launch options:
   `-debug all -logfile debuglog.txt`. Retain any other options you need. This
   command is also used in the X4 9.00 probe instructions on the
   [Egosoft X4 wiki](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Multi-version%20extensions/).
   The docking hook and debug action were verified in installed X4 9.00 files.
3. Launch X4 and confirm **Life Signs Bridge Probe** is enabled in Extensions.
   Restart the game if enabling it requires a restart.
4. Load the current separate test save in slot 010. Its previous contents are
   irrelevant: the owner has overwritten it with a new state and is now at the
   ship's controls. Do not overwrite a normal playthrough save.
5. Confirm the expected debug log exists, then start the Node reader. Wait for
   `Watching from current end: ...` before docking. Loading an already-docked
   save is not a new completed docking event.
6. Stay personally at the controls. If already docked, undock first. Request
   docking at a station and complete the landing while personally piloting.
   Compare the acknowledged ship ID with the game's displayed ID code.
7. Expect one marked log record and one console acknowledgement per completed
   docking. Starting an approach, requesting permission or aborting docking
   should not acknowledge a completed docking.
8. Undock and dock again while still piloting. Confirm a second acknowledgement.
   Also test changing to another ship and docking while personally controlling
   it; the acknowledgement should use that ship's ID.
9. As a negative check, order another player-owned ship to dock while you remain
   at your own ship's controls. That other ship should not produce a probe record.
   Merely being aboard without piloting is outside this milestone.
10. Stop the reader with Ctrl+C. Check the debug log for MD errors mentioning
    `LifeSigns_BridgeProbe`. Keep observations locally; do not commit the log or
    save. Record the ship/destination IDs, docking count and any errors in the PR.

Expected console output:

```text
Watching from current end: <your debug log path>
Docking acknowledged: ship ABC-123 -> destination DEF-456
Docking acknowledged: ship ABC-123 -> destination DEF-456
```

The actual ID codes come from the current game. If nothing appears, first check
the extension is enabled, logging is active, the reader watches the correct
file, and the player stayed at the controls. Search the log for
`LIFESIGNS_BRIDGE_V1` and `LifeSigns_BridgeProbe`: a missing marker indicates a
game/probe/logging issue; a marker plus a reader warning indicates a record
format issue. Do not label the live path verified until this test succeeds.

To stop using the experiment, close X4 and disable Life Signs Bridge Probe in
Extensions. The Node reader never edits the log. No game deployment or save
modification was performed during automated validation.

## Automated validation

The Node test suite uses temporary synthetic logs and a mock installation,
including an `X4.exe` placeholder. It covers parsing, explicit arguments,
startup EOF, old partial lines, appended partial lines/CRLF, split UTF-8,
malformed records, unchanged log bytes, truncation, truncate-and-regrow,
replacement, disappearance/reappearance, missing initial logs, oversized lines,
read chunk boundaries, CLI errors, deployment/redeployment, `-WhatIf`, refusal
of unrelated content and Windows junctions, plus a real reader-process console
acknowledgement from a synthetic log append. Deployment checks run on Windows.

The probe was validated with .NET `XmlReader` using the extracted installed
`libraries/md.xsd` and its `common.xsd` include; the manifest was checked for XML
well-formedness. Schema validation checks structure and attributes, not runtime
MD expression semantics or whether X4 loads this extension. Live event capture,
filtering, ID values, repeated docking and debug output still require the manual
X4 test above.

Local results on Node.js `v24.21.0`: 19 tests passed, zero failures or skips;
installed MD schema validation passed; manifest XML parsed successfully;
JavaScript syntax check and `git diff --check` passed.
