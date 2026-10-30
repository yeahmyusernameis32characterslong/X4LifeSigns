# Development workspace housekeeping

Owner-requested Codex task,30 October2026. Audit the owner's projects directory
against actual repositories and remove genuinely disposable clutter. The owner
reports roughly15,000 files; measure before drawing conclusions. File count alone
does not establish waste: dependencies, Git objects and source corpora can account
for many necessary files. Report both files and bytes by category.

## Execution

1. Read each applicable AGENTS.md. Inventory top-level projects, Git repositories,
   linked worktrees, ignored/untracked areas, dependency/build caches and research
   storage. Do not follow junctions/symlinks outside the selected root. Keep raw
   paths and inventory local; do not read secrets for classification.
2. Verify remotes, current branches, worktree registrations, local changes,
   untracked files, stashes and unpublished commits. Compare against current
   remote branches and open PRs, not main alone. Fetch safely without resetting,
   switching or modifying an active worker's checkout. Preserve PR25 work.
3. Identify actual consumers: running processes/watchers, installed companion
   paths, task scripts, helper grants/manifests, evidence indexes and rollback
   receipts. A duplicate-looking checkout/build may be the deployed runtime or a
   required recovery source. A file absent from Git or ignored by Git is not
   automatically disposable.
4. Prepare a local exact-path action manifest with classification, bytes, reason,
   reproducibility/reference evidence and intended disposition. Recheck candidates
   immediately before acting. Keep required/uncertain material.
5. Proceed with clearly proven disposable temporary files, abandoned test output
   and regenerable unused caches/builds. Normal low-risk cleanup is authorised;
   do not stop at an inventory or ask approval for each temporary file. Preserve
   dependencies used by active work. Where removing an unused dependency tree,
   verify lockfile/tooling and an available restoration route, and state the cost
   of regeneration.
6. Remove an obsolete clean worktree only with Git's normal worktree operation,
   after verifying its commits are retained remotely or in another retained ref,
   no unique local data exists and no process/configuration depends on it.
   Preserve branches and history. Do not force removal, run blanket git clean,
   delete .git, prune stashes or garbage-collect unpublished history.
7. Do not delete unique research/source extracts, provenance, logs/evidence,
   saves, databases, restoration backups, local configuration or credentials as
   generic workspace rubbish. Inventory duplicate evidence and propose a separate
   exact retention decision if needed. Do not implement PR25 database cleanup here.
   Unrelated projects may be inventoried; retain their ambiguous data/source.
8. Verify retained repositories/worktrees and active deployment references remain
   valid and pre-existing changes unchanged. Run only checks relevant to what was
   removed. Report before/after file counts and bytes, failed/skipped operations,
   anything deliberately retained, and exact follow-ups requiring an owner choice.
   Moving/quarantining files is not disk-space recovery; report it separately.

## Delivery and boundaries

Use this existing PR branch for sanitised documentation and any small reusable
cleanup tooling justified by the audit. Avoid an unnecessary general framework.
Any deletion helper must default to preview and use an explicit validated target
list; test containment, changed targets and link handling with disposable fixtures.

The private projects-housekeeping handoff specifies the owner's local target.
Public documents use portable placeholders such as <projects root>.
Keep raw inventory, paths, manifests and private evidence local/ignored. Never
upload extracted X4 source or local user files to either repository.

Codex may use Qwen under the standing research workflow if useful; no additional
corpus grants are implied. Coordinate with active workers before touching their
outputs. Do not terminate X4/services, deploy, change permissions, merge PRs,
remove published branches or rewrite history. This is workspace cleanup, not
production behaviour change.

Publish PROJECTS_HOUSEKEEPING_CODEX_REPORT.md, update shared STATUS/EVIDENCE after
rereading remote state, verify remote readback and return to AGENT. Report actual
cleaning results, not an arbitrary target number of files.


## Local audit checkpoint - 30 October 2026

The initial read-only inventory counted 59,256 regular files, 14,850 directories
and 41 junctions beneath the owner's selected projects root, totalling
46,975,855,030 logical file bytes. Links were not followed. The local audit-output
folder was excluded from these counts to avoid counting the inventory itself.
This is an observation, not a target count or a claim of recoverable disk space.

Most file count is in development research/test storage; most bytes are in
retained save, database, deployment and test-evidence copies. Those categories
must not be swept away because their associated feature PR has merged.

