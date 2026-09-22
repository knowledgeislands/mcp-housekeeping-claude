# mcp-housekeeping-claude guides

This server reads the three filesystem areas where Claude apps accumulate state on macOS — Claude Desktop / Cowork sessions, Claude Code under `~/.claude/`, and VSCode chat sessions — and, when you configure it to, deletes from them. These guides explain how to install it, run it, clean up with it without losing something you wanted, and change its code.

Start with the audience you belong to.

## Using the server

[User guides](user/README.md) are for anyone who wants this server answering questions about their own machine. They cover building it and connecting it to an MCP client, the environment variables that decide what it may do, what to ask it for day to day, and how to recover from the failures a first run produces. Everything in them works at the default `read` access level, where the server cannot delete anything.

## Cleaning up with it

[Operator guides](operator/README.md) are for anyone running the server at the `destructive` access level, where it deletes sessions, artifacts, memory files, reports, and whole VSCode workspace directories. They cover the safety model — what the server refuses, what it keeps, and what cannot be undone — the per-area cleanup procedures, and the daily audit that produces a written report. Read [the safety model](operator/safety-model.md) before the first deletion, not after it.

## Changing the server

[Developer guides](developer/README.md) are for anyone changing this repository. They cover running the server from source with the inspector and the test suite, and adding a tool so that it lands with the right annotations, the right path containment, and every place that tracks the tool surface updated in the same change.

## What lives elsewhere

A guide answers how. The neighbouring documents answer other questions, and these guides link them rather than restating them.

- [Decision Records](../decisions/README.md) answer why. Where a guide explains a choice at length, the durable rationale belongs there.
- [Roadmap items](../roadmap) answer when, covering behaviour planned rather than delivered.
- [`CLAUDE.md`](../../CLAUDE.md) and [`AGENTS.md`](../../AGENTS.md) hold the architecture invariants and security requirements the code must satisfy. A developer guide tells you how to work within them; it does not restate them.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) holds contributor setup, the commit convention, the testing convention, and the pre-PR checklist.
- [`SECURITY.md`](../../SECURITY.md) holds the vulnerability-reporting route and what is in and out of scope.

## Why there is no tool-inventory guide

The server registers forty-two tools and the [README catalogue](../../README.md#available-tools) tabulates them, because a hand-maintained list of forty-two names drifts from the code and two hand-maintained lists drift twice as fast. That is not hypothetical: the catalogue spent several releases claiming thirty-nine tools while `src/tools/` registered forty-two.

So these guides never restate the catalogue. They explain the naming convention (`<app>_<resource>_<action>`), the annotation-derived access level that decides whether a tool is registered at all, and how to read the live surface from the running server — your MCP client's tool list, or `bun run ki:server:mcp:inspect` against the source. Where a guide needs one specific tool, it names that tool and what it does, and leaves the inventory to the one place that keeps it.
