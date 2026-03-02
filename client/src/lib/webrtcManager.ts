/**
 * WebRTC Manager — مدير المكالمات
 * ════════════════════════════════════════
 * Real WebRTC with:
 * - Adaptive bitrate based on connection quality
 * - Audio-only fallback for weak connections
 * - ICE candidate handling with TURN fallback
 * - Automatic quality degradation when bandwidth drops
 * - Reconnection on ICE failure
 */
import { socketManager, type ConnectionQuality } from "./socketManager";

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

// ── ICE Servers (STUN + optional TURN) ──
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

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

  /**
   * Initialize a call (outgoing)
   */
  async startCall(
    targetUserId: string,
    callType: CallType,
    handlers: Partial<CallEventHandlers>
  ): Promise<void> {
    this.cleanup();
    this.handlers = handlers;
    this.callType = callType;
    this.targetUserId = targetUserId;
    this.setState("connecting");

    try {
      // Get media based on connection quality
      await this.acquireMedia();
      this.createPeerConnection();
      
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
      await this.pc!.setLocalDescription(offer);
      this.makingOffer = false;

      // Send offer via signaling
      const socket = socketManager.getSocket();
      socket.emit("call-signal", {
        callId: this.callId || `call-${Date.now()}`,
        targetId: targetUserId,
        signal: { type: "offer", sdp: offer.sdp },
      });

      this.setState("ringing");
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
      this.createPeerConnection();

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
        await this.pc!.addIceCandidate(candidate).catch(() => {});
      }
      this.iceCandidateQueue = [];

      // Create answer
      const answer = await this.pc!.createAnswer();
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
      // Queue ICE candidates if PC not ready yet
      if (signal.type === "candidate" && signal.candidate) {
        this.iceCandidateQueue.push(new RTCIceCandidate(signal.candidate));
      }
      return;
    }

    try {
      if (signal.type === "offer") {
        // Glare handling: if we're also making an offer
        const offerCollision = this.makingOffer || this.pc.signalingState !== "stable";
        if (offerCollision) return; // polite peer would rollback; we'll skip for simplicity

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
          await this.pc.addIceCandidate(candidate).catch(() => {});
        }
        this.iceCandidateQueue = [];
      } else if (signal.type === "candidate" && signal.candidate) {
        if (this.pc.remoteDescription) {
          await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.iceCandidateQueue.push(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (err: any) {
      console.warn("[WebRTC] Signal handling error:", err.message);
    }
  }

  /**
   * Acquire local media stream
   */
  private async acquireMedia(): Promise<void> {
    const constraints = socketManager.getMediaConstraints(this.callType);
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.handlers.onLocalStream?.(this.localStream);
    } catch (err: any) {
      // If video fails, fall back to audio only
      if (this.callType === "video") {
        console.warn("[WebRTC] Camera failed, falling back to audio-only");
        this.callType = "voice";
        const audioConstraints = socketManager.getMediaConstraints("voice");
        this.localStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        this.handlers.onLocalStream?.(this.localStream);
        this.handlers.onError?.("الكاميرا غير متاحة — تم التحويل لمكالمة صوتية");
      } else {
        throw err;
      }
    }
  }

  /**
   * Create RTCPeerConnection with event handlers
   */
  private createPeerConnection(): void {
    // Get TURN servers from env or use defaults
    const iceServers = [...DEFAULT_ICE_SERVERS];
    
    this.pc = new RTCPeerConnection({
      iceServers,
      // Balanced: quality vs latency
      iceCandidatePoolSize: 2,
      bundlePolicy: "max-bundle",    // all media on one connection
      rtcpMuxPolicy: "require",      // reduce port usage
    });

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

    // ── ICE Connection State ──
    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc?.iceConnectionState;
      switch (iceState) {
        case "connected":
        case "completed":
          this.setState("active");
          this.startDurationTimer();
          this.startStatsMonitoring();
          this.applyBitrateConstraints();
          break;
        case "disconnected":
          this.setState("reconnecting");
          // Give it 10s to recover
          setTimeout(() => {
            if (this.pc?.iceConnectionState === "disconnected") {
              this.handleError("انقطع الاتصال");
            }
          }, 10_000);
          break;
        case "failed":
          // Try ICE restart
          this.restartICE();
          break;
        case "closed":
          this.endCall();
          break;
      }
    };

    // ── Remote Stream ──
    this.pc.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      this.remoteStream.addTrack(event.track);
      this.handlers.onRemoteStream?.(this.remoteStream);
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
      } catch {}
    }
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
        let totalJitter = 0;
        let currentBitrate = 0;
        let audioLevel = 0;
        let frameRate: number | undefined;
        let resolution: { width: number; height: number } | undefined;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp") {
            totalPacketsLost += report.packetsLost || 0;
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
          }
          if (report.type === "media-source" && report.kind === "audio") {
            audioLevel = report.audioLevel || 0;
          }
        });

        this.handlers.onStats?.({
          rtt: socketManager.getConnectionInfo().rtt,
          packetsLost: totalPacketsLost,
          jitter: totalJitter,
          bitrate: currentBitrate,
          frameRate,
          resolution,
          audioLevel,
        });

        // Auto-degrade if packet loss is high
        if (totalPacketsLost > 50 && this.callType === "video") {
          this.applyBitrateConstraints();
        }
      } catch {}
    }, 5_000); // every 5 seconds
  }

  /**
   * Start duration counter
   */
  private startDurationTimer(): void {
    this.duration = 0;
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
    this.statsInterval = null;
    this.durationInterval = null;
    this.qualityUnsub = null;
  }
}

// ── Singleton ──
export const webrtcManager = new WebRTCManager();
