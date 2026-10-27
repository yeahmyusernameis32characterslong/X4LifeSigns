<a name="x4lifesigns-top"></a>

<div align="center">

# X4: LIFE SIGNS

### Make the universe remember you.

<img src="assets/x4lifesigns-poster.png" alt="X4: Life Signs poster" width="900">

<br>

**An experimental X4: Foundations mod that gives the universe memory, personality, and a sense that its people actually live there.**

</div>

---

## What is Life Signs?

**X4LifeSigns** is an experimental mod project for **X4: Foundations** built around a simple idea:

> What if the people in X4 could actually remember what happened to them?

NPCs should not feel like temporary dialogue boxes attached to ships and stations.

A pilot you rescued could remember you.

A captain whose ship you saved might recognise you later.

A trader you repeatedly helped could gradually become familiar with you.

Crew members could remember where they served, what happened around them, and who they encountered.

Characters could talk about things that genuinely happened in your universe rather than selecting another isolated line from a dialogue table.

Life Signs aims to give the simulation something it has never really had:

**a memory of itself.**

---

## Conversations With Context

Life Signs aims to build histories around X4's people, ships and stations, so a character's response could reflect where they have served, who helped them and what they survived. Keeping track of who is who would allow those experiences to matter across future encounters.

Instead of another "Hello, pilot", you might eventually hear:

> "You again. Last time I saw you, half my hull was missing and you were dragging pirates off us."

The language model would express a history grounded in real game events, not invent one. Two players could meet very different versions of similar characters because those characters have lived different lives.

**X4 creates the history. Life Signs remembers it.**

---

## How It Works

The proposed wider system connects X4 game events to a local Node.js application, with SQLite keeping the history. Language models could then turn that context into natural responses.

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

<table>
  <thead><tr><th>Milestone</th><th>Status</th></tr></thead>
  <tbody>
    <tr><td valign="middle">X4 Event Collector</td><td align="center" valign="middle"><img src="assets/status-verified.png" alt="Verified" width="120"></td></tr>
    <tr><td valign="middle">SQLite Database</td><td align="center" valign="middle"><img src="assets/status-in-progress.png" alt="In Progress" width="120"></td></tr>
    <tr><td valign="middle">Return path to X4</td><td align="center" valign="middle"><img src="assets/status-planned.png" alt="Planned" width="120"></td></tr>
    <tr><td valign="middle">Local LLM integration</td><td align="center" valign="middle"><img src="assets/status-exploring.png" alt="Exploring" width="120"></td></tr>
    <tr><td valign="middle">Voice input and output</td><td align="center" valign="middle"><img src="assets/status-exploring.png" alt="Exploring" width="120"></td></tr>
    <tr><td valign="middle">Aria</td><td align="center" valign="middle"><img src="assets/status-exploring.png" alt="Exploring" width="120"></td></tr>
  </tbody>
</table>

---

## Project Structure

| Path | Purpose |
| --- | --- |
| [`extension/`](extension/) | X4 extension and Mission Director docking probe. |
| [`bridge/`](bridge/) | Node.js log reader, SQLite storage, readback command and automated tests. |
| [`scripts/`](scripts/) | Deployment helper for the experimental extension. |
| [`docs/`](docs/) | Experiment instructions, evidence and verification records. |
| [`assets/`](assets/) | README artwork and status badges. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System design and implementation boundaries. |
| [`DATABASE.md`](DATABASE.md) | Current SQLite schema and persistence limitations. |
| [`DECISIONS.md`](DECISIONS.md) | Recorded project and technical decisions. |
| [`SETUP.md`](SETUP.md) | Development setup and local configuration guidance. |
| [`TESTING.md`](TESTING.md) | Automated checks, live test requirements and verification status. |

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
