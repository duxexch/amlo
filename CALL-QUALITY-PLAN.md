# خطة تحسين جودة المكالمات — AMLO Call Quality Improvement Plan
> تم إنشاء هذا التقرير بناءً على تحليل شامل للكود الفعلي للمشروع

---

## الحالة الحالية بعد الإصلاحات (Current State After Fixes)

### ✅ ما تم إصلاحه بالفعل (Already Fixed)

| # | المشكلة | الحل المطبق |
|---|---------|-------------|
| 1 | مكالمات لا تعمل — كلا الطرفين يرسلان Offer | إصلاح caller/receiver: المتصل يرسل Offer، المستقبل ينتظر ثم يرسل Answer |
| 2 | لا يوجد TURN server → فشل خلف NAT | ربط Coturn مع العميل + endpoint `/api/social/ice-servers` بتوثيق HMAC |
| 3 | انتظار رنين لا نهائي | timeout 40 ثانية على السيرفر + event `call-timeout` للعميل |
| 4 | لا صوت رنين/انتظار | Web Audio API: نغمة رنين للمستقبل + نغمة انتظار للمتصل |
| 5 | `call-signal` عبر socket ID مباشر | تحويل إلى `io.to("user:${id}")` (room-based) للثبات عند reconnect |
| 6 | Glare handling (تصادم Offers) | موجود في `handleSignal()` — يتجاهل Offer الثاني |
| 7 | ICE restart عند فشل الاتصال | `restartICE()` يُفعّل عند `iceConnectionState === "failed"` |
| 8 | Adaptive bitrate حسب جودة الاتصال | `applyBitrateConstraints()` يعدّل الجودة تلقائياً |
| 9 | تخفيض الفيديو تلقائياً | يوقف الفيديو عند `quality === "poor"` |
| 10 | Video fallback إلى صوت | إذا فشلت الكاميرا، يتحول تلقائياً لمكالمة صوتية |

### ⚙️ البنية التحتية الحالية (Current Infrastructure)

- **STUN**: Google (×2) + Cloudflare — fallback عند فشل TURN
- **TURN**: Coturn في Docker (host network) — `AbL0x_TURN_S3cr3t_2026!`
  - Port 3478 | Relay ports 49152–49252
  - `max-bps=1048576` (1Mbps per session)
  - `user-quota=12` | `total-quota=600`
  - `relay-threads=2`
- **Adaptive Quality**: 5 مستويات (excellent/good/fair/poor/offline)
- **Stats Monitoring**: كل 5 ثوانٍ — RTT, packet loss, jitter, bitrate, frameRate

---

## التحسينات المقترحة (Proposed Improvements)

### 🔴 أولوية عالية (High Priority)

#### 1. تحسين Coturn — الأمان والأداء
**المشكلة**: `TURN_SECRET` ثابت في docker-compose.yml بقيمة افتراضية مكشوفة.  
**الحل**:
```bash
# إنشاء سر عشوائي قوي
openssl rand -base64 32 > .turn_secret
# في .env
TURN_SECRET=$(cat .turn_secret)
```
**التأثير**: منع استغلال TURN relay من أطراف خارجية.

#### 2. دعم TURNS (TLS) على Port 443
**المشكلة**: بعض الشبكات المقيّدة تحجب port 3478.
**الحل**:
```conf
# turnserver.conf — إضافة
listening-port=443
alt-listening-port=3478
cert=/etc/ssl/certs/turn-cert.pem
pkey=/etc/ssl/private/turn-key.pem
```
```typescript
// ice-servers endpoint — إضافة TURNS
{ urls: `turns:${turnHost}:443?transport=tcp`, username, credential }
```
**التأثير**: دعم ~15% إضافي من المستخدمين خلف firewalls مقيّدة.

#### 3. DTLS-SRTP لتشفير الوسائط
**الحالة الحالية**: RTCPeerConnection يستخدم DTLS-SRTP بشكل افتراضي ✅  
**التحسين**: إضافة فحص صريح:
```typescript
// في createPeerConnection
this.pc.addEventListener("connectionstatechange", () => {
  if (this.pc?.connectionState === "connected") {
    // Verify DTLS is active
    this.pc.getStats().then(stats => {
      stats.forEach(report => {
        if (report.type === "transport") {
          console.log("[WebRTC] DTLS state:", report.dtlsState);
          console.log("[WebRTC] SRTP cipher:", report.srtpCipher);
        }
      });
    });
  }
});
```

