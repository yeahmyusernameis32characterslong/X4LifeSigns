# Player2 integration results — PR #30

Codex execution report, 2 November 2026. Implementation is on PR #30, not
installed in X4. The original [workstream plan](PLAYER2_NPC_INTEGRATION.md)
remains the acceptance authority. See [the external harness](../player2/README.md)
for commands and private configuration examples.

## Delivered

- Optional Node adapter discovers Player2's actual loopback port, enforces request
  and response limits, parses streamed text and reports safe failure codes.
  Only health checks retry; generation requests never retry automatically.
- PR #29's reader is incorporated into this branch. Each turn reconstructs fresh,
  read-only context for an exact NPC, universe, saved ancestry and checkpoint.
  The host resolves relationships, chronology, evidence limits and time focus.
  Player2 receives no database, SQL, shell or permission-selection tool.
- Structured replies separate spoken text from validated evidence references.
  Incomplete JSON and unknown references are rejected. Reference membership
  does not establish sentence accuracy: dialogue remains GENERATED_UNVERIFIED
  and is never written into canonical history.
- Reader/load changes cancel work and reject late replies. Prepared native
  request/reply and speech-output boundaries share the same scope invalidation.
  These classes are not registered with the game's MD/Lua interface.
- External typed dialogue, explicit microphone controls, uploaded-file STT,
  buffered WAV synthesis, raw audio streaming, stable NPC voice preferences and
  text fallback are implemented. No microphone capture or playback starts
  automatically. Voice preferences are separate from historical memory.
- A local audio sample player supports manual playback and a browser output
  chooser where permission and browser support allow it. Hardware acceptance
  has not been performed.

Production recorder, schema, installed extensions and databases are unchanged.
PR #29 was incorporated by branch merge `70106b1` from `b3c7580`; neither PR
#29 nor PR #30 has been merged into main during this work.

## Research and provenance

Installed Player2 0.10.88 supplies developer and NPC OpenAPI documents, both
labelled API version 0.1.0. Installed contracts and actual wire responses take
precedence over older examples. The official Unity SDK was inspected at commit
`77aac50ddb95efd86964ee0099a6f2ce65315a32` under its MIT licence. Its licence
does not imply permission to redistribute unrelated documentation. Raw SDK,
API documents, requests, audio and owner data remain in ignored local storage.

Qwen `qwen3.8:27b-q4_K_M`, pinned to digest
`25b843619e944cd0ae6069f94ff4e5e26a16e109ccbc0a66a0f05979ed70098e`,
researched the authorised corpus through list/search/numbered-read tools.
Codex verified consequential chat, TTS and STT field findings against the
original schemas. Earlier context saturation and tool-protocol failures remain
recorded as incomplete research. Focused successful follow-ups do not turn
those incomplete attempts into evidence of unsupported features.

The host uses caller-owned chat messages rather than relying on a managed NPC
memory reset. This prevents prior generated conversation from entering a new
checkpoint's request; it makes no claim about provider logging or deletion.

## Automated verification

Node v24.21.0:

```powershell
node --test player2/test/*.test.mjs dialogue/test/*.test.mjs profiles/test/store.test.mjs profiles/test/history-store.test.mjs
node --test bridge/test/session-routing.test.js
```

Results: **64/64** combined tests and **35/35** bridge routing tests passed.
They cover contracts, framing, failure paths, scoped retrieval, rollback,
stale text/audio, voice persistence and typed fallback after speech startup
failure. Mocks establish boundary behaviour, not physical device behaviour.
Four protected data files, two frozen test inputs and all 37 installed files
matched their preflight hashes. X4 remained closed and the Qwen model was
unloaded after research. No XML/Lua/schema change requires X4 schema validation.

## Real external Player2 trials

The app returned model **`gemini3-flash`** for the completed chat trials. This is
an observed response field, not a hardcoded model choice. Twenty actual text
requests include probes, failed attempts, repaired trials and intentional
cancellation; they are not a 20/20 accuracy benchmark.

The repaired five-case structured set correctly answered the independently
checked core facts for identity, directed combat, service chronology, an older
saved branch and an approved real captain's aggregate combat counts. Fresh
reader-to-answer times were 2.539, 1.339, 1.670, 1.319 and 4.013 seconds.
The real case included 2.25 seconds reader preparation, mostly frozen-file
hash verification, and 38 milliseconds retrieval. Conditions were not controlled
against PR #29; no unconditional model speedup is claimed.

Additional actual requests checked ordinary-crew and station-manager knowledge
limits, two checkpoints on one host and cancellation after provider output had
started. An earlier future-facing role was absent from the earlier branch's
request, and an in-flight reply after scope change was refused. An external CLI
conversation also completed successfully, with usable text in 1.113 seconds.
These are external harness tests, not X4 load-route tests.

Original failures led to concrete repairs:

- Short token budgets produced cut-off sentences despite a `stop` finish flag.
  The default budget is now 2,048 and incomplete structured output is refused.
- Requiring inline citations rejected an otherwise valid reply with correct
  evidence metadata. Inline references are now optional; any present must
  agree with the validated metadata.
- One early failed response was not retained because diagnostic capture was
  incomplete. Its request/error remain; later attempts preserve wire responses.

### Speech observations

The catalogue returned 54 voices. Two voice IDs and a repeated selection were
tested with a fixed sentence. Buffered WAV readiness took **54.194, 37.359 and
33.123 seconds**, producing 199,244–213,644 bytes. WAV headers showed mono
24 kHz, 16-bit PCM. Reusing a voice ID preserves selection, not identical bytes.
Uploaded-file STT transcribed the sample's words correctly in **1.547 seconds**,
allowing case and punctuation differences.

A compatibility stream returned 11,400 MPEG-like bytes after 24.245 seconds;
the first bytes arrived less than a millisecond before completion. It was not
decoded or listened to and demonstrates no useful playable streaming lead.
A further buffered sample with Qwen unloaded still took **25.491 seconds**.
This is a speech latency blocker. Backend attribution, cache and warm-up effects
are unresolved. A post-request Node RSS observation was 56.8 MiB, not peak RAM;
no GPU coexistence test with X4 was authorised or performed.

No physical microphone, human voice-quality, output-device or M6 acceptance
test was performed. STT's app-global start/stop API has no documented ownership
lease; the adapter refuses ambiguous or expired ownership and keeps typed input
available. Provider-dependent style instructions do not guarantee age, accent
or emotion control.

Only existing app balance was used. No purchase, subscription change or paid
credential configuration occurred. Rounded per-request balance changes and an
unexplained balance increase prevent a defensible total cost calculation.

## Owner-requested model follow-up

The owner requested `gpt-oss-120b` after these trials. On inspection, the installed
`GET /v1/catalog/models` result did not contain that model and
`GET /v1/ai_profiles` returned an empty list. The chat request schema has no
documented `model` property. A suggested-model header is conditional on feature
registration and may fall back to the player's default; it would not prove the
requested model ran. The owner has been asked to select it in the Player2 app.
No gpt-oss result or comparison is claimed until the response model is verified.

## Review and acceptance remaining

Agent should review the implementation, scoped knowledge results and retained
failure summaries, then decide the next native integration and speech latency
work. A selected-model follow-up is pending the app configuration above.

Native X4 hookup, hardware input/output, voice listening quality and coexistence
with gameplay remain unverified. No live deployment, X4 launch or PR #30 merge
was authorised or performed. Keys, authentication tokens, the supplied project
identifier, private histories and raw research artefacts are excluded from Git.
Usage allowance telemetry was unavailable; conservative completion checkpoints
were used without claiming a remaining percentage.
