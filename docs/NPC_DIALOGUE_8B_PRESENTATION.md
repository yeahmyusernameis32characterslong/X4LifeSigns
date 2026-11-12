# 8B retrieval presentation and query experiment

31 October 2026, PR #29. Optional offline implementation and evaluated increment;
dialogue accuracy remains incomplete. The owner requested 8B-only testing after
the [model comparison](NPC_DIALOGUE_MODEL_COMPARISON.md). No 27B model requests
were made in this increment, and the development-research default is unchanged.

## What changed

The existing record tools remain the default. A new optional presentation offers
one `recall` operation with five views: identity, service, incident, combat and
latest. Every view includes the authorised current person/command context.

- Identity separates latest observed role/assignment from older snapshot fields.
- Service groups permitted person observations and dockings into one bounded page.
- Incident adds nearby order-state context to literal counterpart matches, only
  for the same authorised subject/run and within 120 game seconds. This is a
  retrieval window, not a declaration that the events form one battle.
- Combat gives exact scoped counts and a short first/last kill-credit example.
  Its text summary does not pretend to list all targets. Full structured results
  and the underlying record API remain available.
- Latest follows saved ancestry/record order, including clock rollback, rather
  than sorting unrelated game times into a false chronology.

Plain evidence cards keep exact source refs beside concrete statements. Recorded
facts and unknowns are separate. Fleet-role fields are excluded from the compact
combat text to reduce a demonstrated model/class confusion; they remain available
in identity/structured data. This changes presentation, not collected data.

The model can use native tools or a schema-constrained first selection. In the
latter it chooses a view, including literal incident topics matched from its
question within the existing authorised history. Quoted unknown names can also
be searched. The host validates and translates that selection into a real recall
request. Original JSON replies and the translation are both traced. This is
model-selected structured dispatch, not a native tool call disguised as one or
Codex choosing records during a trial. No answer oracle is supplied.

[Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
provide the JSON-schema transport. The host still validates values and scope.
The first selection cannot include a cursor that has not been issued. Repeated
identical invalid requests stop visibly as incomplete; a resource interruption
never establishes absence of an event. This is not a fixed research-turn quota.

Briefing replies must cite retrieved record refs. Missing/unknown refs request a
correction; both drafts remain in the trace. Repeated identical ungrounded prose
stops incomplete. **This checks references, not whether prose is true.** A valid
ref can still be attached to a wrong claim, as the tests demonstrated.

## Use

The caller still supplies the approved transport, frozen binding and exact host
grant. No model argument can change the person, universe, checkpoint, file or SQL.

```js
const reader = new DialogueReader(binding, grant);
try {
  const result = await runDialogue({
    reader, chat: approvedLocalChat,
    presentation: 'briefing', selection: 'structured', encoding: 'text',
    question, persona, onTrace: savePrivateTrace,
  });
  // ANSWER means a completed generation, not a factual certificate.
} finally {
  reader.close();
}
```

The transport must forward `format` as well as messages/tools when supplied.
Fresh model contexts can reuse the same reader for the same frozen snapshot and
grant. Each call still checks file identity/metadata/sidecars. Change of universe,
checkpoint or source generation needs a new binding/reader; do not repurpose a
reader for another NPC. Conversation continuations also bind presentation,
encoding and selection protocol. This is not a global cache or a live writer.

## Start-simple testing and preserved failures

Pinned model: `qwen3:8b` Q4_K_M, digest
`500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41`.
Ollama 0.40.13, Node 24.21.0, locally reported SQLite 3.53.4.
Temperature 0.15, context 16,384, output 1,600, thinking off, non-streamed.
Same frozen synthetic fixture and real schema-v2 generation-3 history as before;
original data and failed trials were retained. X4 was closed before requests.

Testing started with identity, then encounter direction/order/outcome, transfers,
saved branches, manager scope and a realistic captain. Each consequential reply
was checked against the independent fixture/raw-SQL reference.

Early JSON bundles still produced false citations and skipped reads. A structured
selection initially invented an invalid cursor: one attempt reached the visible
context guard after 118 failed calls; the following repeated loop was manually
interrupted. Both remain recorded as failures. The first-selection schema and
repeated-error guard were repaired. Later prose still confused orders with issue
events, role with class, contact direction and docking destination. Those replies
were preserved, rather than replaced by successful reruns.

Total exploration: **87 main attempts** (80 completed generations, six incomplete,
one interrupted without final result), plus two reader-reuse trials. This is not
an accuracy denominator: it mixes development versions. The 336 observed main
responses were checked against the intended 8B digest/context; reuse requests also
checked the loaded model. No 27B calls or new model installation occurred.

## Final paired evaluation

Twelve fixed questions per condition, alternating original/revised order and
reversing order on alternate cases; both conditions use the same 8B model,
settings, scopes and questions. The first nine questions exercise tuning cases;
the last three were fresh equivalent questions fixed before execution. No tuning
occurred within this 24-trial set. All conditions used new readers/fresh model
contexts and warm model residency.

| Measure | Original record tools | Revised recall presentation |
| --- | ---: | ---: |
| Attempts | 12 | 12 |
| Completed generations | 9 | 12 |
| Factual/required-coverage passes | 2/12 | 8/12 |
| No-tool incomplete answers | 3 | 0 |
| Tool dispatch errors | 0 | 0 |
| Citation-repair turns | 0 | 1 |

The manual rubric requires correct requested facts, no material unsupported claim
and at least one real retrieved ref. It is not a complete per-sentence citation
audit or a population accuracy estimate. Some correct claims still lack their
individual source annotation.

Revised answers recovered names/ship models, saved-branch docking and the real
combat totals. The four rejected revised cases were:

1. A transfer answer recovered the role sequence but called the ship the docking
   destination instead of the station.
2. A conversational answer correctly reported a kill credit, then treated the
   destroyed counterpart's outcome as unknown.
3. An explicit combat answer inferred an active/executing order from a ready-state
   observation. This wording was conservatively rejected as unverified.
4. A fresh service answer inferred a move time from docking instead of assignment.

The revised real captain reports had the correct identity/model and totals of
five incoming contacts, 36 outgoing observations, six kill credits and two missile
launches. One informal draft required citation repair. Different styles were
tested, but naturalness/personality consistency is not certified.

Main paired set used `d4535ef`. A later equivalent profile-query rewrite at
`8a5dfba` passed all regressions and four further model checks: original/revised
realistic report, revised branch and identity. The old report remained wrong;
the three revised replies retained their checked facts. Earlier metrics have not
been relabelled as measurements of a different revision.

## Speed: what actually helped

For the two matched realistic questions, revised **correct** replies took
2.80–2.91 seconds including new-reader setup (median 2.86). Original attempts took
2.79–3.66 seconds, but one was incomplete and the other factually inadequate.
There is no demonstrated equally-correct original speed baseline for these cases.

The revised examples used two model turns and one tool call, instead of redundant
identity plus history calls. Visible tool text fell from roughly 8.8–10 KB in
earlier bundle versions to about 1.95 KB; the raw structured trace retains more
data. This reduced context while keeping the reported counts and examples.
Small samples, output differences and model caching limit generalisation.

Reader preparation measurements isolated approximately 1.11–1.14 seconds of
snapshot hashing/schema/integrity validation, 90–96 ms of scope preparation and
6–8 ms building the private search index. It would be wrong to blame the whole
wait on SQLite queries or to remove validation for speed.

An independent disposable metadata projection tested an extra composite index.
It improved one small lookup, but did not address validation. The initial current
run had no profile rows; that empty-run measurement was retained and rejected,
then repeated on the actual ancestor containing the selected profile.

The final reader uses the **existing `entity_key` / `profile_entity` index** with
the original kind/seed predicates retained. Existing write code defines these
keys; no identifiers or schema changed. Measured original single-NPC lookup was
about 12.30 ms; equivalent entity-key lookup about 0.057 ms, with identical rows
and an indexed query plan. This is a query microbenchmark, not a 200-fold dialogue
speedup. An intermediate forced-index experiment was replaced: SQLite documents
[`INDEXED BY`](https://www.sqlite.org/lang_indexedby.html) as a requirement rather
than a general tuning hint. No new stored index or migration was applied.

With an already validated reader retained for the same frozen grant, two correct
realistic replies took **2.86 seconds initially and 1.56 seconds on reuse**. Both
used fresh model contexts, two model turns and nearly identical generation time.
The first charged 1.19 seconds of reader setup; the second did not recreate it.
This is one representative pair, not a product latency guarantee. Guards remain
active; no shared cross-person cache or persistent derived index was introduced.

## Validation and next gate

**35 relevant tests passed**, zero failures/skips: 20 helper and 15 existing
profile/history tests. Coverage includes reference repair, invalid selections,
repeated-error interruption, permission/branch boundaries, role removal, cursor
binding, baseline parity, stale snapshots and generation ownership.

Syntax/diff/privacy checks passed. Original database/catalogue/anchor/registration
hashes and frozen inputs match; all 37 installed companion files are unchanged.
Both models are unloaded; the research default remains 27B. No production schema,
game XML, deployment, gameplay, TTS or merge changed. Installed X4 schema
validation was not applicable.

The helper is more useful for this 8B model, but free-form NPC dialogue still has
material factual failures. Agent review should distinguish the retrieval/citation
improvements from semantic reliability, and prioritise relation/temporal claim
checks before runtime integration. Keep the original record API and failed
examples for continued evaluation.
