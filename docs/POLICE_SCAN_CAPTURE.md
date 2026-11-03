# Player-owned police inspection history

Implemented on `feat/police-scan-context`, based on main759fcd6.
**Not deployed or tested in gameplay.** Player2 work remains ceased and separate.

## Existing coverage and gap

The installed recorder already has `SCANNED_OBJECT` and `WAS_SCANNED` from
`event_scan_finished`. X4 9.00 common.xsd:16597–16607 describes a completed deep
scan and identifies scanner versus scanned object; it does not supply police
inspection mode or findings. Those hooks are retained.

The standard ship police routine in `aiscripts/order.move.recon.xml` performs
a timed inspection and evaluates cargo/pilot-inventory flags. Its source provides
a more precise observation point for police work than assuming every inventory
inspection produces the existing deep-scan callback.

## Added events

| Event | Meaning | Additional observations |
| --- | --- | --- |
| `POLICE_SCAN_STARTED` | A player-owned police ship initialised an inspection timer | Scanner/target identities, game time, police faction; mode undetermined and findings not yet evaluated |
| `POLICE_SCAN_RESULT` | The police routine reached its detection-result point | Configured cargo-only or cargo-plus-pilot-inventory mode; cargo and combined illegal-finding flags; trouble flag and permission to attack at that point |
| `POLICE_RESPONSE_REQUESTED` | The sector received the game's police-response signal naming a player-owned officer and target | Officer as subject, suspect as other; reason not provided, execution not established |

The usual ship seed, ID code, display name, faction, sector, session and game time
identify the participants. The observations do not create NPC profiles or infer
that an NPC personally witnessed the scan. Existing time-valid personnel links
can relate the officer's ship history to its captain.

### Interpret outcomes carefully

- `DETECTED` and `NO_DETECTION_REPORTED` reproduce the routine's actual flags.
  A negative observation is **not proof of a clean inventory**: detection can
  depend on concealment and reporting chance. Cargo and combined flags can differ.
- Mode records the routine's configuration, not proof that every cargo hold and
  pilot inventory getter was evaluated. Short-circuiting and unavailable pilots
  can affect evaluation. Exact wares and quantities are not collected.
- The trouble flag can reflect several causes. It is not labelled deliberate
  defiance, contraband or aggression without further supporting events.
- A start without a result does not prove completion or a specific failure.
  These records have no new persistent attempt identifier; correlate by current
  run, scanner/target and sequence without inventing missing steps.
- A police response request is distinct from an executed attack or a first shot.
  Existing attack/distress/order records provide the subsequent observations.

## Implementation and performance

Two small X4 XML diff additions observe the standard `order.move.recon` routine:

1. After a new scan timer is initialised, send one guarded self-signal.
2. After the routine computes its findings, immediately before clearing its
   cargo finding flag, send a result self-signal containing existing flags.

Both require a player-owned scanner. No game variables, detection probabilities,
orders, relations or target responses are changed. There is no inventory
enumeration, extra detection roll, polling or per-hit work. The recorder writes
one start and one result for a completed standard inspection, plus a response
request if the game emits it. Interrupted/restarted inspections may differ.

The MD listener checks owned scanner, packet shape, phase and numeric flags;
normal load/session readiness still gates writing. Non-player police observations
are discarded. New listener definitions are appended, preserving all existing
saved cue indices. SQLite schema and save ancestry handling are unchanged.

This observes the standard ship routine. It does not claim coverage of independent
mass-traffic, mod-replaced AI routines or every player-specific police conversation.
Conflicting AI modifications require their own compatibility check before use.

## Source verification and research

Source locations in the authorised X4 9.00 corpus:

- common.xsd:16597–16607: generic deep-scan semantics/direction.
- common.xsd:14614–14625: custom object-signal payload semantics.
- order.move.recon.xml:1122–1134: scan timer initialisation;
  1137–1153: police halt and cargo/inventory interaction context.
- order.move.recon.xml:1445–1456: existing detection flags, concealment/reporting
  chance and combined finding;1554–1555: flag/mode cleanup.
- order.move.recon.xml:1584–1588: distress and sector police-response signal,
  target in param2 and officer ship in param3.

Qwen27B independently located/read the relevant schema and police scripts. Its
two final-answer attempts ended incomplete; original journals are preserved.
No completed Qwen conclusion or capability-absence claim is inferred. Codex
verified the consequential locations directly and checked source bytes against
the current installed game's catalogue hashes. Raw game source stays local.

## Verification

- **93 recorder tests passed**, including four new police tests for participant
  direction, no cargo/personnel reads, literal detection states, malformed data,
  non-player exclusion, stale-load suppression and observation-only patch shape.
- **15 store/history tests passed** after installing the existing locked profile
  dependencies without scripts. The first run lacked `saxes`; that environmental
  failure is retained separately rather than called a passing run.
- Generated MD passes the existing hash-checked installed X4 9.00 schema gate.
- `validate-police-scan.ps1` verifies exact base-script/schema hashes, applies
  both diff additions in memory, requires each selector to match once, validates
  original and modified AI XML, removes the additions and confirms the original
  actions are unchanged. No patched game source is written or redistributed.
- Build freshness, listener-order and diff checks passed. No deployment, game
  launch, production database mutation or merge.

Reproduce schema checks with local, privately extracted X4 source placeholders:

```powershell
node scripts/build-event-recorder.mjs
node --test recorder/test/*.test.mjs
npm ci --ignore-scripts --prefix profiles
node --test profiles/test/store.test.mjs profiles/test/history-store.test.mjs
powershell -NoProfile -File scripts/validate-event-recorder.ps1 -SchemaDirectory <X4-libraries>
powershell -NoProfile -File scripts/validate-police-scan.ps1 -SchemaDirectory <X4-libraries> -SourceFile <X4-order.move.recon.xml>
```

Native signal delivery, actual policing coverage and performance still require
a separately approved deployment/gameplay test. These additions cannot recover
the missing inspection findings from earlier sessions.
