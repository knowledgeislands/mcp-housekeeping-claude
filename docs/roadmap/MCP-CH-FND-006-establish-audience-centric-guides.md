---
id: MCP-CH-FND-006
title: Establish audience-centric guides
area: FND
theme: foundation-tooling
horizon: now
status: ready
blocks: []
blocked_by: []
transferred_from: ki-website
baseline_ref: null
created_at: 2026-09-21T15:44:00Z
updated_at: 2026-09-22T07:16:00Z
---

## Goal

A reader can find practical instructions for this server grouped by the audience that needs them, and the repository declares `ki-guides` so that grouping is gated rather than conventional.

## Context

`mcp-housekeeping-claude` has no `docs/guides/` and does not declare `ki-guides`. Its README carries Quick Start, Installation, Configuration, Development, Security Model, Troubleshooting, and Extending the Server. Because this server can clean accumulated local state, the safety and recovery material in it deserves a guide a reader can find without scrolling a README.

KI Website now declares, for every page it publishes under `apps/site/src/guidance/`, the exact upstream document and pinned ref that page was written from, and a `verify:guidance --network` sweep reports the pages whose source has moved. The site intends to derive public guidance for this project from this repository's own guides and cite them at a pinned ref, so the quality and stability of `docs/guides/` here directly determines the quality of what the site can publish.

That is a pull, not an obligation: KI Website derives, it does not own. This repository decides what its guides say and when they change.

Separately, `ki-guides` is being asked to require audience directories under `docs/guides/` rather than permitting a flat collection (`ki-agentic-harness` `KI-HARNESS-GOV-083`). If that lands, this repository's collection has to satisfy it.

## Boundary

Adopted into `Now` by explicit approval, so this is prioritised work rather than intake. `ki-plan` shaped it to `Ready` on 2026-09-22 before any implementation, and this repository still owns its plan and sequencing.

KI Website derives and cites; it does not own this collection and must not be given approval rights over it. Nothing here requires a guide to be written for the website's benefit - if a guide would not serve this repository's own readers, it should not exist.

This item moves and writes documentation only. No source file under `src/`, no test, no `package.json` script, and no tool contract changes. The forty-two tool names and their behaviour are fixed for this item: where the README describes behaviour incorrectly, the correction is to the document, never to the code.

## Shaping

Three audiences are named, and each one is a reader this repository actually has.

- **`user/`** - someone connecting the server to their own Claude Desktop, Claude Code, or other MCP client and asking for audits. They need prerequisites, a build, client configuration, the environment variables, and recovery from the failures a first run produces.
- **`operator/`** - someone deleting accumulated state with it. This is a separate operating context, not a courtesy split: the read surface and the destructive surface are gated by different configuration (`MCP_HOUSEKEEPING_CLAUDE_ACCESS_LEVEL`), guarded by a different mechanism (`dry_run`), and carry different consequences (`fs.unlink` and `fs.rm` do not use the Trash). A reader about to prune six months of session history needs to know what the server refuses, what it keeps, and what cannot be undone, and that material should not be an appendix to an installation guide.
- **`developer/`** - someone changing the code. `ki-guides` puts contributor mechanics in `docs/guides/developer/` rather than a sibling root, and the README's "Extending the Server" section is already exactly that material in the wrong place.

Two candidate audiences are rejected. An **integrator** audience - someone importing `./claude-code`, `./claude-desktop`, or `./vscode` from the published package and calling `main/` directly - has a real export surface in `package.json` but no known consumer and no documented procedure; the injectable-config design that makes it possible is recorded in `CLAUDE.md` as an architecture invariant, which is where it belongs until somebody actually does it. A **release** audience is rejected too: there is no release script, no publish job in `.github/workflows/`, and `CONTRIBUTING.md` says version bumps are derived by hand with no auto-release pipeline. Writing `developer/releasing.md` would mean inventing a procedure rather than documenting one.

**The tool inventory does not become a guide.** The failure mode the record predicted has already happened in the README: it announces "39 tools" and tabulates thirty-nine, while `src/tools/` registers forty-two - `claude_code_sessions_discover`, `claude_code_sessions_list`, and `claude_code_sessions_checkpoint` are missing from it. Copying that table into `docs/guides/` would produce a second list to forget to update. Instead: `ki-repo-mcp` §11 requires a tool catalogue in the README, so the README keeps the single hand-maintained copy and this item repairs its drift; the guides teach the naming convention, the annotation-derived access level, and how to list the live surface from the running server, and link to the README catalogue rather than restating it. If that table drifts again, the durable fix is generation from the tool declarations, which is a separate item with a code change in it.

