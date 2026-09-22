# Configure mcp-housekeeping-claude

Use this guide to decide what the server may do and where it puts what it writes. Configuration is entirely environment variables: there is no configuration file, and the directories the server inspects are not configurable at all.

## Before you begin

Configuration reaches the server through its MCP client's `env` block, or through the shell for a source run. A value already present in the environment always beats any `.env` file, so the client's `env` block wins in every case that matters. [Local development](../developer/local-development.md) covers the file-based path, which exists for source runs only.

Changing any of these requires a client restart, because a stdio server is launched once per session.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `MCP_HOUSEKEEPING_CLAUDE_PATH` | yes | Absolute path or `~/…` to the directory where audit reports are written. |
| `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL` | no | Maximum tool access level to register. One of `read` (default), `write`, `destructive`. |
| `MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG` | no | Audit-log scope. One of `off`, `writes` (default), `all`. |
| `MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG_PATH` | no | Path to the JSONL audit log. Default `<MCP_HOUSEKEEPING_CLAUDE_PATH>/audit/audit.jsonl`. |
| `MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG_MAX_BYTES` | no | Size-based rotation threshold in bytes. Default `10485760` (10 MiB); `0` disables rotation. |
| `MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG_KEEP` | no | Number of rotated audit-log files to retain. Default `5`. |
| `NODE_ENV` | no | Development convention; controls which `.env` files a source run loads. |

An invalid value for any typed variable aborts startup with a message naming the variable and the allowed values. The server never silently falls back to a default when you have asked for something it does not recognise.

[`.env.example`](../../../.env.example) is the annotated template for the same set.

## Choose an access level

`MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL` decides which tools are registered when the server boots. Levels nest:

- **`read`** (the default) registers the twenty-seven read-only tools. The server cannot delete, rename, or write anything, because the tools that do so are not exposed to the model at all.
- **`write`** is reserved for non-destructive mutations. No tool in this server occupies that tier today, so it currently registers exactly what `read` does.
- **`destructive`** additionally registers the fifteen tools that delete, prune, rename, or overwrite — including report writing and memory writing.

A tool's level is derived from its MCP annotations (`readOnlyHint` and `destructiveHint`), not from its name, and a tool with missing or partial annotations is treated as `destructive` rather than assumed safe. If you leave the level at `read`, no amount of prompting can make the server delete something: the capability is absent from the session.

Raise the level only for the session in which you intend to clean up, and read [The safety model](../operator/safety-model.md) before you do.

## Understand what is not configurable

Three of the four directories the server touches are computed from your home directory and cannot be overridden:

- **Claude Desktop / Cowork sessions** — `~/Library/Application Support/Claude/local-agent-mode-sessions`
- **Claude Code** — `~/.claude`
- **VSCode workspace storage** — `~/Library/Application Support/Code/User/workspaceStorage`

That is deliberate: it means a misconfiguration cannot point the server's deleting tools at an arbitrary directory. The only path you choose is `MCP_HOUSEKEEPING_CLAUDE_PATH`, where reports and the audit log are written. Choose a directory you are content for the server to manage, because `claude_desktop_reports_clear` deletes every `cowork-audit-*.md` it finds there.

## Configure the audit log

The audit log is an append-only JSONL record of tool invocations, one object per call: timestamp, server name, tool name, derived access level, success, duration, error message where relevant, and the arguments.

`MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG` chooses the scope — `off` for none, `writes` (the default) for anything that is not read-only, `all` for every call including reads. The default records exactly the calls you would want to reconstruct after a deletion you did not expect.

Arguments are sanitised before they are written: a `content` field is replaced by its byte count rather than logged, credentials in URL userinfo are redacted, and anything still over 4096 characters is truncated with a preview. A failure to write the log is reported to stderr and never fails the tool call, so the log is evidence rather than a control.

The log rotates by size: when `audit.jsonl` exceeds `MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG_MAX_BYTES`, it becomes `audit.jsonl.1` and earlier rotations shift up, with `MCP_HOUSEKEEPING_CLAUDE_AUDIT_LOG_KEEP` deciding how many survive.

## Understand Cowork workspaces

The Claude Desktop tools work over discovered workspaces rather than one fixed directory. The server walks `~/Library/Application Support/Claude/local-agent-mode-sessions/<account>/<workspace>/` and treats a directory as a workspace when it contains any of `.claude.json`, `artifacts.json`, `spaces.json`, `cowork_settings.json`, or `local_*.json`. If the root itself carries those marker files, it is treated as a single workspace with the id `.`.

Read-only audit tools aggregate across every discovered workspace and return a `workspaces` array. The destructive tools, and the memory list and read tools, take an optional `workspace` argument of the form `"<account>/<workspace>"` — and **require** it once more than one workspace exists, rather than picking one for you.

`claude_desktop_workspaces_list` shows the discovered ids, and the server also prints them to stderr at startup. If that list is empty, [Troubleshooting](troubleshooting.md) covers why.
