# Final Gate and Signoff Execution

This document defines Stages 61-63 execution.

## Stage 61: Aggregate machine-readable QA report

- Command: `npm run qa:final-report`
- Output: `qa/results/final-qa-report.json`

Pass condition:

- Metrics input file exists.
- Lifecycle, compatibility, call, and reliability audit decisions are `PASS`.

## Stage 62: Automated final gate decision report

- Command: `npm run qa:go-no-go`
- Output: `qa/results/go-no-go-decision.json`

Pass condition:

- KPI thresholds pass.
- No open P0/P1 blockers.
- Upstream audit decisions required by Stage 61 are `PASS`.

## Stage 63: Release signoff and rollback readiness confirmation

- Command: `npm run qa:release:signoff`
- Output: `qa/results/release-signoff-readiness.json`

Pass condition:

- Go/No-Go decision is `GO`.
- Final QA report decision is `PASS`.
- Rollback runbook is present.
- Release board template is present.
