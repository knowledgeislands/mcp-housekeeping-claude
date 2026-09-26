# Troubleshooting

Use this guide when the server will not start, a tool is missing, or a call fails in a way that is not obvious. Every message the server produces names the value it rejected or the root it protected, so the message itself is usually the fastest route to the fix.

## The server will not start

**`MCP_HOUSEKEEPING_CLAUDE_PATH environment variable must be set`** — this is the only required variable and it is asserted before anything else runs. Set it in the client's `env` block, or in the shell for a source run. Every other root is fixed, so this is the one path you have to supply.

**`Invalid MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL="…". Allowed: read, write, destructive`** — the value was not one of the three. The server aborts rather than falling back to a default, so a typo in an `env` block takes the server down instead of silently running at an unintended level.

**`Invalid MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG="…" — expected one of: off, writes, all`**, or an `expected a non-negative integer` message for either audit-log number — the same principle applied to the audit-log settings.

## No tools appeared

The server boots but the client shows nothing. In order of likelihood:

1. **The client was not restarted.** A stdio MCP server is launched once per client session; a new entry, a changed `env` block, and a fresh build are all invisible until the client restarts.
2. **`dist/` is missing or stale.** The client runs the compiled output. Run `bun run build` in the checkout after every `git pull`.
3. **The path is not absolute, or `node` is not found.** A GUI client does not inherit your shell profile, so a `node` installed only through a shell-managed version manager may not be on its `PATH`.

## Only some tools appeared

This is the access-level gate working as intended. At the default `read` level the fifteen deleting tools are never registered, so they cannot appear in the tool list and cannot be called. Raise `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL` to `destructive` and restart the client, having read [The safety model](../operator/safety-model.md) first.

A tool that exists but returns an error on every call is a different problem — usually a missing root, covered next.

## A whole tool group fails

**Boot-time `CLAUDE_DESKTOP_ROOT_PATH: not accessible`** — `~/Library/Application Support/Claude/local-agent-mode-sessions` does not exist on this machine, so every `claude_desktop_*` tool will return an error. The server deliberately still starts; `claude_code_*` and `vscode_*` are independent and unaffected. The same message can appear for `CLAUDE_CODE_ROOT_PATH` or `VSCODE_WORKSPACE_STORAGE_ROOT_PATH` with the same consequence for their groups.

The startup lines are written to stderr, where the client keeps its MCP logs. They report the access level, all four paths, the audit-log mode, each root's accessibility, and every discovered workspace id — reading them answers most configuration questions outright.

## `workspace_count: 0`, or a tool asks for a workspace

**A count of zero** means no `<account>/<workspace>/` directories carrying the marker files were discovered. Check the startup lines first: they list every workspace id the server found. If the list is empty, list `~/Library/Application Support/Claude/local-agent-mode-sessions` and confirm it holds directories two levels deep containing `.claude.json`, `artifacts.json`, `spaces.json`, `cowork_settings.json`, or `local_*.json`.

**A tool insisting on a `workspace` argument** means more than one workspace was discovered. The read-only audits aggregate across all of them, but anything that acts on one — and the memory list and read tools — will not guess. Run `claude_desktop_workspaces_list`, then pass the id you mean as `"<account>/<workspace>"`.

## `Path escapes root: "<input>"`

The requested path resolved outside the root that tool is allowed to touch. This is the containment check refusing, and it is not configurable. Use a plain name with no leading `..`, no `/` or `\` separators, and no absolute path. Memory file names must also end in `.md`, and a Claude Code session name must be `<uuid>.jsonl`.

The check is applied lexically and again against the resolved real path, so a symlink pointing out of the root is refused for the same reason a `../` prefix is.

## A name was rejected before the call ran

Identifier inputs are constrained by schema, not only at the point of use, and the schemas are strict — an unknown argument is rejected rather than ignored. Common refusals:

- **`Memory file name must end with .md: "<name>"`** — memory tools work only on Markdown files.
- **`Session ID must be a UUID without a file extension`**, or **`Session name must be "<uuid>.jsonl"`** — the Claude Code session identifier form depends on the tool; the message names the one expected.
- **`Project dir not found: "<project>"`** — the project argument must be the encoded directory name as it appears under `~/.claude/projects/`, which `claude_code_projects_list` returns, not the human-readable source path.
- **`Memory directory not found for project "<project>"`** or **`for space "<space_id>"`** — the project or space exists, but it has no `memory/` directory yet.

## Something was deleted that you wanted

There is no undo. The deleting tools use `fs.unlink` and `fs.rm`, which do not route through the Trash. [The safety model](../operator/safety-model.md) covers what recovery is actually available — a backup, a `dry_run` you can read after the fact, and the audit log that records what was called — and how to avoid needing it.

## Still stuck

Preserve the failing arguments and error, confirm the tool stayed inside its configured root and access level, and report any path-containment or unintended-deletion concern privately rather than in a public issue.

The boot-time stderr lines are the best evidence about configuration, and the audit log at `<MCP_HOUSEKEEPING_CLAUDE_PATH>/audit/audit.jsonl` is the best evidence about what was actually called. For behaviour rather than configuration, `CLAUDE.md` documents the architecture invariants and security requirements the tools are built to, and the tool descriptions in the running server are authoritative over any document, including this one.
