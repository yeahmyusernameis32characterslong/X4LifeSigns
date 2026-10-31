# Resolved evidence for small-model dialogue

Owner-authorised PR29 increment, starting at `3c8b5ec`.
Optional offline reader only; existing recorder, identifiers, database schema
and knowledge grants stay intact.

## Task and acceptance checks

1. Resolve contact recipient/source, attacking asset/target, credited asset/
   destroyed object, docking asset/destination and person/assignment explicitly.
2. Produce sourced steps in saved-ancestry/record order. Shared identifiers
   support observed participant matches; time adjacency alone proves no cause.
3. Each interpreted record carries supported roles and explicit unsupported
   conclusions. Unknown roles remain unknown. A ready order is not execution.
4. Allow the host to restrict history to a saved run and game-time interval,
   before selecting records, nearby context, counts or model-visible topics.

Relevant files: `dialogue/evidence-facts.mjs`, `briefing.mjs`,
`model-session.mjs` and their tests. Preserve all previous trial evidence.
Validate direction, destination, conflicting IDs, time rollback, pagination,
role boundaries and bounded totals with synthetic tests before actual 8B trials.
Then test the four previously failing questions and fresh phrasings; grade
facts independently of completed generation and valid citations.

No natural-language calendar resolver is assumed: “yesterday” needs a defined
game-time window. The host can supply `focus: {run: 'R1', from: 50, to: 53}`
to `runDialogue` with briefing presentation. Run aliases refer to the existing
grant's ancestry, not external sessions. A focus cannot widen authorisation.
Current identity is checkpoint background, not a historical identity assertion.
Conversations and cursors cannot be reused across different windows.

For period-specific questions, the host should set `requireFocus: true`.
Without a resolved focus this returns `INCOMPLETE` with
`HISTORY_WINDOW_REQUIRED`, before any model or tool call. This is an explicit
host contract, not an automatic natural-language date parser. Omitted bounds
mean the beginning/end of the specified run. Unknown event times are excluded
from a bounded selection, rather than treated as zero.

## Implemented evidence contract

| Recorded event | Resolved roles | What remains unproved |
| --- | --- | --- |
| ATTACKED | Contact recipient; contact source | Deliberate hostility, first shot, shot count |
| ATTACKING | Attacking asset; target | Successful hit, first shot, cause of later destruction |
| KILLED_OBJECT | Credited asset; destroyed object | Killer survival, NPC death, sole contribution |
| RELATED_OBJECT_DESTROYED | Destroyed subject; recorded killer if present | NPC death; an additional loss when paired |
| DOCKED | Docking asset; destination | NPC personally aboard, a new assignment, reason |
| Assignment/role observations | Person; assigned asset identifiers; recorded role | Arrival, continuous command or personal perception |
| ORDER_* | Order holder; order name; observed state | Issuer, issue time, intent, execution from ready alone |
| Other types | Explicitly uninterpreted fields | Further semantic conclusions |

Each JSON row retains exact identifiers, source ref, game time, raw fields and
existing access proof, alongside its resolved relation and unsupported claims.
The text presentation gives numbered, sourced observations. JSON also describes
whether consecutive rows share observed subject/counterpart identifiers, with
conflicts rejected and unknown matches left unknown. Every such link explicitly
leaves causation unestablished. An ID-code match is an observed match, not a new
guarantee of permanent ID-code uniqueness. Saved ancestry takes precedence over
game-clock sorting when a clock moves backwards. Pagination remains explicit;
the first row of a page makes no claim about the preceding page's relationship.

Named-asset incident queries also resolve the asset to personnel transitions
containing only recorded assignment identifiers. This uses already authorised
observations, not a global profile/name search. Equal populated seeds must agree
with populated ID codes; code-only fallback is confined to the same saved run.
No command permission is inferred from the join. Nearby orders remain context,
not proof they belong to the same incident.

The separate `orders` view avoids requesting combat totals for an order-state
question. Host focus applies before topic discovery, record/context selection
and totals. Current identity remains labelled checkpoint background; a time
window does not reconstruct a historical identity or expand the grant.

## Offline verification, 31 October 2026

Node v24.21.0: **39 relevant tests passed**, with no skips/failures. Tests cover
resolved direction/destination, assignment identifiers, conflicting identifiers,
ancestry/clock rollback, unknown times, windowed counts/context/topics, role
exclusion, foreign cursors/conversations, unresolved-period refusal, plus the
existing helper and profile/history regressions. Syntax and diff checks passed.
Recorder mappings were checked in `recorder/profile-events.json` and existing
history/combat generators; the recorder itself was not changed.

**39 actual 8B dialogue attempts** were retained: six simple starts, six paired
baseline/revised questions, one order-view recheck, twelve revised varied trials,
three order-holder follow-ups and five final focused smoke checks. All completed;
there were no tool errors and five citation repairs. Ninety model responses were
checked against the existing pinned 8B digest and 16,384 context setting.
No 27B requests, new download or default researcher change.

The paired set is mixed evidence, not a demonstrated overall accuracy gain:

| Question | Earlier presentation | First revised presentation |
| --- | --- | --- |
| Personnel transitions | Wrong docking destination | Correct destination and transition times |
| Ordinary encounter | Cast doubt on recorded target destruction | Correct credited destruction and direction |
| Ready order in encounter | Correctly withheld issuer | Incorrectly named order holder as issuer |
| Fresh service history | Dated move from docking | Chose a name query and missed ID-only transitions |
| Saved branch | Correct facts and event ref | Correct facts, wrong ref on docking claim |
| Exact real combat totals | Correct | Correct |

The missed ID-only transitions led to the exact assignment join described above.
Later formal and informal service replies recovered all five transitions in
order, with docking at the correct destination. Final focused checks correctly
answered service chronology, two-record contact window, one-record docking,
one-record order state and real exact combat totals. These are targeted checks,
not a fresh broad accuracy benchmark.

Final warm focused times including a fresh reader: service 2.77 s (one citation
repair), contact window 1.42 s, docking 1.13 s, order 1.11 s, real report 3.31 s.
The real report used three model calls/two tools; its reader preparation was
1.19 s, including 1.10 s snapshot validation. No equally accurate speedup is
claimed. Richer evidence costs more text in small incident/service questions.

## Remaining accuracy gate

The twelve varied trials still included an invented order issuer, an NPC/ship
ID conflation and a valid reference attached to the wrong material claim.
An order-only window also elicited an encounter label not established by that
record. Later explicit `Issuer: UNKNOWN` wording did **not** eliminate the issuer
error in the broader formal question. Preserve those failures; do not describe
this as solved by prompt wording or by the successful focused order check.

Typed evidence removes a need to guess; it does not force the model to respect
it. Existing citation checks verify reference membership, not claim entailment.
Natural-language period resolution, stronger claim-to-evidence validation and
broader event vocabulary remain open. No automatic causal battle clustering,
global NPC knowledge or production dialogue reliability is claimed.

Original databases/catalogue/registration/anchor and both frozen inputs remained
unchanged. All 37 installed companion files retained their approved hashes.
Models were unloaded after testing. No X4 XML changed, so installed game-schema
validation was not applicable. Raw requests, replies, grades, timings and owner
identities remain local-only; this document contains sanitised results.

No production writes, migrations, deployment, X4/TTS test or merge is included.
No new persistent index is justified by this semantic presentation work.
