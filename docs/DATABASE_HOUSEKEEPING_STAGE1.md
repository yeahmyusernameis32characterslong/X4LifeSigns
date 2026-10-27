# Read-only save inventory and retention preview

PR #25 Stage 1, 27 October 2026. Implemented for offline review; not integrated
with the game menu or service. No Apply operation exists. Existing schema-v1
ingestion and routing behaviour is unchanged.

## Run on explicitly selected local copies

Use Node v24.21.0 (24.x). Install the separate preview dependencies:

```powershell
npm ci --prefix profiles --ignore-scripts --no-audit --no-fund
node profiles/housekeeping-cli.mjs --saves '<save-folder>' --profiles '<existing-profile-database-folder>'
```

Repeat `--saves '<folder>'` for every retained archive/backup location. Use
`--pin '<Life-Signs-universe-ID>'` to preserve an entire universe. Output is JSON
on stdout and includes local paths and universe/run identifiers; keep it private.
If saving output, choose a new local file outside the scanned directories.
The tool never creates input folders or databases. Unknown arguments, including
`--apply`, are rejected. This is an offline tool; close X4 and its companion
before inspection. It is not a maintenance lock or an atomic inventory.

## Supported save serialization

Read plain UTF-8 XML or native gzip XML directly, without extracting/modifying
an input. Support was established using ten specifically owner-supplied native
X4 9.00/build 611726 archives. A separate Python Expat reader established expected
checkpoint triples before comparison with the implementation. One native archive
was also streamed into a new disposable plain XML copy to compare both forms.

| Value | Exact supported location / representation |
| --- | --- |
| Save header | `savegame/info/game`, `id="X4"`, `version="900"` |
| String references | `savegame/script/refs[@type="string"]/ref`, canonical decimal `id` and `string` attributes |
| Life Signs state | `savegame/md/script[@name="LifeSigns_EventRecorder"]/cue[@name="UniverseIdentity"]/vars/value` |
| Universe ID | `name="$Id" type="string"`; `value` resolves through the string reference table |
| Checkpoint run | `name="$CheckpointRun" type="string"`; same typed resolution |
| Checkpoint record | `name="$CheckpointRecord" type="largefloat"`; canonical positive decimal integer, exactly representable as a JS safe integer |

Reference numbers can repeat across different datatype tables. Only the string
table resolves these MD strings. Duplicate IDs within that table, duplicate
identity cues/scripts/fields, missing references, unknown value types, namespaces
or unsupported layouts produce uncertainty. Matching text elsewhere is not a
checkpoint. Other X4 versions or save representations are not inferred.

The whole XML stream must be well formed and reach EOF; gzip checks must also
finish successfully. DTDs are rejected and external resources are never loaded.
The strict streaming parser is pinned `saxes@6.0.0` with lockfile-pinned
`xmlchars@2.2.0`; [upstream documentation](https://github.com/lddubeau/saxes)
describes its XML parsing API. Upstream is archived, so a future dependency change
needs review. Native serialization is an observed project fact, not a vendor API
guarantee. Raw saves, extracted source and local validation outputs stay private.

Default per-save limits are 8 GiB decoded bytes, 2 million references, XML depth
256, a 256 MiB worker heap and ten minutes. These are parser resource guards,
not retention rules or recorder row limits. Any exceeded limit yields UNKNOWN.
The scanner runs serially with a separate worker heap, retains only identity/run
strings and reference IDs, and does not construct a full XML tree. Enumeration
is limited to 10,000 entries. DB inspection defaults to 5 million raw records and
1 million profile/snapshot boundaries; larger inputs are blocked for review.

## What the preview means

- `CHECKPOINT`: supported complete save with an exact universe/run/record root.
- `NO_LIFESIGNS_STATE`: complete supported extraction with no identity cue and
  no universe-reference evidence; never inferred from a failed search.
- `UNKNOWN`: inaccessible, changing, unsupported, malformed, incomplete or
  ambiguous input. A known universe blocks that universe; unknown identity
  blocks every potentially affected universe in the declared scope.
- `PREVIEW_ONLY`: valid graph and declared inventory; shows retained prefixes
  and logical candidate counts for raw records, profile versions, events and
  sessions. These counts overlap and must not be added as distinct activities.
- `PINNED`: every run and row is retained, including unsaved abandoned branches.
- `BLOCKED`: candidate counts suppressed, with reasons. An incomplete baseline
  or save cutoff inside a profile is an unsupported retention boundary, not a
  claim that the save file is corrupt.

All retained saves contribute their full ancestry. The greatest required cutoff
per run wins, preserving overwritten ancestors and both surviving branches.
Completed profiles marked `partial=1` are legitimate incomplete-data observations;
they are different from a cutoff between PROFILE_BEGIN and PROFILE_END.
An unmatched universe is only an orphan *candidate* within declared scope.
There is no deletion instruction, byte-reclaim prediction or executable plan.

Unknown files in a save scope are reported rather than silently ignored. Native
gzip is supported; arbitrary ZIP/7z containers are unknown. Missing directories
and unsafe links block coverage. No personal profile paths are discovered by
assumption. External or unregistered saves are outside the declared inventory.

On Windows, metadata is checked before content reads for offline, recall and
reparse attributes, including ancestors. Such inputs remain unknown; the tool
does not hydrate files, alter attributes, disable sync or move saves. A locally
available synced file is still preview-only. Metadata checks and final directory
and file rechecks can detect changes; they do not provide cross-file atomicity
or exclude hostile concurrent mutation. Save content hashes are evidence of
what was read, not a durable authorisation for later cleanup.

## Database boundary and verification

`profile-schema.mjs` contains the existing exact ownership/schema validator.
`profile-inventory.mjs` opens an existing file with `DatabaseSync(readOnly:true)`
and query-only reads. It never constructs ProfileStore, creates missing storage,
repairs a database or changes schema. It refuses building files, foreign/v2
schemas, unsafe links, WAL headers and transaction sidecars. It checks contiguous
raw ordinals, session ancestry, raw run headers, projection correspondence and
profile/baseline boundaries. Readers use a read transaction and check file identity,
size, timestamps, data_version and sidecars before returning.

```powershell
npm test --prefix profiles
npm test --prefix recorder
npm test --prefix bridge
```

Synthetic tests cover branch unions, ancestor preservation, pins, malformed and
ambiguous XML/gzip, missing locations, resource guards, changing files, baseline
and profile cuts, projection/schema refusal and byte preservation. Owner archives
are compared against an independent parser and their hashes checked before/after;
owner DB inspection uses read-only connections and hashes. Local results and
limitations are indexed in the private Stage 1 handoff report. No owner evidence
is embedded in the tests.

Verification on Node v24.21.0 / SQLite 3.53.4: 53 profile tests (including 15 new
housekeeping tests), 89 recorder tests and 112 bridge tests passed: 254 total.
Ten native archives, totalling 470,118,655 stored bytes and 4,631,441,980 decoded
bytes, matched independent checkpoint expectations. All ten checkpoints were
found independently in three existing owned databases; archive and DB SHA-256
checks were unchanged. The 541,993,639-byte plain XML equivalent matched its
native archive root. These are offline read-only results, not live menu or
destructive-maintenance verification.

## Next gates

Agent reviews Stage 1. The initial-menu UI, transport, writer exclusion,
schema-v2 replay seals, catalogue recovery, quarantine, pruning and compaction
remain separate proposed work in the [implementation design](DATABASE_HOUSEKEEPING_IMPLEMENTATION_DESIGN.md).
Stage 1 does not authorise deployment, gameplay testing or merge.
