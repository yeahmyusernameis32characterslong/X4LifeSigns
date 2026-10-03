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

## A Living Universe

Life Signs is intended to build persistent histories around the people, ships, and stations already present in X4.

The system can potentially remember things such as:

- meetings between characters and the player
- ships an NPC has served aboard
- stations they have lived or worked on
- battles and dangerous encounters
- rescues
- repeated trading relationships
- friendships and hostility
- important conversations
- changes of command
- major events witnessed by characters
- previous interactions with the player

Not every event needs to become important.

The idea is to allow ordinary events to disappear while significant experiences become part of a character's history.

Over time, two players could therefore meet completely different versions of otherwise similar NPCs because those characters have lived through different events.

---

## Conversations With Context

Life Signs is not intended to generate random AI dialogue for the sake of having AI dialogue.

The important part is **context**.

Before an NPC responds, the system can look at who they are, where they are, what has happened to them, and what relationship they have with the player.

That information can then be given to a language model.

Instead of:

> "Hello, pilot."

the system could eventually produce something closer to:

> "You again. Last time I saw you, half my hull was missing and you were dragging pirates off us."

The language model does not invent the history.

**X4 creates the history. Life Signs remembers it.**

---

## Voice

Life Signs is being designed around local speech as well as text.

The planned voice system includes:

- **faster-whisper** for speech recognition, allowing the player to speak naturally
- **Kokoro** for local speech synthesis, allowing characters to answer with generated voices

Voice processing is intended to happen asynchronously so the game does not have to stop while speech is generated.

The aim is eventually to make talking to a character feel much closer to talking to somebody who actually exists inside the simulation.

---

## Aria

Most everyday characters are intended to use a local language model running directly on the player's PC.

Some characters, however, may justify something more sophisticated.

**Aria** is the first planned example.

Rather than being another generic AI controlled NPC, Aria is intended to be a richer persistent character capable of longer conversations, deeper reasoning, and a stronger individual personality.

For characters like Aria, Life Signs may use ChatGPT rather than the smaller local model.

This allows routine NPC interaction to remain local and fast while selected characters can provide much richer experiences.

---

## How It Works

Life Signs sits between **X4: Foundations** and the AI systems that generate context aware interaction.

X4 creates the events. Life Signs observes them, remembers what matters, and turns that context into natural responses.

<div align="center">
  <img src="assets/x4lifesigns-how-it-works.png" alt="How X4LifeSigns works" width="100%">
</div>

### What the diagram shows

The expected flow is:

- **X4: Foundations** provides the game world and events
- **Mission Director / Lua** detects events, handles game side control, and passes relevant information onward
- **Node.js** acts as the central orchestrator, managing context, dialogue flow, and communication between systems
- **SQLite** stores persistent memories, relationships, events, and character data
- **Ollama** handles routine local NPC interaction
- **ChatGPT** is reserved for selected richer characters such as Aria
- **faster-whisper** converts player microphone input into text
- **Kokoro** turns generated dialogue into spoken NPC voice output

The goal is not simply to generate dialogue.

The goal is to allow characters to respond based on who they are, what has happened to them, and what they remember.

In short:

> **X4 creates events. Life Signs remembers them. AI turns that context into natural interaction.**

---

## Persistent Identity

One of the most important parts of the project is keeping track of **who is who**.

Life Signs intends to use X4's internal identities for ships, stations, crew, and other entities wherever practical.

That means the database can connect events across time.

A conversation today can matter several sessions later because the system knows it is dealing with the same character.

Without persistent identity, AI dialogue is just improvisation.

With persistent identity, it can become **history**.

---

## Local First

Most of Life Signs is intended to run locally.

The current design uses:

| Component | Technology |
|---|---|
| Game integration | X4 Mission Director + Lua |
| Application logic | Node.js |
| Persistent memory | SQLite |
| Local language model | Ollama |
| Model experimentation | LM Studio |
| Speech recognition | faster-whisper |
| Speech synthesis | Kokoro |
| Rich AI characters | ChatGPT |
| Development assistance | Codex |

The reference development machine currently uses an **NVIDIA RTX 5080 with 16 GB VRAM**.

The project will deliberately favour responsive models over simply using the largest model that fits.

X4, the language model, and the voice system all need to live on the same machine without fighting each other to death.

---

## Not Just Generated Dialogue

Life Signs is ultimately less about generated text and more about connecting systems together.

The interesting part is not that an AI can produce a sentence.

It is that the sentence can be influenced by:

- who said it
- who they are speaking to
- where they are
- what they have experienced
- what happened previously
- how they feel about the people involved

and potentially years of history inside the same X4 universe.

The language model is simply the thing that turns that information back into natural language.

---

## Project Status

> **Very early development**

The architecture and development environment are currently being built.

Major systems are still subject to change.

Current work includes:

- development environment
- X4 integration design
- persistent identity
- SQLite architecture
- Node.js service architecture
- local LLM selection
- speech recognition
- speech synthesis
- development and testing workflows

This is not currently a playable release.

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

<div align="center">

<a href="https://github.com/yeahmyusernameis32characterslong/LifeSigns">
  <img src="assets/lifesigns-hub-banner.png" alt="Life Signs" width="900">
</a>

**Part of the Life Signs project.**

[Visit the Life Signs hub](https://github.com/yeahmyusernameis32characterslong/LifeSigns)

</div>