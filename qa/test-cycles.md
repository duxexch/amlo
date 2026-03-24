# Mobile QA Test Cycles

This document locks the mandatory test cycles for mobile release readiness.

## Cycle A: Daily Smoke (per active development day)

Purpose:

- Catch fast regressions in core mobile journeys.

Required checks:

- Install APK on one tier-1 and one tier-2 device.
- Login success (primary method + one fallback method).
- Notification open action from foreground and background.
- One voice call setup and one video call setup.
- Quick gate sanity run in dry mode: `npm run qa:go-no-go:dry`.

Pass rule:

- No open P0/P1 introduced by day-end.

## Cycle B: RC Soak (per release candidate)

Purpose:

- Validate runtime stability under prolonged usage.

Required checks:

- 30-minute and 60-minute call soak on mixed network profiles.
- Background/terminated notification verification on at least 3 OEM families.
- Login/session refresh behavior after long idle period.
- Battery and thermal observation on at least one mid-tier device.

Pass rule:

- KPI values are within thresholds in `qa/thresholds.json`.
- No open P0/P1 blocker remains.

## Cycle C: Release Gate (mandatory before GO)

Purpose:

- Produce final evidence-based release decision.

Required inputs:

- `qa/results/current-run.json` filled with current candidate metrics and blockers.
- `qa/results/install-lifecycle-summary.json` with decision `PASS`.
- `qa/results/compatibility-summary.json` with decision `PASS`.
- `qa/results/call-setup-summary.json` with decision `PASS`.
- `qa/results/reliability-summary.json` with decision `PASS`.
- `qa/results/final-qa-report.json` with decision `PASS`.
- `qa/results/go-no-go-decision.json` with decision `GO`.

Required command:

- `RUN_QA_GATE=1 npm run release:checklist` (Linux/macOS)
- `$env:RUN_QA_GATE='1'; npm run release:checklist` (PowerShell)

Pass rule:

- Release checklist result is `PASSED`.
- Strict lifecycle and compatibility audits pass.
- Strict call setup/reconnect audit passes.
- Strict reliability/store-readiness audit passes.
- Mobile Go/No-Go decision is `GO`.
- Release signoff readiness is `READY`.

## Ownership

- QA Lead: prepares `current-run.json` and blocker status.
- Engineering Lead: closes technical blockers and signs mitigation.
- Release Manager: executes release gate and makes final GO/NO-GO call.