#### 4. تحسين ICE Gathering — إضافة Timeout
**المشكلة**: ICE candidate gathering قد يستمر طويلاً على شبكات بطيئة.
**الحل**:
```typescript
// في createPeerConnection — إضافة icegatheringstatechange
this.pc.onicegatheringstatechange = () => {
  if (this.pc?.iceGatheringState === "gathering") {
    // If gathering takes >10s, likely stuck
    setTimeout(() => {
      if (this.pc?.iceGatheringState === "gathering") {
        console.warn("[WebRTC] ICE gathering stuck, proceeding with available candidates");
      }
    }, 10_000);
  }
};
```

---

### 🟡 أولوية متوسطة (Medium Priority)

#### 5. استخدام Opus DTX (Discontinuous Transmission)
**المشكلة**: الصوت يرسل بيانات حتى أثناء الصمت → هدر bandwidth.
**الحل**:
```typescript
// في startCall/acceptCall — تعديل SDP قبل setLocalDescription
const modifiedSdp = offer.sdp?.replace(
  'useinbandfec=1',
  'useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0'
);
```
**التأثير**: خفض ~30% من bandwidth الصوتي أثناء الصمت.

#### 6. Jitter Buffer Adaptation
**الحالة الحالية**: يعتمد على المتصفح بالكامل.
**التحسين**: استخدام `playout-delay` RTP extension:
```typescript
// في createPeerConnection
const transceivers = this.pc.getTransceivers();
for (const t of transceivers) {
  if (t.receiver.track.kind === "audio") {
    // Set jitter buffer target based on quality
    const quality = socketManager.getConnectionInfo().quality;
    const target = quality === "poor" ? 200 : quality === "fair" ? 100 : 50;
    t.receiver.jitterBufferTarget = target;
  }
}
```

#### 7. مراقبة TURN Relay Usage
**المشكلة**: لا نعرف نسبة المكالمات التي تستخدم TURN relay فعلياً.
**الحل**:
```typescript
// في startStatsMonitoring — إضافة
stats.forEach(report => {
  if (report.type === "candidate-pair" && report.state === "succeeded") {
    const localType = /* get local candidate type */;
    const remoteType = /* get remote candidate type */;
    // Log: "relay" means TURN is being used
    if (localType === "relay" || remoteType === "relay") {
      console.log("[WebRTC] Using TURN relay");
      // يمكن إرسال هذا للسيرفر لتحليل النسبة
    }
  }
});
```

#### 8. تحسين Video SVC — Simulcast
**المشكلة**: video واحد بجودة ثابتة → لا يمكن التكيف بسرعة.
**الحل**: استخدام Simulcast encoding (طبقات متعددة):
```typescript
// عند إضافة video track
const sender = this.pc.addTrack(videoTrack, this.localStream);
const params = sender.getParameters();
params.encodings = [
  { rid: "low",  maxBitrate: 100_000, scaleResolutionDownBy: 4 },
  { rid: "mid",  maxBitrate: 300_000, scaleResolutionDownBy: 2 },
  { rid: "high", maxBitrate: 800_000, scaleResolutionDownBy: 1 },
];
sender.setParameters(params);
```
**ملاحظة**: يتطلب معالجة على المستقبل لاختيار الطبقة المناسبة. فعّال فقط مع SFU، ليس مع P2P.

#### 9. تحسين Reconnection Strategy
**الحالة الحالية**: ICE restart عند فشل → 10 ثوانٍ انتظار عند disconnected.
**التحسين**:
```typescript
// استبدال strategy ثابت بـ exponential backoff
private reconnectAttempts = 0;
private maxReconnectAttempts = 3;

case "disconnected":
  this.setState("reconnecting");
  const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 15000);
  setTimeout(() => {
    if (this.pc?.iceConnectionState === "disconnected") {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.restartICE();
      } else {
        this.handleError("فشل إعادة الاتصال بعد عدة محاولات");
      }
    } else {
      this.reconnectAttempts = 0; // Reset on recovery
    }
  }, delay);
  break;
```

---

### 🟢 أولوية منخفضة (Low Priority — Future)

#### 10. Audio Processing Pipeline
إضافة `AudioContext` لمعالجة الصوت المحلي:
- Noise gate للتخلص من ضوضاء الخلفية
- Compressor لتوحيد مستوى الصوت
- AGC متقدم (أقوى من auto gain الافتراضي)