Two neighbouring documents have to move with the guides rather than be left contradicting them. `AGENTS.md` currently instructs "Keep user-facing installation, configuration, and tool reference in README", which after this item is false for two of the three. `CLAUDE.md` opens by routing the reader to the README for install and config. Both get a one-line correction. `CONTRIBUTING.md` keeps everything it has - `ki-repo-mcp` §11 requires it to carry setup, dev loop, conventions, and the pre-PR checklist - and gains a pointer to the developer guides for the material that is not in it. Nothing is copied out of `CONTRIBUTING.md` into a guide.

## Current state

There is no `docs/guides/` directory and `.ki.toml` declares no `[skills.ki-guides]` block, so nothing gates whether the collection exists or what shape it takes. The practical material catalogued in Context sits in `README.md`, where a reader arriving with a task has to reconstruct that task out of reference prose.

`README.md` is 290 lines. Its instructional sections are Quick Start (4 steps), Installation (prerequisites, `bun install`), Configuration (a seven-row environment-variable table with four footnotes, the Claude Desktop JSON block, Running From Source with `.env` precedence, and Workspaces), Development (a nine-command block), Security Model (three bullets), Troubleshooting (four failure messages), and Extending the Server (five numbered steps). Its orienting sections are the opening description, Features, Available Tools, Daily Audit - Tool Choreography, Example Conversations, and Directory Structure.

`docs/` today holds `docs/roadmap/` (five records plus `_ISSUES.md`) and `docs/decisions/` (one record plus a README). Neither `docs/spec/` nor `docs/developer/` exists, so the `ki-guides` ROUTE-1 check for retired parallel roots is satisfied before the collection is created.

The substance the guides need is all present in the code and verifiable. Access levels are `read` (default), `write` (reserved, no tools), and `destructive`, derived per tool from `readOnlyHint`/`destructiveHint` with an unannotated tool failing safe to `destructive` (`src/utils/access-level.ts`, `src/config/index.ts`). An invalid level aborts startup. Every destructive tool takes `dry_run` defaulting to `true`. Deletions are `fs.unlink` and `fs.rm` - permanent, with no Trash. `claude_code_orphan_projects_prune` skips orphans that contain a `memory/` subdirectory unless `include_with_memory=true`. `claude_desktop_artifacts_prune` never prunes starred artifacts and always keeps the top N by `lastUpdated`. `memory_delete` refuses `MEMORY.md` in both groups. Batch deletes match a declared filename pattern (`cowork-audit-*.md`, `*.jsonl`, `*.json[l]`), never an arbitrary name. Path inputs pass `resolveWithinRoot` and `assertRealPathWithinRoot` and fail with `Path escapes root: "<input>"`. The audit log defaults to `writes`, lands at `<MCP_HOUSEKEEPING_CLAUDE_PATH>/audit/audit.jsonl`, redacts URL credentials and bulky `content` fields, rotates at 10 MiB keeping 5, and never fails a tool call. Startup prints each root's accessibility and every discovered workspace id to stderr.

`ki repo audit --concise --progress never` currently reports PASS at 15 skills, on the tree left by MCP-CH-FND-004.

## Steps

- [ ] Declare `[skills.ki-guides]` in `.ki.toml`, in the governance block beside `[skills.ki-authoring]`.
- [ ] Create `docs/guides/README.md`: scope statement, a route to each of the three audience directories, and a short "what lives elsewhere" pointer to `docs/decisions/`, `docs/roadmap/`, and the README catalogue.
- [ ] Create `docs/guides/user/` with its `README.md`, and `installation.md`, `configuration.md`, `running-audits.md`, and `troubleshooting.md`.
- [ ] Create `docs/guides/operator/` with its `README.md`, and `safety-model.md` and `cleaning-up-state.md`.
- [ ] Create `docs/guides/developer/` with its `README.md`, and `local-development.md` and `adding-a-tool.md`.
- [ ] Move, do not copy: Quick Start, Installation, Configuration (table, footnotes, client JSON, Running From Source, Workspaces), Development, Security Model, Troubleshooting, and Extending the Server leave `README.md` as they land in the guides. Verify by grep that no step survives in two places.
- [ ] Leave `README.md` orienting: description, Features, Available Tools, Daily Audit choreography, Example Conversations, Directory Structure, plus a Documentation section routing to the guides.
- [ ] Repair the README tool catalogue while it is the single copy: 39 to 42, and add the three `claude_code_sessions_*` acquisition tools with their registered purposes.
- [ ] Correct the one stale instruction in `AGENTS.md` and the README pointer in `CLAUDE.md`, and add a developer-guides pointer to `CONTRIBUTING.md` without removing anything from it.
- [ ] Run the gates in `## Verify` and repair what they report.

