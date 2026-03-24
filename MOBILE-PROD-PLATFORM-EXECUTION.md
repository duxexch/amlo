# Mobile + Production Platform Execution Plan

Last update: 2026-03-23
Owner: Engineering
Status legend:

- [ ] Not started
- [~] In progress
- [x] Completed

## Stage 0 - Execution tracking bootstrap

- [x] Create this execution file.
- [x] Define stage-by-stage success criteria.

Success criteria:

- A single source of truth exists and is updated after each successful stage.

## Stage 1 - Production readiness gate automation

- [x] Add an automated readiness gate script.
- [x] Add npm script entry for the readiness gate.
- [x] Run the gate and verify success.

Success criteria:

- `npm run readiness:gate` exits successfully and prints pass summary.

## Stage 2 - Native mobile deep-link parity (Android + iOS)

- [x] Ensure Android App Links mapping file is present and valid JSON.
- [x] Add iOS Universal Links mapping file (`apple-app-site-association`).
- [x] Add setup documentation for mobile app teams.

Success criteria:

- Both Android and iOS association files exist under `client/public/.well-known/` and are documented.

## Stage 3 - Platform provider baseline docs

- [x] Add a provider-focused blueprint document for multi-tenant operation.
- [x] Define tenant isolation, branding, and rollout checklist.

Success criteria:

- A publishable baseline blueprint exists for onboarding similar customer projects.

## Stage 4 - Execution handoff

- [x] Mark completed stages.
- [x] Log implementation details in repo memory.

Success criteria:

- Change history is recorded in `memories/repo/CHANGE_LOG.md`.

## Stage 5 - Runtime tenant context baseline

- [x] Add middleware to resolve tenant from host/header.
- [x] Attach tenant context to request object for downstream routes/services.
- [x] Add optional env config keys for tenant mapping.

Success criteria:

- Requests include `req.tenantContext` and response headers expose resolved tenant id/source.

## Stage 6 - Tenant-aware response cache isolation

- [x] Namespace fast-cache keys by tenant id.
- [x] Resolve tenant context before fast-cache middleware.
- [x] Allow `X-Tenant-Id` in CORS request headers.

Success criteria:

- Shared GET cache paths do not leak responses across tenants.

## Stage 7 - Tenant-aware pricing/settings resolution

- [x] Make pricing service cache keys tenant-scoped.
- [x] Resolve tenant-specific system setting keys with global fallback.
- [x] Pass tenant id from social/admin/world routes to pricing service.

Success criteria:

- Pricing and chat/call feature toggles can be overridden per tenant without cross-tenant cache overlap.

## Stage 8 - Tenant-aware admin pricing write paths

- [x] Scope admin pricing setting writes by tenant context when present.
- [x] Keep global keys as fallback when tenant is default/invalid.
- [x] Invalidate pricing cache per tenant after admin writes.

Success criteria:

- Admin updates to call/message pricing can target a tenant without overwriting global defaults.

## Stage 9 - Explicit admin pricing scope controls (UI + API)

- [x] Add explicit scope contract to pricing API (`request`, `global`, `tenant`).
- [x] Add backend validation for `tenant` scope requiring valid tenant id.
- [x] Add admin pricing UI controls for selecting update scope and entering tenant id.
- [x] Wire pricing reads/writes to selected scope in admin client.

Success criteria:

- Admin can deliberately choose global defaults or a specific tenant when updating pricing, without relying on host/header context.

## Stage 10 - Explicit admin sections scope controls (UI + API)

- [x] Add explicit scope contract to sections API (`request`, `global`, `tenant`).
- [x] Add backend validation for `tenant` scope requiring valid tenant id.
- [x] Add admin sections UI controls for selecting scope and entering tenant id.
- [x] Make public sections visibility endpoint resolve tenant keys with global fallback.

Success criteria:

- Section visibility can be intentionally managed per tenant or globally, and app reads respect tenant override with fallback.

## Stage 11 - Tenant-aware advanced limits & missions scope

- [x] Add explicit scope contract to daily missions and content limits admin endpoints (`request`, `global`, `tenant`).
- [x] Add tenant-aware fallback resolution for daily missions runtime reads in social routes.
- [x] Add tenant-aware fallback resolution for content limits runtime reads in posts routes.
- [x] Add admin UI scope controls for daily missions/content limits with scoped reload action.

Success criteria:

- Admin can read/write daily missions and content limits by explicit scope, and runtime behavior uses tenant override with global fallback.

## Stage 12 - Tenant-aware app download & notification sounds scope

- [x] Add explicit scope contract to app download and notification sounds admin endpoints (`request`, `global`, `tenant`).
- [x] Add tenant-aware fallback resolution for public app download endpoint.
- [x] Add tenant-aware fallback resolution for public notification sounds endpoint.
- [x] Add admin UI scope controls for app download/notification sounds with scoped reload action.

