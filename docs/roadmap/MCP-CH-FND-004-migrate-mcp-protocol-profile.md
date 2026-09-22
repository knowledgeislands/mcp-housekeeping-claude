---
id: MCP-CH-FND-004
area: FND
title: Migrate MCP protocol profile
theme: foundation-tooling
horizon: next
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-02T01:12:46Z
updated_at: 2026-09-22T06:55:00Z
---

## Goal

Move mcp-housekeeping-claude to the supported MCP 2026-07-28 server profile without breaking its existing tool surface or legacy clients.

## Context

The Harness KI-HARNESS-GOV-006 rollout now derives protocol applicability from the runtime dependency. This repository still declares @modelcontextprotocol/sdk major 1 and remains conformant to the legacy 2025-11-25 profile. The accepted mcp-git-audit pilot proves the modern package family, per-connection stdio factory, SDK-owned discovery, complete result envelopes, smoke boundary, and deliberate compatibility fallback.

## Boundary

Do not change the public tool contract, remove legacy compatibility without evidence, or treat the Harness rollout as receiver acceptance. This record captures receiver-owned migration work only; prioritisation, implementation, verification, acceptance, release, and publication remain in this repository.

The forty-two tool names, their input and output schemas, and their annotations are fixed for this item. Access gating, the audit log, the `dry_run` default on destructive tools, and the generated mcporter client are all out of scope except where a type import has to move. Restructuring `src/utils/utils.ts` into the pilot's `errors.ts` / `results.ts` split is deliberately excluded: the protocol profile does not require it and the rubric inspects helper definitions wherever they live.

## Shaping

Adopt the accepted pilot as the first comparison baseline: move to the v2 server package family, replace the legacy stdio transport with a per-connection serveStdio factory, add resultType: "complete" to synchronous result helpers, retain deliberate legacy fallback, and prove SDK-owned discovery through the repository smoke boundary.

The promotion condition set at Soon - reviewing the exact dependency delta, entry-point change, compatibility boundary, and receiver-specific smoke assertions against this repository's current source - was discharged on 2026-09-22, and the item moved Soon to Next on that review. The findings are recorded in `## Current state` and the concrete delta in `## Steps`.

## Current state

`package.json` declares `@modelcontextprotocol/sdk` at `^1.30.0`, which selects the legacy 2025-11-25 profile, and pins `zod` to an exact `4.4.3`. `.ki.toml` carries a `[skills.ki-engineering] dependency_holds` entry explaining that zod 4.5.4 and later are incompatible with the v1 SDK schema types - a hold that exists only because of the v1 SDK and becomes untrue the moment it is removed.

Eight source files import from the legacy package: `src/mcp-server/index.ts` takes `McpServer` and `StdioServerTransport`, `src/utils/access-level.ts` takes `McpServer` and `ToolAnnotations`, the three `src/tools/*/index.ts` files and the two `src/tools/*/schemas.test.ts` files take the `McpServer` type, and `scripts/smoke.ts` takes `Client` and `StdioClientTransport`.

`src/mcp-server/index.ts` constructs one module-scope `McpServer`, registers all three tool groups against it, and then - inside an async `main()` that first reports root accessibility and workspace discovery on stderr - connects a single `StdioServerTransport`. There is no per-connection factory, so there is nothing for the modern boundary to pin per era.

`src/utils/utils.ts` defines `errorResult` and `jsonResult` without the `resultType` discriminator the modern profile requires. The `ki-repo-mcp` PROTO-1 rubric counts helper definitions per file and requires at least as many `resultType: "complete"` literals in that same file, so both helpers must carry it.

`scripts/smoke.ts` connects a v1 client, lists tools, and asserts the forty-two expected names and the presence of an `inputSchema`. It makes no discovery, protocol-version, result-envelope, or legacy-fallback assertion, so it cannot presently prove the live boundary the standard says the smoke test is responsible for proving.

Every gate is green on the pre-migration baseline: typecheck clean, Biome clean, 315 tests in 15 files passing, coverage thresholds met, `ki repo audit` PASS at 15 skills, and the smoke test listing 42 tools. That is the legacy-profile pass the acceptance boundary expects to see before migration.

## Steps

- [ ] Replace `@modelcontextprotocol/sdk` with `@modelcontextprotocol/server` 2.0.0 in `dependencies`, and add `@modelcontextprotocol/client` 2.0.0 to `devDependencies` (the client does not select the server profile and is only used by the smoke boundary).
- [ ] Raise `zod` to the range the pilot runs (`^4.6.5`) and delete the now-false `dependency_holds` entry in `.ki.toml`, because the hold named the v1 SDK as its cause.
- [ ] Repoint the `McpServer` and `ToolAnnotations` type imports in `src/utils/access-level.ts`, `src/tools/claude-code/index.ts`, `src/tools/claude-desktop/index.ts`, `src/tools/vscode/index.ts`, and the two `src/tools/*/schemas.test.ts` files at `@modelcontextprotocol/server`.
- [ ] Add `resultType: 'complete' as const` to both `errorResult` and `jsonResult` in `src/utils/utils.ts`, leaving their existing `isError`, `structuredContent`, and `content` fields untouched.
- [ ] Extend `src/utils/utils.test.ts` so both helpers are asserted to carry the discriminator, keeping the 100 per cent coverage thresholds satisfied.
- [ ] Rework `src/mcp-server/index.ts` into a per-connection `createServer()` factory that constructs the `McpServer`, installs the access-gated register, and registers all three tool groups, then hand that factory to `serveStdio(createServer, { legacy: 'serve', onerror })` from `@modelcontextprotocol/server/stdio`. Keep the existing stderr configuration banner and the async accessibility and workspace-discovery preamble ahead of the boundary, and keep a `SIGINT` path that closes the returned handle.
- [ ] Rewrite `scripts/smoke.ts` against `@modelcontextprotocol/client`: assert the modern era, the negotiated `2026-07-28` version, a `server/discover` result with `resultType: 'complete'` and the correct `serverInfo` name, the unchanged forty-two-name tool surface, a successful read-only tool call returning a non-error envelope, a malformed-argument call being rejected, and a second client opened without version negotiation staying on the legacy era and seeing the identical tool count.
- [ ] Leave `EXPECTED_TOOLS` unchanged. If a name moves, the migration has broken the public contract and must stop.
- [ ] Run every gate in `## Verify` and record the outcomes in the review packet.