#### 11. Call Quality Score (MOS)
حساب Mean Opinion Score تقريبي من الإحصائيات:
```typescript
function calculateMOS(rtt: number, jitter: number, packetLoss: number): number {
  const R = 93.2 - (rtt / 2 * 0.024) - (jitter * 0.11) - (packetLoss * 2.5);
  return 1 + 0.035 * R + 7e-6 * R * (R - 60) * (100 - R);
}
```
يمكن عرض هذا كمؤشر بصري (أخضر/أصفر/أحمر) أثناء المكالمة.

#### 12. Server-Side Call Analytics
إرسال إحصائيات المكالمة للسيرفر عند الانتهاء:
- مدة المكالمة
- متوسط RTT / jitter / packet loss
- هل استُخدم TURN relay
- هل تم ICE restart
- نوع الشبكة (WiFi/Cellular)

هذا يسمح بتحليل جودة المكالمات على مستوى الخدمة.

#### 13. Network Change Detection
اكتشاف تغيير الشبكة (WiFi ↔ Cellular):
```typescript
navigator.connection?.addEventListener("change", () => {
  // شبكة جديدة → أعد ICE
  this.restartICE();
});
```

---

## حدود Coturn الحالية (Current Coturn Limits)

| Parameter | القيمة | الملاحظات |
|-----------|--------|----------|
| `max-bps` | 1,048,576 (1Mbps) | كافٍ لـ video 480p. قد يحتاج زيادة لـ HD |
| `user-quota` | 12 | 12 allocation لكل مستخدم — كافٍ |
| `total-quota` | 600 | يدعم ~300 مكالمة TURN متزامنة (2 allocation لكل مكالمة) |
| `relay-threads` | 2 | يكفي لـ VPS متوسط. زيادة لـ 4 عند الحمل العالي |
| `relay ports` | 49152–49252 | 100 port → ~100 مكالمة relay متزامنة. **زيادة المدى مطلوبة** |
| Memory limit | 256MB | كافٍ لـ ~200 relay session |

### ⚠️ تحذير: Relay Port Range
المدى الحالي 100 port فقط (49152–49252). لـ 5,000 مستخدم متزامن مع ~5% يحتاجون TURN:
- 5000 × 5% = 250 مكالمة relay
- كل مكالمة تحتاج ~2 port
- المطلوب: ~500 port minimum

**الحل**: توسيع إلى `49152–49999` (848 port):
```conf
min-port=49152
max-port=49999
```

---

## ملخص الأولويات (Priority Summary)

| الأولوية | التحسين | الجهد | التأثير |
|----------|---------|-------|---------|
| 🔴 عالي | تأمين TURN_SECRET | ⭐ | أمان حرج |
| 🔴 عالي | TURNS على port 443 | ⭐⭐ | +15% وصول |
| 🔴 عالي | توسيع relay port range | ⭐ | دعم الـ scale |
| 🟡 متوسط | Opus DTX | ⭐ | -30% bandwidth صوت |
| 🟡 متوسط | Reconnection backoff | ⭐⭐ | ثبات أعلى |
| 🟡 متوسط | TURN usage monitoring | ⭐⭐ | رؤية تشغيلية |
| 🟢 منخفض | MOS score display | ⭐ | تجربة مستخدم |
| 🟢 منخفض | Server analytics | ⭐⭐⭐ | تحليل طويل المدى |
| 🟢 منخفض | Network change detect | ⭐ | ثبات عند تبديل شبكة |

---

## خارطة تنفيذ للحمل الكبير جدا (Very High Scale Blueprint)

> هذا القسم يحوّل الخطة من تحسين جودة مكالمة إلى منصة قابلة للتوسع الأفقي عند أحمال ضخمة.

### 1) افتراضات السعة المستهدفة

| المستوى | مستخدمون متزامنون | مكالمات متزامنة (تقريبي) | Streams متزامنة | الهدف |
|---------|--------------------|--------------------------|-----------------|-------|
| Tier A | 10,000 | 1,000–1,500 | 150–300 | بداية التوسع |
| Tier B | 50,000 | 5,000–8,000 | 800–1,500 | نمو سريع |
| Tier C | 100,000+ | 10,000+ | 2,000+ | حمل كبير جدا |

### 2) نموذج البنية المطلوب (Mandatory Architecture Split)

1. **Edge Layer**:
`Cloudflare/WAF + CDN + Rate Limits + Bot Mitigation`

2. **App/API Layer (Stateless)**:
`Node/Express + Socket.IO` في عدة نسخ خلف Load Balancer.
لا state محلي، كل الجلسات/المفاتيح في Redis.

