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

The authoritative repository is [X4LifeSigns](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns).

## Database rules

SQLite is the intended store for persistent Life Signs data; no database implementation or schema exists yet.

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
