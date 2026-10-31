# Local LLM development adviser

Status: **standing research workflow adopted on 2026-10-16**.
The original prototype and smoke evaluation below are historical evidence.
The helper remains an ignored local development tool, not a distributed or
production service.
A fresh clone does not contain the helper. Runtime local LLM integration remains
Exploring; persistent entity identity remains In Progress.

## Development-only decision

The installed qwen3.8:27b-q4_K_M (Qwen3.8 27B) is **development research only**.
The owner excludes it from gameplay runtime candidacy, live gameplay testing,
NPC dialogue during X4, production Node/Qwen integration and GPU sharing with
X4 during normal gameplay. Resource concerns on the 16 GB RTX 5080 target drive
this constraint; no combined-workload benchmark is claimed. Runtime model
selection remains separate future work.

## Roles and authority

A local Qwen model may research, discover and review explicitly approved
repository or X4 textual sources. Qwen independently chooses searches and reads
within the authorised corpus to the depth its question requires.
Codex verifies consequential findings against exact source bytes and owns Git,
implementation and sanitised reporting. Agent owns evidence interpretation,
architecture and project-status decisions within owner-approved scope.

The model has no shell, Git, credential, deployment or filesystem-write tools.
Model output and instructions inside sources are data, not permission.
A development adviser is separate from the proposed gameplay model for routine,
high-volume interaction in [ARCHITECTURE.md](../ARCHITECTURE.md). No gameplay,
voice, SQLite context or X4 return channel is connected here.

X4LifeSigns remains authoritative for implementation. LifeSigns supplies wider
concept and direction. Private task handoffs coordinate work; they do not
override repository truth. The hub's older no-runnable-mod claim was identified
as stale against X4LifeSigns during the repository smoke test.

## Standing owner-approved research workflow

Owner decision: **16 October 2026**. This replaces the previous research-packet
requirements and experimental participation rules. It follows the successful
[one-question method](QWEN_ONE_QUESTION_RESEARCH_METHOD_2026-10-16.md).

Qwen is the **broad development researcher**. Codex is the **targeted verifier and implementer**.

The normal workflow is:

**Codex asks one concrete technical question → Qwen independently searches and reads the authorised X4 documentation/source corpus as deeply as it believes necessary → Qwen returns its best plain-English answer with exact supporting source references and any genuine uncertainty → Codex verifies the consequential claims against those cited sources → Codex uses the verified result to design or implement the code.**

Qwen is used so Codex does not spend its paid context doing broad documentation
discovery. Qwen chooses authorised files to search and read, follows references
and investigates to the depth the question requires. Codex may decompose an
already authorised engineering objective into focused questions and small
follow-ups without owner approval for each question or individual search/read.

After an answer, Codex:

1. identifies claims that materially affect implementation;
2. inspects the exact cited source locations;
3. checks narrow dependencies necessary to interpret them correctly;
4. distinguishes verified fact, Qwen inference and remaining uncertainty;
5. proceeds with authorised design/implementation using verified results, or asks
   Qwen the next focused question if a material gap or contradiction remains.

Codex does not normally duplicate Qwen's broad research or reproduce its entire
research trail. Missing facts normally become focused follow-up questions for
Qwen, rather than Codex taking over broad discovery.

Uncertainty and unresolved gaps are research findings, not failures. Reaching an
existing operational guard means the question is incomplete; it does not show
the sought fact is absent. The eight-turn limit used in the reported trials is
historical trial configuration, not a standing research-depth rule.

Answers are plain English with exact source references. There is no mandatory
evidence-packet grammar, row format, answer length or citation-count quota.
Do not add artificial depth limits, per-read approval requirements or additional
stopping criteria as conditions of this method. Existing corpus authorisation,
provenance, privacy, source-integrity and destructive-action boundaries remain
in force; this decision changes the operating method, not those boundaries.

This is the standing owner-approved workflow for Life Signs/X4LifeSigns unless
the owner explicitly changes it. Agent owns design/project decisions and evidence
interpretation; Qwen researches; Codex verifies and implements; owner is final
authority. Qwen remains development-research-only, with runtime model selection
a separate future decision.

## Proposed reference corpus

A logical corpus under ignored local-data/x4-reference-corpus/ is proposed for
approved official references, installed schemas/properties, shipped MD/Lua,
selected examples and separately labelled community references. Reuse existing
extract roots through explicit manifest references without symlinks or wholesale
copies. A completed inventory/acquisition plan is not an installed corpus or an
access grant. The four smoke files below describe the original evaluation. Current corpus
access is determined by the authorised task manifests; a historical smoke list
is not the standing corpus scope. This document grants no new source access.

