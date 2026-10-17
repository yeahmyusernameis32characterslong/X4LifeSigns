# Broad native MD event capture: research findings and Agent planning input

Research recorded: 2026-10-17. **Status: In Progress, source investigation and design; capture implementation and live verification pending.** This is a research input for Agent, Qwen and Codex; it is not an Agent implementation brief, acceptance approval, deployment instruction or permission to merge.

The [source-checked recorder design proposal](BROAD_MD_EVENT_RECORDER_DESIGN.md)
tracks the current diagnostic, counting and unresolved implementation choices.

## Role in Persistent entity identity

Owner instruction, 2026-10-17: formally begin this workstream as supporting work for **Persistent entity identity — In Progress**. Broad capture should expose observed changes in ships, stations and NPC representations during normal play, including gaps that the narrow PR #17 probe could not explain. Events and snapshots provide evidence for later identity decisions; collecting them does not itself establish permanent identity, person continuity or save ancestry.

The first active phase is installed-source research and recorder design, using Qwen for broad authorised discovery and Codex for targeted verification. Subsequent phases are optional recorder implementation, owner-run capture verification and offline evidence analysis. All three snapshot modes below remain requirements. PR #17's selected-fixture test sequence is superseded as next work; preserve its code and evidence without merging or deleting it. No deployment, gameplay or merge permission is introduced here.

## Owner-approved broad-first discovery direction (2026-10-17; supersedes narrower planning)

**Capture broadly first; classify and interpret afterwards.** PR #18 now defines a source-grounded, expandable *discovery recorder* for as many observable native X4 9.00 events as practically and safely possible concerning **every player-faction ship, station, relevant subobject and NPC/personnel representation**. Include non-player attackers, targets, dock hosts, trade partners and other participants whenever their actions directly involve tracked player-faction assets/personnel. Do **not** select only named fixture ships, four enrolled entities or already-understood event families.

Register as many applicable native MD `event_*` conditions as the effective installed sources support. Use global player-owned families, valid object/group/faction/other selectors and dynamic owned-property membership as appropriate. **There is no verified universal MD catch-all**; each candidate must have a valid source, safe parameter handling and documented applicability. The purpose of source verification is *validity and safety*, **not** proof of gameplay usefulness. Do not demand individual live usefulness tests before admitting an otherwise technically suitable event.

Prioritise broad coverage of property life cycles, ownership, fleet relationships, combat, movement/orders/docking, NPC hiring/posts/assignments/transfer representations, station activity, mining/trading/production/cargo, interaction/conversation and relevant counterpart events. Preserve **every selected raw occurrence**, including repetitive and overlapping events. Do not sample away evidence or delete raw duplicates because later classification might consider them redundant. A category missing from an initial register stays **UNKNOWN / awaiting expansion**, not implicitly out of scope.

The initial recorder may be built in a **separately owner-authorised implementation phase** with the broadest safe, source-checked event set currently available while discovery and the coverage register continue to expand. An *incomplete inventory must not indefinitely block beginning a broad instrumented recorder*, but code still requires valid supported selectors, guarded values and protective resource bounds. The owner accepts measured discovery/development performance overhead in return for useful evidence; do not silently throttle broad recording, freeze gameplay or allow uncontrolled disk/memory growth.

### Raw event context before any classification

For each event, preserve its **exact native name and original available typed `event.object` / `event.param*` fields** and prompt safe context: source/target and related object references, ship/station `idcode` if supported, current names, class, owner/true-owner distinction where available, sector/location, relevant NPC component versus contextual template versus role/post/assignment, active practical session/run, time and recorder sequence. Preserve the available values **at event time** before a destroyed or transferred reference expires, where safe. Encode null, `UNAVAILABLE`, unsupported getter or uncertain association explicitly. Do not invent universal NPC `idcode`, force NPC instantiation or treat a matching name/seed/reference as permanent person identity. Keep snapshots bounded and avoid whole-galaxy lookups on every event.

