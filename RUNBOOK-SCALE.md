# RUNBOOK-SCALE — High-Scale Operations Runbook

## 1. Scope
This runbook covers production operations for very high load (live streaming + text/voice chat + voice/video calls).

## 2. Ownership
- Incident Commander (IC): on-call lead
- Media Owner: SFU/TURN
- App Owner: API/Socket/Queue
- Data Owner: Postgres/Redis

## 3. SLO Targets
- API `p95` < 150ms
- Socket event delivery `p95` < 300ms
- Call setup success > 99%
- Call drop rate < 1%
- 5xx error rate < 0.5%
- TURN utilization < 70% at peak

## 4. Release Strategy (Mandatory)
1. `canary 5%` for 15-30 minutes
2. `25%` for 30-60 minutes
3. `100%` only if all SLOs healthy
4. Auto-rollback if any trigger fires (Section 5)

## 5. Rollback Triggers
Rollback immediately if any condition is true for 5+ minutes:
- API 5xx > 1%
- Call setup success < 98%
- Call drop rate > 2%
- Redis command latency > 20ms p95
- Postgres pool waiting clients > 20

## 6. P1 Incident Playbook
### 6.1 Call setup failure spike
1. Confirm `call setup success` drop on Grafana.
2. Check TURN allocations and SFU node saturation.
3. If TURN saturation > 80%: shift traffic to standby TURN nodes.
4. If SFU CPU > 85% sustained: scale SFU group + reduce max video profile.
5. If unresolved after 10 minutes: start controlled rollback.

### 6.2 High call drop rate
1. Verify packet loss/jitter by region/ISP.
2. Enforce temporary quality cap (video -> 360p default).
3. Force ABR conservative profile.
4. Increase ICE retry backoff guardrails.
5. Scale media nodes horizontally.

### 6.3 API latency spike
1. Check DB pool pressure and slow queries.
2. Enable protective rate limits on expensive routes.
3. Shift read-heavy traffic to read replicas.
4. Temporarily reduce non-critical background jobs.
5. If no recovery: rollback to previous stable app release.

## 7. Pre-Scale Checklist (Before traffic increase)
- [ ] All dashboards green for 24h baseline
- [ ] Last load test report attached
- [ ] Redis memory fragmentation < threshold
- [ ] Postgres replica lag acceptable
- [ ] TURN/TLS cert valid
- [ ] Queue depth normal and DLQ stable

## 8. Traffic Event Checklist (During campaign/live event)
- [ ] IC assigned
- [ ] War-room channel open
- [ ] Canary lock enabled (no surprise release)
- [ ] Feature flags ready (quality cap, stream caps)
- [ ] Rollback image verified

## 9. Post-Incident Review (within 24h)
- Impact window and user count affected
- Root cause and contributing factors
- Detection gap and alert quality
- Corrective actions with owners and deadlines

## 10. Guardrail Feature Flags
- `video_default_profile`: `360p | 480p | 720p`
- `force_audio_only_on_poor_network`: `true|false`
- `max_concurrent_streams_per_region`: number
- `aggressive_call_rate_limit`: `true|false`

## 11. Non-Negotiables
- Never deploy media + app + DB on one VM under high load.
- No production change without canary and rollback path.
- No scaling event without active monitoring and on-call coverage.
