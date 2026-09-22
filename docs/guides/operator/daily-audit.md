# The daily audit

Use this guide to run the audit that produces a written report of what has accumulated. It is the routine this server was built for: clear yesterday's report, run every read-only check, prune what the checks found, consolidate one memory space, and write today's `cowork-audit-YYYY-MM-DD.md`.

## Before you begin

The audit needs `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL=destructive`, even though most of its steps only read. Writing the report and clearing the previous one are both destructive-annotated operations, so at the default `read` level the run stops at step 2 with a report it cannot save.

`MCP_HOUSEKEEPING_CLAUDE_PATH` must point at the directory where reports live. Step 1 deletes every `cowork-audit-*.md` in it.

Read [The safety model](safety-model.md) first if you have not. Steps 1, 3, and 6 delete or overwrite.

## The run

1. **Clear yesterday's report** — `claude_desktop_reports_clear`. It matches `cowork-audit-*.md` in the report directory and previews by default; pass `dry_run: false` to actually remove them. Clearing first is what keeps the directory holding one current report rather than a year of them.
2. **Run every read-only check** — `claude_desktop_storage_summary`, `claude_desktop_sessions_obsolete`, `claude_desktop_artifacts_health`, `claude_desktop_outputs_obsolete`, `claude_desktop_backups_summary`, `claude_desktop_memory_spaces_summary`, `claude_desktop_plugins_inventory`, `claude_desktop_project_cache_status`, and `claude_desktop_debug_info`. These are independent and can run in parallel. Their flags are what the report is about.
3. **Prune what the checks found** — `claude_desktop_artifacts_prune` removes unstarred artifacts beyond the top five by `lastUpdated`. Read its preview before passing `dry_run: false`.
4. **Choose a memory space to consolidate** — `claude_desktop_memory_spaces_summary` again, or its result from step 2, shows which space has grown.
5. **Review that space's memory** — `claude_desktop_memory_list` and `claude_desktop_memory_read`. Read before writing; the write tools have no preview.
6. **Consolidate** — `claude_desktop_memory_write`, `claude_desktop_memory_delete`, and `claude_desktop_memory_index_write` as the review calls for. Write and index-write take effect on the first call; delete previews by default.
7. **Write the report** — `claude_desktop_report_write` saves `cowork-audit-YYYY-MM-DD.md` into the report directory, dated today unless you pass an explicit `YYYY-MM-DD`.

Running the whole sequence is one request rather than seven:

> "Run the daily cowork filesystem audit and write today's report."

The order matters more than the phrasing. Clearing after writing would delete the report just produced, and consolidating memory before reading it is how a durable note gets overwritten with a summary of itself.

## Extending it beyond Cowork

The choreography above covers the Claude Desktop area only, because the report is about that tree. The Claude Code and VSCode areas have their own read-only summaries — `claude_code_storage_summary`, `claude_code_projects_list`, `vscode_storage_summary` — and nothing stops you asking for those in the same session and including them in the report body. Their cleanup is deliberately not part of this routine: pruning transcripts is a decision to take on its own terms, and [Cleaning up state](cleaning-up-state.md) covers it.

## Verify the run

- `claude_desktop_reports_list` shows exactly one report, dated today.
- The flags in today's report should account for the pruning done in step 3: an artifact count that did not move means the prune previewed rather than acted.
- With the audit log at its default `writes` scope, `<MCP_HOUSEKEEPING_CLAUDE_PATH>/audit/audit.jsonl` holds one line per non-read call in the run — the clear, the prune, each memory write, and the report write.

## When it goes wrong

- **The report was cleared but not rewritten.** Yesterday's report is gone and today's was never written. There is no recovery for the deleted file; re-run steps 2 and 7 to produce a current one.
- **The run stops at the report step** with the tool unavailable. The access level is `read`. Raise it and restart the client.
- **Every `claude_desktop_*` step fails.** The sessions root is not accessible on this machine — see [Troubleshooting](../user/troubleshooting.md).
- **A step insists on a `workspace` argument.** More than one Cowork workspace was discovered; `claude_desktop_workspaces_list` names them.
