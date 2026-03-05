import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Heart, UserPlus, Gift, X, Plane, ArrowLeft, Clock, SkipForward, Flag, WifiOff, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import avatarImg from "@/assets/images/avatar-3d.png";
import { COUNTRIES } from "@/lib/countries";

interface ChatMessage {
  id: string;
  type: "text" | "system" | "gift" | "follow" | "friend";
  senderId: string;
  content?: string;
  giftAmount?: number;
  createdAt: string;
  translatedContent?: string;
}

interface MatchedUser {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  country?: string;
  level?: number;
}

interface WorldChatProps {
  sessionId: string;
  currentUserId: string;
  matchedUser: MatchedUser;
  messages: ChatMessage[];
  miles: number;
  onSendMessage: (content: string) => void;
  onFollow: () => void;
  onFriendRequest: () => void;
  onEndSession: () => void;
  onReport: (type: string, reason?: string) => void;
  onSkip: () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onSendGift?: () => void;
  isFollowed?: boolean;
  isFriendRequested?: boolean;
  isPartnerTyping?: boolean;
  partnerDisconnected?: boolean;
  duration: number;
}

const REPORT_REASONS = [
  { type: "harassment", icon: "🚫" },
  { type: "spam", icon: "📢" },
  { type: "inappropriate", icon: "⚠️" },
  { type: "scam", icon: "🎣" },
  { type: "other", icon: "📋" },
];