Use native recording for raw event and snapshot streams; keep subsequent classifications in a **separate derived dataset**, not rewritten raw logs. Qwen operates *offline after X4 exits*, examining locally indexed/filtered evidence by run, sequence, native family, available ship/station ID codes, NPC representations and exact source file offsets/hashes. It should identify observed event types, classify what they appear to mean, find duplicates/anomalies and coverage gaps, and propose possible entity histories with evidence and uncertainty. Codex checks consequential inferences against reproducible slices. This does not grant Qwen new source/raw-log access or runtime integration.

### Discovery outputs and authority

This **draft documentation PR** is to provide an authoritative broad-first design, source-supported coverage register with honest unknowns, safe event/context contract, three revised snapshot modes, diagnostics/configuration specification, independent optional hotkey design and phased implementation/validation plan. **A working recorder, hotkey extension, game logs, classification pipeline and verified persistent NPC identities are intended later outputs of separately authorised build, owner-run X4 validation and offline analysis**, not claims that PR #18 already contains working code. Existing production MD/Node/SQLite and PR #17 remain untouched. No implementation, deployment, live test or merge authority is created by approving these words.

## Mandatory lifecycle and snapshot triggers (revised owner clarification 2026-10-17)

These are **firm requirements for Agent to design and Codex to implement when separately authorised**, not optional suggestions. They clarify the owner's intended experience: **launch X4, play normally, close X4**, without separately launching or closing Node.js or a probe reader.

1. **Automatic probe lifecycle:** once the optional Life Signs extension is installed and enabled, X4 itself starts/initialises the MD listeners and native file recorder when a playable universe becomes ready; it reinitialises correctly on load/reload, maintains relevant membership, and listeners end when the game exits. Game start/menu before any loaded universe is *not* a valid player-property snapshot. Do not require the player to start a Node reader, run a PowerShell command each session, dock, or press a special hotkey to activate capture. The one-time X4 launch option `-scriptlogfiles` is an installation/setup prerequisite to verify and document; a missing flag must be surfaced clearly, not mistaken for successful logging. A forced crash/kill cannot be promised a final snapshot.
2. **Event-triggered snapshots:** when meaningful native MD events occur, log the event itself promptly, then capture a relevant guarded point-in-time snapshot/diff of affected property and associated NPC personnel (or mark unavailable), without waiting for a player docking. Do not equate the event with settled completion of an asynchronous transfer. Avoid heavy per-event galaxy-wide scans.
3. **Periodic snapshots:** take configurable low-overhead snapshots/reconciliations even when no tracked event fires, mainly to discover missing event families, owner/crew changes and missed state transitions. Agent chooses an appropriate adaptive/default interval and performance budget, informed by X4 profiling; no fixed arbitrary cadence is prescribed here. Clearly log trigger `PERIODIC` and detect gaps/overruns.
4. **On-demand hotkey snapshot:** a player press of the planned **M5** binding on a Razer BlackWidow V4 X requests an `ON_DEMAND_HOTKEY` snapshot through a separately enabled optional **Life Signs Hotkeys** extension. The shortcut sends a distinct custom MD/UI→MD signal; the **main recorder**, not the hotkey extension, performs a safely scheduled player-faction-wide checkpoint and records actual capture time/deferral. The game-menu opening requirement `GAME_MENU_OPENED` is **explicitly superseded**. X4 does not necessarily see macro keys as distinct native M1–M6 codes; the keyboard/Synapse mapping and mod-side input bridge need installed-source/live verification. Native/event/periodic recording works without the hotkey extension.
5. **Recorder lifecycle and independently optional hotkey input:** all native listener operation, gameplay event output, EVENT and PERIODIC snapshots, and **execution** of an ON_DEMAND_HOTKEY snapshot run inside the X4-native Life Signs recorder extension. When separately installed and enabled, the independent Life Signs Hotkeys extension **only detects the M5 shortcut and emits a custom MD signal**; the recorder receives that request and performs the actual on-demand snapshot. Without Hotkeys, the recorder still auto-starts and performs broad capture plus EVENT/PERIODIC snapshots, while M5 input is unavailable. No external Node/PowerShell/keyboard-listener process is required to capture data. Node, SQLite readers, Qwen and indexes are optional **offline postprocessors** after gameplay. Any separately running collector requires a distinct architecture approval.
6. **Logging and save/load safeguards:** time-stamp/correlate all snapshots, including M5 requests, with the active *practical* production session and run (not a permanent universe/person identifier). Document append/flush and capture-order uncertainties so a keypress is not falsely called a durable checkpoint or settled asynchronous state. Keep save/load and simulation responsiveness intact; on load/reload reinitialise listeners and mark log discontinuities rather than silently combining histories.

