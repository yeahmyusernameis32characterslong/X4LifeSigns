# Player2 external development integration

This optional package is not installed in X4 and is not started by the recorder.
Run with Node.js24.21 or later, using the repository's locked profile dependencies:

```powershell
npm ci --ignore-scripts --prefix profiles
node --test player2/test/*.test.mjs dialogue/test/*.test.mjs profiles/test/store.test.mjs profiles/test/history-store.test.mjs
node player2/harness.mjs --config <private-config.json>
```

The default harness command only discovers Player2 and checks health. It never
starts the microphone, generates text/audio or purchases anything. The endpoint
is discovered from Player2's `api.port`, or supplied explicitly as a numeric
loopback HTTP address. There is no automatic fallback to a guessed port.

## Text conversation

The trusted caller must provide a previously verified read-only snapshot binding
and explicit NPC/saved-checkpoint grant, using the PR29 snapshot procedure. Do not
point the reader at a live writer database or instantiate a writable ProfileStore
to inspect owner history. No automatic database selection or migration is added.

Private configuration shape:

```js
{
  player2: { gameClientId: '<your registered Player2 Game Client ID>' },
  binding: verifiedSnapshotBinding,
  grant: { npcSeed: exactSeedString, run: selectedRun, record: savedRecord, access: 'command' },
  selection: { view: 'incident', text: recordedCounterpartName },
  focus: { run: 'R1', from: startGameSeconds, to: endGameSeconds },
  requireFocus: true,
  allowGeneration: true,
  costAcknowledged: true
}
```

Store actual JSON under ignored local storage. Alternatively provide the Game
Client ID through `PLAYER2_GAME_CLIENT_ID`. Do not copy account tokens into it.
The Game Client ID is a developer-dashboard project identifier. App login and
available credits are separate prerequisites. No ID is impersonated or invented.

Generation requires explicit `--generate` as well as the two private opt-in
flags. They acknowledge an externally verified cost policy; they do not make
generation free. Do not enable them under a no-paid-charges instruction until
the actual account/provider arrangement is known to satisfy that instruction.
Use `/quit` to exit. Ctrl+C cancels a pending request. Provider failure leaves
typed input available. This CLI is an external harness, not an in-game menu.

Each question receives freshly reconstructed scoped evidence, not earlier
generated conversations or a managed NPC history. Stable NPC identity/persona
and local voice preferences are separate from historical context. New saves,
earlier saves and different NPCs need explicit reader grants. Changing a host's
reader cancels pending work and rejects late replies even if a provider ignores
cancellation. It cannot guarantee that a remote provider stops computation or
billing when a socket is cancelled.

Requests contain only host-selected evidence and the question. Player2 cannot
choose a file, SQL query, shell command, NPC grant or outside checkpoint. Broad
selections exceeding the reader's resource limit are refused, not silently called
complete. A period-specific request can require an explicit host time window.

Replies have status `GENERATED_UNVERIFIED`. Citation membership is checked,
but a valid reference is not proof that the sentence it accompanies is correct.
Nothing the model says is written into SQLite history.

## Modules and failure boundaries

Streaming measurements and the current speech blocker are documented in
[the latency report](../docs/PLAYER2_STREAMING_LATENCY_RESULTS.md).

### Explicit external streaming experiments

Install the optional MPEG decoder with `npm ci --ignore-scripts --prefix player2`.
Use a private ignored JSON configuration, extending the harness connection
configuration with `allowGeneration`, `costAcknowledged`, `repeats: 2`, a frozen
reader `binding`/`grant`, and `output` pointing to an ignored `.local.jsonl` file.
For text, provide exactly three `cases`, each with `question`, `selection` and
optional `required` regular-expression strings. Those string checks are not
semantic fact verification. For audio, additionally set `allowSpeech` and one
fixed `voiceId` from the app's catalogue.

```powershell
node player2/streaming-bench.mjs --config <private-config.json> --text
node player2/streaming-bench.mjs --config <private-config.json> --audio
```

The commands are generation opt-ins, not routine health checks. Output files
are exclusively created. Batches stop after uncertain/balance/service failures;
do not repeatedly restart a timed-out generation. No audio is played or stored.
Raw timing events retain fragment sizes/cadence, not answer strings or secrets.
An optional developer `onReview` callback is separate from those timing logs;
private review material must remain outside Git.

