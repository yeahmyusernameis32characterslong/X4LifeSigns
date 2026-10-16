# One-question-at-a-time Qwen research: method and results

Recorded 16 October 2026. This is the method used for the [X4 event and identity findings](X4_EVENT_AND_IDENTITY_RESEARCH_2026-10-16.md). It is a local development experiment, not a gameplay integration or a measured comparison of Codex/Qwen costs.

## Standing owner decision

On 16 October 2026 the owner adopted this operating method for future
Life Signs/X4LifeSigns research. Qwen performs broad authorised discovery;
Codex asks focused questions and verifies consequential cited evidence and
narrow dependencies before authorised implementation. Codex does not need to
reproduce Qwen's research trail. Further focused questions are part of the
already authorised engineering objective, without per-read or per-question
owner approval.

Plain-English answers with exact sources and genuine uncertainty are sufficient;
earlier mandatory evidence packets and fixed output grammars do not apply.
Trial caps below are historical, not standing depth limits. Gaps are findings;
a reached guard means incomplete research, not absence of a fact. Existing corpus,
provenance, privacy, source-integrity and destructive-action boundaries are unchanged.
See the [standing workflow](LOCAL_LLM_DEVELOPMENT.md#standing-owner-approved-research-workflow).
Only the owner may change this standing method.

## The interaction

The owner replaced a broad docking research request with small questions: ask Qwen for **one fact or one event**, let it search and answer in plain English, check its cited source, then ask the next question. The first three questions sought the ship ID, destination ID and completed docking event. Later questions covered debug output, NPC roles and control posts, assignment and transfer, fleet changes, docking, combat and death. Qwen was allowed to choose search terms and the lines it read. The prompts requested a document and line, but did not require an evidence-packet structure or a prescribed answer schema.

The local driver `local-data/local-llm-development/three-question-plain.mjs` sent one question per run to the installed local Qwen model. It exposed `search_corpus` and `read_corpus` over **exact allowlisted files**: original source documents plus the optional corpus guide. The withheld answer and previous corrections were excluded. The driver verifies the model digest and each source hash, denies paths outside the grants, searches literal text across the allowlist, and returns numbered lines. In the later event questions it returned at most 40 search matches with a total/truncation flag and at most 80 lines per read. A question could use up to eight model/tool turns; earlier questions had different caps. These are limits of this local test, not a claim that eight turns is enough to research a whole document.

Each question has an append-only local JSONL journal at `local-data/local-llm-development/evidence/three-question-plain-20261015-v2-step-N.jsonl`. The `finish` option, used when Qwen reached its turn cap after useful reads, resent the same question with only Qwen-selected source excerpts and asked for plain prose. That option made some answers readable; it did not add evidence or make an answer correct. There were 40 such local step journals at consolidation. They are ignored local research data, not publication artefacts.

## What the trials showed

| Observation | Consequence |
| --- | --- |
| Narrow questions about docking, undocking, attack, destruction and commander/control-entity changes produced usable source paths and lines. | Codex could verify the original schema or shipped usage and move to the next question. |
| Qwen sometimes searched the same term repeatedly, requested unhelpful/invalid ranges, or reached the turn cap without a prose answer. | A turn cap prevented unbounded loops but also left some questions unresolved. Preserve those journals and gaps; do not turn a search miss into proof of absence. |
| Qwen sometimes read only selected lines, not an entire document. Search returned at most 40 matches, even when `total` was larger. | A plausible answer is bounded by what it actually saw. Use shorter terms, pagination and targeted reads where needed; neither a search hit nor a guide summary replaces source inspection. |
| The plain-answer follow-up could recover a concise answer from source lines Qwen already chose, as for docking, undocking and attack. | Treat the follow-up as a presentation aid. Verify the cited bytes and the precise meaning of the event independently. |
| Some answers were semantically too broad: `event_object_abandoned` was offered for an NPC leaving a ship, and a player assignment event for completed/general assignment. | Distinguish an event's documented payload and timing from the natural-language task label. Record unsupported transitions as unresolved. |
| A generic event can support a specific use only after checking entity type, role, post or assignment. | The verifier must inspect original lines and the planned live observation, especially for pilot, manager, escort and NPC death labels. |

The method does not establish that Qwen used less total time or Codex allowance. It reduced the amount of model output Codex had to interpret per question, but repeated searches and follow-up calls still have a cost. No quantitative efficiency comparison was run.

## Repeatable practice for the next research round

1. Ask one short question about one observable event or field, in plain English.
2. Let Qwen search the exact granted corpus and read any needed adjacent lines. Keep the corpus guide optional and treat it as navigation only.
3. If results are truncated or a document remains partly read, allow new ranges and different terms. A repeated identical zero-result search is not progress.
4. Ask for a plain-English answer with document and line. When no relevant source was read, retain “unresolved” rather than force an answer. A `finish` pass is appropriate only when useful original excerpts are already in the journal.
5. Check each consequential claim against the original source, including event timing, object/parameter meanings and whether the event truly covers the requested case. Check effective-source overrides and live X4 behaviour separately when the task requires them.
6. Carry confirmed findings and unresolved questions into a consolidated report before implementation. Keep raw journals and personal save details local.

The existing [local LLM development policy](LOCAL_LLM_DEVELOPMENT.md) remains in force: Qwen is a development researcher, Codex verifies consequential evidence, and no local model is thereby approved as a gameplay runtime model.
