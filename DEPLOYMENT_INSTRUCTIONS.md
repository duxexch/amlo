# 🚀 تعليمات النشر — إصلاح نظام البث المباشر

## ملخص التغييرات المطبقة

### ✅ ما تم تحسينه

1. **إعدادات LiveKit الكاملة** (`config/livekit.yaml`)
   - ✓ خوادم ICE (STUN/TURN) مكتملة
   - ✓ بيانات اعتماد TURN محددة
   - ✓ إعدادات الترميز (VP8 + H.264 للفيديو، Opus للصوت)
   - ✓ منافذ RTC والـ UDP مكوّنة بشكل صحيح

2. **قواعد الفايرول تم تحديثها**
   - منافذ UDP مفتوحة للبث المباشر

3. **خوادم البث**
   - LiveKit SFU (media relay)
   - Coturn TURN/STUN server
   - جاهزون للتشغيل على المنتج

---

## 📋 خطوات النشر على السيرفر الإنتاجي

### الطريقة 1: استخدام السكريبت المجهز (باش) — **موصى به** ✅

```bash
# على السيرفر الإنتاجي (عبر SSH):

cd ~/ablox/ablox
bash -s < deploy-streaming-fixes.sh

# أو من جهازك المحلية:
scp deploy-streaming-fixes.sh root@YOUR_VPS_IP:/tmp/
ssh root@YOUR_VPS_IP "bash /tmp/deploy-streaming-fixes.sh"
```

---

### الطريقة 2: خطوات يدوية

#### **الخطوة 1: فتح منافذ الفايرول**

```bash
ssh root@YOUR_VPS_IP

# فتح منافذ البث
sudo ufw allow 7880/tcp        # LiveKit WebSocket
sudo ufw allow 7881/tcp        # LiveKit RTC TCP
sudo ufw allow 7882/udp        # LiveKit Media UDP
sudo ufw allow 3478/tcp        # STUN TCP
sudo ufw allow 3478/udp        # STUN UDP
sudo ufw allow 49152:49999/udp # TURN Relay
sudo ufw allow 50000:50100/udp # ICE Range
sudo ufw reload
```

#### **الخطوة 2: سحب التحديثات**

```bash
cd ~/ablox/ablox
git fetch origin main
git checkout main
git pull origin main
```

#### **الخطوة 3: إعادة بناء الحاويات**

```bash
# إيقاف الحاويات القديمة
docker compose down --remove-orphans

# بناء جديد (بدون cache)
docker compose build --no-cache app livekit coturn

# تشغيل
docker compose up -d --force-recreate

# تحقق من الحالة
docker compose ps
```

#### **الخطوة 4: التحقق من التشغيل**

```bash
# يجب أن يعود 200 OK:
curl -I http://localhost:7880

# تحقق من الحاويات:
docker compose logs app --tail=50
docker compose logs livekit --tail=50

# تحقق من المنافذ المفتوحة:
netstat -tlnup | grep -E "7880|7881|7882|3478"
```

---

## 🧪 اختبار البث المباشر

### من المتصفح

1. **اذهب إلى:** <https://mrco.live>
2. **أنشئ بث مباشر جديد:**
   - اضغط "Create Stream"
   - اسمح بالوصول للكاميرا والميكروفون
   - يجب أن ترى زر "Start Broadcasting"

3. **افتح DevTools (F12):**
   - اذهب إلى **Network Tab**
   - ابحث عن `lk.mrco.live` أو `wss://`
   - يجب أن ترى:
     - ✅ Status: `101 Switching Protocols` (WebSocket)
     - ✅ حجم البيانات: > 0 bytes
     - ✅ Duration: مستمر (طالما البث مشغل)

4. **اختبر من متصفح آخر:**
   - اعرض قائمة البث النشط
   - اضغط على بثك
   - يجب أن ترى الفيديو والصوت

### من أداة سطر الأوامر (Server-side)

```bash
# تحقق من اتصالات TCP active
ss -tan | grep -E "7880|7881"

# تحقق من استخدام UDP
netstat -an | grep 7882

# راقب استهلاك الموارد
docker stats ablox_app ablox_livekit ablox_coturn
```

---

## 🔍 استكشاف الأخطاء

### ❌ الخطأ: "Failed to connect" أو "WebSocket connection failed"

**احتمالات:**

1. منافذ TCP غير مفتوحة (7880, 7881)
2. Traefik/Nginx تحويل غير صحيح
3. HTTPS/WSS غير متوفر

**الحل:**

```bash
# تحقق من Traefik
docker compose logs traefik --tail=50 | grep livekit

# تحقق من الإعادة التوجيهية
curl -I -H "Host: lk.mrco.live" http://localhost:7880
```

