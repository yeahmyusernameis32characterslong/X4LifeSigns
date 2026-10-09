# X4LifeSigns testing

## Current status

The owner-reported Windows automated bridge/persistence/routing suite passed
**97/97 tests, zero failures or skips**, on Node.js v24.21.0 with built-in
`node:sqlite`. This automated validation is separate from live X4 verification.
**Experimental docking bridge verified in live X4.** Optional SQLite persistence
is **Verified with live X4 docking across Node.js restarts.** Wider AI and voice
criteria below describe future verification, not completed results.

The optional [random-source diagnostic](docs/SESSION_KEY_SOURCE_GATE.md) has
installed X4 9.00 schema validation and mock deployment/removal coverage,
including independent selection alongside the session diagnostic. Its six-sample owner-reported X4 9.00 live test passed: unchanged-save loads
restored T0, all six sampled tuples differed, controls matched and no relevant MD
errors were reported. This establishes no observed tuple replay, not independent
entropy, 124 random bits or guaranteed uniqueness. Production session separation
is **Verified** through the separate owner-run X4 9.00 production live matrix
on Node.js v24.21.0 under the approved practical local single-player `s1` assumption.
The source decision remains closed; see the approved assumption
and its limitations in that document.

## Docking bridge experiment

Run `npm.cmd --prefix bridge test` from the repository. The tests use synthetic
temporary logs and a mock installation; they do not start X4 or edit its real
log or save. The MD XML also requires validation against the installed X4 9.00
schema. Follow [BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md) for the live test:
personally pilot, complete docking, undock and dock again, and check that other
ships do not trigger the probe. Status: **Experimental docking bridge verified in live X4.**

