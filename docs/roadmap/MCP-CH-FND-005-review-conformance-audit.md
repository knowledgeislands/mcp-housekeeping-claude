---
id: MCP-CH-FND-005
title: Review conformance audit
area: FND
theme: foundation-tooling
horizon: next
status: awaiting-review
blocks: []
blocked_by: []
baseline_ref: 771ebfdc06923fb7a39f4277d5032e6822853b4c
created_at: 2026-09-04T08:54:08Z
updated_at: 2026-10-01T20:13:58Z
---

## Goal

Reconcile the retained conformance findings with current evidence and recommend whether any distinct remediation remains, without implementing the same fixes again.

## Context

The pickup checkpoint records Decision Records adoption and managed `.gitignore` fixes plus passing focused and full audits. The original item has only a broad description of the findings, so the missing part is a traceable evidence/disposition review rather than an assumed repeat implementation.

## Boundary

A bounded evidence reconciliation and recommendation only. Do not modify application code, configuration, GitHub settings, runtime bindings, dependencies, or source stores. Do not accept or prune historical records. Fresh findings are classified and scoped for later selection, not repaired during this review.

## Current state

The retained checkpoint below supplies the historical references. Current inputs are `.ki.toml`, `.gitignore`, `docs/decisions/GDR-MCP-CH-001-adopting-decision-records.md`, Decision Records index, and Git history for the cited repair commits. The checkpoint is evidence to test, not a guarantee that its findings or clean gates remain current.

## Steps

- [x] Pin current HEAD and inspect the cited Decision Records and managed-ignore repair commits; recover original criteria from retained evidence or the relevant current standard, distinguishing reconstructed from original criteria.
- [x] Run fresh `ki repo audit --skill ki-decision-records --repo .` and `ki repo audit --skill ki-repo --repo .` sequentially and preserve exact finding identities and exit codes. Inspect the adopted Decision Record, index, and managed ignore markers against those criteria.
- [x] Add an evidence matrix to this record's Discussion mapping each historical finding to the delivered change, current observation, and either a specific remaining gap or an evidenced no-remediation recommendation. State explicitly when original evidence could not be recovered.
- [x] If a fresh issue differs from the original scope, identify its separate owner and smallest follow-on proposal rather than silently widening this review. No repair is performed in this item.
- [x] Prepare the review packet and run roadmap/authoring checks. Recommend acceptance or another disposition with exact supporting evidence, leaving the human lifecycle decision separate.

## Files touched

This roadmap record only. All listed source, history, standard, and remote evidence inputs are read-only. Put the durable evidence summary and recommendation in the record; temporary raw command logs do not become a new repository documentation surface.

## Verify

Both historical concern classes must have pinned repair evidence and fresh audit results or an explicit unresolved evidence limitation. Any remaining gap must name a concrete criterion and affected file. The diff must be confined to the review record, and the review must not label an old delivered fix as new work. Run `ki repo audit --skill ki-work-roadmap --repo .`, `ki repo audit --skill ki-authoring --repo .`, and `bunx rumdl check docs/roadmap/MCP-CH-FND-005-review-conformance-audit.md` sequentially. Audit failures in the reviewed contract are review results to classify, not authority to repair unrelated files.

## Dependencies / blocks

No build-order blocker to the review. Missing historical material or unavailable remote fields are explicit findings and constrain the recommendation; they do not justify claiming a verified repair or starting implementation. Reconcile any live delivery claims before a later implementation assignment; this read-only evidence review does not release other owners.

## Documentation impact

### Decision Records

Trace any existing rationale in the evidence matrix. Recommend a separately reviewed decision only where the current policy needs clarification; do not fabricate an accepted decision during an audit review.

### Specifications

No behaviour contract changes. Cite criteria and distinguish current observation from the desired rule.

### Guides

No guide changes in this review. Identify a precise guide mismatch as a follow-on only if the evidence establishes one.

### Roadmap

Enrich this retained item with a review deliverable and exact remaining-action recommendations. Do not self-accept, duplicate delivered repairs, or close historical work through a status edit.

## Review

### Delivered

