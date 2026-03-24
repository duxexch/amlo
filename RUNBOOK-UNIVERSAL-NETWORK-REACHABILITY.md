# Ablox Universal Network Reachability Runbook

This runbook is for making Ablox reachable from most network types (home Wi-Fi, mobile, corporate-restricted networks).

## Scope

- Web app domain: `mrco.live`
- LiveKit signaling domain: `lk.mrco.live`
- TURN domain: `turn.mrco.live`

## 1) Required DNS shape

- `mrco.live` A record -> VPS public IPv4
- `lk.mrco.live` A record -> VPS public IPv4
- `turn.mrco.live` A record -> VPS public IPv4
- Remove AAAA records unless IPv6 is configured and tested.
- If using Cloudflare:
  - Keep `mrco.live` proxied if desired.
  - Set `lk.mrco.live` and `turn.mrco.live` to DNS Only for direct RTC/TURN paths.

## 2) Required open ports (provider firewall + host firewall)

- TCP 80, 443 (web/Traefik)
- UDP 3478, TCP 3478 (TURN)
- TCP 5349 (TURNS)
- UDP 49152-49999 (TURN relay)
- UDP 50000-50100 (LiveKit UDP media)

## 3) TURN strategy for broad compatibility

- Keep all three TURN paths announced to clients:
  - `turn:turn.mrco.live:3478?transport=udp`
  - `turn:turn.mrco.live:3478?transport=tcp`
  - `turns:turn.mrco.live:5349?transport=tcp`
- For very restrictive networks, add `turns:...:443` only if you can dedicate a separate endpoint/IP from Traefik 443.

## 4) Minimal .env target values

Use these values in `.env`:

```env
LIVEKIT_PUBLIC_URL=wss://lk.mrco.live
LIVEKIT_URL=ws://livekit:7880
TURN_EXTERNAL_IP=<YOUR_PUBLIC_VPS_IP>
TURN_TLS_LISTEN_PORT=5349
LIVEKIT_TURN_SERVERS=turn:turn.mrco.live:3478?transport=udp,turn:turn.mrco.live:3478?transport=tcp,turns:turn.mrco.live:5349?transport=tcp
```

## 5) Execute integrated readiness check

```bash
chmod +x script/network-universal-check.sh
./script/network-universal-check.sh
```

## 6) Real client validation matrix

Run the capture while a phone starts a real stream:

```bash
timeout 45 tcpdump -ni any '(udp port 3478 or tcp port 3478 or tcp port 5349 or udp portrange 49152-49999)'
```

Repeat from each network type:

1. Home Wi-Fi
2. Mobile carrier A (4G/5G)
3. Mobile carrier B (4G/5G)
4. Corporate/VPN network

## 7) How to classify outcome quickly

- Capture has packets -> external path is open; investigate TURN auth/ICE selection if still failing.
- Capture has zero packets during real attempt -> issue remains upstream (DNS target mismatch, provider ACL/firewall, or client network policy).

## 8) Optional hardening for "all networks"

If a subset of corporate networks still fails:

- Add dedicated TURN endpoint on TCP 443 (separate IP/entrypoint from web TLS).
- Keep existing 3478/5349 + relay range as fallback.
