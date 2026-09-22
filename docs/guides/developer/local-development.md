# Local development

Use this guide when preparing a source change to this repository. It covers running the server from source, where its configuration comes from in that mode, driving it interactively, and the gate to run before handing a change over.

[`CONTRIBUTING.md`](../../../CONTRIBUTING.md) owns the clone-and-install setup, the commit convention, the testing convention, and the pre-PR checklist. This guide covers the mechanics those conventions assume.

## Run the server from source

```bash
bun run ki:server:mcp:dev
```

That runs `src/mcp-server/index.ts` under `bun --watch` with `NODE_ENV=development`. The server speaks stdio MCP, so running it in a terminal gives you the boot diagnostics on stderr — the access level, all four paths, the audit-log mode, root accessibility, and every discovered workspace id — and then waits for a client. It is the quickest way to prove a configuration change without restarting an MCP client.

Use `bun run`, never `bun <script>` directly for the test script: `bun test` invokes Bun's own runner instead of Vitest.

## Supply configuration for a source run

`MCP_HOUSEKEEPING_CLAUDE_PATH` is required in every mode. For a source run, copy the template and fill it in:

```bash
cp .env.example .env.development
# edit .env.development, then:
bun run ki:server:mcp:dev
```

`loadConfig()` in [`src/config/index.ts`](../../../src/config/index.ts) hydrates `process.env` from the **package root** — not the current working directory — in this order, highest precedence first: `.env.local`, then `.env.${NODE_ENV}` when `NODE_ENV` is set, then `.env`. `process.loadEnvFile` never overwrites a key already in the environment, so loading the highest-precedence file first is what makes it win. A value injected by the host always beats every file, which is why an MCP client's `env` block is authoritative in production regardless of what any `.env` file says.

Only `ki:server:mcp:dev` and `ki:server:mcp:inspect` set `NODE_ENV=development`, so `.env.development` is ignored everywhere else. Real `.env.*` files are gitignored; only `.env*.example` templates are committed.

You can skip the file entirely:

```bash
MCP_HOUSEKEEPING_CLAUDE_PATH=~/Documents/Claude/Projects/Claude\ Housekeeping \
  bun run ki:server:mcp:dev
```

Under Node, the `process.loadEnvFile` call is what loads those files; under Bun the same set is auto-loaded and the call is redundant. The `try`/`catch` around it swallows the `TypeError` older Bun raises, so one code path serves both runtimes.

## Drive the server interactively

```bash
bun run ki:server:mcp:inspect
```

That runs the MCP Inspector against the TypeScript source. It is the practical way to see the registered tool surface, read each tool's schema and annotations as the client sees them, and call a tool with real arguments. Because the access-level gate runs at boot, the surface the Inspector shows is the surface your current `MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL` produces — raise it in `.env.development` when you need to see the destructive tools.

To exercise the built output the way a client does:

```bash
bun run ki:server:mcp:start   # builds, then runs dist/ under node
```

## Run the tests

```bash
bun run test            # vitest run
bun run test:watch      # vitest in watch mode
bun run test:coverage   # with V8 coverage and its thresholds
```

Coverage thresholds are 100% for statements, branches, functions, and lines, over `src/**/*.ts` minus the pure-wiring layers that [`vitest.config.ts`](../../../vitest.config.ts) excludes: the server entry point, the `src/tools/**/index.ts` registration aggregators, the annotation presets, and generated client code. A change that adds a branch in `src/main/` and no test for it fails the gate rather than lowering the number.

Test files run without file parallelism and define their own fixture roots under `os.tmpdir()`. **A test must never call `loadConfig()` and pass its derived roots into a `main/` function** — those roots are your real `~/.claude`, Cowork sessions, and VSCode storage. Because every `main/` entry point takes its root as an injected first argument, passing a temporary directory is the natural calling convention; there is no environment to mutate. This rule exists because a regression once destroyed real `~/.claude/projects/` history.

## Run the complete gate

Before handing a change over:

```bash
bunx tsc -p tsconfig.json --noEmit   # or: bun run ki:lint:types
bun run ki:lint:check                # Biome lint + format check
bunx rumdl check .                   # Markdown
bun run test:coverage
bun run build
bun run ki:test:smoke
ki repo audit --concise --progress never
```

`ki:test:smoke` builds `dist/` and boots it over stdio against a temporary directory with the access level raised, then asserts the negotiated protocol version, the deliberate legacy-client fallback, the complete tool surface against `EXPECTED_TOOLS` in [`scripts/smoke.ts`](../../../scripts/smoke.ts), a valid result envelope, and the rejection of a malformed call. It is the only check that exercises the real protocol boundary, because the SDK owns discovery and protocol stamping and nothing in `src/` can be inspected to prove them.

`ki repo audit` runs the repository's declared Knowledge Islands skills. Biome owns TypeScript, JavaScript, and JSON; rumdl owns Markdown wholly, formatting and linting together. The two domains are disjoint, and the pre-commit hook runs both over staged files.

## When a gate fails

- **Coverage below threshold** — the report under `reports/coverage/` names the uncovered lines. Add the test; do not lower the threshold.
- **A smoke failure naming a tool** — the wire surface no longer matches `EXPECTED_TOOLS`. If you added a tool, [Adding a tool](adding-a-tool.md) lists everywhere that has to move together.
- **A Biome or rumdl formatting failure** — `bun run ki:lint:fix` and `bunx rumdl check --fix` repair the mechanical ones.
- **A test failure you cannot reproduce on a second run** — check whether another process is writing to this checkout before believing it.
