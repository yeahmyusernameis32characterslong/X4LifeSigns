# X4LifeSigns Design Decisions

This document records important project decisions so they are not accidentally reversed later.

## First docking experiment

Prove only personally controlled completed docking through an MD debug record
and a read-only Node.js console acknowledgement. Use the installed X4 9.00
controlled-group and instantiated-cue pattern. Use game-derived `idcode` strings
for this diagnostic record; this does not decide permanent database identities.
Debug-log polling is experimental transport. No SQLite, AI, voice, networking,
Lua or communication back into X4 is added. The probe uses `save="0"` and a
separate test save. Status: **Experimental docking bridge verified in live X4.**
Details and installed evidence: [BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md).

## Docking persistence experiment

Use built-in `node:sqlite` on confirmed Node.js v24.21.0; no database server or
npm database package. Optional `--db` commits one row per docking, reads it back
and acknowledges stored values. A separate read-only process verifies Node
restart persistence while X4 stays running. Schema version 1 is documented in
DATABASE.md. Incompatible files are rejected without migration or repair.
Manually choose one database per controlled history and a fresh file for another
save/universe or reload. ID codes are not claimed permanently unique. Status:
**Verified with live X4 docking across Node.js restarts.** Original bridge verification
remains unchanged.

## Production automatic session routing

The source prerequisite was closed by the owner-approved practical `s1`
assumption in merged PR #10. This implementation uses one clock sample plus four
newly executed unseeded `set_value` draws from `0..2147483647`, assigned only at
`event_universe_generated`. `event_game_loaded` invalidates restored readiness;
game start and docking never create, repair or replace a key. No source gate is
reopened. Independent entropy, 124 random bits, uniformity, reseeding and
guaranteed uniqueness are not established.

Keep the saved cue tree, PR #9 readiness fix and docking filter. Preserve V1
output and console/manual consumption. V2 carries the complete production key;
opt-in `--auto-db` consumes only V2, strictly validates it and lazily routes to
source-relative `local-data/sessions/<key>.db`. Dedicated
`LIFESIGNS_SESSION_ROUTING_V1` lifecycle/failure messages are diagnostics only.
Both optional diagnostic scripts remain independent and are removed for live
production acceptance.

Schema v2 adds exactly one `session_metadata` ownership table while preserving
`docking_events`. Existing files are validated read-only before writable opening;
schema and ownership are rechecked transactionally. Initialise only exclusively
created new files, never existing empty or v1 targets. Reject unsafe paths,
incompatible/corrupt files, wrong owners and unexpected objects without migration,
repair or modification. Refuse pre-existing sidecars and WAL-format v2 targets
to preserve read-only rejection. Commit and read back each docking before
acknowledging; any automatic storage failure stops with non-zero exit.

Reuse an identical key as the same owner across Node restarts. Do not invent
collision suffixes: an actual cross-session complete-key collision can mix
histories and is an accepted, unquantified residual risk. There is no timestamp
fallback, random retry, save parsing, migration, deduplication or permanent
entity identity. Existing log startup/replacement behaviour remains unchanged.

