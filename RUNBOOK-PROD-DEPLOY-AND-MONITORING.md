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
