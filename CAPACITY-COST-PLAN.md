# CAPACITY-COST-PLAN — Tiered Capacity and Cost Plan

## 1. Assumptions
- Workload: live streams + text chat + voice/video calls
- Traffic is bursty (campaign/live events)
- Goal: predictable scale with safe headroom
- Currency: USD/month (rough ranges, vendor-agnostic)

## 2. Tier Definitions

| Tier | Concurrent Users | Concurrent Calls | Streams | Target Stage |
|------|------------------|------------------|---------|--------------|
| A | 10k | 1k-1.5k | 150-300 | Early scale |
| B | 50k | 5k-8k | 800-1.5k | Growth |
| C | 100k+ | 10k+ | 2k+ | Very high scale |

## 3. Recommended Topology per Tier

### Tier A
- App/API: 4-6 instances (4 vCPU, 8 GB)
- SFU/Media: 4-6 instances (8 vCPU, 16 GB)
- TURN: 2-3 instances (4 vCPU, 8 GB)
- Redis: managed primary + replica
- Postgres: managed primary + 1 read replica
- Estimated monthly range: **$3,500 - $8,000**

### Tier B
- App/API: 12-20 instances (4-8 vCPU)
- SFU/Media: 15-30 instances (8-16 vCPU)
- TURN: 6-10 instances
- Redis: managed cluster (sharded)
- Postgres: primary + 2-3 read replicas + PgBouncer
- Estimated monthly range: **$15,000 - $45,000**

### Tier C
- App/API: 30+ instances
- SFU/Media: 40-80+ instances
- TURN: 15-25 instances
- Redis: multi-shard cluster + failover
- Postgres: HA + replicas + partitioning strategy
- Estimated monthly range: **$50,000 - $180,000+**

## 4. Cost Drivers (Most Expensive)
1. Media egress bandwidth
2. SFU compute at peak
3. CDN transfer for stream segments
4. Multi-region redundancy

## 5. Cost Control Policies
- Use ABR aggressively (avoid default 720p for all)
- Cap video profile during peak incidents
- Auto-scale down aggressively off-peak
- Cache static/HLS assets at CDN edge
- Archive cold data to cheaper object storage

## 6. Capacity Safety Margins
- Normal peak target utilization:
  - App/API CPU <= 65%
  - SFU CPU <= 70%
  - TURN <= 70% allocations/ports
  - Redis memory <= 70%
  - Postgres connections <= 70%

## 7. Upgrade Gates (Move to next tier)
- 2+ weeks of stable SLO at current tier
- Load test proving next-tier profile
- Confirmed budget approval
- Runbook and on-call readiness validated

## 8. Procurement Checklist
- [ ] Reserved capacity for predictable baseline
- [ ] Burst capacity for campaign spikes
- [ ] Multi-AZ networking plan
- [ ] DDoS/WAF plan validated
- [ ] Monitoring and alerting fully operational

## 9. Recommendation for Current Project
- Start from Tier A architecture immediately (not single VPS)
- Keep media plane separate from app plane from day 1
- Treat Tier B as near-term target if growth is expected in <6 months