Status: **Verified live in X4 9.00 with Node.js v24.21.0** under the approved
practical local single-player `s1` assumption. The owner completed
[production live acceptance](docs/AUTOMATIC_SESSION_ROUTING.md#live-verification-record)
with both optional diagnostics absent. Automated checks and installed-schema
validation remain separate from the live isolation and key-rendering evidence.

## Disposable ship-identity observation

The optional [identity diagnostic](docs/SHIP_IDENTITY_DIAGNOSTIC.md) observes the
six selected ships within the owner's larger Custom Start fixture using one-time
unambiguous labels and retained MD component references/original ID codes. A failed enrolment is not retried in that
saved state. Current names, ID codes and enumeration order never repair references.
Snapshots read ready production session state without modifying it; diagnostics
stay outside production persistence. Display names remain in a local worksheet.
Status: **Verified for the completed owner-run X4 9.00 scenarios** at `5921126`.
Core Tests 0–20 and cleanup Test 22 passed; optional destruction/replacement
Test 21 was not exercised because a suitable automatic path was unavailable.
The selected ships were an independent Xperimental Shuttle (small fighter),
a Colossus E and four Behemoth E destroyers. Retained references and ID codes
remained stable through the tested saves/reloads, renames and commander changes.
Persistent entity identity remains **In Progress**. No permanent/global ID-code
uniqueness, cross-universe identity, NPC/crew identity, named-vessel lineage or
automatic save ancestry is established. No production resolver, schema change
or history merging is introduced. Automatic replacement retaining name/role but
receiving a new ID remains an owner assumption; manual replacement cannot verify it.

## Repository naming

The X4 implementation is called:

X4LifeSigns

The broader concept is called:

Life Signs

This naming leaves open the possibility of creating Life Signs implementations for other games in the future.

## Repository

The authoritative repository is [X4LifeSigns](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns).

## Local development folder

Choose a local repository folder, for example `C:\Projects\X4LifeSigns`. This is a generic example rather than a required path. Keep actual machine-specific paths in the ignored `SETUP.local.md` file; see [SETUP.md](SETUP.md#private-local-setup-notes).

The repository should not be stored inside OneDrive or another synchronised folder.

## Intended technology stack

These are the wider design choices. Only the contained MD docking probe and
Node.js log reader have been implemented and verified in live X4 for this
experiment, based on owner-reported results.
Optional SQLite docking storage is implemented and verified through
owner-reported live docking and Node.js restart/readback checks. No wider memory or AI/voice system is implemented.
The project currently intends to use:

- X4 Mission Director
- X4 Lua
- Node.js
- SQLite
- Ollama
- local LLM
- faster-whisper
- Kokoro
- ChatGPT for selected richer interactions

## Proposed first milestone

**Remember one real event** is the proposed first implementation milestone. Prove one real X4 event can reach a minimal Node.js service, be stored in SQLite and produce a text response grounded in that record. Verify that the record can be read after a service restart and remains associated with the same entity.

The docking hook has now been inspected in installed X4 9.00 files. The first
experiment above isolates capture and a console acknowledgement before any
persistence work. The experimental live docking path has passed the reported
checks; production transport and permanent identities remain unverified. The wider milestone does not require language models or voice.

Acceptance criteria belong in [TESTING.md](TESTING.md). Record the eventual integration choices and their supporting evidence here when implementation establishes them.

## Separation from live game files

The development repository and the deployed X4 extension must remain separate.

Do not directly develop inside the live X4 extensions folder.

A deployment or copy process should eventually move the required files into the X4 test location.

## Local AI strategy

Routine, high-volume interactions should preferably use a local LLM.

More complex or important interactions may use ChatGPT.

This is intended to balance quality, performance, cost and availability.

## Voice strategy

Player speech input should initially use faster-whisper.

NPC speech output should initially use Kokoro.

Piper may be retained as a lightweight fallback text-to-speech engine.

Voice generation should be asynchronous and must not block game logic.

If speech generation fails, the underlying game event and text response should still complete where practical.

## Resource strategy

X4: Foundations, the local LLM and local voice processing may all compete for GPU resources.

The system should favour responsiveness over using the largest possible AI models.

The RTX 5080 16 GB development target should retain enough VRAM headroom for X4.

## Database philosophy

Persistent IDs and stored data should be treated carefully.

Schema changes should be deliberate and migration aware.

## Development philosophy

Prefer small, understandable and reversible changes.

Avoid unnecessary rewrites.

Tests, logs and actual runtime behaviour take priority over assumptions that code looks correct.

## 2026-10-11: bounded local development adviser (historical evaluation)

The operating method and trial limits from this evaluation are superseded by
the standing owner decision of 2026-10-16 below. Its access, privacy and integrity
boundaries remain in force.

The initial evaluation used the installed local Qwen model for approved
development discovery, research and review through an ignored manifest-limited helper. The local prototype passed
access/sync tests and repository/source smoke tests; it remains under evaluation.
Codex verifies consequential findings and owns Git operations; Agent interprets
evidence and makes authorised project decisions. The model receives no shell,
Git, credential, write or deployment capability. Keep raw evidence and X4 extracts
local and publish only reviewed summaries. This selects no gameplay model and
changes no runtime milestone. See [LOCAL_LLM_DEVELOPMENT.md](docs/LOCAL_LLM_DEVELOPMENT.md).

## 2026-10-11: Qwen3.8 27B is development research only

The owner excludes the installed qwen3.8:27b-q4_K_M from gameplay runtime
candidacy, live gameplay testing, NPC dialogue during X4, production Node/Qwen
integration and GPU sharing with X4 during normal gameplay. The practical
resource concern is the 16 GB RTX 5080 development target; no concurrent
X4/model benchmark is claimed. Runtime model selection remains separate and
unmade, requiring suitable latency, VRAM use and coexistence with X4 and voice.

Agent designs and manages the work; Qwen researches approved sources; Codex
verifies consequential claims and implements authorised work; the owner retains
final authority. The operating method is superseded by the standing owner decision
of 2026-10-16 below. At this earlier stage, the owner approved a bounded
existing-source inventory and acquisition plan with documentation amendments.
Broader corpus acquisitions and access expansion required separate approval.
The four-file source grant was the scope of that historical decision; current
authorised corpus access is determined by the applicable task manifests. See the
[research workflow and corpus boundaries](docs/LOCAL_LLM_DEVELOPMENT.md).


## 2026-10-16: standing Qwen development research workflow

The owner adopts the successful one-question method as the default operating
rule for future Life Signs/X4LifeSigns development. This supersedes earlier
Qwen participation and research-packet requirements, including fixed packet
lengths, finding/citation quotas and experimental depth limits as standing rules.
Historical trials and their results remain evidence, not current instructions.

Qwen is the **broad development researcher**. Codex is the **targeted verifier and implementer**.

The normal workflow is:

**Codex asks one concrete technical question → Qwen independently searches and reads the authorised X4 documentation/source corpus as deeply as it believes necessary → Qwen returns its best plain-English answer with exact supporting source references and any genuine uncertainty → Codex verifies the consequential claims against those cited sources → Codex uses the verified result to design or implement the code.**

Qwen is used so Codex does not spend its paid context doing broad documentation
discovery. Qwen chooses authorised files to search and read, follows references
and investigates to the depth the question requires. Codex may decompose an
already authorised engineering objective into focused questions and small
follow-ups without owner approval for each question or individual search/read.

After an answer, Codex:

1. identifies claims that materially affect implementation;
2. inspects the exact cited source locations;
3. checks narrow dependencies necessary to interpret them correctly;
4. distinguishes verified fact, Qwen inference and remaining uncertainty;
5. proceeds with authorised design/implementation using verified results, or asks
   Qwen the next focused question if a material gap or contradiction remains.

Codex does not normally duplicate Qwen's broad research or reproduce its entire
research trail. Missing facts normally become focused follow-up questions for
Qwen, rather than Codex taking over broad discovery.

Uncertainty and unresolved gaps are research findings, not failures. Reaching an
existing operational guard means the question is incomplete; it does not show
the sought fact is absent. The eight-turn limit used in the reported trials is
historical trial configuration, not a standing research-depth rule.

Answers are plain English with exact source references. There is no mandatory
evidence-packet grammar, row format, answer length or citation-count quota.
Do not add artificial depth limits, per-read approval requirements or additional
stopping criteria as conditions of this method. Existing corpus authorisation,
provenance, privacy, source-integrity and destructive-action boundaries remain
in force; this decision changes the operating method, not those boundaries.

This is the standing owner-approved workflow for Life Signs/X4LifeSigns unless
the owner explicitly changes it. Agent owns design/project decisions and evidence
interpretation; Qwen researches; Codex verifies and implements; owner is final
authority. Qwen remains development-research-only, with runtime model selection
a separate future decision.

See [LOCAL_LLM_DEVELOPMENT.md](docs/LOCAL_LLM_DEVELOPMENT.md#standing-owner-approved-research-workflow)
and [the demonstrated method](docs/QWEN_ONE_QUESTION_RESEARCH_METHOD_2026-10-16.md).
