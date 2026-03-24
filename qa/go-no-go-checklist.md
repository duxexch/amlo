# Mobile Go/No-Go Checklist

Release candidate: [fill]
Date: [fill]
Owner: QA Lead

## 1) Blocking Criteria

- [ ] No critical (P0/P1) open defects in tier-1 flows.
- [ ] No known data-loss/security/privacy blocker.
- [ ] Rollback package and runbook are ready.

## 2) KPI Thresholds

- [ ] Crash-free sessions >= 99.50%
- [ ] ANR rate < 0.50%
- [ ] Call setup success >= 98.00%
- [ ] Call drop rate <= 2.00%
- [ ] Push delivery success >= 97.00%
- [ ] Login success >= 99.00%
- [ ] APK install success >= 99.00%
- [ ] AAB pre-launch critical issues == 0

## 3) Functional Matrix

- [ ] Voice call setup/answer on tier-1 devices.
- [ ] Video call setup/answer on tier-1 devices.
- [ ] Call reconnect verified after transient network/app interruption.
- [ ] 30+ min call soak on representative network profiles.
- [ ] Bluetooth/speaker/earpiece route-switch verified.
- [ ] Notifications verified in foreground/background/terminated.
- [ ] Login (password/OTP/social) verified including failure handling.
- [ ] Permissions flow verified (allow/deny/retry) on tier-1 devices.
- [ ] Background behavior verified under app switching and process pressure.
- [ ] Battery optimization constraints validated across OEM policies.
- [ ] 15m/60m call soak and interruptions recovery validated.
- [ ] Session refresh and auth failure-mode handling validated.
- [ ] Startup/memory/battery/thermal regression checks passed.

## 4) Store Readiness

- [ ] Play pre-launch report reviewed.
- [ ] Store policy checks completed.
- [ ] Metadata/screenshots/signing validated.
- [ ] Final QA report is PASS and decision report is GO.
- [ ] Release signoff readiness is READY.

## 5) Final Decision

- [ ] GO
- [ ] NO-GO

Decision notes:

[fill]