## Files touched

`package.json`, `bun.lock`, `.ki.toml`, `src/mcp-server/index.ts`, `src/utils/utils.ts`, `src/utils/utils.test.ts`, `src/utils/access-level.ts`, `src/tools/claude-code/index.ts`, `src/tools/claude-desktop/index.ts`, `src/tools/vscode/index.ts`, `src/tools/claude-code/schemas.test.ts`, `src/tools/claude-desktop/schemas.test.ts`, `scripts/smoke.ts`.

## Verify

- `bunx tsc -p tsconfig.json --noEmit` exits clean over source, tests, and scripts.
- `bunx @biomejs/biome check .` reports no error.
- `bun run test` passes every test file.
- `bun run test:coverage` passes and still meets the 100 per cent line, function, branch, and statement thresholds.
- `bun run build` emits `dist/` without error.
- `bun run ki:test:smoke` reports modern discovery, legacy fallback, 42 tools, and a valid result envelope.
- `ki repo audit --concise --progress never` still reports PASS at 15 skills, with `ki-repo-mcp` PROTO-1 now reporting the modern 2026-07-28 profile rather than the legacy one.

## Dependencies / blocks

Nothing blocks this and this blocks nothing, so `blocks` and `blocked_by` stay empty. The mcp-git-audit migration is already accepted and its code already exists, so it is read-only reference evidence rather than a build-order dependency. KI-HARNESS-GOV-006 derives protocol applicability from whatever runtime dependency it finds, so the Harness needs nothing from this repository first and grants no acceptance to it afterwards.

MCP-CH-FND-006 (audience-centric guides) touches `README.md` and `docs/guides/`, which this item does not, so the two can run in either order. MCP-CH-FND-005, MCP-CH-OPS-001, and MCP-CH-OPS-002 are unrelated.

The one real constraint is external and already satisfied: `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.0.0 are published and resolvable, as the pilot's installed tree shows.

## Documentation impact

### Decision Records

No decision record is needed. `ki-repo-mcp` already records both supported profiles and the migration rule in its `standards-mcp-servers.md`, and the accepted mcp-git-audit migration is the precedent; adopting the modern profile here is conformance with an existing decision rather than a new one. A record becomes owed only if this repository decides to keep the legacy fallback after the rest of the fleet retires it, or decides not to migrate at all.

### Specifications

No behaviour-level contract changes. The forty-two tool names, their input and output schemas, and their annotations are unchanged, and the access gate and `dry_run` defaults are untouched. The wire result gains the `resultType` discriminator the modern protocol requires, which the v2 client validates and then lifts away before a caller sees the result, so no consumer-visible shape moves.

### Guides

No human guidance changes. `README.md`, `CONTRIBUTING.md`, and `CLAUDE.md` name neither the SDK package nor the transport, and the documented install, configuration, and run commands are identical after the migration. MCP-CH-FND-006 owns the guide restructure and will describe whatever entry point exists when it runs.

### Roadmap

No follow-on roadmap change is expected. Retiring the deliberate legacy fallback is a separate, later decision that needs fleet evidence this item does not have and must not manufacture; it would be raised as its own record at the time. If the migration exposes a tool whose result shape cannot carry the discriminator honestly, that is a separate item raised at the time rather than a silent contract change here.

## Discussion

### Source evidence

The portable profile and rubric live in ki-repo-mcp; the accepted mcp-git-audit migration is implementation evidence, not a patch to copy mechanically. Receiver-specific authentication, configuration, generated client, and tool-envelope differences remain local design inputs.

The concrete differences found on review are that this server has a required `MCP_HOUSEKEEPING_CLAUDE_PATH` and three independent root paths rather than a safe-root list, that it performs async accessibility and workspace-discovery reporting before serving, that its result helpers live in `src/utils/utils.ts` rather than a dedicated `results.ts`, and that its tool surface is forty-two names across three groups rather than twelve across four. None of those differences changes the shape of the migration; they change what the smoke test has to set up and where the discriminator has to be added.

### Compatibility decision

`legacy: 'serve'` is chosen deliberately rather than by default. This server is consumed through mcporter and directly by local runtimes whose client versions are not controlled from here, and the standard explicitly permits a modern server to retain legacy client fallback while the fleet migrates. The smoke test asserts the fallback rather than assuming it, so a future decision to pass `legacy: 'reject'` has to break a test on purpose. Removing the fallback without fleet evidence is out of bounds for this item.

### Acceptance boundary

The modern profile is not claimed until this repository's package, result helpers, stdio entry point, focused tests, live smoke, and ki-repo-mcp audit agree. A passing legacy audit before migration remains expected, and the baseline recorded in `## Current state` is that pass.
