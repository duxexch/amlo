# Permissions, Background, and Battery Execution

This document defines Stage 47 execution for Android compatibility constraints.

## Inputs

- Device matrix file: `qa/device-matrix.csv`
- Build under test: latest RC APK/AAB

## Required checks per device

- `permissionsFlow`: Runtime permission prompts and recovery behavior (deny/allow/retry).
- `backgroundBehavior`: App behavior and key flows while app moves foreground <-> background.
- `batteryOptimization`: Behavior under OEM battery optimization and restricted background policies.

## Matrix status values

Use only these values in Stage 47 columns:

- `PASS`
- `FAIL`
- `PENDING`
- `NA`

## Audit commands

- Generate compatibility audit report:
  - `npm run qa:compat:audit`
- Enforce pass-only mode (for release gate usage):
  - `npm run qa:compat:audit:strict`

## Completion rule for Stage 47

- Tier-1 compatibility checks are 100% completed (no `PENDING` in Tier-1 Stage 47 columns).
- No `FAIL` remains in Tier-1 Stage 47 columns.
- Audit report decision must be `PASS`.

## Output artifact

- `qa/results/compatibility-summary.json`