3. **Realtime Bus Layer**:
`Redis Cluster` لـ pub/sub والـ hot counters.
وعند Tier B/C يضاف `NATS أو Kafka` لأحداث النظام الثقيلة.

4. **Media Layer (منفصل بالكامل)**:
`LiveKit/mediasoup SFU` على عقد مخصصة CPU/Network.
`Coturn` على عقد منفصلة كذلك.

5. **Data Layer**:
`PostgreSQL + PgBouncer + Read Replicas + Partitioning`.

6. **Async/Jobs Layer**:
Queue موحدة مع `retry + DLQ + idempotency` (BullMQ/Redis Streams/Kafka).

7. **Observability Layer**:
`Prometheus + Grafana + Loki + Alertmanager + OpenTelemetry`.

### 3) ما لا يجب تشغيله على نفس VPS

- API + SFU + TURN + DB + Redis على نفس VM تحت حمل كبير = عنق زجاجة حتمي.
- أي هدف أعلى من Tier A يحتاج فصل الأدوار على الأقل إلى:
  - مجموعة App
  - مجموعة Media (SFU)
  - مجموعة TURN
  - Data managed أو عقد مستقلة

### 4) SLO/SLI إلزامية للإنتاج

| المؤشر | الهدف |
|--------|-------|
| API p95 | أقل من 150ms |
| Socket event p95 | أقل من 300ms |
| Call setup success | أعلى من 99% |
| Call drop rate | أقل من 1% |
| Error rate 5xx | أقل من 0.5% |
| TURN relay saturation | أقل من 70% عند الذروة |

### 5) ضبط مبدئي لعقد Media/TURN

1. **TURN**:
- توسيع ports إلى مدى واسع ثابت (تم اقتراحه أعلاه).
- تفعيل `TURNS:443` إلزامي.
- Secret rotation دوري (أسبوعي/شهري حسب السياسة).

2. **SFU/LiveKit**:
- تفعيل Simulcast/ABR افتراضيا.
- وضع bitrate ceilings حسب نوع الشبكة.
- autoscaling policy على: `participants`, `egress bitrate`, `CPU`.

3. **Client call profile**:
- default video profile محافظ (360p/480p) مع ترقية ديناميكية عند الجودة الممتازة.

### 6) خطة تنفيذ على 3 مراحل

#### Phase 1 (أسبوع 1-2): Hardening + قياس
1. تثبيت stack المراقبة الكامل وربط alerts.
2. تفعيل dashboards لـ:
`API latency`, `socket throughput`, `turn allocations`, `call success/drop`, `db pool pressure`.
3. اعتماد baseline تحميل (k6 + سيناريو مكالمات).

#### Phase 2 (أسبوع 3-4): فصل الطبقات
1. فصل Media/TURN عن API فعليا.
2. ترحيل Redis/Postgres إلى managed أو عقد مستقلة.
3. تفعيل autoscaling لقسم App وMedia.

#### Phase 3 (أسبوع 5-8): Scale-up تدريجي
1. اختبار Tier A ثم Tier B تدريجيا.
2. تشغيل load tests في نافذة مراقبة كاملة مع rollback ready.
3. تفعيل feature flags لتقليل الجودة تلقائيا أثناء الضغط.

### 7) اختبارات التحمل المطلوبة قبل كل ترقية مستوى

1. **API/Socket Test**: k6 + websocket scenarios.
2. **WebRTC Stress**: سيناريو call setup/teardown كثيف + packet loss simulation.
3. **Soak Test**: 6-12 ساعات حمل متوسط مستمر.
4. **Spike Test**: قفزات 3x خلال 2-5 دقائق.
5. **Failure Test**: إسقاط Redis replica أو عقدة SFU والتأكد من التعافي.

### 8) قرارات تشغيلية موصى بها

1. للحمل الكبير جدا، اعتمد **Managed LiveKit** أو cluster SFU مخصص بدل عقدة واحدة.
2. اجعل release policy: `canary 5% -> 25% -> 100%` مع auto-rollback.
3. ضع runbook واضح للحوادث P1 يشمل:
   - ارتفاع drop rate
   - فشل call setup
   - saturation في TURN/SFU

### 9) نتيجة تنفيذ هذه الخارطة

- تتحول المنصة من تحمل "جيد" إلى تحمل "مؤسسي" قابل للنمو.
- جودة المكالمات تصبح مستقرة تحت الضغط بدلا من الانهيار المفاجئ.
- أي توسع مستقبلي يصبح قرار سعة/تكلفة واضح، وليس رد فعل بعد الأعطال.
