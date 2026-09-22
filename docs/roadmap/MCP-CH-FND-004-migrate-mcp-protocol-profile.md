---
id: MCP-CH-FND-004
area: FND
title: Migrate MCP protocol profile
theme: foundation-tooling
horizon: next
status: awaiting-review
blocks: []
blocked_by: []
baseline_ref: 56dfca2e9ab84d756ae8c2e8e30cb486d49c4897
created_at: 2026-09-02T01:12:46Z
updated_at: 2026-09-22T07:05:00Z
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

- [x] Replace `@modelcontextprotocol/sdk` with `@modelcontextprotocol/server` 2.0.0 in `dependencies`, and add `@modelcontextprotocol/client` 2.0.0 to `devDependencies` (the client does not select the server profile and is only used by the smoke boundary).
- [x] Raise `zod` to the range the pilot runs (`^4.6.5`) and delete the now-false `dependency_holds` entry in `.ki.toml`, because the hold named the v1 SDK as its cause.
- [x] Repoint the `McpServer` and `ToolAnnotations` type imports in `src/utils/access-level.ts`, `src/tools/claude-code/index.ts`, `src/tools/claude-desktop/index.ts`, `src/tools/vscode/index.ts`, and `src/tools/claude-desktop/schemas.test.ts` at `@modelcontextprotocol/server`. (`src/tools/claude-code/schemas.test.ts` was named in the plan but imports no MCP type, so it needed no change.)
- [x] Add `resultType: 'complete' as const` to both `errorResult` and `jsonResult` in `src/utils/utils.ts`, leaving their existing `isError`, `structuredContent`, and `content` fields untouched.
- [x] Extend `src/utils/utils.test.ts` so both helpers are asserted to carry the discriminator, keeping the 100 per cent coverage thresholds satisfied.
- [x] Rework `src/mcp-server/index.ts` into a per-connection `createServer()` factory that constructs the `McpServer`, installs the access-gated register, and registers all three tool groups, then hand that factory to `serveStdio(createServer, { legacy: 'serve', onerror })` from `@modelcontextprotocol/server/stdio`. Keep the existing stderr configuration banner and the async accessibility and workspace-discovery preamble ahead of the boundary, and keep a `SIGINT` path that closes the returned handle.
- [x] Rewrite `scripts/smoke.ts` against `@modelcontextprotocol/client`: assert the modern era, the negotiated `2026-07-28` version, a `server/discover` result with `resultType: 'complete'` and the correct `serverInfo` name, the unchanged forty-two-name tool surface, a successful read-only tool call returning a non-error envelope, a malformed-argument call being rejected, and a second client opened without version negotiation staying on the legacy era and seeing the identical tool count.
- [x] Leave `EXPECTED_TOOLS` unchanged. If a name moves, the migration has broken the public contract and must stop.
- [x] Run every gate in `## Verify` and record the outcomes in the review packet.

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

## Review

### Delivered

The approved boundary held. `mcp-housekeeping-claude` now selects the modern MCP 2026-07-28 profile through `@modelcontextprotocol/server` 2.0.0, serves stdio through the SDK-owned `serveStdio` boundary from a per-connection factory, returns `resultType: "complete"` from both synchronous result helpers, retains the deliberate legacy client fallback, and proves discovery, the result envelope, and that fallback through the repository smoke boundary.

The stated exclusions were honoured. The forty-two tool names, their input and output schemas, and their annotations are byte-for-byte unchanged; `EXPECTED_TOOLS` in the smoke script was not edited. The access gate, audit log, `dry_run` defaults, and generated mcporter client were not touched beyond a type import moving package. `src/utils/utils.ts` was not split into the pilot's `errors.ts` / `results.ts` arrangement.

Immutable baseline: `56dfca2e9ab84d756ae8c2e8e30cb486d49c4897`. That baseline was itself green on every gate under the legacy profile - typecheck clean, Biome exit 0, 315 tests passing, coverage thresholds met, `ki repo audit` PASS at 15 skills, smoke listing 42 tools - which is the passing legacy audit the acceptance boundary required before migration.

