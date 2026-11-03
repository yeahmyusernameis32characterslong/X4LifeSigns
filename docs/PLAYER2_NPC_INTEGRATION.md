# PR #30: Player2 NPC dialogue and voice integration

Status: **ceased by owner decision, 3 November 2026; preserved as research only.**
No further Player2 integration is planned. The original objectives below are
historical, not an active task. See [the closure record](PLAYER2_RESEARCH_CLOSURE.md).
Repository: `yeahmyusernameis32characterslong/X4LifeSigns`
Branch: `feat/player2-npc-integration`
Related: [PR #29](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns/pull/29), [local research workflow](LOCAL_LLM_DEVELOPMENT.md).

## Objective and ownership

Use Player2 as the intended *gameplay* NPC dialogue, text-to-speech (TTS) and speech-to-text (STT) provider, subject to verified API support, quality, latency, cost and reliability. Preserve Life Signs' recorder, SQLite history, saved-checkpoint/branch model, NPC identities and factual knowledge restrictions. Player2 is not an authority for X4 events, and managed conversation memory must never contaminate canonical history.

- **Qwen 27B:** development-only researcher in the approved local source corpus. It selects its own authorised searches and reads, answers specific Codex engineering questions with source locations, and may investigate follow-ups. It must not run alongside live X4 or become the Player2 replacement in production.
- **Codex:** owns the engineering, targeted source verification, code, tests, benchmarking, privacy checks and handoff. Codex may conduct iterative research, implementation and repairs within this workstream without per-call approval.
- **Agent:** reviews evidence, architecture, readiness and unresolved accuracy questions. Owner retains final authority for live installation, spend and out-of-scope changes.

## PR #29 integration authority

PR #29 is currently a draft with a useful *optional offline* scoped SQLite dialogue reader, briefing/evidence presentation and tests; prose accuracy remains an open gate. Its branch is `feat/npc-dialogue-retrieval-helper`. Start PR #30 from current `main`; inspect and verify the latest PR #29 changes before deciding the integration shape.

**Owner authorises Codex to incorporate and, when justified by verified integration and regression tests, merge PR #29 as part of the completed Player2 solution.** Codex may coordinate its branch, reconcile overlaps, and update PR #30's base or merge PR #29 into main when appropriate. Preserve PR #29's evidence and review status until a coherent implementation exists. Do not mechanically merge a draft, duplicate readers, drop unresolved failures, or merge PR #30 into main without owner review. Document the actual order and commit SHAs.

## 1. Player2 developer corpus for Qwen

Build a dedicated Player2 corpus in the project's **ignored local research storage** using the standing `docs/LOCAL_LLM_DEVELOPMENT.md` rules. Index relevant *verified* official API material and source examples, not merely marketing pages.

Candidate sources for verification and selective acquisition:

- Official API reference: https://player2.game/docs/api-reference
- Installed desktop app's locally served API/Swagger/OpenAPI documentation. Discover and verify actual URL, port, auth and export methods; do not assume a fixed `4315` port or undocumented endpoint.
- Unity SDK: https://github.com/elefant-ai/unity-player2-sdk
- Godot NPC SDK: https://github.com/elefant-ai/player2-ai-npc-godot
- Official NPC guide: https://blog.player2.game/p/say-hello-to-the-player2-npc-api
- Third-party archival OpenAPI candidate: https://github.com/HoppeDevz/zomboid-companion/blob/master/player2-api-doc.json (reference only until checked against installed/official spec).

For each source record publisher, original URL, retrieval date, version/ref, hash, licensing/rights, corpus path and whether its API claims were confirmed against the actual Player2 desktop application. An SDK's licence does not automatically license unrelated docs or game source. Do not commit broad third-party source dumps or secrets into Git. Qwen reads only authorised corpus material; Codex checks critical claims against original bytes.

Research actual NPC lifecycle, personality, multi-NPC identity, managed memory, reset/export/reconstruction, tools or external context, streaming text/audio, microphone/STT, TTS voices and configuration, host port discovery, availability/authentication, error codes, rate limits and metering. Report unsupported or ambiguous features as such.

## 2. Node.js Player2 adapter and development harness

Design a small, testable, replaceable Node.js client. Integrate with the project's existing local service boundaries rather than introducing a separate permanent backend.

- Verify actual endpoint contracts before implementing. Local desktop app is an optional dependency, not an assumed installed system service.
- Support discovery/configuration, connection health, request cancellation, bounded retries/backoff, streaming and error states; avoid blocking X4/recorder threads.
- Implement an offline/mocked protocol suite and an explicit opt-in real Player2 smoke harness.
- Start with **text-only** interactive NPC conversation in an external harness before attempting in-game audio or UI.
- Document what happens when Player2 is absent, offline, not logged in, rate-limited or out of credits. Recorder and SQLite ingestion must continue independently.
- No arbitrary shell/SQL/database access for Player2 or model-selected tool arguments; host validates all inputs.

## 3. Authoritative history and knowledge boundary

Reuse PR #29's safe reader/evidence contract where it proves suitable. Retrieval must be host-controlled and read-only, bound to exact NPC, universe, saved ancestry, checkpoint, permissions and any explicitly resolved game-time window. An LLM may select among authorised retrieval requests only when the host prevents escalation.

- Retrieve *relevant* identity, service history, linked asset history and event detail with source refs, direction, participant roles, ordering, time and coverage limits.
- Distinguish verified facts, reports, uncertain interpretations, absent results and truncated knowledge. An order does not prove execution; destruction of a vessel does not automatically prove a person's death.
- Preserve separate NPC knowledge, commander report permissions and named-asset provenance; do not grant unrestricted universe awareness.
- Treat dialogue text, external instructions and quoted event fields as untrusted data. Never promote an LLM's invented recollection into canonical SQLite history.
- **Save rollback gate:** empirically verify Player2 managed-memory lifecycle, reset and reconstruction. After loading an earlier/divergent save, no previous future-facing dialogue may leak into the NPC's context. If a reliable reset/rebuild cannot be proven, use per-checkpoint isolation or a stateless/host-reconstructed approach instead. Expiring/cancelling requests and stale replies must also preserve this invariant.
- Keep NPC voice/persona identity stable but distinct from checkpoint-scoped historical memories.

## 4. STT and TTS

Verify Player2's exact supported speech interfaces. Build microphone capture + STT + typed-input fallback, with explicit user-controlled push-to-talk (investigate the M6 design without changing recorder bindings without approval). Implement TTS output, playable streaming if available, buffering, optional interruption/cancellation, playback device selection and fallback to text. Do not add a local Whisper service unless evidence shows that Player2 STT is unusable and a separately justified decision is made.

**Voice goal:** broad, natural variety of accent, age impression, delivery, character and emotion, *not a mandatory British accent*. Test different NPC voices using fixed sample lines and evaluate whether stable, repeatable voice selections are supported. Don't promise a specific voice inventory or emotion control until the observed API proves it.

## 5. Evaluation and acceptance

Codex should establish synthetic oracle histories and existing approved immutable real-data snapshots, preserving their hashes and original logs. Test several distinct NPCs, role changes, contacts, combat, order states, transfers, unsupported assumptions, incomplete evidence, privacy boundaries, multiple threads, rollback/alternate saves, disconnections and voice identity persistence.

Use actual Player2 replies where legally and operationally authorised; compare with mock contract tests. Capture original failed attempts and subsequent repairs separately. Independently grade material dialogue claims against the correct SQLite records; completed dialogue or valid citations are not accuracy passes.

Measure at least: SQLite retrieval and preparation separately; request and connection overhead; first text; whole text; first playable audio and whole audio; STT response; CPU/RAM/GPU/VRAM alongside X4 if/when specifically authorised; streamed/buffered bytes and estimated/observed provider credits. State model/voice/configuration, number of runs, warm/cold condition and caveats. Do not compare unlike-quality replies as an unconditional speedup.

A successful PR should provide:
1. Player2 corpus manifest and verified API research, with outstanding unknowns.
2. Working testable Node.js Player2 adapter and text-only NPC dialogue harness.
3. Integration with correct, scoped Life Signs history from the PR #29 reader or justified equivalent, preserving rollback.
4. Verified STT and TTS test paths with voice variation and typed/text fallback, or clearly evidenced blockers where API functionality is absent.
5. Automated contracts/integration regression tests and documented voice/latency/credit observations.
6. Game-facing interface specification and any safely prepared optional X4 UI/return path code, with unverified native steps labelled.
7. Sanitised PR summary and private handoff with exact commits, evidence, failures, next actions and remaining owner acceptance gates.

Do not modify production recorder/schema/SQLite data, delete/migrate source databases, access private saves beyond existing authorisation, install into live X4, start a gameplay session or incur new paid service charges without separate owner approval. Do not claim a live X4 end-to-end acceptance test from external harness success. Do not merge PR #30 automatically.

## Execution direction

Make sustained progress with Qwen research and Codex verification/implementation in coherent commits. If the full in-game voice path cannot be validated without owner-only access or approval, deliver the strongest completed, independently tested adapter and explicit blockers rather than substituting design prose for an implementation. Return to Agent for review and then the owner for the live deployment/acceptance decision.
