# AGENTS.md

Engineering follows `ki-engineering`, and the server's shape follows `ki-repo-mcp`: its layout, configuration injection, tool naming, annotation-driven access gate and security invariants, and where README and this file each hold what. Tests use isolated fixtures and never exercise real user roots.

Repository-specific implementation guidance follows. User-facing setup and tool documentation live in [README.md](./README.md) and [docs/guides/](./docs/guides/README.md).

## Architecture Invariants

### Configuration and layers

- **[src/config/index.ts](./src/config/index.ts)** — `Config` carries `housekeepingPath` (from the required `MCP_HOUSEKEEPING_CLAUDE_PATH`, which in production comes from the MCP client's `env` block or the package's `.env.local` or `.env`) and the three target roots derived from the home directory, not configurable: `claudeCodeRootPath` (`~/.claude`), `claudeDesktopRootPath` (Claude's `local-agent-mode-sessions`) and `vscodeWorkspaceStorageRootPath` (VS Code's `workspaceStorage`). The audit log defaults to `<housekeepingPath>/audit/audit.jsonl`.
- **[src/main/](./src/main/)** — grouped by `<app>`: `main/claude-code/`, `main/claude-desktop/`, `main/vscode/`. Every `main` entry point takes its root as its **first argument** — a root path (`projectsList(claudeRoot)`, `storageSummary(root, args)`) or `housekeepingPath` (`reportWrite(housekeepingPath, args)`).
- **[src/utils/](./src/utils/)** — `utils.ts` holds `resolveWithinRoot(root, …)`, the generic FS/format helpers and `discoverWorkspaces(root)`.

To use the code from a script: `const cfg = loadConfig(); await projectsList(cfg.claudeCodeRootPath)`.

This dependency direction is enforced, not just described: [.dependency-cruiser.ts](./.dependency-cruiser.ts) states each boundary as a named rule and [src/boundaries.test.ts](./src/boundaries.test.ts) cruises the source graph and proves every rule still rejects a deliberate crossing. Tool modules may reach only the `main/` modules their surface `index.ts` re-exports, `config/index.ts`, and the `annotations.ts` and `utils.ts` helpers. The checker runs from its own install root, `tooling/depcruise`, because dependency-cruiser needs a TypeScript below 7.

### Tool surface and access levels

`<app>` ∈ {`claude_desktop`, `claude_code`, `vscode`}. `<action>` is a verb or view (`list`, `read`, `write`, `delete`, `prune`, `relocate`, `rename`, `clear`, `summary`, `status`, `health`, `inventory`, `info`, `obsolete`, `discover`, `checkpoint`).

`MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL` defaults to `read`. The presets in [src/utils/annotations.ts](./src/utils/annotations.ts) are `READ_ONLY`, `DESTRUCTIVE` and `DESTRUCTIVE_ONESHOT`; there are no `write`-level tools, so `write` registers the same surface as `read`. The gate controls _visibility_; the `dry_run: true` default controls _effect_ — both layers are required.

### Workspace discovery (Cowork only)

`claudeDesktopRootPath` is walked at every tool invocation. A directory is a workspace if it contains any of `.claude.json`, `artifacts.json`, `spaces.json`, `cowork_settings.json`, or `local_*.json`. If the root itself has those marker files, it's treated as a single workspace with id `.` (back-compat with hard-coded inner-UUID configs). The other two roots (Claude Code, VSCode) discover their children differently and never aggregate. The Claude Desktop `workspace` argument is matched against the discovered ids, never joined into a path.

## Security Requirements

Every access level touches files anywhere under four roots: `housekeepingPath` and the three target roots. New tools and changes to existing tools MUST preserve every invariant below.

1. **Path containment at every `path.join(<root>, <user-input>)` site.** Wrap with `resolveWithinRoot()` AND `assertRealPathWithinRoot()` from [src/utils/utils.ts](./src/utils/utils.ts). Both apply to `args.workspace`, `args.project`, `args.session`, `args.space_id`, memory `args.name`, and any new identifier that becomes a path segment.
2. **Identifier schemas in use:** VSCode `workspaceArg` (hex) and `sessionArg` (alphanumeric/`._-` + `.json[l]` suffix); Claude Code `projectArg` (alphanumeric/`._-`) and `sessionIdArg` (UUID); Claude Desktop `spaceIdArg` (alphanumeric/`._-`, not `.`, `..` or a leading `-`) and `session_id` (lower-case UUID); and both groups' `memoryFileNameArg` (must end `.md`).
3. **Every delete, prune, relocate, clear, rename and write tool defaults `dry_run` to `true`.** The writes (`*_memory_write`, `*_memory_index_write`, `claude_desktop_report_write`) overwrite their one named file; their dry run reports whether it exists and the bytes that would be written, with no directory creation and no write. `DESTRUCTIVE_ONESHOT` marks the tools whose effect depends on current FS contents: the prunes, `claude_code_project_relocate`, and the deletes; the writes, `claude_desktop_reports_clear` and `claude_desktop_session_rename` are `DESTRUCTIVE`.
4. **Batch deletes are scoped by filename pattern, never wildcard.** Report cleanup matches `cowork-audit-*.md`; session pruning matches `*.jsonl` (Claude Code), `local_*.json` plus matching sidecars (Claude Desktop), or `*.json[l]` (VSCode). New batch-delete tools must declare and test their pattern — never `fs.rm` arbitrary entries the user named.
5. **The one subprocess is `du`,** invoked as `spawn('du', ['-sk', target])` with an 8-second timeout.
6. **Tests MUST NOT touch the real root paths.** `Config.claudeCodeRootPath`, `Config.claudeDesktopRootPath`, and `Config.vscodeWorkspaceStorageRootPath` resolve to live user directories. Test files MUST NOT call `loadConfig()` and feed its derived roots into a `main/` function. Instead, define a per-suite tmpdir, e.g. `const CLAUDE_CODE_ROOT = path.join(os.tmpdir(), 'mcp-housekeeping-<group>-<file>-tests')`, and pass that as the first arg to the function under test. A regression here destroyed real `~/.claude/projects/` history once — don't do it again.

Traversal-rejection tests live in [src/main/vscode/audit.test.ts](./src/main/vscode/audit.test.ts), the memory tests of both groups, and [src/utils/utils.test.ts](./src/utils/utils.test.ts). Parallel coverage for `claudeCode.sessionRead` / `relocateProject` is a follow-up.

## Tool registration call sites

Each `<app>` group registers its tools in `src/tools/<app>/index.ts` (thin wiring) and implements them in `src/main/<app>/`. To survey the surface, `grep "register(" src/tools/*/index.ts`. README's [Available Tools](./README.md#available-tools) tabulates them with purposes.
