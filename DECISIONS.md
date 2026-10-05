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
