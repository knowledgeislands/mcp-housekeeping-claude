# Install mcp-housekeeping-claude

Use this guide to get the server built and answering from an MCP client. Installing it never touches the state it audits: the build writes only to `dist/`, and at the default access level the server cannot delete anything at all.

## Before you begin

- **macOS.** Every directory the server reads is a macOS location, and they are derived from your home directory rather than configured. On another platform the server starts and every tool reports its root as missing.
- **[Bun](https://bun.sh) 1.3 or newer** for installing dependencies and running the repository scripts. `mise.toml` pins `bun = "1.4.1"`; `package.json` declares the same version as its `packageManager`.
- **Node 22 or newer** to run the compiled `dist/` output, which is what an MCP client launches. `mise.toml` pins `node = "lts"`.
- **`du`** on `PATH`, used for disk-usage measurement. It is standard on macOS.
- **A directory for reports.** `MCP_HOUSEKEEPING_CLAUDE_PATH` is the one required environment variable, and the server refuses to start without it.

The package publishes as `@knowledgeislands/mcp-housekeeping-claude` with a `mcp-housekeeping-claude` binary, but the route documented here — and the one [`claude-config-sample.json`](../../../claude-config-sample.json) assumes — is a local checkout you build yourself.

## Build the server

```bash
git clone https://github.com/knowledgeislands/mcp-housekeeping-claude.git
cd mcp-housekeeping-claude
bun install
bun run build
```

`bun install` also runs `prepare`, which configures the husky pre-commit hook. That matters only if you intend to commit to the checkout; it is harmless otherwise.

`bun run build` compiles to `dist/`, and the file an MCP client launches is `dist/mcp-server/index.js`. Rebuild after every `git pull` — the client runs the compiled output, not the source.

## Connect an MCP client

Any stdio MCP client needs the same three things: the command `node`, the **absolute** path to `dist/mcp-server/index.js`, and an `env` block carrying `MCP_HOUSEKEEPING_CLAUDE_PATH`.

For Claude Desktop, add the server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "mcp-housekeeping-claude": {
      "command": "node",
      "args": ["/path/to/mcp-housekeeping-claude/dist/mcp-server/index.js"],
      "env": {
        "MCP_HOUSEKEEPING_CLAUDE_PATH": "/Users/you/Documents/Claude/Projects/Claude Housekeeping"
      }
    }
  }
}
```

[`claude-config-sample.json`](../../../claude-config-sample.json) is that block as a starter file. Replace both paths with real absolute paths — `~` is expanded by the server for `MCP_HOUSEKEEPING_CLAUDE_PATH`, but not by every client for the executable path.

Then restart the client. A stdio server is launched once per session, so a running client will not pick up a new entry, a changed `env` block, or a fresh build until it restarts.

To register the server with a different client, keep the same three things and add whatever that client's configuration requires. The server itself has no client-specific behaviour: it speaks stdio MCP and nothing else.

## Verify the installation

After the restart, the client's tool list should contain `claude_desktop_*`, `claude_code_*`, and `vscode_*` tools. At the default `read` access level that is twenty-seven read-only tools; the fifteen deleting tools are deliberately not registered until you ask for them, as [Configuration](configuration.md) describes.

Ask for something harmless to confirm the round trip:

> "Summarise my Claude Code storage."

That calls `claude_code_storage_summary`, which reads `~/.claude` and writes nothing.

The server also reports its own state to stderr at startup — the access level, each of the four paths, the audit-log mode, whether each root is accessible, and every discovered Cowork workspace id. Where that stderr lands depends on the client; Claude Desktop keeps it in its MCP logs. It is the fastest way to see what the server thinks it is configured with.

From the checkout you can prove the built server boots and serves its full surface without involving a client at all:

```bash
bun run ki:test:smoke
```

That builds `dist/`, launches it over stdio against a temporary directory with the access level raised, and asserts the negotiated protocol version, the legacy fallback, all forty-two tools, and a valid result envelope.

## Update and remove

To update, pull and rebuild, then restart the client:

```bash
git pull
bun install
bun run build
```

To remove the server, delete its entry from the client configuration, restart the client, and delete the checkout. Nothing else is removed by doing so: your reports, the audit log under `<MCP_HOUSEKEEPING_CLAUDE_PATH>/audit/`, and every session, artifact, and memory file the server can see are left exactly as they are. Delete those separately if you want them gone.

## Recover from an installation failure

- **`MCP_HOUSEKEEPING_CLAUDE_PATH environment variable must be set`** — the one required variable is missing. Set it in the client's `env` block, or in the shell for a source run. The server asserts it before doing anything else.
- **`Invalid MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL="…"`** — startup aborts rather than guessing. The allowed values are `read`, `write`, and `destructive`.
- **No tools appear after a restart** — confirm `dist/mcp-server/index.js` exists (that is, that `bun run build` has run since the last pull), that the path in the client configuration is absolute, and that `node` is on the `PATH` the client launches with. A GUI client does not inherit your shell profile.
- **`CLAUDE_DESKTOP_ROOT_PATH: not accessible`** in the boot output — `~/Library/Application Support/Claude/local-agent-mode-sessions` does not exist on this machine, so every `claude_desktop_*` tool will return an error. This is not fatal: the server still starts, and the `claude_code_*` and `vscode_*` tools work independently.

[Troubleshooting](troubleshooting.md) covers the failures that show up after a working install.
