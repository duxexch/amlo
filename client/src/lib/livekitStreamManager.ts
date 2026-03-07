/**
 * LiveKit Stream Manager — مدير البث المباشر
 * ════════════════════════════════════════════════
 * Real WebRTC live streaming via LiveKit SFU
 * - Host: publishes audio + video (or audio only)
 * - Speakers: publish audio (audio rooms)
 * - Viewers: subscribe only (watch/listen)
 * - Adaptive quality based on connection
 * - Auto-reconnection on network issues
 */
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  LocalTrack,
  createLocalTracks,
  ConnectionQuality as LKConnectionQuality,
  VideoPresets,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from "livekit-client";

export type StreamRole = "host" | "speaker" | "viewer";
export type StreamState = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";

export interface StreamParticipantInfo {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  connectionQuality: string;
}

export interface LiveKitDebugStats {
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  sampledAt: number;
}

export interface StreamEventHandlers {
  onStateChange: (state: StreamState) => void;
  onRemoteVideoTrack: (track: MediaStreamTrack, participantId: string) => void;
  onRemoteVideoRemoved: (participantId: string) => void;
  onRemoteAudioTrack: (track: MediaStreamTrack, participantId: string) => void;
  onLocalVideoTrack: (track: MediaStreamTrack) => void;
  onLocalAudioTrack: (track: MediaStreamTrack) => void;
  onScreenShareTrack: (track: MediaStreamTrack | null, participantId: string) => void;
  onParticipantJoined: (info: StreamParticipantInfo) => void;
  onParticipantLeft: (participantId: string) => void;
  onActiveSpeakersChanged: (speakerIds: string[]) => void;
  onParticipantCount: (count: number) => void;
  onConnectionQualityChanged: (quality: string, participantId: string) => void;
  onError: (message: string) => void;
}

class LiveKitStreamManager {
  private room: Room | null = null;
  private handlers: Partial<StreamEventHandlers> = {};
  private state: StreamState = "idle";
  private role: StreamRole = "viewer";
  private localVideoTrack: LocalVideoTrack | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private currentVideoQuality: "low" | "medium" | "high" = "medium";

  /**
   * Connect to a LiveKit room
   */
  async connect(
    wsUrl: string,
    token: string,
    role: StreamRole,
    handlers: Partial<StreamEventHandlers>,
    options?: {
      publishVideo?: boolean;
      publishAudio?: boolean;
      videoQuality?: "low" | "medium" | "high";
    }
  ): Promise<void> {
    // Cleanup any previous connection
    this.disconnect();

    this.handlers = handlers;
    this.role = role;
    this.currentVideoQuality = options?.videoQuality ?? "medium";
    this.setState("connecting");

    try {
      // Create room with adaptive settings
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true, // Only send video to subscribers who are receiving
        // Stop publishing when the window is not visible to save bandwidth
        stopLocalTrackOnUnpublish: true,
        disconnectOnPageLeave: true,
      });

      // Setup event listeners
      this.setupRoomListeners();

      // Connect to LiveKit server
      await this.room.connect(wsUrl, token, {
        autoSubscribe: true,
      });

      this.setState("connected");

      // If host or speaker, acquire and publish media
      if (role === "host" || role === "speaker") {
        await this.publishMedia(
          options?.publishVideo ?? (role === "host"),
          options?.publishAudio ?? true,
          options?.videoQuality ?? "medium"
        );
      }

      // Notify about existing participants
      this.room.remoteParticipants.forEach((participant) => {
        this.handleParticipantConnected(participant);
      });

