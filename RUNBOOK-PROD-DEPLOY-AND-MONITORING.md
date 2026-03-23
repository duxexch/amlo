# Ablox Production Deploy + 24h Monitoring Runbook

This runbook executes two operations:

1. Deploy latest code safely on production.
2. Monitor stability for the first 24 hours after deploy.

Scope safety:

- All Docker operations are scoped to project name `ablox` only.
- Do not run global Docker cleanup commands on shared VPS.

## 1) Production Deploy (Scoped)

Run these commands on the VPS inside the Ablox repo directory:

```bash
cd ~/ablox/ablox

git fetch origin
# Keep branch aligned with main
git checkout main
git pull --ff-only origin main

# Rebuild only Ablox app and worker, keep data services untouched
# (postgres/redis/livekit/coturn stay as-is unless explicitly required)
docker compose -p ablox --env-file .env -f docker-compose.yml up -d --build app notification_worker

# Verify service state (scoped)
docker compose -p ablox -f docker-compose.yml ps

# Health check
curl -fsS http://localhost:3000/api/health
```

Expected health response:

- `status` should be `healthy` or (temporarily) `degraded` during warm-up.

If health fails:

```bash
docker compose -p ablox -f docker-compose.yml logs --tail=200 app
docker compose -p ablox -f docker-compose.yml logs --tail=200 notification_worker
```

## 2) Post-Deploy Monitoring (First 24 Hours)

## 2.1 Check cadence

- First 30 minutes: every 5 minutes
- Next 3 hours: every 15 minutes
- Remaining 20.5 hours: every 60 minutes

## 2.2 Core checks

Run:

```bash
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/api/metrics
```

Track these metrics:

- `ablox_social_stream_auto_start_failed`
- `ablox_social_stream_auto_start_skipped`
- `ablox_social_scheduled_lock_skipped`
- `ablox_notification_queue_depth`
- `ablox_notification_dead_letter_depth`
- `ablox_notification_queue_dispatch_failures`
- `ablox_notification_queue_dropped`
- `ablox_notification_queue_dead_lettered`
- `ablox_db_pool_waiting`

## 2.3 Alert thresholds

Treat as incident if any of these occurs:

- `ablox_notification_queue_depth > 200` for 10+ minutes.
- `ablox_notification_dead_letter_depth > 0` and increasing.
- `ablox_notification_queue_dropped > 0`.
- `ablox_social_stream_auto_start_failed` increases repeatedly.
- `ablox_db_pool_waiting > 20` for 5+ minutes.
- `/api/health` is `degraded` for > 5 minutes continuously.

## 2.4 Immediate actions

If queue depth is high:

- Inspect worker logs:

```bash
docker compose -p ablox -f docker-compose.yml logs --tail=300 notification_worker
```

If stream auto-start failures increase:

- Inspect app logs for scheduled job/lock contention:

```bash
docker compose -p ablox -f docker-compose.yml logs --tail=300 app | grep -Ei "auto-start|lock contention|scheduled"
```

If DB waiters are high:

- Inspect app logs and DB metrics, then scale down burst traffic temporarily via rate-limit config if required.

## 2.5 24-hour success criteria

Deploy is considered stable when all are true:

- No app crash loops.
- `ablox_notification_queue_dropped == 0`.
- Dead-letter queue does not grow continuously.
- No repeated stream auto-start failures.
- `/api/health` remains healthy most of the time.

## 3) Rollback (If Needed)

If severe regression is confirmed:

```bash
cd ~/ablox/ablox
git log --oneline -n 5
# checkout previous known-good commit
git checkout <previous-good-commit>
docker compose -p ablox --env-file .env -f docker-compose.yml up -d --build app notification_worker
```

Then open incident notes with:

- Time of rollback
- Trigger condition
- Metrics snapshot before rollback
- Suspected root cause

## 4) Post-Deploy Verification Workflow (Stage 38)

Run this immediately after deploy and before announcing completion:

```bash
cd ~/ablox/ablox

# Run release checklist in dry-run first (review command sequence)
npm run release:checklist:dry

# Execute full checklist with smoke checks enabled
RUN_SMOKE=1 npm run release:checklist

# For mobile release candidates, enforce QA Go/No-Go gate too
RUN_SMOKE=1 RUN_QA_GATE=1 npm run release:checklist
```

Optional (if deployment includes schema/data changes and maintenance window is approved):

```bash
RUN_DB_MIGRATE=1 RUN_SMOKE=1 npm run release:checklist

# Mobile RC + migration path
RUN_DB_MIGRATE=1 RUN_SMOKE=1 RUN_QA_GATE=1 npm run release:checklist
```

Verification pass criteria:

- `release:checklist` exits with `PASSED`.
- `/api/health` is healthy after checklist completion.
- Smoke checks confirm provider and call QoS admin endpoints are protected/operational.
- For mobile RC, strict lifecycle + compatibility + call setup/reconnect + reliability audits must pass; final QA report must be `PASS`; and go/no-go decision report must be `GO` before signoff readiness is accepted.

## 5) Rollback Decision Matrix

Rollback immediately when one of the following happens during post-deploy checks:

- `release:checklist` fails in type-check/build/readiness step.
- Health remains degraded for more than 5 minutes.
- Smoke checks fail for critical endpoints after one retry.
- Incident-rate metrics exceed defined threshold and continue to worsen.

Rollback sequence:

1. Revert to last known-good commit.
2. Rebuild and restart scoped services (`app`, `notification_worker`).
3. Re-run minimal validation (`/api/health` + smoke check).
4. Publish incident timeline and next remediation action.

## 6) Post-Rollback Validation

After rollback, execute:

```bash
cd ~/ablox/ablox
RUN_SMOKE=1 npm run smoke:prod
curl -fsS http://localhost:3000/api/health
```

Rollback is considered successful when:

- Health endpoint is stable.
- Smoke checks pass.
- Error/queue metrics start returning to baseline.
