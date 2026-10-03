# X4LifeSigns Design Decisions

This document records important project decisions so they are not accidentally reversed later.

## Repository naming

The X4 implementation is called:

X4LifeSigns

The broader concept is called:

Life Signs

This naming leaves open the possibility of creating Life Signs implementations for other games in the future.

## Repository

The authoritative repository is a private GitHub repository named X4LifeSigns.

## Local development folder

The main local repository path is:

C:\Projects\X4LifeSigns

The repository should not be stored inside OneDrive or another synchronised folder.

## Main technologies

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