      // Report initial participant count
      this.handlers.onParticipantCount?.(this.room.numParticipants);

    } catch (err: any) {
      console.error("[LiveKit] Connection failed:", err);
      this.handlers.onError?.(err.message || "فشل الاتصال بخادم البث");
      this.setState("failed");
      throw err;
    }
  }

  /**
   * Set up room event listeners
   */
  private setupRoomListeners(): void {
    if (!this.room) return;

    // ── Connection State ──
    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      switch (state) {
        case ConnectionState.Connected:
          this.setState("connected");
          break;
        case ConnectionState.Reconnecting:
          this.setState("reconnecting");
          break;
        case ConnectionState.Disconnected:
          this.setState("disconnected");
          break;
      }
    });

    // ── Participant Events ──
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      this.handleParticipantConnected(participant);
      this.handlers.onParticipantCount?.(this.room?.numParticipants || 0);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      this.handlers.onParticipantLeft?.(participant.identity);
      this.handlers.onParticipantCount?.(this.room?.numParticipants || 0);
    });

    // ── Track Subscriptions ──
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: any, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          const mediaTrack = track.mediaStreamTrack;
          if (mediaTrack) {
            // Detect screen share vs camera tracks
            if (publication.source === Track.Source.ScreenShare) {
              this.handlers.onScreenShareTrack?.(mediaTrack, participant.identity);
            } else {
              this.handlers.onRemoteVideoTrack?.(mediaTrack, participant.identity);
            }
          }
        } else if (track.kind === Track.Kind.Audio) {
          // Audio tracks are automatically played by LiveKit
          const mediaTrack = track.mediaStreamTrack;
          if (mediaTrack) {
            this.handlers.onRemoteAudioTrack?.(mediaTrack, participant.identity);
          }
          // Attach audio element for playback
          track.attach();
        }
      }
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (track: any, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          if (_publication.source === Track.Source.ScreenShare) {
            this.handlers.onScreenShareTrack?.(null, participant.identity);
          } else {
            this.handlers.onRemoteVideoRemoved?.(participant.identity);
          }
        }
        track.detach();
      }
    );

    // ── Active Speakers ──
    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
      const speakerIds = speakers.map((s: any) => s.identity);
      this.handlers.onActiveSpeakersChanged?.(speakerIds);
    });

    // ── Connection Quality ──
    this.room.on(
      RoomEvent.ConnectionQualityChanged,
      (quality: LKConnectionQuality, participant: any) => {
        const qualityStr = quality === LKConnectionQuality.Excellent ? "excellent"
          : quality === LKConnectionQuality.Good ? "good"
            : quality === LKConnectionQuality.Poor ? "poor"
              : "unknown";
        this.handlers.onConnectionQualityChanged?.(qualityStr, participant.identity);
      }
    );

    // ── Reconnection ──
    this.room.on(RoomEvent.Reconnecting, () => {
      this.setState("reconnecting");
    });

    this.room.on(RoomEvent.Reconnected, () => {
      this.setState("connected");
    });

    // ── Disconnection ──
    this.room.on(RoomEvent.Disconnected, () => {
      this.setState("disconnected");
    });
  }

  /**
   * Handle a participant connecting - subscribe to their tracks
   */
  private handleParticipantConnected(participant: RemoteParticipant): void {
    const info: StreamParticipantInfo = {
      id: participant.identity,
      name: participant.name || participant.identity,
      isSpeaking: participant.isSpeaking,
      isMuted: !participant.isMicrophoneEnabled,
      hasVideo: participant.isCameraEnabled,
      connectionQuality: participant.connectionQuality === LKConnectionQuality.Excellent ? "excellent"
        : participant.connectionQuality === LKConnectionQuality.Good ? "good"
          : "poor",
    };
    this.handlers.onParticipantJoined?.(info);

    // Handle already subscribed tracks
    participant.trackPublications.forEach((publication) => {
      if (publication.isSubscribed && publication.track) {
        const track = publication.track;
        if (track.kind === Track.Kind.Video) {
          const mediaTrack = track.mediaStreamTrack;
          if (mediaTrack) {
            this.handlers.onRemoteVideoTrack?.(mediaTrack, participant.identity);
          }
        } else if (track.kind === Track.Kind.Audio) {
          track.attach();
        }
      }
    });
  }

  /**
   * Publish local media tracks
   */
  private async publishMedia(
    publishVideo: boolean,
    publishAudio: boolean,
    videoQuality: "low" | "medium" | "high"
  ): Promise<void> {
    if (!this.room) return;

    try {
      const tracks = await createLocalTracks({
        audio: publishAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
        video: publishVideo ? {
          resolution: videoQuality === "high" ? VideoPresets.h720.resolution
            : videoQuality === "medium" ? VideoPresets.h540.resolution
              : VideoPresets.h360.resolution,
          facingMode: "user",
        } : false,
      });

      for (const track of tracks) {
        await this.room.localParticipant.publishTrack(track, {
          // Simulcast for video — send multiple quality layers
          simulcast: track.kind === Track.Kind.Video,
        });

        if (track.kind === Track.Kind.Video) {
          this.localVideoTrack = track as LocalVideoTrack;
          const mediaTrack = track.mediaStreamTrack;
          if (mediaTrack) {
            this.handlers.onLocalVideoTrack?.(mediaTrack);
          }
        } else if (track.kind === Track.Kind.Audio) {
          this.localAudioTrack = track as LocalAudioTrack;
          const mediaTrack = track.mediaStreamTrack;
          if (mediaTrack) {
            this.handlers.onLocalAudioTrack?.(mediaTrack);
          }
        }
      }

      this.currentVideoQuality = videoQuality;
    } catch (err: any) {
      console.error("[LiveKit] Media publish failed:", err);
      // Try audio-only fallback if video fails
      if (publishVideo) {
        this.handlers.onError?.("الكاميرا غير متاحة — تم التحويل للصوت فقط");
        await this.publishMedia(false, publishAudio, videoQuality);
        return;
      }
      this.handlers.onError?.(err.message || "فشل في الوصول للميكروفون");
    }
  }

  /**
   * Update published camera quality without reconnecting the room.
   */
  async setVideoQuality(quality: "low" | "medium" | "high"): Promise<boolean> {
    if (!this.localVideoTrack) return false;
    if (this.currentVideoQuality === quality) return true;

    try {
      const resolution = quality === "high"
        ? VideoPresets.h720.resolution
        : quality === "medium"
          ? VideoPresets.h540.resolution
          : VideoPresets.h360.resolution;

      await this.localVideoTrack.restartTrack({
        resolution,
        facingMode: "user",
      });

      this.currentVideoQuality = quality;
      return true;
    } catch (err: any) {
      console.warn("[LiveKit] Failed to switch video quality:", err);
      this.handlers.onError?.("تعذر تغيير جودة الفيديو");
      return false;
    }
  }

  getVideoQuality(): "low" | "medium" | "high" {
    return this.currentVideoQuality;
  }

  /**
   * Best-effort WebRTC transport stats from LiveKit peer connection internals.
   */
  async getWebRtcStats(): Promise<LiveKitDebugStats | null> {
    if (!this.room) return null;

    try {
      const roomInternal = this.room as any;
      const publisherPc: RTCPeerConnection | undefined = roomInternal?.engine?.pcManager?.publisher?.pc;
      const subscriberPc: RTCPeerConnection | undefined = roomInternal?.engine?.pcManager?.subscriber?.pc;
      const pc = publisherPc || subscriberPc;
      if (!pc?.getStats) return null;

      const stats = await pc.getStats();
      let rttMs: number | null = null;
      let jitterMs: number | null = null;
      let packetsLost = 0;
      let packetsTotal = 0;

      stats.forEach((report: any) => {
        if (report.type === "remote-inbound-rtp" && typeof report.roundTripTime === "number") {
          const remoteRtt = report.roundTripTime * 1000;
          if (Number.isFinite(remoteRtt)) {
            rttMs = rttMs === null ? remoteRtt : Math.max(rttMs, remoteRtt);
          }
        }

        if (report.type === "candidate-pair" && report.state === "succeeded" && typeof report.currentRoundTripTime === "number") {
          const candidateRtt = report.currentRoundTripTime * 1000;
          if (Number.isFinite(candidateRtt) && rttMs === null) {
            rttMs = candidateRtt;
          }
        }

        if (report.type === "inbound-rtp" || report.type === "outbound-rtp") {
          const lost = typeof report.packetsLost === "number" ? report.packetsLost : 0;
          const received = typeof report.packetsReceived === "number" ? report.packetsReceived : 0;
          const sent = typeof report.packetsSent === "number" ? report.packetsSent : 0;
          packetsLost += Math.max(0, lost);
          packetsTotal += Math.max(0, received + sent + lost);

          if (typeof report.jitter === "number") {
            const candidateJitter = report.jitter * 1000;
            if (Number.isFinite(candidateJitter)) {
              jitterMs = jitterMs === null ? candidateJitter : Math.max(jitterMs, candidateJitter);
            }
          }
        }
      });

      const packetLossPct = packetsTotal > 0
        ? Math.min(100, Math.max(0, (packetsLost / packetsTotal) * 100))
        : null;

      return {
        rttMs,
        jitterMs,
        packetLossPct,
        sampledAt: Date.now(),
      };
    } catch (err) {
      console.warn("[LiveKit] Failed reading WebRTC stats:", err);
      return null;
    }
  }

  // ── Controls ──

  /**
   * Toggle microphone mute/unmute
   * @returns true if now muted
   */
  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;
    const enabled = this.room.localParticipant.isMicrophoneEnabled;
    await this.room.localParticipant.setMicrophoneEnabled(!enabled);
    return enabled; // was enabled → now muted
  }

  /**
   * Toggle camera on/off
   * @returns true if now off
   */
  async toggleCamera(): Promise<boolean> {
    if (!this.room?.localParticipant) return true;
    const enabled = this.room.localParticipant.isCameraEnabled;
    await this.room.localParticipant.setCameraEnabled(!enabled);
    return enabled; // was enabled → now off
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(): Promise<void> {
    if (!this.localVideoTrack) return;
    try {
      const devices = await Room.getLocalDevices("videoinput");
      if (devices.length <= 1) return;
      // Cycle through devices
      const currentDeviceId = this.localVideoTrack.mediaStreamTrack?.getSettings()?.deviceId;
      const currentIdx = devices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIdx = (currentIdx + 1) % devices.length;
      await this.localVideoTrack.setDeviceId(devices[nextIdx].deviceId);
    } catch (err: any) {
      console.warn("[LiveKit] Camera switch failed:", err);
    }
  }

  /**
   * Get microphone mute state
   */
  isMicMuted(): boolean {
    return !this.room?.localParticipant?.isMicrophoneEnabled;
  }

  /**
   * Get camera state
   */
  isCameraOff(): boolean {
    return !this.room?.localParticipant?.isCameraEnabled;
  }

  /**
   * Get current participant count
   */
  getParticipantCount(): number {
    return this.room?.numParticipants || 0;
  }

  /**
   * Get current state
   */
  getState(): StreamState {
    return this.state;
  }

  /**
   * Get local participant
   */
  getLocalParticipant(): LocalParticipant | undefined {
    return this.room?.localParticipant;
  }

  /**
   * Get all remote participants
   */
  getRemoteParticipants(): Map<string, RemoteParticipant> {
    return this.room?.remoteParticipants || new Map();
  }

  /**
   * Get local video MediaStreamTrack
   */
  getLocalVideoTrack(): MediaStreamTrack | null {
    return this.localVideoTrack?.mediaStreamTrack || null;
  }

  /**
   * Get remote video tracks as array of {track, participantId}
   */
  getRemoteVideoTracks(): Array<{ track: MediaStreamTrack; participantId: string }> {
    const result: Array<{ track: MediaStreamTrack; participantId: string }> = [];
    if (!this.room) return result;
    this.room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (pub.isSubscribed && pub.track && pub.track.kind === Track.Kind.Video) {
          const mt = pub.track.mediaStreamTrack;
          if (mt) result.push({ track: mt, participantId: participant.identity });
        }
      });
    });
    return result;
  }

  /**
   * Toggle screen share on/off
   */
  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    if (!this.room?.localParticipant) return;
    await this.room.localParticipant.setScreenShareEnabled(enabled);
  }

  /**
   * Toggle screen share — returns new state
   * @returns true if screen share is now active
   */
  async toggleScreenShare(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;
    const wasSharing = this.room.localParticipant.isScreenShareEnabled;
    await this.room.localParticipant.setScreenShareEnabled(!wasSharing);
    return !wasSharing;
  }

  /**
   * Check if screen share is active
   */
  isScreenSharing(): boolean {
    return this.room?.localParticipant?.isScreenShareEnabled ?? false;
  }

  /**
   * Disconnect from the room and cleanup all resources
   */
  disconnect(): void {
    if (this.room) {
      this.room.disconnect(true);
      this.room = null;
    }
    this.localVideoTrack = null;
    this.localAudioTrack = null;
    this.currentVideoQuality = "medium";
    this.handlers = {};
    this.state = "idle";
    this.role = "viewer";
  }

  private setState(state: StreamState): void {
    if (this.state === state) return;
    this.state = state;
    this.handlers.onStateChange?.(state);
  }
}

// ── Singleton ──
export const livekitStreamManager = new LiveKitStreamManager();
