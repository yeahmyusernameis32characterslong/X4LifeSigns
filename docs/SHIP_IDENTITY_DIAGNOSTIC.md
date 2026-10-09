# Disposable six-ship identity diagnostic

Status: **Verified for the completed owner-run X4 9.00 scenarios**. Broad
Persistent entity identity remains **In Progress**, not Verified. This is an optional
observation script, not an identity resolver or a database identity contract.
Starting implementation baseline: `733dbc2b64ef67ed935eec538d4d30e7265acdaa`.
Verified implementation: `5921126a8e24e394b36850017649bb0a9cf6b5cc`.
PR review base: `9c27cb9a9315121afb2d2c8f8f932a15e044f3fc`.
See the [live verification record](#live-verification-record) for scope and exclusions.

## Evidence gate and provenance (9 October 2026)

The installed `version.dat` reports `900`. Fresh inspection read base catalogs
01 through 09 and all installed extension catalog indexes (excluding signature
catalogs), extracting relevant MD/schema bytes by catalog offset/length and
checking MD5 against each catalog entry. Loose schema/property copies were also
checked in the installation's libraries and extension trees. No later base,
extension or loose replacements of these three files were found. All three
effective entries are in base `08.cat/08.dat`:

| File | Bytes | MD5 |
| --- | ---: | --- |
| libraries/scriptproperties.xml | 332849 | f03b6cf9076b60754beed0c02c50f80c |
| libraries/common.xsd | 1700737 | de2c08eabd2f3e22d705ed473b7940ce |
| libraries/md.xsd | 195528 | d7ac24747687e15d9be608ff63b52ccd |

Extracts and the catalog manifest stay in ignored `local-data/session-key-source/`.
No game files or saves were modified or parsed. Line references below refer to
those installed extracts. Shipped examples are supporting usage evidence, not
an assertion that every installed mod preserves their behaviour.

The cited shipped examples were also extracted and hash-checked from base
`08.cat/08.dat`: `md/setup.xml` (99371 bytes,
`1b3b766eb107494268a6372a2bc5a463`), `md/notifications.xml` (254525 bytes,
`2eaba2e5da7b77a77fbac0bf38ed83f7`), `md/gm_unlockshadyguy.xml` (39284 bytes,
`94446036dab01461712ce36eaf0507dd`) and `md/factionlogic_staticdefense.xml`
(99984 bytes, `ffc55a74308736a8fee5fecaf7385f51`).

| Mechanism | Exact supported expression/action and evidence | Limitation |
| --- | --- | --- |
| Enumeration | `find_ship name="$Ships" space="player.galaxy" trueowner="faction.player" checkoperational="true" multiple="true" recursive="true"`; common.xsd:28349, findship:6664, trueowner:5598; same attributes in md/setup.xml:401 | Operational player-owned ships only at enrolment. Recursive search includes contained objects; no enumeration order or stable index contract. |
| Multiple/recursive | common.xsd:745,764 documents all matching objects as a list and recursive contained-object search | Single-result lookup can pick a random match; this diagnostic never uses it. No search after enrolment. |
| References and storage | `set_value ... exact="$Ship"`, table entries `.{'$' + $Label}`, `table[]`; common.xsd:36233; md/setup.xml:713 stores a commander component reference, :69,87 create tables; md/notifications.xml:3616 sets keyed table entries | These are engine component references in MD state, not serialised external IDs. Save/reload behaviour passed the recorded matrix; destroyed-reference behaviour was not exercised. |
| Validity | `$Ref.exists`, `$Ref.isoperational`, `$Ref.isclass.ship`; scriptproperties.xml:13-19 | Exists means present in the game graph, not operational/alive. A wreck may still exist. A missing slot and an invalid reference are different observations. |
| ID code | `$Ref.idcode`; scriptproperties.xml:198, object type | Documented string format `AAA-123`; no permanent uniqueness, reuse or cross-universe guarantee. Original string is retained independently of the reference. |
| Player-visible name | `$Ship.name` (display name), `.rawname`, `.knownname`, `.hasbeenrenamed`; scriptproperties.xml:50-53 | Name is used only for one-time exact fixture-label matching. No delimiter/newline escaping contract was established; never emit names. Owner records later name observations locally. |
| Class | `.class`/`.realclass`, scriptproperties.xml:27-28; `.isclass` shortcuts:18-23; md/setup.xml:406 formats `.class`; size predicates in md/factionlogic_staticdefense.xml:1332-1335 and md/notifications.xml:1882 | Output uses fixed `ship_s`, `ship_m`, `ship_l`, `ship_xl`, `OTHER` tokens from class predicates, not arbitrary enum formatting. OTHER covers valid objects outside those current classes; wreck-state behaviour must be observed. It does not assert a ship model/macro. |
| Commander | `$Ref.commander`, scriptproperties.xml:332; shipped md/setup.xml:708-713 retains the old commander reference | Immediate commander only; can be absent. Test `.exists` before `.idcode`; `commander_fixture` compares component references, never ID/name equality. This is a current relationship, not lineage. |
| Other relationships considered | `.toplevelcommander`, `.subordinates`, `.allsubordinates`, `.allcommanders`, scriptproperties.xml:333,338,350-351 | Not needed in this diagnostic. Do not interpret the immediate commander as the fleet's top-level commander. |
| Snapshot trigger | `event_object_docked group="global.$PlayerControlledGroup"` plus personally controlled ship/non-spacesuit check; common.xsd:13924; md/setup.xml:44,583,658,665; md/gm_unlockshadyguy.xml:527; md/notifications.xml:706 | Uses the verified readiness gate and instantiated listener in a separate script. Loading while already docked is not a requested new docking; registration can miss earlier events. |
| Bounded traversal/output | `do_for_each`, md.xsd:4461; lists/count/index, scriptproperties.xml:1760 onward; `debug_text`, common.xsd:25956 | Six fixed slots per ready docking, at most 36 reference comparisons for commanders. One universe search at enrolment only; no periodic roster polling. |
| MD state/lifecycle | md.xsd:1052,4584 supports instance namespaces and instantiation; installed examples retain references in variables/tables | Initialisation is a non-instantiated cue. Enrolment flag, tables and counter belong only to this diagnostic. No load reset or lookup-based recovery exists. |

The [Egosoft MD guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
applies to X4's general MD system; installed X4 files determine available actions
and properties. Its safe-properties section permits `.exists` on null/destroyed
references, and its lookup section defines `?` existence tests. Its refresh
section describes restoring saved MD state and preserving cue names/parents.
That supports testing retained references; it does not guarantee permanent
identity. Schema validity alone cannot establish runtime expression behaviour.

**Gate passed for implementing this observation mechanism:** enumeration,
reference retention and bounded snapshots are supported. Persistence guarantees
are deliberately the subject of the experiment, not a prerequisite assumed true.

### Candidates inventoried only

- **NPC/person:** component `.seed` (scriptproperties.xml:48) is described as a
  persistent pseudo-random seed. Instanced NPC `.npctemplate` (1430) connects to
  a people entry. A controllable's `.people.list` and `.people.{$npctemplate}`
  (373-377) expose templates with object context, not necessarily actual NPCs.
  Contextual template `.seed`, `.name`, `.exists` (2045-2050) are candidates;
  no universal uniqueness, transfer continuity or interchangeability of template
  and instanced component references is established. No crew implementation.
- **Station:** `find_station` (common.xsd:28404 onward) and component/object
  `.exists`, `.name`, `.class`, `.idcode` are candidates. Distinguish a station
  object from its modules and docking bays. No station retention test, rebuild
  identity or cross-universe uniqueness is claimed.
- **Replacement context:** `fleetunit.object`, `.macro`, `.build`
  (scriptproperties.xml:1741 onward) describe reconstruction-related references.
  Their existence does not prove the owner's automatic-replacement name/ID
  assumption, nor identify which actual game mechanism applies to this fixture.
  They are not used by the diagnostic.

## Fixture, enrolment and records

Observe six selected ships within the owner's larger Custom Start fixture: one
independent Xperimental Shuttle (small fighter class), one Colossus E and four
Behemoth E destroyers. The wider fixture contains additional ships and assets;
these six are the observation roster, not the entire Custom Start. Preserve the
wider fixture rather than selling, deleting or replacing ships to simplify testing.
Before the first diagnostic docking,
record the original visible names, ID codes, ship models/classes and commander
assignments in a local worksheet. Temporarily assign these exact unique names:

| Fixed fixture label / temporary name | Owner-confirmed object |
| --- | --- |
| LSID-XF | Independent Xperimental Shuttle (small fighter class) |
| LSID-COL | Colossus E |
| LSID-BEH1 | First individually recorded Behemoth E |
| LSID-BEH2 | Second individually recorded Behemoth E |
| LSID-BEH3 | Third individually recorded Behemoth E |
| LSID-BEH4 | Fourth individually recorded Behemoth E |

Numbers are worksheet labels, never enumeration positions. The owner checks the
models and independent fighter role; the script does not infer models from a
name or ship size. Other owned ships can exist but none may share these names.
Ensure all six fixture ships are operational at enrolment.

At the first eligible docking with ready production state, the script attempts
enrolment exactly once. Every label must match exactly one enumerated ship.
Only if all six uniquely match valid components with nonempty ID codes does it
retain all six references and original ID codes in diagnostic-only MD tables.
Completion is checked by reading back all six retained references and originals;
match counts alone cannot report success. Internal string keys have a `$` prefix;
fixture labels, name matching and protocol values remain unchanged. A failed attempt remains failed, including after
reload; it produces `complete=0` and six missing-reference rows. Correct the
fixture in a disposable save made before the first enrolment attempt and retry there.
Never reset/reinstall cues to repair a saved trial or silently substitute ships.

Each ready docking increments the saved snapshot counter and emits six records:

```text
LIFESIGNS_IDENTITY_DIAG_V1|ship|session=s1-2026-10-09_12-00-00-1-2-3-4|snapshot=1|fixture=LSID-XF|reference=valid|original=ABC-123|current=ABC-123|class=ship_s|operational=true|commander_reference=none_or_invalid|commander_idcode=NONE|commander_fixture=NONE|END
```

Values above are illustrative. `reference` is `valid`, `invalid` (slot exists but
reference is null/outside graph), or `missing` (no retained slot). Invalid/missing
rows retain the original code if available, with current/class/relationship
`UNAVAILABLE`; operational=false then means unavailable, not confirmed wreck.
For a valid ship, commander_reference is `valid` or `none_or_invalid`; commander
code/label use NONE for the latter. A valid commander's label is a retained
fixture label or OUTSIDE_ROSTER, determined solely by reference equality.
Absence and invalidity of a commander are intentionally not distinguished.

Initial enrolment also emits one `enrolment` record. Missing/unready production
state emits one `blocked` record, with no enrolment or snapshot. Missing attempted
flag/counter emits `reason=missing_diagnostic_state`, with no reconstruction.
There is no production state write. The original V1/V2 records, readers, routing
and schema-v1/v2 databases are unchanged. Diagnostic records are ignored by all
reader modes; they are inspected in the raw log, not persisted.

Snapshot numbers can rewind on reload and are not session IDs. Correlate physical
log order, tester-assigned run label, full ready production key and snapshot.
The production key retains its existing scoped s1 assumptions. No load callback
re-enrols ships; names, current/original ID codes and search order never repair
or replace a retained reference.

## Opt-in deployment and removal

Automated testing does not deploy into live X4. To repeat owner testing,
close X4 and use a disposable pre-diagnostic save. Keep actual paths in ignored
SETUP.local.md. Record checkout SHA and enabled extensions. Run:

```powershell
git rev-parse HEAD
npm.cmd --prefix bridge test
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -IdentityDiagnostic -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -IdentityDiagnostic -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic
```

Retain logging options `-debug all -logfile debuglog.txt`. This adds only
`md/LifeSigns_IdentityDiagnostic.xml` beside the normal probe/manifest. Normal
deployment does not install diagnostics. Each installed diagnostic requires an
explicit retain/remove choice; contradictory flags, linked paths and unexpected
extension content are refused using existing conventions. WhatIf changes nothing.
The older diagnostics can independently be retained, but remove them for this
matrix to reduce unrelated output. Node is not needed for diagnostic emission.

After testing, close X4 and remove the diagnostic explicitly:

```powershell
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveIdentityDiagnostic -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic -WhatIf
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION' -RemoveIdentityDiagnostic -RemoveSessionDiagnostic -RemoveRandomSourceDiagnostic
Test-Path -LiteralPath 'YOUR_X4_INSTALLATION\extensions\lifesigns_bridge_probe\md\LifeSigns_IdentityDiagnostic.xml'
```

Expect False. Removal targets only named diagnostic files; it does not clean
saved MD state. Archive/discard disposable trial saves and return to a normal
save never used with this diagnostic. Do not claim save="0" means no saved state.

## Owner-run live matrix

Core owner Tests 0–20 passed; the numbered scenarios below are the repeatable
procedure, not a one-to-one mapping to the owner test numbers. Results are
recorded [below](#live-verification-record).

Use a local worksheet in `local-data/identity-diagnostic/` with run label, game/
code version, save label, production lifecycle/key, snapshot, fixture label,
reference status, original/current ID, observed visible name/model, class,
operational state, commander ID/fixture/visible assignment, row count and relevant
MD errors. Save raw logs there before another X4 launch replaces them. Keep saves
private; do not parse them. Use separate worksheet rows for each of six ships in
every scenario. Missing evidence is inconclusive; preserve contradictions.

1. **Baseline:** use the six labelled observation ships within the larger fixture;
   personally dock, expect one complete=1 enrolment and six valid rows. Check all labels against the
   worksheet and game UI, including the independent fighter and all four distinct
   destroyers. Undock/dock again: another six rows, same references' original/current
   IDs and relationships, no second enrolment. Save disposable **A now**, with
   diagnostic state present, and never overwrite it. Record A's saved counter.
2. **Unchanged A reload 1 and 2:** load the same A twice, genuinely undock/dock
   each time. Expect six retained slots, original IDs from baseline, observed
   current IDs and current relationships; no enrolment record. Correlate each
   with production invalidation/replacement and ready key. Counter restoration
   is expected; a new key does not mean new entity identity.
3. **Rename:** after enrolment, restore original names or choose new names.
   Dock and compare all six. Names go only in the worksheet. Reference/ID
   continuity is the measured result, never inferred from the new name.
4. **Duplicate names:** give two Behemoths the same visible name after enrolment;
   dock. Their fixed fixture labels must still distinguish the retained objects.
   Do not rerun enumeration or collapse rows. Record both current IDs independently.
5. **Commander reassignment:** reassign one identified Behemoth to a different
   commander (or make it independent) in the UI, preserving all six ships and
   keeping the fighter independent. Dock in the fighter. Compare immediate
   commander fields to the UI and verify original ship IDs were not reassigned.
6. **Changed B:** save a separate **B in the same universe**, containing the
   rename/duplicate-name/commander changes. Reload B and dock; compare with its
   own pre-save snapshot. B must retain its roster without enrolment.
7. **Rollback to A:** load untouched A, dock and compare with A's baseline,
   including restored visible names/relationships and saved counter. Do not
   merge B observations into A or treat a rewind as reference replacement.
8. **Full X4 restart:** preserve the log, exit completely, restart, load A and
   genuinely dock. Compare six slots with A; observe the new ready production
   key independently. No second enrolment is expected.
9. **Independent fresh universe C:** use a separate fresh Custom Start with the
   same six selected ship roles within the larger fixture. Label the selected
   ships before the first diagnostic docking.
   Expect its own one-time enrolment and six rows. Reused labels/names or equal
   ID strings prove no relationship to A/B. Do not link their histories.
10. **Node restart and late startup:** in one loaded session, stop/restart the
    console reader and dock; then reload A with Node stopped, start Node later
    and dock. Raw diagnostic emission and retained roster must not depend on
    Node. Reader begins at EOF and acknowledges only the new normal V1 docking.
11. **Filter/error checks:** an AI-controlled docking (including as passenger),
    docking approach/abort, and loading while already docked must not count as
    requested snapshots. Undock and genuinely dock afterwards. Expect exactly
    six rows per eligible event, no duplicate enrolment, no name text in records,
    no missing-group, duplicate-cue, property lookup or other relevant MD errors.

Report each result separately, scoped to this version/fixture. Unexpected
reference loss, changed IDs, absent rows or incorrect relationships are findings,
not permission to substitute/re-enrol. Successful finite trials do not establish
permanent ID uniqueness, save lineage or general persistent entity identity.

### Separate optional destruction/replacement test

Use a new disposable copy after finishing the matrix; preserve A, B and the full
baseline fixture. Record a chosen destroyer's last valid snapshot. If deliberately
testing destruction, observe its retained slot afterwards: the engine may expose
a wreck, an invalid reference or a missing slot. Original ID must remain recorded;
the diagnostic must never attach that slot to another object.

**Owner-supplied assumption, not verified:** X4's actual automatic ship replacement
mechanism keeps the player-facing name/role but assigns the replacement a new
idcode. To test that claim, first identify the actual automatic mechanism and
record its configuration and an automatically produced replacement in the UI/local
worksheet. Keep the diagnostic bound to the destroyed original. Observe replacement
name, role and ID separately; this code does not enrol it or infer lineage.
If automatic replacement cannot be triggered/evidenced, mark that claim untested.
A manually bought/built/acquired replacement tests only the manual path and must
never be reported as verification of automatic replacement behaviour.

## Automated validation

Validate the diagnostic against the effective installed `md.xsd` and `common.xsd`,
then run `npm.cmd --prefix bridge test` and `git diff --check`. Mock deployment
checks cover opt-in, redeployment, WhatIf, explicit removal, flag conflicts,
independent selection with both older diagnostics and junction refusal. Focused
real-reader tests feed valid/invalid/missing/malformed diagnostic records through
console, manual v1, empty auto and existing auto v2 modes, proving no diagnostic
acknowledgements, new automatic files or changes to existing database bytes/rows.
These checks do not execute MD expressions or verify the live matrix.

Historical result at `b1092e3`, before the live enrolment defect, on Windows / Node.js **v24.21.0**: **104/104 tests passed, zero
failures or skips**, including all mock deployment tests and four focused reader
modes above. All four MD files passed .NET XmlReader validation against the freshly
hash-checked installed X4 9.00 schemas. `git diff --check` passed. Production MD,
manifest and bridge source files have no changes relative to the reviewed baseline.
The initial mock run found a switch/path variable-name collision in the new
deployer code; the corrected version passed the full rerun. No live deployment or
in-game test was performed at that validation stage. Subsequent live results and
the correction are recorded below. Logs/extracts remain ignored and local.


## Historical blocking enrolment defect and correction (resolved)

At reviewed head `b1092e38d5406704488857727589440a535a2678`, owner Tests
0–2 passed (104/104 Windows tests, optional deployment, and labelled fresh fixture).
Test 3 failed: the normal production docking acknowledgement worked, but the
identity diagnostic emitted `complete=1` followed by six missing-reference rows
with no original ID codes. This is a diagnostic failure, not identity evidence.

The code used plain `LSID-*` strings as MD table keys. The
[Egosoft MD guide, Tables section](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
requires string keys to start with `$`. Name-match counts could therefore succeed
while candidate/retained table writes failed. The old `$AllUnique` branch set
Enrolled true without checking stored references or originals. This explains the
contradiction; the supplied output does not show a failure to find ship names.
Existing reader tests injected synthetic protocol records and checked isolation;
they did not execute enrolment. XML schema validity does not validate these
runtime key values or the completion invariant.

The correction prefixes every internal candidate/retained/commander lookup key,
checks candidate validity and original ID availability, and reports completion
only after readback of six valid retained references with matching nonempty
original codes. Failed attempts remain one-shot; there is no retry, saved-state
repair, name-based recovery or production-state write. Cue names, hierarchy and
saved diagnostic variable names remain unchanged.

Eight regression tests execute the actual XML action tree in a deliberately
limited test harness with fake components and MD string-key restrictions. They
cover complete, zero/partial/duplicate matches, missing/empty IDs, invalid
components, write failure, invalid-key mutation, no retry and retained snapshots
including commander lookup. This harness is not the X4 engine and cannot prove
save restoration or engine/schema compatibility.

Initial correction validation passed the eight focused regressions on Linux /
Node.js v24.19.0; the full-suite limitations are retained in TESTING.md. Windows
and installed-schema validation were unavailable in that review environment.
Those outstanding checks were subsequently completed by the owner on `5921126`,
followed by the live matrix below. The earlier 104/104/schema result was never
used as validation of the correction.

## Live verification record

Owner-reported completion on **9 October 2026**, with **X4 9.00** and
**Node.js v24.21.0**, at implementation
`5921126a8e24e394b36850017649bb0a9cf6b5cc`. The final documentation tidy-up does
not change implementation or tests. Raw logs, saves and local worksheets remain
private; the following is the supplied result summary, not independently rerun
live evidence.

| Check | Result and scope |
| --- | --- |
| Corrected Windows automated suite | **112/112 passed, 0 failed, 0 skipped**. Includes enrolment regression harness, reader isolation and deployment safeguards. |
| Installed-schema validation | **4/4 passed** using .NET XmlReader and effective installed X4 9.00 `md.xsd` / `common.xsd` with the hashes recorded above. Files: `LifeSigns_BridgeProbe.xml`, `LifeSigns_IdentityDiagnostic.xml`, `LifeSigns_RandomSourceDiagnostic.xml`, `LifeSigns_SessionDiagnostic.xml`. |
| Core owner Tests 0–20 | **Passed**. Corrected one-time enrolment, six valid retained rows and second docking without a second enrolment. |
| Same-universe restoration | Unchanged A reloads #1 and #2, changed B reload, rollback to untouched A and full X4 process restart passed with retained references and stable original/current ID codes. |
| Mutable display/relationship state | Post-enrolment rename, duplicate visible names and commander reassignment passed without changing physical ship identity. Rollback restored A's commander relationship. |
| Independent Universe C | Independently enrolled its own six ships. Reused fixture labels imply no continuity with A. |
| Node independence | Node restart and late start after X4 load passed; neither caused re-enrolment. |
| Event filtering | AI/passenger docking, genuine approach/abort and already-docked save/load were ignored. A later genuine docking produced the expected snapshot. |
| Final error audit and comparison | Passed; the supplied core matrix reported no blocking diagnostic/runtime regression. |
| Optional destruction/replacement Test 21 | **Not exercised / optional path unavailable in current fixture**. No suitable X4-driven automatic replacement path was exposed; no manual replacement substituted. Not a failure. |
| Cleanup Test 22 | **Passed**, with Node stopped and X4 fully exited: `LifeSigns_IdentityDiagnostic.xml` absent and `LifeSigns_BridgeProbe.xml` still present. This proves file removal while preserving the production bridge, not removal of diagnostic state from saves. |

### Observed ship codes

These are in-game observation values, not permanent external identifiers.

| Fixed observation slot | Universe A (stable throughout tested scenarios) | Independent Universe C |
| --- | --- | --- |
| LSID-XF | OWX-378 | OMG-821 |
| LSID-COL | JQK-918 | GSW-707 |
| LSID-BEH1 | AUI-778 | CVM-497 |
| LSID-BEH2 | DJX-426 | HBA-299 |
| LSID-BEH3 | NZA-408 | HIV-500 |
| LSID-BEH4 | RPU-549 | YBO-099 |

The retained ship `AUI-778` changed commander from `JQK-918 / LSID-COL` to
`ZEC-039 / OUTSIDE_ROSTER`. Rollback to untouched A restored
`JQK-918 / LSID-COL`. The ship's physical reference and ID code stayed unchanged;
commander membership was observed as mutable relationship state.

### Scoped conclusion and remaining limits

**The optional six-ship identity diagnostic is Verified for the completed
owner-run X4 9.00 scenarios.** In the tested universe, six selected ships,
including four same-class Behemoth E destroyers, were recognised through retained
MD component references after the tested saves/reloads and process restart.
Their observed ID codes remained stable despite renaming, duplicate visible
names and commander changes. The independent universe enrolled separately;
fixture-label reuse was not treated as identity continuity.

This supports `idcode` as a candidate for scoped physical-ship identification;
it does not prove permanent or globally unique `idcode`, cross-universe identity,
NPC/crew identity, named-vessel lineage, automatic save ancestry or automatic
destruction/replacement behaviour. No production identity resolver or database
identity contract is implemented. **Persistent entity identity remains In Progress.**

Failed enrolment remains one-shot and missing/invalid retained references are
reported rather than replaced. Zero/partial-match, missing-ID and write-failure
cases are covered by the regression harness; no separate live negative-fixture
trial or destroyed-reference trial is claimed beyond the owner's supplied matrix.
The harness is not an X4 emulator. The known Linux lock-fixture limitation remains
test-only and does not override the successful Windows validation.

The historical recovery rule remains: renaming is preparation, not enrolment.
Enrolment occurs on the first eligible personally controlled docking. A preserved
save before that attempt can be used for a new trial; a failed-attempt save must
not be repaired by resetting cues, clearing flags or substituting references.
