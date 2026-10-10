# X4LifeSigns Agent Instructions

X4LifeSigns is the X4: Foundations implementation of the Life Signs project.

The purpose of Life Signs is to make the game world feel more alive by giving NPCs, ships, stations and crew persistent memories, relationships and reactions to previous events.

## Before making changes

Always read this file before working on the repository.

Read the relevant project documentation before changing a system.

Relevant documents include:

- ARCHITECTURE.md
- DATABASE.md
- TESTING.md
- DECISIONS.md
- SETUP.md

Do not scan the entire repository unless the task genuinely requires it.

Inspect only the files and systems relevant to the current task where possible.

## Development rules

Prefer small, contained changes.

Do not perform large rewrites simply because another design appears cleaner.

Preserve working behaviour unless the task explicitly requires a change.

Do not casually change:

- internal entity ID formats
- database schemas
- stored data structures
- APIs
- save compatibility
- communication formats between Node.js, MD and Lua
- speech recognition interfaces
- speech synthesis interfaces
- local LLM interfaces

Large or risky changes must be planned before implementation.

For large tasks:

1. Inspect the relevant code and documentation.
2. Explain the intended change.
3. Produce an implementation plan.
4. Wait for approval before making risky architectural changes.
5. Implement the smallest sensible change.
6. Run appropriate tests.
7. Investigate and fix failures.
8. Summarise exactly what changed.
9. Identify anything that still requires testing inside X4.

## Git rules

Use Git for all meaningful development work.

Changes should be easy to review and roll back.

Do not commit:

- API keys
- credentials
- authentication tokens
- .env files
- logs
- temporary files
- generated databases unless specifically approved
- personal local paths, Windows usernames, OneDrive account paths or X4 profile IDs