**Historic menu-trigger research retained, but no longer an active prerequisite:** X4 UI Lua's `AddUITriggeredEvent` and MD `event_ui_triggered` support UI→MD signalling (reference: https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/UI%20Modding%20support/Talking%20with%20MD%20and%20AI%20scripts/ ). Codex found menu refresh/re-entry ambiguity, prompting the owner's approved switch to M5. Do not continue investigating exact Save/Load/Exit menu openings as a gate for PR #18. Instead verify a *minimal, original, optionally installed hotkey extension* that emits namespaced custom MD signals without a compulsory third-party mod, persistent Node service or unlicensed reuse of other authors' code. This is still a technical feasibility question, not an already-proven hotkey mechanism.

For **later separately approved tests**, replace any docking prerequisite with: ordinary game launch and automatically observed broad event records across owned assets; at least one periodic snapshot; an M5 press producing one `ON_DEMAND_HOTKEY` snapshot (when the independent extension is enabled); diagnostics M1–M4 changing the active level if verified; and continued automatic recording with the hotkey extension disabled. Also check save/reload/session reconstruction, missing `-scriptlogfiles`, log growth and real performance, without mandatory Node or PR #17's old scenario. Hotkey mappings and actions must be validated before claiming them functional.

## Owner direction and supersession of PR #17 tests

**The owner is changing approach from the narrow PR #17 four-entity/five-stage experiment to broad, persistent, native Mission Director (MD) logging of as many relevant observable events as X4 9.00 exposes for all of the player's property and NPC personnel.** Normal play should produce a broadly useful event history; native write durability remains an open verification question. Individual experiments can be devised *after* captured events and gaps are inspected.

- **Do not continue or repeat the PR #17 five-stage observer-docking/transfer/destruction live-test matrix as the next task.** Stop treating those steps, selected A/B/S/P1 enrolment, observer docking or the existing reader as prerequisites for this new direction. Preserve existing PR #17 code, results, logs and documentation as historical evidence; do not discard or reinterpret them.
- PR #17 is an **unmerged draft**. Agent must decide whether to close, supersede, reuse pieces of or otherwise resolve it in a separate plan. This research note neither merges nor closes it, nor authorises deploying new code.
- Agent owns architecture, scope, phases, evidence interpretation, safety gates and the eventual Codex brief. Codex independently verifies current Git state, consults Qwen per the standing workflow, verifies consequential source claims and implements **only within a subsequent authorised plan**.
- Qwen is preferred for **high-volume LOCAL, OFFLINE log exploration**, so raw giant captures are not loaded wholesale into paid Codex/Agent context. Its existing development-research-only restrictions remain: this does not select Qwen as a gameplay model or approve simultaneous X4/Qwen GPU use.

## Documented mechanisms and candidates requiring installed-source verification

The relevant reference is **the effective installed X4 9.00** `libraries/md.xsd`, `libraries/common.xsd`, `libraries/scriptproperties.xml` and shipped MD/AI scripts, including relevant DLC/extension overrides. External references below are discovery aids; local installed sources and runtime results decide compatibility.

1. **There is no single universal MD event hook.** MD uses distinct `event_*` conditions, and each listener must be designed around the event source, payload and relevant scope. Egosoft MD guide: https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/
2. **Native file logging is supported** via `debug_to_file`, conditional on launching X4 with `-scriptlogfiles`. This is separate from `debug_text` / `-logfile` / `-debug scripts`. Candidate output lives under X4's *personal folder* `logs/<directory>/<name>`; validate real 9.00 append, naming, path safety, rotation, flushing and cross-restart semantics before assuming them. Reference: https://chemodun.github.io/x4/modding-support/running-x4-for-modding/#one-file-per-script--scriptlogfiles and command index https://chemodun.github.io/x4/modding-support/scripting-md-libraries-map/script-commands/

