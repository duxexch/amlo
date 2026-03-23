# Master Technical Execution Plan

Last update: 2026-03-23
Owner: Engineering

Reference blueprint:

- `FOUR-AXES-EXECUTION-BLUEPRINT.md` (Service Providers, Admin, APK/AAB, Call QoS)
- `MOBILE-QA-GONOGO-EXECUTION-PLAN.md` (Device matrix + Go/No-Go quality gates)

Status legend:

- [ ] Not started
- [~] In progress
- [x] Completed

## 1) Foundation and Multi-Tenant Core

- [x] Stage 0: Execution tracking bootstrap.
- [x] Stage 1: Production readiness gate automation.
- [x] Stage 2: Native mobile deep-link parity (Android + iOS).
- [x] Stage 3: Provider-platform baseline documentation.
- [x] Stage 4: Execution handoff and memory logging.
- [x] Stage 5: Runtime tenant context baseline.
- [x] Stage 6: Tenant-aware response cache isolation.
- [x] Stage 7: Tenant-aware pricing/settings resolution.
- [x] Stage 8: Tenant-aware admin pricing write paths.
- [x] Stage 9: Explicit admin pricing scope controls.
- [x] Stage 10: Explicit admin sections scope controls.
- [x] Stage 11: Tenant-aware advanced limits and missions scope.
- [x] Stage 12: Tenant-aware app download and notification sounds scope.

## 2) Admin Chat Scope and Operator Safety

- [x] Stage 13: Tenant-aware chat moderation/settings scope.
- [x] Stage 14: Tenant-aware stream alert config/history scope.
- [x] Stage 15: Tenant-aware stream whitelist scope.
- [x] Stage 16: Tenant-aware per-user can-stream override scope.
- [x] Stage 17: Scoped admin UI controls for per-user can-stream.
- [x] Stage 18: Resilient scoped stream-whitelist UX.
- [x] Stage 19: Success feedback parity for scoped stream controls.
- [x] Stage 20: Scoped feedback context consistency in admin chat UX.
- [x] Stage 21: Resilient moderation actions for reports and blocks.
- [x] Stage 22: Operator-safety hardening for conversations/messages/calls tabs.

## 3) Provider Control Plane (Admin)

- [x] Stage 23: Add backend Provider Overview API.
- [x] Stage 24: Add admin Providers Hub tab consuming Provider Overview API.
- [x] Stage 24.1: Add `adminProviders.getOverview()` client integration in `adminApi`.
- [x] Stage 25: Add provider health badges and actionable warnings in admin UI.
- [x] Stage 26: Add provider audit log grouping by provider category.

Success criteria:

- Admin has one unified control surface for social, OTP, payment gateways, and payment methods with clear health signals.

## 4) Mobile Distribution and APK/AAB Governance

- [x] Stage 27: Add app-download artifact metadata (version, build, checksum, size).
- [x] Stage 28: Add admin validation for APK/AAB URL and metadata completeness.
- [x] Stage 29: Add public download integrity display (version + checksum).
- [x] Stage 30: Add rollout flags per tenant for staged mobile release.

Success criteria:

- APK/AAB delivery is verifiable and controlled per tenant with release safety.

## 5) Call Quality and Real-Time QoS

- [x] Stage 31: Add server-side QoS snapshot endpoint for admin operations.
- [x] Stage 32: Add call quality aggregation (RTT/jitter/loss/MOS) by time window.
- [x] Stage 33: Add threshold alerts and rate-limited incident logging.
- [x] Stage 34: Add admin call quality dashboard widgets and drill-down links.

Success criteria:

- Real-time call quality is measurable, alertable, and actionable from admin tools.

## 6) Observability, Reliability, and Release

- [x] Stage 35: Add smoke checks for critical admin/provider endpoints.
- [x] Stage 36: Add regression tests for tenant scope fallback and provider overview contract.
- [x] Stage 37: Add release checklist automation (build, migration, health, smoke).
- [x] Stage 38: Add post-deploy verification and rollback playbook updates.
- [x] Stage 39: Enforce backend privacy guard for admin chat/call content endpoints.
- [x] Stage 40: Add regression policy tests for admin chat content restriction rules.
- [x] Stage 41: Add production smoke assertions for 403 enforcement on restricted admin chat endpoints.

Success criteria:

- Releases are safer, faster to verify, and easier to rollback.

## 7) Current Execution Focus

## 8) Mobile QA Matrix and Go/No-Go

- [x] Stage 42: Create QA matrix + go/no-go framework artifacts and automation script.
- [x] Stage 43: Finalize thresholds taxonomy and release blocker policy.
- [x] Stage 44: Integrate QA gate run into release checklist and runbook flow.

Success criteria:

- Release decision is evidence-based using matrix results and automated gates.

## 9) Current Execution Focus

- [x] Stage 45: Build target device matrix by OEM, RAM tier, OS version.
- [x] Stage 46 completed: lifecycle schema + audit automation wired for install/upgrade/uninstall/reinstall.
- [~] Stage 47 active: permissions/background/battery compatibility audit framework added; waiting real device run outcomes.
- [x] Stage 44 gate wiring extended: release checklist now runs strict lifecycle/compatibility audits before `qa:go-no-go`.
- [~] Stage 48 active: call setup/reconnect audit framework added and wired into release gate.
- [~] Stages 49-60 active: reliability/store-readiness audit framework added and wired into release gate.
- [~] Stages 61-63 active: final QA aggregation, machine-readable decision report, and signoff readiness checks added.
