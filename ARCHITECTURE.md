# X4LifeSigns Architecture

## Design status

This document describes the proposed system. No game integration, Node.js service, database or AI/voice integration has been implemented in this repository.

The following boundaries remain unproven:

- capturing a suitable real X4 event through MD or Lua
- communicating between X4 and the external service
- obtaining and preserving entity identity across the required lifetime
- returning responses to X4

No transport, message format or supported game hook has been selected and verified. The flows below describe intent, not working connections. Record exact interfaces and version-specific evidence when implementation establishes them.

## Purpose

X4LifeSigns is a mod and supporting local software system for X4: Foundations.

Its purpose is to make the game world feel more alive by allowing NPCs, ships, stations and other entities to maintain persistent relationships, memories and reactions to events.

## Main components

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

No schema exists yet. Requirements and eventual schema details belong in DATABASE.md.

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
