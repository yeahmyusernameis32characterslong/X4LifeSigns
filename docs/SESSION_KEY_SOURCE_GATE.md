# Session-key source prerequisite

Status: **Blocked before production implementation; production session separation
remains unverified.** Inspection on 6 October 2026 used current remote `main`,
`a4c30ee30ad8f8ec147c368e5d5a16c7e61c9e32` (the reviewed baseline).

The lifecycle observations in [SESSION_DIAGNOSTIC_EXPERIMENT.md](SESSION_DIAGNOSTIC_EXPERIMENT.md)
support replacement before observed docking. They do not establish fresh random
entropy after loading a save. No collision-resistant source has yet been
established. The source prerequisite and final production key encoding require
approval before production changes.

## Installed source findings

The inspected installation reports `900` in `version.dat`. Read catalog entries
as path, byte length, timestamp and MD5; read the corresponding byte ranges from
the matching `.dat` file and verify their MD5. Inspection checked base catalogs
`01.cat` through `09.cat` and installed extension catalogs for the three source
files below, and checked for loose copies in the installation's libraries and
extension trees. These files were found only in base `08.cat/08.dat`; no later
catalog or installed-extension overrides of them were found. Extracts and the
inspection manifest remain in ignored `local-data/`, not in this repository's
tracked files. No saves were parsed and no game files were changed.

| Installed file | MD5 |
| --- | --- |
| `libraries/common.xsd` | `de2c08eabd2f3e22d705ed473b7940ce` |
| `libraries/md.xsd` | `d7ac24747687e15d9be608ff63b52ccd` |
| `libraries/scriptproperties.xml` | `f03b6cf9076b60754beed0c02c50f80c` |

Line numbers below refer to those extracted installed files, not repository files.

| Source | What it supports | What it does not establish |
| --- | --- | --- |
| `scriptproperties.xml:2410`; `md/setup.xml:86` | `player.systemtime.{'%Y-%m-%d_%H-%M-%S'}` reads the current local system clock; the exact format is used by shipped setup. | Uniqueness, monotonicity, subsecond precision or fresh entropy. A saved variable containing this string is restored state until explicitly overwritten. Do not reuse `md.$SystemTimeAtGamestart` as a new sample. |
| `common.xsd:36233`, random attribute group at `6976` | `set_value` supports random `min`/`max`, distribution profile and optional seeds. | Which default RNG supplies an unseeded draw, how it is initialised, or whether its state is restored/reseeded on save load. |
| `common.xsd:686,697,20952` | Numerical fixed seeds give deterministic generation; auto-advance updates the seed, and `advance_seed` advances it consistently from its prior value. | Independence from save restoration. Advancing a restored seed is not an external entropy source. |
| `md/diplomacy.xml:28,2039` | Shipped code samples `$Seed` using `min="1L" max="100000L"`, then uses `seed="Start.$Seed"` for a later random evaluation. | Freshness on every load: stored seeds and newly executed draws must be distinguished. |
| `scriptproperties.xml:1766`; `md/gm_destroy_objects.xml:2057` | `[$min, $max].randominrange` is supported and used in shipped code. | A different, non-restored or independent RNG. Changing syntax does not resolve the prerequisite. |
| `scriptproperties.xml:48,49,2047` | Object/NPC seeds include persistent or generation-derived values. | A fresh per-load source. |
| `scriptproperties.xml:2679-2681` | `gamestart.seed` exists and is described as a session seed. | That "session" means every reload, or that it is freshly reseeded after restoration. No such guarantee was found. |
| `common.xsd:16506,17280` | Load and universe-generation callbacks exist; universe generation covers new games and save loading. | An entropy-bearing callback parameter or an RNG reset contract. |
| `md.xsd:1052,4584` | Instance namespaces and recurring instantiated cues are supported. | Fresh process entropy. A new cue invocation is not proof of a new random stream. |

