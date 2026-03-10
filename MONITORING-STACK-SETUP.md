# MONITORING-STACK-SETUP

## Goal
Run Prometheus + Grafana + Alertmanager + exporters for `amlo` only, without affecting other Docker projects.

## Files Added
- `docker-compose.monitoring.yml`
- `monitoring/prometheus/prometheus.yml`
- `monitoring/prometheus-alert-rules.yml`
- `monitoring/alertmanager/alertmanager.yml`
- `monitoring/grafana/provisioning/datasources/datasource.yml`
- `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- `monitoring/grafana/amlo-scale-overview-dashboard.json`

## Startup
```powershell
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d prometheus grafana alertmanager node-exporter redis-exporter postgres-exporter
```

## URLs
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- Alertmanager: `http://localhost:9093`

## Grafana Login
- User: `${GRAFANA_ADMIN_USER:-admin}`
- Password: `${GRAFANA_ADMIN_PASSWORD:-change-me}`

## Required Env Vars
Set in `.env` before production use:
- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`

Alertmanager config currently uses safe local fallback URLs (`http://127.0.0.1:65535`) so the service always starts.
For real notifications, use the non-interactive setup script instead of editing YAML manually.

## Configure Slack Alerts (No Manual Edit)
```bash
chmod +x script/configure-alertmanager-slack.sh
SLACK_WEBHOOK_URL='https://hooks.slack.com/services/REAL/REAL/REAL' \
SLACK_CHANNEL='#alerts-critical' \
./script/configure-alertmanager-slack.sh
```

What this script does:
- Validates the webhook directly against Slack (`ok` required).
- Backs up `monitoring/alertmanager/alertmanager.yml`.
- Writes a clean Slack-only Alertmanager config.
- Restarts `alertmanager` only.
- Sends a test alert and prints recent error logs.

## Smoke Checks
```powershell
curl.exe -s http://localhost:9090/-/healthy
curl.exe -s http://localhost:9093/-/healthy
curl.exe -s http://localhost:3001/api/health
curl.exe -s http://localhost:3000/api/metrics | findstr /C:"ablox_social_call_balance_warnings_emitted" /C:"ablox_social_call_balance_exhausted_ended"
```

## One-Command Production Smoke Check
```bash
chmod +x script/production-smoke-check.sh
./script/production-smoke-check.sh
```

Optional flags:
- `DOMAIN_URL=https://your-domain.tld ./script/production-smoke-check.sh`
- `RUN_ALERT_TEST=0 ./script/production-smoke-check.sh` to skip sending test alerts.

Notes:
- Metrics counters are validated from inside `ablox_app` for reliability.
- External `/api/metrics` reachability is reported as informational only.

## Notes
- This stack is scoped to `ablox` service names on `ablox_network`.
- Do not run global prune/reset commands on shared VPS.
