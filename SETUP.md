# X4LifeSigns Development Setup

## Operating system

Windows

## Main project folder

C:\Projects\X4LifeSigns

## Required software

### Git

Used for source control.

Check installation with:

git --version

### GitHub Desktop

Used as the main graphical interface for Git operations.

### Visual Studio Code

Used to view and edit project files.

The X4LifeSigns folder should be marked as trusted in VS Code.

### Node.js

Use the current supported LTS release.

Check with:

node --version

npm --version

### SQLite

SQLite is used by the Node.js application for persistent storage.

DB Browser for SQLite is installed for manual inspection of development databases.

### Ollama

Ollama is intended to run the project's local language model.

Do not assume a particular model until one has been tested and selected.

### LM Studio

LM Studio may be used to compare and test local models.

### faster-whisper

faster-whisper is the intended local speech-to-text engine.

It will be used to convert microphone input into text for player-to-NPC conversations.

Its exact installation method and selected Whisper model will be documented once tested.

### Kokoro

Kokoro is the intended local text-to-speech engine.

It will be used to generate spoken NPC dialogue locally.

The final voice models and integration method will be documented once tested.

### Piper

Piper may be installed later as a lightweight fallback text-to-speech engine if required.

### Codex

OpenAI Codex CLI is installed.

Check with:

codex --version

The initial installed version during project setup was:

codex-cli 0.160.0

## PowerShell

The CurrentUser PowerShell execution policy may be set to RemoteSigned so npm PowerShell scripts can run.

Check with:

Get-ExecutionPolicy -List

## Hardware target

The primary development PC includes:

- Intel Core Ultra 7 265KF
- NVIDIA RTX 5080 16 GB
- 32 GB DDR5 RAM
- 1 TB SSD

X4: Foundations, the local LLM and local voice processing may all use GPU resources at the same time.

Model selection must therefore consider combined VRAM and GPU usage.

## Secrets

Secrets must not be committed to Git.

Use environment variables or .env files where required.

The repository .gitignore excludes .env files.

## X4 installation

Supply your local installation with `-GamePath` to
`scripts/deploy-bridge-probe.ps1`. The experiment deploys only into
`extensions\lifesigns_bridge_probe`. Machine-specific game and log paths are
kept out of the experimental files.

## Starting the project

The first experiment requires Node.js 22 or newer and no npm dependencies:

```powershell
npm.cmd --prefix bridge test
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION'
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG'
```

Launch X4 with logging enabled before starting the reader, and start the reader
before performing a new docking. See
[BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md) for deployment, logging and
the manual in-game test. **Implemented, live X4 verification pending.**

The wider system's startup commands have not yet been defined.

The aim is eventually to provide simple commands such as:

npm start

and:

npm test