The [Egosoft MD guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
documents random ranges, types and namespaces, and warns that schema validation
does not prove runtime correctness. Its random-range section does not specify
RNG save/load semantics. Inspection of installed base and official DLC MD code
found usages, but no default-RNG restoration/reseeding contract.

**Conclusion:** explicit saved numerical seeds can reproduce a sequence when
restored and advanced identically. For the proposed unseeded `set_value` source,
whether restored engine RNG state can reproduce its output remains unknown.
Neither independence nor guaranteed repetition is established by the inspected
sources. Freshly executing a draw and replacing a saved variable are distinct
from obtaining entropy independent of the save. Four draws cannot be described
as 124 independent bits without evidence about the generator and its state.

Consequently clock-plus-fresh-random is unsupported at this gate. There is no
timestamp-only routing fallback. V1 emission, console-only/manual `--db`,
schema-v1 files, the verified docking filter, PR #9 readiness/cue-name fixes and
the existing optional diagnostic remain unchanged.

## Optional diagnostic: replay of an unchanged save

The optional diagnostic is **implemented, live behaviour unverified** in
[`LifeSigns_RandomSourceDiagnostic.xml`](../extension/md/LifeSigns_RandomSourceDiagnostic.xml).
It uses a separate script, marker and variables. The existing session diagnostic
remains independent. It never supplies a routing key or writes SQLite. Its random
draws may perturb game randomness, so use disposable saves only.

The exact script is below. At each universe-generated callback it logs
the prior saved tuple, samples the clock once and four unseeded integers once,
then retains the tuple for the next save/restoration comparison. Two fixed-seed
draws are a deterministic control, performed after the candidate draws. The
fixed-clock key deliberately replaces the clock component with a constant;
this reveals repeated random tuples even when real loads are minutes apart.
Do not change the operating-system clock.

```xml
<?xml version="1.0" encoding="utf-8"?>
<mdscript name="LifeSigns_RandomSourceDiagnostic" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="../../libraries/md.xsd">
  <cues>
    <cue name="SampleAtUniverseGenerated" instantiate="true" namespace="this">
      <conditions><event_universe_generated /></conditions>
      <actions>
        <set_value name="$Previous" exact="'UNSET'" />
        <do_if value="md.$LifeSignsRandomDiagTuple?">
          <set_value name="$Previous" exact="md.$LifeSignsRandomDiagTuple" />
        </do_if>
        <debug_text text="'LIFESIGNS_RANDOM_SOURCE_DIAG_V1|before|previous=%s|END'.[$Previous]" filter="general" context="false" />
        <set_value name="$Clock" exact="player.systemtime.{'%Y-%m-%d_%H-%M-%S'}" />
        <set_value name="$R1" min="0" max="2147483647" />
        <set_value name="$R2" min="0" max="2147483647" />
        <set_value name="$R3" min="0" max="2147483647" />
        <set_value name="$R4" min="0" max="2147483647" />
        <set_value name="$Tuple" exact="'%s-%s-%s-%s'.[$R1, $R2, $R3, $R4]" />
        <set_value name="$Candidate" exact="'s1-%s-%s'.[$Clock, $Tuple]" />
        <set_value name="$FixedClockCandidate" exact="'s1-2000-01-01_00-00-00-%s'.[$Tuple]" />
        <set_value name="$Control1" min="0" max="2147483647" seed="42L" />
        <set_value name="$Control2" min="0" max="2147483647" seed="42L" />
        <set_value name="md.$LifeSignsRandomDiagTuple" exact="$Tuple" />
        <debug_text text="'LIFESIGNS_RANDOM_SOURCE_DIAG_V1|sampled|previous=%s|clock=%s|tuple=%s|candidate=%s|fixed_clock=%s|control1=%s|control2=%s|END'.[$Previous, $Clock, $Tuple, $Candidate, $FixedClockCandidate, $Control1, $Control2]" filter="general" context="false" />
      </actions>
    </cue>
  </cues>
</mdscript>
```

No missing-state repair, random retries, delay, counter-based suffix or alternate
source belongs in this test. Do not silently replace `set_value` with
`randominrange`, `gamestart.seed` or a seeded draw. Test the exact source above.

The diagnostic encoding is `s1-<clock>-<r1>-<r2>-<r3>-<r4>`, where the
clock is exactly `YYYY-MM-DD_HH-MM-SS` and each integer is canonical decimal
`0..2147483647`, without signs, leading zeroes (except `0`), padding, whitespace
or exponent notation. Maximum length is 66 ASCII characters. Expected MD `%s`
rendering must be confirmed live. This encoding is **not approved for production**;
there is no production parser, filename or schema contract in this change.

## Deployment and rollback

Close X4 first. Replace `YOUR_X4_INSTALLATION` with the confirmed local game
folder; keep actual paths in ignored `SETUP.local.md`. These are manual commands;
automated tests deploy only to temporary mock installations. Retain the existing
launch options `-debug all -logfile debuglog.txt` and enable Life Signs Bridge
Probe. Node is not needed to collect this diagnostic; inspect the raw X4 log.

Install only the random-source diagnostic alongside the normal probe:

```powershell
git rev-parse HEAD
npm.cmd --prefix bridge test
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RandomSourceDiagnostic
```

If the session diagnostic is already installed, explicitly retain it with
`-SessionDiagnostic`, or remove it with `-RemoveSessionDiagnostic`, on **both**
commands. For example, installing/retaining both is:

```powershell
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -SessionDiagnostic -RandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -SessionDiagnostic -RandomSourceDiagnostic
```

Normal deployment installs neither diagnostic. Once either is installed,
deployment refuses until its retain/remove choice is explicit. The two choices
are independent; selecting and removing the same diagnostic together is an error.
WhatIf performs validation but does not copy, create or remove files. Existing
linked deployment paths and unexpected extension content are refused before
changes. No directory is recursively removed.

Remove the random-source diagnostic (when the session diagnostic is absent):

```powershell
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveRandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveRandomSourceDiagnostic
Test-Path -LiteralPath 'YOUR_X4_INSTALLATION\extensions\lifesigns_bridge_probe\md\LifeSigns_RandomSourceDiagnostic.xml'
```

Expect `False`. To retain an installed session diagnostic during that rollback:

```powershell
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -SessionDiagnostic -RemoveRandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -SessionDiagnostic -RemoveRandomSourceDiagnostic
```

To remove both diagnostics and redeploy the original manifest/probe:

```powershell
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic
```

Removal is limited to the named diagnostic files; unrelated extensions and saves
are untouched. Removal does not purge saved MD state. Discard disposable test
saves and return to a normal save never used with the diagnostic.

Capture records and errors in physical log order, before another launch replaces
the log. Use a new local filename for every capture:

```powershell
Select-String -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -SimpleMatch 'LIFESIGNS_RANDOM_SOURCE_DIAG_V1'
Select-String -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -SimpleMatch 'LifeSigns_RandomSourceDiagnostic'
New-Item -ItemType Directory -Path '.\local-data\random-source-diagnostic' -Force
Copy-Item -LiteralPath 'YOUR_CONFIRMED_DEBUG_LOG' -Destination '.\local-data\random-source-diagnostic\run-01-debuglog.txt'
```

## Initial live procedure: six-sample test

The requested six-sample steps were not included in the implementation request.
The exact initial procedure is pending those steps; no substitute sample matrix
is assumed here. The larger procedure below is optional, not a prerequisite for
the initial test. No live results have been collected.

## Optional extended test

1. Record checkout SHA, X4 version and enabled extensions. Deploy with X4 closed
   using the explicit opt-in commands above. The installed-schema and automated
   checks below do not prove live expression evaluation or RNG freshness.
2. Start a disposable new game or load a disposable test save. Capture all
   diagnostic lines and MD errors in physical log order. Expect one before/sample
   pair, four bounded integers in the specified encoding and equal fixed-seed
   control values. Preserve logs locally before each process restart.
3. Save disposable **A** after tuple T0 has been logged. Record T0 and the save
   slot; leave A unchanged thereafter. Reload that exact A ten times in the same
   X4 process, including consecutive loads as quickly as practicable. Each load
   must show `previous=T0`, then its newly evaluated tuple. An UNSET prior value
   or a different prior tuple fails to demonstrate restoration of A's fixture.
   Never overwrite A between trials. Do not perform extra actions to vary RNG.
4. Exit X4 completely and load that same A in five separate fresh X4 launches.
   Compare all four-integer tuples with every earlier tuple, including T0.
   Compare fixed-clock candidates separately from real-clock candidates. A
   different wall clock cannot count as evidence of random freshness.
5. Load a disposable different-universe save B, then unchanged A, three times.
   Keep B distinct from the corrected-copy B in the earlier lifecycle report.
   A must still show T0 on entry. Include two fresh new-game starts as a separate
   context. Record B's initial UNSET state where applicable; do not call it
   restored diagnostic state. Keep Node stopped throughout sampling, or use
   console-only mode; no database routing is part of this diagnostic.
6. For every transition retain this local table. Run/transition labels are
   assigned by the tester from physical logs, not by a saved MD counter:

   | Run / transition | Prior tuple | Real clock | New tuple | Real-clock candidate | Fixed-clock candidate | Controls equal | MD errors / number of pairs |
   | --- | --- | --- | --- | --- | --- | --- | --- |
   | A reload 1-10 / restart 1-5 / B-to-A 1-3 / new game 1-2 | pending | pending | pending | pending | pending | pending | pending |

7. Fail the freshness gate on any repeated complete newly sampled tuple between
   transitions or equality with T0, even if real-clock keys differ. Repeated
   individual limbs alone are not a complete tuple collision. Identical tuple
   replay is evidence against the candidate, but does not by itself identify
   the engine's RNG implementation. Missing callbacks, multiple pairs for one
   transition, unequal fixed-seed controls, bad types/format or relevant MD errors
   make the experiment failed or inconclusive; do not repair them in the log.
8. If all checks pass, report only **no random-tuple replay observed in these
   trials**. Variable scheduling and other consumers of a restored RNG could
   produce different outputs without independent entropy. A finite successful
   test does not prove non-restoration, entropy width or universal uniqueness.
   Production remains blocked until a source contract or other reviewed evidence
   resolves that limitation, and the owner approves the source assumption and
   exact final key encoding. A collision is a stop, not permission to use the
   clock alone or silently choose another source.

This experiment targets the unresolved source question. It does not repeat or
supersede the passed lifecycle diagnostic, and cannot verify production routing.

## Deferred production scope

After the source and final encoding gates are approved, a separate implementation
may add lifecycle assignment, V2 docking records, opt-in `--auto-db`, schema-v2
per-session ownership, routing under ignored `local-data/sessions/`, and independent
readback. Preserve V1/manual/schema-v1 behaviour and the optional diagnostic.
No permanent identity, deduplication, save parsing, migration, wider events, AI,
voice or return channel belongs to that implementation.

Its review must specify strict key/record validation, mutually exclusive CLI
modes, per-file ownership verification, path/link containment, rejection of
incompatible files without modification, and fatal storage failures without a
false persisted acknowledgement. Matching ownership alone cannot detect reuse
of the exact same key in another session; it cannot compensate for this gate.

The later automated/live acceptance matrix must cover Node restart reuse;
same-save reload, another universe and full X4 restart separation; Node-stopped
load then late reader startup; fresh games, already-docked loads, old diagnostic
saves and corrected saves; stable keys across genuine repeated dockings; malformed
or absent keys; conflicting owners/schemas and unsafe paths; database failures;
and independent read-only verification. Keep production separation unverified
until those live tests pass. None are claimed completed here.

## Validation record

Local checks on Node.js v24.21.0: **46 tests passed, zero failures or skips**,
including built-in `node:sqlite` persistence and mock deployment checks. The
new diagnostic matches the original proposed XML exactly apart from its final
newline. The deployed-source XML, the XML block in this document and both existing MD scripts validated
against the installed X4 9.00 `md.xsd`/`common.xsd` above. `git diff --check`
passed. This verifies schema structure, not MD expression evaluation or RNG
behaviour. Mock checks cover each diagnostic's opt-in, redeployment, conflicting
flags, WhatIf, explicit and repeated removal, independent retain/remove choices,
linked MD directory refusal for random-source deployment/removal, and preservation
of the normal probe and another extension. No deployment into the real X4
installation or live random-source acceptance has been performed.
