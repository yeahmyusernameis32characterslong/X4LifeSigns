# Codex handoff: establish real Player2 text/audio streaming latency

**Historical handoff — superseded by the owner's 3 November 2026 decision to
cease Player2 work.** Do not execute the remaining tasks. Retained for research
provenance; see [the closure record](PLAYER2_RESEARCH_CLOSURE.md).

Status: **owner-authorised next focused workstream**, 2 November 2026.
Target: draft [PR #30](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns/pull/30), branch `feat/player2-npc-integration`, starting from its current head.
Previous results: [Player2 integration results](PLAYER2_NPC_INTEGRATION_RESULTS.md).
Ownership: **Codex implements/tests, then returns the evidence to Agent for review**. Qwen 27B can research locally as a development assistant; it is not a runtime model.

## Question and objective

**Does Player2 deliver text/audio incrementally as generated, or buffer it until near completion?** Determine what happens at the provider, local Player2 app, HTTP stream and Life Signs host layers. Identify the *first actually usable*, chronologically defensible NPC text and first *decodable/playable* audio, not merely the first arbitrary bytes of JSON, SSE or MPEG. Compare practical time-to-first-speech against existing complete-buffer TTS. The aim is a natural, interruption-safe Life Signs conversation, **not** a synthetic speed claim.

## Existing evidence and boundaries

- `player2/client.mjs` already requests `stream: true`, recognises SSE frames and records `firstTextMs`; an alternate JSON response can be delivered all at once.
- `player2/dialogue-host.mjs` forwards unverified fragments via `onDraft`, but its schema-envelope `JSON.parse` and reference validation happen after complete output. The current external harness does not progressively speak those drafts.
- Published real tests reported 1.1–4.0s for some `gemini3-flash` completed text cases, 5.5–18.4s for five `gpt-oss-120b` cases, 25.5–54.2s for buffered `/v1/tts/speak`, and a nominal audio stream with first bytes only at about the 24.245s end. Those numbers were not paired, controlled streaming comparisons.
- The installed Player2 API did **not** document a reliable per-request `model` selector: the owner chose `gpt-oss-120b` in the app and the response identified its model. Never silently label runs by a model that was not actually returned.
- Historic facts must stay sourced and save-aware; wrong chronology was observed even with valid evidence references. Do not treat an early draft or an asserted citation as verified speech.

## Codex work package

### 1. Instrument the actual path

Add an opt-in **external** measurement harness and automated tests (no live X4 installation). For every real request, record monotonic, per-run offsets from dispatch to:

1. HTTP response headers and first raw response byte.
2. First complete SSE/NDJSON frame or complete JSON, first genuine model content token/text fragment, the number/size/cadence of later fragments, and the last fragment.
3. First completed sentence in the model's *natural-language answer* (distinguish from a JSON prefix, escaping, citation metadata or incomplete quote), full answer received, fully parsed structured reply, evidence-reference validation, and acceptance/rejection.
4. For TTS: first response byte, first independently decodable playable audio frame/chunk, ready-to-play WAV, and full audio; record codec/container and actual decoding outcome, not an `application/octet-stream` assumption.
5. End-to-end response and audio times plus cancellations, reconnections, output lengths, response model IDs, observed Joule-balance deltas where the API exposes them.

Use elapsed times, not wall-clock subtraction; save raw timing logs **without NPC names, owner save history, credentials, full prompts, or private audio**. Ensure instrumentation doesn't turn streaming into buffering by itself.

### 2. Controlled comparisons

- Compare streaming and non-streaming text requests using the **same authorised, frozen NPC history, question, response budget and JSON structure**, with repeated runs and clearly stated run counts. Distinguish `stream: true` and actual `Content-Type`/wire behaviour.
- Run comparisons with `gemini3-flash` and `gpt-oss-120b` only where truly selectable/observable. If changing the Player2 app selection requires the owner, clearly say so, and never claim both were benchmarked when they weren't.
- Compare short/simple responses, medium replies, and factual multi-event chronology questions. Report median/range for first byte, first text, first safe sentence, complete valid reply and the extra delay from evidence verification; preserve every failure and explicit wrong chronology.
- Test buffered `/v1/tts/speak` and the available compatible stream using a **fixed text and voice ID**. Try short versus longer utterances, enough repeated measurements to distinguish warm-up/cache from real streaming. Investigate provider-app buffering, codec, audio header visibility and caller sink. The previous nominal audio stream did not provide a useful lead; do not assume a different endpoint solves it.
- If practical, test pipelining **already validated** text into TTS in short sentences/chunks and measure first *playable* sound, total time, audible joins, voice consistency, cost and cancellation. Do not start TTS on unverified model prose merely to win a benchmark. Find a safe, clearly scoped streaming alternative or explicitly document that reliable early speech is not currently feasible.

### 3. Data integrity, cost and failures

- Preserve exact NPC grants, save ancestry, chronology, rollback/stale-response invalidation, evidence-backed dialogue and fixed voice identity. If the scope changes or the user interrupts, reject stale text **and stop queued/playing audio**. Mock both providers that honour cancellation and those that don't.
- Prevent playback of partial JSON, evidence IDs, malformed audio or unverified historical assertions. Distinguish speculative previews from approved NPC speech. Do not remove existing validated-output safeguards for latency.
- Measure Joules conservatively with the existing account, checking balances before and after where possible; report model vs STT vs TTS separately and distinguish rounded deltas from exact billing. **No purchases, subscription changes, unauthorised paid spend, or unchecked large test loops.** If credits are insufficient, stop and describe the blocker. No automatic retry of billable generation.
- Robustly test timeouts, 402/429, disconnection, delayed/late fragments, invalid JSON, broken SSE framing, missing/changed codecs, stale save-load and typed/no-audio fallback. Keep routine warnings from triggering paid work.

### 4. Outcome and go/no-go

Deliver a reproducible, bounded test harness with useful synthetic stream fixtures and a written **streaming/latency results report**, including timings, request settings, returned model and actual provider behaviour, audio decoding/playability proof, real Joule observations, factual errors, and an explicit recommendation for:

1. Existing complete-answer validation plus buffered speech.
2. Complete validated text pipelined into shorter TTS calls.
3. Genuine safe incremental text-to-speech if and only if demonstrated.
4. Remaining text-only or local TTS fallback if Player2 speech remains too slow.

A clear **negative result** (Player2 buffers until completion, JSON validation blocks early speech, or audio streaming cannot yield playable sound early) is valuable and must be reported honestly. Implement small, testable improvements only when evidence supports them; do not rearchitect the pipeline blindly or pursue unrelated features.

Run the current relevant tests plus any new regression and failure tests; retain original bad trials and observations. Amend PR #30 with commit(s), the report, reproducible commands, exact tests run/results and remaining owner-only gates. **Return ownership to Agent for review.**

## Explicit exclusions

No live X4 launch, native MD/Lua or M6 deployment, HUD/ECHO work, owner database mutation, hidden API model override, publication, PR #29/#30 merge, auto-spending, or claims that hardware audio/microphone acceptance was performed. Preserve private material outside Git and respect the existing PR #30 authorisation.
