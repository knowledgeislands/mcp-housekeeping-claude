---
id: MCP-CH-FND-006
title: Establish audience-centric guides
area: FND
theme: foundation-tooling
horizon: now
status: done
blocks: []
blocked_by: []
transferred_from: ki-website
baseline_ref: 23cf33eb1be0bb73de3ac2dcbce90d772721fd07
created_at: 2026-09-21T15:44:00Z
updated_at: 2026-09-26T18:10:52Z
---

## Goal

A reader can find practical instructions for this server grouped by the audience that needs them, and the repository declares `ki-guides` so that grouping is gated rather than conventional.

## Context

`mcp-housekeeping-claude` has no `docs/guides/` and does not declare `ki-guides`. Its README carries Quick Start, Installation, Configuration, Development, Security Model, Troubleshooting, and Extending the Server. Because this server can clean accumulated local state, the safety and recovery material in it deserves a guide a reader can find without scrolling a README.

KI Website now declares, for every page it publishes under `apps/site/src/guidance/`, the exact upstream document and pinned ref that page was written from, and a `verify:guidance --network` sweep reports the pages whose source has moved. The site intends to derive public guidance for this project from this repository's own guides and cite them at a pinned ref, so the quality and stability of `docs/guides/` here directly determines the quality of what the site can publish.

That is a pull, not an obligation: KI Website derives, it does not own. This repository decides what its guides say and when they change.

Separately, `KI-HARNESS-GOV-083` has clarified `ki-guides`: audience directories are recommended when stable reader groups make a collection easier to navigate, while flat and mixed collections remain valid. This item therefore stands on this repository's own readers and routing needs, not a universal Harness requirement.

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

- [x] Declare `[skills.ki-guides]` in `.ki.toml`, in the governance block beside `[skills.ki-authoring]`.
- [x] Create `docs/guides/README.md`: scope statement, a route to each of the three audience directories, and a short "what lives elsewhere" pointer to `docs/decisions/`, `docs/roadmap/`, and the README catalogue.
- [x] Create `docs/guides/user/` with its `README.md`, and `installation.md`, `configuration.md`, `running-audits.md`, and `troubleshooting.md`.
- [x] Create `docs/guides/operator/` with its `README.md`, and `safety-model.md` and `cleaning-up-state.md`.
- [x] Create `docs/guides/developer/` with its `README.md`, and `local-development.md` and `adding-a-tool.md`.
- [x] Move, do not copy: Quick Start, Installation, Configuration (table, footnotes, client JSON, Running From Source, Workspaces), Development, Security Model, Troubleshooting, and Extending the Server leave `README.md` as they land in the guides. Verify by grep that no step survives in two places.
- [x] Leave `README.md` orienting: description, Features, Available Tools, Daily Audit choreography, Example Conversations, Directory Structure, plus a Documentation section routing to the guides.
- [x] Repair the README tool catalogue while it is the single copy: 39 to 42, and add the three `claude_code_sessions_*` acquisition tools with their registered purposes.
- [x] Correct the one stale instruction in `AGENTS.md` and the README pointer in `CLAUDE.md`, and add a developer-guides pointer to `CONTRIBUTING.md` without removing anything from it.
- [x] Run the gates in `## Verify` and repair what they report.

## Files touched

New: `docs/guides/README.md`, `docs/guides/user/{README,installation,configuration,everyday-use,troubleshooting}.md`, `docs/guides/operator/{README,safety-model,cleaning-up-state,daily-audit}.md`, `docs/guides/developer/{README,local-development,adding-a-tool}.md`.