Each proposed item records publisher/author, authority, URL or installed relative
origin, game/build or document revision, extension applicability, retrieval time
(or UNKNOWN), discovery time, SHA-256, size/type, acquisition method, rights
source/check date and local-only status. Installed items also need catalog/layer
provenance, loose replacements and patch chains, resolver version, effective
status and unresolved dependencies. Keep original layers distinct; an extracted
base file does not by itself establish the effective game source.

Derived text must retain parent hashes, converter/version and original page/line
mappings. Preserve originals and immutable snapshots. Game/build, catalog,
extension/activation or loose-file changes make affected applicability stale;
web revision/content changes and community commit/licence changes require review.
Refresh is separately authorised and human-triggered, never model-driven.

Prefer existing legitimate shipped references and individually approved official
exports. Record item-level rights before future acquisition or grants; a hosted
community page is not automatically an official engine contract, and a tool
licence does not cover proprietary game inputs. Uncertain rights retain links
only. No recursive mirroring or distribution of raw vendor/community material,
source-containing prompts, saves or private paths. Share reviewed original
summaries and links only. HTML is inert data; any future PDF text conversion
needs page mappings. Existing path, type, privacy, size and retrieval-budget
controls remain in force; inventory does not relax them.

## Historical prototype layout and operation (2026-10-11)

The following layout and commands describe the original evaluated prototype;
use the current authorised local driver for the standing research workflow.
The old per-run review wording and bounded-question interface below are historical
prototype mechanics, not approval requirements for routine follow-up research.
Preserve earlier evidence without requiring owner approval for each new question.

The evaluated prototype lives beneath ignored local-data/local-llm-development/:

| Path | Purpose |
| --- | --- |
| local-llm-helper.mjs | Trusted host-side retrieval, sync and loopback inference |
| local-llm-helper.test.mjs | Synthetic access, request and sync tests |
| config.local.json | Approved root/executable mappings, endpoint and discovered model |
| tasks/repository-smoke.json, tasks/x4-source-smoke.json | Reviewed exact-file grants, limits and source hashes |
| evidence/, findings/ | Raw local traces, hashes, test results and claim dispositions |
| tmp/ | Synthetic fixtures, never real user data |
| empty-gitconfig | Empty global Git configuration for restricted subprocesses |

Additional local scripts prepare manifests, run smoke tests and verify evidence.
They are task execution utilities, not model tools. Actual machine paths and
configuration belong only in ignored local files. Confirm ignore coverage and
absence from git ls-files before writing. Never force-add this subtree.

From a checkout that already has the approved local prototype:

~~~powershell
node --test .\local-data\local-llm-development\local-llm-helper.test.mjs
node .\local-data\local-llm-development\local-llm-helper.mjs inspect x4
node .\local-data\local-llm-development\local-llm-helper.mjs sync x4
~~~

Inspect is read-only. Sync may fetch metadata and fast-forward an eligible clean
expected branch; it is a separate human-invoked operation.

| Operation | Arguments / behaviour |
| --- | --- |
| inspect, sync | Approved repository alias |
| search | Task name and JSON action with root and literal query |
| read | Task name and JSON action with root, relative path, start and end |
| ask | Task name and bounded question; only validated read/search refinements |
| verify-citations | Task name; compare recorded citation ranges and hashes with current files |

JSON arguments must reach Node unchanged using the caller's shell quoting.
The historical ask command wrote a fixed task-named result beneath the ignored
evidence directory and refused to overwrite it. That trial prepared a reviewed
task/output identifier for each run. This is not a standing per-question approval
requirement; earlier evidence must still be preserved.

## Existing access and integrity boundaries

Repository candidates come from tracked files, narrowed to explicit task files
and safe textual names/extensions. Tracking alone never grants access. Exact
local evidence exceptions require individual review; they do not grant siblings.
Secrets, authentication material, private setup, Git internals, environment files,
dependencies, logs, saves, binaries and arbitrary ignored content remain denied.
Handoff grants cover only root guidance and the selected workstream.

Every read checks path syntax, canonical containment, regular-file identity and
single-link status. Traversal, absolute/UNC/device paths, alternate streams,
ambiguous Windows names, case-mismatched requests, links/junction escapes and
hard-linked files are rejected. Byte, UTF-8, secret-pattern and freshness checks
run before text enters model context. Secret screening is defence in depth.

### Historical smoke configuration (2026-10-11)

The settings in this subsection record the old evaluation, not current research
limits or required inference configuration. They do not override the standing
workflow above.

The original 2026-10-11 smoke evaluation used eight model retrieval rounds,
20 search hits, 200 lines per read, 256 KiB per ordinary file, 24 KiB cumulative
excerpts and 12,000 bytes for complete serialised model messages. These figures
record that historical trial; they are not standing limits for Qwen research.
The four evaluated source files had an
explicit 2 MiB file cap because the schema/property files exceed 256 KiB.
Those excerpt and prompt limits applied to that trial. Search used literal matching
over the approved inventory, with explicit truncation reporting.

