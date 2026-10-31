# NPC retrieval: first implemented and evaluated increment

30 October 2026. PR #29, offline only. Plan:
[NPC dialogue retrieval helper](NPC_DIALOGUE_RETRIEVAL_HELPER.md).
Follow-up: [31 October model residency and matched comparison](NPC_DIALOGUE_MODEL_COMPARISON.md).

## What exists

The optional `dialogue/` modules provide a read-only snapshot binding, temporal
NPC knowledge filter, indexed retrieval and model-selected tool orchestration.
They do not change the database schema, recorder, game UI or installed companion
manifest. The host fixes the NPC, universe and saved checkpoint; the model has
no filesystem, shell, write or arbitrary SQL tool.

The four tools are `profile`, `history_summary`, `search_history` and
`read_events`. Summaries count observation records; they do not count shots,
battles or unique losses. Full details remain available behind scoped refs.
Pages have scope-bound continuation cursors. A valid same-scope conversation
may reuse evidence already retrieved without a compulsory new call per turn.
`ANSWER` means a completed tool-grounded generation, **not** a factual pass.

Command knowledge covers only the person's temporally evidenced own command
asset. No subordinate-report traversal is implemented. A last-observed posting
does not prove personal perception. Unknown/ambiguous assignment and mere roster
presence grant no command knowledge. This conservative policy can withhold
genuine history that the collected data cannot securely associate.

## Host usage

Use Node.js 24.21 and the repository's locked dependencies:

```powershell
npm ci --ignore-scripts --prefix profiles
node --test dialogue/test/*.test.mjs profiles/test/store.test.mjs profiles/test/history-store.test.mjs
```

The trusted offline host supplies the source and destination paths, the verified
production catalogue entry/root, and an explicit saved-history checkpoint:

```js
import {captureSnapshot} from './dialogue/snapshot.mjs';
import {DialogueReader} from './dialogue/retrieval.mjs';
import {runDialogue} from './dialogue/model-session.mjs';

const binding = await captureSnapshot({
  source, destination, universe, rootId, entry,
});
const reader = new DialogueReader(binding, {
  npcSeed, run, record, access: 'command',
});
try {
  const result = await runDialogue({
    reader, chat: approvedLocalChat,
    question: 'What does your ship log establish about the encounter?',
    persona: 'Concise, professional conversation.',
    onTrace: savePrivateTrace,
  });
  // Treat INCOMPLETE as interrupted work, never an absent event.
  // Check material claims independently before presenting them as verified.
} finally {
  reader.close();
}
```

`approvedLocalChat({messages, tools})` must provide the established Ollama chat
response shape, enforce the approved local model/endpoint and a request timeout.
The helper contains no credentials or automatic server discovery. The caller
owns cancellation, private trace storage and model unload. Resource guards are
checked between requests; they do not abort a transport that ignores its timeout.
Conversation objects are trusted host state, not model-supplied arguments.

Capture requires READY metadata, an ordinary source without SQLite sidecars and
an exclusive new derivative destination. On Windows it reuses the maintenance
read-handle exclusion for writable contenders. Other platforms have not been
validated for equivalent exclusion. Do not copy an active SQLite file by hand,
restore a retired history for this experiment or instantiate the writable
ProfileStore constructor as a reader. Capture checks original hashes and validates
the derivative. Failed captures may leave an unusable derivative; no binding is
issued for it. Source validation does not authorise maintenance.

Snapshot hashing and schema/root/generation checks occur on reader creation.
Tools guard file identity, size/timestamps and sidecars before and after access.
An immutable frozen copy is the host contract, not a hostile-filesystem defence
against timestamp restoration. Indexes are private in-memory derivatives, rebuilt
per reader. Conversations bind snapshot, person, checkpoint and policy; they must
not be carried into a different grant. There is no persistent cache to invalidate.

## Evaluation method

Actual Qwen tool requests ran through these modules. Codex supplied questions
and style instructions, not the incident answers. Research and witness contexts
were separate. Local manifests retain fixed snapshot hashes, grants, questions,
requests, replies, tool traces and metrics. Raw evidence stays ignored and local.

The model was pinned `qwen3.8:27b-q4_K_M`, digest
`25b843619e944cd0ae6069f94ff4e5e26a16e109ccbc0a66a0f05979ed70098e`.
Settings: temperature 0.15, context 16,384, output limit 1,600, thinking disabled,
non-streamed, keep-alive ten minutes. X4 was closed before every request. This
27B development model is not a selected gameplay model.

The synthetic fixture independently specifies identities, incoming/outgoing
contact, a kill, an order state, a station attack, transfer/role gaps, role removal,
ordinary crew and a saved branch with rolled-back game time. Realistic trials
used a frozen 944,320,512-byte schema-v2 generation-3 copy. Independent
parameterised SQL over explicit saved ancestry checked its selected captain,
posting, event directions, counts and counterparties without using helper
filtering as its own oracle. There were 36 outgoing contact observations, five
incoming contacts, six kill credits and two missile launches in that scope.
No full-collection accuracy statistic follows from this one real captain.

Thirty-six dialogue trials were preserved: 31 returned `ANSWER`, five returned
`INCOMPLETE`. Those are execution statuses, not correctness scores. Source research
calls are separate. Early manifests lack a source-commit field; their frozen
traces/batch journals and the commit sequence preserve their stage. Later trial
manifests record the exact implementation commit.

