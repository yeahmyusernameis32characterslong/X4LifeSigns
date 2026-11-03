# Player2 research archive — PR #30 closed without merge

## Owner decision, 3 November 2026

The owner directed that Player2 work cease because of latency and client/service
instability observed while credits remained available. There is **no current
plan to use Player2**. This supersedes prior implementation, troubleshooting,
benchmark and integration next steps. Resumption requires a new owner instruction.

PR #30 is closed without merging. Its branch `feat/player2-npc-integration` is
retained to preserve the implementation, tests and research. No production
installation or database is changed by this closure. No new Player2 requests,
benchmarks or implementation work are part of the closure.

## Preserved findings

- [Integration results](PLAYER2_NPC_INTEGRATION_RESULTS.md): external dialogue,
  scoped SQLite evidence, rollback isolation, STT/TTS trials, model accuracy
  limitations and incomplete research attempts.
- [Streaming results](PLAYER2_STREAMING_LATENCY_RESULTS.md): real incremental
  text, guarded sentence queue, 75 passing tests, latency measurements and speech
  timeouts despite available credits, including after an app restart.
- `player2/`: optional adapter, external harness, probes and tests, never deployed
  to live X4. Experimental early speech and audio performance acceptance remain
  unverified; closure does not convert those gaps into successful findings.
- Latest experimental implementation/results before closure:
  `e66cdb0cb0ede17bee711bd94da972479d6eceb6`.

Original documentation and failed trials remain historical evidence. Private
configuration, credentials, owner data and local research artefacts remain
outside Git. Existing private handoff reports are retained with a closure status.
PR #29 is a separate workstream and is not closed or merged by this decision.
