<a name="x4lifesigns-top"></a>

<div align="center">

# X4: LIFE SIGNS

### Make the universe remember you.

<img src="assets/x4lifesigns-poster.png" alt="X4: Life Signs poster" width="900">

<br>

**An experimental X4: Foundations mod that gives the universe memory, personality, and a sense that its people actually live there.**
*Developed with Codex 6.1 Sol-Medium, 6 Astra and Qwen3.8 27b-4k*

</div>

---

## What Is Life Signs?

**X4LifeSigns** is an experimental project for **X4: Foundations** that aims to give its inhabitants persistent memories and the ability to engage in natural, meaningful conversations shaped by their experiences in the game.

X4 simulates an extraordinarily complex universe where thousands of ships operate independently, economies evolve, factions compete, and battles unfold whether the player is there to witness them or not. Yet the people inhabiting this universe have little awareness of their own histories. Life Signs aims to change that by recording what happens to characters, ships and stations, allowing NPCs to remember and discuss the events that have shaped their lives.

A pilot might recall being rescued from hostile territory, a trader could remember repeated encounters with the player, and a veteran captain might recount the battles and campaigns they have survived. More importantly, their knowledge would extend beyond personal experiences. Fleet commanders could draw upon reports from subordinate captains to explain military operations, unexpected losses or diplomatic incidents that occurred while the player was occupied elsewhere. They could even offer strategic recommendations, advising whether to continue an offensive, withdraw from a deteriorating situation or redeploy their forces.

**Knowledge is not universal.** A fighter pilot, station manager and fleet commander each have different experiences, responsibilities and access to information. Characters may have incomplete knowledge, disagree about events or reach different conclusions. Their conversations should reflect what they could reasonably know, rather than giving every NPC unrestricted awareness of the entire universe.

Early offline experiments using recorded X4 gameplay and local language models have already demonstrated the potential of this approach. Simulated captains and fleet commanders have discussed actual recorded engagements, investigated disputed incidents and provided accounts informed by their individual histories and command relationships. These experiments are not yet integrated into live gameplay, but they offer an encouraging demonstration of how the system could work.

Ultimately, Life Signs is about making X4's inhabitants feel like individuals who genuinely exist within its universe, with experiences worth remembering, stories worth telling and perspectives worth hearing.

**X4 creates the events. Life Signs preserves the history. Its people give that history a voice.**

---

## How It Works

The proposed wider system connects X4 game events to a local Node.js application, with SQLite keeping the history. Language models and an indexing tool could then turn that context into natural responses through lightweight text-to-speech AI.

Most interaction is intended to run locally, with voice allowing players and characters to speak naturally. **Aria** is being explored as a richer persistent character, potentially using ChatGPT for deeper conversations and a stronger individual personality.

<div align="center">
  <img src="assets/x4lifesigns-how-it-works.png" alt="Proposed wider X4LifeSigns system" width="100%">
</div>

The diagram shows the intended design. The working experiments are described below; the detailed technology choices and boundaries are in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Project Status

The **X4 Event Collector** is developed and has passed owner-run tests in X4 9.00. It gathers profiles of player-owned ships, stations and NPCs, together with selected events that describe what happens to them, including combat activity and trading. The collector also recognises different playthroughs and saved checkpoints within a universe. Event coverage is still growing; newer combat and trade subscriptions have not all been verified in live gameplay. The project remains experimental, with no public playable release.

Development is now focused on the **SQLite database** that preserves these profiles and events as a history the characters can draw upon. Save-aware storage and event history have already passed live tests. In separate offline experiments, the local **Qwen3.8 27B** model used histories retrieved from SQLite to simulate captains and fleet commanders with distinct memories and access to reports from their subordinates. Those conversations demonstrated what event-grounded NPC dialogue could become, but are not yet available during gameplay. See the [SQLite integration results](docs/SQLITE_PROFILE_COMPLETION.md) and [offline NPC inquiry](docs/OFFLINE_ARIA_INQUIRY.md).

Life Signs keeps different playthroughs apart using a saved **universe identifier**, with a separate database for each universe. Within that database, **save checkpoints** work like bookmarks in a story: when you load an earlier save, Life Signs can follow the history belonging to that save rather than treat events from an abandoned future as though they happened. History shared with later saves remains available, even if an older save slot has since been overwritten.