Success criteria:

- App download and notification sounds can be managed per tenant or globally, and public reads honor tenant override with global fallback.

## Stage 13 - Tenant-aware chat moderation/settings scope

- [x] Add explicit scope contract to admin chat moderation endpoints (`request`, `global`, `tenant`).
- [x] Add explicit scope contract to admin chat settings endpoints (`request`, `global`, `tenant`).
- [x] Add scoped tenant fallback resolution for moderation category and chat settings keys.
- [x] Add admin chat UI scope controls with scoped reload action.

Success criteria:

- Admin chat moderation/settings can be read and updated by explicit scope, with tenant override keys falling back to global defaults when missing.

## Stage 14 - Tenant-aware stream alert config/history scope

- [x] Add explicit scope contract to stream alert config endpoints (`request`, `global`, `tenant`).
- [x] Add explicit scope contract to stream alert history endpoints (`request`, `global`, `tenant`).
- [x] Store and resolve tenant-scoped alert config/history keys with global fallback.
- [x] Add admin live-stream UI scope controls with scoped reload action.

Success criteria:

- Stream alert thresholds and alert history are manageable per tenant or globally, with consistent scoped reads/writes and fallback behavior.

## Stage 15 - Tenant-aware stream whitelist scope

- [x] Add explicit scope contract to stream whitelist admin endpoints (`request`, `global`, `tenant`).
- [x] Store stream whitelist keys in tenant-scoped form for tenant targets.
- [x] Add tenant-aware fallback resolution for stream create permission checks in social runtime.
- [x] Wire stream whitelist admin UI calls to selected scope.

Success criteria:

- Stream whitelist management and stream-create gating honor tenant-specific overrides with global fallback, and admins can operate whitelist entries by explicit scope.

## Stage 16 - Tenant-aware per-user can-stream override scope

- [x] Add explicit scope contract to admin user can-stream endpoint (`request`, `global`, `tenant`).
- [x] Store tenant-scoped per-user can-stream overrides under system settings for tenant targets.
- [x] Add tenant-aware runtime fallback resolution for user can-stream checks during stream creation.
- [x] Extend admin chat API client toggle method to pass optional scope payload.

Success criteria:

- Admins can set per-user stream permission globally or for a specific tenant scope, and stream creation runtime resolves effective permission using tenant override then global/default fallback.

## Stage 17 - Scoped admin UI controls for per-user can-stream

- [x] Wire stream whitelist admin UI to call scoped `toggleUserCanStream` actions.
- [x] Show current user stream-permission status in whitelist rows.
- [x] Add quick enable/disable stream controls in whitelist/search results lists.

Success criteria:

- Admin operators can manage per-user stream permission from UI under selected scope (`request`, `global`, `tenant`) without leaving stream-whitelist workflow.

## Stage 18 - Resilient scoped stream-whitelist UX

- [x] Add error feedback to scoped whitelist and can-stream actions in admin UI.
- [x] Prevent duplicate clicks during in-flight whitelist/permission operations.
- [x] Keep current scoped behavior intact while improving operator safety.

Success criteria:

- Scoped stream-whitelist actions fail gracefully with visible feedback and no accidental repeated writes from rapid clicks.

## Stage 19 - Success feedback parity for scoped stream controls

- [x] Add success feedback to scoped stream-whitelist add/remove actions.
- [x] Add success feedback to scoped per-user can-stream toggle actions.
- [x] Keep existing error feedback and in-flight guards intact.

Success criteria:

- Admin operators receive immediate confirmation for successful scoped stream moderation actions, matching existing failure feedback quality.

## Stage 20 - Scoped feedback context consistency in admin chat UX

- [x] Add shared helper for displaying explicit scope context labels (`request`, `global`, `tenant:<id>`).
- [x] Append scope context labels to stream whitelist add/remove and per-user can-stream success/failure feedback.
- [x] Append scope context labels to stream alert config/history success/failure feedback.

Success criteria:

- Operators can immediately identify which scope a completed/failed admin action targeted from toast feedback alone.

## Stage 21 - Resilient moderation actions for reports and blocks

- [x] Add in-flight guard in reports status-update action to prevent repeated submissions.
- [x] Improve report status action affordance by showing loading state consistently across all action buttons.
- [x] Add user-facing success/failure toast feedback and load-error retry surface in blocks tab.

Success criteria:

- Report/block moderation actions provide clear operator feedback, reduce duplicate writes, and expose recoverable retry behavior on load failures.

## Stage 22 - Operator-safety hardening for conversations/messages/calls tabs

- [x] Add in-flight guards and loading affordance for destructive actions in Conversations tab.
- [x] Add in-flight guards and loading affordance for single/bulk message delete in Messages tab.
- [x] Add load-error retry surface and in-flight guarded force-end action feedback in Calls tab.

