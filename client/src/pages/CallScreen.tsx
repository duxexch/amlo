import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
  Volume2, VolumeX, RotateCcw, Maximize2, Minimize2,
  Coins, Clock, ArrowRight, X, User
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { callsApi } from "@/lib/socialApi";
import { useLocation, useSearch } from "wouter";

type CallStatus = "connecting" | "ringing" | "active" | "ended";

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
      {/* Pulsing ring for ringing state */}
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

function CoinCounter({ rate, duration }: { rate: number; duration: number }) {
  const totalCoins = Math.ceil((duration / 60) * rate);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-4 py-2 rounded-2xl"
    >
      <Coins className="w-4 h-4 text-amber-400" />
      <span className="text-amber-400 text-sm font-bold">{totalCoins}</span>
      <span className="text-amber-400/50 text-[10px] font-medium">({rate}/{" "}دقيقة)</span>
    </motion.div>
  );
}

export function CallScreen() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const userId = params.get("user");
  const callType = (params.get("type") || "voice") as "voice" | "video";

  const [status, setStatus] = useState<CallStatus>("connecting");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mock user data
  const otherUser = {
    id: userId || "u1",
    username: "sara_singer",
    displayName: "سارة المغنية",
    avatar: null,
    level: 28,
    isVerified: true,
  };

  const coinRate = callType === "video"
    ? (pricing?.video_call_rate || 10)
    : (pricing?.voice_call_rate || 5);

  useEffect(() => {
    callsApi.pricing().then(setPricing).catch(() => {});
  }, []);

  // Simulate call lifecycle
  useEffect(() => {
    const connectTimer = setTimeout(() => setStatus("ringing"), 1000);
    const ringTimer = setTimeout(() => {
      setStatus("active");
    }, 4000);
    return () => {
      clearTimeout(connectTimer);
      clearTimeout(ringTimer);
    };
  }, []);

  // Duration counter
  useEffect(() => {
    if (status === "active") {
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const endCall = async () => {
    setStatus("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    if (callId) {
      try { await callsApi.end(callId); } catch {}
    }
    setTimeout(() => navigate("/chat"), 2000);
  };

  const toggleMute = () => setIsMuted(!isMuted);
  const toggleVideo = () => setIsVideoOn(!isVideoOn);
  const toggleSpeaker = () => setIsSpeaker(!isSpeaker);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#0a0a1a] flex flex-col">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between p-4">
        <button onClick={endCall} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
          <ArrowRight className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex items-center gap-2">
          {callType === "video" ? (
            <Video className="w-4 h-4 text-blue-400" />
          ) : (
            <Phone className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-white/60 text-sm font-bold">
            {callType === "video" ? t("social.videoCall") : t("social.voiceCall")}
          </span>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6">
        {/* Avatar */}
        <CallerAvatar user={otherUser} />

        {/* Name */}
        <div className="text-center">
          <h2 className="text-white text-2xl font-black">{otherUser.displayName}</h2>
          <p className="text-white/40 text-sm mt-1">@{otherUser.username}</p>
        </div>

        {/* Status */}
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center"
          >
            {status === "connecting" && (
              <p className="text-white/40 text-sm flex items-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-amber-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                {t("social.connecting")}...
              </p>
            )}
            {status === "ringing" && (
              <p className="text-white/50 text-sm flex items-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                {t("social.ringing")}...
              </p>
            )}
            {status === "active" && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span className="text-2xl font-mono font-bold">{formatDuration(duration)}</span>
                </div>
                <CoinCounter rate={coinRate} duration={duration} />
              </div>
            )}
            {status === "ended" && (
              <div className="text-center">
                <p className="text-white/40 text-sm">{t("social.callEnded")}</p>
                <p className="text-white/60 text-lg font-bold mt-1">{formatDuration(duration)}</p>
                <div className="flex items-center justify-center gap-1 text-amber-400 text-sm mt-2">
                  <Coins className="w-4 h-4" />
                  <span className="font-bold">{Math.ceil((duration / 60) * coinRate)}</span>
                  <span className="text-amber-400/50">{t("social.coinsCharged")}</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      {status !== "ended" && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10 pb-12 pt-6"
        >
          <div className="flex items-center justify-center gap-5">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                isMuted
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-white/8 text-white/60 hover:bg-white/12 border border-white/5"
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* Video Toggle (video calls only) */}
            {callType === "video" && (
              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  !isVideoOn
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-white/8 text-white/60 hover:bg-white/12 border border-white/5"
                }`}
              >
                {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
            )}

            {/* Speaker */}
            <button
              onClick={toggleSpeaker}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                isSpeaker
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-white/8 text-white/60 hover:bg-white/12 border border-white/5"
              }`}
            >
              {isSpeaker ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            {/* End Call */}
            <motion.button
              onClick={endCall}
              whileTap={{ scale: 0.9 }}
              className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] transition-shadow"
            >
              <PhoneOff className="w-7 h-7" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Incoming call popup component
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
        {/* Avatar with pulse */}
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

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base truncate">{caller.displayName}</p>
          <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
            {callType === "video" ? <Video className="w-3.5 h-3.5 text-blue-400" /> : <Phone className="w-3.5 h-3.5 text-emerald-400" />}
            {callType === "video" ? t("social.incomingVideoCall") : t("social.incomingVoiceCall")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onReject}
            className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            <PhoneOff className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onAccept}
            className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.3)]"
          >
            <Phone className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
