/**
 * Call Screen — شاشة المكالمات (WebRTC حقيقي)
 * ════════════════════════════════════════
 * Real WebRTC voice/video calls with:
 * - Adaptive bitrate (auto quality based on connection)
 * - Audio-only fallback for weak connections
 * - Connection quality indicator
 * - Auto-reconnect on ICE failure
 * - Coin tracking
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
  Volume2, VolumeX, Coins, SkipForward,
  WifiOff, Signal, SignalLow, SignalMedium, SignalHigh,
  SwitchCamera
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { callsApi } from "@/lib/socialApi";
import { useLocation, useSearch } from "wouter";
import { webrtcManager, type CallState, type CallStats } from "@/lib/webrtcManager";
import { getSocket } from "@/lib/socketManager";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";

function CallerAvatar({ user }: { user: any }) {
  const colors = ["from-primary to-secondary", "from-cyan-400 to-blue-500", "from-pink-400 to-rose-500", "from-amber-400 to-orange-500"];
  const color = colors[Math.abs((user?.displayName || "").charCodeAt(0)) % colors.length];
  const initial = (user?.displayName || user?.username || "?")[0]?.toUpperCase();

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative"
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/20"
        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/10"
        animate={{ scale: [1, 1.7, 1], opacity: [0.2, 0, 0.2] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      />
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="w-32 h-32 rounded-full object-cover relative z-10 border-4 border-white/10" />
      ) : (
        <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-5xl font-bold text-white relative z-10 border-4 border-white/10`}>
          {initial}
        </div>
      )}
    </motion.div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CoinCounter({ rate, duration, freeMinutesCap = 0 }: { rate: number; duration: number; freeMinutesCap?: number }) {
  const { t } = useTranslation();
  const totalMinutes = Math.ceil(duration / 60);
  const billableMinutes = Math.max(0, totalMinutes - Math.max(0, freeMinutesCap));
  const totalCoins = billableMinutes * rate;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-4 py-2 rounded-2xl"
    >
      <Coins className="w-4 h-4 text-amber-400" />
      <span className="text-amber-400 text-sm font-bold">{totalCoins}</span>
      <span className="text-amber-400/50 text-[10px] font-medium">({rate}/ {t("common.perMinute", "دقيقة")})</span>
      {freeMinutesCap > 0 && (
        <span className="text-emerald-300/70 text-[10px] font-semibold">-{freeMinutesCap}m free</span>
      )}
    </motion.div>
  );
}

// ── Connection quality badge ──
function QualityBadge({ quality, stats }: { quality: string; stats: CallStats | null }) {
  const getIcon = () => {
    switch (quality) {
      case "excellent": return <SignalHigh className="w-3.5 h-3.5" />;
      case "good": return <SignalMedium className="w-3.5 h-3.5" />;
      case "fair": return <SignalLow className="w-3.5 h-3.5" />;
      case "poor": return <WifiOff className="w-3.5 h-3.5" />;
      default: return <Signal className="w-3.5 h-3.5" />;
    }
  };
  const getColor = () => {
    switch (quality) {
      case "excellent": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "good": return "text-green-400 bg-green-400/10 border-green-400/20";
      case "fair": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      case "poor": return "text-red-400 bg-red-400/10 border-red-400/20";
      default: return "text-white/40 bg-white/5 border-white/10";
    }
  };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${getColor()}`}>
      {getIcon()}
      {stats?.bitrate ? `${Math.round(stats.bitrate)}kbps` : quality}
    </div>
  );
}

export function CallScreen() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const userId = params.get("user");
  const callType = (params.get("type") || "voice") as "voice" | "video";
  const isRandomMatch = params.get("random") === "1";
  const sessionId = params.get("session");
  const isIncoming = params.get("incoming") === "1";
  const conn = useConnectionQuality();

  const [status, setStatus] = useState<CallState>("connecting");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [currentCallType, setCurrentCallType] = useState(callType);
  const [callId, setCallId] = useState<string | null>(sessionId);
  const [pricing, setPricing] = useState<any>(null);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chargedCoins, setChargedCoins] = useState<number | null>(null);
  const [freeMinutesCap, setFreeMinutesCap] = useState(0);
  const [freeCallApplied, setFreeCallApplied] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState(conn.quality);
  const [otherUser, setOtherUser] = useState<{
    id: string; username: string; displayName: string;
    avatar: string | null; level: number; isVerified: boolean;
  } | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringbackRef = useRef<{ osc: OscillatorNode; gain: GainNode; ctx: AudioContext; interval: ReturnType<typeof setInterval> } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // ── Pre-check media permissions before any call setup ──
  useEffect(() => {
    let cancelled = false;
    const checkPermissions = async () => {
      try {
        // On modern Android (13+), check via Permissions API first for clear denied state
        if (navigator.permissions) {
          const micPerm = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (micPerm.state === "denied") {
            if (cancelled) return;
            setPermissionDenied(true);
            setErrorMsg(t("permissions.micDeniedSettings", "تم رفض إذن الميكروفون. يرجى تفعيله من إعدادات المتصفح ثم المحاولة مجدداً"));
            setStatus("failed");
            return;
          }
        }

        const constraints: MediaStreamConstraints = callType === "video"
          ? { audio: true, video: true }
          : { audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach(t => t.stop());
      } catch (err: any) {
        if (cancelled) return;
        // If video fails, try audio only for video calls (camera might be unavailable)
        if (callType === "video") {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getTracks().forEach(t => t.stop());
            // Audio works — camera issue handled later by webrtcManager fallback
            return;
          } catch { /* fall through to denied */ }
        }
        setPermissionDenied(true);
        const isDenied = err?.name === "NotAllowedError";
        setErrorMsg(isDenied
          ? t("permissions.micDeniedSettings", "تم رفض إذن الميكروفون. يرجى تفعيله من إعدادات المتصفح ثم المحاولة مجدداً")
          : t("permissions.micDenied", "يرجى السماح بالوصول للميكروفون لإجراء المكالمة")
        );
        setStatus("failed");
      }
    };
    checkPermissions();
    return () => { cancelled = true; };
  }, [callType, t]);

  // Ringback tone for the caller while ringing
  useEffect(() => {
    if (isIncoming) return; // Only for caller
    if (status !== "ringing") {
      // Stop ringback when no longer ringing
      if (ringbackRef.current) {
        const rb = ringbackRef.current;
        clearInterval(rb.interval);
        rb.osc.stop();
        rb.ctx.close().catch(() => { });
        ringbackRef.current = null;
      }
      return;
    }

    // Generate ringback tone pattern (1s on, 3s off)
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(425, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    // Toggle on/off pattern
    let on = true;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    const interval = setInterval(() => {
      on = !on;
      gain.gain.setValueAtTime(on ? 0.06 : 0, ctx.currentTime);
    }, on ? 1000 : 3000);
    // More accurate: 1s on, 3s off cycle
    clearInterval(interval);
    let phase = 0;
    const ringInterval = setInterval(() => {
      phase = (phase + 1) % 4;
      gain.gain.setValueAtTime(phase === 0 ? 0.06 : 0, ctx.currentTime);
    }, 1000);

    ringbackRef.current = { osc, gain, ctx, interval: ringInterval };

    return () => {
      clearInterval(ringInterval);
      osc.stop();
      ctx.close().catch(() => { });
      ringbackRef.current = null;
    };
  }, [status, isIncoming]);

  // Load matched user info for random calls
  useEffect(() => {
    if (!userId) return;
    // Try to get user info from socket event or fetch
    const socket = getSocket();
    const handleUserInfo = (data: any) => {
      if (data.userId === userId) {
        setOtherUser({
          id: data.userId,
          username: data.username || "user",
          displayName: data.displayName || data.username || "مستخدم",
          avatar: data.avatar || null,
          level: data.level || 1,
          isVerified: data.isVerified || false,
        });
      }
    };
    socket.on("call-user-info", handleUserInfo);

    // Fallback: set basic info from URL
    if (!otherUser) {
      setOtherUser({
        id: userId,
        username: "user",
        displayName: "مستخدم",
        avatar: null,
        level: 1,
        isVerified: false,
      });
    }

    // For random matches, listen for matched user info from the match event
    if (isRandomMatch) {
      const handleMatchedInfo = (data: any) => {
        setOtherUser({
          id: data.matchedUser?.id || userId,
          username: data.matchedUser?.username || "user",
          displayName: data.matchedUser?.displayName || "مستخدم",
          avatar: data.matchedUser?.avatar || null,
          level: data.matchedUser?.level || 1,
          isVerified: false,
        });
      };
      socket.on("random-match-found", handleMatchedInfo);
      return () => {
        socket.off("call-user-info", handleUserInfo);
        socket.off("random-match-found", handleMatchedInfo);
      };
    }

    return () => { socket.off("call-user-info", handleUserInfo); };
  }, [userId, isRandomMatch]);

  useEffect(() => {
    callsApi.pricing().then(setPricing).catch(() => { });
  }, []);

  // Ensure outgoing calls are created on server to trigger incoming-call notification.
  // Caller does NOT start WebRTC yet — waits for receiver to accept first.
  useEffect(() => {
    if (!userId || isRandomMatch || callId || permissionDenied) return;

    let cancelled = false;
    setStatus("ringing");
    callsApi.initiate(userId, callType)
      .then((call: any) => {
        if (cancelled) return;
        if (call?.id) setCallId(call.id);
        setFreeCallApplied(Boolean(call?.freeCallApplied));
        setFreeMinutesCap(Number(call?.freeMinutesCap || 0));
        if (call?.status === "missed") {
          setErrorMsg(t("social.userOffline", "المستخدم غير متصل حالياً"));
          setStatus("failed");
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setErrorMsg(err?.message || t("social.callStartFailed", "تعذر بدء المكالمة"));
        setStatus("failed");
      });

    return () => { cancelled = true; };
  }, [userId, isRandomMatch, callId, callType, t]);

  // ── Shared WebRTC event handlers (used by both caller and receiver) ──
  const callHandlersRef = useRef<Parameters<typeof webrtcManager.startCall>[2]>({
    onStateChange: (state) => {
      setStatus(state);
      if (state === "ended" || state === "failed") {
        setTimeout(() => navigate("/chat"), 2500);
      }
    },
    onLocalStream: (stream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      // Sync isVideoOn with actual track state after acquireMedia fallback
      const hasVideo = stream.getVideoTracks().some(t => t.enabled);
      setIsVideoOn(hasVideo);
      if (hasVideo) setCurrentCallType("video");
    },
    onRemoteStream: (stream) => {
      if (callType === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(() => { });
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => { });
      }
    },
    onStats: setCallStats,
    onQualityChange: setConnectionQuality,
    onError: (err) => {
      setErrorMsg(err);
      setTimeout(() => setErrorMsg(null), 5000);
    },
    onDurationTick: setDuration,
  });

  // Use a ref so socket handlers always see the latest callId without re-mounting
  const callIdRef = useRef(callId);
  callIdRef.current = callId;

  // ── Unified socket listener: signaling + call lifecycle events ──
  // Merged into ONE effect to eliminate race conditions between separate effects.
  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();
    let incomingOfferHandled = false;

    // ── WebRTC signaling ──
    const handleSignal = (data: { callId: string; senderId: string; signal: any }) => {
      if (data.senderId !== userId) return;

      // Incoming call: wait for the caller's offer, then acceptCall
      if (isIncoming && !incomingOfferHandled && data.signal?.type === "offer") {
        incomingOfferHandled = true;
        webrtcManager.acceptCall(
          callIdRef.current || data.callId,
          userId,
          callType,
          { type: "offer", sdp: data.signal.sdp },
          callHandlersRef.current,
        );
        return;
      }

      // All other signals (answer, ICE candidates)
      webrtcManager.handleSignal(data.signal);
    };

    // ── Outgoing call: start WebRTC when receiver accepts ──
    const onCallAnswered = (data: { callId: string }) => {
      const cid = callIdRef.current;
      if (!cid || data?.callId !== cid || isIncoming) return;
      webrtcManager.startCall(userId, callType, callHandlersRef.current, cid);
    };

    const onCallRejected = (data: { callId: string; reason?: string; message?: string }) => {
      const cid = callIdRef.current;
      if (!cid || data?.callId !== cid) return;
      setErrorMsg(data?.message || t("social.callRejected", "تم رفض المكالمة"));
      webrtcManager.endCall();
      setStatus("ended");
      setTimeout(() => navigate("/chat"), 1500);
    };

    const onCallEnded = (data: { callId: string; coinsCharged?: number; reason?: string; message?: string }) => {
      const cid = callIdRef.current;
      if (!cid || data?.callId !== cid) return;
      if (typeof data?.coinsCharged === "number") setChargedCoins(data.coinsCharged);
      if (data?.reason === "balance_exhausted") {
        setErrorMsg(data?.message || t("social.callEndedNoBalance", "انتهى الرصيد وتم إنهاء المكالمة"));
      }
      webrtcManager.endCall();
      setStatus("ended");
      setTimeout(() => navigate("/chat"), 1200);
    };

    const onCallBalanceWarning = (data: { callId: string; secondsRemaining?: number; message?: string }) => {
      const cid = callIdRef.current;
      if (!cid || data?.callId !== cid) return;
      setErrorMsg(data?.message || t("social.callBalanceWarning", "تنبيه: رصيد المكالمة سينتهي قريباً"));
    };

    const onCallTimeout = (data: { callId: string }) => {
      const cid = callIdRef.current;
      if (!cid || data?.callId !== cid) return;
      setErrorMsg(t("social.noReply", "لا رد"));
      webrtcManager.endCall();
      setStatus("ended");
      setTimeout(() => navigate("/chat"), 2000);
    };

    // Register ALL listeners at once — no race condition
    socket.on("call-signal", handleSignal);
    socket.on("call-answered", onCallAnswered);
    socket.on("call-rejected", onCallRejected);
    socket.on("call-ended", onCallEnded);
    socket.on("call-timeout", onCallTimeout);
    socket.on("call-balance-warning", onCallBalanceWarning);

    // Incoming call: POST /answer now that signal listener is ready
    if (isIncoming && callId) {
      setStatus("connecting");
      callsApi.answer(callId).catch((err: any) => {
        setErrorMsg(err?.message || t("social.callAcceptFailed", "تعذر قبول المكالمة"));
        setStatus("failed");
      });
    }

    return () => {
      socket.off("call-signal", handleSignal);
      socket.off("call-answered", onCallAnswered);
      socket.off("call-rejected", onCallRejected);
      socket.off("call-ended", onCallEnded);
      socket.off("call-timeout", onCallTimeout);
      socket.off("call-balance-warning", onCallBalanceWarning);
      webrtcManager.endCall();
    };
  }, [userId, callType, isIncoming, navigate, t]);

  // ── Cleanup on tab close / navigation ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      webrtcManager.endCall();
      if (callId) {
        // Use sendBeacon for reliable delivery during page unload
        navigator.sendBeacon(`/api/social/calls/${callId}/end`, JSON.stringify({}));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [callId]);

  const endCall = async () => {
    webrtcManager.endCall();
    if (isRandomMatch) {
      const socket = getSocket();
      socket.emit("random-match-end");
    }
    if (callId) {
      try {
        const ended: any = await callsApi.end(callId);
        const serverCoins = Number(ended?.coinsCharged);
        if (Number.isFinite(serverCoins)) setChargedCoins(serverCoins);
      } catch { }
    }
    setStatus("ended");
    setTimeout(() => navigate("/chat"), 1500);
  };

  const handleNext = () => {
    webrtcManager.endCall();
    const socket = getSocket();
    socket.emit("random-match-next");
    // Navigate back to home, the matching screen will re-open
    navigate("/");
  };

  const toggleMute = () => {
    const muted = webrtcManager.toggleMute();
    setIsMuted(muted);
  };

  const toggleVideo = async () => {
    // If no video track exists, try to acquire camera
    const hasVideo = webrtcManager.hasVideoTrack();
    if (!hasVideo) {
      try {
        await webrtcManager.addVideoTrack();
        setIsVideoOn(true);
        setCurrentCallType("video");
      } catch {
        setErrorMsg(t("permissions.cameraDenied", "تعذر الوصول للكاميرا"));
        setTimeout(() => setErrorMsg(null), 3000);
      }
      return;
    }
    const off = webrtcManager.toggleVideo();
    setIsVideoOn(!off);
  };

  const toggleSpeaker = () => setIsSpeaker(!isSpeaker);

  const handleSwitchCamera = async () => {
    const facing = await webrtcManager.switchCamera();
    setIsFrontCamera(facing === "user");
  };

  const switchToVoice = () => {
    // Disable video track and switch UI to voice mode
    const off = webrtcManager.toggleVideo();
    if (!off) webrtcManager.toggleVideo(); // ensure video is off
    setIsVideoOn(false);
    setCurrentCallType("voice");
  };

  const switchToVideo = async () => {
    try {
      const hasVideo = webrtcManager.hasVideoTrack();
      if (!hasVideo) {
        await webrtcManager.addVideoTrack();
      } else {
        const off = webrtcManager.toggleVideo();
        if (off) webrtcManager.toggleVideo(); // ensure video is on
      }
      setIsVideoOn(true);
      setCurrentCallType("video");
    } catch {
      setErrorMsg(t("permissions.cameraDenied", "تعذر الوصول للكاميرا"));
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const coinRate = currentCallType === "video"
    ? (pricing?.video_call_rate || 10)
    : (pricing?.voice_call_rate || 5);

  const isVideoActive = currentCallType === "video" && isVideoOn && status === "active";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ── Full-screen remote video ── */}
      {currentCallType === "video" && status === "active" && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover z-0" />
      )}

      {/* ── Voice-only / pre-connect background ── */}
      {!(currentCallType === "video" && status === "active") && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#0a0a1a]">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* ── Top overlay: timer + quality + coins ── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2 safe-area-top">
        <div className="flex items-center gap-2">
          {currentCallType === "video" ? <Video className="w-4 h-4 text-blue-400" /> : <Phone className="w-4 h-4 text-emerald-400" />}
          <span className="text-white/70 text-xs font-bold backdrop-blur-sm">
            {currentCallType === "video" ? t("social.videoCall") : t("social.voiceCall")}
          </span>
        </div>

        {status === "active" && (
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <span className="text-white text-sm font-mono font-bold">{formatDuration(duration)}</span>
          </div>
        )}

        <QualityBadge quality={connectionQuality} stats={callStats} />
      </div>

      {/* Coins counter — active calls */}
      {status === "active" && (
        <div className="relative z-10 flex justify-center">
          <CoinCounter rate={coinRate} duration={duration} freeMinutesCap={freeCallApplied ? freeMinutesCap : 0} />
        </div>
      )}

      {/* ── Error toast ── */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 mx-4 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-amber-400 text-xs text-center backdrop-blur-sm"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Local video PIP (small window) ── */}
      {isVideoActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-20 right-4 z-20 w-[110px] h-[155px] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
        >
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
          />
        </motion.div>
      )}

      {/* ── Center content (pre-connect / voice states) ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4">
        {/* Show avatar when not in active video */}
        {!isVideoActive && (
          <>
            <CallerAvatar user={otherUser || { displayName: "...", username: "..." }} />
            <div className="text-center">
              <h2 className="text-white text-2xl font-black drop-shadow-lg">{otherUser?.displayName || "..."}</h2>
              <p className="text-white/40 text-sm mt-1">@{otherUser?.username || "..."}</p>
            </div>
          </>
        )}

        {/* Status indicators */}
        <AnimatePresence mode="wait">
          <motion.div key={status} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center">
            {status === "connecting" && (
              <p className="text-white/40 text-sm flex items-center gap-2">
                <motion.div className="w-2 h-2 rounded-full bg-amber-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                {t("social.connecting")}...
              </p>
            )}
            {status === "ringing" && (
              <p className="text-white/50 text-sm flex items-center gap-2">
                <motion.div className="w-2 h-2 rounded-full bg-primary" animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                {t("social.ringing")}...
              </p>
            )}
            {status === "reconnecting" && (
              <p className="text-amber-400 text-sm flex items-center gap-2">
                <motion.div className="w-2 h-2 rounded-full bg-amber-400" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                {t("social.reconnecting", "إعادة الاتصال...")}
              </p>
            )}
            {(status === "ended" || status === "failed") && (
              <div className="text-center">
                <p className="text-white/40 text-sm">{status === "failed" ? t("social.callFailed", "فشل الاتصال") : t("social.callEnded")}</p>
                <p className="text-white/60 text-lg font-bold mt-1">{formatDuration(duration)}</p>
                <div className="flex items-center justify-center gap-1 text-amber-400 text-sm mt-2">
                  <Coins className="w-4 h-4" />
                  <span className="font-bold">{chargedCoins ?? (Math.max(0, Math.ceil(duration / 60) - (freeCallApplied ? freeMinutesCap : 0)) * coinRate)}</span>
                  <span className="text-amber-400/50">{t("social.coinsCharged")}</span>
                </div>
                {freeCallApplied && (
                  <p className="text-emerald-300/60 text-[11px] mt-1">{t("social.freeCallApplied", "تم تطبيق المكالمة المجانية")}</p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Controls — single horizontal row at bottom ── */}
      {status !== "ended" && status !== "failed" && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10 pb-10 pt-4 safe-area-bottom"
        >
          <div className="flex items-center justify-center gap-3 px-4">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all backdrop-blur-md ${isMuted ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/10 text-white/70 border border-white/10"
                }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Flip camera (video calls only) */}
            {currentCallType === "video" && isVideoOn && (
              <button
                onClick={handleSwitchCamera}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 text-white/70 border border-white/10 backdrop-blur-md transition-all"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {/* Speaker */}
            <button
              onClick={toggleSpeaker}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all backdrop-blur-md ${isSpeaker ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/10 text-white/70 border border-white/10"
                }`}
            >
              {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Toggle video on/off */}
            <button
              onClick={currentCallType === "video" && isVideoOn ? switchToVoice : switchToVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all backdrop-blur-md ${currentCallType === "video" && isVideoOn
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-white/10 text-white/70 border border-white/10"
                }`}
              title={currentCallType === "video" && isVideoOn ? t("social.switchToVoice", "تحويل لصوتية") : t("social.switchToVideo", "تحويل لفيديو")}
            >
              {currentCallType === "video" && isVideoOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* End call */}
            <motion.button
              onClick={endCall}
              whileTap={{ scale: 0.9 }}
              className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-shadow"
            >
              <PhoneOff className="w-6 h-6" />
            </motion.button>

            {/* Next (random matches only) */}
            {isRandomMatch && (
              <motion.button
                onClick={handleNext}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center transition-all"
                title={t("matching.nextPerson")}
              >
                <SkipForward className="w-5 h-5" />
              </motion.button>
            )}
          </div>

          {connectionQuality === "poor" && currentCallType === "video" && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-amber-400/60 text-[10px] mt-3">
              {t("social.weakConnection", "⚡ الاتصال ضعيف — الفيديو مخفض تلقائياً")}
            </motion.p>
          )}
        </motion.div>
      )}
    </div>
  );
}
export function IncomingCallPopup({ caller, callType, onAccept, onReject }: {
  caller: { displayName: string; username: string; avatar?: string };
  callType: "voice" | "video";
  onAccept: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const colors = ["from-primary to-secondary", "from-cyan-400 to-blue-500", "from-pink-400 to-rose-500"];
  const color = colors[Math.abs((caller.displayName || "").charCodeAt(0)) % colors.length];

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-4 left-4 right-4 z-[100] glass-panel rounded-3xl p-5 border border-primary/20 shadow-[0_0_40px_rgba(var(--primary-rgb),0.15)]"
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-2xl bg-primary/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-2xl font-bold text-white relative z-10`}>
            {(caller.displayName || "?")[0]?.toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base truncate">{caller.displayName}</p>
          <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
            {callType === "video" ? <Video className="w-3.5 h-3.5 text-blue-400" /> : <Phone className="w-3.5 h-3.5 text-emerald-400" />}
            {callType === "video" ? t("social.incomingVideoCall") : t("social.incomingVoiceCall")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onReject} className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <PhoneOff className="w-5 h-5" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onAccept} className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.3)]">
            <Phone className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
