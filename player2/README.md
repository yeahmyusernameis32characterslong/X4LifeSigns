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

- `transport.mjs`: discovered loopback connection, bounded bytes/time, cancellation,
  redirect refusal, safe status errors and independent SSE/NDJSON framing.
- `client.mjs`: caller-owned chat messages, streamed/nonstreamed completions,
  first/whole-text timing, bounded health-only reconnection. Generation POSTs
  are never automatically retried.
- `dialogue-host.mjs`: scoped reader/evidence integration, pagination, immutable
  grant/epoch guard and stale-result refusal.
- `voice-identity.mjs`: local per-universe/NPC preferences with exclusive writes;
  missing saved voices produce text fallback, not silent reassignment.
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
