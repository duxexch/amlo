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

# ── Check 'proxy' network (Traefik) exists ──
if ! docker network inspect proxy >/dev/null 2>&1; then
  info "Creating 'proxy' network for Traefik..."
  docker network create proxy
  log "'proxy' network created"
else
  log "'proxy' network exists (Traefik)"
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
  sed -i "s|DATABASE_URL=postgresql://ablox_admin:CHANGE_ME@localhost:5432/ablox|DATABASE_URL=postgresql://ablox_admin:${POSTGRES_PASSWORD}@pgbouncer:6432/ablox|g" .env
  sed -i "s|REDIS_URL=redis://:CHANGE_ME@localhost:6379|REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379|g" .env

  log ".env created with auto-generated secrets"
  warn "IMPORTANT: Edit .env and set CORS_ORIGIN to your domain!"
  warn "Admin password: ${ADMIN_PASSWORD}"
  echo ""
  echo "  ──────────────────────────────────────────"
  echo "  Save these credentials somewhere safe:"
  echo "  DB Password:    ${POSTGRES_PASSWORD}"
  echo "  Redis Password: ${REDIS_PASSWORD}"
  echo "  Admin Password: ${ADMIN_PASSWORD}"
  echo "  ──────────────────────────────────────────"
  echo ""
  read -p "Press Enter after editing .env (especially CORS_ORIGIN)..."
fi

# ── 3. Verify NODE_ENV is production ──
source .env
if [ "${NODE_ENV:-development}" != "production" ]; then
  warn "NODE_ENV is not 'production' in .env — setting it..."
  sed -i "s|NODE_ENV=development|NODE_ENV=production|g" .env
fi

# ── 4. Build and start containers ──
info "Building Docker images..."
docker compose build --no-cache

info "Starting services..."
docker compose up -d

# ── 5. Wait for health ──
info "Waiting for services to be healthy..."
sleep 10

MAX_RETRIES=30
RETRY=0
until docker compose exec app wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -q "healthy\|degraded"; do
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
docker compose exec app npx drizzle-kit push 2>/dev/null || warn "Schema push skipped (may need DATABASE_URL fix)"

info "Seeding database..."
docker compose exec app npx tsx server/seed.ts 2>/dev/null || warn "Seed skipped"

# ── 7. Status ──
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
log "Ablox is running! 🚀"
echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check health
HEALTH=$(docker compose exec app wget -qO- http://localhost:3000/api/health 2>/dev/null || echo '{}')
echo "Health: ${HEALTH}"
echo ""

info "Next steps:"
echo "  1. Set DOMAIN in .env to your domain (or use srv1118737.hstgr.cloud)"
echo "  2. If using a custom domain, point DNS A record to your server IP"
echo "  3. Traefik handles SSL automatically via Let's Encrypt"
echo ""
echo "  Note: Traefik (port 80/443) is managed by Hostinger Docker Manager."
echo "  Ablox connects via the 'proxy' network — no nginx needed."
echo ""
echo "Useful commands:"
echo "  docker compose logs -f app     # View app logs"
echo "  docker compose restart app     # Restart app"
echo "  docker compose down            # Stop all"
echo "  docker compose up -d           # Start all"
echo ""
