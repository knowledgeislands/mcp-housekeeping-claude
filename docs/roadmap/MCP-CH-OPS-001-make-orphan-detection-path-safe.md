---
id: MCP-CH-OPS-001
area: OPS
title: Harden orphan detection
theme: operations
horizon: next
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-01T19:27:46Z
---

## Goal

Existing project history survives orphan cleanup whenever its source cannot be verified as missing. Projects whose source paths contain punctuation are never classified for deletion by guessing from the project-directory name.

## Context

`discoverProjects()` still derives `source_exists` through `decodeProjectDir()`, and `pruneOrphanProjects()` recursively deletes every project with a false result unless memory protection applies. Slash, dot, and literal dash collide in the directory encoding, so even a present source can be reported missing. `projectsList()` and `storageSummary()` repeat that classification. No current fixture proves safety for these collisions.

## Boundary

Change only Claude Code source classification and its orphan-prune consumers. Preserve the destructive access gate, default preview, and memory opt-in. Never mutate source repositories or read real user session roots in tests. Missing, ambiguous, invalid, unreadable, or over-budget evidence means unverifiable and cannot authorize deletion. Session format coverage may remain conservative; safety does not depend on establishing that every historical Claude version emitted `cwd`.

## Current state

The implementation is in `src/main/claude-code/audit.ts`; `src/tools/claude-code/index.ts` publishes a boolean `source_exists`, orphan counts, and prune results. The existing operator cleanup guide still defines an orphan by the decoded source path. UUID session filenames and lexical/realpath containment helpers already exist. The generic `pathExists()` collapses errors and must not be used to prove that a content-derived source is missing.

## Steps

- [ ] Add a deterministic content-derived source resolver beside `discoverProjects()`. Inspect at most 32 recognised regular session files and at most 2 MiB total per project, with a 256 KiB per-file limit. Use bounded reads that detect growth/truncation and no unbounded `readFile`; reaching a limit before complete inspection makes the project unverifiable. Ignore blank lines, require parseable JSON objects, and accept only top-level string `cwd` fields. Every recognised session file must provide usable evidence; no evidence or conflicting evidence is unverifiable.
- [ ] Validate each `cwd` as an absolute path without NUL or a `..` segment and require its encoded value to equal the project directory identifier. Require one consistent normalised path across the complete inspected set. Reject symlinked or escaping session inputs with the existing lexical and physical-root guards. A session cwd in a different directory is unverifiable; do not infer a repository ancestor.
- [ ] Classify that path as `verified-present`, `verified-missing`, or `unverifiable`. Only `ENOENT` establishes missing; permissions and other I/O errors stay unverifiable. Preserve the decoded slug only as a display hint. Add `source_status`, nullable `source_path`, provenance, and a reason; retain `source_exists` as a nullable compatibility field (`true`, `false`, or `null`) so unknown does not masquerade as false.
- [ ] Propagate the status through project listing and storage summary; count only verified-missing projects as orphans and report an unverifiable-project count. Restrict orphan pruning to verified-missing projects; report unknown and memory-protected projects as skipped with reasons. Before each non-preview removal, repeat source verification and physical target containment and skip changed evidence or a newly present source.
- [ ] Add isolated fixtures for dot/dash collisions, missing or conflicting cwd, different-directory cwd, invalid paths, malformed JSON, unreadable or symlinked input, byte/file limits, source permission failure, genuinely missing sources, and evidence/source changes between selection and removal. Verify that `include_with_memory: true` never overrides an unverifiable result.
- [ ] Update strict output schemas and schema tests, tool descriptions, committed generated client types as affected, the README tool reference, and operator cleanup/safety guidance. Run the project verification gates against fixtures only.

## Files touched

`src/main/claude-code/audit.ts`, `src/main/claude-code/audit.test.ts`, `src/tools/claude-code/index.ts`, `src/tools/claude-code/schemas.test.ts`, affected `src/generated/client.ts` and `src/generated/types.d.ts`, `README.md`, `docs/guides/operator/cleaning-up-state.md`, and `docs/guides/operator/safety-model.md`. Regenerate client artifacts from an isolated local server only if their published shapes change. Shared helpers change only if required for a tested reusable error distinction.

## Verify

Run `bun run test`, `bun run test:coverage`, `bunx tsc --noEmit`, `bun run ki:test:smoke`, and `ki repo audit --repo .` sequentially. A complete valid fixture for a missing source must be removable; a punctuation-containing present source and every unverifiable fixture must retain all bytes under every dry-run/memory argument combination. Output schema assertions must distinguish `source_exists: null` and the status/reason fields. Read limits must be asserted by the bounded reader tests; source or evidence changes discovered at revalidation must skip deletion. Pre-existing unrelated fleet findings are recorded separately from changed-contract failures.

## Dependencies / blocks

No build-order blocker. Prefer this safety repair before [the Claude Desktop cleanup expansion](MCP-CH-OPS-002-add-destructive-cleanup-tools.md); the implementation groups are independent, so no artificial dependency is added. The read limits are deliberately conservative and documented; broader format support or larger limits need separate evidence and cannot weaken the unknown-means-skip rule.

## Documentation impact

### Decision Records

No new deletion authority is introduced. The existing item already requires unverifiable sources to survive; the plan makes that contract explicit and testable. Keep the bounded evidence assumptions in developer-facing source comments and operator guidance.

### Specifications

Project-list and summary outputs gain explicit source status and uncertainty, and the existing boolean becomes nullable. Update schemas and client types together; there is no separate declared specification collection in this repository.

### Guides

Replace the slug-based orphan definition in the operator cleanup guide. Explain conservative skips, memory protection, evidence limits, and the need to inspect preview results before enabling effects.

### Roadmap

No new work is required for safe completion. Broader historical session-format support or performance optimisation can be captured independently if fixtures establish a real need.

## Discussion

### Ambiguous directory encoding

The forward encoding loses information, so heuristic slug reversal cannot prove that a source disappeared. The source must come from validated session evidence, and unavailable evidence must retain history.

### Bounded evidence and coverage

The prior plan left read budgets and real-record discovery unresolved. This plan selects a conservative supported contract, with complete inspection inside explicit limits and a safe unverifiable result outside them. It does not claim that top-level cwd appears in every historical session format. Reading only the first convenient cwd cannot prove that later sessions agree, so incomplete or conflicting evidence cannot authorize deletion.

### Compatibility and race limits

A nullable compatibility field preserves the name without preserving the unsafe false-for-unknown meaning. Typed consumers need the schema/type update. Revalidation narrows races at effect time; it cannot provide a transaction over an independently changing external filesystem, and the implementation must not claim that guarantee.
