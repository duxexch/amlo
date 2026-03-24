# Call Setup, Answer, and Reconnect Execution

This document defines Stage 48 execution for call qualification across matrix devices.

## Inputs

- Device matrix file: `qa/device-matrix.csv`
- Build under test: latest RC APK/AAB

## Required checks per device

- `voiceCallSetup`: Voice call setup/answer end-to-end.
- `videoCallSetup`: Video call setup/answer end-to-end.
- `callReconnect`: Reconnect behavior after transient network drop or app interruption.

## Matrix status values

Use only these values in Stage 48 columns:

- `PASS`
- `FAIL`
- `PENDING`
- `NA`

## Audit commands

- Generate call qualification report:
  - `npm run qa:call:audit`
- Enforce pass-only mode (for release gate usage):
  - `npm run qa:call:audit:strict`

## Completion rule for Stage 48

- Tier-1 call qualification checks are 100% completed (no `PENDING` in Tier-1 Stage 48 columns).
- No `FAIL` remains in Tier-1 Stage 48 columns.
- Audit report decision must be `PASS`.

## Output artifact

- `qa/results/call-setup-summary.json`
