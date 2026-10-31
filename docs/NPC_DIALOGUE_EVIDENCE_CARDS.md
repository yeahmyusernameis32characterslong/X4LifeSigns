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

No production writes, migrations, deployment, X4/TTS test or merge is included.
No new persistent index is justified by this semantic presentation work.
