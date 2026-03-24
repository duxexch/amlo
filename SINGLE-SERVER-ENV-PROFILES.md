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

## Apply Procedure

1. Copy one profile to production `.env`.
2. Restart app and livekit services.
3. Run 10-minute live test with 5 concurrent users from different networks.
4. If stable, move up one profile step only.
