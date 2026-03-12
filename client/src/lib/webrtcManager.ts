/**
 * WebRTC Manager — مدير المكالمات
 * ════════════════════════════════════════
 * Real WebRTC with:
 * - Adaptive bitrate based on connection quality
 * - Audio-only fallback for weak connections
 * - ICE candidate handling with TURN fallback
 * - Automatic quality degradation when bandwidth drops
 * - Reconnection on ICE failure
 * - Cross-browser/device compatibility (adapter.js polyfill)
 */
import { socketManager, type ConnectionQuality } from "./socketManager";

// ── WebRTC adapter polyfill for cross-browser compatibility ──
// Normalizes getUserMedia, RTCPeerConnection across Chrome, Firefox, Safari, Samsung Browser, WebView
let adapterLoaded = false;
async function ensureWebRTCAdapter(): Promise<void> {
  if (adapterLoaded) return;
  try {
    // Polyfill navigator.mediaDevices for older devices
    if (typeof navigator !== "undefined") {
      if (!(navigator as any).mediaDevices) {
        (navigator as any).mediaDevices = {} as MediaDevices;
      }
      if (!(navigator as any).mediaDevices.getUserMedia) {
        (navigator as any).mediaDevices.getUserMedia = function (constraints: MediaStreamConstraints) {
          const getUserMedia = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia;
          if (!getUserMedia) {
            return Promise.reject(new Error("getUserMedia غير مدعوم في هذا المتصفح"));
          }
          return new Promise((resolve, reject) => {
            getUserMedia.call(navigator, constraints, resolve, reject);
          });
        };
      }
    }
    adapterLoaded = true;
  } catch {
    adapterLoaded = true;
  }
}
// Run on import
ensureWebRTCAdapter();

export type CallType = "voice" | "video";
export type CallState = "idle" | "connecting" | "ringing" | "active" | "reconnecting" | "ended" | "failed";

export interface CallStats {
  rtt: number;
  packetsLost: number;
  jitter: number;
  bitrate: number;
  frameRate?: number;
  resolution?: { width: number; height: number };
  audioLevel: number;
  mos: number;
  usingRelay: boolean;
}

export interface CallEventHandlers {
  onStateChange: (state: CallState) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream) => void;
  onStats: (stats: CallStats) => void;
  onQualityChange: (quality: ConnectionQuality) => void;
  onError: (error: string) => void;
  onDurationTick: (seconds: number) => void;
}

// ── ICE Servers (STUN + optional TURN — fetched from server) ──
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

let cachedIceServers: RTCIceServer[] | null = null;
let iceServersFetchedAt = 0;
const ICE_CACHE_TTL = 3600_000; // 1 hour

async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (cachedIceServers && now - iceServersFetchedAt < ICE_CACHE_TTL) {
    return cachedIceServers;
  }
  try {
    const res = await fetch("/api/social/ice-servers", { credentials: "include" });
    const json = await res.json();
    if (res.ok && json?.success && Array.isArray(json.data)) {
      const servers = json.data as RTCIceServer[];
      cachedIceServers = servers;
      iceServersFetchedAt = now;
      return servers;
    }
  } catch {
    // Fall through to fallback
  }
  return FALLBACK_ICE_SERVERS;
}

/** Approximate MOS (Mean Opinion Score) from network stats — 1.0 (bad) to 4.5 (excellent) */
function calculateMOS(rtt: number, jitter: number, packetLossPercent: number): number {
  // E-model simplified: R = 93.2 - Id - Ie
  const effectiveLatency = rtt + jitter * 2 + 10; // +10ms processing
  const Id = effectiveLatency > 177.3
    ? 0.024 * effectiveLatency + 0.11 * (effectiveLatency - 177.3)
    : 0.024 * effectiveLatency;
  const Ie = 7 + 30 * Math.log(1 + 15 * packetLossPercent);
  const R = Math.max(0, Math.min(100, 93.2 - Id - Ie));
  return 1 + 0.035 * R + 7e-6 * R * (R - 60) * (100 - R);
}

