# Ablox Single-Server Production Master Plan

Date: 2026-03-24
Scope: Dedicated single server with high resources, controllable consumption, and real live streaming reliability across phones, networks, and browsers.

## 1) Objectives

- Deliver real live streaming (not fake) with stable host + viewers.
- Keep strict control over CPU, RAM, network, and concurrent users.
- Run full project on one dedicated server with upgrade path.
- Prepare mobile distribution pipeline for AAB/APK while preserving live streaming quality.

## 2) Operating Principles

- Capacity-first: every public feature has explicit limits.
- Quality by profile: small/medium/high quality presets switch by load and network quality.
- Blast-radius control: reject overload early, do not let server collapse.
- Measurable SLOs: success is based on metrics, not subjective feeling.

## 3) Capacity Control Levers (Now in Project)

Environment controls available:

- CLUSTER_WORKERS
- DB_POOL_MAX
- DB_POOL_MIN
- SOCKET_MAX_CONNECTIONS_PER_IP
- SOCKET_CONNECTION_WINDOW_MS
- SOCIAL_WRITE_LIMIT_MAX
- SOCIAL_WRITE_LIMIT_WINDOW_MS
- STREAM_MAX_PARTICIPANTS_PER_ROOM
- STREAM_ROOM_EMPTY_TIMEOUT_SEC
- STREAM_FOLLOWER_NOTIFY_LIMIT
- STREAM_AUTOSTART_BATCH_LIMIT

Streaming transport controls:

- LIVEKIT_TURN_SERVERS
- TURN_EXTERNAL_IP
- TURN_TLS_LISTEN_PORT
- TURN_SECRET

## 4) Recommended Runtime Profiles

### Profile A: Safe Launch (5 to 30 users)

- CLUSTER_WORKERS=1
- STREAM_MAX_PARTICIPANTS_PER_ROOM=20
- STREAM_ROOM_EMPTY_TIMEOUT_SEC=180
- DB_POOL_MAX=10
- SOCKET_MAX_CONNECTIONS_PER_IP=80
- LOG_LEVEL=warn

### Profile B: Controlled Growth (30 to 150 users)

- CLUSTER_WORKERS=2
- STREAM_MAX_PARTICIPANTS_PER_ROOM=80
- STREAM_ROOM_EMPTY_TIMEOUT_SEC=240
- DB_POOL_MAX=20
- SOCKET_MAX_CONNECTIONS_PER_IP=150
- LOG_LEVEL=info

### Profile C: Dedicated Powerful Server (150+ users)

- CLUSTER_WORKERS=3 or 4 (depends on vCPU)
- STREAM_MAX_PARTICIPANTS_PER_ROOM=120 to 200
- STREAM_ROOM_EMPTY_TIMEOUT_SEC=300
- DB_POOL_MAX=30 (with DB monitoring)
- SOCKET_MAX_CONNECTIONS_PER_IP=200+
- LOG_LEVEL=info

## 5) Browser and Network Compatibility Coverage

Must support:

- Android Chrome (multiple versions)
- Android WebView inside TWA
- iOS Safari (latest and one previous major)
- Desktop Chrome, Edge, Firefox, Safari

Network classes:

- Home Wi-Fi
- 4G and 5G (multiple carriers)
- Corporate / restricted networks

TURN and firewall baseline:

- TCP: 80, 443, 3478, 5349
- UDP: 3478, 5349, 49152-49999, 50000-50100

Recommended TURN URIs:

- turn:turn.domain:3478?transport=udp
- turn:turn.domain:3478?transport=tcp
- turns:turn.domain:5349?transport=tcp

Optional strict-network fallback:

- turns:turn.domain:443?transport=tcp (only with dedicated TURN endpoint/IP)

## 6) Production Readiness Gates

Gate 1: Core Health

- app/livekit/coturn/postgres/redis are healthy
- /api/health success
- token generation success for host and viewer

Gate 2: Connectivity

- tcpdump confirms TURN/relay traffic during real attempts
- coturn logs show relay allocations
- live stream does not close immediately

Gate 3: Stability

- 10-minute stream with host + 4 viewers without repeated disconnects
- CPU average below 75% and peaks below 90%
- memory stable with no OOM restart

Gate 4: Scale Step

- 30-minute stream with host + 9 viewers
- no major packet loss spikes causing continuous reconnect

## 7) AAB/APK Delivery Plan (Live Streaming Safe)

Build variants:

- beta stream profile (more diagnostics, conservative quality)
- production stream profile (balanced quality)

Pre-release matrix:

- Android 10/11/12/13/14
- low-end, mid-range, flagship devices
- at least two mobile carriers

Must-pass mobile tests:

- mic/camera permission flow
- background/foreground transitions
- rotation and reconnect behavior
- stream join latency and stability

