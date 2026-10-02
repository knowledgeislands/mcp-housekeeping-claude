---
id: MCP-CH-OPS-002
area: OPS
title: Add Claude cleanup tools
theme: operations
horizon: next
status: done
blocks: []
blocked_by: []
baseline_ref: c205b0158ae0f5ee158c553ed195c345b0b01f11
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-02T02:20:58Z
---

## Goal

An operator can preview and remove obsolete Claude Desktop sessions and their outputs through the existing access-gated cleanup workflow, with the same selection rules used by the read-only audits.

## Context

`listObsolete()` already selects aged regular `local_*.json` session files and reports the corresponding session-directory size. `obsoleteOutputs()` reports direct regular files inside each session's `outputs/` and `uploads/`, marking sessions obsolete from the JSON mtime or the directory mtime when JSON is absent. Neither has a prune counterpart. Existing destructive tools provide annotation, dry-run, and single-workspace conventions.

## Boundary

Add only age-based session and output cleanup within one explicitly resolved workspace. Output cleanup targets both outputs and uploads of obsolete sessions; no age-independent named-session delete is introduced. Preserve default preview and memory/source boundaries; never operate on real user roots in tests. A path escape, unsupported entry type, unreadable timestamp, or changed candidate must be skipped or fail before deleting that candidate.

## Current state

Implementation belongs in `src/main/claude-desktop/audit.ts` and registration in `src/tools/claude-desktop/index.ts`. The existing `listObsolete()` view publishes only its top ten oldest entries, so a prune must use the complete internal selector, not its display slice. `requireSingleWorkspace()`, `DESTRUCTIVE_ONESHOT`, and both containment helpers are available. Existing operator guides now own practical cleanup and safety instructions; updating only the README would leave those guides stale.

## Steps

- [x] Extract complete internal candidate selectors shared by audit, dry-run, and effect. Evaluate the same strict age comparison against one operation timestamp. A session candidate is a regular `local_*.json` older than cutoff plus its optional matching `local_*` directory. Output candidates are only direct regular files inside an obsolete session's `outputs/` and `uploads/`; retain the audit's directory-mtime fallback only when the JSON is genuinely absent.
- [x] Add session and output prune implementation functions with `{ older_than_days, dry_run }`. Session cleanup removes the exact selected JSON and matching contained directory; output cleanup removes only selected direct files and preserves session metadata, directories, and nested files. Reject or explicitly skip symlinked roots, session paths, subdirectories, and files, and apply lexical and realpath containment immediately before each effect.
- [x] Return complete preview/effect candidate lists, affected bytes, dry-run state, and skipped reasons. Recheck age, path identity, and containment before removal and skip a newly active, changed, or missing candidate. Describe any partial progress honestly if a later filesystem operation fails; do not claim transactionality.
- [x] Register `claude_desktop_sessions_prune` and `claude_desktop_outputs_prune` with `DESTRUCTIVE_ONESHOT`, strict input/output schemas, and `dry_run` defaulting to true. Use `requireSingleWorkspace()` rather than the audit aggregation wrapper.
- [x] Add isolated tests for exact cutoff, more than ten matching sessions, absent sidecar, JSON-absent output fallback, young-session retention, pattern exclusion, nested-file retention, default-preview byte preservation, path traversal/symlink escapes, changed-candidate revalidation, and explicit workspace selection when multiple workspaces exist.
- [x] Update schema/access tests, smoke inventory, affected committed generated client artifacts, README tool reference, and operator cleanup/safety guides. State plainly that output cleanup can delete uploads as well as generated outputs.

## Files touched

`src/main/claude-desktop/audit.ts`, `src/main/claude-desktop/audit.test.ts`, `src/tools/claude-desktop/index.ts`, `src/tools/claude-desktop/schemas.test.ts`, `scripts/smoke.ts`, affected `src/generated/client.ts` and `src/generated/types.d.ts`, `README.md`, `docs/guides/operator/cleaning-up-state.md`, and `docs/guides/operator/safety-model.md`. Use an isolated local server when regenerating client artifacts.

