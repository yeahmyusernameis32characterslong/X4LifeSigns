# Disposable four-entity NPC observation probe

This optional X4 9.00 diagnostic observes **Ship A, Ship B, Station S and original person anchor P1** through owner-controlled actions. It is an experiment in NPC representations and relationships, not a person-identity resolver. It writes `LIFESIGNS_NPC_OBS_V1` lines to the X4 debug log. The production Node reader ignores that prefix; no production session, database or docking format changes are involved.

The tracked XML is a fixture-free template. The local renderer takes an ignored `local-data/npc-observation/fixture.local.json` containing a source-save SHA-256, distinct `shipA.idcode`, `shipB.idcode`, `station.idcode`, and `person.uiName`. The ship and station codes are **selection clues within this save**, not asserted permanent identity keys. The rendered XML stays in ignored local data. Do not commit or share the local worksheet, rendered XML, debug log or save.

## Before deployment

1. Confirm the selected A/B/S/P1 fixture through the normal game UI and keep its codes in the ignored local worksheet. The owner has selected one exact Ship B; no ambiguity remains in the current local fixture.
2. Run `node scripts/render-npc-observation.mjs`. It refuses missing provenance, duplicate or malformed codes, and unsafe person names.
3. Validate the rendered XML against the **effective installed X4 9.00** `md.xsd` and `common.xsd`. Static validation does not prove runtime MD behaviour.
4. Start from a disposable save with P1 assigned as Ship A's AI pilot. The diagnostic freezes its first enrolment attempt. If enrolment fails, correct the fixture or initial conditions and reload a save made before that attempt. Do not treat a failed attempt as an ongoing lookup.

The probe enumerates player-owned ships and stations, requires exactly one match for each code, and captures the currently assigned AI pilot on A only when its displayed name matches the local fixture. It retains the three selected object references, original NPC component reference and original raw template. It never changes those anchors or automatically recovers a person by name, seed, role, crew position or location. A new occupant of P1's former post is a **negative control**.

## Owner-run commands (after separate deployment approval)

Use a PowerShell terminal from the repository root. Replace `<X4 game folder>` with the installed game directory. Do not put the private path into a report or PR.

```powershell
$gameFolder = '<X4 game folder>'
node scripts/render-npc-observation.mjs
$probeXml = (Resolve-Path -LiteralPath 'local-data/npc-observation/generated/LifeSigns_NpcObservationDiagnostic.xml').Path
./scripts/deploy-bridge-probe.ps1 -GamePath $gameFolder -NpcObservationDiagnostic -NpcObservationSourcePath $probeXml -WhatIf
./scripts/deploy-bridge-probe.ps1 -GamePath $gameFolder -NpcObservationDiagnostic -NpcObservationSourcePath $probeXml
```

To remove it after the game is stopped:

```powershell
./scripts/deploy-bridge-probe.ps1 -GamePath $gameFolder -RemoveNpcObservationDiagnostic
```

If another optional diagnostic is installed, explicitly select its retain or remove switch in either command. The deployer refuses unrelated extension content and linked targets. The normal bridge remains installed on probe removal.

## Live acceptance matrix

For every stage, retain the debug log locally, group lines by `session` and `seq`, and record the game UI state and elapsed time. Each ordinary batch has one anchor, three contextual entries, three current post occupants and begin/end markers. A guarded conversation adds a `selection` row **inside the same batch**. `trigger` says why the snapshot was taken; an assignment request or control-event trigger is **not** proof that a transfer finished.

Use one separate player-controlled **observer ship**, distinct from A and B. Dock it at the same convenient dock after each stage to trigger an `OBSERVER_DOCK` snapshot. This does not require the owner to pilot A or B, move P1, or take P1's post. The first eligible observer docking both attempts enrolment and, if successful, records the baseline batch. After any transfer, wait until the game UI shows the settled assignment, then repeat that observer docking; record any earlier event-triggered batches as intermediate states. If a normal UI action is unavailable, mark that row inconclusive rather than forcing an assignment.