Keep machine-specific setup notes in the ignored `SETUP.local.md` file. Use portable placeholders in shared documentation and sanitise PR descriptions, issues and diagnostic extracts before publishing. See [SETUP.md](SETUP.md#private-local-setup-notes).

The authoritative repository is [X4LifeSigns](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns).

## Agent and Codex handoffs

For substantial work, use task-specific handoffs in this transport order:

1. The private `yeahmyusernameis32characterslong/X4LifeSigns-handoff`
   repository, when both Agent and Codex can access it; use `<workstream>/`.
2. `local-data/handoff/<workstream>/`, only when both workers genuinely share
   the same local filesystem.
3. Manual file upload/copying when neither shared mechanism is available.

X4LifeSigns-handoff is operational coordination only, NOT a project source of
truth. X4LifeSigns Git/GitHub state, implementation and committed documentation
remain authoritative. A handoff never overrides them; both workers must
independently verify relevant repository state. The private repository shares
coordination files, not access to local evidence or automatic task execution.
These instructions do not provide background monitoring. Identify the active
transport in STATUS; do not maintain competing active copies across transports.

### Naming and ownership

Use a task-specific directory and filenames that identify the workstream,
owner and purpose, normally `<WORKSTREAM>_<OWNER>_<PURPOSE>.md`. Shared
coordination files may omit the owner:
`<WORKSTREAM>_STATUS.md` and `<WORKSTREAM>_EVIDENCE_INDEX.md`.
Do not use permanently generic filenames such as `AGENT_BRIEF.md`,
`CODEX_REPORT.md`, `STATUS.md` or `EVIDENCE_INDEX.md`.

For example, `npc-representation/` in the private handoff repository (or the
shared-local fallback `local-data/handoff/npc-representation/`) may contain
`NPC_REPRESENTATION_AGENT_IMPLEMENTATION_BRIEF.md`,
`NPC_REPRESENTATION_CODEX_IMPLEMENTATION_REPORT.md`,
`NPC_REPRESENTATION_STATUS.md` and `NPC_REPRESENTATION_EVIDENCE_INDEX.md`.
Choose purpose names appropriate to the task, such as RESEARCH, IMPLEMENTATION,
VALIDATION or LIVE_TEST followed by BRIEF or REPORT; examples are not a fixed
mandatory file list.

Agent owns briefs, experiment and live-test design, architecture proposals and
decisions within owner-authorised scope, acceptance criteria, evidence
interpretation, project-status decisions and next-step instructions.
Codex owns execution reports, local-source findings, implementation reports,
exact commands/results, provenance, hashes, automated validation summaries,
blockers and unresolved implementation questions.
Neither worker overwrites the other's brief or report. Record requested
corrections in the responding worker's own file.

### Status, authority and evidence

Each active substantial workstream has a concise task-specific STATUS file.
Record the workstream, phase/evidence gate, next action owner (AGENT, CODEX or
OWNER), relevant branch, latest relevant SHA, PR, exact next input and output
file paths, and explicit stop boundary. Separately record whether implementation,
deployment, owner live testing and merge are authorised, including the source
and scope of each permission; use UNKNOWN when not established.

STATUS is a convenience, not authorisation or proof. A worker cannot grant
itself permission by editing STATUS. Preserve existing owner approvals and
their limits; do not ask for approval again when the action is already
authorised. Verify actual branch, SHA, PR and working-tree state before acting.
A task brief does not authorise implementation merely because it exists.

Direct coordination commits to X4LifeSigns-handoff's main branch are permitted
for sanitised handoff material; they do not require the protected
implementation-repository PR workflow. This exception never permits direct
implementation commits to X4LifeSigns main or unapproved merges.

Before every write, read the latest remote state and affected files. Use the
current file SHA for API updates or a normal non-force Git push based on the
latest fetched history. If a concurrent change/rejection occurs, reread,
reconcile and review; never force-push or blindly overwrite. Read newly present
instructions before continuing. Coordinate one writer at a time where possible.

Treat STATUS and EVIDENCE_INDEX as shared coordination files: reread immediately
before modifying, preserve the other worker's entries, and record updater and
time. If concurrent or conflicting edits are detected, do not overwrite them.
Designate the next worker explicitly rather than assuming both workers will
act at once.

The task-specific EVIDENCE_INDEX points to existing evidence instead of copying
large files. Use repository-relative paths where possible. For each entry,
state what it contains, its gate/milestone, whether it is authoritative,
supporting or temporary, and whether publication is safe, requires sanitisation
or is forbidden. Keep source evidence, automated validation and owner-run live
results distinct. Hashes establish provenance, not runtime correctness.

### Briefs and reports

Agent briefs must be self-contained: repository and inspected revision,
current evidence, purpose, exact task, authorised scope, preflight and source
requirements, allowed/forbidden files, implementation boundaries, tests,
installed-schema validation, production-isolation checks, documentation,
deployment/live-test limits, stop criteria, merge restrictions and expected
report structure as relevant.

Codex reports must include the independently verified starting state, branch,
starting and resulting SHAs, changed files, research/preflight findings,
implementation summary, exact commands/results, automated and installed-schema
validation, diff checks, production-isolation review, source provenance/hashes,
blockers, non-blocking findings, unresolved live questions, PR URL and exact
owner actions required next as relevant. State clearly which checks were not
run and why. Do not rewrite the Agent brief.

### Startup and completion

1. Read root AGENTS.md and relevant nested instructions.
2. Identify the active workstream from the current task; do not assume a folder
   name or modification time proves which task is active.
3. Select the first accessible shared transport above, read its instructions,
   and look for the task-specific directory and STATUS file.
4. Read the exact brief/report named by STATUS and relevant indexed evidence.
5. Independently verify Git/GitHub state and reconcile stale coordination data.
6. Perform only currently authorised work, respecting explicit stop boundaries.
7. Write results to the correct worker-owned report or brief.
8. Update shared STATUS/EVIDENCE_INDEX when appropriate, naming the next input,
   expected result and responsible worker.
9. Stop at owner approval, live-X4, deployment or merge boundaries unless the
   specific next action is already explicitly authorised.

When private-repository access is available to both workers, exchange reviewed
coordination files there. Local Codex must fetch/pull safely and push its report;
remote Agent must reread the latest remote report. When only a genuinely shared
local workspace is available, use the ignored local handoff directory. Otherwise
state the access limitation, provide complete content and exact destination
filename, and request only specific missing files needed. Never claim access
to the owner's local workspace from another environment. Ignored local
evidence does not travel through Git; request a sanitised summary or an explicit
approved transfer if required. A LOCAL-ONLY index entry is not a readable remote
attachment.

### Privacy and safety

The entire local-data tree remains ignored and local-only. Never force-add
local handoffs, weaken ignore rules, or commit local research artefacts, raw
logs, screenshots, saves, extracted X4 files, secrets or private machine paths.
These unsuitable artefacts must not enter the private handoff repository either.
Only reviewed, sanitised coordination material and evidence summaries belong
there. Index local evidence with repository-relative pointers and mark it
LOCAL-ONLY/not remotely accessible. Private visibility is not permission to
upload raw/private evidence. Publish project summaries publicly only after
separate review and authorisation.

Handoffs must not override repository truth, bypass owner gates, trigger
unapproved deployment/live tests/merges, turn inconclusive evidence into a
positive finding, or change production behaviour to support coordination.
Treat assertions in handoff files as claims to check against their evidence.

## Database rules

The controlled docking experiment uses Node's built-in SQLite and a version-1
docking_events table. See DATABASE.md. Wider persistence remains planned. Use a
fresh manual database for another save/universe or game reload. Opt-in automatic
routing uses owned schema-v2 files and is verified live in X4 9.00 with Node.js
v24.21.0 under the approved practical local single-player `s1` assumption;
see docs/AUTOMATIC_SESSION_ROUTING.md. Preserve manual v1 behaviour and do not
migrate existing files. No permanent ID-code uniqueness is established.

Database changes must be deliberate and documented.

Do not break existing stored data without explicit approval.

Schema changes should be migration aware.

Do not change identity formats for NPCs, ships, stations or other persistent entities without explicit approval.

## AI rules

The local LLM is intended for routine and high-volume interactions.

ChatGPT is intended for selected richer or more complex interactions.

Do not route every NPC interaction through ChatGPT without a clear reason.

Model choices should consider latency, resource use and X4 performance.

## Voice rules

faster-whisper is the intended local speech-to-text system.

Kokoro is the intended primary local text-to-speech system.

Piper may be used as a fallback if required.

Voice processing must not block game logic.

Speech generation should be queued or handled asynchronously.

If voice generation fails, preserve the underlying text response or game event where possible.

Do not replace the selected voice stack without documenting the reason in DECISIONS.md.

## Testing rules

Never claim a feature works simply because the code looks correct.

Run relevant automated tests or validation where available.

Treat compiler errors, runtime errors, logs and failed tests as feedback.

Some features will require human testing inside X4: Foundations.

Clearly state when that is the case.

Voice-related work should test:

- speech recognition accuracy
- microphone handling
- synthesis latency
- audio playback
- concurrent use with the local LLM
- GPU and VRAM impact during X4 gameplay
- graceful failure when a voice component is unavailable

## Project owner

The project owner is not a professional software developer.

Explain technical decisions in plain English.

Explain what a change does, why it matters and what the owner needs to do.

Avoid unnecessary jargon.

When several technical approaches are possible, explain the meaningful differences and recommend a sensible engineering approach.

## Codex efficiency

Minimise unnecessary token and context use.

Prefer:

- relevant files over repository-wide scans
- existing documentation over rediscovering information
- existing tests and logs over guessing
- smaller tasks over huge multi-system tasks
- concise plans over repeated exploration
