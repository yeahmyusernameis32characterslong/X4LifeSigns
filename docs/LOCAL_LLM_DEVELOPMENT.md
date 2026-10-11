# Local LLM development adviser

Status: **local prototype tested on 2026-10-11; under evaluation**. This is an
ignored, disposable development tool, not a distributed or production service.
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
repository or X4 textual sources. It can propose bounded search/read requests.
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

## Research packet workflow

Agent is the designer and project manager, Codex the developer and exact
verifier, Qwen the researcher, and the owner the final authority. Agent supplies
a bounded question. Qwen discovers within authorised sources and returns a
compact evidence packet. Codex verifies consequential claims against applicable
original bytes and necessary dependencies before any authorised implementation.
Agent interprets the evidence and sets the next step within owner-approved scope.

A packet normally spans one or two pages, with up to six findings and ten primary
references. It records the question, approved scope, snapshot, searches and
coverage/truncation limits; exact file/line or page/hash citations; observations
separate from interpretations; counterevidence, unresolved dependencies and
version conflicts; claims requiring Codex verification; and questions requiring
live X4 evidence. Request a bounded continuation for an unanswered gap.
Source-containing packets and excerpts remain local. Citation validity alone
does not establish semantic correctness or effective-source applicability.

## Proposed reference corpus

A logical corpus under ignored local-data/x4-reference-corpus/ is proposed for
approved official references, installed schemas/properties, shipped MD/Lua,
selected examples and separately labelled community references. Reuse existing
extract roots through explicit manifest references without symlinks or wholesale
copies. A completed inventory/acquisition plan is not an installed corpus or an
access grant. Current source access remains the four smoke files listed below.
No new acquisition, extraction or helper expansion is authorised by this design.

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

## Local layout and operation

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
Each ask writes only a fixed task-named result beneath the ignored evidence
directory and refuses to overwrite an existing result. Preserve earlier evidence
and prepare a new reviewed task/output identifier for another run.

## Access contract and limits

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

The evaluated limits are eight model retrieval rounds, 20 search hits, 200 lines
per read, 256 KiB per ordinary file, 24 KiB cumulative excerpts and 12,000 bytes
for complete serialised model messages. The four verified source files have an
explicit 2 MiB file cap because the schema/property files exceed 256 KiB.
The same excerpt and prompt limits still apply. Search uses literal matching
over the approved inventory, with explicit truncation reporting.

Inference uses the configured local model on the IPv4 loopback endpoint, with
16,384 configured context tokens, at most 2,000 generated tokens, disabled
thinking, a 180-second request timeout and a 192 KiB response limit. Byte limits
are conservative controls, not exact token estimates. Missing local models,
unknown actions, redirects, malformed responses and exhausted budgets fail
closed. No model pull, installation, remote fallback or service reconfiguration
occurs. HTTP uses a direct loopback connection without environment proxies.

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

## Evidence and evaluated results

Helper-issued citations record alias, relative path, lines, file/excerpt hashes
and repository snapshot or installed-source provenance. Raw traces record the
text actually supplied to the model. Hash/range checks establish attribution;
Codex still checks whether the cited text supports each claim. Modified inputs
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