The completed owner-reported live results, tested revision and limitations are
recorded in [the live verification record](docs/BRIDGE_EXPERIMENT.md#live-verification-record-5-october-2026).
Only the experimental docking bridge is verified, not the wider milestone.

## Docking persistence experiment

Run `npm.cmd --prefix bridge test` to run all test files, using temporary
databases and synthetic logs. Checks include committed readback, a separate
process after graceful shutdown, restart without replay, repeated dockings as
separate rows, manual database separation, incompatible/corrupt files remaining
unchanged, read-only missing-file refusal and real write-lock failures with no
false success. The original reader/deployment tests still pass.

Keep X4 running during the initial live test: one docking -> stop writer ->
separate readback -> restart without docking -> unchanged count -> another
docking -> two distinct record IDs. Choose a fresh file for another save/universe
or game reload. See [PERSISTENCE_EXPERIMENT.md](docs/PERSISTENCE_EXPERIMENT.md).
This establishes no identity continuity across game reloads. Completed
owner-reported results and the tested revision are in the
[live verification record](docs/PERSISTENCE_EXPERIMENT.md#live-verification-record-5-october-2026).

## Automatic session routing

Run the full suite with `npm.cmd --prefix bridge test`. The 51 new focused tests
cover exact canonical V2 parsing and bounds; malformed input without storage;
V1-only console/manual and V2-only auto consumption; argument conflicts;
source-relative storage from another working directory; separate-process reuse;
different keys (including identical-clock/different-tuple keys); identical-key
reuse without suffixes; transactional schema/ownership creation; rejection of
wrong/absent/extra owners, schemes, schemas, v1, empty and corrupt targets without
modification; independent v1/v2 readback; committed readback before success; real
lock and injected open/write/commit/readback failures; exclusive competing
creation; junction/hard-link/sidecar refusal and ignored generated files.
WAL-header refusal prevents even read-only SQLite shared-memory sidecar creation.
The original 46 tests, including Windows mock deployment, remain passing.

The changed `LifeSigns_BridgeProbe.xml` validates against installed X4 9.00
`md.xsd`/`common.xsd` extracts. Their MD5 hashes match the installed 08.cat entries:
`d7ac24747687e15d9be608ff63b52ccd` and `de2c08eabd2f3e22d705ed473b7940ce`.
This is static schema validation, not live verification.

The exact [owner-run production matrix](docs/AUTOMATIC_SESSION_ROUTING.md)
requires both optional diagnostics removed, A saved after production state is
assigned and retained unchanged, two reloads of A showing restored invalidation
and replacement, Node-only restart reuse, B-to-A, fresh games, full X4 restart,
late Node startup, already-docked loading, the docking filter/V1 compatibility
and independent ownership/history readback. The owner completed this matrix
on X4 9.00 with Node.js v24.21.0 at `424d571f66f314b81943f7a2322b6af089e7aeff`.
All observed full V2 keys were canonical; the independent audit found nine
correctly owned schema-v2 databases with the expected counts (12 rows total).
See the [live verification record](docs/AUTOMATIC_SESSION_ROUTING.md#live-verification-record)
for the scenarios and results.

Automatic session separation is **Verified** only under the approved practical
local single-player `s1` assumption, not guaranteed uniqueness, permanent entity
identity, RNG entropy or exactly-once delivery.

The documentation-update rerun on Linux/Node.js v24.19.0 produced 91 passes,
five Windows-only skips and the previously reviewed lock-fixture timeout. The
fixture closes a file descriptor while holding a SQLite lock, releasing POSIX
process locks; this test-only portability issue is non-blocking for the verified
Windows/X4 9.00 milestone. It does not supersede the owner-reported 97/97 run.

## Optional ship-identity diagnostic

Status: **Verified for the completed owner-run X4 9.00 scenarios** in the
[six-ship live matrix](docs/SHIP_IDENTITY_DIAGNOSTIC.md#live-verification-record).
Six selected ships within the larger Custom Start fixture were observed: an
independent Xperimental Shuttle (small fighter), a Colossus E and four Behemoth E
destroyers. Enrolment is one-time; snapshots never re-identify ships.

Owner-reported validation of corrected implementation
`5921126a8e24e394b36850017649bb0a9cf6b5cc`:

- Windows / Node.js **v24.21.0: 112/112 passed, 0 failed, 0 skipped**.
- All four MD files (`LifeSigns_BridgeProbe.xml`, `LifeSigns_IdentityDiagnostic.xml`,
  `LifeSigns_RandomSourceDiagnostic.xml`, `LifeSigns_SessionDiagnostic.xml`)
  passed .NET XmlReader validation against hash-checked installed X4 9.00 schemas:
  `md.xsd` MD5 `d7ac24747687e15d9be608ff63b52ccd` and `common.xsd` MD5
  `de2c08eabd2f3e22d705ed473b7940ce`.
- Separately, live **core Tests 0–20 passed**, including retained references across
  reloads/restart, renaming, duplicate names, commander changes/rollback,
  independent Universe C, Node independence, event filtering and final audits.
- Optional Test 21: **Not exercised / optional path unavailable in current fixture**.
  No manual replacement was substituted; this is not a failure.
- Cleanup Test 22 passed with Node stopped and X4 exited: identity diagnostic
  absent, production bridge still present.

The historical `b1092e3` Windows 104/104 and schema passes did not prevent live
Test 3 exposing false successful enrolment with six missing references. The
correction uses `$`-prefixed table keys and validates retained references/original
codes before reporting success. Eight regression tests execute actual XML actions
in a limited fake-component harness, including zero/partial matches, failed writes
and no retry. Reader-isolation and deployment tests remain separate from this
harness and from X4 runtime evidence. The defect history is preserved in the
experiment document.

The earlier corrected-head Linux / Node.js v24.19.0 run reported 112 total,
103 passed, 1 failed and 8 skipped. Its known POSIX lock-fixture timeout and
Windows-only deployment skips do not override the subsequent owner Windows
112/112 result. XML well-formedness and `git diff --check` also passed then.
The final documentation-only review reran the eight enrolment regressions and
four reader-isolation cases on Linux: **12/12 passed**, with no failures or skips.
No implementation/test bytes changed; `git diff --check` passed again.

Broad Persistent entity identity remains **In Progress**. The evidence establishes
scoped ship-reference/ID-code stability, not permanent/global uniqueness,
cross-universe identity, crew identity, lineage, automatic save ancestry or
replacement behaviour. Negative-enrolment/no-retry cases have automated coverage;
no additional live negative-fixture trial is claimed in the supplied results.

For any subsequent production-routing-only acceptance run, also explicitly
use `-RemoveIdentityDiagnostic` with the deployer and check its file is
absent. The earlier verified production matrix predates this optional script.

## Proposed first milestone: Remember one real event

Use one real X4 event involving one identifiable entity. The current contained
docking experiment tests the capture-to-console boundary first, using an
installed-schema/shipped-code hook. Its live docking path has passed the
owner-reported checks. SQLite persistence has automated checks and owner-reported live
verification across Node.js restarts; permanent identity remains unverified.

Acceptance criteria:

1. Trigger the selected event in live X4 and capture the entity identity and relevant event context.
2. Demonstrate that the event reaches the Node.js service through the chosen bridge.
3. Persist the event and its entity association in SQLite.
4. Read the stored record and display a minimal text acknowledgement grounded in its contents.
5. Restart the service and retrieve the same record, still associated with the same entity.
6. Repeat the event for that entity and verify that its history remains linked correctly.

Document what was actually tested, including X4 version, repository revision, reproduction steps, expected and observed output, and the persisted record checked. Verify identity behaviour across game save/reload before claiming continuity across play sessions. State any untested identity or save isolation assumptions.

A simulated event can test external handling and persistence, but it does not prove live X4 capture or the bridge. If X4 cannot be run, report the milestone as only partially verified and supply the remaining in-game steps.

The wider milestone uses text and does not require a language model or voice.
The current experiment's commands and in-game steps are in
[BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md); persistence checks are
documented in [PERSISTENCE_EXPERIMENT.md](docs/PERSISTENCE_EXPERIMENT.md).

## Future voice and combined AI checks

The following checklist is for later implementation work. No voice or combined AI results are currently recorded.

## Voice testing

Voice-related features should be tested separately from general game logic.

Speech-to-text testing should cover:

- microphone detection
- speech recognition accuracy
- background noise
- different speaking volumes
- partial or interrupted speech
- recognition latency
- graceful handling when faster-whisper is unavailable

Text-to-speech testing should cover:

- successful Kokoro generation
- synthesis latency
- voice selection
- audio playback
- queued speech
- overlapping dialogue prevention
- graceful handling when Kokoro is unavailable

Combined AI testing should measure:

- X4 performance
- GPU utilisation
- VRAM usage
- local LLM latency
- speech recognition latency
- speech synthesis latency

Testing should include scenarios where X4, Ollama, faster-whisper and Kokoro are active at the same time.

The voice system should fail gracefully.

A failure in speech recognition or speech synthesis must not crash the Node.js server or prevent unrelated Life Signs events from continuing.
