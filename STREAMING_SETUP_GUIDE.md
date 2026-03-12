# 📡 دليل إعداد نظام البث المباشر — تحسينات شاملة

## المشاكل المحتملة والحلول

### 🔴 المشكلة 1: خطأ "Failed to connect to WebRTC"
**السبب:** عدم فتح بورتات UDP على الفايرول

**الحل على السيرفر:**
```bash
# فتح جميع البورتات المطلوبة
sudo ufw allow 7880/tcp      # LiveKit WebSocket
sudo ufw allow 7881/tcp      # LiveKit RTC TCP
sudo ufw allow 7882/udp      # LiveKit media UDP
sudo ufw allow 3478/tcp      # STUN TCP
sudo ufw allow 3478/udp      # STUN UDP
sudo ufw allow 49152:49999/udp    # TURN media
sudo ufw allow 50000:50100/udp    # LiveKit ICE
sudo ufw reload
```

### 🔴 المشكلة 2: خطأ "Permissions not granted" (Camera/Mic)
**السبب:** المتصفح يرفض الوصول للكاميرا/الميكروفون

**الحل:**
1. تأكد أن الموقع **HTTPS** (requirement for `getUserMedia`)
2. اسمح بـ Camera و Mic في حاجب مواقعك
3. تحقق من:
   - Settings → Privacy → Camera ✓
   - Settings → Privacy → Microphone ✓

### 🔴 المشكلة 3: خطأ "No route to host" أو "Connection timed out"
**السبب:** ISP أو شبكة المنزل تحظر UDP

**الحل البديل:**
استخدم TCP framing بدلاً من UDP (أبطأ لكن أكثر استقراراً)

آضف هذا إلى clientلـ:
```javascript
const room = new Room({
  websocketURL: wsUrl,
  // Force TCP even if UDP available
  stunServer: 'stun:stun.mrco.live:3478', // استخدم TCP
});
```

### 🟡 المشكلة 4: طول التأخير (High Latency)
**السبب:** الكاميرا/الميكروفون ينسخان بجودة عالية جداً

**الحل - خفّض الجودة:**
```javascript
const qualities = {
  low: { width: 320, height: 240, frameRate: 15 },
  medium: { width: 640, height: 480, frameRate: 24 },
  high: { width: 1280, height: 720, frameRate: 30 },
};
```

---

## إعدادات الإنتاج المطلوبة

### 1. متغيرات البيئة المهمة (.env):
```bash
# LiveKit
LIVEKIT_API_KEY=ablox_livekit_key
LIVEKIT_API_SECRET=ablox_livekit_secret_2026_secure
LIVEKIT_URL=ws://livekit:7880        # Internal (Docker)
LIVEKIT_PUBLIC_URL=wss://lk.mrco.live # External (Browser)

# TURN Server
TURN_EXTERNAL_IP=72.61.187.119       # Your server's public IP
TURN_REALM=mrco.live
TURN_AUTH_SECRET=ablox_livekit_secret_2026_secure
TURN_TLS_LISTEN_PORT=443
```

### 2. فحص الاتصالات:
```bash
# على السيرفر (SSH)

# تحقق من LiveKit health
curl -s http://72.61.187.119:7880 | head -20

# تحقق من TURN/STUN
echo "test" | nc -u 72.61.187.119 3478

# فحص منافذ مفتوحة
netstat -tlnup | grep -E "7880|7881|7882|3478"

# تحقق من logs
docker compose logs livekit --tail=50
docker compose logs coturn --tail=50
```

### 3. اختبر من المتصفح:
```javascript
// افتح console وشغل:
navigator.mediaDevices.enumerateDevices()
  .then(devices => console.log(devices))
  .catch(err => console.error('Error:', err));

// يجب أن تظهر الكاميرا والميكروفون
```

---

## الإعدادات الموصى بها على الإنتاج

### Docker Compose تحسينات:
```yaml
# في docker-compose.yml لـ app:
environment:
  # Compression للتوفير في النطاق الترددي
  ENABLE_LIVEKIT_COMPRESSION=true
  
  # Buffer sizes
  RTC_BUFFER_SIZE=256
  
  # Client-side timeouts
  ICE_TIMEOUT_MS=15000
  
  # Adaptive bitrate (يقلل البيانات تلقائياً)
  ADAPTIVE_BITRATE=true

# Coturn تحسينات:
  TURN_MAX_BPS=5242880        # 5 Mbps per connection
  TURN_USER_QUOTA=50          # ارتفع من 20
  TURN_TOTAL_QUOTA=5000       # ارتفع من 3000
```

---

## خطوات النشر الكاملة:

```bash
# 1. على السيرفر، افتح البورتات
sudo ufw allow 7880:7882/tcp
sudo ufw allow 7880:7882/udp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:49999/udp
sudo ufw allow 50000:50100/udp
sudo ufw reload

# 2. نزّل الإعدادات الجديدة
cd ~/ablox/ablox
git pull origin main

# 3. أعد بناء وشغّل
docker compose down
docker compose up -d --no-deps livekit coturn app

# 4. فحص الحالة
docker compose ps
docker compose logs app --tail=50

# 5. اختبر الاتصال
docker compose exec app curl -s http://livekit:7880 | head

# 6. اختبر من المتصفح
# https://mrco.live → أنشئ بث جديد
```

---

## مراقبة الأداء:

### على السيرفر:
```bash
# راقب استهلاك الموارد
docker stats ablox_app ablox_livekit ablox_coturn

# تحقق من الاتصالات النشطة
netstat -an | grep ESTABLISHED | wc -l

# راقب عرض النطاق الترددي
iftop -i eth0

# تحقق من logs للأخطاء
for service in app livekit coturn; do
  echo "=== $service ==="
  docker compose logs $service --tail=20
done
```

### من المتصفح (DevTools):
1. افتح Network tab
2. ابحث عن `lk.mrco.live` connections
3. تحقق من:
   - Status: ✓ 101 Switching Protocols (WebSocket)
   - Size: يجب أن يكون streaming
   - Duration: يجب أن تستمر طالما البث مباشر

---

## عادات جيدة:

✅ **افعل:**
- استخدم HTTPS دائماً (required للـ getUserMedia)
- اختبر على سرعات إنترنت مختلفة
- استخدم adaptive quality
- راقب الـ logs للأخطاء

❌ **تجنب:**
- استخدام HTTP (سيفشل)
- فتح جميع المنافذ للعامة (استخدم firewall rules)
- broadcast على أكثر من 500 مستخدم في room واحد
- تشغيل بدون TURN server

---

## اختبار سريع:

```bash
# يجب أن يعود 200 OK
curl -I https://lk.mrco.live/

# يجب أن يعود JSON
curl -H "Authorization: Bearer YOUR_TOKEN" https://mrco.live/api/v1/social/streams/active | jq '.data | length'
```
