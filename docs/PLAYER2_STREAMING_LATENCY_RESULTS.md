# Player2 streaming and latency — verified results

Codex, 2 November 2026. PR #30, starting at owner handoff
`288668a5ed4312000b01be5280099af29562a3b3`.

**Text streaming is real. Earlier safe NPC speech is not demonstrated.**
The completed text experiments and implementation are ready for Agent review.
The planned live audio comparisons are **blocked by TTS timeouts**, including
after the owner restarted Player2. No live X4 deployment, playback, gameplay,
database change or merge occurred.

## Implementation

- Opt-in `player2/streaming-bench.mjs` records monotonic dispatch, headers,
  per-byte-chunk cadence, complete SSE frames/JSON, model content fragments,
  natural answer prefix/sentence, complete answer, structured parsing, reference
  validation and acceptance/rejection. Metadata logs omit prompts, text, names,
  authentication headers and audio. It reads a frozen, explicitly granted history.
- Raw fragments remain unverified. Streaming never bypasses JSON, reference,
  saved-history or stale-result gates. The diagnostic sentence extractor handles
  JSON escaping and complete inline citations; it is not a semantic validator.
- `audio-probe.mjs` actually converts PCM16 WAV samples and feeds MPEG chunks to
  pinned development dependency `mpg123-decoder`1.0.3. Decoder output is measured,
  not a claim that a device made sound. Production code opens no audio device.
- Buffered speech now rejects incomplete WAV and unsupported PCM formats before
  returning ready audio. A RIFF signature alone is no longer sufficient.
- Optional `ScopedSpeechOutput.renderSegments` accepts an entire completed
  reply only after a trusted host's independent approval. Exact, host-supplied
  sentence segments must reproduce its spoken text. It synthesises the next
  segment while a previous one plays, with at most one waiting audio buffer.
  It does not approve claims from citation membership, or synthesise drafts.
- Load, NPC change and explicit interruption invalidate queued results and
  immediately signal/stop the caller sink even if a provider ignores abort.
  Failed sink stopping prevents new playback. No queued speech is enabled by
  default in the existing external CLI or X4.
- Batches require explicit generation/cost flags, fixed case counts, 2–3 repeats,
  available non-patron balance at least30 Joules, no more than30 requests and a
  ten-observed-Joule stop threshold per invocation. No billable retry occurs.
  Timeout, disconnect, credit/rate errors or a failed post-request balance read
  stop the batch; already obtained results are written even if balance read fails.

## Test conditions and limits

Player2 **0.10.88**, Node **v24.21.0**, Windows. Same authorised frozen synthetic
NPC branch, three questions (short role/ship, medium directed incident and
multi-event saved chronology), structured JSON schema, temperature0.2 and
2,048-token limit. Each comparison has two runs per case/mode, reversing mode
order on the second repetition. No hidden model override: the owner selected
each app model. Completed replies reported `gpt-oss-120b` or `gemini3-flash`.

The initial gpt-oss and initial Gemini batches used the original prompt and an
invocation clock beginning before retrieval. Those gpt-oss timings below
therefore include small local preparation overhead; they are not exact network
dispatch offsets. Explicit transport dispatch timing was then added. The final
Gemini batch below uses dispatch offsets and a clarified reference/chronology
instruction. Do not pool prompt versions or claim a controlled cross-model
speedup. Qwen was active during initial batches and unloaded during final ones;
X4 stayed closed. Provider cache, network and server load were uncontrolled.

## Controlled text observations

Times below are median seconds `[minimum–maximum]`, two samples per row.
First model content may be a JSON prefix, not a usable spoken answer.

### gpt-oss-120b, original prompt, invocation offsets

| Case / stream flag | First raw byte | First model content | Complete contract-accepted reply |
| --- | ---: | ---: | ---: |
| Short / true | .405 [.390–.419] | 1.970 [1.654–2.285] | 2.775 [2.229–3.322] |
| Short / false | 2.048 [2.011–2.086] | 2.050 [2.012–2.088] | 2.051 [2.013–2.090] |
| Medium / true | .365 [.326–.405] | 2.716 [2.580–2.852] | 4.750 [4.674–4.827] |
| Medium / false | 4.914 [4.765–5.063] | 4.916 [4.767–5.065] | 4.918 [4.769–5.066] |
| Chronology / true | .816 [.332–1.300] | 2.402 [1.710–3.095] | 5.140 [4.564–5.715] |
| Chronology / false | 5.694 [5.471–5.918] | 5.697 [5.473–5.920] | 5.698 [5.475–5.922] |