`ScopedSpeechOutput.renderSegments` is an optional experimental path for complete
text independently approved by the trusted host. Provide exact sentence segments
and an `approve(result)` callback; a model-generated approval or valid reference
set is not independent verification. It permits one waiting audio buffer and
interrupts the caller sink on load/cancellation. It is not enabled by the CLI.

See [verified integration results and remaining gates](../docs/PLAYER2_NPC_INTEGRATION_RESULTS.md).

- `transport.mjs`: discovered loopback connection, bounded bytes/time, cancellation,
  redirect refusal, safe status errors and independent SSE/NDJSON framing.
- `client.mjs`: caller-owned chat messages, streamed/nonstreamed completions,
  first/whole-text timing, bounded health-only reconnection. Generation POSTs
  are never automatically retried.
- `dialogue-host.mjs`: scoped reader/evidence integration, pagination, immutable
  grant/epoch guard and stale-result refusal.
- `voice-identity.mjs`: local per-universe/NPC preferences with exclusive writes;
  missing saved voices produce text fallback, not silent reassignment.
- `speech-output.mjs`: buffers audio under the active reader/load scope and
  rejects stale output before an optional caller-owned sink can play it.
- `native-interface.mjs`: prepared versioned request/reply contract. It is not
  registered with MD/Lua and is not a proven native X4 dialogue path.

## Prepared native boundary

The trusted load lifecycle calls `beginLoad()` before any new game/save load,
then `activate({host, npcSeed})` only after resolving the current snapshot/grant.
Native input contains only `version`, `loadToken`, `requestId`, `npcSeed`, and
`question`. Host code chooses the retrieval selection and optional time window.
Unknown fields and mismatched identities/load tokens are rejected. The return
envelope contains speaker/text, exact evidence refs and generated status; it
contains no SQL, executable commands, filesystem paths or permission grants.
Every load invalidates pending requests and queued output. A future native
adapter must apply the same epoch to audio playback, not merely HTTP completion.

No recorder binding (including M6) has been changed. Native controls and live
installation need the owner's separate approval and in-game acceptance test.

## Speech controls in the external harness

Add `--speech` only after explicitly configuring `allowSpeech: true`, a private
`voiceLedger` filename and an existing `audioDirectory` under ignored local
storage. A chosen `preferredVoiceId` is optional. The ordinary typed-input path
continues to work if Player2 speech fails.

- `/record` starts Player2 microphone capture as an explicit user action.
- `/stop` transcribes that capture and sends the resulting question through the
  same scoped dialogue host. Capture defaults to a15-second API timeout.
- `/say` synthesises the last accepted reply to a new WAV file. Valid citation
  markers are omitted from spoken text. No audio is automatically played.
- `/quit` attempts to stop a recording owned by this harness. If a start/stop
  connection failure leaves ownership uncertain, check and stop recording in
  Player2; the harness refuses another silent start.

The reusable `PushToTalk.press/release` API is ready for a future physical-key
binding. This is not a tested M6 binding, and no game bindings were changed.

`Player2Speech` also accepts uploaded audio files for STT without opening a
microphone, buffers explicit WAV synthesis, lists voice IDs and exposes raw
compatibility-stream chunks. A raw chunk is not necessarily playable audio;
container/decoder and output sink remain the caller's responsibility. Fixed
voice IDs are persisted separately from checkpoint-scoped memories. Voice
style instructions are provider-dependent and are not guaranteed accent,
age or emotion controls. The installed API has no documented output-device
selection field; select playback devices in the browser/system or future native
sink rather than inventing a Player2 parameter.

The provider's completion flag is not sufficient to detect truncation. The
host therefore requests a JSON-schema envelope with text and evidence refs,
refuses incomplete JSON and validates the reference set. Inline references are
optional in structured mode; any that are present must agree with the validated
metadata. This keeps source refs separate from natural spoken dialogue without
claiming that reference membership establishes semantic truth.
First provider text can be a JSON prefix; first usable text is measured only
after complete parsing and validation.

`audio-preview.html` is a local sample player with no network or microphone
access. Select a generated sample and click Play. An explicit output picker is
offered only where the browser exposes permission-gated
[selectAudioOutput](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput)
and [setSinkId](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId)
in a secure context; otherwise use system output settings. Browser/device
acceptance remains a separate manual check. This is a development utility,
not a preview or implementation of the X4 UI.