| Stage | Owner action | Check |
| --- | --- | --- |
| Baseline | Load a disposable pre-attempt save with P1 on A; dock the separate observer ship. | Exactly one complete enrolment and a same-docking `OBSERVER_DOCK` batch; A/B/S refs, original P1 and raw template retained. |
| Captain → service | Demote P1 from A's captain/pilot post to A service crew through the normal UI; after settling, dock the observer. | Original anchor, contextual service entry and current pilot occupant are recorded separately. |
| Service → captain | Promote P1 back to A's captain/pilot post; after settling, dock the observer. | Compare component equality, role/post and contextual entry to the pre-promotion batch. |
| Service → marine → service | Change P1 through each supported crew role on A, docking the observer after each settled UI state. | Each role is recorded as a separate observation; unsupported transitions remain inconclusive. |
| Transfer plus promotion/demotion | Move P1 A → B, promote to B captain where supported, demote to B service, then transfer B → A. Dock the observer after each settled UI state. | Retained P1 ref, raw-template entry, component/entry seed text, role, post and locations are separate; missing refs are explicit. |
| Station | Assign P1 to S manager where the UI allows, then return P1 to ship service. | S manager post and A/B posts reflect settled UI; a failed or unsupported assignment is labelled inconclusive. |
| Negative control | Put a **different person chosen through the normal UI** in P1's former post, then dock the observer. | Occupant is `NO` for original component equality. Do not call the occupant P1 because of the post, name or seed. |
| **Representation turnover** | Dock the observer before a controlled P1 conversation; converse through the normal UI; dock the observer again afterward. Repeat following an ordinary uninstantiated/contextual interval where possible. | Compare before/conversation/after batches, including original-anchor state, fresh component/template equality, role/post, context/assignment/location and seed text. **If no turnover is observed, this mandatory identity question remains inconclusive.** |
| Unchanged reload | Save an enrolled state, reload the same save without changing jobs, then dock the observer twice. | Compare the unchanged repeated batches and record whether refs/context survive. |
| Full process restart | Exit X4 completely, restart, load that same enrolled save and dock the observer. | Record fresh session correlation and reference/context availability; do not infer universe ancestry from the production session key. |
| Rollback | Load a save before one change and repeat an observation. | Separate timelines/sessions in analysis; do not combine them into one person history. |

An optional destructive scenario can send B into combat and allow its destruction **only after a separate owner choice**. Object destruction or `exists=false` records an unavailable component or object; it is not proof of P1's death. This scenario is not needed for the non-destructive acceptance stages.

## Reading the result

`anchor` is the originally retained component. `context` is a raw-template entry on A, B or S and may exist without an instantiated component. `post` is the current occupant of a specified post, which may be a different person. `selection` is a guarded conversation observation inside the same `session`/`seq` batch; it is not silently attributed to P1. Fresh role/post and role-object, assignment and container labels are separate from the original anchor. Component equality, template equality and seed correspondence are observations only. `MISSING_REFERENCE`, `OUT_OF_GRAPH`, `ABSENT`, and `VACANT_OR_UNAVAILABLE` are distinct states, none of which means death.

X4 9.00 source declares component and contextual seeds as `largeint`, and shipped code renders contextual seed with `%s`, but static evidence does not establish that every large seed prints losslessly. The log marks `seed_render=UNVERIFIED`. In the live check, compare one known fixture seed's exact decimal text in the debug line against an independent read of the same save, including all digits and sign; repeat for component and contextual entry if both occur. If either differs or is unavailable, do not use logged seed text as an identity key. The static sources also do not prove that contextual lookup can never instantiate or replace a component; the live turnover stage must record this behaviour.

This document defines an owner-run test only. This PR does not deploy, start X4, or claim live acceptance.