---

### ❌ الخطأ: "Media connection failed" أو "No ICE candidates"

**احتمالات:**

1. منافذ UDP مغلقة (7882, 3478, 49152-49999)
2. TURN server غير متاح
3. Firewall يحظر بروتوكول UDP

**الحل:**

```bash
# تحقق من UDP ports
sudo ufw status | grep udp

# تحقق من TURN server
docker compose logs coturn --tail=50 | grep -i "listen"

# اختبر الاتصال:
nc -uz 127.0.0.1 3478  # For STUN
nc -uz 127.0.0.1 7882  # For media
```

---

### ❌ الخطأ: "Permission not granted" (Camera/Mic)

**احتمالات:**

1. الموقع ليس HTTPS
2. متصفح يغير الصلاحيات

**الحل:**

- ✅ تأكد من استخدام `https://mrco.live`
- ✅ السماح بـ Camera و Microphone في إعدادات المتصفح
- ✅ جرب متصفح آخر (Chrome, Firefox, Edge)

---

## 📊 مراقبة الأداء

### استخدام الموارد

```bash
# شاشة لحية :
watch -n 1 'docker stats --no-stream ablox_app ablox_livekit ablox_coturn'

# تحقق من الذاكرة الحرة
free -h

# تحقق من استخدام القرص
df -h /var/lib/docker
```

---

## 🎯 قائمة التحقق النهائية

بعد النشر، تحقق من:

- [ ] جميع 7 منافذ مفتوحة على الفايرول
- [ ] `docker compose ps` يظهر جميع الحاويات كـ `healthy` أو `running`
- [ ] `curl http://localhost:7880` يعود حالة 200
- [ ] تحقق من `docker compose logs app` — لا توجد أخطاء
- [ ] اختبر البث من متصفح — يظهر الفيديو والصوت
- [ ] DevTools Network Tab يظهر WebSocket activity مستمر

---

## 📞 إذا استمرت المشاكل

```bash
# اجمع معلومات التشخيص:
echo "=== Firewall ===" && sudo ufw status
echo "=== Containers ===" && docker compose ps
echo "=== Ports ===" && netstat -tlnup 2>/dev/null | grep -E "7880|7881|7882"
echo "=== Network ===" && docker network ls
echo "=== Logs ===" && docker compose logs --tail=50 | tail -100

# أرسل هذا الملف إلى الفني
```

---

## Commit Reference

🔗 **Code changes:** [2dff710](https://github.com/duxexch/amlo/commit/2dff710)

**التغييرات:**

- ✅ Enhanced `config/livekit.yaml` with complete ICE/TURN configuration
- ✅ Added deployment script `deploy-streaming-fixes.sh`
- ✅ Updated documentation with troubleshooting guide

---

## 📦 توقيع رسمي APK/AAB + نشر التحميل للمستخدمين

### 1) توقيع الملفات (Official Signing)

يوجد سكربت جاهز يقوم بتوقيع ملفات:

- `client/public/download/ablox.apk`
- `client/public/download/ablox.aab`

ويخرج تقرير بالـ checksums:

- `qa/results/signed-artifacts-manifest.json`

الأمر:

```bash
npm run mobile:sign:artifacts
```

المتطلبات عبر البيئة:

- `SIGNING_KEYSTORE_PATH`
- `SIGNING_KEY_ALIAS`
- `SIGNING_STORE_PASSWORD`
- `SIGNING_KEY_PASSWORD`

اختياري:

- `SIGNING_CREATE_IF_MISSING=1` لإنشاء keystore تلقائيًا إذا كان غير موجود.

### 2) تفعيل APK/AAB في التحميل للمستخدمين

إعدادات التحميل أصبحت مفعلة افتراضيًا في إعدادات النظام (`appDownload`):

- `apk.enabled=true`
- `aab.enabled=true`

مع روابط:

- `https://mrco.live/download/ablox.apk`
- `https://mrco.live/download/ablox.aab`

### 3) تجهيز مزودي الخدمات للإنتاج

سكريبت Bootstrap للمزودين:

```bash
# Dry-run (ينتج preview فقط)
npm run prod:bootstrap:services

# Apply to DB
npm run prod:bootstrap:services:apply
```

مخرجات الـ dry-run:

- `qa/results/production-bootstrap-preview.json`

الفئات التي يتم تجهيزها:

- `socialLogin`
- `otp`
- `appDownload`
- `payment_gateways_config`

> ملاحظة: التفعيل الفعلي لأي مزود يعتمد على وجود credentials صحيحة في `.env.production`.
