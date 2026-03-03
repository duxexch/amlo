#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Ablox — VPS Deployment Script
# Usage: chmod +x deploy.sh && ./deploy.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Ablox — VPS Deployment"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Check prerequisites ──
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || err "Docker not installed. Install: curl -fsSL https://get.docker.com | sh"
command -v docker compose >/dev/null 2>&1 || err "Docker Compose not installed."
command -v git >/dev/null 2>&1 || err "Git not installed."

log "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
log "Docker Compose available"

# ── Stop conflicting Traefik (classitest) if running on 80/443 ──
if docker ps --format '{{.Names}}' | grep -q 'classitest-traefik'; then
  warn "classitest Traefik detected on ports 80/443 — stopping it..."
  docker stop classitest-traefik-1 2>/dev/null || true
  log "classitest Traefik stopped (ablox Traefik will handle routing)"
fi

# ── 2. Check .env file ──
if [ ! -f .env ]; then
  warn ".env file not found — creating from template..."
  cp .env.example .env

  # Generate random secrets
  SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')
  ENCRYPTION_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')
  REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')
  ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '\n/+=')

  sed -i "s|CHANGE_ME_STRONG_DB_PASSWORD|${POSTGRES_PASSWORD}|g" .env
  sed -i "s|CHANGE_ME_STRONG_REDIS_PASSWORD|${REDIS_PASSWORD}|g" .env
  sed -i "s|SESSION_SECRET=CHANGE_ME_64_CHAR_RANDOM|SESSION_SECRET=${SESSION_SECRET}|g" .env
  sed -i "s|JWT_SECRET=CHANGE_ME_64_CHAR_RANDOM|JWT_SECRET=${JWT_SECRET}|g" .env
  sed -i "s|ENCRYPTION_SECRET=CHANGE_ME_64_HEX_CHARS|ENCRYPTION_SECRET=${ENCRYPTION_SECRET}|g" .env
  sed -i "s|ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD|ADMIN_PASSWORD=${ADMIN_PASSWORD}|g" .env
  sed -i "s|NODE_ENV=development|NODE_ENV=production|g" .env
  sed -i "s|DATABASE_URL=postgresql://ablox_admin:CHANGE_ME@localhost:5432/ablox|DATABASE_URL=postgresql://ablox_admin:${POSTGRES_PASSWORD}@postgres:5432/ablox|g" .env
  sed -i "s|REDIS_URL=redis://:CHANGE_ME@localhost:6379|REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379|g" .env

  # Auto-set CORS_ORIGIN (no manual editing needed)
  sed -i "s|SMTP_PASS=CHANGE_ME_EMAIL_PASSWORD|SMTP_PASS=|g" .env

  log ".env created with auto-generated secrets"
  warn "Admin password: ${ADMIN_PASSWORD}"
  echo ""
  echo "  ──────────────────────────────────────────"
  echo "  Save these credentials somewhere safe:"
  echo "  DB Password:    ${POSTGRES_PASSWORD}"
  echo "  Redis Password: ${REDIS_PASSWORD}"
  echo "  Admin Password: ${ADMIN_PASSWORD}"
  echo "  ──────────────────────────────────────────"
  echo ""
fi

# ── 3. Verify NODE_ENV is production ──
source .env
if [ "${NODE_ENV:-development}" != "production" ]; then
  warn "NODE_ENV is not 'production' in .env — setting it..."
  sed -i "s|NODE_ENV=development|NODE_ENV=production|g" .env
fi

# ── 4. Build and start containers (skip dev override) ──
info "Building Docker images..."
docker compose -f docker-compose.yml build --no-cache

info "Starting services..."
docker compose -f docker-compose.yml up -d

# ── 5. Wait for health ──
info "Waiting for services to be healthy..."
sleep 10

MAX_RETRIES=30
RETRY=0
until docker compose -f docker-compose.yml exec app wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -q "healthy\|degraded"; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    err "Health check failed after ${MAX_RETRIES} attempts. Check logs: docker compose logs app"
  fi
  echo -n "."
  sleep 2
done
echo ""

# ── 6. Run database migrations ──
info "Pushing database schema..."
docker compose -f docker-compose.yml exec app npx drizzle-kit push 2>/dev/null || warn "Schema push skipped (may need DATABASE_URL fix)"

info "Seeding database..."
docker compose -f docker-compose.yml exec app npx tsx server/seed.ts 2>/dev/null || warn "Seed skipped"

# ── 7. Status ──
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
log "Ablox is running! 🚀"
echo ""
docker compose -f docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check health
HEALTH=$(docker compose -f docker-compose.yml exec app wget -qO- http://localhost:3000/api/health 2>/dev/null || echo '{}')
echo "Health: ${HEALTH}"
echo ""

info "Next steps:"
echo "  1. Set SMTP_PASS in .env for email/OTP support"
echo "  2. DNS A record for mrco.live should point to this server"
echo "  3. Traefik handles SSL automatically via Let's Encrypt"
echo ""
echo "  Ablox includes its own Traefik — no external proxy needed."
echo ""
echo "Useful commands:"
echo "  docker compose logs -f app     # View app logs"
echo "  docker compose restart app     # Restart app"
echo "  docker compose down            # Stop all"
echo "  docker compose up -d           # Start all"
echo ""
