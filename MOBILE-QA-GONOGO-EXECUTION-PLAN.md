# AMLO Mobile QA + Go/No-Go Execution Plan

Last update: 2026-03-23
Owner: Engineering + QA + Release

Status legend:

- [ ] Not started
- [~] In progress
- [x] Completed

## Objective

Deliver a production-grade mobile release process for APK/AAB based on measurable quality gates, not assumptions.

This plan focuses on:

- Voice/video call stability on diverse Android devices and networks.
- Compatibility across Android versions and OEM power-management variants.
- Notification reliability in foreground/background/terminated app states.
- Login and critical service reliability under real-world failure conditions.
- Deterministic Go/No-Go decisions before release.

## Release Quality Targets (Go Criteria)

- Crash-free sessions >= 99.50%
- ANR rate < 0.50%
- Call setup success >= 98.00%
- Call drop rate <= 2.00%
- Push delivery success >= 97.00%
- Login success >= 99.00%
- APK install success >= 99.00%
- AAB pre-launch critical issues == 0

## Scope Matrix

Device/OEM coverage:

- Samsung (One UI)
- Xiaomi/Redmi (MIUI/HyperOS)
- Oppo/Realme (ColorOS)
- Vivo (Funtouch)
- Motorola / Nokia (near-stock)

OS coverage:

- Android 8, 9, 10, 11, 12, 13, 14+

Network coverage:

- Wi-Fi stable
- Wi-Fi unstable / packet loss
- 4G stable
- 4G weak signal
- Network handover (Wi-Fi <-> cellular)

App states:

- Foreground
- Background
- Terminated (cold start from notification)

## Stage Breakdown

## 1) Planning and Baseline

- [x] Stage 42: Create QA matrix + Go/No-Go execution framework files.
- [x] Stage 43: Define mandatory pass/fail thresholds and release blocker taxonomy.
- [x] Stage 44: Lock test cycles (Daily smoke, RC soak, Release gate).

Success criteria:

- A single source of truth exists for quality gates and required evidence.

## 2) Device and OS Validation

- [x] Stage 45: Build target device matrix by OEM, RAM tier, OS version.
- [x] Stage 46: Execute install/upgrade/uninstall/reinstall flows (APK + AAB builds).
- [~] Stage 47: Validate permissions, background behavior, battery optimization constraints.

Success criteria:

- No critical compatibility blocker remains in tier-1 devices.

## 3) Voice/Video Call Qualification

- [~] Stage 48: Call setup/answer/reconnect scenarios across matrix devices.
- [~] Stage 49: Long-call soak tests (15m/30m/60m) on mixed networks.
- [~] Stage 50: Bluetooth/speaker/earpiece route-switch validation.
- [~] Stage 51: Interruptions handling (incoming call, lockscreen, app switch, network flap).

Success criteria:

- Call KPIs meet release targets with no critical regressions.

## 4) Notification and Engagement Reliability

- [~] Stage 52: Push delivery matrix validation in all app states.
- [~] Stage 53: Notification action validation (open screen, deep-link, mark/read behaviors).
- [~] Stage 54: OEM battery policy mitigation checks (autostart/background restrictions).

Success criteria:

- Notification success rate meets target and navigation actions are deterministic.

## 5) Authentication and Core Services Reliability

- [~] Stage 55: Login/signup/OTP/social-login end-to-end matrix validation.
- [~] Stage 56: Session expiry/refresh/recovery behavior verification.
- [~] Stage 57: Failure-mode tests (provider timeout, bad credentials, retry UX).

Success criteria:

- Authentication and identity flows have no critical user-blocking defects.

## 6) Performance, Stability, and Store Readiness

- [~] Stage 58: Startup time, memory, battery, and thermal regression checks.
- [~] Stage 59: Play Console pre-launch report triage and closure.
- [~] Stage 60: Crash/ANR triage closure and release candidate sign-off pack.

Success criteria:

- Store-quality and runtime stability standards are satisfied.

## 7) Go/No-Go Decision Workflow

- [~] Stage 61: Aggregate run results into machine-readable QA report.
- [~] Stage 62: Execute automated gate checker and generate final decision report.
- [~] Stage 63: Release decision board sign-off and rollback readiness confirmation.

Success criteria:

- Release decision is evidence-based and reproducible.

## Execution Artifacts

- QA matrix template: `qa/device-matrix.template.csv`
- QA matrix execution file: `qa/device-matrix.csv`
- QA matrix coverage validator: `npm run qa:matrix:validate`
- Lifecycle execution guide: `qa/install-lifecycle-execution.md`
- Lifecycle audit report: `qa/results/install-lifecycle-summary.json`
- Compatibility execution guide: `qa/permissions-background-battery-execution.md`
- Compatibility audit report: `qa/results/compatibility-summary.json`
- Call setup/reconnect execution guide: `qa/call-setup-reconnect-execution.md`
- Call setup/reconnect audit report: `qa/results/call-setup-summary.json`
- Reliability/store execution guide: `qa/reliability-and-store-readiness-execution.md`
- Reliability/store audit report: `qa/results/reliability-summary.json`
- Final gate/signoff execution guide: `qa/final-gate-and-signoff-execution.md`
- Final QA report: `qa/results/final-qa-report.json`
- Go/No-Go decision report: `qa/results/go-no-go-decision.json`
- Release signoff readiness report: `qa/results/release-signoff-readiness.json`
- Decision board template: `qa/release-decision-board.md`
- Manual checklist: `qa/go-no-go-checklist.md`
- Gate automation script: `script/mobile-go-no-go.ts`
- Result input file (generated by QA run): `qa/results/current-run.json`

## Evidence Required for Go

- Device matrix execution report with pass/fail and logs.
- Call quality KPI summary from test runs.
- Notification delivery summary by app state and OEM.
- Authentication/service reliability summary.
- Store pre-launch + crash/ANR closure evidence.
- Final gate output from `npm run qa:go-no-go`.

## Current Execution Focus

- [~] Stage 47 active: compatibility schema + audit automation wired; waiting real device run evidence.
- [x] Release gate wiring updated: strict Stage 46/47 audits are now enforced before final `qa:go-no-go`.
- [~] Stage 48 active: call setup/reconnect audit automation wired; waiting real device run evidence.
- [~] Stages 49-60 active: reliability/store-readiness audit automation wired; waiting real device run evidence.
- [~] Stages 61-63 active: final aggregation, decision report, and signoff readiness automation wired.
