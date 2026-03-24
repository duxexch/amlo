# Reliability and Store Readiness Execution

This document defines execution for Stages 49-60.

## Inputs

- Device matrix file: `qa/device-matrix.csv`
- Build under test: latest RC APK/AAB

## Required checks (by stage)

- Stage 49 soak: `call15mSoak`, `call30mSoak`, `call60mSoak`
- Stage 50 route switch: `bluetoothRoute`
- Stage 51 interruptions: `interruptionHandling`
- Stage 52 push states: `pushForeground`, `pushBackground`, `pushTerminated`
- Stage 53 notification actions: `notificationAction`
- Stage 54 OEM battery/autostart constraints: `batteryOptimization`, `oemAutostartPolicy`
- Stage 55 auth journeys: `loginFlow`, `otpFlow`, `socialLoginFlow`
- Stage 56 session recovery: `sessionRefresh`
- Stage 57 failure modes: `authFailureMode`
- Stage 58 performance/thermal: `startupPerf`, `memoryRegression`, `batteryRegression`, `thermalRegression`
- Stage 59 Play pre-launch triage: `playPrelaunchTriage`
- Stage 60 release signoff pack: `crashAnrClosure`, `rcSignoffPack`

## Matrix status values

Use only:

- `PASS`
- `FAIL`
- `PENDING`
- `NA`

## Audit commands

- Generate report:
  - `npm run qa:reliability:audit`
- Enforce pass-only mode:
  - `npm run qa:reliability:audit:strict`

## Completion rules

- Tier-1 checks are 100% completed (no `PENDING`).
- No `FAIL` remains in Tier-1 checks.
- Report decision is `PASS`.

## Output artifact

- `qa/results/reliability-summary.json`
