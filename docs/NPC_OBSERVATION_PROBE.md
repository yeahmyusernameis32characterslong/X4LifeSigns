# Disposable four-entity NPC observation probe

This optional X4 9.00 diagnostic observes **Ship A, Ship B, Station S and original person anchor P1** through owner-controlled actions. It is an experiment in NPC representations and relationships, not a person-identity resolver. It writes `LIFESIGNS_NPC_OBS_V1` lines to the X4 debug log. The production Node reader ignores that prefix; no production session, database or docking format changes are involved.

The tracked XML is a fixture-free template. The local renderer takes an ignored `local-data/npc-observation/fixture.local.json` containing a source-save SHA-256, distinct `shipA.idcode`, `shipB.idcode`, `station.idcode`, and `person.uiName`. The ship and station codes are **selection clues within this save**, not asserted permanent identity keys. The rendered XML stays in ignored local data. Do not commit or share the local worksheet, rendered XML, debug log or save.

## Before deployment

1. Resolve any ambiguous fixture through the normal game UI, then record the selected code in the local worksheet. In particular, select one exact Ship B; a description such as “destroyer 1” alone is insufficient when several destroyers match.
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

For every stage, retain the debug log locally, group lines by `session` and `seq`, and record the game UI state and elapsed time. Each batch has one anchor, three contextual entries, three current post occupants and begin/end markers. `trigger` says why the snapshot was taken; an assignment request or control-event trigger is **not** proof that a transfer finished. Wait for the UI to settle and take further observations after asynchronous transfer/cleanup. To obtain another passive docking observation, personally control a selected ship and dock it where practical.

| Stage | Owner action | Check |
| --- | --- | --- |
| Baseline | Load a disposable pre-attempt save; with P1 on A, dock the personally controlled ship. | Exactly one complete enrolment; A/B/S refs and original P1 anchor retained; batch readable. |
| Role change | Change P1 between supported crew role and pilot post, including promotion and demotion through the normal UI. | Old and new observations remain separate; post occupants and contextual roles agree with UI after settling. |
| Ship transfer | Move P1 A → B and later B → A. | Retained P1 ref, raw-template entry, component/entry seed text and current posts are recorded separately; missing refs are explicit. |
| Station | Assign P1 to S manager where the UI allows, then return P1 to ship service. | S manager post and A/B posts reflect settled UI; a failed or unsupported assignment is labelled inconclusive. |
| Negative control | Put a **different person chosen through the normal UI** in P1's former post. | Occupant is `NO` for original component equality. Do not call the occupant P1 because of the post, name or seed. |
| **Representation turnover** | Through ordinary gameplay, observe a fresh representation for P1 after an uninstantiated/contextual interval or controlled conversation. | Record the original-anchor state, fresh component equality, raw-template equality and seed text in the same stage. **If no turnover is observed, this mandatory identity question remains inconclusive.** |
| Save/reload | Save, reload and repeat baseline observation without changing the fixture. | Record whether references and contextual entries survive or become unavailable; do not infer ancestry from the production session key. |
| Rollback | Load a save before one change and repeat an observation. | Separate timelines/sessions in analysis; do not combine them into one person history. |

An optional destructive scenario can send B into combat and allow its destruction **only after a separate owner choice**. Object destruction or `exists=false` records an unavailable component or object; it is not proof of P1's death. This scenario is not needed for the non-destructive acceptance stages.

## Reading the result

`anchor` is the originally retained component. `context` is a raw-template entry on A, B or S and may exist without an instantiated component. `post` is the current occupant of a specified post, which may be a different person. `selection` is a guarded conversation observation; it is not silently attributed to P1. Component equality, template equality and seed correspondence are reported as observations only. `MISSING_REFERENCE`, `OUT_OF_GRAPH`, `ABSENT`, and `VACANT_OR_UNAVAILABLE` are distinct states, none of which means death.

X4 9.00 source declares component and contextual seeds as `largeint`, and shipped code renders contextual seed with `%s`, but static evidence does not establish that every large seed prints losslessly. The log marks `seed_render=UNVERIFIED`. In the live check, compare one known fixture seed's exact decimal text in the debug line against an independent read of the same save, including all digits and sign; repeat for component and contextual entry if both occur. If either differs or is unavailable, do not use logged seed text as an identity key. The static sources also do not prove that contextual lookup can never instantiate or replace a component; the live turnover stage must record this behaviour.

This document defines an owner-run test only. This PR does not deploy, start X4, or claim live acceptance.
