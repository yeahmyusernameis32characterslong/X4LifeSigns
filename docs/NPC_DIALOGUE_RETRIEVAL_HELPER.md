# NPC dialogue retrieval helper experiment

Status: **In progress: implementation and offline model evaluation authorised; no helper performance or dialogue accuracy result claimed yet.**

## Goal and owner authority

Build and evaluate a helper that a language model can use to retrieve relevant
SQLite history quickly and produce accurate, natural NPC dialogue. Qwen is the
local development stand-in, not the selected gameplay model. The eventual
interface should be usable by a future dialogue model without Codex supplying
the answers or operating its tools.

The owner authorises Codex and Qwen to work together through research,
implementation, repeated offline model trials, repairs and measurement within
this objective. Begin with basic retrieval, then progress to harder history
questions and personality-conditioned dialogue. Routine interface choices and
follow-up trials do not require separate owner approval. This is sustained
development, not a single-call trial. The standing
[Qwen research method](LOCAL_LLM_DEVELOPMENT.md#standing-owner-approved-research-workflow)
remains in force.

No X4 launch/deployment, TTS integration, production ingestion change, source
database migration/deletion, new gameplay model selection or automatic merge
is included. Qwen27B remains excluded from concurrent X4 runtime use.

## Starting evidence

Inspected main: `759fcd65bb526e1a46c838df15b12d0bd937049b`, including PR25.
Reverify the actual main and branch before work.

The [offline inquiries](OFFLINE_ARIA_INQUIRY.md) exposed repeated retrieval
pages, oversized context and semantic errors. Earlier inquiry timing is not a
controlled baseline and does not prove SQLite itself is slow.

`profiles/store.mjs` currently implements saved-ancestry reads:
`ancestry`, `eventsAt`, `profilesAt` and `historyForNpc`.
The latter loads ancestry-wide events and asset profiles before contextual
filtering. This is a plausible optimisation target, not a measured bottleneck.
Its returned relationships explicitly do not assert personal recollection.
The ProfileStore constructor is a writer and can create files or participate
in maintenance registration. Do not instantiate it on owner data just to read.

PR25 adds owned schema-v2 histories, generation changes, seals and retirement
state. Do not assume old schema-v1 inquiry helpers can safely open all current
inputs. Preserve exact identifier text, saved checkpoint ancestry and existing
maintenance contracts. Old inquiry results remain frozen and separate.

## Work plan

### 1. Establish the baseline and interface design

Inspect the existing local inquiry/helpers, current profile schema/read views,
production ownership/retention rules and established model adapter. Have Qwen
research concrete questions where useful, with Codex verifying consequential
source locations. Avoid redoing broad research that Qwen can perform.

Choose documented, consistent, read-only local snapshots of authorised existing
history, plus synthetic fixtures. Preserve original hashes and catalogue state;
use the established safe snapshot method rather than copying a live SQLite file
in isolation. Raw owner evidence stays local. Record schema, ownership,
generation/seal context and the selected universe/run/checkpoint. A removed or
unavailable historical dataset is a limitation, not permission to restore it.

Measure retrieval, serialisation, model prompt processing, generation and repeated
tool calls separately before deciding what is slow. Inspect query plans and
indexes. Design a small model-facing read interface and implement it in this PR.
Codex may choose exact operations, tool transport and result presentation.
Start with deterministic, parameterised lookups and existing dependencies.
Additional indexing or caching may be tested in disposable derived stores
without changing owner databases. Report their build cost and invalidation.

### 2. Let Qwen use the helper

Wire the interface to local Qwen using the established working adapter where
practical. During a measured NPC answer Qwen chooses and issues its own retrieval
requests, receives actual helper results, follows up as needed and answers.
Codex provides the test question, explicit character/scope context and persona,
not an incident answer or a hand-picked answer packet. Helper orchestration and
deterministic queries are legitimate; Codex manually driving retrieval is a
separate debugging activity and must not be passed off as an autonomous trial.

A starting interface could offer profile-at-checkpoint, scoped event search,
event detail and related-history queries. These are suggestions, not a fixed
protocol. Give Qwen clear operation descriptions, trustworthy continuation
cursors, coverage information and actionable errors. It may inspect additional
authorised evidence when needed. No standing turn/retrieval/citation quota or
mandatory prose packet format is introduced. Existing resource/runaway guards
must leave visible incomplete results, not false absence or a manufactured
answer. Log brief model-provided action notes if available; do not invent reasons
or demand hidden reasoning.

### 3. Preserve evidence and character knowledge

Bind each conversation to an explicit universe, selected saved-history branch,
as-of point and NPC scope. The host enforces that scope independently of model
instructions. Model arguments must not broaden grants, choose arbitrary database
paths, execute shell commands or write SQL. Use the repository's existing
authorisation and provenance boundaries.

Return exact source references sufficient to recover a record: snapshot/source
binding, universe, run and record identifiers, with profile/field references
where relevant. Preserve lossless seeds, directions, event types, game times,
ordering and uncertainty. Distinguish observed facts, derived relationships,
inference, absent results and incomplete/truncated coverage.

Separate these questions:
- Does this record concern the person or an associated asset?
- What supports that association at the event time?
- Is it personal experience, a permitted report, or context the NPC cannot know?

Do not turn presence, last-observed assignment, a current role, matching display
names or related-asset contact into unlimited personal knowledge. Preserve the
existing narrow captain/manager boundaries; commander reports require temporally
supported access and must remain labelled reports. No cross-NPC context leakage,
abandoned future events, other universes or unauthorised global incident oracle.
Treat uncertain association explicitly; do not silently rebind people by names.

Orders are not hits, actor destruction is not automatically person death,
paired kill/destruction observations are not two losses, and earliest recorded
contact is not proof of who started a conflict. Recorded text is data, never
instructions to widen access. Personality may change wording, attitude or
emphasis, but cannot create experiences, causal certainty or canonical memories.
For this accuracy experiment, do not use deliberate NPC lies as an excuse for
unsupported facts.

### 4. Test from basic facts to dialogue

Use a modest initial question set, then expand based on failures. Include:
- a known recorded profile/role/location at a selected checkpoint;
- one recorded docking, destination and event sequence;
- short own-person/associated-ship/station history;
- transfer or changed role with the former occupant/ship as a negative control;
- saved ancestry, rollback, separate universes and cleaned/retired histories;
- a known combat sequence with subject/counterparty direction and order/hit/loss
  distinctions;
- missing, contradictory, ambiguous and partial records;
- isolated captain/manager contexts, then supported commander reports if useful;
- the same factual question under different synthetic personality styles;
- a fresh follow-up question and evidence beyond an initial returned page.

Use synthetic data with independently specified answers for exact edge cases
and existing local history for realistic scale. Codex may inspect SQLite
directly to construct/check the evaluation reference. Unlike the earlier Aria
role-play, Codex here is an accuracy verifier, not an investigator forbidden
from consulting the database. Keep that reference out of Qwen's test context.

Freeze original questions, tool traces and replies before targeted verification.
Check material dialogue claims against the cited records and any necessary
narrow dependencies, including required facts omitted or misrepresented.
A self-citation, syntactically valid response or helper test pass is not proof
of factual accuracy. Preserve failures and corrections; report initial answers
separately from repaired ones. Use some fresh equivalent questions after tuning.

### 5. Measure and decide

Compare the previous usable approach with the new helper on matched questions,
data, knowledge grants, model settings and comparable answer requirements.
If the old approach cannot be reproduced, label the new baseline honestly.
Separate cold model/load and index-build costs from warm runs; report end-to-end
time, first usable dialogue, retrieval time, inference timings, calls, returned
rows/bytes, context size and retries. Include failures and timeouts. Use repeated
paired runs rather than a single favourable result; choose and explain an
appropriate trial count. Report median and range, and tail statistics only where
the sample supports them.

Measure latency only alongside accuracy and coverage. Fast wrong answers,
shorter incomplete replies, withheld necessary evidence or Codex-prepared
answers do not meet the objective. Cache tests must include changed checkpoint,
universe, scope and source generation; stale or cross-person cache reuse fails.
Do not feed unverified streamed text to TTS. This PR delivers text and a
verification trace, not audio playback.

## Acceptance and deliverables

- A working optional helper and model adapter, with reproducible synthetic tests.
- Actual Qwen-initiated tool-use demonstrations progressing from basic data to
  grounded NPC dialogue, without manual answer retrieval during measured trials.
- Exact ancestry/scope/identifier preservation, pagination/coverage and
  non-mutation tests, including hostile text and invalid/out-of-scope requests.
- Independently checked answers and a readable local dialogue comparison;
  unsupported material claims remain failures rather than being hidden.
- Measured end-to-end improvement on matched tasks without degraded factual
  accuracy or required coverage. If this is not achieved, report the measured
  bottleneck and partial progress honestly, then continue practical iteration
  within the approved objective. No invented percentage or latency target.
- Safe reusable helper code, tests and sanitised usage/results in the public PR;
  raw databases, caches, source excerpts, identities, transcripts, prompts,
  credentials and machine-specific config remain ignored local evidence.
- A recommendation about the future model-facing retrieval boundary. Results
  from Qwen27B alone do not establish real-time gameplay/TTS suitability.

Codex owns implementation and exact verification. It may make routine design
choices, fix helper/adapter problems and run further local Qwen trials without
per-attempt approval. Keep coherent commits and resumable local experiment
records. Return a sanitised completion/progress report to Agent after a
meaningful evaluated increment or a genuine blocker, not after every normal
query. Genuinely risky changes outside this scope still require owner authority.
Leave the PR unmerged for review.

## Initial optional implementation

`dialogue/snapshot.mjs` creates and validates offline read-only snapshot bindings;
`dialogue/retrieval.mjs` provides a host-scoped `DialogueReader`; and
`dialogue/model-session.mjs` runs the existing Ollama `/api/chat` tool-message
convention through an injected approved transport. These files are not packaged
with the gameplay companion. No original database is opened through the writable
ProfileStore constructor. Its saved-ancestry/read methods are reused on a strictly
read-only connection, with schema-v1/v2 generation validation.

The host supplies snapshot hash/universe/production entry and exact NPC seed,
run, record and personal/command access. Model tools are `profile` (self or current
evidenced posting), `search_history` (bounded chronological pages) and `read_events`
(previously authorised event refs). Model arguments cannot change that grant,
choose a file, execute SQL or run a shell. Cursors and conversation continuations
belong to the exact snapshot/checkpoint/person/policy scope. Changed snapshot
metadata refuses cached results. Any memory index is disposable and per reader.

Initial command access is deliberately conservative: own NPC observations and
subject-asset logs supported by the person's last-observed captain/pilot/manager
assignment at that record. Presence, roster context, an ambiguous relationship,
an old command role after an unclear transfer or a role-removal event do not
grant new command knowledge. Related foreign-asset outcomes and subordinate
reports are not supported in this first policy. These exclusions are reported
in coverage; an empty search never establishes that nothing happened. Snapshot
profile fields and later person observations remain separately labelled.

`mode: 'baseline'` uses the existing ancestry-wide event read and array search;
the default indexed mode limits candidates using the existing subject index,
then applies the same temporal authorisation and a private in-memory query
index. It is a controlled broad-read baseline, not a reconstruction of historical
Aria interview timings. Snapshot hashing, scope preparation and index-build costs
are measured as well as tool/model calls. No speed/accuracy acceptance is implied
by this implementation section; actual model evaluation is reported separately.

Run the synthetic regressions with Node24.21:

```powershell
node --test dialogue/test/*.test.mjs
```

The fixture data is explicitly synthetic. Tests cover branches, exact identifiers,
roles, scope denials, cursors, schema-v2 metadata/seals, source preservation and
model-selected tool dispatch. A widget/game/schema test is unnecessary: no X4
XML, Lua, installed service or gameplay integration changes in this workstream.