### Verified native file-output contract and limits (installed X4 9.00)

Qwen located the installed base `libraries/common.xsd:26000-26044`; Codex checked
those lines and the referenced `action` group at `:7199-7215`. The extract is
listed in the local source manifest as base `08.cat`, MD5
`de2c08eabd2f3e22d705ed473b7940ce`; its SHA-256 matched the manifest
(`8eec878511d06dd2be88a7054eb54556b29e481bf0feba20fe2cf3c6eabd3452`).
The schema requires `text` and `name`. `name` permits `.txt`, `.csv`, `.log`
and `.xml`; another extension gets `.txt` appended. Optional `directory` is a
subdirectory of the personal-folder `logs` directory. Optional `append`
defaults to true; `output` defaults to false and, if enabled, also sends text
to regular script debug output. File output requires X4 to have been started
with `-scriptlogfiles`. The inherited `chance` action attribute can skip an
action, so the recorder design must omit it or fix it to full execution.

No result/status attribute, flush action, rotation action, file-size query or
launch-flag query is specified by this `debug_to_file` schema element. This is
a **bounded source finding**, not proof that no other engine or UI capability
exists. In particular, an MD call can count as a *write attempt* only; neither
the call nor a separate diagnostic call confirms bytes reached disk. A missing
launch flag or full disk can also prevent the diagnostic stream from being
written. An installer/readiness procedure must check the launch option and
actual file appearance outside the MD write itself; a later owner-authorised
live test must establish what failure is visible and whether append, flush,
ordering, path handling and reopen behaviour match the schema description.
Do not overwrite a prior run at startup while those semantics remain unknown.
3. **Event-source groups exist.** The schema reference describes an `object` or `group` selector for object events and says group membership may be added/removed while the listener remains active. Candidate helpers: `create_group`, `add_to_group`, `remove_from_group`, optionally `add_to_group replace="true"`; verify exact syntax, object lifetimes and listener re-registration/reload semantics against installed sources. Reference: https://chemodun.github.io/x4/modding-support/scripting-md-libraries-map/script-commands/
4. **Dedicated player-owned event families exist**, for example `event_player_owned_attacked`, `event_player_owned_attacked_object`, `event_player_owned_collected_resource`, `event_player_owned_destroyed`, `event_player_owned_killed_object`, player-owned money and production events. Use them alongside scoped object listeners where valid; avoid treating identical incidents from two listeners as two distinct real-world events. Source: same script-command index. Egosoft breaking changes note that `event_player_owned_destroyed` and `event_player_owned_killed_object` began preceding `event_object_destroyed` in 6.00, which can matter when capturing still-available parent/crew relationships: https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Breaking%20Changes/
5. **NPC components and contextual NPC templates are distinct.** Existing PR #17 research reports `assignedaipilot`, `npctemplate`, contextual `people.{$Template}` and `roleentity.{$Template}` availability, but not permanent identity or lossless seed rendering. Some crew will not appear as instantiated NPC components. A component disappearing, a ship being destroyed or a matching displayed seed is **not** proof of a person's death or continuity. See PR #17 diagnostic notes and the private NPC research evidence index.
6. **PR #17 evidence is narrower than the gameplay account.** The owner's first-session run produced seven complete batches, then one after reload; **no direct destruction/transfer event batch** for the selected ship was captured. The owner did not perform observer dockings after the last transfer/destruction before save/reload. Its `<event_object_destroyed />` has no `object`/`group` selector; schema reference suggests one is needed, while examples elsewhere differ, so treat this as an **unverified hypothesis to check in the effective installed 9.00 schema and shipped usage**, not a proven cause of the missing record. See private `npc-representation/NPC_REPRESENTATION_CODEX_OBSERVATION_PROBE_REPORT.md` and PR #17.

## Desired coverage: progressively inventory and expand broad native event listeners

