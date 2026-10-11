# X4LifeSigns Development Setup

## Current status

The repository contains a contained MD docking probe, a Node.js debug-log reader,
a deployment script and automated tests alongside design documentation and
artwork. **Experimental docking bridge verified in live X4.** Wider services remain
planned. The reader was tested locally with Node.js v24.21.0.

Optional docking persistence now uses built-in `node:sqlite` on that recorded
version. **Verified with live X4 docking across Node.js restarts.** No database server or
npm database dependency is needed.

This file records development setup notes and intended dependencies. The dated local LLM checks below verify only the listed environment; other installation claims retain their stated limits.

## Operating system

Windows

## Main project folder

Choose a local checkout folder outside synchronised storage, for example `C:\Projects\X4LifeSigns`. This is a generic example, not a required machine path. Record your actual location only in `SETUP.local.md`.

## Tools recorded as installed

The existing setup notes record DB Browser for SQLite and Codex CLI as installed. Codex CLI 0.160.0 was the version recorded during initial setup, not a verified current version.

Except for the dated local LLM development checks below, other tool installations remain unverified. Recheck locally when implementation requires them.

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

The docking experiment uses Node's built-in SQLite on Node.js v24.21.0. The
package targets `>=24.21.0 <25`. The module is a release candidate in the official
v24 documentation. Wider persistence remains planned.

DB Browser for SQLite was recorded as installed for manual inspection of development databases.

### Ollama

Ollama is intended to run the project's local language model.

No gameplay model has been selected. On 2026-10-11, local development checks
verified Windows 11 Home build 26300, Node.js v24.21.0, Git 2.56.0.windows.1 and
Ollama 0.40.2. The exact installed tag was qwen3.8:27b-q4_K_M, with digest
25b843619e944cd0ae6069f94ff4e5e26a16e109ccbc0a66a0f05979ed70098e.
Ollama reported architecture qwen35, 27.3B parameters, Q4_K_M quantisation,
262,144 model context length and completion/vision/tools/thinking capabilities.
The evaluated helper uses only text completion through chat, with a smaller
16,384-token context; advertised capabilities are not all tested.

A bounded local invocation returned the requested marker. Repository and source
research smoke tests also completed; see
[LOCAL_LLM_DEVELOPMENT.md](docs/LOCAL_LLM_DEVELOPMENT.md). This is advisory
development evaluation, not runtime integration or a production model choice.
During the initial 4,096-context invocation, Ollama reported 21% CPU / 79% GPU
placement; that observation is not a performance or available-VRAM guarantee.

Windows device enumeration reported Intel(R) AI Boost with status OK. Its
claimed 13 TOPS, framework/backend support and Ollama/NPU acceleration were not
verified. No NPU driver/backend was installed or selected. The existing hardware
target below remains the recorded target; combined X4/LLM/voice load is untested.

The installed qwen3.8:27b-q4_K_M is **development research only**. The owner
excludes it from gameplay runtime candidacy, NPC dialogue during X4, production
Node/Qwen integration and normal gameplay GPU sharing. This constraint reflects
resource concerns on the 16 GB RTX 5080 target, not a combined-workload benchmark.

A logical reference corpus is proposed under ignored
local-data/x4-reference-corpus/, reusing existing extracts through manifest
references. The bounded inventory and acquisition plan do not establish that
an offline corpus has been installed or approved for helper access. Any later
acquisition or wider grant requires its own approval and item-level rights,
version, hash and effective-source checks. Raw references stay local; see the
[corpus boundaries](docs/LOCAL_LLM_DEVELOPMENT.md#proposed-reference-corpus).

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

The first experimental bridge uses Node.js built-ins and an X4 debug-log reader;
see [BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md). Production transport,
speech model choices and voice integration remain undecided. The optional
persistence mode uses built-in `node:sqlite`; see
[PERSISTENCE_EXPERIMENT.md](docs/PERSISTENCE_EXPERIMENT.md).

## X4 installation

Supply your local installation with `-GamePath` to
`scripts/deploy-bridge-probe.ps1`. The experiment deploys only into
`extensions\lifesigns_bridge_probe`. Machine-specific game and log paths are
kept out of the experimental files.

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

The package now targets Node.js v24.21.0 and needs no npm dependencies:

```powershell
npm.cmd --prefix bridge test
.\scripts\deploy-bridge-probe.ps1 -GamePath 'YOUR_X4_INSTALLATION'
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG'
```

Launch X4 with logging enabled before starting the reader, and start the reader
before performing a new docking. See
[BRIDGE_EXPERIMENT.md](docs/BRIDGE_EXPERIMENT.md) for deployment, logging and
the manual in-game test. **Experimental docking bridge verified in live X4.**

Optional persistence commands (replace the log placeholder locally):

```powershell
node .\bridge\src\read-events.js --log '<X4 user data folder>\debuglog.txt' --db '.\local-data\docking-test.db'
node .\bridge\src\read-stored-events.js --db '.\local-data\docking-test.db'
```

The writer creates the database folder if missing. Keep actual paths in ignored
SETUP.local.md. Use a fresh database for another save/universe or game reload;
reuse the same database only for Node restarts while X4 remains running in the
controlled history. No probe redeployment is needed. Follow
[PERSISTENCE_EXPERIMENT.md](docs/PERSISTENCE_EXPERIMENT.md) for the live test procedure and completed verification record.

Automatic session routing is opt-in and **Verified live in X4 9.00 with Node.js
v24.21.0** under the approved practical local single-player `s1` assumption:

```powershell
node .\bridge\src\read-events.js --log 'YOUR_CONFIRMED_DEBUG_LOG' --auto-db
node .\bridge\src\read-stored-events.js --db '.\local-data\sessions\SESSION_KEY.db'
```

Replace SESSION_KEY with the complete observed production key. Do not combine
`--db` and `--auto-db`. Auto mode consumes V2 only and lazily selects a schema-v2
owned database beneath the reader's repository `local-data/sessions/`, even when
launched from another working directory. Manual/console modes continue using
V1 only. Readback displays v2 ownership as well as rows and count, without X4 or
the log; existing v1 readback remains supported.

Use the exact owner-run [production acceptance procedure](docs/AUTOMATIC_SESSION_ROUTING.md),
including explicit removal of both optional diagnostics before deployment.
The owner completed live deployment and verification; automated tests do not
deploy into the real X4 installation. Use local, non-synchronised storage; linked/junction paths,
multiply linked database files, existing sidecars and incompatible ownership
fail closed. Never repair an automatically rejected file by overwriting it.
Preserve it for inspection. An existing empty target is also rejected.

The wider system's startup commands have not yet been defined.

The following are illustrative future commands for the wider system. For the
current experiment use the explicit commands above.

The aim is eventually to provide simple commands such as:

npm start

and:

npm test
