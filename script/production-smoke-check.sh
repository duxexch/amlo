#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOMAIN_URL="${DOMAIN_URL:-https://mrco.live}"
RUN_ALERT_TEST="${RUN_ALERT_TEST:-1}"
ADMIN_COOKIE="${ADMIN_COOKIE:-}"

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

if [[ -n "$ADMIN_COOKIE" ]]; then
  info "Admin cookie supplied: authenticated admin endpoint checks enabled"
else
  info "Admin cookie not supplied: admin endpoint checks run in unauthenticated mode (expect 401/403)"
fi

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

# 4.1) Public app-download endpoint is reachable
APP_DL_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_app_download.json -w '%{http_code}' "$DOMAIN_URL/api/app-download" 2>/tmp/amlo_app_download.err || true)"
if [[ "$APP_DL_CODE" == "200" ]]; then
  pass "Public app-download endpoint reachable"
  info "App-download payload sample: $(head -c 220 /tmp/amlo_app_download.json)"
else
  fail "Public app-download endpoint reachable (HTTP $APP_DL_CODE)"
  info "App-download error: $(cat /tmp/amlo_app_download.err 2>/dev/null || true)"
fi

# 4.2) Admin provider + QoS endpoints smoke
if [[ -n "$ADMIN_COOKIE" ]]; then
  PROVIDERS_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_admin_providers.json -w '%{http_code}' -H "Cookie: $ADMIN_COOKIE" "$DOMAIN_URL/api/admin/providers/overview" || true)"
  if [[ "$PROVIDERS_CODE" == "200" ]]; then
    pass "Admin providers overview endpoint (authenticated)"
  else
    fail "Admin providers overview endpoint (authenticated) (HTTP $PROVIDERS_CODE)"
  fi

  QOS_SNAPSHOT_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_admin_qos_snapshot.json -w '%{http_code}' -H "Cookie: $ADMIN_COOKIE" "$DOMAIN_URL/api/admin/call-qos/snapshot?windowMinutes=60" || true)"
  if [[ "$QOS_SNAPSHOT_CODE" == "200" ]]; then
    pass "Admin call QoS snapshot endpoint (authenticated)"
  else
    fail "Admin call QoS snapshot endpoint (authenticated) (HTTP $QOS_SNAPSHOT_CODE)"
  fi

  QOS_AGG_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_admin_qos_agg.json -w '%{http_code}' -H "Cookie: $ADMIN_COOKIE" "$DOMAIN_URL/api/admin/call-qos/aggregation?windowMinutes=180&bucketMinutes=15" || true)"
  if [[ "$QOS_AGG_CODE" == "200" ]]; then
    pass "Admin call QoS aggregation endpoint (authenticated)"
  else
    fail "Admin call QoS aggregation endpoint (authenticated) (HTTP $QOS_AGG_CODE)"
  fi

  QOS_EVAL_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_admin_qos_eval.json -w '%{http_code}' -X POST -H "Cookie: $ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"windowMinutes":60,"thresholds":{"minCalls":10,"minConnectRatePct":65,"maxMissedRatePct":20,"maxBusyRatePct":15,"maxFailedRatePct":35}}' "$DOMAIN_URL/api/admin/call-qos/evaluate-alerts" || true)"
  if [[ "$QOS_EVAL_CODE" == "200" ]]; then
    pass "Admin call QoS alert evaluation endpoint (authenticated)"
  else
    fail "Admin call QoS alert evaluation endpoint (authenticated) (HTTP $QOS_EVAL_CODE)"
  fi

  RESTRICTED_ADMIN_CHAT_ENDPOINTS=(
    "/api/admin/chat-management/conversations"
    "/api/admin/chat-management/messages"
    "/api/admin/chat-management/calls"
    "/api/admin/chat-management/export/conversations"
    "/api/admin/chat-management/export/messages"
  )

  for endpoint in "${RESTRICTED_ADMIN_CHAT_ENDPOINTS[@]}"; do
    RESTRICTED_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_restricted_check.json -w '%{http_code}' -H "Cookie: $ADMIN_COOKIE" "$DOMAIN_URL$endpoint" || true)"
    if [[ "$RESTRICTED_CODE" == "403" ]]; then
      pass "Admin chat restriction enforced for $endpoint"
    else
      fail "Admin chat restriction enforced for $endpoint (HTTP $RESTRICTED_CODE)"
    fi
  done
else
  PROVIDERS_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_admin_providers_unauth.json -w '%{http_code}' "$DOMAIN_URL/api/admin/providers/overview" || true)"
  if [[ "$PROVIDERS_CODE" == "401" || "$PROVIDERS_CODE" == "403" ]]; then
    pass "Admin providers overview endpoint protected (unauthenticated)"
  else
    fail "Admin providers overview endpoint protected (HTTP $PROVIDERS_CODE)"
  fi

  QOS_SNAPSHOT_CODE="$(curl -sS --max-time 10 -o /tmp/amlo_admin_qos_snapshot_unauth.json -w '%{http_code}' "$DOMAIN_URL/api/admin/call-qos/snapshot?windowMinutes=60" || true)"
  if [[ "$QOS_SNAPSHOT_CODE" == "401" || "$QOS_SNAPSHOT_CODE" == "403" ]]; then
    pass "Admin call QoS snapshot endpoint protected (unauthenticated)"
  else
    fail "Admin call QoS snapshot endpoint protected (HTTP $QOS_SNAPSHOT_CODE)"
  fi
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