/** Enable Opus DTX + FEC for bandwidth savings and packet-loss resilience */
function enableOpusDTX(sdp: string): string {
  // Dynamically find Opus payload type from SDP (not always 111)
  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!opusMatch) return sdp;
  const pt = opusMatch[1];
  return sdp.replace(
    new RegExp(`a=fmtp:${pt} (.*)`, "g"),
    `a=fmtp:${pt} $1;usedtx=1;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=24000;maxplaybackrate=24000`
  );
}

class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private handlers: Partial<CallEventHandlers> = {};
  private state: CallState = "idle";
  private callType: CallType = "voice";
  private targetUserId: string | null = null;
  private callId: string | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private duration = 0;
  private qualityUnsub: (() => void) | null = null;
  private iceCandidateQueue: RTCIceCandidate[] = [];
  private isNegotiating = false;
  private makingOffer = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private networkChangeHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private silentDisconnectTimer: ReturnType<typeof setInterval> | null = null;
  private lastPacketsReceivedAt = 0;
  private usingRelay = false;
  private lastPacketsReceived = 0;
  private currentFacingMode: "user" | "environment" = "user";

  /**
   * Initialize a call (outgoing)
   * @param callId - The server-assigned call ID (from POST /calls)
   */
  async startCall(
    targetUserId: string,
    callType: CallType,
    handlers: Partial<CallEventHandlers>,
    callId?: string
  ): Promise<void> {
    this.cleanup();
    this.handlers = handlers;
    this.callType = callType;
    this.targetUserId = targetUserId;
    if (callId) this.callId = callId;
    this.setState("connecting");

    try {
      // Get media based on connection quality
      await this.acquireMedia();
      await this.createPeerConnection();

      // Add local tracks to peer connection
      if (this.localStream && this.pc) {
        for (const track of this.localStream.getTracks()) {
          this.pc.addTrack(track, this.localStream);
        }
      }

      // Create and send offer
      this.makingOffer = true;
      const offer = await this.pc!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      });
      // Enable Opus DTX for bandwidth savings on voice
      if (offer.sdp) offer.sdp = enableOpusDTX(offer.sdp);
      await this.pc!.setLocalDescription(offer);
      this.makingOffer = false;

      // Send offer via signaling
      const socket = socketManager.getSocket();
      socket.emit("call-signal", {
        callId: this.callId || `call-${Date.now()}`,
        targetId: targetUserId,
        signal: { type: "offer", sdp: offer.sdp },
      });
    } catch (err: any) {
      this.handleError(err.message || "فشل بدء المكالمة");
    }
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(
    callId: string,
    callerId: string,
    callType: CallType,
    offer: RTCSessionDescriptionInit,
    handlers: Partial<CallEventHandlers>
  ): Promise<void> {
    this.cleanup();
    this.handlers = handlers;
    this.callType = callType;
    this.targetUserId = callerId;
    this.callId = callId;
    this.setState("connecting");

    try {
      await this.acquireMedia();
      await this.createPeerConnection();

      // Add local tracks
      if (this.localStream && this.pc) {
        for (const track of this.localStream.getTracks()) {
          this.pc.addTrack(track, this.localStream);
        }
      }

      // Set remote description (the offer)
      await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));

      // Drain queued ICE candidates
      for (const candidate of this.iceCandidateQueue) {
        await this.pc!.addIceCandidate(candidate).catch(() => { });
      }
      this.iceCandidateQueue = [];

      // Create answer
      const answer = await this.pc!.createAnswer();
      // Enable Opus DTX for bandwidth savings on voice
      if (answer.sdp) answer.sdp = enableOpusDTX(answer.sdp);
      await this.pc!.setLocalDescription(answer);

      // Send answer via signaling
      const socket = socketManager.getSocket();
      socket.emit("call-signal", {
        callId,
        targetId: callerId,
        signal: { type: "answer", sdp: answer.sdp },
      });
    } catch (err: any) {
      this.handleError(err.message || "فشل قبول المكالمة");
    }
  }

  /**
   * Handle incoming signaling data
   */
  async handleSignal(signal: any): Promise<void> {
    if (!this.pc) {
      // Queue ICE candidates if PC not ready yet (cap at 50 to prevent memory leak)
      if (signal.type === "candidate" && signal.candidate && this.iceCandidateQueue.length < 50) {
        this.iceCandidateQueue.push(new RTCIceCandidate(signal.candidate));
      }
      return;
    }

    try {
      if (signal.type === "offer") {
        // Glare handling: if we're also making an offer, rollback and accept the remote
        const offerCollision = this.makingOffer || this.pc.signalingState !== "stable";
        if (offerCollision) {
          // Rollback our pending local description and accept the remote offer
          try {
            await this.pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
          } catch {
            // Rollback may fail if already stable — ignore
            return;
          }
        }

        await this.pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        const socket = socketManager.getSocket();
        socket.emit("call-signal", {
          callId: this.callId,
          targetId: this.targetUserId,
          signal: { type: "answer", sdp: answer.sdp },
        });
      } else if (signal.type === "answer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal));
        // Drain queued candidates
        for (const candidate of this.iceCandidateQueue) {
          await this.pc.addIceCandidate(candidate).catch(() => { });
        }
        this.iceCandidateQueue = [];
      } else if (signal.type === "candidate" && signal.candidate) {
        if (this.pc.remoteDescription) {
          await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else if (this.iceCandidateQueue.length < 50) {
          this.iceCandidateQueue.push(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (err: any) {
      console.warn("[WebRTC] Signal handling error:", err.message);
    }
  }

  /**
   * Acquire local media stream — with progressive fallback for compatibility
   * 1. Try full constraints (video+audio or audio)
   * 2. If video fails → fallback to audio-only
   * 3. If audio fails with constraints → try minimal audio { audio: true }
   * 4. If getUserMedia not supported → throw clear error
   */
  private async acquireMedia(): Promise<void> {
    await ensureWebRTCAdapter();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("المتصفح لا يدعم المكالمات — يرجى استخدام Chrome أو Safari");
    }

    const constraints = socketManager.getMediaConstraints(this.callType);

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.handlers.onLocalStream?.(this.localStream);
    } catch (err: any) {
      // If video fails, fall back to audio only
      if (this.callType === "video") {
        console.warn("[WebRTC] Camera failed, falling back to audio-only:", err.message);
        this.callType = "voice";
        try {
          const audioConstraints = socketManager.getMediaConstraints("voice");
          this.localStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
          this.handlers.onLocalStream?.(this.localStream);
          this.handlers.onError?.("الكاميرا غير متاحة — تم التحويل لمكالمة صوتية");
        } catch (audioErr: any) {
          // Minimal audio fallback for restrictive devices
          console.warn("[WebRTC] Rich audio constraints failed, trying minimal:", audioErr.message);
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.handlers.onLocalStream?.(this.localStream);
            this.handlers.onError?.("الكاميرا غير متاحة — تم التحويل لمكالمة صوتية");
          } catch {
            throw new Error("لا يمكن الوصول إلى الميكروفون — تأكد من الأذونات");
          }
        }
      } else {
        // Audio call failed — try minimal constraints
        console.warn("[WebRTC] Audio constraints failed, trying minimal:", err.message);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          this.handlers.onLocalStream?.(this.localStream);
        } catch {
          throw new Error("لا يمكن الوصول إلى الميكروفون — تأكد من الأذونات");
        }
      }
    }
  }

  /**
   * Create RTCPeerConnection with event handlers
   * Includes TURN-only fallback for restrictive NATs/firewalls
   */
  private async createPeerConnection(): Promise<void> {
    await ensureWebRTCAdapter();

    if (typeof RTCPeerConnection === "undefined") {
      throw new Error("المتصفح لا يدعم مكالمات WebRTC");
    }

    // Fetch TURN credentials from server (with fallback)
    const iceServers = await getIceServers();

    const config: RTCConfiguration = {
      iceServers,
      iceCandidatePoolSize: 2,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    };

    // On mobile devices with restrictive NAT, force relay
    if (this.reconnectAttempts > 0) {
      config.iceTransportPolicy = "relay";
    }

    this.pc = new RTCPeerConnection(config);

    // ── ICE Candidates ──
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = socketManager.getSocket();
        socket.emit("call-signal", {
          callId: this.callId,
          targetId: this.targetUserId,
          signal: { type: "candidate", candidate: event.candidate.toJSON() },
        });
      }
    };

    // ── ICE Gathering Timeout — force-send offer after 10s ──
    let gatheringTimer: ReturnType<typeof setTimeout> | null = null;
    this.pc.onicegatheringstatechange = () => {
      if (this.pc?.iceGatheringState === "gathering") {
        gatheringTimer = setTimeout(() => {
          if (this.pc?.iceGatheringState === "gathering" && this.pc.localDescription) {
            console.warn("[WebRTC] ICE gathering stuck >5s, forcing with available candidates");
            const socket = socketManager.getSocket();
            socket.emit("call-signal", {
              callId: this.callId,
              targetId: this.targetUserId,
              signal: { type: this.pc.localDescription.type, sdp: this.pc.localDescription.sdp },
            });
          }
        }, 5_000);
      } else if (gatheringTimer) {
        clearTimeout(gatheringTimer);
        gatheringTimer = null;
      }
    };

    // ── ICE Connection State — with exponential backoff reconnection ──
    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc?.iceConnectionState;
      switch (iceState) {
        case "connected":
        case "completed":
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
          this.setState("active");
          if (!this.durationInterval) this.startDurationTimer();
          if (!this.statsInterval) this.startStatsMonitoring();
          this.applyBitrateConstraints();
          // Notify server that media is actually flowing (for accurate billing)
          if (this.callId) {
            const socket = socketManager.getSocket();
            socket.emit("call-media-connected", { callId: this.callId });
          }
          break;
        case "disconnected":
          this.setState("reconnecting");
          this.scheduleReconnect();
          break;
        case "failed":
          this.scheduleReconnect();
          break;
        case "closed":
          this.endCall();
          break;
      }
    };

    // ── Connection State — verify DTLS ──
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "connected") {
        this.pc.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === "transport") {
              console.log("[WebRTC] DTLS:", report.dtlsState, "| SRTP:", report.srtpCipher);
            }
          });
        }).catch(() => { });
      }
    };

    // ── Remote Stream ──
    this.pc.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      this.remoteStream.addTrack(event.track);
      this.handlers.onRemoteStream?.(this.remoteStream);

      // Detect when remote track ends/mutes (debounced to avoid spam on network jitter)
      let trackMuteTimer: ReturnType<typeof setTimeout> | null = null;
      event.track.onended = () => {
        if (event.track.kind === "video" && this.pc?.connectionState === "connected") {
          this.handlers.onError?.("الطرف الآخر أوقف الكاميرا");
        }
      };
      event.track.onmute = () => {
        if (event.track.kind === "video") {
          trackMuteTimer = setTimeout(() => {
            if (this.pc?.connectionState === "connected") {
              this.handlers.onError?.("فيديو الطرف الآخر متوقف مؤقتاً");
            }
          }, 3000);
        }
      };
      event.track.onunmute = () => {
        if (trackMuteTimer) { clearTimeout(trackMuteTimer); trackMuteTimer = null; }
      };
    };

    // ── Negotiation needed ──
    this.pc.onnegotiationneeded = async () => {
      if (this.isNegotiating) return;
      this.isNegotiating = true;
      try {
        this.makingOffer = true;
        const offer = await this.pc!.createOffer();
        if (this.pc!.signalingState !== "stable") return;
        await this.pc!.setLocalDescription(offer);
        this.makingOffer = false;

        const socket = socketManager.getSocket();
        socket.emit("call-signal", {
          callId: this.callId,
          targetId: this.targetUserId,
          signal: { type: "offer", sdp: offer.sdp },
        });
      } finally {
        this.isNegotiating = false;
      }
    };

    // Monitor quality changes and adapt bitrate
    this.qualityUnsub = socketManager.onQualityChange((info) => {
      this.handlers.onQualityChange?.(info.quality);
      this.applyBitrateConstraints();

      // If quality drops to "poor" during video call, switch to audio-only
      if (info.quality === "poor" && this.callType === "video" && this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack?.enabled) {
          videoTrack.enabled = false;
          this.handlers.onError?.("الاتصال ضعيف — تم إيقاف الفيديو مؤقتاً");
        }
      }
    });

    // ── Network Change Detection — debounced ICE restart on WiFi↔Cellular switch ──
    let networkDebounce: ReturnType<typeof setTimeout> | null = null;
    const debouncedICERestart = () => {
      if (this.pc && (this.state === "active" || this.state === "reconnecting")) {
        if (networkDebounce) clearTimeout(networkDebounce);
        networkDebounce = setTimeout(() => {
          if (this.pc && (this.state === "active" || this.state === "reconnecting")) {
            console.log("[WebRTC] Network change detected, restarting ICE");
            this.restartICE();
          }
        }, 2000);
      }
    };

    // navigator.connection.change — Chrome/Edge/Android
    this.networkChangeHandler = debouncedICERestart;
    (navigator as any).connection?.addEventListener("change", this.networkChangeHandler);

    // online event — all browsers (Safari, Firefox included)
    this.onlineHandler = () => {
      if (this.pc && (this.state === "reconnecting" || this.pc.iceConnectionState === "disconnected" || this.pc.iceConnectionState === "failed")) {
        console.log("[WebRTC] Browser came online, restarting ICE");
        this.restartICE();
      }
    };
    window.addEventListener("online", this.onlineHandler);

    // visibilitychange — restart ICE when user returns to the app/tab (mobile may suspend WebRTC)
    this.visibilityHandler = () => {
      if (document.visibilityState === "visible" && this.pc) {
        const iceState = this.pc.iceConnectionState;
        if (iceState === "disconnected" || iceState === "failed") {
          console.log("[WebRTC] Tab became visible with broken ICE, restarting");
          this.restartICE();
        }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);

    // ── Silent Disconnect Detection — catch frozen connections with no packet flow ──
    this.lastPacketsReceivedAt = Date.now();
    this.silentDisconnectTimer = setInterval(async () => {
      if (!this.pc || this.state !== "active") return;
      try {
        const stats = await this.pc.getStats();
        let currentReceived = 0;
        stats.forEach((report) => {
          if (report.type === "inbound-rtp") currentReceived += report.packetsReceived || 0;
        });
        if (currentReceived > this.lastPacketsReceived) {
          this.lastPacketsReceived = currentReceived;
          this.lastPacketsReceivedAt = Date.now();
        } else if (Date.now() - this.lastPacketsReceivedAt > 8000) {
          // No new packets for 8 seconds — connection is silently dead
          console.warn("[WebRTC] Silent disconnect: no packets for 8s, restarting ICE");
          this.lastPacketsReceivedAt = Date.now(); // reset to avoid rapid retries
          this.restartICE();
        }
      } catch { }
    }, 4000);
  }

  /**
   * Apply bitrate constraints based on current quality
   */
  private async applyBitrateConstraints(): Promise<void> {
    if (!this.pc) return;
    const senders = this.pc.getSenders();

    for (const sender of senders) {
      if (!sender.track) continue;
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      const bitrate = socketManager.getRecommendedBitrate(
        sender.track.kind === "video" ? "video" : "voice"
      );

      params.encodings[0].maxBitrate = bitrate.max;
      // Set scale-down for video on weak connections
      if (sender.track.kind === "video") {
        const quality = socketManager.getConnectionInfo().quality;
        if (quality === "poor" || quality === "fair") {
          params.encodings[0].scaleResolutionDownBy = quality === "poor" ? 4 : 2;
        }
      }

      try {
        await sender.setParameters(params);
      } catch { }
    }
  }

  /**
   * Exponential backoff reconnection — up to maxReconnectAttempts
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleError("فشل إعادة الاتصال بعد عدة محاولات");
      return;
    }
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 15_000);
    this.reconnectAttempts++;
    console.log(`[WebRTC] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.pc && (this.pc.iceConnectionState === "disconnected" || this.pc.iceConnectionState === "failed")) {
        this.restartICE();
      }
    }, delay);
  }

  /**
   * ICE restart on failure
   */
  private async restartICE(): Promise<void> {
    if (!this.pc) return;
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      const socket = socketManager.getSocket();
      socket.emit("call-signal", {
        callId: this.callId,
        targetId: this.targetUserId,
        signal: { type: "offer", sdp: offer.sdp },
      });
    } catch {
      this.handleError("فشل إعادة الاتصال");
    }
  }

  /**
   * Monitor call stats for adaptive quality
   */
  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(async () => {
      if (!this.pc) return;
      try {
        const stats = await this.pc.getStats();
        let totalPacketsLost = 0;
        let totalPacketsReceived = 0;
        let totalJitter = 0;
        let currentBitrate = 0;
        let audioLevel = 0;
        let rtt = 0;
        let frameRate: number | undefined;
        let resolution: { width: number; height: number } | undefined;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp") {
            totalPacketsLost += report.packetsLost || 0;
            totalPacketsReceived += report.packetsReceived || 0;
            totalJitter = Math.max(totalJitter, (report.jitter || 0) * 1000);
            if (report.kind === "video") {
              frameRate = report.framesPerSecond;
              if (report.frameWidth && report.frameHeight) {
                resolution = { width: report.frameWidth, height: report.frameHeight };
              }
            }
          }
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            currentBitrate = (report.availableOutgoingBitrate || 0) / 1000;
            rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
          }
          if (report.type === "media-source" && report.kind === "audio") {
            audioLevel = report.audioLevel || 0;
          }
          // Detect TURN relay usage
          if (report.type === "local-candidate" && report.candidateType === "relay") {
            this.usingRelay = true;
          }
        });

        // Calculate MOS from live stats
        const totalPackets = totalPacketsReceived + totalPacketsLost;
        const lossPercent = totalPackets > 0 ? (totalPacketsLost / totalPackets) * 100 : 0;
        const mos = calculateMOS(rtt || socketManager.getConnectionInfo().rtt, totalJitter, lossPercent);

        this.lastPacketsReceived = totalPacketsReceived;

        this.handlers.onStats?.({
          rtt: rtt || socketManager.getConnectionInfo().rtt,
          packetsLost: totalPacketsLost,
          jitter: totalJitter,
          bitrate: currentBitrate,
          frameRate,
          resolution,
          audioLevel,
          mos,
          usingRelay: this.usingRelay,
        });

        // Auto-degrade if packet loss percentage is high (>5%)
        if (lossPercent > 5 && this.callType === "video") {
          this.applyBitrateConstraints();
        }
      } catch { }
    }, 2_000); // every 2 seconds for responsive adaptive bitrate
  }

  /**
   * Start duration counter (only if not already running)
   */
  private startDurationTimer(): void {
    // Don't reset duration on ICE reconnect — preserve the elapsed time
    if (this.durationInterval) return;
    this.durationInterval = setInterval(() => {
      this.duration++;
      this.handlers.onDurationTick?.(this.duration);
    }, 1000);
  }

  // ── Controls ──

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audio = this.localStream.getAudioTracks()[0];
    if (!audio) return false;
    audio.enabled = !audio.enabled;
    return !audio.enabled; // returns isMuted
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const video = this.localStream.getVideoTracks()[0];
    if (!video) return true;
    video.enabled = !video.enabled;
    return !video.enabled; // returns isVideoOff
  }

  /** Check if local stream has any video track */
  hasVideoTrack(): boolean {
    return !!(this.localStream && this.localStream.getVideoTracks().length > 0 && this.localStream.getVideoTracks()[0].enabled);
  }

  /** Dynamically acquire camera and add video track to the call */
  async addVideoTrack(): Promise<void> {
    if (!this.localStream || !this.pc) throw new Error("No active call");
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: this.currentFacingMode, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
    });
    const newTrack = newStream.getVideoTracks()[0];
    if (!newTrack) throw new Error("No video track acquired");

    // Remove any existing (disabled) video track
    const oldTrack = this.localStream.getVideoTracks()[0];
    if (oldTrack) {
      this.localStream.removeTrack(oldTrack);
      oldTrack.stop();
      const sender = this.pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newTrack);
        this.localStream.addTrack(newTrack);
        this.handlers.onLocalStream?.(this.localStream);
        return;
      }
    }

    // Add new video track to stream and peer connection
    this.localStream.addTrack(newTrack);
    this.pc.addTrack(newTrack, this.localStream);
    this.handlers.onLocalStream?.(this.localStream);
  }

  /**
   * Switch between front and back camera
   * Returns the new facingMode
   */
  async switchCamera(): Promise<"user" | "environment"> {
    if (!this.localStream || !this.pc) return this.currentFacingMode;
    const oldTrack = this.localStream.getVideoTracks()[0];
    if (!oldTrack) return this.currentFacingMode;

    const newFacing = this.currentFacingMode === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing } },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return this.currentFacingMode;

      // Replace the track on the peer connection sender
      const sender = this.pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }

      // Replace track in local stream
      this.localStream.removeTrack(oldTrack);
      oldTrack.stop();
      this.localStream.addTrack(newTrack);

      this.currentFacingMode = newFacing;
      this.handlers.onLocalStream?.(this.localStream);
    } catch {
      // Device may not have a back camera — silently fail
    }
    return this.currentFacingMode;
  }

  /**
   * End the call and cleanup
   */
  endCall(): void {
    this.setState("ended");
    this.cleanup();
  }

  private setState(state: CallState): void {
    this.state = state;
    this.handlers.onStateChange?.(state);
  }

  getState(): CallState {
    return this.state;
  }

  getDuration(): number {
    return this.duration;
  }

  private handleError(message: string): void {
    this.handlers.onError?.(message);
    this.setState("failed");
    this.cleanup();
  }

  /**
   * Full cleanup of all resources
   */
  private cleanup(): void {
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (this.durationInterval) clearInterval(this.durationInterval);
    if (this.qualityUnsub) this.qualityUnsub();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Remove network/browser event listeners
    if (this.networkChangeHandler) {
      (navigator as any).connection?.removeEventListener("change", this.networkChangeHandler);
      this.networkChangeHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.silentDisconnectTimer) {
      clearInterval(this.silentDisconnectTimer);
      this.silentDisconnectTimer = null;
    }

    // Stop local media tracks
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;

    // Close peer connection
    this.pc?.close();
    this.pc = null;

    this.remoteStream = null;
    this.iceCandidateQueue = [];
    this.isNegotiating = false;
    this.makingOffer = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.usingRelay = false;
    this.lastPacketsReceived = 0;
    this.lastPacketsReceivedAt = 0;
    this.statsInterval = null;
    this.durationInterval = null;
    this.qualityUnsub = null;
  }
}

// ── Singleton ──
export const webrtcManager = new WebRTCManager();
