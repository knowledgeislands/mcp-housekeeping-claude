# Contributing

Thanks for your interest. This file covers the dev loop, conventions, and what to check before you open a PR. The [developer guides](./docs/guides/developer/README.md) go further: [local development](./docs/guides/developer/local-development.md) explains what each script is for and how to run the server against a real client, and [adding a tool](./docs/guides/developer/adding-a-tool.md) walks the whole path for a new tool.

## Setup

You'll need [Bun](https://bun.sh) 1.3+ for the dev loop, and Node.js 22+ to run the compiled `dist/` output the published package ships.

```bash
git clone https://github.com/knowledgeislands/mcp-housekeeping-claude.git
cd mcp-housekeeping-claude
bun install
bun install --cwd tooling/depcruise
```

`bun install` triggers `prepare`, which points Git at the committed `.githooks/pre-commit` hook, so every commit runs `lint-staged` and the `syncpack` format check on what you stage. The second install provides the isolated module-boundary checker that `bun run test` drives.

## Dev loop

```bash
bun run ki:server:mcp:dev      # bun --watch — runs the server from source
bun run ki:server:mcp:inspect  # MCP Inspector against the TS source
bun run build                  # tsc build into dist/
bun run ki:test:smoke          # build, then boot the server and check its tool surface
ki repo audit --repo .         # the main gate: Biome, TypeScript, syncpack, knip, coverage, rumdl
ki repo conform --repo .       # the safe fixes the audit can apply
bun run test                   # vitest (use `bun run test`, not `bun test`)
bun run test:watch             # vitest in watch mode
bun run test:coverage          # vitest with v8 coverage report
```

## Conventions

### Code

- **TypeScript ES modules** — `"type": "module"`, internal imports use `.js` extensions (e.g. `from './audit.js'`) so `tsc` emits valid JS.
- **Arrow functions** for top-level declarations (`export const foo = () => …`).
- **Layout**: tool definitions are thin and live in `src/tools/<group>/index.ts`; the real implementation lives in `src/main/<group>/` and takes the config slice it needs (a root path, or `housekeepingPath`) as its first argument. Config is loaded once in `src/mcp-server/index.ts` via `loadConfig()` and threaded in — there is no env read at import time.
- **Strict path safety**: any tool input that touches the filesystem must go through `resolveWithinRoot(<root>, …)` from `src/utils/utils.ts` (where `<root>` is the relevant injected root — `cfg.claudeDesktopRootPath`, `cfg.claudeCodeRootPath`, or `cfg.vscodeWorkspaceStorageRootPath`). Inputs that resolve outside that root throw `Path escapes root`.
- **Errors**: tools return MCP errors via `errorResult(...)`; structured results via `jsonResult(...)`.
- **Annotations**: be honest with `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` on every tool registration.

### Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) so version bumps are easy to derive when releasing by hand. There is no auto-release pipeline.

| Type        | What it means           | Bumps |
| ----------- | ----------------------- | ----- |
| `feat:`     | new feature             | minor |
| `fix:`      | bug fix                 | patch |
| `perf:`     | performance improvement | patch |
| `docs:`     | documentation only      | patch |
| `deps:`     | dependency change       | patch |
| `refactor:` | internal restructuring  | none  |
| `test:`     | test-only changes       | none  |
| `chore:`    | tooling, config         | none  |
| `build:`    | build pipeline          | none  |
| `ci:`       | CI changes              | none  |

Add `!` for breaking changes (`feat!:` / `fix!:`) — bumps major.

### Testing

- New code should ship with tests. Vitest is configured with V8 coverage and has thresholds in `vitest.config.ts` — if your change drops coverage below the threshold, CI fails.
- File-level isolation: each test file defines its own fixture root under `os.tmpdir()` so test data never touches the real Claude/VSCode locations. Tests should clean up after themselves with `beforeEach`/`afterEach`.

## Before opening a PR

- [ ] `ki repo audit --repo .` reports no failures (it runs Biome, TypeScript, syncpack, knip and coverage)
- [ ] `bun run ki:test:smoke` passes
- [ ] Commit messages follow Conventional Commits
- [ ] If you added/removed/renamed a tool, update `README.md` and `AGENTS.md`

CI runs all of the above on every PR.
