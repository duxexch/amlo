/**
 * Socket Manager — مدير الاتصال الذكي
 * ════════════════════════════════════════
 * - Connection quality detection (2G/3G/4G/WiFi)
 * - Adaptive reconnection with exponential backoff
 * - Offline message queue (sends when connection restored)
 * - Bandwidth-aware event batching
 * - Data saver mode
 */
import { io as socketIO, Socket } from "socket.io-client";

// ── Connection quality levels ──
export type ConnectionQuality = "offline" | "poor" | "fair" | "good" | "excellent";

export interface ConnectionInfo {
  quality: ConnectionQuality;
  rtt: number;          // round-trip time in ms
  downlink: number;     // estimated Mbps
  effectiveType: string; // "slow-2g" | "2g" | "3g" | "4g"
  dataSaver: boolean;   // user opted into data saving
}

// ── Quality thresholds ──
const QUALITY_THRESHOLDS: Record<ConnectionQuality, { maxRtt: number; minDownlink: number }> = {
  excellent: { maxRtt: 100, minDownlink: 5 },
  good:      { maxRtt: 300, minDownlink: 1.5 },
  fair:      { maxRtt: 600, minDownlink: 0.5 },
  poor:      { maxRtt: Infinity, minDownlink: 0 },
  offline:   { maxRtt: Infinity, minDownlink: 0 },
};

// ── Queued event for offline sending ──
interface QueuedEvent {
  event: string;
  data: unknown;
  timestamp: number;
  maxAge: number; // ms — discard if older than this
}

// ── Event listeners ──
type QualityListener = (info: ConnectionInfo) => void;

class SocketManager {
  private socket: Socket | null = null;
  private connectionInfo: ConnectionInfo = {
    quality: "good",
    rtt: 0,
    downlink: 10,
    effectiveType: "4g",
    dataSaver: false,
  };
  private qualityListeners = new Set<QualityListener>();
  private offlineQueue: QueuedEvent[] = [];
  private maxQueueSize = 50;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private qualityCheckInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private isDestroyed = false;