PRs 21-24 were independently confirmed merged; PR25 remains open. Their local
checkouts still require per-checkout checks of ignored files, references and
consumers before removal. The detached integration checkout also has two local
merge commits absent from remote refs, so its history must acquire a retained
reference before it can be retired. Active PR25 checkouts, local editor changes,
installed service paths and restoration assets remain protected.

This checkpoint records inventory and Git/API verification only. Completed
cleanup and preservation results will be recorded separately after execution.


## Executed cleanup and preservation

Completed against explicit local manifests, with preview and identity/content
rechecks before each removal:

| Category | Removed | Logical file bytes removed |
| --- | ---: | ---: |
| Verified temporary access/prompt fixtures | 505 fixture folders; 16,370 files | 775,523 |
| Verified mocked research-output fixtures | 449 fixture roots; 4,342 files | 2,104,384 |
| Obsolete Git worktrees | 5 checkouts; 560 files including their Git pointer files | 81,502,451 |
| Synthetic escape-test junctions | 41 link objects | 0 content bytes; targets preserved |
| **Total** | **21,272 regular files; 2,453 directories; 41 junctions** | **84,382,358** |

The five retired checkouts held the merged PR21-24 heads and a detached local
integration result. Git's normal worktree removal was used without force. No
branch was deleted. The integration head and its two non-remote merge commits
remain held by `archive/local-integration-20261027`. Recreate a retired checkout
with `git worktree add <checkout path> <retained branch or commit>` before rerunning
an older script that explicitly expects its former path.

All synthetic fixture removal was based on retained generator source and exact
marker/structure checks. Ambiguous variants, synthetic repositories containing
Git metadata, real research journals, copied historical evidence, original
extracts, saved games, databases, restoration backups, deployment rollback
sources, credentials/configuration and active dependencies were retained.
No broad directory sweep, permission change, Git clean, GC or history rewrite
was performed. The junction targets and exact recreation records remain available.

### Measurements and verification

The post-cleanup inventory checkpoint recorded 38,081 regular files, 12,411
directories and zero junctions, with 46,907,591,101 logical file bytes. As with
the baseline, generated audit records were excluded. The difference includes
the new PR28 review checkout and normal Git metadata updates, so it is not the
gross deletion figure above. Logical file sizes are not a measurement of freed
filesystem allocation. Local audit records themselves occupied about 44.8 MB at
verification; that cost is additional to these inventory totals. No quarantine
or relocation was counted as recovered space.

- Metadata (size, timestamps and attributes) for every retained regular file
  outside the three real repositories' changing Git internals was compared with
  the baseline: 33,388 unchanged; no unexpected
  missing, modified or added paths. Synthetic Git-test repositories are included
  in that preservation comparison.
- SHA-256 checks passed for 99 critical runtime/data files totalling
  2,996,844,811 bytes. Existing databases, restoration backups and service
  configuration retain their recorded hashes. Active PR25 checkouts and the
  editor's pre-existing changes remain intact.
- Nine local disposable-fixture safety checks passed: preview default,
  containment, changed files, changed/escaping links, junction-only removal,
  exact flat/nested lists, unexpected additions and Git-metadata refusal.
- Repository connectivity checks passed for all three retained repositories;
  retained worktree registrations, branches and integration archive ref resolve.
  The existing watcher remains idle; no service/game was launched or stopped.

No production deployment, database housekeeping, gameplay test or merge was
performed. Raw inventory, manifests, journals and private paths remain local.
This PR records completed workspace housekeeping; it does not approve removal
of the large retained evidence/database copies or change PR25's maintenance rules.


### Root-search check and remaining review

After removing the fixtures/junctions, the unchanged installed discovery code
completed a read-only recursive search of the projects root in 273.379 seconds.
It examined 1,405 XML headers and returned 208 candidates without another link
refusal. This verifies that the former junction obstruction is cleared. It is
not a completed save parse, database matching run, retention preview or X4 menu
test. Broad-root discovery is still slow and should not be reported as a solved
end-to-end scan-performance problem. No scanner code was changed in PR28.

Further disk savings would require a separate retention decision for the large
preserved database, save and evidence copies. Remaining synthetic Git fixtures,
ambiguous test variants and frozen research evidence were deliberately retained.
Future test harness work should dispose of its own temporary fixtures; the
original research generators were preserved rather than rewritten during cleanup.