Streaming responses were `text/event-stream`, with31–145 content fragments.
Nonstream responses were `application/json`, with one delivered content block.
Early SSE frames preceded answer content: first raw bytes alone overstated the
benefit. Draft sentence medians were2.761s for short and3.598s for medium stream
cases; the initial conservative extractor did not identify citation-bearing
chronology sentences. Null observations are not zero latency. Full-answer to
reference-validation overhead was .020–.102 milliseconds in accepted runs;
waiting for complete JSON, rather than CPU validation time, is the relevant gate.

These12 replies passed the shape/reference contract and simple required-string
checks. They were not all independently graded for semantic chronology. The
earlier published gpt-oss wrong-latest-event trial remains a real failure and is
not erased by this latency experiment.

### gemini3-flash, clarified prompt, dispatch offsets

| Case / stream flag | First raw byte | First model content | Accepted reply / rejection |
| --- | ---: | ---: | ---: |
| Short / true | 1.227 [1.187–1.266] | 1.228 [1.188–1.268] | 1.240 [1.204–1.275] |
| Short / false | 1.255 [1.230–1.279] | 1.256 [1.232–1.281] | 1.258 [1.233–1.282] |
| Medium / true | .839 [.733–.944] | .840 [.734–.946] | 1.461 [1.356–1.566] |
| Medium / false | 1.684 [1.664–1.703] | 1.685 [1.666–1.705] | 1.687 [1.667–1.707] |
| Chronology / true | .907 [.741–1.072] | .908 [.742–1.074] | Rejected1.465 [1.287–1.642] |
| Chronology / false | 1.613 [1.473–1.754] | 1.615 [1.474–1.756] | 1.616 [1.476–1.757] |

Streaming delivered4–8 content fragments; nonstream delivered one block.
Stream draft-sentence medians: short1.232s, medium1.168s, chronology1.147s.
Accepted full-answer to reference-validation overhead was .018–.105 milliseconds.
Rejected chronology replies are not included as fast successful answers.

The initial Gemini batch accepted8/12 contracts and rejected all4 chronology
replies. Two retained diagnostic replies gave the correct saved event sequence
and final docking, but omitted inline identity/ship citations from their
`evidence_refs` metadata. The guard correctly refused them. Clarifying the prompt
produced2 accepts/2 rejects in the first four-case repair probe and10 accepts/12
in the final batch. A further detailed pair accepted both. This variability
does not prove the prompt solved reference omissions; no guard was relaxed.

### Fully instrumented chronology pair after repairs

Both replies reported `gemini3-flash`; Codex independently checked identity,
contact/attack/kill direction, sequence and final docking against the frozen
oracle. This is a two-reply check, not general accuracy acceptance.

| Offset from dispatch | Streaming | Nonstream |
| --- | ---: | ---: |
| Headers | .928s | 1.800s |
| First raw byte | .928s | 1.800s |
| First complete SSE frame / JSON | .928s | 1.801s |
| First model content, possibly JSON prefix | .930s | 1.802s |
| First natural answer text | 1.132s | 1.802s |
| First complete draft sentence, not approved speech | 1.247s | 1.802s |
| Complete answer | 1.631s | 1.803s |
| Structured parsing | 1.631s | 1.803s |
| References validated / contract accepted | 1.631s | 1.803s |

There were9 streaming content fragments versus one nonstream block. The .384s
gap between draft sentence and complete streaming reply was not used for speech.
Offline manual fact grading time is not included in these contract timings.
No general semantic gate currently proves that every early sentence is safe.

## Audio results and blocker

The intended experiment fixed one existing catalogue voice and two literal
utterances, comparing WAV buffering and MPEG compatibility streaming twice per
condition. The live experiment could not progress to that matrix:

