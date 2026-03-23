# APK/AAB Install Lifecycle Execution

This document defines Stage 46 execution for install/upgrade/uninstall/reinstall flows.

## Inputs

- Device matrix file: `qa/device-matrix.csv`
- Builds under test: APK and AAB release candidates

## Required lifecycle checks per device

- Fresh install (APK)
- Fresh install (AAB distributed build)
- Upgrade from previous version
- Uninstall + reinstall

## Matrix status values

Use only these values in lifecycle columns:

- `installApk`
- `installAab`
- `upgradeApk`
- `upgradeAab`
- `uninstallApk`
- `uninstallAab`
- `reinstallApk`
- `reinstallAab`

Allowed values:

- `PASS`
- `FAIL`
- `PENDING`
- `NA`

## Audit commands

- Generate audit report:
  - `npm run qa:lifecycle:audit`
- Enforce pass-only mode (for release gate usage):
  - `npm run qa:lifecycle:audit:strict`

## Completion rule for Stage 46

- Tier-1 device lifecycle checks are 100% completed (no `PENDING` in Tier-1 for lifecycle columns).
- No `FAIL` remains in Tier-1 lifecycle columns.
- Audit report decision must be `PASS`.

## Output artifact

- `qa/results/install-lifecycle-summary.json`