## 8) Observability and Alerting

Track at minimum:

- stream start success rate
- token generation failures
- room auto-start failures
- active stream count
- per-room participant count
- relay traffic presence
- CPU, memory, load average

Alerts:

- no TURN traffic during active stream attempts
- repeated stream early close events
- high CPU over threshold for 5+ minutes
- container restart loop

## 9) Failure Policies

- Overload mode: temporarily cap new stream joins by reducing room participant limits.
- Degrade mode: force lower quality in clients on poor conditions.
- Recovery mode: recreate only real-time containers, not full stack restart.

## 10) Execution Order (High Priority)

1. Lock safe launch profile in .env
2. Validate firewall and TURN traffic
3. Run 5-user live test (10 minutes)
4. Run 10-user test (30 minutes)
5. Tune limits with evidence
6. Freeze production baseline
7. Start AAB/APK beta rollout

## 11) Acceptance Criteria

Project is considered production-ready on one server when:

- 5 concurrent live participants are stable and repeatable.
- 10-participant test passes without critical failures.
- Metrics and alerts are active.
- Capacity controls are documented and adjustable without code changes.

## 12) Next Upgrade Path

When usage outgrows single server:

- Move LiveKit to dedicated node first.
- Keep app + db + redis separate by role.
- Maintain the same capacity-control variables to reduce migration risk.

## 13) Dedicated High-Power Baseline (Server-Only Project)

Use this as the initial dedicated-server baseline once low-risk gates pass:

- CLUSTER_WORKERS=4
- DB_POOL_MAX=35
- DB_POOL_MIN=8
- SOCKET_MAX_CONNECTIONS_PER_IP=350
- SOCIAL_WRITE_LIMIT_MAX=90
- STREAM_MAX_PARTICIPANTS_PER_ROOM=220
- STREAM_FOLLOWER_NOTIFY_LIMIT=1000
- STREAM_AUTOSTART_BATCH_LIMIT=40

Control policy:

- Never raise more than 1-2 knobs in the same release window.
- After each increase, run fixed-duration stream tests and compare CPU/memory/packet-loss deltas.
- If P95 stream join latency rises more than 25%, rollback to the previous profile.

## 14) Real Compatibility Matrix (Phones + Browsers + Networks)

Device coverage target:

- Android 8/9/10/11/12/13/14 (low, mid, flagship)
- iOS 16/17/18

Browser coverage target:

- Android Chrome stable + one previous major
- Android WebView (TWA)
- iOS Safari stable + one previous major
- Desktop Chrome, Edge, Firefox, Safari

Network coverage target:

- Home Wi-Fi (2.4 GHz and 5 GHz)
- Mobile 4G and 5G from at least 2 carriers
- Corporate/VPN restricted network

Pass criteria per matrix cell:

- Stream publish success in less than 8 seconds
- Stream join success in less than 6 seconds
- No forced reconnect loop within 10-minute session
- Audio continuity and acceptable video quality

## 15) AAB/APK Production Readiness Path

Release workflow:

1. Build signed APK/AAB artifacts.
2. Publish metadata (version/build/hash/size).
3. Run lifecycle audits (install/upgrade/uninstall/reinstall).
4. Run compatibility/call/reliability audits in strict mode.
5. Run final GO/NO-GO gate.

Mandatory commands before publishing:

- `npm run mobile:sign:artifacts`
- `npm run qa:lifecycle:audit:strict`
- `npm run qa:compat:audit:strict`
- `npm run qa:call:audit:strict`
- `npm run qa:reliability:audit:strict`
- `npm run qa:go-no-go`

## 16) Operations Timeline (Production Cutover)

Wave 1 (Day 0):

- Apply Profile B.
- Verify health + TURN relay traffic + 5-user live test.

Wave 2 (Day 1-2):

- Apply Profile C.
- Run 10-user and 20-user tests across mixed networks.

Wave 3 (Day 3-5):

- Apply Profile D for universal compatibility validation.
- Execute full phone/network/browser matrix.

Wave 4 (After pass):

- Apply Profile E for dedicated high-power server.
- Keep hard rollback path to Profile C if quality regresses.

## 17) Rollback Triggers and Safety Limits

Immediate rollback trigger examples:

- Stream early-close rate > 3% for 15 minutes.
- TURN allocation failures spike continuously.
- CPU > 90% for 10 minutes with rising latency.
- Container restart loop appears.

Rollback action order:

1. Reduce `STREAM_MAX_PARTICIPANTS_PER_ROOM` by 20-30%.
2. Reduce `STREAM_AUTOSTART_BATCH_LIMIT`.
3. Reduce `CLUSTER_WORKERS` only if process thrashing appears.
4. Re-run 10-minute validation stream before reopening full traffic.
