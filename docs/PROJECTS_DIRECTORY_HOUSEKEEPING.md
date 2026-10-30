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
