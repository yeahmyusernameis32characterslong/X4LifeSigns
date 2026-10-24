# Offline Aria inquiry experiment

This owner-authorised conversation experiment uses Codex as Aria and seven
separate local Qwen captain contexts, identified here as P1–P7. It is not
implemented Aria, actual NPC testimony, gameplay integration or a model accuracy
benchmark. No production behaviour, database schema or installation changes.

## Evidence and conversation separation

A deterministic local preparation helper opens the existing profile database
read-only. It selects the retained incident session and its saved-checkpoint
ancestry through the existing `ProfileStore` read interfaces. Abandoned future
branches are excluded. Original database hashes are checked before and after.

Each witness receives only their own person events and events attributed to the
ship they were last observed commanding at that recorded point. An assignment
or a similar name alone does not establish permanent identity. Last-observed
command is not proof of uninterrupted command; unrecorded changes remain unknown.
Physical presence, fleet membership and counterparty identifiers do not grant
another ship's event history. World/relationship events and the owner's hidden
diplomatic consequence are excluded from the witness packets.

The selected event window is the retained session's first through last recorded
relevant combat contact, with a disclosed 60 game-second margin on either side.
It is an analytical selection, not a proven boundary of the entire conflict.
Assignment observations come from accepted ancestry. The experiment does not
claim that the window includes every earlier cause, order or later consequence.

Qwen has no SQL, filesystem, shell or write tools during interviews. Each
conversation receives only its own packet, its unchanged prior turns and Aria's
current question. Aria may explicitly quote another witness; that introduces
testimony to discuss, not independently observed knowledge. Repeated testimony
based on a shared report is not independent corroboration.

Aria uses the neutral mission, actual questions, witness answers and interview
notes. She does not inspect a global incident timeline or query the database to
correct a witness or choose a verdict. This separation is procedural: prior
conversation and historical dialogue prompts exposed relevant case context, so
the exercise is explicitly **not blind**. Those prior narratives and the hidden
outcome are excluded from the stated grounds of her conclusions.

## Execution and observed limitations

All seven witnesses have a unique recorded person match. Six have qualifying
incident-window observations; one has none. A missing observation is not proof
of absence, innocence or a lack of damage. Two initial interview rounds cover
each witness, followed by focused questions for P1, P2 and P4: 17 model calls in
total. Each original answer is retained, including errors and later corrections.

The interviews exposed unsupported defensive language, chronology/arithmetic
errors and claims of non-involvement based on empty records. Aria challenged
these in the dialogue. Corrections do not establish that every remaining claim
is accurate. No answers are silently rewritten or rerun to force a preferred
result. Recorded attack ordering cannot, by itself, identify the first shot,
intent, a shared order or responsibility for initiating a wider conflict.

The owner-readable local output contains the full interrogation, a friendly
briefing, a formal draft report and the evidence needed to resolve remaining
possibilities. These are testimony-based conclusions, not adjudicated ground
truth or diplomatic communications. No report is sent in-game or to anyone.

## Checks and retention

Local checks cover source-byte preservation, packet/hash binding, forbidden
subject/world-event exclusion, synthetic access denials, independent request
contexts, absence of the hidden outcome and preservation of prior answers.
Documentation checks cover the diff and privacy. These checks verify the stated
data-access mechanism, not historical truth or empirical dialogue accuracy.
No production suites, native schema validation or gameplay tests are claimed
for this documentation-only experiment.

The transcript, exact entity mappings, packets, raw model requests/responses,
query provenance and hashes remain in ignored local data. The private handoff
contains sanitised execution results and local-only pointers, not the transcript
or raw evidence. The helper is an ignored development artefact, not a distributed
research framework or runtime Aria implementation.

Aria remains unimplemented. Persistent entity identity remains In Progress.
No deployment, database writes, pruning or merge accompanies this work.
