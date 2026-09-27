---
id: MCP-CH-FND-005
title: Review conformance audit
area: FND
theme: foundation-tooling
horizon: future
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-04T08:54:08Z
updated_at: 2026-09-27T23:20:42Z
---

## Goal

Discuss the unresolved repository conformance findings before selecting remediation.

## Context

The estate audit reported Decision Records adoption and managed `.gitignore` findings.

## Boundary

This is a discussion proposal only. It is not accepted, prioritised, or implementation authority.

## Shaping

Confirm the exact acceptance criteria, distinguish deterministic maintenance from design choices, and define focused verification.

## Discussion

Review the evidence before deciding whether to repair, defer, or document an exception.

### Pickup checkpoint — 2026-09-28

At inspected local `main` `d26e40e92a662b8178a7af0b6f69012a3828b014`, `8dbaf6f` added the Decision Records adoption record at `docs/decisions/GDR-MCP-CH-001-adopting-decision-records.md`, and `4f67d4212f5b09ea87b0f19bbefa6e971bef893e` conformed root `.gitignore` to managed marker blocks. Fresh `ki repo audit --skill ki-decision-records --repo .` and `ki repo audit --skill ki-repo --repo .` both reported PASS; the full `ki repo audit --repo .` reported PASS across 21 selected skills. The historical Decision Records and ignore findings are not current focused failures, but the original finding identities and acceptance criteria are not preserved in this item beyond its brief Context, and the fresh audits are mechanical evidence rather than an accepted discussion outcome. Before resuming review or implementation, reconcile the destination branch, linked tasks, and retained worktrees and recover any remaining historical finding evidence. This checkpoint is pickup guidance, not an execution block or authority grant; absent evidence does not release any owner or lift a hold. This audit leaves `future`/`draft` unchanged; later closure requires review and explicit owner acceptance, with the done record retained until explicit pruning selection.
