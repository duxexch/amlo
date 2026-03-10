# SCALE-EXECUTION-TASKS — 8-Week Execution Board

## Week 1 — Observability Baseline
- Owner: SRE Lead
- Tasks:
  - Deploy Prometheus/Grafana/Loki/Alertmanager stack.
  - Add scrape target for `/api/metrics`.
  - Import base dashboards (API, Socket, Media, Data).
  - Define SLO panels and error budget views.
- Exit Criteria:
  - 24h stable metrics collection.
  - On-call can identify call setup/drop anomalies in <5 minutes.

## Week 2 — Alert Quality and Runbook Drills
- Owner: SRE Lead + Incident Commander
- Tasks:
  - Configure critical/high/medium alert routes.
  - Simulate synthetic incidents (API 5xx spike, Redis latency spike).
  - Run tabletop drill using `RUNBOOK-SCALE.md`.
- Exit Criteria:
  - Alert fatigue reduced (false positive rate acceptable).
  - Incident MTTA under 5 minutes.

## Week 3 — Media Plane Separation
- Owner: Media Platform Engineer
- Tasks:
  - Move SFU to dedicated nodes.
  - Move TURN to dedicated nodes with TLS 443.
  - Validate TURN relay capacity and port range.
- Exit Criteria:
  - Media traffic no longer shares host with API.
  - Call setup success remains >99% during migration.

## Week 4 — Data Plane Hardening
- Owner: Database Engineer
- Tasks:
  - Enable PgBouncer in production path.
  - Configure read replicas and read routing for heavy endpoints.
  - Validate Redis persistence and failover policy.
- Exit Criteria:
  - DB pool waiting clients remains within threshold.
  - Replica lag alarmed and observable.

## Week 5 — Tier A Load Certification (10k)
- Owner: Performance Engineer
- Tasks:
  - Execute k6 API + websocket load profile.
  - Execute WebRTC setup/teardown stress profile.
  - Tune API limits, socket limits, and queue throughput.
- Exit Criteria:
  - Tier A SLOs pass for 60+ minutes under load.

## Week 6 — Tier B Preflight (50k)
- Owner: Platform Lead
- Tasks:
  - Scale app/media/turn groups to Tier B baseline.
  - Run spike tests (3x traffic surge in <5 minutes).
  - Validate canary and rollback automation.
- Exit Criteria:
  - No uncontrolled saturation in SFU/TURN/Redis.

## Week 7 — Reliability and Failure Testing
- Owner: SRE + Platform
- Tasks:
  - Chaos tests: drop one Redis replica, one SFU node, one app node.
  - Verify graceful degradation (quality caps, retries, queue behavior).
  - Confirm P1 response and rollback timing.
- Exit Criteria:
  - Recovery time objective met.
  - No cascading failure observed.

## Week 8 — Production Gate Review
- Owner: CTO/Tech Lead
- Tasks:
  - Review SLO reports, incidents, and cost burn.
  - Approve Tier B production gate.
  - Freeze architecture decisions and capacity budget.
- Exit Criteria:
  - Formal go/no-go signed.
  - Next 90-day scale roadmap published.

## RACI Summary
- SRE Lead: Monitoring, alerts, runbooks
- Media Engineer: SFU/TURN performance
- Backend Engineer: API/socket/queue tuning
- Data Engineer: Postgres/Redis reliability
- Performance Engineer: Load and soak tests
- Incident Commander: Major incident coordination
