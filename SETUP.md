# X4LifeSigns Development Setup

## Current status

The repository contains design documentation and artwork only. There is no runnable application, dependency manifest, deployment script or automated test suite.

This file records development setup notes and intended dependencies. The owner's current installations have not been independently verified during the repository review.

## Operating system

Windows

## Main project folder

Choose a local checkout folder outside synchronised storage, for example `C:\Projects\X4LifeSigns`. This is a generic example, not a required machine path. Record your actual location only in `SETUP.local.md`.

## Tools recorded as installed

The existing setup notes record DB Browser for SQLite and Codex CLI as installed. Codex CLI 0.160.0 was the version recorded during initial setup, not a verified current version.

Installation status for the other tools below is not established by this repository. Verify locally when implementation requires them.

## Development tools and intended dependencies

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

SQLite is intended to provide persistent storage for the planned Node.js application.

DB Browser for SQLite was recorded as installed for manual inspection of development databases.

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

OpenAI Codex CLI was recorded as installed.

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

## Versions and integration setup

Tested dependency versions, speech model choices and installation commands will be documented with the first implementation that uses them. The bridge, database library and voice integration methods are not yet established.

## X4 installation

A generic Steam installation example is `C:\Program Files (x86)\Steam\steamapps\common\X4 Foundations`. Record your actual installation and test extension deployment paths in the ignored `SETUP.local.md` file.

Use `<X4 user data folder>` in public instructions for the folder containing your X4 profile's debug log and saves. For example:

- Debug log: `<X4 user data folder>\debuglog.txt`
- Separate test save: `<X4 user data folder>\save\<test save filename>`

A conventional user-data location can be written as `%USERPROFILE%\Documents\Egosoft\X4\<X4 profile id>`. Documents may be redirected, including into OneDrive, so verify the actual location locally rather than assuming this example applies.

`%USERPROFILE%` is Windows Command Prompt environment-variable syntax; use `$env:USERPROFILE` in PowerShell. Angle-bracket placeholders must be replaced locally and are not runnable paths.

## Private local setup notes

Create `SETUP.local.md` at the repository root for actual checkout, game, log, profile and test-save paths. Git ignores this filename. Keep the published guidance portable; never copy personal usernames, OneDrive account paths, profile IDs or raw logs into commits, issues, PR descriptions or screenshots.

If environment configuration is needed later, `.env.local` is also ignored. No configuration loader is implemented; these files are a local documentation/configuration convention only.

Before committing, check:

```text
git check-ignore SETUP.local.md .env.local
git status --short
git diff --cached
```

Ignore rules do not protect an already tracked file. Do not force-add local files. Review any shared extracts and replace personal values with placeholders first.

## Starting the project

The final development startup commands have not yet been defined.

The following are illustrative future commands. They cannot currently start or test this project because no application or npm scripts exist yet.

The aim is eventually to provide simple commands such as:

npm start

and:

npm test
