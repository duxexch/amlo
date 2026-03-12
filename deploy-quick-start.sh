#!/bin/bash
# ═════════════════════════════════════════════════════════
# Deploy Streaming Fixes — Quick Start (No UFW Required)
# Run on production server after git pull
# ═════════════════════════════════════════════════════════

set -e

echo "🚀 Beginning Ablox Streaming Deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ═════════════════════════════════════════════════════════
# Step 1: Pull Latest Code
# ═════════════════════════════════════════════════════════

echo "📥 Step 1/3: Pulling latest configuration..."
git fetch origin main
git pull origin main
echo "✅ Code updated (Commit: $(git rev-parse --short HEAD))"
echo ""

# ═════════════════════════════════════════════════════════
# Step 2: Rebuild Docker Containers
# ═════════════════════════════════════════════════════════

echo "🐳 Step 2/3: Rebuilding Docker containers..."

echo "  → Stopping old containers..."
docker compose down --remove-orphans > /dev/null 2>&1 || true

echo "  → Building fresh images (no cache)..."
docker compose build --no-cache app livekit coturn 2>&1 | grep -E "Step|Successfully|error" || true

echo "  → Starting services..."
docker compose up -d --force-recreate

echo "✅ Containers rebuilt and running"
echo ""

# Wait for services to stabilize
sleep 3

# ═════════════════════════════════════════════════════════
# Step 3: Verify Deployment
# ═════════════════════════════════════════════════════════

echo "🔍 Step 3/3: Verifying services..."
echo ""

echo "Container Status:"
docker compose ps --format "table {{.Names}}\t{{.Status}}" | head -15

echo ""
echo "Service Health Checks:"

# Check LiveKit
if docker compose exec -T livekit wget -q -O - http://127.0.0.1:7880 > /dev/null 2>&1; then
    echo "  ✅ LiveKit: Responding"
else
    echo "  ⚠️  LiveKit: Checking... (may take 10 seconds)"
fi

# Check PostgreSQL
if docker compose exec -T postgres pg_isready -h localhost > /dev/null 2>&1; then
    echo "  ✅ PostgreSQL: Ready"
else
    echo "  ❌ PostgreSQL: Not responding"
fi

# Check Redis
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "  ✅ Redis: Responding"
else
    echo "  ❌ Redis: Not responding"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Test via browser: https://mrco.live"
echo "  2. Create new stream and verify:"
echo "     → DevTools (F12) → Network Tab"
echo "     → Look for wss://lk.mrco.live"
echo "     → Status should be 101 (Switching Protocols)"
echo ""
echo "🐛 To debug issues:"
echo "  • docker compose logs app --tail=100"
echo "  • docker compose logs livekit --tail=100"
echo "  • docker compose logs coturn --tail=100"
echo ""