## Files touched

New: `docs/guides/README.md`, `docs/guides/user/{README,installation,configuration,running-audits,troubleshooting}.md`, `docs/guides/operator/{README,safety-model,cleaning-up-state}.md`, `docs/guides/developer/{README,local-development,adding-a-tool}.md`.

Modified: `.ki.toml`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and this record.

## Verify

- `ki repo audit --skill ki-guides --concise --progress never` passes, with GUIDE-1, GUIDE-2, GUIDE-3, and ROUTE-1 satisfied.
- `ki repo audit --skill ki-authoring --concise --progress never` passes over the new Markdown.
- `ki repo audit --concise --progress never` still reports PASS at 15 skills - 16 once `ki-guides` is declared - with no regression in `ki-repo`, `ki-repo-mcp`, or `ki-work-roadmap`.
- `bunx rumdl check .` reports no violation in the new files.
- No instruction exists in two places: each moved section appears in exactly one document.
- The README tool catalogue matches `grep -c "^  '" src/tools/*/index.ts` at forty-two names.

No code gate is required: `src/`, tests, and `package.json` are untouched. `bun run test` and `bun run build` are unaffected by this item and are not re-run as evidence for it.

## Dependencies / blocks

Nothing blocks this. `KI-HARNESS-GOV-083` in `ki-agentic-harness` proposes making audience directories a `ki-guides` requirement: if it lands first this collection satisfies it by construction, and if it lands later this collection already conforms. KI Website intends to derive public guidance from these guides and cite them at a pinned ref, but it derives rather than owns and its schedule does not gate this work.

MCP-CH-FND-004 is `awaiting-review` on this same tree and touched `package.json`, `src/`, and `scripts/`; this item touches none of them, and the two records do not conflict. The guides describe the delivered state of that migration where it is user-visible - the server name, the stdio entry point, the smoke command - which is accurate on the current tree either way.

## Documentation impact

### Decision Records

No decision record is needed. Audience-centric grouping is the house arrangement `ki-guides` already encodes, so adopting it here is conformance rather than a new decision. One becomes owed only if this repository concludes it needs an exception. The decision not to write a tool-inventory guide is recorded in `## Shaping` and in `docs/guides/README.md`; it is a placement decision inside an existing standard, not an exception to one.

### Specifications

No behaviour-level contract changes. The server's tool surface is untouched; this item changes only where its instructions live and who they are written for. The repository has no `docs/specs/`, so the guides cite the code and `CLAUDE.md` for stable behaviour; where a guide would have wanted a specification to point at, it names the source file instead rather than manufacturing a contract.

### Guides

This item is entirely guide impact. It creates the collection, its audience directories, and their indexes, and it empties the README of instruction.

### Roadmap

No further roadmap change is expected. If writing the guides exposes behaviour that cannot honestly be explained - an unclear failure mode, a configuration step with no recovery - that is a separate item raised at the time. Generating the README tool catalogue from the tool declarations is the one candidate already visible, and it is a code change that does not belong in this item.

## Discussion

Shaping settles how far the restructure goes, not whether it happens. The prompting question is whether a reader who has never opened this repository can install it, run it, and recover from its common failures without reading source.

### Why an operator audience is real here

Most servers in this family would not earn one. This one does, because the gate between reading and deleting is a deliberate, configured boundary rather than a matter of which tool you happen to call: at the default `read` level the destructive tools are not registered at all, so they are invisible to the model. Moving to `destructive` is an explicit act with its own consequences, and the reader performing it is doing a different job from the reader who wants yesterday's audit report. Splitting them lets the user guides stay short and lets the safety material be stated once, completely, where somebody about to delete something will find it.