### Summary of changes

`package.json` swaps `@modelcontextprotocol/sdk` `^1.30.0` for `@modelcontextprotocol/server` `2.0.0` in `dependencies`, adds `@modelcontextprotocol/client` `2.0.0` to `devDependencies`, and raises `zod` from the exact `4.4.3` to `^4.6.5` (resolved `4.6.5`). `bun.lock` follows.

`.ki.toml` drops the `[skills.ki-engineering] dependency_holds` entry. The hold named `@modelcontextprotocol/sdk` 1.30.0 as the reason zod could not go past 4.5.4; with the v1 SDK gone the statement is no longer true, and leaving a false hold in place is worse than having none.

`src/mcp-server/index.ts` moves server construction, the access-gated register installation, and all three `register*Tools` calls into a `createServer(): McpServer` factory, and replaces the single `StdioServerTransport` plus `server.connect` with `serveStdio(createServer, { legacy: 'serve', onerror })`. The stderr configuration banner and the async accessibility and workspace-discovery preamble still run before the boundary is opened, and a `SIGINT` handler closes the returned handle.

`src/utils/utils.ts` adds `resultType: 'complete' as const` to `errorResult` and `jsonResult`, with a comment recording why. `src/utils/access-level.ts`, `src/tools/claude-code/index.ts`, `src/tools/claude-desktop/index.ts`, `src/tools/vscode/index.ts`, and `src/tools/claude-desktop/schemas.test.ts` take their `McpServer` and `ToolAnnotations` types from `@modelcontextprotocol/server`.

`scripts/smoke.ts` moves to `@modelcontextprotocol/client`, extracts a reusable `createTransport()`, and now asserts the modern era, the negotiated `2026-07-28` version, a `server/discover` result carrying `resultType: 'complete'` and the `mcp-housekeeping-claude` server name, the unchanged forty-two-name surface, a successful `claude_desktop_reports_list` call returning a non-error envelope, rejection of that same call with an argument its strict schema forbids, and a second non-negotiating client landing on the legacy era with an identical tool count.

`src/utils/utils.test.ts` gains an assertion that both helpers declare a complete result, so dropping the discriminator fails in the unit suite rather than only at the wire.

Two deviations from the plan, both minor and neither expanding scope. First, the plan named two `src/tools/*/schemas.test.ts` files; only `claude-desktop` imports an MCP type, so `claude-code/schemas.test.ts` needed no change. Second, `src/tools/claude-desktop/schemas.test.ts` also asserts a full error envelope by deep equality, so that expectation gained the `resultType` field - a consequence of the approved helper change rather than a new one, and the file was already inside `## Files touched`.

### Verification

Every gate below was run from the repository root after integration.

- `bunx tsc -p tsconfig.json --noEmit` - PASS, exit 0, no diagnostics over source, tests, and scripts.
- `bunx @biomejs/biome check .` - PASS, exit 0. `Checked 43 files in 62ms. No fixes applied. Found 1 info.` The single info is the pre-existing `biome.json` `$schema` pin at 2.5.12 against the 2.5.14 CLI; it was present on the baseline, is not an error, and is out of this item's scope.
- `bun run test` - PASS. `Test Files 15 passed (15) / Tests 316 passed (316)` (315 before, plus the new discriminator assertion).
- `bun run test:coverage` - PASS. `Statements 100% (1139/1139), Branches 100% (557/557), Functions 100% (186/186), Lines 100% (979/979)`; the configured 100 per cent thresholds hold.
- `bun run build` - PASS, exit 0, `tsc -p tsconfig.build.json` emits `dist/` without diagnostics.
- `bun run ki:test:smoke` - PASS. `✓ smoke passed: modern discovery, legacy fallback, 42 tools, valid result envelope`.
- `ki repo audit --concise --progress never` - PASS. `summary: KI REPO AUDIT on mcp-housekeeping-claude PASS · 15 skills`, unchanged from the baseline count.
- `bunx knip` - exit 0, configuration hints only, all of them pre-existing.