export function WorldChat({
  sessionId,
  currentUserId,
  matchedUser,
  messages,
  miles,
  onSendMessage,
  onFollow,
  onFriendRequest,
  onEndSession,
  onReport,
  onSkip,
  onTypingStart,
  onTypingStop,
  onSendGift,
  isFollowed,
  isFriendRequested,
  isPartnerTyping,
  partnerDisconnected,
  duration,
}: WorldChatProps) {
  const { t, i18n } = useTranslation();
  const [messageText, setMessageText] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [autoTranslate, setAutoTranslate] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);
  const isAr = i18n.language === "ar";

  const countryData = matchedUser.country ? COUNTRIES.find(c => c.code === matchedUser.country) : null;

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isPartnerTyping]);

  // Auto-translate incoming messages
  useEffect(() => {
    if (!autoTranslate) return;
    const untranslated = messages.filter(
      m => m.type === "text" && m.senderId !== currentUserId && !translatedMessages[m.id]
    );
    if (untranslated.length === 0) return;

    // Translate each message
    for (const msg of untranslated) {
      if (!msg.content) continue;
      translateText(msg.content, i18n.language).then(translated => {
        if (translated && translated !== msg.content) {
          setTranslatedMessages(prev => ({ ...prev, [msg.id]: translated }));
        }
      });
    }
  }, [messages, autoTranslate, currentUserId, i18n.language]);

  const handleSend = () => {
    if (!messageText.trim()) return;
    onSendMessage(messageText.trim());
    setMessageText("");
    onTypingStop();
  };

  const handleInputChange = (value: string) => {
    setMessageText(value);
    // Typing indicator with debounce
    if (value.trim()) {
      onTypingStart();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onTypingStop();
      }, 2000);
    } else {
      onTypingStop();
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getUserColor = (id: string) => {
    const colors = ["#a855f7", "#ec4899", "#10b981", "#06b6d4", "#f59e0b", "#ef4444"];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a1a] flex flex-col">
      {/* Partner disconnected banner */}
      <AnimatePresence>
        {partnerDisconnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-30 bg-red-500/20 border-b border-red-500/30 px-4 py-2 flex items-center gap-2"
          >
            <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-300 text-xs font-medium">{t("world.chat.partnerLeft")}</span>
            <button
              onClick={onSkip}
              className="ms-auto text-xs text-emerald-400 font-bold hover:text-emerald-300"
            >
              {t("world.chat.skipNext")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <div className="relative z-20 bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEndConfirm(true)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-emerald-500/50">
                  <img src={matchedUser.avatar || avatarImg} alt="" className="w-full h-full object-cover" />
                </div>
                {/* Online dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a1a] ${partnerDisconnected ? "bg-gray-400" : "bg-emerald-400"}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-sm">{matchedUser.displayName || matchedUser.username || "مستخدم"}</span>
                  {countryData && <span className="text-xs">{countryData.flag}</span>}
                </div>
                {isPartnerTyping ? (
                  <motion.span
                    className="text-emerald-400 text-[10px] font-medium"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    {t("world.chat.typing")}
                  </motion.span>
                ) : matchedUser.level ? (
                  <span className="bg-gradient-to-r from-primary to-pink-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full">
                    LV.{matchedUser.level}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-translate toggle */}
            <button
              onClick={() => setAutoTranslate(!autoTranslate)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                autoTranslate
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                  : "bg-white/10 text-white/40"
              }`}
              title={t("world.chat.autoTranslate")}
            >
              <Languages className="w-3.5 h-3.5" />
            </button>
            {/* Timer */}
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
              <Clock className="w-3 h-3 text-white/50" />
              <span className="text-white/70 text-xs font-mono font-bold">{formatDuration(duration)}</span>
            </div>
            {/* Miles */}
            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
              <Plane className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-bold">{miles}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 100%)",
        }}
      >
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: i < 20 ? i * 0.02 : 0 }}
          >
            {msg.type === "system" ? (
              <div className="flex items-center gap-2 py-1">
                <span className="text-emerald-400/70 text-xs font-medium">✨ {msg.content}</span>
              </div>
            ) : msg.type === "gift" ? (
              <div className="flex items-center gap-2 py-1">
                <span className="bg-gradient-to-r from-primary/20 to-transparent rounded-full px-3 py-1 text-xs font-bold text-primary">
                  🎁 {msg.content}
                </span>
              </div>
            ) : msg.type === "follow" ? (
              <div className="flex items-center gap-2 py-1">
                <span className="text-pink-400/80 text-xs font-medium">❤️ {msg.content}</span>
              </div>
            ) : msg.type === "friend" ? (
              <div className="flex items-center gap-2 py-1">
                <span className="text-cyan-400/80 text-xs font-medium">👤 {msg.content}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 py-0.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold shrink-0" style={{ color: getUserColor(msg.senderId) }}>
                    {msg.senderId === currentUserId ? t("world.chat.you") : (matchedUser.displayName || "?")}:
                  </span>
                  <span className="text-white/90 text-xs break-words">{msg.content}</span>
                </div>
                {/* Translated text */}
                {translatedMessages[msg.id] && (
                  <span className="text-white/40 text-[10px] italic ms-16 break-words">
                    {translatedMessages[msg.id]}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isPartnerTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 py-1"
            >
              <span className="text-white/30 text-xs">{matchedUser.displayName || "?"}</span>
              <div className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400/60"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons (right side, floating) */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col gap-3">
        {/* Skip / Next */}
        <button
          onClick={onSkip}
          className="w-11 h-11 rounded-full bg-white/10 border border-white/10 text-white/50 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-400 flex items-center justify-center transition-all"
          title={t("world.chat.skipNext")}
        >
          <SkipForward className="w-5 h-5" />
        </button>
        <button
          onClick={onFriendRequest}
          disabled={isFriendRequested}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isFriendRequested
              ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-400"
              : "bg-white/10 border border-white/10 text-white/50 hover:bg-primary/20 hover:border-primary/30 hover:text-primary"
          }`}
        >
          <UserPlus className="w-5 h-5" />
        </button>
        <button
          onClick={onFollow}
          disabled={isFollowed}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isFollowed
              ? "bg-pink-500/20 border border-pink-500/30 text-pink-400"
              : "bg-white/10 border border-white/10 text-white/50 hover:bg-pink-500/20 hover:border-pink-500/30 hover:text-pink-400"
          }`}
        >
          <Heart className={`w-5 h-5 ${isFollowed ? "fill-pink-400" : ""}`} />
        </button>
        <button
          onClick={onSendGift}
          className="w-11 h-11 rounded-full bg-white/10 border border-white/10 text-white/50 hover:bg-yellow-500/20 hover:border-yellow-500/30 hover:text-yellow-400 flex items-center justify-center transition-all"
        >
          <Gift className="w-5 h-5" />
        </button>
        {/* Report */}
        <button
          onClick={() => setShowReportModal(true)}
          className="w-11 h-11 rounded-full bg-white/10 border border-white/10 text-white/50 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 flex items-center justify-center transition-all"
          title={t("world.chat.report")}
        >
          <Flag className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowEndConfirm(true)}
          className="w-11 h-11 rounded-full bg-white/10 border border-white/10 text-white/50 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 flex items-center justify-center transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message Input */}
      <div className="glass-panel px-4 py-3 flex items-center gap-2 z-20">
        <input
          type="text"
          value={messageText}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder={t("world.chat.typeMessage")}
          className="flex-1 bg-white/5 border border-white/10 rounded-full h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
          dir="auto"
        />
        <button
          onClick={handleSend}
          disabled={!messageText.trim()}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-30 disabled:shadow-none transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* End Session Confirm */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEndConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#0c0c1d] border border-white/10 rounded-2xl p-6 max-w-sm mx-4 text-center"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-white font-bold text-lg mb-2">{t("world.chat.endConfirm")}</p>
              <p className="text-white/40 text-sm mb-5">
                {t("world.chat.duration")}: {formatDuration(duration)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 font-bold text-sm hover:bg-white/10"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => { setShowEndConfirm(false); onEndSession(); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/30"
                >
                  {t("world.chat.endSession")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#0c0c1d] border border-white/10 rounded-2xl p-6 max-w-sm mx-4 w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-bold text-lg mb-1 text-center">{t("world.chat.report")}</h3>
              <p className="text-white/40 text-sm mb-4 text-center">{t("world.chat.reportDesc")}</p>
              
              <div className="space-y-2">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.type}
                    onClick={() => {
                      setShowReportModal(false);
                      onReport(r.type);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition-all text-start"
                  >
                    <span className="text-lg">{r.icon}</span>
                    <span className="text-white/80 text-sm font-medium">{t(`world.chat.reportReasons.${r.type}`)}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowReportModal(false)}
                className="w-full mt-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-bold hover:bg-white/10"
              >
                {t("common.cancel")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple auto-translate helper (uses LibreTranslate / fallback)
async function translateText(text: string, targetLang: string): Promise<string | null> {
  try {
    // Use the app's built-in translate API if available
    const res = await fetch("/api/social/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text, targetLang }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.translatedText || data.translatedText || null;
  } catch {
    return null;
  }
}
