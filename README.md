# mcp-housekeeping-claude

[![CI](https://github.com/knowledgeislands/mcp-housekeeping-claude/actions/workflows/ci.yml/badge.svg)](https://github.com/knowledgeislands/mcp-housekeeping-claude/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@knowledgeislands/mcp-housekeeping-claude.svg)](https://www.npmjs.com/package/@knowledgeislands/mcp-housekeeping-claude) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An MCP (Model Context Protocol) server for housekeeping the three filesystem areas where Claude apps accumulate state on macOS: **Claude Desktop / Cowork sessions**, **Claude Code** (`~/.claude/`), and **VSCode chat sessions**. Each audit step is a dedicated tool; the agent orchestrates the checks and writes a markdown report.

## Documentation

Practical instructions live in [`docs/guides/`](./docs/guides/README.md), grouped by the audience that needs them.

- **[User guides](./docs/guides/user/README.md)** — [install and connect the server](./docs/guides/user/installation.md), [configure what it may do](./docs/guides/user/configuration.md), [ask for a picture of your state](./docs/guides/user/everyday-use.md), and [recover from a failure](./docs/guides/user/troubleshooting.md).
- **[Operator guides](./docs/guides/operator/README.md)** — [the safety model](./docs/guides/operator/safety-model.md) (read this before the first deletion), [cleaning up state](./docs/guides/operator/cleaning-up-state.md) area by area, and [the daily audit](./docs/guides/operator/daily-audit.md).
- **[Developer guides](./docs/guides/developer/README.md)** — [local development](./docs/guides/developer/local-development.md) and [adding a tool](./docs/guides/developer/adding-a-tool.md).

[`CONTRIBUTING.md`](./CONTRIBUTING.md) holds the contributor setup and conventions, [`CLAUDE.md`](./CLAUDE.md) the architecture invariants and security requirements, [`SECURITY.md`](./SECURITY.md) the vulnerability-reporting route, and [`docs/decisions/`](./docs/decisions/README.md) the durable rationale.

## Features

- **Codified audits across three storage areas** — 42 tools spanning Cowork local-agent-mode-sessions (the daily `cowork-filesystem-audit`), `~/.claude/` Claude Code state, and VSCode `workspaceStorage/<id>/chatSessions/`.
- **Access-level gated tools** — every tool maps to one of `read`, `write`, or `destructive`. Set `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL` to the maximum level you want exposed; defaults to `read` only. Levels nest. The level is derived from each tool's MCP annotations (`readOnlyHint` / `destructiveHint`), not its name. (Housekeeping ships only `read` and `destructive` tools today — no `write` tier.)
- **Workspace auto-discovery** (Cowork only) — walks `~/Library/Application Support/Claude/local-agent-mode-sessions/<account>/<workspace>/` and aggregates results across every discovered workspace.
- **Path-safe** — every path is validated against its configured root; memory operations are also confined to their `memory/` subdir.
- **No network, no auth** — pure local filesystem over MCP stdio.

**Quality:** the full test suite enforces 100% statement, branch, function, and line coverage.

## Available Tools

Tools follow the convention `<app>_<resource>_<action>`. Each tool's access level (`read` or `destructive` today) is derived from its MCP annotations (`readOnlyHint` / `destructiveHint`).

This table is the only hand-maintained inventory of the surface; the guides deliberately do not duplicate it. `scripts/smoke.ts` holds the wire-level list the smoke test asserts against.

### `claude_desktop_*` — read-only (`read` level)

| Tool | Purpose |
| --- | --- |
| `claude_desktop_storage_summary` | Counts, total disk usage, JSON total, top 5 largest dirs, oldest/newest, flags. |
| `claude_desktop_sessions_obsolete` | Sessions older than N days; oldest 10 with combined size, flags. |
| `claude_desktop_artifacts_health` | Per-artifact metadata + flags (high churn, stale, unstarred + idle). |
| `claude_desktop_outputs_obsolete` | Non-empty `outputs/`/`uploads/` in sessions older than N days. |
| `claude_desktop_backups_summary` | `.claude.json.backup.*` count, size, dates with thresholds. |
| `claude_desktop_memory_spaces_summary` | Per-space memory file counts + first 10 lines of `MEMORY.md`. |
| `claude_desktop_plugins_inventory` | Knowledge-work + rpm plugins with versions/dates. |
| `claude_desktop_project_cache_status` | `.project-cache/` entries with last-sync dates. |
| `claude_desktop_debug_info` | `debug/` size, entry count, oldest entry age. |
| `claude_desktop_memory_list` | List `.md` files + `MEMORY.md` content for one space. |
| `claude_desktop_memory_read` | Read one memory file. |
| `claude_desktop_reports_list` | List existing `cowork-audit-*.md` reports in `MCP_HOUSEKEEPING_CLAUDE_PATH`. |
| `claude_desktop_workspaces_list` | List discovered `<account>/<workspace>` workspace ids. |

### `claude_desktop_*` — destructive (`destructive` level)

| Tool | Purpose |
| --- | --- |
| `claude_desktop_artifacts_prune` | Delete unstarred artifacts beyond top N (default 5) by `lastUpdated`. |
| `claude_desktop_reports_clear` | Delete every `cowork-audit-*.md` from `MCP_HOUSEKEEPING_CLAUDE_PATH`, with `dry_run`. |
| `claude_desktop_report_write` | Save `cowork-audit-YYYY-MM-DD.md` to `MCP_HOUSEKEEPING_CLAUDE_PATH`. |
| `claude_desktop_memory_write` | Create/overwrite a memory file in `spaces/<space_id>/memory/<name>.md`. |
| `claude_desktop_memory_delete` | Retire a memory file (cannot delete `MEMORY.md`). |
| `claude_desktop_memory_index_write` | Replace `MEMORY.md` for a space. |
| `claude_desktop_session_rename` | Set the sidebar `title` on a session record (≤80 chars, emoji ok), with `dry_run`.† |

† Auto-picks the most-recently-active session when `session_id` is omitted — Cowork agents share one MCP server, so the server cannot infer the calling session from execution context. Pass `session_id` (bare UUID) to disambiguate when multiple sessions are active concurrently.

### `claude_code_*` — read-only (`read` level)

| Tool | Purpose |
| --- | --- |
| `claude_code_sessions_discover` | Confirm the adapter can inspect one physical repository; reports its capabilities and session count. |
| `claude_code_sessions_list` | Content-minimised provenance for the sessions whose encoded project dir matches one repository. |
| `claude_code_sessions_checkpoint` | Content-minimised, provenance-preserving checkpoint for incremental KI acquisition; writes nothing. |
| `claude_code_projects_list` | Projects with session counts, bytes, decoded source path, orphan flag. |
| `claude_code_storage_summary` | Aggregate counts + flags; surfaces orphan-project totals. |
| `claude_code_sessions_obsolete` | Sessions older than N days (with sidecar dir bytes). |
| `claude_code_global_status` | `history.jsonl`, `settings.cleanupPeriodDays`, `.last-cleanup`, top-level dirs, freshness signal. |
| `claude_code_session_read` | Preview head/tail of a session JSONL. |
| `claude_code_memory_list` | List memory files in `<project>/memory/`. |
| `claude_code_memory_read` | Read one memory file. |

### `claude_code_*` — destructive (`destructive` level)

| Tool | Purpose |
| --- | --- |
| `claude_code_sessions_prune` | Delete sessions older than N days (+ sidecar dirs), with `dry_run`. |
| `claude_code_project_relocate` | Rename a project subdir to match a new source path (fixes `/resume` after a rename). |
| `claude_code_orphan_projects_prune` | Delete project subdirs whose decoded source path no longer exists. |
| `claude_code_memory_write` | Create/overwrite a memory file. |
| `claude_code_memory_delete` | Retire a memory file. |
| `claude_code_memory_index_write` | Replace `MEMORY.md`. |

### `vscode_*` — read-only (`read` level)

| Tool                       | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `vscode_workspaces_list`   | List workspaceStorage entries with chat-session counts and URIs. |
| `vscode_storage_summary`   | Aggregate workspace/session counts + size flags.                 |
| `vscode_sessions_obsolete` | Chat sessions older than N days.                                 |
| `vscode_session_read`      | Preview head/tail of a `.json`/`.jsonl` chat session.            |

### `vscode_*` — destructive (`destructive` level)

| Tool                      | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `vscode_workspace_delete` | Delete an entire `workspaceStorage/<id>/` subtree. |
| `vscode_sessions_prune`   | Delete chat sessions older than N days.            |

## Example Conversations

Concrete asks you might make of Claude with this server connected.

**Run today's audit:**

> "Run the daily cowork filesystem audit and write today's report."

Claude clears yesterday's report via `claude_desktop_reports_clear`, runs every read-only check in parallel (storage summary, obsolete sessions, artifact health, backups, memory spaces, plugins, cache, debug info), then writes `cowork-audit-YYYY-MM-DD.md` to `MCP_HOUSEKEEPING_CLAUDE_PATH` via `claude_desktop_report_write`. [The daily audit](./docs/guides/operator/daily-audit.md) gives the full ordering and what each step needs.

**Audit before cleaning:**

> "Show me sessions older than 30 days and tell me which ones still have non-empty outputs or uploads."

Claude calls `claude_desktop_sessions_obsolete` followed by `claude_desktop_outputs_obsolete` — both read-only — so you see the picture before any destructive action. No data is modified.

**Consolidate a memory space:**

> "Pick the memory space with the most files and show me its MEMORY.md plus the first few memory files before we consolidate."

Claude uses `claude_desktop_memory_spaces_summary` to find the candidate, then `claude_desktop_memory_list` + `claude_desktop_memory_read` to surface the actual content for review. Writes (`memory_write`, `memory_delete`, `memory_index_write`) only happen after you approve the plan.

**Prune accumulated artifacts:**

> "Free some disk — drop unstarred artifacts beyond the top 5 most recently updated."

Claude calls `claude_desktop_artifacts_prune` (destructive; requires `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL=destructive`). Starred artifacts are always preserved and the top N most recent are kept regardless of star status.

## Directory Structure

```text
├── claude-config-sample.json   # Example Claude Desktop config
├── package.json
├── tsconfig.json               # Base TS config
├── tsconfig.build.json         # Build config (emits to dist/)
├── .env.example                # Env template (copy to .env.development)
├── docs/
│   ├── guides/                 # Practical instructions by audience (user, operator, developer)
│   ├── decisions/              # Decision Records
│   └── roadmap/                # Work items
├── src/
│   ├── config/index.ts         # loadConfig(env?) → Config; no import-time env reads
│   ├── mcp-server/index.ts     # MCP server entry — loads config, registers every tool
│   ├── tools/                  # Thin MCP tool definitions (validate args, call main/, map result)
│   │   ├── index.ts            #   barrel re-exporting register<group>Tools
│   │   ├── claude-code/index.ts
│   │   ├── claude-desktop/index.ts
│   │   └── vscode/index.ts
│   ├── main/                   # Real implementation (usable from a script); cfg slice as first arg
│   │   ├── claude-code/        #   index.ts barrel + audit.ts, memory.ts
│   │   ├── claude-desktop/     #   index.ts barrel + audit.ts, memory.ts, report.ts, sessions.ts
│   │   └── vscode/             #   index.ts barrel + audit.ts
│   └── utils/                  # Cross-MCP helpers: access-level gate, audit log, path safety, du, JSON
└── dist/                       # Build output (gitignored, created by `bun run build`)
    └── mcp-server/index.js     # Compiled entry point used by Claude Desktop
```