Qwen should progressively catalogue **all relevant `event_*` conditions** in the authorised installed 9.00 corpus while the separately approved broad implementation can advance. Codex should verify consequential syntax/source/applicability choices, but not require proving event usefulness in live gameplay before inclusion. Create a coverage register, with *exact event name; source and version/provenance; MD vs AI scope; source required (global/object/group/faction/etc.); event.object/param/param2/param3 types and lifetime; target relationship; when fired; known duplication; supported/unsupported; expected volume; live validation status*. **Do not pretend every event is observable with a single generic listener.**

Prioritise events involving **the player's property or personnel**, including other factions' objects when they participate in the same incident. Include:

- **Property lifecycle:** discovery/enrolment, acquisition/claims, owner change, construction, station modules, upgrades, renames if exposed, fleet/commander relationships, removal, destruction and kill source/method.
- **Combat and safety:** attacked/attacking, weapon activity, damage/shields/hull if exposed, collisions, boarding, surrender, repair, kills, distress/help signals, crew consequences where independently supported.
- **Movement:** orders queued/started/completed/cancelled/failed where exposed, sector/zone changes, travel, docking clearance/queue/start/success/abort/undock, following/formation.
- **Economy and logistics:** trades, purchases/sales, cargo changes, mining/resource collection, production start/finish/cancel, station accounts, build/storage, salvage/recycling.
- **People and interaction:** hire/fire, assignment/reassignment, post add/remove, pilot/manager/marine/service crew, transfer requests versus settled placement, NPC template/context changes, conversation initiation/end, rescue/boarding outcomes where exposed.
- **Other relevant player interactions and operational events:** reputation, player/faction relations, exploration, missions, alerts, subordinate changes and relevant station/fleet events.

A category is **an investigation request**, not evidence that X4 exposes an event for every example. Explicitly classify unavailable / unknown / needs snapshot / only exposed by AI script or Lua. Where no native event exists, propose clearly marked bounded state snapshots or other separately evaluated approaches; no invented event names.

## Capture and logging design requirements for Agent to plan

- Broad **dynamic membership** for player-owned ships/stations and appropriate subobjects; bootstrap after the correct game lifecycle point, then reconcile on ownership/new objects/loss, save/reload and periodically if necessary. Capture former ownership **at time of event**, not by testing only current ownership after a destruction. Include interactions with non-owned attackers, targets, dock hosts and trade partners.
- NPC coverage needs separate **component/role/post/template** observations and lightweight **crew-roster snapshots or diffs** at relevant events, with periodic reconciliation only if justified. Preserve uncertain correspondence. Do not claim that the `people` representation is stable, that an unavailable actor died, or that a numeric seed alone establishes permanent identity. Avoid forcing NPC instantiation just to log them unless the effect is independently understood and approved.
- Record **raw event provenance** as soon as safely available: schema/protocol version, X4 version/mod version, probe run ID, practical production session key with `UNAVAILABLE` explicitly allowed, sequence, game time where supported, capture/host time, exact event name, source and target object/ref/idcode/owner/class/sector where available, event parameters with **safe typed serialization**, result/availability states, and bounded relevant NPC/crew context. Preserve observed ordering; distinct events can still have uncertain causal order.
- Log **every selected occurrence by default**, rather than sampling away the evidence sought. Treat "as many as possible" as **wide useful observability**, not a guarantee of all engine internals. Do not create unbounded per-event whole-galaxy/whole-crew scans, a listener for every global NPC, or synchronous work that degrades gameplay. Prioritise broad event coverage and carefully measured overhead.
- Separate **raw append-only capture** from later parsing, enrichment, summarising and SQLite. Prefer native `debug_to_file` over dependency on a running general-debug-log reader, while keeping a fallback for missing `-scriptlogfiles`, file errors or incompatible command behaviour if Agent considers it useful. Do not change or reuse the existing production docking protocol/readers/SQLite schemas just to accommodate this experimental probe.
- Plan log **run/session segmentation**, start/stop/heartbeat markers, current watched-property counts, per-listener registration/coverage status, file-growth/capture diagnostics, **configurable diagnostic verbosity including OFF**, limits/rotation/archive and disk exhaustion behaviour. Recorder-controlled throttling and known drops must be visible and countable; report detectable errors and discontinuities. Engine events never delivered to a listener cannot be assumed detectable or countable. Native write-error reporting, launch-flag detection, flushing and disk-exhaustion observability require source investigation and live evidence; do not claim successful durable capture from a logging call alone. Analyse duplicate events without losing their original raw rows.
- Store raw logs and any local analysis extracts under ignored `local-data` or private game-profile paths; **never commit/publish raw logs, saves, names/fixtures, extracted vendor files or private paths**. Share only sanitised findings and precise LOCAL-ONLY evidence pointers. Consider secure retention and predictable clean-up.
- Keep this as an **optional, non-invasive diagnostic** using existing opt-in deployment/rollback safeguards. No automatic pilot moves, destructive gameplay, external telemetry, new permanent NPC IDs or production-save modifications to support collection.