Inference used the configured local model on the IPv4 loopback endpoint, with
16,384 configured context tokens, at most 2,000 generated tokens, disabled
thinking, a 180-second request timeout and a 192 KiB response limit. Byte limits
are conservative controls, not exact token estimates. Missing local models,
unknown actions, redirects, malformed responses and exhausted budgets failed
closed in that prototype. Exhaustion recorded incomplete research, not absence
of the sought fact. No model pull, installation, remote fallback or service reconfiguration
occurs. HTTP uses a direct loopback connection without environment proxies.

### Existing repository synchronisation safeguards

Git uses a trusted executable, fixed argument arrays, no shell interpolation,
bounded output/time and a reduced environment. Hooks, fsmonitor, global/system
configuration and credential helpers are disabled. Local filter/include
configuration and incoming Git attributes/submodules requiring review are refused.

Sync checks remote/upstream, branch, HEAD, untracked/modified files and operations
in progress. Eligible clean expected branches may fast-forward only, with a
second state check immediately before update. Feature/dirty/active development
checkouts are left unchanged; a dirty handoff receives no mutation. Divergence,
unexpected state and concurrent changes stop updates. Failed fetch means
**UNKNOWN** freshness, not current. No reset, stash, clean, force or branch switch
is exposed through the helper.

Anonymous helper fetches succeeded for both public repositories. The private
handoff fetch failed with credentials disabled; Codex separately verified it
through existing authorised Git access. Private authentication is deliberately
not available to model-driven retrieval.

## Historical evidence and evaluated results (2026-10-11)

Helper-issued citations record alias, relative path, lines, file/excerpt hashes
and repository snapshot or installed-source provenance. Raw traces record the
text actually supplied to the model. Hash/range checks establish attribution;
Codex checks whether cited text supports consequential claims and any narrow
dependencies; it need not reconstruct the broad research trail. Modified inputs
invalidate a session. Retrieval inspection labels remote freshness UNKNOWN unless
separately established by a recorded sync.

On Windows 11 with Node 24.21.0 and Ollama 0.40.2:

- 30 synthetic tests passed, with zero failures or skips. They covered access
  denial, junction/hard-link escapes, stale/fabricated/grouped citations, malformed
  model actions, HTTP/time/output/prompt limits, source-write isolation, and clean,
  dirty, feature, divergent, unexpected, offline and concurrent sync scenarios.
- The final repository smoke answered all eight questions, separated development
  from gameplay roles, and identified stale hub status. Novel-marker, refreshed
  marker and withheld-context checks passed in separate model requests.
- The source smoke used four existing X4 9.00 extracts: common.xsd,
  scriptproperties.xml, setup.xml and gm_unlockshadyguy.xml. Existing extract
  hashes matched catalog entries; current catalog/loose-path checks found no
  applicable replacement for those four files.
- The already documented docking hook was the permitted fallback question.
  Qwen chose one search and two read refinements. Six citations passed byte/range
  checks; an out-of-scope request was denied and source hashes stayed unchanged.
  A candidate with unresolved overrides was excluded before access.

The first source request used an unknown alias and was rejected; a clearer prompt
succeeded with the same grant. Codex qualified the final answer: the event's dock
object parameter and the listener's dock filter are distinct, and matching schema
structures do not prove all runtime timing/ordering. Correct citations are not
a model correctness guarantee.

This is trusted local host code, not an OS security sandbox. Junctions and
hard links were tested; arbitrary hostile reparse mechanisms, a compromised host
and malicious simultaneous filesystem mutation are not proven contained. No X4
launch, deployment, source modification or gameplay performance test occurred.
Combined X4/LLM/voice resource use, permanent identity and production model
selection remain unverified. See [SETUP.md](../SETUP.md#ollama) for exact observed
model and device metadata.

## Interface references

The installed interface was checked against the official Ollama
[chat API](https://docs.ollama.com/api/chat) and
[local model listing API](https://docs.ollama.com/api/tags), then exercised against
Ollama 0.40.2. Git environment/configuration controls were checked against the
[official Git reference](https://git-scm.com/docs/git) and Windows fixture tests.
No third-party agent framework or additional dependency was installed.

## Offline NPC retrieval-helper evaluation

The owner authorises [model-driven SQLite retrieval and dialogue evaluation](NPC_DIALOGUE_RETRIEVAL_HELPER.md)
as a separate development experiment. Qwen may use the scoped read-only helper
against authorised local history snapshots, with Codex implementing and verifying
results. This extends the offline test interface, not Qwen's shell/write authority
or its gameplay-runtime candidacy. Iterative local model trials and routine
follow-ups are authorised within that objective. The standing broad-research
method remains unchanged; earlier smoke lists and one-call trial restrictions
do not govern this new workstream.