Success criteria:

- Core moderation actions in conversations, messages, and calls provide explicit progress feedback and prevent accidental duplicate submissions under repeated clicks.

## Stage 23 - Unified providers overview baseline API (admin backend)

- [x] Add a consolidated admin endpoint `GET /api/admin/providers/overview`.
- [x] Include summary coverage for social login, OTP SMS, payment gateways, payment methods, and app download states.
- [x] Include tenant-aware app download status in response summary.

Success criteria:

- Admin backend exposes one normalized providers-health payload that can be used to build a Providers Hub UI without additional fan-out calls.

## Stage 24 - Admin Providers Hub UI integration

- [x] Add Providers Hub page in admin panel.
- [x] Wire Providers Hub route and admin sidebar navigation.
- [x] Connect Providers Hub UI to `GET /api/admin/providers/overview` via admin API client.

Success criteria:

- Admin operators can open one dedicated screen to review provider readiness across social, OTP, payment gateways/methods, and app download toggles.

## Stage 25 - Provider health badges and actionable warnings

- [x] Add explicit health badges in provider matrix rows (healthy/warning/disabled).
- [x] Add actionable warning panel with direct navigation actions to fix configuration issues.
- [x] Add deep-link query support for target tabs in settings/finances pages used by warning actions.

Success criteria:

- Providers Hub surfaces clear remediation actions and takes operators directly to the relevant configuration surface.

## Stage 26 - Provider audit grouping by category

- [x] Reuse admin logs feed to power provider-audit timeline in Providers Hub.
- [x] Group provider-related logs by category (social, OTP, payment gateway, payment method, app download).
- [x] Render grouped timeline cards with recent events for each provider category.

Success criteria:

- Admin can review recent provider changes grouped by provider domain from one screen.

## Stage 27 - App artifact metadata baseline (APK/AAB)

- [x] Extend app-download config schema for APK/AAB with metadata fields: `version`, `build`, `checksum`, `sizeBytes`.
- [x] Persist metadata through admin app-download update endpoint.
- [x] Expose metadata in public `/api/app-download` response with backward-compatible defaults.
- [x] Add metadata inputs to Admin Settings > App Download tab for APK/AAB.

Success criteria:

- APK/AAB metadata exists as first-class config in backend and admin UI, ready for validation and public integrity display stages.

## Stage 28 - Admin validation for artifact URL + metadata

- [x] Add server-side validation for enabled APK/AAB artifacts before saving app-download settings.
- [x] Enforce valid resolved URL (`url` or `domain + extension`) with `http/https` protocol.
- [x] Enforce metadata completeness for enabled artifacts: `version`, `build`, `checksum`, `sizeBytes`.
- [x] Return structured validation errors from admin app-download endpoint for operator feedback.

Success criteria:

- Invalid APK/AAB metadata no longer persists in admin settings when artifacts are enabled.

## Stage 29 - Public download integrity metadata display

- [x] Extend download page model to support `version`, `build`, `checksum`, and `sizeBytes` from public API.
- [x] Render integrity metadata panel on APK/AAB cards (version/build, checksum preview, and formatted size).
- [x] Keep behavior backward-compatible when metadata fields are missing.

Success criteria:

- Users can visually verify download artifact identity metadata before installing APK/AAB.

## Stage 30 - Tenant rollout flags for staged release

- [x] Add `rollout` config block to app-download settings (`enabled`, `apkPercent`, `aabPercent`, `allowTenants`, `blockTenants`).
- [x] Add rollout controls in Admin Settings > App Download (percentages and allow/block tenant lists).
- [x] Apply rollout gating in public `/api/app-download` for APK/AAB using deterministic tenant bucketing.

Success criteria:

- APK/AAB exposure can be staged and controlled per tenant without changing client binaries.

## Stage 31 - Server-side call QoS snapshot endpoint

- [x] Added admin endpoint `GET /api/admin/call-qos/snapshot` with configurable time window.
- [x] Included operational call snapshot metrics (volume/status/type, reliability rates, duration, billing totals).
- [x] Included matching engine queue stats in same payload for operations context.
- [x] Added admin client integration method `adminCallQos.getSnapshot(windowMinutes)`.

Success criteria:

- Admin operations can fetch a single server-side call quality snapshot without manual multi-endpoint fan-out.

## Stage 32 - Time-window call quality aggregation

- [x] Added admin endpoint `GET /api/admin/call-qos/aggregation` with `windowMinutes` and `bucketMinutes`.
- [x] Implemented server-side bucket aggregation of call quality-operational metrics by time window.
- [x] Included per-bucket reliability, duration, billing, and call-volume splits.
- [x] Added client integration `adminCallQos.getAggregation(windowMinutes, bucketMinutes)`.

Success criteria:

