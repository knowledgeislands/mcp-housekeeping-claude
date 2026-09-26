# Adding a tool

Use this guide when adding a tool to one of the three groups, or changing an existing one in a way that moves its arguments, its annotations, or its name.

This procedure carries the operative invariants: keep protocol wiring thin, inject configuration, constrain every path lexically and physically, register through an honest annotation preset, return strict envelopes, and test only against isolated fixtures. The root `CLAUDE.md` and `AGENTS.md` files remain the repository-wide contracts, but no step below depends on reading them.

## Before you begin

Decide which group the tool belongs to: `claude_desktop_*` for the Cowork sessions tree, `claude_code_*` for `~/.claude`, `vscode_*` for VSCode workspace storage. The group decides both the file it is registered in and the root it is confined to.

Name it `<app>_<resource>_<action>` in snake_case, with `<resource>` plural for collection operations and singular for single-item ones. Existing actions are `list`, `read`, `write`, `delete`, `prune`, `relocate`, `summary`, `status`, `health`, `inventory`, `clear`, and `obsolete`; reuse one rather than inventing a synonym.

## Write the implementation first

The real work goes in `src/main/<group>/`, not in the tool definition. It takes the configuration it needs as its **first argument** — a root path, or `housekeepingPath` — and never reads the environment or holds module-level state. That is what makes it callable from a script and testable against a temporary directory:

```ts
const cfg = loadConfig()
await projectsList(cfg.claudeCodeRootPath)
```

Run every path input through `resolveWithinRoot(<root>, …)` **and** `assertRealPathWithinRoot(…)` from [`src/utils/utils.ts`](../../../src/utils/utils.ts) before touching the filesystem. The first is the lexical guard, the second is symlink-aware; both are required, at every `path.join(<root>, <user input>)` site. If you shell out, use `spawn` or `execFile` with an argv array — never an interpolated shell string.

## Register the tool

The definition in `src/tools/<group>/index.ts` stays thin: validate arguments, call the `main/` function with the config slice it needs, and map the outcome through `jsonResult(...)` or `errorResult(...)`. Return an error envelope; do not throw. A thrown validation error surfaces as a protocol error rather than a tool execution error, and it bypasses the audit-log wrapper, which keys on `isError`.

Register in a stable position within the group file — deterministic `tools/list` ordering matters for clients that cache on the tool list.

## Constrain the schema

Input schemas are `.strict()`, so an unexpected argument is rejected rather than ignored. Any identifier that becomes a path segment needs a regex that excludes `/`, `\`, and `..` — a bare `z.string().min(1)` is not acceptable. The existing patterns are the models: `workspaceArg` (hex), `projectArg` (alphanumeric plus `._-`), `sessionArg` (alphanumeric plus `._-` with a `.json`/`.jsonl` suffix), and the memory `name` argument, which must end `.md`. Tighten the schema as well as the call site; the containment check is defence in depth, not a substitute.

Where the tool returns machine-shaped data, declare an `outputSchema` alongside it so the declared shape and the returned object cannot drift.

## Choose the annotation preset honestly

The access level is derived from the annotations, never from the name. Use a preset from [`src/utils/annotations.ts`](../../../src/utils/annotations.ts):

- **`READ_ONLY`** — reads nothing but the filesystem and returns it. Registers at the default `read` level.
- **`DESTRUCTIVE`** — deletes, overwrites, or renames. Registers only at `destructive`.
- **`DESTRUCTIVE_ONESHOT`** — destructive _and_ dependent on current filesystem contents, so it is not idempotent: prune, relocate, delete.

A tool with missing or partial annotations is treated as `destructive` by the gate. That fail-safe is not a licence to skip the preset: an honestly annotated tool is what lets a client prompt before invoking it, and what decides whether it is exposed at all.

If the tool deletes or renames, it **must** expose `dry_run: z.boolean().default(true)`, preview on the default, and only act when it is explicitly `false`. The gate controls visibility; `dry_run` controls effect; both layers are required. A batch delete must match a declared filename pattern and must never remove an arbitrary entry a caller named.

## Test it

New code ships with tests, and the coverage thresholds are 100% across all four metrics for everything outside the excluded wiring layers. Co-locate tests with the `main/` code they cover.

Define a fixture root under `os.tmpdir()` per test file and pass it as the first argument to the function under test. **Never call `loadConfig()` in a test and feed its derived roots into a `main/` function**: those are the real `~/.claude`, Cowork, and VSCode directories, and a destructive test against them destroys real history. This has happened once.

Cover the refusals as well as the happy path — a traversal attempt, a name the schema should reject, and a `dry_run: true` call that changes nothing.

## Move everything that tracks the surface

A new tool name exists in four places, and they drift independently unless they move in the same commit:

1. **`scripts/smoke.ts`** — the `EXPECTED_TOOLS` array is the wire-level source of truth. The smoke test fails until it matches.
2. **The group's registration test** — `src/tools/<group>/schemas.test.ts`, where one exists for the schemas you touched.
3. **The `README.md` tool catalogue** — the one hand-maintained inventory, including the tool count in the Features list. It is hand-maintained deliberately, and [the guides index](../README.md#why-there-is-no-tool-inventory-guide) explains why there is no second copy in these guides; the price of that decision is that this step is not optional.
4. **`CLAUDE.md`** — only if the change alters an architecture invariant or a security requirement, not for an ordinary tool addition.

The guides describe tool families and procedures rather than enumerating tools, so a new tool does not normally require a guide change. It does when the tool introduces a new _kind_ of risk or a new routine — a new irreversible operation belongs in [The safety model](../operator/safety-model.md), and a new cleanup procedure belongs in [Cleaning up state](../operator/cleaning-up-state.md).

## Verify

Run the full gate in [Local development](local-development.md#run-the-complete-gate). The two that catch tool-surface mistakes specifically are `bun run test:coverage` and `bun run ki:test:smoke`; the smoke test is the one that proves the tool actually reaches the wire with the surface you intended.
