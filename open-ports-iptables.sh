#!/bin/bash
#
# فتح البورتات باستخدام iptables (بديل UFW)
# لأنظمة بدون UFW مثل OpenVZ و Hyper-V
#

set -e

echo "🔥 Opening ports with iptables..."

# Function to add rule
add_port() {
    proto=$1
    port=$2
    echo "  ✓ $proto:$port"
    iptables -A INPUT -p $proto --dport $port -j ACCEPT 2>/dev/null || true
}

# Open TCP ports
add_port tcp 7880
add_port tcp 7881
add_port tcp 3478

# Open UDP ports
add_port udp 7882
add_port udp 3478
add_port udp 49152:49999  # TURN relay range (if your iptables supports ranges)
add_port udp 50000:50100  # ICE range

echo ""
echo "💾 Saving iptables rules..."

# Save rules (Debian/Ubuntu)
iptables-save > /etc/iptables/rules.v4 2>/dev/null || echo "  (Note: iptables-save not available, rules will reset on reboot)"

echo "✅ Ports opened!"
echo ""
echo "Current rules:"
iptables -nL | grep -E "7880|7881|7882|3478"
