# Operator guides

These guides are for running `mcp-housekeeping-claude` at the `destructive` access level, where it deletes accumulated state instead of only reporting on it. That is a different job from using the server, which is why it has its own guides: the deleting tools are invisible at the default access level, they are guarded by a `dry_run` flag rather than by a confirmation prompt, and what they remove is removed with `fs.unlink` and `fs.rm` — the file is gone, not in the Trash.

Read [The safety model](safety-model.md) first. The other two guides assume you know what the server refuses to do and what it cannot undo.

## Understand what the server will and will not do

[The safety model](safety-model.md) covers the two independent layers that stand between a request and a deletion — the access-level gate that decides which tools exist, and the `dry_run` default that decides whether a visible tool actually acts — plus the containment rules on every path, the things the server refuses outright, the things it deliberately preserves, and what recovery looks like when there is no undo.

## Clean up one area

[Cleaning up state](cleaning-up-state.md) is the procedure for each of the three areas: Claude Desktop artifacts and memory, Claude Code sessions and orphaned project directories, and VSCode workspace storage. Every procedure has the same shape — audit first, preview with `dry_run`, act, verify — and each one names what it deletes, what it leaves behind, and how to recover if the preview was not read carefully enough.

## Run the daily audit

[The daily audit](daily-audit.md) covers the report-writing run: clearing yesterday's report, running every read-only check, pruning what the check found, consolidating a memory space, and writing `cowork-audit-YYYY-MM-DD.md`. It needs the `destructive` access level even though most of it only reads, because writing the report is itself a destructive-annotated operation.