**Database housekeeping** is the subject of [PR #25](https://github.com/yeahmyusernameis32characterslong/X4LifeSigns/pull/25). It is currently a design-stage investigation into how players could review their databases and safely clean up unused histories without losing anything needed by surviving saves; no automatic cleanup has been implemented.

<table align="center" width="50%">
  <thead>
  <tr>
    <th width="420">Milestone</th>
    <th width="180">Status</th>
  </tr>
</thead>
  <tbody>
    <tr><td valign="middle">X4 Event Collector</td><td align="center" valign="middle"><img src="assets/status-implemented.png" alt="Implemented" width="120"></td></tr>
    <tr><td valign="middle">SQLite Database</td><td align="center" valign="middle"><img src="assets/status-in-progress.png" alt="In Progress" width="120"></td></tr>
    <tr><td valign="middle">Return path to X4</td><td align="center" valign="middle"><img src="assets/status-planned.png" alt="Planned" width="120"></td></tr>
    <tr><td valign="middle">Local LLM integration</td><td align="center" valign="middle"><img src="assets/status-exploring.png" alt="Exploring" width="120"></td></tr>
    <tr><td valign="middle">Voice input and output</td><td align="center" valign="middle"><img src="assets/status-exploring.png" alt="Exploring" width="120"></td></tr>
    <tr><td valign="middle">Aria</td><td align="center" valign="middle"><img src="assets/status-exploring.png" alt="Exploring" width="120"></td></tr>
  </tbody>
</table>

---

## Project Structure

<table align="center" width="50%">
  <thead>
  <tr>
    <th width="180">Path</th>
    <th width="420">Purpose</th>
  </tr>
</thead>
  <tbody>
    <tr><td valign="middle"><a href="extension/">extension/</a></td><td align="center" valign="middle">X4 extension and Mission Director probe.</td></tr>
    <tr><td valign="middle"><a href="bridge/">bridge/</a></td><td align="center" valign="middle">Node.js log reader, SQLite storage, readback command and automated tests.</td></tr>
    <tr><td valign="middle"><a href="scripts/">scripts/</a></td><td align="center" valign="middle">Deployment helper for the experimental extension.</td></tr>
    <tr><td valign="middle"><a href="docs/">docs/</a></td><td align="center" valign="middle">Experiment instructions, evidence and verification records.</td></tr>
    <tr><td valign="middle"><a href="assets/">assets/</a></td><td align="center" valign="middle">README artwork and status badges.</td></tr>
    <tr><td valign="middle"><a href="ARCHITECTURE.md">ARCHITECTURE.md</a></td><td align="center" valign="middle">System design and implementation boundaries.</td></tr>
    <tr><td valign="middle"><a href="DATABASE.md">DATABASE.md</a></td><td align="center" valign="middle">Current SQLite schema and persistence limitations.</td></tr>
    <tr><td valign="middle"><a href="DECISIONS.md">DECISIONS.md</a></td><td align="center" valign="middle">Recorded project and technical decisions.</td></tr>
    <tr><td valign="middle"><a href="SETUP.md">SETUP.md</a></td><td align="center" valign="middle">Development setup and local configuration guidance.</td></tr>
    <tr><td valign="middle"><a href="TESTING.md">TESTING.md</a></td><td align="center" valign="middle">Automated checks, live test requirements and verification status.</td></tr>
  </tbody>
</table>


---

## The Bigger Idea

X4LifeSigns is the first implementation of a broader idea called **Life Signs**.

If the approach works, the underlying concept does not have to belong exclusively to X4.

Different games could potentially receive their own implementations while sharing the same basic philosophy:

> **Let the game create events.  
> Let Life Signs remember them.  
> Let the characters talk about the lives they actually lived.**

---

<div align="center">

## X4LifeSigns

**Because a living universe should remember what happened in it.**

---

<a href="https://github.com/yeahmyusernameis32characterslong/LifeSigns#lifesigns-top">
  <img src="assets/lifesigns-hub-banner.png" alt="Life Signs" width="900">
</a>

**Part of the Life Signs project.**

[Visit the Life Signs hub](https://github.com/yeahmyusernameis32characterslong/LifeSigns#lifesigns-top)

</div>
