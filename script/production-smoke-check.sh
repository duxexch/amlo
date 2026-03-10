#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOMAIN_URL="${DOMAIN_URL:-https://mrco.live}"
RUN_ALERT_TEST="${RUN_ALERT_TEST:-1}"

failures=0

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1"
  failures=$((failures + 1))
}

info() {
  echo "INFO: $1"
}

check_cmd() {
  local name="$1"
  shift
  if "$@"; then
    pass "$name"
  else
    fail "$name"
  fi
}

echo "=== AMLO Production Smoke Check ==="
echo "Root: $ROOT_DIR"
echo "Domain: $DOMAIN_URL"

# 1) Core containers running
core_containers=(
  ablox_app
  ablox_notification_worker
  ablox_postgres
  ablox_redis
  ablox_livekit
  ablox_coturn
)

for c in "${core_containers[@]}"; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then
    pass "Container running: $c"
  else
    fail "Container running: $c"
  fi
done

# 2) App internal health (most reliable on hosted env)
if docker exec ablox_app wget -qO- http://127.0.0.1:3000/api/health >/tmp/amlo_app_health.json 2>/tmp/amlo_app_health.err; then
  pass "App internal health endpoint"
  info "App health payload: $(cat /tmp/amlo_app_health.json)"
else
  fail "App internal health endpoint"
  info "App health error: $(cat /tmp/amlo_app_health.err 2>/dev/null || true)"
fi

# 3) App external health via domain
if curl -fsS --max-time 10 "$DOMAIN_URL/api/health" >/tmp/amlo_external_health.json 2>/tmp/amlo_external_health.err; then
  pass "App external health via domain"
  info "External payload: $(cat /tmp/amlo_external_health.json)"
else
  fail "App external health via domain"
  info "External health error: $(cat /tmp/amlo_external_health.err 2>/dev/null || true)"
fi

# 4) Metrics endpoint contains critical counters
# Validate from inside app container for reliability (avoids proxy/CDN edge effects).
if docker exec ablox_app wget -qO- http://127.0.0.1:3000/api/metrics >/tmp/amlo_metrics_internal.txt 2>/tmp/amlo_metrics_internal.err; then
  if grep -Eq 'ablox_social_call_balance_warnings_emitted|ablox_social_call_balance_exhausted_ended' /tmp/amlo_metrics_internal.txt; then
    pass "Metrics endpoint exposes call-balance counters (internal)"
  else
    fail "Metrics endpoint exposes call-balance counters (internal)"
    info "Metrics sample (internal): $(head -n 5 /tmp/amlo_metrics_internal.txt | tr '\n' ' ')"
  fi
else
  fail "Metrics endpoint reachable (internal)"
  info "Metrics internal error: $(cat /tmp/amlo_metrics_internal.err 2>/dev/null || true)"
fi

# Optional external metrics reachability check for edge validation.
if curl -fsS --max-time 10 "$DOMAIN_URL/api/metrics" >/tmp/amlo_metrics_external.txt 2>/tmp/amlo_metrics_external.err; then
  pass "Metrics endpoint reachable via domain"
else
  info "Metrics endpoint via domain not reachable: $(cat /tmp/amlo_metrics_external.err 2>/dev/null || true)"
fi

# 5) Database health
check_cmd "Postgres accepts connections" docker exec ablox_postgres pg_isready -U "${POSTGRES_USER:-ablox_admin}" -d "${POSTGRES_DB:-ablox}" >/dev/null

# 6) Redis direct ping (best effort password discovery)
REDIS_PASSWORD="$(docker inspect ablox_redis --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '/^REDIS_PASSWORD=/{print $2; exit}')"
if [[ -n "$REDIS_PASSWORD" ]]; then
  if docker exec ablox_redis redis-cli -a "$REDIS_PASSWORD" ping 2>/tmp/amlo_redis_ping.err | grep -q '^PONG$'; then
    pass "Redis authenticated ping"
  else
    fail "Redis authenticated ping"
    info "Redis ping error: $(cat /tmp/amlo_redis_ping.err 2>/dev/null || true)"
  fi
else
  fail "Redis password discovery from container env"
fi

# 7) Monitoring endpoints
check_cmd "Prometheus healthy" curl -fsS --max-time 5 http://localhost:9090/-/healthy >/dev/null
check_cmd "Alertmanager healthy" curl -fsS --max-time 5 http://localhost:9093/-/healthy >/dev/null
check_cmd "Grafana healthy" curl -fsS --max-time 5 http://localhost:3001/api/health >/dev/null

# 8) Alertmanager config sanity
if grep -Eq 'webhook_configs' monitoring/alertmanager/alertmanager.yml; then
  fail "Alertmanager config should not contain webhook_configs"
else
  pass "Alertmanager config has Slack-only receivers"
fi

# 9) Optional alert dispatch test
if [[ "$RUN_ALERT_TEST" == "1" ]]; then
  HTTP_CODE="$(curl -s -o /tmp/amlo_alert_post.txt -w '%{http_code}' \
    -X POST http://localhost:9093/api/v2/alerts \
    -H 'Content-Type: application/json' \
    -d '[{"labels":{"alertname":"SmokeCheckAlert","severity":"critical","service":"amlo-smoke"},"annotations":{"summary":"Smoke check alert","description":"Automated production smoke check"},"startsAt":"'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"}]')"

  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "202" ]]; then
    pass "Alertmanager accepted smoke-check alert (HTTP $HTTP_CODE)"
  else
    fail "Alertmanager accepted smoke-check alert (HTTP $HTTP_CODE)"
  fi

  if docker logs --since=90s ablox_alertmanager 2>&1 | grep -Eiq 'no_team|error|failed|notify retry canceled'; then
    fail "Alertmanager recent logs have delivery errors"
  else
    pass "Alertmanager recent logs are clean"
  fi
else
  info "Skipping alert dispatch test (RUN_ALERT_TEST=$RUN_ALERT_TEST)"
fi

# Summary
if [[ "$failures" -eq 0 ]]; then
  echo "=== RESULT: PASS (all checks green) ==="
  exit 0
fi

echo "=== RESULT: FAIL ($failures checks failed) ==="
exit 1