## Verify

Run `bun run test`, `bun run test:coverage`, `bunx tsc --noEmit`, `bun run ki:test:smoke`, and `ki repo audit --repo .` sequentially. Both new tools must be absent at `read` and `write`, visible at `destructive`, and non-mutating when `dry_run` is omitted. For unchanged fixture state, audit selection, preview, and actual deletion must agree over the complete candidate set, including more than ten sessions. Nonmatching, young, symlinked, escaping, and changed candidates must survive. Output-prune preserves nested files; session-prune deliberately removes the complete selected session directory, including its nested contents. Multi-workspace calls without a valid explicit target must fail without mutation. Record unrelated pre-existing audit findings separately.

## Dependencies / blocks

No mechanical dependency. Prefer the Claude Code orphan-safety repair first, but these functions and registrations are in a different application group. No new access tier, environment variable, remote service, or registry dependency is needed.

## Documentation impact

### Decision Records

No new authority model: both tools use the existing destructive visibility gate and explicit effect opt-in. Age-driven output cleanup is the selected scope of this record; age-independent deletion remains excluded.

### Specifications

Add strict schemas for the two new MCP tools and corresponding generated client shapes. Preserve the existing audits' public result shapes while sharing their internal selection logic.

### Guides

Extend the operator cleanup and safety guides with the two preview/effect workflows, exact filename/directory scope, uploads consequence, and changed-candidate skips. Keep README reference and smoke inventory aligned.

### Roadmap

No separate follow-on is required to complete this bounded surface. Any later targeted deletion mode needs its own scoped record.

## Review

### Delivered

Added the two age-scoped Claude Desktop cleanup tools from baseline `c205b0158ae0f5ee158c553ed195c345b0b01f11`. Session and output audit, preview, and effect now share complete candidate selectors.

### Change Summary

Both tools default to preview, require the existing destructive access tier for visibility, and resolve exactly one workspace. Effects revalidate age, file identity, tree state, and containment before removal. Session cleanup removes a selected JSON and its matching directory; output cleanup removes only direct selected output and upload files. Results report every candidate, candidate and affected bytes, skips, and partial progress. Schemas, client methods, smoke inventory, README, and operator guides are aligned.

### Verification

`bunx tsc --noEmit`, `bun run test`, `bun run test:coverage` (100% statements, branches, functions, and lines), `bun run ki:test:smoke` (44 tools), full `ki repo audit --repo .`, and focused `ki-work-roadmap`, `ki-guides`, `ki-authoring`, `ki-repo-mcp`, and `ki-engineering` audits passed. Tests exercised destructive effects only under temporary fixture roots. Access tests confirmed that both new tools are absent at read and write tiers and present at destructive.

### Outstanding concerns

External filesystem changes cannot be made atomic with recursive deletion. The tool checks identity and containment again just before each effect, skips changed candidates, and reports partial work if a later removal fails. No cleanup was run against live Claude data.

### Post-change review

The complete candidate set, including more than ten sessions, drives audit, preview, and effect. Exact-cutoff, young, unmatched, symlinked, escaping, and changed candidates survive; output cleanup leaves nested files and session metadata intact. The generated client received only the two new methods, preserving the existing interface shape.

### Mini recap

The scoped implementation and verification are complete in the local checkout. No Git remote was pushed. This item remains Awaiting review until owner acceptance of this packet.

## Done

Accepted 2026-10-02 by Kris Brown on the review packet above.

## Discussion

### One age-based contract

The earlier alternative between age-based pruning and arbitrary named-session output deletion is resolved in favour of age-based pruning, matching the existing audits and this item's goal. Both previews and effects consume the complete selector rather than reimplementing it or consuming a top-ten presentation.

### Filesystem changes

A dry-run and later effect are separate observations. Revalidation must retain candidates that have become active or changed; it narrows the race without promising atomic deletion across externally changing files. The existing containment and access rules apply to every new effect.