- Admin can fetch time-series aggregated call quality snapshots for operational analysis in one endpoint.

## Stage 33 - Threshold alerts and incident logging

- [x] Added admin endpoint `POST /api/admin/call-qos/evaluate-alerts` for threshold evaluation.
- [x] Implemented threshold rules for connect/missed/busy/failed rates.
- [x] Implemented rate-limited incident logging via admin audit log (`call_qos_incident`) to prevent noisy repeats.
- [x] Added client helper `adminCallQos.evaluateAlerts(...)`.

Success criteria:

- Call quality regressions can be detected and logged server-side with cooldown-protected incident events.

## Stage 34 - Admin call QoS dashboard widgets and drill-down links

- [x] Added new admin tab `Call QoS` in Chat Management to visualize operational call quality from QoS APIs.
- [x] Added call QoS widgets for volume, connect rate, failed calls, and duration (avg/p95).
- [x] Added time-series charts for reliability and volume using aggregation endpoint buckets.
- [x] Added alert evaluation panel wired to `POST /api/admin/call-qos/evaluate-alerts`.
- [x] Added drill-down actions from QoS incidents to related admin tabs (reports, moderation, overview).
- [x] Added query-string tab syncing (`?tab=`) in chat management for stable deep-link navigation.

Success criteria:

- Admin operations can monitor call quality and navigate directly to remediation surfaces from one dashboard without viewing user conversation/call content.

## Stage 35 - Smoke checks for critical admin/provider endpoints

- [x] Extended production smoke script `script/production-smoke-check.sh` to check public app download endpoint (`/api/app-download`).
- [x] Extended production smoke script `script/production-smoke-check.sh` to check admin providers overview endpoint (`/api/admin/providers/overview`).
- [x] Extended production smoke script `script/production-smoke-check.sh` to check admin call QoS snapshot endpoint (`/api/admin/call-qos/snapshot`).
- [x] Extended production smoke script `script/production-smoke-check.sh` to check admin call QoS aggregation endpoint (`/api/admin/call-qos/aggregation`).
- [x] Extended production smoke script `script/production-smoke-check.sh` to check admin call QoS alert evaluation endpoint (`/api/admin/call-qos/evaluate-alerts`).
- [x] Added unauthenticated admin check mode (expects 401/403) to verify endpoint protection.
- [x] Added authenticated admin check mode using `ADMIN_COOKIE` (expects 200).
- [x] Added npm script alias `npm run smoke:prod`.

Success criteria:

- Operations can run one smoke command that validates core public and admin provider/QoS surfaces, including auth protection and authenticated success paths.

## Stage 36 - Regression tests for tenant scope fallback and provider overview contract

- [x] Added tenant scope fallback unit tests in `tests/tenantScopeFallback.test.ts`.
- [x] Added provider overview contract tests in `tests/providersOverviewContract.test.ts`.
- [x] Added reusable tenant-scope utilities in `server/utils/tenantScope.ts` and wired admin routes to use them.
- [x] Added providers overview response contract schema in `server/contracts/adminProvidersOverview.ts` and enforced it in admin route response builder.
- [x] Regression test files compile cleanly in workspace diagnostics; test runtime execution can be run once Vitest dependencies are available in environment.

Success criteria:

- Tenant-scoped fallback behavior and providers overview API shape are protected by repeatable regression tests.

## Stage 37 - Release checklist automation (build, migration, health, smoke)

- [x] Added orchestrated checklist script `script/release-checklist.ts` to run release gates in deterministic order.
- [x] Included automated steps for type-check, build, DB migration (opt-in), readiness gate, and smoke checks (opt-in).
- [x] Added safe execution controls through environment flags:

- [x] Added `RUN_DB_MIGRATE=1` control to include migration step.
- [x] Added `RUN_SMOKE=1` control to include smoke step.
- [x] Added skip controls `SKIP_TYPECHECK=1`, `SKIP_BUILD=1`, `SKIP_READINESS=1`.
- [x] Added npm commands:

- [x] Added npm command `npm run release:checklist`.
- [x] Added npm command `npm run release:checklist:dry`.

Success criteria:

- Release verification sequence is executable from one command with clear pass/fail output and safe opt-in controls for mutation/production checks.

## Stage 38 - Post-deploy verification and rollback playbook updates

- [x] Updated production runbook `RUNBOOK-PROD-DEPLOY-AND-MONITORING.md` with explicit post-deploy verification workflow.
- [x] Added runbook commands that use the new release checklist (`release:checklist:dry` and `release:checklist`) for consistent verification execution.
- [x] Added rollback decision matrix with trigger conditions and explicit rollback sequence.
- [x] Added post-rollback validation checklist and success criteria.

Success criteria:

- Deployment runbook now provides deterministic post-deploy validation and rollback operations aligned with automated checklist tooling.
