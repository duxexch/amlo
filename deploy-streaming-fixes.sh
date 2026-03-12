#!/bin/bash
#
# Deploy Streaming Fixes — Complete Setup Script
# Run this on your production VPS
#
# Usage: ssh root@YOUR_VPS "bash -s" < deploy-streaming-fixes.sh
#

set -e  # Exit on any error

echo "🚀 Starting Ablox Streaming Deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─"

# ═══════════════════════════════════════════════════════
# Step 1: Update Firewall Rules
# ═══════════════════════════════════════════════════════

echo "📡 Step 1/4: Opening firewall ports..."

# Enable UFW if disabled
sudo ufw --force enable > /dev/null 2>&1 || true

# Open all required ports
ports=(
  "7880/tcp"              # LiveKit WebSocket
  "7881/tcp"              # LiveKit RTC TCP
  "7882/udp"              # LiveKit Media UDP
  "3478/tcp"              # TURN STUN TCP
  "3478/udp"              # TURN STUN UDP
  "49152:49999/udp"       # TURN Relay Range
  "50000:50100/udp"       # LiveKit ICE Range
)

for port in "${ports[@]}"; do
  echo "  ✓ Opening $port"
  sudo ufw allow "$port" > /dev/null 2>&1 || true
done

sudo ufw reload > /dev/null 2>&1
echo "✅ Firewall rules applied"

# ═══════════════════════════════════════════════════════
# Step 2: Update Code Repository
# ═══════════════════════════════════════════════════════

echo "📝 Step 2/4: Pulling latest code..."

cd ~/ablox/ablox  # Adjust path if different
git fetch origin main
git checkout main
git pull origin main

echo "✅ Code updated"

# ═══════════════════════════════════════════════════════
# Step 3: Rebuild Docker Containers
# ═══════════════════════════════════════════════════════

echo "🐳 Step 3/4: Rebuilding Docker containers..."

# Stop old containers
docker compose down --remove-orphans > /dev/null 2>&1 || true

# Clear cache and rebuild
docker compose build --no-cache app livekit coturn

# Start fresh
docker compose up -d --force-recreate

echo "✅ Containers rebuilt and running"

# ═══════════════════════════════════════════════════════
# Step 4: Verify Deployment
# ═══════════════════════════════════════════════════════

echo "🔍 Step 4/4: Verifying services..."

# Wait for services to start
sleep 5

# Check container health
echo "Container Status:"
docker compose ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "Port Status:"
netstat -tlnup 2>/dev/null | grep -E "7880|7881|7882|3478" || echo "  (Netstat not found, checking with ss instead)"
ss -tlnup 2>/dev/null | grep -E "7880|7881|7882|3478" || echo "  (Could not verify ports with ss)"

echo ""
echo "Service Health Checks:"
echo "  🔹 LiveKit API:"
curl -s http://localhost:7880 > /dev/null && echo "    ✅ Responding" || echo "    ❌ Not responding"

echo "  🔹 PostgreSQL:"
docker compose exec -T postgres pg_isready -h localhost > /dev/null && echo "    ✅ Ready" || echo "    ❌ Not ready"

echo "  🔹 Redis:"
docker compose exec -T redis redis-cli ping > /dev/null && echo "    ✅ Responding" || echo "    ❌ Not responding"

# ═══════════════════════════════════════════════════════
# Final Summary
# ═══════════════════════════════════════════════════════

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─"
echo "✨ Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Test stream creation: https://mrco.live"
echo "  2. Check logs: docker compose logs app --tail=50"
echo "  3. Monitor resources: docker stats"
echo ""
echo "🔗 Useful Commands:"
echo "  • View logs: docker compose logs -f app"
echo "  • View LiveKit logs: docker compose logs livekit --tail=100"
echo "  • Check port availability: netstat -tlnup | grep -E '7880|7882|3478'"
echo "  • Curl health check: curl http://localhost:7880"
echo "  • Database check: docker compose exec postgres psql -U ablox -d ablox -c '\\dt'"
echo ""
