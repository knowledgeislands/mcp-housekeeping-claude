# The safety model

Read this before the first deletion. This server removes files from directories that hold months of session history, deliberately written memory, and generated artifacts, and it removes them permanently. This guide states what stands between a request and a deletion, what the server refuses outright, what it preserves on purpose, and what recovery is actually available.

## Two independent layers

**The access-level gate decides which tools exist.** At boot, each tool's level is derived from its MCP annotations — `readOnlyHint: true` means `read`, `destructiveHint: true` means `destructive`, and a tool with missing or partial annotations is treated as `destructive` rather than assumed harmless. A tool is registered only when its derived level is at or below `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL`, which defaults to `read`. At that default the fifteen deleting and overwriting tools are not merely refused, they are absent: the model cannot see them, name them, or call them.

**The `dry_run` default decides whether a visible tool acts.** Every deleting tool takes `dry_run`, defaulting to `true`. A first call previews: it returns the exact list of what would be removed and the space that would be freed, and changes nothing. Only `dry_run: false` deletes.

Both layers are required, and they guard different things. The gate controls _visibility_ — what the model could ever do in this session. `dry_run` controls _effect_ — whether this particular call does it. Raising the access level does not disarm `dry_run`, and leaving `dry_run` at its default does not make it safe to run at `destructive` in a session where you are not paying attention.

## The overwriting tools have no preview

This is the exception worth knowing before you meet it. `dry_run` guards the tools that _delete_. The tools that _overwrite_ do not have it:

- `claude_desktop_memory_write` and `claude_code_memory_write` create or replace a memory file's entire contents on the first call.
- `claude_desktop_memory_index_write` and `claude_code_memory_index_write` replace a space's or project's whole `MEMORY.md`.
- `claude_desktop_report_write` creates or overwrites `cowork-audit-YYYY-MM-DD.md` for the given date.

They are annotated `destructive` — so they are invisible at the default access level and an MCP client can prompt before invoking them — but there is no preview step inside the server. Read the current contents with the matching read tool before asking for a write, and treat "consolidate this memory space" as an operation to review rather than to delegate.

## What the server refuses

These are refusals in code, not conventions:

- **A path that resolves outside its root.** Every filesystem input is resolved against the root that tool is allowed to touch, lexically and again against the real path, so both `../` traversal and a symlink pointing out of the tree are rejected with `Path escapes root: "<input>"`. Memory operations are confined further, to `<space or project>/memory/`.
- **An identifier that does not match its schema.** Anything becoming a path segment is constrained by a regex that excludes `/`, `\`, and `..` before it reaches the filesystem; memory names must end `.md`, and a Claude Code session must be `<uuid>.jsonl`. Schemas are strict, so an unrecognised argument is an error rather than a silently ignored one.
- **Deleting `MEMORY.md` through `memory_delete`.** Both groups refuse it by name: `Cannot delete MEMORY.md via memory_delete`. Replacing its contents is a deliberate, differently named operation.
- **An ambiguous workspace.** Where more than one Cowork workspace is discovered, a tool that acts on one requires you to name it rather than choosing.
- **A relocation that would collide or point nowhere.** `claude_code_project_relocate` rejects a destination whose encoded name already exists, and a `new_path` that does not resolve on disk.
- **An unrecognised configuration value.** An invalid access level or audit-log setting aborts startup instead of falling back to a default.

## What the server preserves

- **Starred artifacts are never pruned**, and `claude_desktop_artifacts_prune` always keeps the top N most recently updated (default five) regardless of star status.
- **Orphaned projects holding memory are skipped.** `claude_code_orphan_projects_prune` will not delete an orphan containing a `memory/` subdirectory unless you pass `include_with_memory=true`, because memory is the most expensive thing in that tree to lose by accident.
- **Batch deletions match a declared pattern, never an arbitrary name.** Report clearing matches `cowork-audit-*.md`; Claude Code session pruning matches `*.jsonl` plus its `<uuid>/` sidecar; VSCode session pruning matches `*.json` and `*.jsonl`. No tool deletes a file simply because it was named in a request.
- **The three inspected roots are not configurable.** They are computed from your home directory, so no environment variable can aim the deleting tools somewhere else. The only path you choose is the report directory.

## What is irreversible

Deletion is `fs.unlink` and `fs.rm`. Files do not go to the Trash and there is no undo inside the server. Specifically:

- A pruned Claude Code session takes its `<uuid>.jsonl` transcript and its sidecar directory with it. `/resume` will no longer find that conversation.
- A pruned artifact is removed from `artifacts.json` **and** its `artifacts/cache_<id>.json` file is deleted.
- `vscode_workspace_delete` removes an entire `workspaceStorage/<id>/` subtree, which holds more than chat sessions — it is the workspace's whole storage entry.
- A cleared report is gone; `claude_desktop_reports_clear` deletes every `cowork-audit-*.md` in the report directory, not only yesterday's.
- An overwritten memory file cannot be recovered to its previous contents.

## What recovery there is

Plan for recovery before the deletion, because afterwards the options are thin.

- **The `dry_run` preview is the real safeguard.** It returns exactly what would be removed. Read it, and if the list is longer than you expected, stop rather than re-running with `dry_run: false`.
- **The audit log tells you what was called.** With the default `writes` scope, every non-read invocation is appended to `<MCP_HOUSEKEEPING_CLAUDE_PATH>/audit/audit.jsonl` with the timestamp, tool name, arguments, outcome, and duration. It records the request, not the file contents, so it reconstructs _what happened_ and never _what was lost_.
- **Backups exist only where the application made them.** `claude_desktop_backups_summary` reports the `.claude.json.backup.*` files Claude itself keeps. This server makes no backup of anything before deleting it.
- **Otherwise, it is your filesystem backup or nothing.** Time Machine or an equivalent snapshot is the only route back to a deleted transcript. If you do not have one, treat every `dry_run: false` as final.

## Working safely

- Keep the access level at `read` for ordinary use, and raise it to `destructive` for the session in which you intend to clean up. Restart afterwards.
- Leave the audit log at its default `writes` scope. It costs nothing and it is the only record of what was asked for.
- Audit before deleting: run the read-only check that finds the candidates, and read the list, before running the tool that removes them.
- Take the preview seriously. A `dry_run` result you did not read is not a safeguard you used.
- Start with the largest age threshold that frees enough space, not the smallest one that frees the most.

[Cleaning up state](cleaning-up-state.md) applies all of this per area.