  /**
   * Get or create the socket singleton
   */
  getSocket(): Socket {
    if (this.socket && !this.isDestroyed) return this.socket;

    this.socket = socketIO({
      transports: ["websocket", "polling"],
      // ── Reconnection: exponential backoff for weak networks ──
      reconnection: true,
      reconnectionAttempts: Infinity,    // never give up
      reconnectionDelay: 1000,           // start at 1s
      reconnectionDelayMax: 30000,       // cap at 30s
      randomizationFactor: 0.5,          // jitter ±50%
      // ── Timeout: generous for slow networks ──
      timeout: 30000,                    // 30s connect timeout
      // ── Upgrade: prefer websocket but don't force ──
      upgrade: true,
      rememberUpgrade: true,
      // ── Auth: preserved across reconnects ──
      forceNew: false,
    });

    this.isDestroyed = false;
    this.setupListeners();
    this.startQualityMonitoring();

    return this.socket;
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.reconnectAttempts = 0;
      this.flushOfflineQueue();
      this.measureLatency();
    });

    this.socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        // Server kicked us — don't auto-reconnect immediately
        setTimeout(() => this.socket?.connect(), 5000);
      }
      this.updateQuality("offline", 0, 0);
    });

    this.socket.on("reconnect_attempt", (attempt) => {
      this.reconnectAttempts = attempt;
    });

    this.socket.on("connect_error", () => {
      this.updateQuality("offline", 0, 0);
    });

    // Server can push quality hints
    this.socket.on("connection-quality", (data: { rtt?: number }) => {
      if (data.rtt) this.detectQuality(data.rtt);
    });
  }

  /**
   * Measure latency via ping/pong
   */
  private measureLatency() {
    if (!this.socket?.connected) return;
    const start = Date.now();
    this.socket.volatile.emit("ping-check", {}, () => {
      const rtt = Date.now() - start;
      this.detectQuality(rtt);
    });
  }

  /**
   * Start periodic quality monitoring
   */
  private startQualityMonitoring() {
    // Use Network Information API if available
    this.checkNetworkAPI();

    // Periodic latency check every 30s
    this.qualityCheckInterval = setInterval(() => {
      this.measureLatency();
      this.checkNetworkAPI();
    }, 30_000);

    // Listen for network changes
    if (typeof navigator !== "undefined") {
      const conn = (navigator as any).connection;
      if (conn) {
        conn.addEventListener("change", () => this.checkNetworkAPI());
      }
      window.addEventListener("online", () => {
        this.updateConnectionInfo({ quality: "fair" });
        this.socket?.connect();
      });
      window.addEventListener("offline", () => {
        this.updateQuality("offline", 0, 0);
      });
    }
  }

  /**
   * Check Network Information API (Chrome/Edge/Android)
   */
  private checkNetworkAPI() {
    if (typeof navigator === "undefined") return;
    const conn = (navigator as any).connection;
    if (!conn) return;

    const effectiveType = conn.effectiveType || "4g";
    const downlink = conn.downlink || 10;
    const rtt = conn.rtt || 0;
    const saveData = conn.saveData || false;

    this.connectionInfo.effectiveType = effectiveType;
    this.connectionInfo.downlink = downlink;
    this.connectionInfo.dataSaver = saveData || this.connectionInfo.dataSaver;

    if (effectiveType === "slow-2g" || effectiveType === "2g") {
      this.updateQuality("poor", rtt, downlink);
    } else if (effectiveType === "3g") {
      this.updateQuality("fair", rtt, downlink);
    } else {
      // Use RTT for finer detection on 4g
      this.detectQuality(rtt || this.connectionInfo.rtt);
    }
  }

  private detectQuality(rtt: number) {
    const downlink = this.connectionInfo.downlink;
    let quality: ConnectionQuality;

    if (!navigator.onLine) {
      quality = "offline";
    } else if (rtt <= QUALITY_THRESHOLDS.excellent.maxRtt && downlink >= QUALITY_THRESHOLDS.excellent.minDownlink) {
      quality = "excellent";
    } else if (rtt <= QUALITY_THRESHOLDS.good.maxRtt && downlink >= QUALITY_THRESHOLDS.good.minDownlink) {
      quality = "good";
    } else if (rtt <= QUALITY_THRESHOLDS.fair.maxRtt && downlink >= QUALITY_THRESHOLDS.fair.minDownlink) {
      quality = "fair";
    } else {
      quality = "poor";
    }

    this.updateQuality(quality, rtt, downlink);
  }

  private updateQuality(quality: ConnectionQuality, rtt: number, downlink: number) {
    const prev = this.connectionInfo.quality;
    this.connectionInfo.quality = quality;
    this.connectionInfo.rtt = rtt;
    this.connectionInfo.downlink = downlink;

    if (prev !== quality) {
      this.notifyListeners();
    }
  }

  private updateConnectionInfo(partial: Partial<ConnectionInfo>) {
    Object.assign(this.connectionInfo, partial);
    this.notifyListeners();
  }

  private notifyListeners() {
    const info = { ...this.connectionInfo };
    this.qualityListeners.forEach(fn => {
      try { fn(info); } catch {}
    });
  }

  // ── Public API ──

  /**
   * Emit an event — if offline, queue it for later
   */
  emit(event: string, data: unknown, maxAge = 30_000): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      this.queueEvent(event, data, maxAge);
    }
  }

  /**
   * Emit with volatile flag (drop if not currently connected)
   * Good for typing indicators, cursor positions, etc.
   */
  emitVolatile(event: string, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.volatile.emit(event, data);
    }
    // If not connected, just drop it — these events are ephemeral
  }

  /**
   * Queue an event for when we reconnect
   */
  private queueEvent(event: string, data: unknown, maxAge: number) {
    if (this.offlineQueue.length >= this.maxQueueSize) {
      this.offlineQueue.shift(); // drop oldest
    }
    this.offlineQueue.push({ event, data, timestamp: Date.now(), maxAge });
  }

  /**
   * Flush queued events after reconnect
   */
  private flushOfflineQueue() {
    const now = Date.now();
    const validEvents = this.offlineQueue.filter(e => now - e.timestamp < e.maxAge);
    this.offlineQueue = [];

    for (const evt of validEvents) {
      this.socket?.emit(evt.event, evt.data);
    }
  }

  /**
   * Get current connection quality info
   */
  getConnectionInfo(): ConnectionInfo {
    return { ...this.connectionInfo };
  }

  /**
   * Subscribe to quality changes
   */
  onQualityChange(fn: QualityListener): () => void {
    this.qualityListeners.add(fn);
    // Immediately call with current state
    fn({ ...this.connectionInfo });
    return () => this.qualityListeners.delete(fn);
  }

  /**
   * Enable/disable data saver mode
   */
  setDataSaver(enabled: boolean): void {
    this.connectionInfo.dataSaver = enabled;
    this.notifyListeners();
    // Persist preference
    try { localStorage.setItem("ablox:dataSaver", enabled ? "1" : "0"); } catch {}
  }

  /**
   * Check if data saver is on
   */
  isDataSaverEnabled(): boolean {
    if (this.connectionInfo.dataSaver) return true;
    try {
      return localStorage.getItem("ablox:dataSaver") === "1";
    } catch {
      return false;
    }
  }

  /**
   * Get recommended media constraints based on connection quality
   */
  getMediaConstraints(type: "video" | "voice"): MediaStreamConstraints {
    const q = this.connectionInfo.quality;
    const saver = this.isDataSaverEnabled();

    if (type === "voice" || q === "poor" || saver) {
      // Audio only — minimal bandwidth
      return {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: q === "poor" ? 8000 : 16000,  // 8kHz for poor, 16kHz for others
          channelCount: 1,
        },
        video: false,
      };
    }

    // Video constraints scaled to connection quality
    const videoConstraints: Record<ConnectionQuality, MediaTrackConstraints> = {
      excellent: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
      good:      { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } },
      fair:      { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } },
      poor:      { width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { ideal: 10, max: 12 } },
      offline:   { width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { max: 10 } },
    };

    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: videoConstraints[q] || videoConstraints.fair,
    };
  }

  /**
   * Get recommended bitrate for WebRTC based on quality
   */
  getRecommendedBitrate(type: "video" | "voice"): { min: number; max: number; start: number } {
    const q = this.connectionInfo.quality;
    const saver = this.isDataSaverEnabled();

    if (type === "voice") {
      return q === "poor" || saver
        ? { min: 8_000, max: 24_000, start: 16_000 }      // 8-24 kbps — Opus narrowband
        : { min: 16_000, max: 64_000, start: 32_000 };     // 16-64 kbps — Opus wideband
    }

    // Video bitrates
    const bitrates: Record<ConnectionQuality, { min: number; max: number; start: number }> = {
      excellent: { min: 200_000, max: 1_000_000, start: 500_000 },  // 200K-1Mbps
      good:      { min: 150_000, max: 500_000,   start: 300_000 },  // 150-500 kbps
      fair:      { min: 80_000,  max: 250_000,   start: 150_000 },  // 80-250 kbps
      poor:      { min: 30_000,  max: 100_000,   start: 50_000 },   // 30-100 kbps
      offline:   { min: 0,       max: 50_000,    start: 30_000 },
    };

    return saver
      ? bitrates.poor
      : (bitrates[q] || bitrates.fair);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.isDestroyed = true;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.qualityCheckInterval) clearInterval(this.qualityCheckInterval);
    this.qualityListeners.clear();
    this.offlineQueue = [];
    this.socket?.disconnect();
    this.socket = null;
  }
}

// ── Singleton ──
export const socketManager = new SocketManager();

// ── Convenience: get socket ──
export function getSocket(): Socket {
  return socketManager.getSocket();
}
