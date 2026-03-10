# OBSERVABILITY-SCALE-SPEC — Dashboards and Alerts

## 1. Metrics Sources
- Prometheus scrape targets:
  - `app /api/metrics`
  - Redis exporter
  - Postgres exporter
  - Node exporter (host)
  - TURN/SFU exporters or sidecar metrics

## 2. Required Dashboards

### A) Executive Health Dashboard
- Active users
- Total call attempts/min
- Call setup success %
- Call drop rate %
- API p95
- 5xx rate
- Incident status

### B) App/API Dashboard
- Request rate by route
- Latency p50/p95/p99
- Error rate by route
- Event loop lag
- Node CPU/memory
- Socket active connections

### C) Realtime/Socket Dashboard
- Events/sec by type
- Socket reconnect rate
- Socket auth failures
- Message delivery p95

### D) Media Quality Dashboard
- Call setup success by region
- ICE success/failure counts
- TURN relay ratio
- Packet loss/jitter/RTT distribution
- Forced call endings by reason

### E) TURN Dashboard
- Allocations active
- Auth failures
- Relay bandwidth in/out
- Port utilization range
- TLS handshake failures

### F) Data Layer Dashboard
- Postgres: connections, pool wait, lock waits, slow queries
- Replica lag
- Redis: used memory, evictions, command latency, pub/sub rate

### G) Queue/Jobs Dashboard
- Queue depth
- Retry rate
- Dead-letter depth
- Processing latency p95

## 3. Alert Rules (Production)

### Critical (page on-call)
1. Call setup success < 98% for 5m
2. Call drop rate > 2% for 5m
3. API 5xx > 1% for 5m
4. Redis unavailable > 60s
5. Postgres unavailable > 60s

### High
1. API p95 > 300ms for 10m
2. TURN utilization > 85% for 10m
3. SFU CPU > 85% for 10m
4. Queue DLQ growth > threshold for 10m

### Medium
1. Socket reconnect rate spike > baseline x2 for 15m
2. Replica lag > threshold for 10m
3. Redis evictions > 0 continuously for 5m

## 4. Existing App Metrics to Track
From `/api/metrics` include:
- `ablox_social_call_balance_warnings_emitted`
- `ablox_social_call_balance_exhausted_ended`
- `ablox_social_decrypt_cache_hits`
- `ablox_social_decrypt_cache_misses`
- `ablox_notification_queue_depth`
- `ablox_notification_dead_letter_depth`

## 5. Suggested Grafana Panel Queries (PromQL)
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

```promql
rate(ablox_social_call_balance_exhausted_ended[10m])
```

```promql
ablox_notification_dead_letter_depth
```

## 6. Alert Routing
- Critical: Pager + phone escalation
- High: Pager + Slack
- Medium: Slack only

## 7. SRE Operating Cadence
- Daily: watch top-level health and error budget burn
- Weekly: trend review, alert noise cleanup
- Monthly: capacity review and threshold recalibration