## Listener isolation, runtime diagnostics and development performance policy (owner clarification 2026-10-17)

This expands the existing recorder integrity/heartbeat/error-reporting requirements instead of establishing a second competing system. **Owner priority in discovery/development is capturing evidence even if comprehensive diagnostics cause measurable performance overhead.** The overhead is expected, must be measured and described, and must not be disguised as negligible. Avoid freezes, runaway allocations, unbounded log growth or corruption; optimisation and sensible diagnostic defaults for release are later engineering decisions. **Diagnostic levels must remain configurable during development, including a genuine `OFF` level; the owner has not decided whether release users will have `OFF` or whether `ERROR` becomes the minimum selectable release level. Do not pre-decide that release policy.**

### Listener instances and event parameter isolation

**Installed-source check (X4 9.00, 17 October):** `libraries/md.xsd:4583-4589`
defines `namespace` and `instantiate`; `:1052-1078` says `this` uses the
current cue as namespace even for instances, while `static` shares the static
cue and the default inherits the parent namespace. The [Egosoft MD guide](https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/)
explains that an instantiated activation copies the cue and sub-cues, leaves
the static cue waiting, and removes a completed instance after its child
instances finish. These sources support a recurring, instance-local variable
design. They do **not** establish that every engine event is delivered, that
actions run in parallel, or that a copied variable remains a deep, immutable
copy of a mutable object. Qwen's focused answer inferred parallel execution
and every-event delivery beyond its cited schema lines; those inferences are
not adopted. The exact same-frame dispatch, event-expression lifetime and
shared-variable behaviour need a later isolated live check.

**Proposed pattern:** use an event-conditioned `instantiate="true"` listener
with `namespace="this"`; copy required event parameters and static-condition
results into instance-local values at the start of its actions, before any
delay or asynchronous work. Keep instance actions short and avoid permanent
waiting child cues. Put only deliberate aggregate counters in separately
named shared state. Audit every helper/library reference for inherited or
static namespace use. A copied component reference can later become
unavailable, so encode its available primitive observations promptly and
retain explicit unavailable states. This is a design proposal, not a tested
losslessness guarantee.

Community lead: UniTrader on Egosoft's `#x4_modding` Discord, 2026-10-17, recommends instantiated cues with independent namespaces for potentially high same-frame event counts. Treat as valuable *community advice*, not independent proof of lossless engine dispatch. The official Egosoft Mission Director Guide describes `instantiate="true"` and `namespace="this"` and warns about static-cue/condition-result variable pitfalls: https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Mission%20Director%20Guide/ . Installed X4 9.00 behaviour still needs targeted verification.

- **Proposed baseline:** use `instantiate="true"` for repeatable event listeners and `namespace="this"` for per-instance variables, where the installed sources support the pattern. The parent/static listener must remain able to accept subsequent matching events.
- Capture `event.object`, `event.param`, other relevant event payload fields and condition results **immediately into instance-local values**, with the correct type and validity guards, before later actions, delays, snapshots or asynchronous processing. Investigate which condition-derived values initially live in a shared/static namespace and could be overwritten by another event. Do not assume `namespace="this"` alone safely isolates every condition-result or event field.
- Avoid shared mutable per-event state; maintain separate, carefully controlled **aggregate** counters where necessary. Keep per-event instances short-lived and release them, avoiding leaked child cues. Prefer compact raw-event capture before expensive enrichment.
- Codex must verify actual syntax, payload lifetimes, variable copy semantics and instance cleanup in effective installed 9.00 MD sources with Qwen assisting source discovery. This is a design recommendation pending source/live confirmation, not an implementation order in the current phase.

