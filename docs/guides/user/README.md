# User guides

These guides are for anyone who wants `mcp-housekeeping-claude` connected to their own MCP client, reporting on what Claude Desktop, Claude Code, and VSCode have accumulated on their machine. The server is local: it opens no network connection, performs no authentication, and runs with exactly the privileges of the user who launched it.

Everything described here works at the default `read` access level, where the server registers only read-only tools and the deleting tools are not exposed to the model at all. When you want to delete something, the [operator guides](../operator/README.md) take over.

Read [Installation](installation.md) and then [Configuration](configuration.md) the first time. After that, come back to whichever guide matches the task in front of you.

## Install and connect the server

[Installation](installation.md) covers the prerequisites, building `dist/mcp-server/index.js` from a checkout, and giving an MCP client the three things it needs: a command, an absolute path, and one required environment variable. It ends with the checks that prove the server booted and the tools arrived, and with how to update or remove it again.

## Decide what the server may do

[Configuration](configuration.md) covers every environment variable the server reads, which target directories are fixed rather than configurable, how to choose an access level, what the audit log records and where it lands, and how Cowork workspaces are discovered — including when a tool will insist that you name the workspace you mean.

## Ask for a picture of your state

[Everyday use](everyday-use.md) is the guide to reach for once the server is connected. It covers what each of the three areas actually holds, the read-only questions worth asking about them, how to read the flags and the `workspaces` array in a result, and where the read-only surface stops and an operator decision begins.

## Recover from a failure

[Troubleshooting](troubleshooting.md) covers the failures a first-time reader actually hits — a server that will not start, tools that never appear, an empty workspace count, a path refusal, a missing directory — and what to do about each one.
