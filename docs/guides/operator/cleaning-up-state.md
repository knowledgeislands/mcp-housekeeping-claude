# Cleaning up state

Use this guide to free space or retire stale state in one of the three areas. Every procedure here has the same four steps — audit, preview, act, verify — and every one of them assumes you have read [The safety model](safety-model.md), because none of what follows can be undone.

## Before you begin

Set `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL=destructive` in the client's `env` block and restart the client. Until you do, the tools named below are not registered and the model cannot call them.

Decide what you are trying to achieve before you start. "Free 5 GB" and "retire everything from before March" produce different thresholds and different risks, and the read-only checks in [Everyday use](../user/everyday-use.md) will tell you which one your machine actually needs.

## Prune Claude Code sessions

**Audit.** `claude_code_storage_summary` gives the totals and flags; `claude_code_sessions_obsolete` lists what is older than a given number of days, with the bytes each would free including its sidecar directory. `claude_code_projects_list` shows which projects hold the bulk of it.

**Preview.** `claude_code_sessions_prune` with `older_than_days` set and `dry_run` left at its default returns the exact deletions it would make. Pass `project` to confine it to one project; omit it and the sweep covers every project under `~/.claude/projects/`.

**Act.** Re-run with `dry_run: false` once the preview reads the way you expect.

**What goes.** Each matching `<uuid>.jsonl` transcript and, where one exists, its `<uuid>/` sidecar directory. Nothing else in the project directory is touched, and `memory/` is not involved.

**Verify.** `claude_code_storage_summary` again: the session count and total bytes should have dropped by what the preview promised.

**Recovery.** None inside the server. A pruned session is gone and `/resume` will not find it. If a conversation might still matter, read it with `claude_code_session_read` or raise the age threshold.

## Retire orphaned Claude Code projects

An orphan is a project directory whose decoded source path no longer exists on disk. It is worth distinguishing two causes before deleting anything.

**Audit.** `claude_code_projects_list` returns the decoded source path and a `source_exists` flag for every project. If the source was **renamed or moved**, the fix is `claude_code_project_relocate`, which renames the project directory to match the new path so that `/resume` keeps finding its history — that is a rename, not a deletion, and it refuses a destination that already exists or a `new_path` that does not resolve. If the source was genuinely **deleted**, the project is disposable.

**Preview.** `claude_code_orphan_projects_prune` with `dry_run` at its default lists the project directories it would remove. By default it skips any orphan containing a `memory/` subdirectory; `include_with_memory: true` includes them, and that is the flag to think hardest about.

**Act.** `dry_run: false`.

**What goes.** The whole project subdirectory — every session transcript in it, its sidecars, and its `memory/` if you asked for that.

**Recovery.** None. Relocate anything you meant to keep _before_ pruning, because after the directory is gone there is nothing left to relocate.

## Prune Claude Desktop artifacts

**Audit.** `claude_desktop_artifacts_health` reports per-artifact metadata with flags for churn, staleness, and unstarred-and-idle. `claude_desktop_storage_summary` gives the area totals.

**Preview.** `claude_desktop_artifacts_prune` with `dry_run` at its default returns the deletion log per workspace. Where more than one workspace exists you must name the one you mean.

**Act.** `dry_run: false`.

**What goes.** Unstarred artifacts beyond the top N by `lastUpdated` (default five): the entry is removed from `artifacts.json` and the corresponding `artifacts/cache_<id>.json` file is deleted. Starred artifacts are never pruned, and the N most recent survive regardless of star status.

**Verify.** `claude_desktop_artifacts_health` again.

## Consolidate a Claude Desktop or Claude Code memory space

Memory is the one area where the deleting tool is the safer one and the writing tool is not. Work in this order.

**Read first.** `claude_desktop_memory_spaces_summary` picks the space; `claude_desktop_memory_list` and `claude_desktop_memory_read` show what is in it. For Claude Code, `claude_code_memory_list` and `claude_code_memory_read` do the same for a project's `memory/`.

**Write with care.** `memory_write` creates or replaces one file's entire contents, and `memory_index_write` replaces the whole `MEMORY.md`. Neither has a `dry_run` — the first call is the change. Have the current contents in front of you before asking for either.

**Retire deliberately.** `memory_delete` removes one file and does have `dry_run: true` by default. It refuses `MEMORY.md` outright: replacing the index is `memory_index_write`'s job, not a delete-and-recreate.

**Recovery.** None for an overwritten file. The audit log records that the write happened and how many bytes it carried, but the sanitiser deliberately does not log the content, so it cannot give you back the previous text.

## Clear audit reports

`claude_desktop_reports_list` (read-only) shows what is in the report directory. `claude_desktop_reports_clear` deletes **every** `cowork-audit-*.md` there, not only the old ones, with `dry_run: true` by default — which is exactly why [the daily audit](daily-audit.md) clears first and writes today's report afterwards.

Nothing outside the `cowork-audit-*.md` pattern is touched, but the pattern is the only protection the directory has: keep `MCP_HOUSEKEEPING_CLAUDE_PATH` pointed at a directory whose purpose is these reports.

## Clean up VSCode chat storage

**Audit.** `vscode_workspaces_list` shows each `workspaceStorage/<id>/` entry with its chat-session count and the workspace URI it belongs to; `vscode_storage_summary` gives totals and size flags; `vscode_sessions_obsolete` lists sessions older than a given age.

**Preview and act.** `vscode_sessions_prune` (`older_than_days`, optional `workspace`, `dry_run: true` by default) removes matching `.json` and `.jsonl` chat sessions and leaves the rest of the workspace entry alone. This is the conservative option and usually the right one.

`vscode_workspace_delete` is not conservative: it removes the entire `workspaceStorage/<id>/` subtree, which holds that workspace's whole storage — not just its chat sessions. Use it only for an entry whose workspace URI no longer exists, confirm the id against `vscode_workspaces_list` first, and read the preview.

**Verify.** `vscode_storage_summary` again.

## Rename a Cowork session

`claude_desktop_session_rename` sets the sidebar `title` on a session record (up to 80 characters), previewing by default. It writes through a temporary file and an atomic rename rather than editing in place, so an interrupted write cannot leave the record half-written.

With `session_id` omitted it picks the most recently active session, because Cowork agents share one server process and the server cannot infer which session is calling it. Where several sessions are active at once, pass the bare UUID to say which you mean. The Cowork sidebar may not show the new title until it reloads.
