#!/usr/bin/env bash
set -euo pipefail

# Non-interactive Alertmanager Slack setup for Linux servers.
# Usage:
#   SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...' \
#   SLACK_CHANNEL='#alerts-critical' \
#   ./script/configure-alertmanager-slack.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="$ROOT_DIR/monitoring/alertmanager/alertmanager.yml"
BACKUP_PATH="$CONFIG_PATH.bak.$(date +%F-%H%M%S)"

if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
  echo "ERROR: SLACK_WEBHOOK_URL is required."
  exit 1
fi

if [[ "${SLACK_WEBHOOK_URL}" != https://hooks.slack.com/services/* ]]; then
  echo "ERROR: SLACK_WEBHOOK_URL must start with https://hooks.slack.com/services/"
  exit 1
fi

SLACK_CHANNEL="${SLACK_CHANNEL:-#alerts-critical}"

echo "Validating Slack webhook..."
WEBHOOK_RESPONSE="$(curl -sS -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{"text":"amlo direct webhook validation"}')"

if [[ "$WEBHOOK_RESPONSE" != "ok" ]]; then
	echo "ERROR: Slack webhook validation failed. Response: $WEBHOOK_RESPONSE"
	exit 1
fi

echo "Writing Alertmanager config to $CONFIG_PATH"
cp "$CONFIG_PATH" "$BACKUP_PATH"

cat > "$CONFIG_PATH" <<EOF
global:
  resolve_timeout: 5m

route:
  receiver: pager-default
  group_by: ["alertname", "service", "severity"]
  group_wait: 15s
  group_interval: 2m
  repeat_interval: 4h
  routes:
    - matchers:
        - severity="critical"
      receiver: pager-critical

receivers:
  - name: pager-default
    slack_configs:
      - api_url: "${SLACK_WEBHOOK_URL}"
        channel: "${SLACK_CHANNEL}"
        send_resolved: true
        title: "[AMLO][{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}"
        text: "{{ range .Alerts }}*{{ .Labels.service }}* - {{ .Annotations.summary }}\\n{{ .Annotations.description }}{{ end }}"

  - name: pager-critical
    slack_configs:
      - api_url: "${SLACK_WEBHOOK_URL}"
        channel: "${SLACK_CHANNEL}"
        send_resolved: true
        title: "[AMLO][CRITICAL][{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}"
        text: "{{ range .Alerts }}*{{ .Labels.service }}* - {{ .Annotations.summary }}\\n{{ .Annotations.description }}{{ end }}"
EOF

echo "Restarting Alertmanager..."
docker compose -f "$ROOT_DIR/docker-compose.monitoring.yml" up -d alertmanager

echo "Sending test alert..."
curl -s -o /tmp/am_test_resp.txt -w "HTTP:%{http_code}\n" \
  -X POST http://localhost:9093/api/v2/alerts \
  -H 'Content-Type: application/json' \
  -d '[{"labels":{"alertname":"ManualTestAlert","severity":"critical","service":"amlo-test"},"annotations":{"summary":"Manual test alert","description":"Alertmanager Slack integration test"},"startsAt":"'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"}]'

cat /tmp/am_test_resp.txt

echo "Recent Alertmanager errors (if any):"
docker logs --since=2m ablox_alertmanager 2>&1 | grep -Ei "no_team|error|failed|notify|slack|webhook" || true

echo "Done. Backup saved at: $BACKUP_PATH"