Completed the approved evidence-reconciliation boundary for MCP-CH-FND-005 at baseline `771ebfdc06923fb7a39f4277d5032e6822853b4c`. The result is a concern-by-concern assessment and owner recommendation in this record; historical implementation, acceptance, source fixes, remote settings changes, and pruning remain outside this delivery.

### Change Summary

Updated only `docs/roadmap/MCP-CH-FND-005-review-conformance-audit.md` with pinned current evidence, historical limits, the recommendation, completed investigation steps, and this review packet. No deviation from the planned boundary.

### Verification

Focused `ki-repo`, `ki-decision-records`, `ki-git`, `ki-work-roadmap`, and `ki-authoring` audits passed at the pinned baseline. Read-only GitHub metadata was inspected where a hosted concern was named. No application code, hosting setting, or external service was changed.

### Outstanding concerns

Original estate-audit finding identifiers and judgment criteria are missing from the retained item. The recommendation is limited to current observed conformance; no reproducible remaining local repair was identified.

### Post-change review

The record now answers its review goal with sourced current observations and explicit limits. It does not claim that a mechanical pass accepts historical judgment or that an unrecoverable criterion was met. The delivery is ready for the owner's acceptance decision on this review packet.

### Mini recap

Reconciled retained conformance concerns against the current repository and proposed the narrow disposition above. Required review audits passed; any reviewed failing contract is identified in Outstanding concerns. Further policy changes or repairs must use their named owner and normal work selection.

## Discussion

### Bounded review outcome

Readiness applies to the evidence reconciliation and recommendation. A supported no-remediation conclusion is useful delivery; implementation of speculative fixes is not part of this plan. The existing pickup checkpoint remains below as historical input.

Review the evidence before deciding whether to repair, defer, or document an exception.

### Pickup checkpoint — 2026-09-28

At inspected local `main` `d26e40e92a662b8178a7af0b6f69012a3828b014`, `8dbaf6f` added the Decision Records adoption record at `docs/decisions/GDR-MCP-CH-001-adopting-decision-records.md`, and `4f67d4212f5b09ea87b0f19bbefa6e971bef893e` conformed root `.gitignore` to managed marker blocks. Fresh `ki repo audit --skill ki-decision-records --repo .` and `ki repo audit --skill ki-repo --repo .` both reported PASS; the full `ki repo audit --repo .` reported PASS across 21 selected skills. The historical Decision Records and ignore findings are not current focused failures, but the original finding identities and acceptance criteria are not preserved in this item beyond its brief Context, and the fresh audits are mechanical evidence rather than an accepted discussion outcome. Before resuming review or implementation, reconcile the destination branch, linked tasks, and retained worktrees and recover any remaining historical finding evidence. This checkpoint is pickup guidance, not an execution block or authority grant; absent evidence does not release any owner or lift a hold. This audit leaves `future`/`draft` unchanged; later closure requires review and explicit owner acceptance, with the done record retained until explicit pruning selection.

### Evidence reconciliation — 2026-10-01

The delivery baseline is local `main` `771ebfdc06923fb7a39f4277d5032e6822853b4c`. The retained earlier pickup is historical evidence. Fresh focused audits ran at this baseline; `ki-git` contains judgment prompts that a reported PASS does not itself decide. The original estate-audit finding IDs and full acceptance criteria were not recoverable from this canonical record; each limit is stated below.

- **Decision Records adoption.** Commit `8dbaf6f` added the adoption Decision Record and index. The current `ki-decision-records` audit passes; no repeat adoption is indicated.

- **Managed ignore rules.** Commit `4f67d4212f5b09ea87b0f19bbefa6e971bef893e` changed `.gitignore`. The current `ki-repo` audit passes; no repeat ignore-file change is indicated.

- **Historical limits.** The retained item does not preserve the original finding identifiers or judgment criteria. The current mechanical passes support only present conformance. Recommend that the owner accept no further action under this record unless the original criterion or a reproducible gap is supplied.

**Recommendation.** No distinct current remedial edit is supported by the reviewed evidence; retain the missing historical criteria as a limit on the conclusion.