The `ki-repo-mcp` PROTO-1 item now evaluates its modern branch rather than its legacy one: `package.json` declares only `@modelcontextprotocol/server` 2.0.0, `src/` contains zero `@modelcontextprotocol/sdk` or `StdioServerTransport` occurrences, `serveStdio(` is present in the stdio entry point, and `src/utils/utils.ts` carries three `resultType: 'complete'` literals against two helper definitions. Each of those is a condition the modern branch would have failed on, so the PASS is evidence of the modern profile and not of the legacy exemption.

### Outstanding concerns

None blocking.

Two things a reviewer should see rather than discover. The `biome.json` `$schema` version drift noted above is pre-existing and deliberately untouched. And `@modelcontextprotocol/sdk` still resolves inside `node_modules` as a transitive dependency of `mcporter`; nothing in this repository's own source or manifest references it, which is what PROTO-1 inspects, but a reader grepping `node_modules` will still find it.

### Post-change review

The goal is met: the server runs the modern profile, and it did so without the tool contract moving. Scope held to the thirteen files named in the plan, minus one that turned out not to need changing.

Regression risk is concentrated in the entry point, because it is the one place where behaviour rather than types changed. Two properties were checked deliberately. Tool registration now happens per connection instead of once at module load, which matters because the audit-log wrapper and access gate are installed inside the factory - the smoke test exercises two sequential connections and both see the full forty-two-tool surface, so the factory is not leaking or dropping state between them. And the async preamble still completes before `serveStdio` opens the boundary, so the startup diagnostics a human relies on when a root is missing appear in the same order as before.

Acceptance readiness: the record's own acceptance boundary asked for package, result helpers, stdio entry point, focused tests, live smoke, and the ki-repo-mcp audit to agree. They do, and the pre-migration legacy pass it also asked for is recorded above.

### Mini recap

Delivered the MCP 2026-07-28 migration for this server: modern package family, per-connection `serveStdio` factory, complete result envelopes, a smoke boundary that proves discovery and the retained legacy fallback, and a unit assertion guarding the discriminator. Public tool contract unchanged at forty-two tools.

Verification: typecheck, Biome, 316 tests, 100 per cent coverage, build, smoke, and `ki repo audit` at 15 skills all pass.

Concerns: none blocking; two pre-existing observations recorded above.

Proposed learning routes, offered rather than taken. The durable lesson - that a deep-equality assertion on a result envelope couples a test to the protocol profile, so a profile change surfaces as a test failure in an apparently unrelated file - is small and already encoded in the test itself. The repository-level question of when the legacy fallback should be retired belongs to a future work record with fleet evidence, not to this one. Neither is promoted automatically.

## Discussion

### Source evidence

The portable profile and rubric live in ki-repo-mcp; the accepted mcp-git-audit migration is implementation evidence, not a patch to copy mechanically. Receiver-specific authentication, configuration, generated client, and tool-envelope differences remain local design inputs.

The concrete differences found on review are that this server has a required `MCP_HOUSEKEEPING_CLAUDE_PATH` and three independent root paths rather than a safe-root list, that it performs async accessibility and workspace-discovery reporting before serving, that its result helpers live in `src/utils/utils.ts` rather than a dedicated `results.ts`, and that its tool surface is forty-two names across three groups rather than twelve across four. None of those differences changes the shape of the migration; they change what the smoke test has to set up and where the discriminator has to be added.

### Compatibility decision

`legacy: 'serve'` is chosen deliberately rather than by default. This server is consumed through mcporter and directly by local runtimes whose client versions are not controlled from here, and the standard explicitly permits a modern server to retain legacy client fallback while the fleet migrates. The smoke test asserts the fallback rather than assuming it, so a future decision to pass `legacy: 'reject'` has to break a test on purpose. Removing the fallback without fleet evidence is out of bounds for this item.

### Acceptance boundary

The modern profile is not claimed until this repository's package, result helpers, stdio entry point, focused tests, live smoke, and ki-repo-mcp audit agree. A passing legacy audit before migration remains expected, and the baseline recorded in `## Current state` is that pass.
