#!/usr/bin/env bash
set -euo pipefail

DOMAIN_MAIN="${DOMAIN_MAIN:-mrco.live}"
DOMAIN_LIVEKIT="${DOMAIN_LIVEKIT:-lk.mrco.live}"
DOMAIN_TURN="${DOMAIN_TURN:-turn.mrco.live}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[WARN] Missing command: $1"
    return 1
  fi
}

line() {
  printf '\n%s\n' "============================================================"
}

resolve_ip() {
  local host="$1"
  if command -v dig >/dev/null 2>&1; then
    dig +short A "$host" | head -n1
    return
  fi
  getent ahostsv4 "$host" | awk '{print $1}' | head -n1
}

echo "Ablox universal network readiness check"
echo "Domains: $DOMAIN_MAIN | $DOMAIN_LIVEKIT | $DOMAIN_TURN"

line
echo "[1/6] Public IP + DNS alignment"
PUBLIC_IP=""
if command -v curl >/dev/null 2>&1; then
  PUBLIC_IP="$(curl -s --max-time 5 ifconfig.me || true)"
fi
if [ -n "$PUBLIC_IP" ]; then
  echo "Public IP (this host): $PUBLIC_IP"
else
  echo "[WARN] Could not read public IP via ifconfig.me"
fi

IP_MAIN="$(resolve_ip "$DOMAIN_MAIN" || true)"
IP_LIVEKIT="$(resolve_ip "$DOMAIN_LIVEKIT" || true)"
IP_TURN="$(resolve_ip "$DOMAIN_TURN" || true)"

echo "A $DOMAIN_MAIN   => ${IP_MAIN:-<none>}"
echo "A $DOMAIN_LIVEKIT => ${IP_LIVEKIT:-<none>}"
echo "A $DOMAIN_TURN   => ${IP_TURN:-<none>}"

if [ -n "$PUBLIC_IP" ]; then
  [ "${IP_MAIN:-}" = "$PUBLIC_IP" ] && echo "[OK] $DOMAIN_MAIN points to this host" || echo "[WARN] $DOMAIN_MAIN mismatch"
  [ "${IP_LIVEKIT:-}" = "$PUBLIC_IP" ] && echo "[OK] $DOMAIN_LIVEKIT points to this host" || echo "[WARN] $DOMAIN_LIVEKIT mismatch"
  [ "${IP_TURN:-}" = "$PUBLIC_IP" ] && echo "[OK] $DOMAIN_TURN points to this host" || echo "[WARN] $DOMAIN_TURN mismatch"
fi

line
echo "[2/6] Local listeners for web + turn"
ss -lntup | egrep ':(80|443|3000|3478|5349|7880|7881)\b|turnserver|livekit' || true

line
echo "[3/6] Docker compose effective checks"
if command -v docker >/dev/null 2>&1; then
  docker compose config >/tmp/ablox.compose.effective.yml
  echo "Saved: /tmp/ablox.compose.effective.yml"
  grep -n "traefik.http.routers.ablox.rule\|traefik.http.routers.livekit.rule\|LIVEKIT_TURN_SERVERS\|TURN_TLS_LISTEN_PORT" /tmp/ablox.compose.effective.yml || true
  echo ""
  docker compose ps || true
else
  echo "[WARN] docker command is missing"
fi

line
echo "[4/6] Firewall snapshot"
if command -v ufw >/dev/null 2>&1; then
  ufw status verbose || true
else
  echo "ufw not installed (skip)"
fi

if command -v iptables >/dev/null 2>&1; then
  iptables -S | egrep -- '--dport (80|443|3478|5349)|49152:49999|50000:50100' || true
else
  echo "iptables not found (skip)"
fi

line
echo "[5/6] Quick local endpoint checks"
if command -v curl >/dev/null 2>&1; then
  curl -sS -m 5 -I http://127.0.0.1:3000 | head -n1 || true
  curl -sS -m 5 -I http://127.0.0.1:7880 | head -n1 || true
fi

line
echo "[6/6] Next live test commands"
echo "Run this while creating a real stream from phone (4G then Wi-Fi):"
echo "  timeout 45 tcpdump -ni any '(udp port 3478 or tcp port 3478 or tcp port 5349 or udp portrange 49152-49999)'"
echo "Then share output + this command output:"
echo "  ss -lunpt | egrep ':(3478|5349)\\b|turnserver'"

line
echo "Done."
