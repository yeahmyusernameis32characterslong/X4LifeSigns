# X4LifeSigns Architecture

## Design status

This document describes the proposed wider system. A contained MD docking probe
and Node.js debug-log reader have automated checks and owner-reported live X4
verification. Optional docking SQLite persistence has automated checks and owner-reported
live verification across Node.js restarts while X4 stayed running. No AI/voice integration is implemented.

The following boundaries remain unproven:

- capturing game events beyond the tested personally controlled docking probe
- communicating through a production transport beyond the experimental log reader
- obtaining and preserving entity identity across the required lifetime
- returning responses to X4

The installed X4 9.00 docking hook and an experimental marked debug-log format
are documented below. The experimental docking-to-console path has been verified
in live X4; production transport remains unverified.
The wider flows describe intent, not working connections.

## Purpose

X4LifeSigns is a mod and supporting local software system for X4: Foundations.

Its purpose is to make the game world feel more alive by allowing NPCs, ships, stations and other entities to maintain persistent relationships, memories and reactions to events.

## First implementation experiment

The contained docking experiment follows completed personally controlled ship
docking -> Mission Director -> marked debug log -> read-only Node.js reader ->
console acknowledgement. It uses no Lua or return path. Status: **Experimental docking bridge verified in live X4.** This is experimental observation, not the
production transport or a persistent identity design. See
[BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md) for evidence and limitations.

## Main components

### Controlled-session persistence experiment

Optional `--db` mode commits each parsed docking into file-backed SQLite,
selects it back and prints the stored fields. A separate read-only command
retrieves rows without X4 or its log. Reuse one manually selected database
across Node restarts while X4 stays running; choose a fresh file for another
save/universe or a game reload. No permanent identity or production delivery
guarantee is established. See
[PERSISTENCE_EXPERIMENT.md](docs/PERSISTENCE_EXPERIMENT.md).

### Automatic session routing

Status: **Verified live in X4 9.00 with Node.js v24.21.0** under the approved
practical local single-player `s1` assumption. Production state in the normal
probe is independent of both optional diagnostic scripts. A root game-loaded
listener invalidates restored readiness; universe generation samples the approved
clock plus four unseeded draws exactly once and publishes the production `s1`
key. Game start and docking do not assign a key. Existing saved cue names and
the controlled-group readiness gate remain in place.

V1 docking output is preserved. A ready eligible docking also emits V2 carrying
the current session key; missing readiness emits a separate
`LIFESIGNS_SESSION_ROUTING_V1` diagnostic instead of V2.
Console/manual modes consume V1 only. Opt-in `--auto-db` consumes V2 only,
validates the entire record, then lazily routes to source-relative repository
`local-data/sessions/<session-key>.db`. It holds at most one automatic store,
switching on a different key. Schema-v2 ownership is checked read-only before
writable opening and rechecked transactionally. Independent readback supports
both schema versions. See [DATABASE.md](DATABASE.md).

The complete key is a practical local single-player assumption with accepted,
unquantified residual collision risk, not guaranteed uniqueness. Reusing an
identical complete key across actual X4 sessions cannot be detected by ownership
and can mix histories. There is no fallback, migration, retry, deduplication,
durable checkpoint, permanent entity identity or exactly-once claim.
The [owner-run production acceptance matrix](docs/AUTOMATIC_SESSION_ROUTING.md#live-verification-record)
passed with both optional diagnostics removed, including live callback ordering
and complete canonical clock/key rendering. Static validation remains separate
from this live evidence.

### X4 MD and Lua

Mission Director and Lua code are intended to provide the connection to X4: Foundations.

Their responsibilities may include:

- detecting game events
- identifying NPCs, ships and stations
- obtaining internal X4 IDs
- sending relevant information to the local Life Signs server
- receiving responses or instructions
- presenting dialogue or behaviour inside the game
- requesting or triggering voice playback where required

Game-side code should remain as lightweight as practical.

### Node.js server

Node.js is intended to provide the main local application layer and act as the central orchestrator.

Responsibilities may include:

- receiving events from X4
- deciding which events are important
- managing persistent state
- querying SQLite
- communicating with the local LLM
- communicating with ChatGPT where appropriate
- sending text to the speech synthesis layer
- receiving transcribed microphone input from the speech recognition layer
- queueing generated speech
- returning responses to X4
- coordinating asynchronous tasks without blocking game logic

### SQLite

SQLite is intended to store persistent Life Signs data.

Possible stored information includes:

- NPC identity
- ship identity
- station identity
- encounters
- relationships
- memories
- important events
- conversation history
- reputation or sentiment data

The controlled docking experiment implements a version-1 `docking_events` schema.
Automatic routing adds schema-v2 session ownership without changing that table
or migrating v1 files. Wider memory schemas remain planned. See [DATABASE.md](DATABASE.md) for the
implemented schema, requirements and experimental limitations.

### Local LLM

A local language model will handle high-volume or routine natural language tasks.

The intended runtime is Ollama.

LM Studio may also be used for testing and comparing models.

The local model should be chosen with consideration for the fact that X4: Foundations will be running on the same GPU.

The development target PC contains an NVIDIA RTX 5080 with 16 GB VRAM.

The local model should therefore leave sufficient VRAM and GPU capacity for X4 and local voice processing.

### Speech to text

Local speech recognition will use faster-whisper.

Its purpose is to convert microphone input into text so that the player can speak naturally to Life Signs characters.

Expected flow:

Microphone

→ faster-whisper

→ Node.js

→ local LLM or ChatGPT

Speech recognition should run locally where practical.

### Text to speech

Local speech synthesis will initially use Kokoro.

Its purpose is to turn generated NPC dialogue into spoken audio.

Kokoro is preferred initially because it offers a good balance between voice quality, speed and resource use.

Piper may be retained as a lightweight fallback if Kokoro proves unsuitable.

Expected flow:

Generated dialogue

→ Kokoro

→ audio file or audio stream

→ X4 playback

### Voice processing principle

Voice generation must not block game logic.

Node.js should treat speech synthesis as an asynchronous task.

Dialogue can be queued for speech generation and played when ready.

Failure of the voice system should not prevent the underlying game event or text response from completing.

### ChatGPT

ChatGPT may be used for richer characters and more complex interactions where higher-quality reasoning or personality is worthwhile.

The character Aria is currently intended to be the main example of this richer interaction.

ChatGPT should not be used for every minor NPC interaction because latency, cost and dependency on internet access would make that unsuitable.

## Data flow

A likely high-level flow for normal NPC activity is:

X4 event

→ MD or Lua

→ Node.js server

→ SQLite lookup

→ optional local LLM or ChatGPT processing

→ Node.js response

→ optional Kokoro speech generation

→ MD or Lua

→ X4

A likely high-level flow for player voice input is:

Player microphone

→ faster-whisper

→ Node.js

→ SQLite context

→ local LLM or ChatGPT

→ Kokoro

→ X4 voice playback

This architecture may evolve as development progresses.

Major architectural decisions should be recorded in DECISIONS.md.
