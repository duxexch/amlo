#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Ablox — Traefik Diagnostic Script
# Detects classitest Traefik config and verifies ablox routing
# Usage: chmod +x diagnose.sh && ./diagnose.sh
# ═══════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Ablox — Traefik Diagnostic"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Check Traefik container ──
info "Looking for Traefik container..."
TRAEFIK_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i traefik | head -1)
if [ -z "$TRAEFIK_CONTAINER" ]; then
  err "No Traefik container found running!"
  exit 1
fi
log "Found Traefik: $TRAEFIK_CONTAINER"

# ── 2. Get Traefik command/config ──
info "Reading Traefik configuration..."
echo ""
echo "── Traefik Command ──"
docker inspect "$TRAEFIK_CONTAINER" --format '{{join .Config.Cmd "\n"}}' 2>/dev/null
echo ""

# ── 3. Get entrypoints ──
echo "── Entrypoints ──"
docker inspect "$TRAEFIK_CONTAINER" --format '{{join .Config.Cmd "\n"}}' 2>/dev/null | grep -i entrypoint || echo "  (none found in command)"
echo ""

# ── 4. Get certresolver ──
echo "── CertResolvers ──"
docker inspect "$TRAEFIK_CONTAINER" --format '{{join .Config.Cmd "\n"}}' 2>/dev/null | grep -i certresolver || echo "  (none found in command)"
echo ""

# ── 5. Check networks ──
echo "── Docker Networks ──"
docker network ls --format "{{.Name}}" | grep -E "class|traefik|proxy|ablox"
echo ""

# ── 6. Check if ablox_app is on Traefik network ──
info "Checking ablox_app network membership..."
TRAEFIK_NET=$(docker inspect "$TRAEFIK_CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)
echo "  Traefik networks: $TRAEFIK_NET"

if docker ps --format '{{.Names}}' | grep -q 'ablox_app'; then
  ABLOX_NET=$(docker inspect ablox_app --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)
  echo "  Ablox networks:   $ABLOX_NET"
  
  # Check if they share a network
  for net in $TRAEFIK_NET; do
    if echo "$ABLOX_NET" | grep -q "$net"; then
      log "Shared network: $net"
    fi
  done
else
  warn "ablox_app is not running"
fi
echo ""

# ── 7. Check Traefik API for routers (if dashboard enabled) ──
info "Checking Traefik routers..."
ROUTERS=$(docker exec "$TRAEFIK_CONTAINER" wget -qO- http://localhost:8080/api/http/routers 2>/dev/null || echo "API not available")
if echo "$ROUTERS" | grep -q "ablox"; then
  log "ablox router found in Traefik!"
  echo "$ROUTERS" | python3 -m json.tool 2>/dev/null | grep -A5 "ablox" || echo "$ROUTERS" | grep "ablox"
else
  warn "ablox router NOT found in Traefik"
  echo "  This means Traefik hasn't discovered ablox_app yet."
  echo "  Possible causes:"
  echo "    1. ablox_app is not on the same Docker network as Traefik"
  echo "    2. Traefik labels on ablox_app are wrong"
  echo "    3. ablox_app is not running or not healthy"
fi
echo ""

# ── 8. Test ablox health ──
info "Testing ablox_app health..."
if docker ps --format '{{.Names}}' | grep -q 'ablox_app'; then
  HEALTH=$(docker exec ablox_app wget -qO- http://localhost:3000/api/health 2>/dev/null || echo "unreachable")
  echo "  Health: $HEALTH"
else
  err "ablox_app not running"
fi
echo ""

# ── 9. Show labels on ablox_app ──
info "ablox_app Traefik labels:"
if docker ps --format '{{.Names}}' | grep -q 'ablox_app'; then
  docker inspect ablox_app --format '{{range $k, $v := .Config.Labels}}{{if eq (printf "%.7s" $k) "traefik"}}  {{$k}} = {{$v}}{{"\n"}}{{end}}{{end}}' 2>/dev/null
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Copy the output above and send it for debugging"
echo "═══════════════════════════════════════════════════════"
echo ""
