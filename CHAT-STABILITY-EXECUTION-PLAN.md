# AMLO Chat Stability Execution Plan

## Goal
Achieve production-grade chat/social stability for ~5,000 concurrent active users and ~70,000 regular users with measurable SLOs and safe rollout.

## Current Execution Status (Started)
- Completed now:
  - Distributed job locking for periodic social/world cleanups via Postgres advisory locks.
  - Scheduled stream activation made atomic/idempotent (race-safe update condition).
  - Scheduled stream now avoids premature LiveKit room creation and host viewer allocation.
  - Redis-backed message decrypt cache added on hot chat read paths.
  - Notification dedup key improved and duplicate fallback bug fixed.

## SLOs (Service Level Objectives)
- Message send success rate: >= 99.95%
- Chat fetch p95 latency: < 250ms
- Send-to-delivered p95 latency: < 1.5s
- Notification queue lag p95: < 5s
- Socket reconnect recovery p95: < 8s

## Phase 1 - Runtime Safety (Week 1)
1. Centralize periodic jobs behavior
- Keep advisory locks in place for all in-process scheduled jobs.
- Add lock acquisition metrics and warnings when lock contention is high.

2. Idempotency and race protection
- Ensure all stream auto-start transitions are conditional and state-safe.
- Add protection for duplicate host viewer rows during auto-start.

3. Alert baselines
- Log structured counters for:
  - job lock acquired/failed
  - stream auto-start attempted/succeeded/skipped
  - decrypt cache hit/miss/error

Acceptance:
- No duplicate scheduled stream activation in multi-instance tests.
- No repeated world stale cleanup side-effects.

## Phase 2 - Chat Throughput (Week 2)
1. Message read path optimization
- Keep Redis decrypt cache (24h TTL) for hot windows.
- Add optional invalidation hooks if message edit/delete is introduced.

2. Query/index review
- Validate composite indexes for:
  - messages(conversation_id, created_at desc)
  - conversations(last_message_at)
  - friendships(status, created_at)

3. Backpressure behavior
- Add graceful degradation when Redis is degraded (cache bypass without breaking chat).

Acceptance:
- >= 25% CPU reduction on synthetic chat read load.
- p95 fetch latency under target in local load test.

## Phase 3 - Notifications and Delivery Reliability (Week 3)
1. Dedup correctness
- Use richer dedup fingerprint (user + kind + preference + actor + preview + target URL).
- Prevent direct-send fallback for duplicates (already implemented).

2. Queue robustness
- Keep worker concurrency at 4; tune based on queue lag and CPU.
- Add dead-letter policy after max attempts with observability counters.

3. Delivery telemetry
- Counters for enqueue accepted/duplicate/retry/drop.

Acceptance:
- Duplicate push rate near zero for repeated events.
- Queue lag stable under burst traffic.

## Phase 4 - Verification and Release Discipline (Week 4)
1. Tests
- Add integration tests for:
  - /conversations read path with decrypt cache behavior
  - scheduled stream auto-start idempotency
  - world stale-session timeout notifications
  - notification dedup semantics

2. Local load test profile
- Use local runner for controlled scenarios:
  - 5k websocket sessions simulation (staged batches)
  - high-frequency chat room fanout
  - notification burst replay

3. Canary rollout
- 10% -> 50% -> 100% progressive rollout with rollback thresholds.

Acceptance:
- No regression in existing tests.
- SLOs hold in canary and full rollout.

## Local Resource Usage Plan
- CPU: run worker and app separately to isolate hot loops.
- Memory: monitor Node heap and Redis memory usage during synthetic bursts.
- Network: test TURN/TCP/TLS fallback under constrained network profiles.

## Runbook Commands (Local)
- Start app stack (scoped to this project only):
  - docker compose up -d
- Start notification worker:
  - node server/notification-worker.ts
- Run tests:
  - npm test
- Run load scripts (if available in repo):
  - node script/load-test.ts

## Risks and Mitigations
- Risk: advisory lock stuck due to abrupt termination.
  - Mitigation: Postgres session lock auto-releases on connection close; keep best-effort unlock in finally.

- Risk: cache stale plaintext if future message edits are introduced.
  - Mitigation: add explicit invalidation key strategy on edit/delete endpoints.

- Risk: dedup over-filtering important notifications.
  - Mitigation: include URL and preview in dedup key; tune TTL if needed.

## Definition of Done
- SLO dashboards populated and passing for 7 days.
- No duplicate scheduled stream starts.
- No duplicate stale-session notifications from multiple instances.
- No notification duplicate burst regressions.
- Chat read path p95 under 250ms at target load profile.
