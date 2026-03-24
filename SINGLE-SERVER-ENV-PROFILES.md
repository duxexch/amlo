# Single-Server Env Profiles

Use one profile at a time in production `.env`.

## Profile A - Safe Launch (5 to 30 concurrent users)

```env
CLUSTER_WORKERS=1
DB_POOL_MAX=10
SOCKET_MAX_CONNECTIONS_PER_IP=80
STREAM_MAX_PARTICIPANTS_PER_ROOM=20
STREAM_ROOM_EMPTY_TIMEOUT_SEC=180
STREAM_FOLLOWER_NOTIFY_LIMIT=200
STREAM_AUTOSTART_BATCH_LIMIT=10
```

## Profile B - Controlled Growth (30 to 150 concurrent users)

```env
CLUSTER_WORKERS=2
DB_POOL_MAX=20
SOCKET_MAX_CONNECTIONS_PER_IP=200
STREAM_MAX_PARTICIPANTS_PER_ROOM=120
STREAM_ROOM_EMPTY_TIMEOUT_SEC=300
STREAM_FOLLOWER_NOTIFY_LIMIT=500
STREAM_AUTOSTART_BATCH_LIMIT=20
```

## Profile C - High Capacity Single Server (150+ concurrent users)

```env
CLUSTER_WORKERS=3
DB_POOL_MAX=30
SOCKET_MAX_CONNECTIONS_PER_IP=300
STREAM_MAX_PARTICIPANTS_PER_ROOM=200
STREAM_ROOM_EMPTY_TIMEOUT_SEC=300
STREAM_FOLLOWER_NOTIFY_LIMIT=800
STREAM_AUTOSTART_BATCH_LIMIT=30
```

## Profile D - Universal Compatibility (Browsers + APK/AAB + Restricted Networks)

```env
CLUSTER_WORKERS=3
DB_POOL_MAX=30
SOCKET_MAX_CONNECTIONS_PER_IP=300
SOCKET_CONNECTION_WINDOW_MS=60000
SOCKET_WEBSOCKET_ONLY=true

STREAM_MAX_PARTICIPANTS_PER_ROOM=180
STREAM_ROOM_EMPTY_TIMEOUT_SEC=300
STREAM_FOLLOWER_NOTIFY_LIMIT=800
STREAM_AUTOSTART_BATCH_LIMIT=30

LOG_LEVEL=info
CORS_ORIGIN=https://mrco.live,https://www.mrco.live

LIVEKIT_PUBLIC_URL=wss://lk.mrco.live
LIVEKIT_URL=ws://livekit:7880
TURN_EXTERNAL_IP=REPLACE_WITH_PUBLIC_IPV4
TURN_TLS_LISTEN_PORT=5349
LIVEKIT_TURN_SERVERS=turn:turn.mrco.live:3478?transport=udp,turn:turn.mrco.live:3478?transport=tcp,turns:turn.mrco.live:5349?transport=tcp
# Add this only if TURN 443 is on dedicated endpoint/IP (not shared with web TLS)
# LIVEKIT_TURN_SERVERS=turn:turn.mrco.live:3478?transport=udp,turn:turn.mrco.live:3478?transport=tcp,turns:turn.mrco.live:5349?transport=tcp,turns:turn.mrco.live:443?transport=tcp
LIVEKIT_STUN_SERVERS=stun:stun.l.google.com:19302,stun:turn.mrco.live:3478

APP_DOWNLOAD_ENABLED=true
APK_ENABLED=true
AAB_ENABLED=true
APK_URL=https://mrco.live/download/ablox.apk
AAB_URL=https://mrco.live/download/ablox.aab
```

## Profile E - Dedicated High-Power Server (Full Production)

```env
CLUSTER_WORKERS=4
DB_POOL_MAX=35
DB_POOL_MIN=8
SOCKET_MAX_CONNECTIONS_PER_IP=350
SOCKET_CONNECTION_WINDOW_MS=60000
SOCKET_WEBSOCKET_ONLY=true

SOCIAL_WRITE_LIMIT_MAX=90
SOCIAL_WRITE_LIMIT_WINDOW_MS=60000
SOCIAL_WRITE_LIMIT_DISABLED=false

STREAM_MAX_PARTICIPANTS_PER_ROOM=220
STREAM_ROOM_EMPTY_TIMEOUT_SEC=300
STREAM_FOLLOWER_NOTIFY_LIMIT=1000
STREAM_AUTOSTART_BATCH_LIMIT=40

LOG_LEVEL=info
CORS_ORIGIN=https://mrco.live,https://www.mrco.live

LIVEKIT_PUBLIC_URL=wss://lk.mrco.live
LIVEKIT_URL=ws://livekit:7880
TURN_EXTERNAL_IP=REPLACE_WITH_PUBLIC_IPV4
TURN_TLS_LISTEN_PORT=5349
LIVEKIT_TURN_SERVERS=turn:turn.mrco.live:3478?transport=udp,turn:turn.mrco.live:3478?transport=tcp,turns:turn.mrco.live:5349?transport=tcp
LIVEKIT_STUN_SERVERS=stun:stun.l.google.com:19302,stun:turn.mrco.live:3478

APP_DOWNLOAD_ENABLED=true
APK_ENABLED=true
AAB_ENABLED=true
APK_URL=https://mrco.live/download/ablox.apk
AAB_URL=https://mrco.live/download/ablox.aab
```

## Apply Procedure

1. Copy one profile to production `.env`.
2. Restart app and livekit services.
3. Run 10-minute live test with 5 concurrent users from different networks.
4. If stable, move up one profile step only.
5. For universal compatibility target, switch to Profile D only after Gate 2 and Gate 3 pass.
6. Switch to Profile E only after passing 10-user and 20-user live tests with no critical degradation.
7. Validate env before go-live:

```bash
npm run prod:validate:universal -- --env .env
```

For real production secrets validation (no placeholders allowed):

```bash
npm run prod:validate:universal:strict -- --env .env
```

1. Run single-server production gate:

```bash
npm run prod:gate:single-server
```

For real production environment (strict secrets + real IP required):

```bash
npm run prod:gate:single-server:strict -- --env .env
```

1. For dedicated high-power deployment, you can start from:

`.env.production.high-power.template`