### Two logical streams, one recorder

1. **Gameplay event stream:** every selected event occurrence, available guarded parameters, session/run correlation and required snapshots as already specified above. Diagnostic `OFF` **must not switch off ordinary event capture or any of the three mandated snapshot triggers**.
2. **Recorder diagnostic/error stream:** capture internal health and observable failures separately from gameplay records (separate native file if viable; otherwise reliably distinguishable record types/files determined by installed-source constraints). It records listener/instance problems, invalid or mixed parameters, malformed/incomplete rows, unexpected duplicate records, sequence/known capture gaps, recorder-controlled drops, abnormal workloads and any *observable* file/processing errors. Do not assume native MD can detect all write failures or undelivered engine events.

Diagnostic controls must support at least the semantic levels **`OFF`, `ERROR`, `WARNING`, `INFO`, `DEBUG`**, with `TRACE` optional if genuinely helpful. Levels are thresholds, not extra MD event families:

- `OFF`: no optional diagnostic collection or diagnostic file output; required gameplay event/snapshot capture remains active. If some non-optional safety indication cannot be disabled, document its precise scope and justification instead of calling the mode fully off.
- `ERROR`: observable recording failures, invalid/incomplete processing and integrity faults.
- `WARNING`: suspicious bursts, discontinuities, unexpected duplication and performance concerns.
- `INFO`: compact session start/stop/readiness and periodic recorder-health summaries.
- `DEBUG` (and optional `TRACE`): detailed internal counters/processing and investigation information, appropriate in discovery/development but not necessarily for normal release use.

Prefer lightweight counters and aggregated health summaries rather than a second diagnostic write for every successful event. Detailed exceptions/anomalies may be emitted when observed. **No diagnostic level may silently reduce the requested gameplay-event coverage**; sampling, capture rate limits or changes to event collection itself must be separately identified and justified. Diagnostic level selection should persist appropriately across launches if installed 9.00 exposes a safe supported mechanism; otherwise document an explicit lightweight configuration workflow. Avoid new external Node dependencies for this setting.

### Counting, errors and truthful health reporting

- Count events **that actually enter listeners**, preferably by event family. Where safe, track separately records prepared, native file writes *attempted*, any confirmed successful writes (only if confirmation exists), observable recorder-controlled drops, malformed rows and interruptions. Do not equate call invocation with durable storage.
- Investigate whether installed 9.00 MD exposes a reliable **frame identifier**. If yes, record per-frame arrivals and peak observed concurrency/load. If not, use explicitly labelled, defined processing or time windows. Never describe an approximate window as an exact frame or an unmeasured burst as a counted one.
- Preserve practical session/run and sequence provenance in both streams. Counter/sequence continuity establishes only recorder-observed continuity; it cannot establish that no engine events were missed before listener delivery.
- Use existing heartbeat requirements for health summaries with a **configurable** interval; approximately 60 seconds is a starting *candidate*, not a fixed contract. Example conceptual fields: `received`, `prepared`, `writes_attempted`, `writes_confirmed=UNAVAILABLE`, `known_errors`, `incomplete`, `peak_per_frame=UNAVAILABLE`, `status=NO_DETECTED_ERRORS`. These are proposed fields, not evidence of available X4 counters. `NO_DETECTED_ERRORS` means exactly that, **never** proven lossless capture.
- When an anomaly is observable, record event type, timing/window, appropriate context, listener identity, observed workload and reason if safe and supported. Fail gracefully if the diagnostic output itself is unavailable; a full disk might prevent writing either stream. Retention, log sizes and cleanup remain subject to existing privacy and resource rules.

### Verification strategy and phase boundaries