1. Buffered short TTS timed out at90s without headers or bytes.
2. The next stream request was interrupted when the batch was stopped; its
   outcome and charge are unknown. The harness was changed to stop on the first
   uncertain request before initiating another condition.
3. With Qwen unloaded, a separate short stream probe timed out at60s, no headers.
4. After the owner restarted Player2, buffered short TTS again timed out at60s,
   no headers. The improved batch stopped automatically.

Health still returned0.10.88 and the voice catalogue returned54 entries including
the fixed voice. No purchase, subscription, microphone or playback operation was
used. These observations isolate failure to the speech request path, but cannot
separate remote provider, local app queue and backend synthesis. They do **not**
prove that a functioning audio stream always buffers until completion.

An existing local stream sample was decoded offline with the new MPEG decoder:
first PCM samples appeared after feeding256 bytes of its11,400-byte payload;
38,400 samples/channel at24kHz were decoded with zero errors (1.6s duration).
The decoder reported two output channels; that is not a separate source-header
channel audit. The old PCM WAV also decoded successfully. This proves decoder
operation, not new live streaming latency. Old samples used different text and
are not a paired stream/buffer comparison. No raw audio is published or played.

Live short/long repetition, chunk pipeline latency, audible joins, perceived
voice consistency and device acceptance remain **unverified**. The old25.5–54.2s
buffered observations remain historical; they are not substituted for this
blocked experiment.

## Cost, research and verification

This increment made44 text requests:12 gpt-oss,12 initial Gemini,2 diagnostic,
4 repair,12 final Gemini and2 detailed final probes. Recorded rounded balance
deltas totalled0/7/1/2/7/1 Joules respectively. These are observations, not exact
billing or proof that gpt-oss is free. Three completed timeout records showed
zero observed delta; the interrupted stream has unknown outcome/charge.
No generation was automatically retried and no purchase or account change was
made. STT was not invoked in this increment.

Qwen27B research attempts and repairs are retained locally as **incomplete**:
the first hit context saturation/repeated reads, a context-compaction repair
continued searching without a conclusion, and removing the forced JSON command
format produced an HTTP failure. No negative API claim is based on those runs.
Codex checked the installed API's stream field description and TTS response
contracts directly. Its stream property says actual streaming is determined by
the endpoint; runtime claims above come from the measured wire. Prior completed
Qwen field research remains indexed, without relabelling these attempts as success.

Decoder API/provenance: [upstream WASM audio decoders](https://github.com/eshaz/wasm-audio-decoders),
locked npm `mpg123-decoder`1.0.3, development-only, installed without scripts.
No SDK or corpus dump was committed. A returned raw MIME type is not codec proof.

**75/75** relevant Node tests passed, covering delayed SSE, broken framing,
invalid JSON, 402/429, disconnect/timeout, scope rollback, late audio,
interruption, PCM validation, text fallback and budget/readback failure handling.
Node syntax and diff checks passed. Original4 protected files,2 frozen inputs
and37 installed files remain unchanged; X4 stayed closed and Qwen was unloaded.
No XML/Lua/schema was changed, so installed X4 schema validation is inapplicable.
No usage-allowance telemetry was available; conservative checkpoints were used.

## Recommendation and exact continuation

| Option | Decision |
| --- | --- |
| Complete-answer validation + buffered speech | Preserve guards; speech currently blocked, not ready for acceptance |
| Complete independently approved text split into sentences | Optional bounded queue implemented/tested; live latency and joins unverified |
| Speak incremental model prose | **No-go:** early drafts have no demonstrated general factual/chronology approval gate |
| Text-only external fallback | Available now; retain failed-reply refusal |
| Existing local TTS fallback | Possible next investigation, not installed or selected by this workstream |

Agent should review the measured text results and safe queue implementation,
then isolate Player2's speech backend failure. Once a single bounded fixed-text
speech probe returns decodable audio, resume the saved short/long fixed-voice
matrix and approved-sentence pipeline. Do not rerun the whole text benchmark
merely to retry speech. Provider-side streaming attribution requires provider
telemetry or app implementation evidence beyond the public HTTP observation.
Native X4, device listening and deployment/merge remain separate owner gates.
