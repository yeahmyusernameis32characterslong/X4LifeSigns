## Docking bridge experiment

Run `npm.cmd --prefix bridge test` from the repository. The tests use synthetic
temporary logs and a mock installation; they do not start X4 or edit its real
log or save. The MD XML also requires validation against the installed X4 9.00
schema. Follow [BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md) for the live test:
personally pilot, complete docking, undock and dock again, and check that other
ships do not trigger the probe. Status: **Implemented, live X4 verification
pending.**

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