Modified: `.ki.toml`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.env.example`, and this record.

## Verify

- `ki repo audit --skill ki-guides --concise --progress never` passes, with GUIDE-1, GUIDE-2, GUIDE-3, and ROUTE-1 satisfied.
- `ki repo audit --skill ki-authoring --concise --progress never` passes over the new Markdown.
- `ki repo audit --concise --progress never` still reports PASS at 15 skills - 16 once `ki-guides` is declared - with no regression in `ki-repo`, `ki-repo-mcp`, or `ki-work-roadmap`.
- `bunx rumdl check .` reports no violation in the new files.
- No instruction exists in two places: each moved section appears in exactly one document.
- The README tool catalogue matches `grep -c "^  '" src/tools/*/index.ts` at forty-two names.

No code gate is required: `src/`, tests, and `package.json` are untouched. `bun run test` and `bun run build` are unaffected by this item and are not re-run as evidence for it.

## Dependencies / blocks

Nothing blocks this. `KI-HARNESS-GOV-083` is advisory rather than a universal migration requirement; this item's audience grouping remains justified by the repository-local reader distinctions described above. KI Website intends to derive public guidance from these guides and cite them at a pinned ref, but it derives rather than owns and its schedule does not gate this work.

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

## Review

### Delivered

Review remediation on 2026-09-26 brought the collection into the current `GUIDE-4` boundary. The nine links from guides to root Markdown documents were removed without removing their operative content: developer setup, contribution expectations, architecture and security invariants, catalogue maintenance, and escalation steps now read completely inside `docs/guides/`. Root documents continue to route readers into the collection.

The goal is met. `docs/guides/` now exists as a gated collection with a routing index and three audience directories - `user/`, `operator/`, `developer/` - holding thirteen documents between them, and `.ki.toml` declares `[skills.ki-guides]`, so the grouping is checked rather than conventional. `ki repo audit` reports PASS at 16 skills, one more than the 15 recorded at the baseline, and the added skill is `ki-guides`.

The instruction moved rather than multiplied. Every practical section named in the plan left `README.md` as it landed in a guide: Quick Start, Installation, Configuration with its environment table, footnotes, Claude Desktop JSON, Running From Source and Workspaces, Development, Security Model, Troubleshooting, and Extending the Server. A grep for each moved artefact finds it in exactly one document - the `mcpServers` client block appears only in `docs/guides/user/installation.md`, and the six `MCP_HOUSEKEEPING_*` table rows only in `docs/guides/user/configuration.md`.

The README is now orienting and routing only: what the server is, a Documentation section pointing at each audience, Features, the tool catalogue, Example Conversations, and the directory tree. Its catalogue was repaired while it is the single copy - it claimed 39 tools against 42 registered and omitted `claude_code_sessions_discover`, `claude_code_sessions_list`, and `claude_code_sessions_checkpoint`; all three are now listed with their registered purposes and the Features count reads 42.

Immutable baseline: `23cf33eb1be0bb73de3ac2dcbce90d772721fd07`, the commit that shaped this record to `ready`. No file under `src/`, no test, and no `package.json` script was touched, so the code gates are unaffected and were not re-run as evidence here, exactly as `## Verify` states.

### Change Summary

The review remediation changed four guide files. `developer/README.md` now states the collection boundary without delegating its procedures; `developer/adding-a-tool.md` states the operative invariants and names root catalogue and contract files as unlinked identifiers; `developer/local-development.md` now includes fresh-checkout prerequisites and handover expectations; and `user/troubleshooting.md` gives an actionable escalation path while naming `CLAUDE.md` only as repository-wide context. No source, package, root contract, or tool-surface file changed.

`.ki.toml` gains `[skills.ki-guides]` in the foundation block immediately after `[skills.ki-authoring]`, matching the position the sibling repositories `tools-mgit` and `tools-git-almanac` use.

`docs/guides/README.md` states the collection's scope, routes to the three audience indexes, and carries a "What lives elsewhere" section separating how from why (`docs/decisions/`), when (`docs/roadmap/`), and the README's catalogue of what exists. It also carries the section `## Why there is no tool-inventory guide`, which records that decision and its evidence in the collection itself rather than only in this record.

`docs/guides/user/` holds `README.md` plus `installation.md` (prerequisites, npm and from-source installs, the Claude Desktop and Claude Code client blocks, verification), `configuration.md` (the environment table, the four footnotes, precedence between host environment and `.env` files, what each access level exposes), `everyday-use.md` (what to ask for, how to read the flags, what a report contains), and `troubleshooting.md` (the server not appearing, a missing root, a refused path, an absent destructive tool, the audit log).

`docs/guides/operator/` holds `README.md` plus `safety-model.md` (the annotation-derived gate, `dry_run` defaults, path containment and the symlink-aware check, what the server refuses outright, what is irreversible, and what recovery actually exists), `cleaning-up-state.md` (area by area, preview then apply), and `daily-audit.md` (the choreography, its ordering, and what each step needs).

`docs/guides/developer/` holds `README.md` plus `local-development.md` (running from source, configuration precedence in that mode, the Inspector, the full gate and what to do when each part of it fails) and `adding-a-tool.md` (the naming convention, choosing an annotation preset, schema tightening, the `main/` boundary, tests, and every place a new tool has to be reflected).

`AGENTS.md` replaces its instruction to keep installation, configuration, and the tool reference in the README with one that keeps the catalogue in the README and the practical instructions in `docs/guides/` under the audience that needs them. `CLAUDE.md` routes to both the README and the guides instead of the README alone. `CONTRIBUTING.md` keeps all of its content - `ki-repo-mcp` requires it to hold setup, dev loop, conventions, and the pre-PR checklist - and gains a pointer to the two developer guides, which carry only material it does not hold.

Three deviations from the approved plan, none expanding scope. First, `user/running-audits.md` was written as `user/everyday-use.md`: the file covers reading and asking rather than the audit procedure, and the audit procedure itself belongs to the operator. Second, `operator/` gained a third guide, `daily-audit.md`; the plan left the Daily Audit choreography in the README, but it is step-by-step instruction for the reader who runs the server, so leaving it behind would have left one instructional section in a document the same item was emptying of instruction. Third, `.env.example` was added to the files touched: its header pointed at "README.md for full setup", which is no longer where setup lives, and named the renamed script `bun run server:mcp:dev`; both are corrected in one comment block.

### Verification

Review remediation gates after the final edits:

- `ki repo audit --skill ki-guides --repo . --concise --progress never` - PASS, with all nine `GUIDE-4` findings removed.
- `ki repo audit --skill ki-authoring --repo . --concise --progress never` - no FAIL; one pre-existing `OWN-1` warning for `.rumdl.toml` template drift.
- `ki repo audit --repo . --concise --progress never` - no FAIL; two warnings: the same pre-existing `OWN-1` drift and expected `DIST-1` development-checkout release evidence.
- `bunx rumdl check .` - PASS.

Every gate below was run from the repository root after the last edit.

- `ki repo audit --skill ki-guides --concise --progress never` - PASS. `summary: KI REPO AUDIT on mcp-housekeeping-claude PASS · 1 skill`.
- `ki repo audit --skill ki-authoring --concise --progress never` - PASS. `summary: KI REPO AUDIT on mcp-housekeeping-claude PASS · 1 skill`.
- `ki repo audit --concise --progress never` - PASS. `summary: KI REPO AUDIT on mcp-housekeeping-claude PASS · 16 skills`, up from 15 by the newly declared `ki-guides`, with no regression in `ki-repo`, `ki-repo-mcp`, or `ki-work-roadmap`.
- `bunx rumdl check .` - PASS. `Success: No issues found in 32 files`.
- No instruction in two places - the client configuration block appears only in `docs/guides/user/installation.md`, the environment table only in `docs/guides/user/configuration.md`, and no anchor anywhere in the repository links into a removed README section (`grep -riE 'README(\.md)?#(quick|install|config|develop|security|trouble|extend)'` returns nothing).
- Catalogue count - the registered tool names and the README catalogue rows are the same set of 42, compared by sorted `diff` of the names extracted from `src/tools/*/index.ts` against the names in the README tables.

No code gate was required or run: `src/`, the tests, and `package.json` are untouched by this item.

### Outstanding concerns

The guide-boundary failures found during review are resolved. This remediation adds no new concern and does not close or accept the item; the catalogue-maintenance risk already recorded below remains the reviewer's only guide-specific observation.

None blocking.

Two things a reviewer should see rather than discover. The README catalogue remains hand-maintained, and this item repaired a drift of three tools rather than removing the possibility of another; the guides now say explicitly that the catalogue is the single hand-maintained inventory and that `scripts/smoke.ts` holds the wire-level list the smoke test asserts, so a future drift has two places that disagree loudly rather than one that drifts quietly. A mechanical generator remains possible and is deliberately not proposed here, because `ki-repo-mcp` requires the catalogue to be in the README and generating into a README section is a build step this repository does not otherwise have.

`KI-HARNESS-GOV-083` ultimately retained audience grouping as an advisory navigation judgment rather than a universal path requirement. This collection remains well grouped because its user, operator, and developer readers are genuinely distinct, not because every guide must sit beneath an audience directory.

### Post-change review

The corrected dependency direction is root-inward: `README.md` and `CONTRIBUTING.md` point readers into `docs/guides/`, while a guide carries the complete procedure and mentions a root contract or catalogue only as an unlinked repository identifier. This preserves one governing authority without making a reader leave the collection to complete a task.

The decision the brief asked to be taken deliberately is recorded in two places. There is no tool-inventory guide, and there will not be one: a hand-written per-tool reference in `docs/guides/` would have been the third copy of the same list after the README catalogue and `EXPECTED_TOOLS`, and the evidence that such a copy drifts was already in this repository - the README claimed 39 tools against 42 registered, having missed the entire `claude_code_sessions_*` acquisition group. The guides therefore teach what does not drift: the naming convention, how the access level is derived from annotations rather than names, and how to read the live surface through the Inspector or `server/discover`. The reasoning is in `docs/guides/README.md` so that a future author meets it before writing the guide, not only in this record.

The audiences are the three this server actually has. A **user** installs it, points it at their machine, and asks Claude questions; they run at `read` and their failure modes are configuration ones. An **operator** runs it at `destructive` and deletes real state; that is a different operating context rather than a more advanced version of the same one, because the gate, the `dry_run` defaults, and the irreversibility of pruning only become relevant once the level is raised - and the safety model is prime guide material precisely for that reader. A **developer** changes the code. Two further audiences were considered and rejected: an **integrator** (the package does export real entry points, but there is no known consumer and no procedure to document, so a guide would be speculative) and a **release** audience (there is no release script and no publish pipeline, and `CONTRIBUTING.md` already states that version bumps are derived by hand).

Regression risk is low and concentrated in links. Every intra-repository link in the new guides is relative and was resolved against the tree; no document in the repository still links into a README section that no longer exists.

### Mini recap

The review remediation removed nine out-of-collection Markdown links from four guides, made the affected procedures self-contained, retained root files as unlinked governing identifiers, and restored the `ki-guides` pass. The item remains `awaiting-review`; it has not been self-accepted.

Delivered an audience-centric guide collection for this server: `docs/guides/` with a routing index and user, operator, and developer directories holding thirteen documents, `[skills.ki-guides]` declared in `.ki.toml`, and every instructional section moved out of the README rather than copied. The README is now orientation, catalogue, and routing; its catalogue was repaired from 39 to 42 tools, adding the three `claude_code_sessions_*` acquisition tools it had never listed. `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `.env.example` now point where the instructions actually are.

Deliberate decision: no tool-inventory guide, because a hand-written copy of the tool list drifts - as this repository's own README had already proved.

Verification: `ki-guides`, `ki-authoring`, and the full `ki repo audit` all PASS, the last at 16 skills; `bunx rumdl check .` clean; catalogue and registrations agree at 42 names. No code gate was required.

## Done

Accepted 2026-09-26 by Kris Brown on the review packet above.

## Discussion

Shaping settles how far the restructure goes, not whether it happens. The prompting question is whether a reader who has never opened this repository can install it, run it, and recover from its common failures without reading source.

### Why an operator audience is real here

Most servers in this family would not earn one. This one does, because the gate between reading and deleting is a deliberate, configured boundary rather than a matter of which tool you happen to call: at the default `read` level the destructive tools are not registered at all, so they are invisible to the model. Moving to `destructive` is an explicit act with its own consequences, and the reader performing it is doing a different job from the reader who wants yesterday's audit report. Splitting them lets the user guides stay short and lets the safety material be stated once, completely, where somebody about to delete something will find it.
