# X4LifeSigns testing

## Current status

The docking experiment has an automated test suite, with 19 local tests passing.
**Implemented, live X4 verification pending.** Wider persistence, AI and voice
criteria below describe future verification, not completed results.

## Docking bridge experiment

Run `npm.cmd --prefix bridge test` from the repository. The tests use synthetic
temporary logs and a mock installation; they do not start X4 or edit its real
log or save. The MD XML also requires validation against the installed X4 9.00
schema. Follow [BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md) for the live test:
personally pilot, complete docking, undock and dock again, and check that other
ships do not trigger the probe. Status: **Implemented, live X4 verification
pending.**

## Proposed first milestone: Remember one real event

Use one real X4 event involving one identifiable entity. The current contained
docking experiment tests the capture-to-console boundary first, using an
installed-schema/shipped-code hook. The live path, persistence and permanent
identity still require verification.

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
[BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md); persistence checks will be
added with that implementation.

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
