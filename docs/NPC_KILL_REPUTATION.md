# NPC ship kill reputation

## Scope and status

The owner authorises implementation and deployment of **reputation-only** credit
for player-owned NPC-controlled ships. This separate optional extension does not
add bounty payments, assists, damage tracking or historical compensation.

**Implemented; automated/source-contract/schema checks pass. Native X4 acceptance
is pending the owner's test.** The deployed recorder/companion and its SQLite
schemas are not changed by this feature.

Source baseline: `70c7628e61b5e1ed68bd3b7a32621a0a9447806f`
(`feat/trade-transaction-capture`, draft PR23). Work is isolated on
`feat/npc-kill-reputation`; no merge or automated gameplay is authorised.

[Enhanced Kill Credit](https://www.nexusmods.com/x4foundations/mods/2033) is the
functional reference. Its author requires permission for file modification and
asset reuse. No EKC code/assets are copied, modified or redistributed here. This
implementation is independently based on the installed X4 9.00 source.

## Behaviour

- One native `event_player_owned_killed_object` listener handles future kills.
  Its killer is `event.param`, victim is `event.param2`.
- Eligible killers are player-owned S/M/L/XL ships, excluding `player.controlled`.
  Merely standing aboard an NPC-piloted ship does not make it a personal kill.
  Stations, deployables, XS craft and subcomponent victims are outside this scope.
- Whole victim objects must have a foreign, non-ownerless owner, permit relation
  changes, not be visitors, and have a positive native kill-faction bonus.
- The recipient is the nearest qualifying foreign protective station in the
  killer's sector, within **30 km of the killer and the station's radar range**.
  Its faction must regard the victim's faction as an enemy, not be relation-locked,
  and have an eligible trade NPC. A single station is selected per kill.
- Being somewhere in a faction's sector alone does not qualify. The player need
  not be present; station distance is evaluated against the NPC killer.
- The request uses native `md.Notifications.AccumulateRewards` with
  `giveReputation=true`, `giveBounty=false`, **`alreadyGaveBounty=true`**. The last
  flag deliberately suppresses the native one-third fallback bounty; false/null
  would still pay money. Existing legitimate native bounties are preserved.
- Native code obtains the victim-dependent bonus and handles accumulation and
  negative-relation scaling. No fixed bonus or custom relation calculation is used.
- Native reward queues must already be initialised as lists. Otherwise the event
  is ignored rather than writing incompatible native state. No load replay,
  polling, full-asset scan or extension-owned reward queue is introduced.

The native queue starts with a 45-second accumulation delay and a 10-minute
accumulation window; conversation/full-screen-menu conditions can postpone
application further. An immediate UI reputation change is not promised. With
script debugging enabled, `[LifeSignsNpcKillReputation] reputation queued` means
requested, **not yet awarded**.

This reuses the native nearby-station selection and positive award path, extending
the reference point to the NPC ship. It does not invoke or reproduce the native
negative attack/retaliation bookkeeping. Existing reputation losses continue.

## Source verification

Installed X4 9.00 primary sources (paths refer to the owner's extracted game):

| Reference | Verified consequence |
| --- | --- |
| `libraries/common.xsd:15899-15910` | Owned-kill event includes personal kills; killer/victim payload positions. |
| `md/rml_destroy_rarelyonsight.xml:238-254` | Shipped consumer confirms personal kills also trigger and victim is param2. |
| `md/notifications.xml:1713-1730` | Native victim ownership, relation-disabled, visitor and whole-object gates. |
| `md/notifications.xml:2168-2191` | Nearby protective-station selection, radar and locked-relation checks. |
| `md/notifications.xml:2262-2313` | Native bonus, accumulation and both bounty branches; sixth=true suppresses fallback. |
| `md/notifications.xml:2373-2409` | Native reputation application, negative scaling and money-transfer guard. |
| `md/notifications.xml:1474-1486` | Native reward-list initialisation. |

The base source, MD/common schemas and script properties were byte-compared with
current installed catalogue entries and their indexed MD5 values. The installed
Timelines notifications diff was also inspected; it changes other notification
conditions, not the reward cues used here. Local hashes/provenance remain private.

## Validation

```powershell
npm.cmd --prefix recorder test
node --test profiles/test/*.test.mjs
npm.cmd --prefix bridge test
powershell.exe -NoProfile -File scripts/validate-npc-kill-reputation.ps1 -SchemaDirectory <native-source>/libraries
node scripts/check-npc-reputation-native.mjs <native-source>
```

Results at implementation: **89 recorder + 38 profile = 127 Node tests**, and
**112 bridge tests**, all pass without skips. The nine new focused checks execute
actual extension actions with synthetic native query/callback boundaries.

The native-contract check reads hash-pinned `notifications.xml` directly; it does
not distribute vendor source. In the synthetic interpreter it executes the real
native accumulation/application actions, verifies positive and negative reputation
handling, no additional money and preservation of an existing bounty, and detects
the unsafe one-third fallback when the suppression flag is wrong.

The new MD passes hash-pinned X4 9.00 MD/common schema validation. The content
manifest is XML/identity/version checked; no UI addon is introduced. These checks
do not reproduce engine scheduling, reference lifetimes, attribution or native
cue activation. Qwen's final focused review found no concrete blocker; earlier
incomplete/output-limited research and corrected errors remain in local evidence.

## Installation, compatibility and owner test

Install only `extensions/lifesigns_npc_kill_reputation` into the game's extensions
folder while X4 is closed. It is independently optional (`save=0`) and requires no
SQLite service, recorder, Lua or Mod Support APIs to award reputation. Existing
saves can receive future qualifying kill events; no earlier kills are replayed.

Do not combine with EKC, Better Kill Credit or another extension granting NPC kill
reputation. Deployment checks currently installed manifests for known overlapping
kill-credit features and checks effective native reward-source overrides. This is
not an exhaustive runtime mod-conflict detector. Future game updates or relevant
mods require source/contract revalidation.

For the owner's test, allow an NPC-controlled player ship to defeat a qualifying
enemy near an eligible station, preferably with the player elsewhere. Check the
queued diagnostic and eventual native reputation change after the native delay.
Personal kills should retain vanilla behaviour, and this component should add no
credits. Turret/missile attribution, off-screen kills, native queue availability,
save/reload timing and performance remain acceptance points for that test. No
native completeness or measured performance guarantee follows from static checks.