Prioritise genuine gameplay observations, including naturally busy periods, with reproducible offline error investigations. Qwen analyses large **local/offline** records using streaming, indexing and bounded source slices; Codex checks material findings against originals. **Do not set fixed synthetic burst sizes (10/100/500/1,000) as test requirements** or presume the owner can control natural engine event frequency. Codex may *investigate* whether an isolated synthetic MD signal generator is practical if it answers a specific outstanding question, but any later test and gameplay action require the existing approvals.

Keep three distinct questions explicit: **delivery** (events emitted by X4 vs actually reaching listeners, often unobservable), **isolation** (each delivered event retains the correct payload), and **persistence** (completed records reach storage, which may have unobservable durability limits). High-volume capture must not be claimed guaranteed lossless based on either documentation or diagnostic counters alone.

**Development-versus-release trade-off:** substantial instrumentation and resulting performance cost are acceptable during the present *discovery/development* phase, provided impact and bottlenecks are measured and the game remains usable. Later deployments must offer user-selectable diagnostic verbosity without disabling ordinary event capture. `OFF` remains a functional development/configuration option that fully disables optional diagnostic/error/health output; whether it is exposed in release or `ERROR` becomes the minimum remains an explicit **owner decision**. Agent decides performance budgets and release defaults from evidence rather than imposing an arbitrary low-overhead cap on exploratory work.

This addition **does not authorise implementation, deployment, owner live tests or merge**. It supplies source-verification and design requirements for the active Agent-directed PR #18 research task, keeps the existing production docking reader and SQLite untouched, and does not revive PR #17's docking-based matrix.

## Qwen research and high-volume log analysis

The standing 2026-10-16 workflow remains in force: **Codex asks one focused technical question → Qwen broadly reads authorised local source → exact references and uncertainty → Codex verifies consequential points → Agent-guided design or authorised implementation.** Do not impose new Qwen depth, turn-count, packet-format or per-read-approval rules.

**Additional owner preference for this workstream:** after capture, **Qwen should handle the large offline log corpus** to discover event types, surprising patterns, correlations, duplicates, missing coverage, possible NPC representation changes and suggested focused experiments. Use local file search/indexing, streaming/chunking and structured aggregation before giving Qwen relevant bounded windows; do not pretend a model can reliably reason over infinite/unfiltered text or require Agent/Codex to ingest whole logs. Persist query provenance (file hashes, session/run markers, line/byte offsets, filters), reproducible aggregates and confidence/unknowns. Codex validates claims against exact slices, not whole corpora.

Existing Qwen development-research-only limits **remain**: no unapproved new raw-log corpus access or expansion of manifest grants; Agent must decide the appropriately bounded local access mechanism and owner approval for any expanded permission; no model write/shell/Git/deployment access; do offline resource-heavy analysis **after X4 is closed**, not concurrent GPU-heavy gameplay on the 16 GB RTX 5080. This does not authorise a gameplay Qwen integration.

Potential initial focused Qwen questions for Codex to ask (Agent may revise):
1. Enumerate all installed 9.00 MD `event_*` conditions relevant to owned property/NPCs, their required attributes and payload types, with precise schema locations.
2. Determine native `debug_to_file` parameter requirements, append/flush/size/failure/filename behaviour and how to achieve safe session/run separation, with source evidence.
3. Determine dynamic group subscription/update behaviour and global player-owned event ordering around creation, ownership changes and destruction, including lifecycle/reload.
4. Determine NPC component/template crew enumeration and relevant changes without unsafe instantiation or claiming stable person identity.
5. Identify performance/duplication hotspots and missing MD coverage that might justify bounded snapshots or a later Lua/AI source.

## Required next Agent output, not ordered implementation

Agent should read current implementation main and draft PR #17, reconcile the private NPC handoff and prior live evidence, then plan an appropriately staged **broad-capture diagnostic** and Codex/Qwen research tasks. Plan coverage validation, local log architecture and low-impact gameplay checks **in place of PR #17's old five-stage matrix**, with explicit unknowns and stop conditions.

No code, game deployment, owner-run live test, merge, cleanup of old local evidence, or production change is executed or implicitly authorised by this research note. Static/schema tests and later **new** owner-approved narrow capture smoke checks remain appropriate; only the **old specific PR #17 scenario plan** is superseded.