## Failures and repairs

| Stage | Observed result | Implemented response / remaining limitation |
| --- | --- | --- |
| Initial combat, four trials | All four reversed incoming contact; three falsely claimed no order after searching the wrong exact type | Added deterministic event meanings, recorded-type discovery and explicit direction guidance; four matched reruns got those facts right |
| Initial realistic paging, four trials | All four hit the context budget | Added scoped summary counts and equivalent repeated-filter cursor support; preserved the incomplete attempts |
| Later realistic reports | Counts/participants checked, but one inferred ship class from a display name | Added explicit name-versus-class guidance; final four matched reports retained the checked required facts |
| Transfer and role trials | Required chronology recovered; some prose blurred former/current posting or called incoming contact an unqualified attack | Added role/assignment provenance and current-role clearing; ambiguity is reduced, not eliminated |
| First follow-up | Correct context-only response was rejected for making no new tool call | Allow already-grounded same-scope evidence reuse; repaired trial completed correctly with zero new tools |
| Two fresh conversational questions after tuning | Correct incoming/outgoing/kill direction, but not wholly factual | Formal answer inferred survival and claimed orders were unrecorded despite an accessible order entry; informal answer called a three-entry contact/kill selection the whole sequence, omitting that order |

The last row is an open accuracy gate. A model can cite genuine refs while making
an unsupported sentence or omitting relevant evidence. Prompt guidance and
deterministic direction labels help but do not prove general reliability.
Personality trials exercise two styles only; no naturalness score or uniform
accuracy claim is justified. A real manager whose assignment could not be grounded
was correctly denied a posting; this is an explicit data-coverage limitation.

## Matched timing

This is a reproducible **broad-read baseline**, not a reconstruction of earlier
Aria timings. Both modes use the same temporal policy, tools, question, frozen
data, grant and model settings. Baseline uses the existing ancestry-wide reads,
array searches and full event fields in search pages. Indexed mode selects event
subjects and individual profiles, builds an in-memory search index and returns
compact pages with full details on request. Both have scoped summary support.

Final realistic warm sequence at `b16df1b`: baseline, indexed, indexed, baseline.
Each starts a new reader; the model stays warm. Two trials per mode are too few
for a robust percentile or general speed guarantee. Figures are medians, with
the complete-answer range shown. There were no tool errors in these four trials.

| Measurement | Broad-read baseline | Indexed helper |
| --- | ---: | ---: |
| Complete answer, including reader setup | 45.96 s (44.08–47.85) | 38.01 s (36.55–39.47) |
| Reader preparation, including hash/policy/index work | 3.026 s | 1.309 s |
| Sum of tool execution time | 561.36 ms | 32.20 ms |
| Returned tool bytes | 29,564 | 18,342 |
| Accumulated request bytes | 70,372 | 57,687 |
| Accumulated prompt tokens | 19,284 | 15,943 |
| Generated tokens, including tool requests | 459.5 | 439.5 |
| Model prompt processing | 7.227 s | 4.457 s |
| Model generation | 33.512 s | 30.529 s |
| Model load | 21.72 ms | 20.53 ms |
| Model calls | 4 | 4 |
| Tool calls | 5 | 4–5 |

The median complete-answer reduction was about 17%. Answer lengths and chosen
details differ despite matched requirements. The whole reduction cannot be
attributed to SQLite; model generation still dominates. The 8.39-second frozen
snapshot capture is a separate one-time setup cost, not hidden inside reader
timing. Serialisation/tracing and host overhead are included in end-to-end time;
tool execution time does not include subsequent model ingestion of the result.

Initial synthetic model-cold profile trials took 23.48 s baseline and 13.75 s
indexed, with model loads of 16.42 s and 6.75 s respectively. Same answers,
same one tool call and nearly identical millisecond retrieval: this is load/OS
cache variation, **not** evidence of a ten-second helper improvement. Explicit
unload setup preceded these timings. Warm synthetic combat reruns overlapped
(baseline 24.74–25.71 s, helper 23.71–27.80 s).

A valid scoped follow-up completed in 4.28 s with one model call and no new tools.
Fresh conversational answers took 21.24–23.18 s but had the factual weaknesses
above; they are not accepted accurate-answer speed results. First usable text
here means a complete non-streamed response, with no TTS or gameplay contention.

## Validation and next gate

Node.js v24.21.0: **28 tests passed**, including 13 helper tests and 15 existing
profile/history regressions. Coverage includes exact seeds, ancestry/forks,
role transitions, foreign scope denial, full-detail baseline parity, cursors,
snapshot readiness/ownership/generation/seals, stale data, hostile text, rename
provenance and grounded follow-ups. Production database, catalogue, registration
and anchor hashes remained unchanged; all 37 installed companion files still
matched their existing deployment manifest. Frozen input hashes remained intact.
Qwen was unloaded after testing. No X4 XML changed, so installed schema validation
was not applicable. There was no deployment, gameplay test or merge.

Recommendation: Agent review this implemented, measured increment. Keep a
separate accuracy gate for generated prose and wider association coverage before
runtime integration. No product response-time or dialogue-reliability acceptance
is claimed. The original trials and failed replies remain available locally for
continuation; they have not been replaced by repaired answers.
