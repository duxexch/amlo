/**
 * ChatPopupModal — نافذة الدردشة المنبثقة
 * ════════════════════════════════════════
 * Full-featured chat modal with:
 * - Reply to message, Reactions, Copy/Delete
 * - Emoji picker, In-conversation search
 * - Infinite scroll, Sound notifications
 * - Online/last-seen, Typing indicator
 */
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Search, Send, Phone, Video,
  Check, CheckCheck, Clock, Coins, Loader2,
  MoreVertical, Trash2, X, ShieldCheck, Flag,
  Ban, Lock, Unlock, Languages, Reply, Copy,
  SmilePlus, Smile, Image, Mic, ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useActiveChat, useReportModal, useMessageTranslation } from "./chatHooks";
import type { ChatMessage, Conversation, ChatSettings } from "./chatTypes";
import { chatApi } from "@/lib/socialApi";
import { UserAvatar } from "@/components/UserAvatar";
import { formatTime } from "@/lib/timeUtils";

// ── Common emojis ──
const EMOJI_CATEGORIES = [
  { icon: "😀", label: "وجوه", emojis: ["😀","😂","😍","🥰","😎","😊","🤣","😭","😱","🤩","😢","😡","🤔","😏","😴","🥺","😤","🫡","🤗","😇","🙃","😜","🤭","😬","🥴"] },
  { icon: "❤️", label: "رموز", emojis: ["❤️","🔥","💯","✨","💀","⭐","💫","🌈","💐","🏆","🎯","💎","🪄","🫶","💕","💖","💝","❤️‍🔥","🖤","💙"] },
  { icon: "👍", label: "إيماءات", emojis: ["👍","👏","💪","🙏","✌️","🤝","👋","🫰","🤙","👊","✊","🤞","🤟","🫵","☝️","👆","👇","👉","👈","🤌"] },
  { icon: "🎉", label: "أنشطة", emojis: ["🎉","🎊","🎁","🎂","🎈","🎵","🎶","🎮","⚽","🏀","🎲","🎯","🎪","🎭","🎤","🎧","🎸","🎺","🎻","🪘"] },
  { icon: "🍔", label: "طعام", emojis: ["🍔","🍕","🍟","🌮","🍣","🍩","🍪","🍰","☕","🧃","🍫","🍭","🍿","🥤","🧁","🍦","🍜","🥙","🍗","🥗"] },
  { icon: "🐱", label: "حيوانات", emojis: ["🐱","🐶","🐻","🦁","🐼","🦊","🐸","🐧","🦋","🐝","🐢","🐬","🦄","🐴","🐰","🐨","🐮","🐷","🐵","🦅"] },
];

// ── Message Bubble with full context menu ──
const MessageBubble = memo(function MessageBubble({
  msg, isMe, showAvatar, otherUser, onReport, onReply, onDelete, lang,
}: {
  msg: ChatMessage; isMe: boolean; showAvatar: boolean; otherUser: any;
  onReport: (msg: ChatMessage) => void; onReply: (msg: ChatMessage) => void;
  onDelete: (msgId: string) => void; lang: string;
}) {
  const { t, i18n } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState<Array<{ emoji: string; userId: string; username?: string }>>([]);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const { translatedText, isTranslating, showTranslation, handleTranslate } = useMessageTranslation(msg.content, i18n.language);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Load reactions from API on mount
  useEffect(() => {
    if (msg.isDeleted || msg.id.startsWith("temp-")) return;
    chatApi.getReactions(msg.id).then((res: any) => {
      const data = res?.data || res || [];
      if (Array.isArray(data)) {
        setReactions(data);
        const mine = data.find((r: any) => r.userId === "me" || r.isMine);
        if (mine) setMyReaction(mine.emoji);
      }
    }).catch(() => {});
  }, [msg.id, msg.isDeleted]);

  if (msg.isDeleted) {
    return (
      <div className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
        <div className="w-7 h-7 shrink-0 invisible" />
        <div className="rounded-2xl px-4 py-2.5 bg-white/5 border border-white/5">
          <p className="text-white/30 text-sm italic">{t("chat.messageDeleted", "تم حذف الرسالة")}</p>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    if (msg.content) navigator.clipboard.writeText(msg.content);
    setShowMenu(false);
  };

  const handleReaction = async (emoji: string) => {
    setShowReactions(false);
    const prevReaction = myReaction;
    // Optimistic update
    if (myReaction === emoji) {
      setMyReaction(null);
      setReactions(prev => prev.filter(r => !(r.emoji === emoji && (r.userId === "me" || r.isMine))));
    } else {
      setMyReaction(emoji);
      setReactions(prev => [...prev.filter(r => !(r.userId === "me" || r.isMine)), { emoji, userId: "me" }]);
    }
    try {
      await chatApi.toggleReaction(msg.id, emoji);
    } catch {
      setMyReaction(prevReaction); // revert on error
    }
  };

  // Swipe-to-reply touch handlers
  const SWIPE_THRESHOLD = 60;
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (dy > 30) { touchStartRef.current = null; setSwipeX(0); return; }
    // RTL: positive dx = swipe right = reply; LTR: negative dx = swipe left = reply
    const dir = document.documentElement.dir === "rtl" ? 1 : -1;
    const offset = dx * dir;
    if (offset > 0) setSwipeX(Math.min(offset, SWIPE_THRESHOLD + 20));
  };
  const onTouchEnd = () => {
    if (swipeX >= SWIPE_THRESHOLD) {
      onReply(msg);
    }
    setSwipeX(0);
    touchStartRef.current = null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15 }}
      className={`flex items-end gap-2 group ${isMe ? "flex-row-reverse" : ""}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: swipeX > 0 ? `translateX(${document.documentElement.dir === "rtl" ? swipeX : -swipeX}px)` : undefined, transition: swipeX === 0 ? "transform 0.2s ease" : "none" }}
    >
      {/* Swipe reply indicator */}
      {swipeX > 20 && (
        <div className={`absolute ${document.documentElement.dir === "rtl" ? "-start-8" : "-end-8"} top-1/2 -translate-y-1/2`}>
          <Reply className={`w-5 h-5 transition-all ${swipeX >= SWIPE_THRESHOLD ? "text-primary scale-110" : "text-white/30"}`} />
        </div>
      )}
      <div className={`w-7 h-7 shrink-0 ${showAvatar ? "" : "invisible"}`}>
        {showAvatar && !isMe && <UserAvatar user={otherUser} size="xs" />}
      </div>
      <div className="relative max-w-[75%]">
        {/* Reply reference */}
        {msg.replyToContent && (
          <div className={`mb-1 px-3 py-1.5 rounded-t-xl border-s-2 border-primary/50 bg-white/5 ${isMe ? "text-end" : "text-start"}`}>
            <p className="text-[10px] text-primary/70 font-medium">{msg.replyToSenderName || t("chat.reply", "رد")}</p>
            <p className="text-[11px] text-white/40 truncate">{msg.replyToContent}</p>
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 cursor-pointer ${
            isMe ? "bg-primary text-white rounded-bl-md" : "bg-white/8 text-white rounded-br-md"
          }`}
          onContextMenu={e => { e.preventDefault(); setShowMenu(true); }}
        >
          {msg.type === "image" && msg.mediaUrl && (
            <img src={msg.mediaUrl} alt="" className="rounded-xl max-h-60 mb-2" />
          )}
          {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
          {showTranslation && translatedText && (
            <div className="mt-1.5 pt-1.5 border-t border-white/10">
              <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-80 italic">{translatedText}</p>
            </div>
          )}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-start" : "justify-end"}`}>
            {msg.content && (
              <button
                onClick={e => { e.stopPropagation(); handleTranslate(); }}
                className={`hover:opacity-100 transition-opacity ${showTranslation ? "opacity-70" : "opacity-30"}`}
                title={t("chat.translate", "ترجمة")}
              >
                {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
              </button>
            )}
            <span className="text-[10px] opacity-50">{formatTime(new Date(msg.createdAt), lang)}</span>
            {msg.isEncrypted && <Lock className="w-2.5 h-2.5 opacity-30" />}
            {isMe && (msg.isRead ? <CheckCheck className="w-3 h-3 opacity-70" /> : <Check className="w-3 h-3 opacity-40" />)}
          </div>
        </div>

        {/* Reaction badges */}
        {reactions.length > 0 && (
          <div className="absolute -bottom-3 start-2 flex gap-0.5">
            {Object.entries(reactions.reduce((acc: Record<string, number>, r: any) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)).map(([emoji, cnt]) => (
              <button
                key={emoji}
                className={`bg-white/10 border rounded-full px-1.5 py-0.5 text-xs hover:scale-110 transition-transform ${
                  myReaction === emoji ? "border-primary/40 bg-primary/10" : "border-white/10"
                }`}
                onClick={() => handleReaction(emoji)}
              >
                {emoji}{(cnt as number) > 1 && <span className="text-[9px] ml-0.5 text-white/50">{cnt as number}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Action button on hover */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="absolute -top-1 left-0 rtl:left-auto rtl:right-0 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="w-3 h-3 text-white/50" />
        </button>

        {/* Context menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-full left-0 rtl:left-auto rtl:right-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[160px]"
              onMouseLeave={() => setShowMenu(false)}
            >
              <button onClick={() => { onReply(msg); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                <Reply className="w-4 h-4" /> {t("chat.reply", "رد")}
              </button>
              <button onClick={handleCopy}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                <Copy className="w-4 h-4" /> {t("chat.copy", "نسخ")}
              </button>
              <button onClick={() => { setShowReactions(!showReactions); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                <SmilePlus className="w-4 h-4" /> {t("chat.react", "تفاعل")}
              </button>
              {isMe && (
                <button onClick={() => { onDelete(msg.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-4 h-4" /> {t("chat.deleteMessage", "حذف")}
                </button>
              )}
              {!isMe && (
                <button onClick={() => { onReport(msg); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  <Flag className="w-4 h-4" /> {t("chat.reportMessage")}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick reactions popup */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute bottom-full left-0 rtl:left-auto rtl:right-0 mb-1 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl p-2 flex flex-wrap gap-1 max-w-[200px] z-50"
            >
              {["👍","❤️","😂","😢","😡","🔥","🎉","👏"].map(emoji => (
                <button key={emoji} onClick={() => handleReaction(emoji)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-white/10 transition-colors ${myReaction === emoji ? "bg-primary/20 ring-1 ring-primary/30" : ""}`}>
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

// ── Typing Indicator ──
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex gap-1 bg-white/8 rounded-2xl px-4 py-3 rounded-br-md">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-2 h-2 rounded-full bg-white/40"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Report Modal ──
function ReportModal({ msg, onClose, onSubmit }: { msg: ChatMessage; onClose: () => void; onSubmit: (cat: string, reason: string) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const categories = [
    { value: "harassment", label: t("chat.report.harassment", "تحرش") },
    { value: "spam", label: t("chat.report.spam", "سبام") },
    { value: "inappropriate", label: t("chat.report.inappropriate", "غير لائق") },
    { value: "scam", label: t("chat.report.scam", "احتيال") },
    { value: "threat", label: t("chat.report.threat", "تهديد") },
    { value: "other", label: t("chat.report.other", "أخرى") },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md glass rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Flag className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t("chat.report.title", "الإبلاغ")}</h3>
            <p className="text-white/40 text-xs">{t("chat.report.subtitle", "سيتم مراجعة البلاغ")}</p>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
          <p className="text-white/60 text-sm truncate">{msg.content}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {categories.map(cat => (
            <button key={cat.value} onClick={() => setCategory(cat.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                category === cat.value ? "bg-red-500/20 border border-red-500/30 text-red-400" : "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10"
              }`}>{cat.label}</button>
          ))}
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder={t("chat.report.reasonPlaceholder", "سبب البلاغ (اختياري)")}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/30 resize-none h-20 mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 font-medium text-sm hover:bg-white/10 transition-colors">
            {t("common.cancel", "إلغاء")}
          </button>
          <button onClick={async () => { setLoading(true); await onSubmit(category, reason); setLoading(false); }}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
            {t("chat.report.submit", "إرسال")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════
// CATEGORIZED EMOJI PICKER
// ════════════════════════════════════════════════════════
function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [activeCategory, setActiveCategory] = useState(0);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
      className="absolute bottom-full start-0 mb-2 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 w-[260px]">
      {/* Category tabs */}
      <div className="flex gap-1 mb-2 pb-2 border-b border-white/5">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button key={i} onClick={() => setActiveCategory(i)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
              activeCategory === i ? "bg-primary/20 scale-110" : "hover:bg-white/5"
            }`}>
            {cat.icon}
          </button>
        ))}
      </div>
      {/* Emoji grid */}
      <div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto scrollbar-hide">
        {EMOJI_CATEGORIES[activeCategory].emojis.map(emoji => (
          <button key={emoji} onClick={() => onSelect(emoji)}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl hover:bg-white/10 transition-colors hover:scale-110">
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════
// MAIN CHAT POPUP MODAL
// ════════════════════════════════════════════════════════
interface ChatPopupModalProps {
  initialConv: Conversation;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  settings: ChatSettings | null;
  onClose: () => void;
}

export function ChatPopupModal({ initialConv, conversations, setConversations, settings, onClose }: ChatPopupModalProps) {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const lang = i18n.language || "ar";

  const chat = useActiveChat(conversations, setConversations, settings);
  const { reportTarget, setReportTarget, handleReport } = useReportModal(chat.activeConv);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState<Set<string>>(new Set());

  // Auto-open the initial conversation on mount
  useEffect(() => {
    if (initialConv) {
      chat.openConversation(initialConv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chat.sendMessage(t);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      chat.sendMedia(file, "image", t);
    }
    e.target.value = "";
  };

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size > 0) {
          chat.sendMedia(blob, "voice", t);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert(t("chat.micPermissionDenied", "لا يمكن الوصول إلى الميكروفون"));
    }
  };

  const toggleSelectMsg = (msgId: string) => {
    setSelectedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedMsgs);
    for (const id of ids) {
      try { await chat.deleteMyMessage(id); } catch {}
    }
    setSelectedMsgs(new Set());
    setSelectMode(false);
  };

  const insertEmoji = (emoji: string) => {
    chat.setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    chat.inputRef.current?.focus();
  };

  // Infinite scroll handler
  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop < 80 && chat.hasMoreMessages && !chat.loadingMore) {
      chat.loadOlderMessages();
    }
  };

  const displayMsgs = chat.msgSearch ? chat.filteredMessages : chat.messages;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 md:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg h-[85vh] max-h-[700px] flex flex-col bg-[#0e0e20]/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          {/* ── Header ── */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
              <X className="w-4 h-4 text-white/50" />
            </button>
            {chat.activeConv && (
              <>
                <UserAvatar user={chat.activeConv.otherUser} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-bold text-sm truncate">{chat.activeConv.otherUser?.displayName || chat.activeConv.otherUser?.username}</p>
                    <Lock className="w-3 h-3 text-emerald-400/40" />
                  </div>
                  <p className={`text-[10px] font-medium ${chat.activeConv.otherUser?.isOnline ? "text-emerald-400" : "text-white/30"}`}>
                    {chat.isTyping ? (
                      <span className="text-primary animate-pulse">{t("social.typing", "يكتب...")}</span>
                    ) : (
                      chat.activeConv.otherUser?.isOnline ? t("social.online", "متصل") : t("social.offline", "غير متصل")
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {/* In-conversation search */}
                  <button onClick={() => chat.setShowMsgSearch(!chat.showMsgSearch)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${chat.showMsgSearch ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-white/40"}`}>
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  {/* Multi-select toggle */}
                  <button onClick={() => { setSelectMode(!selectMode); setSelectedMsgs(new Set()); }}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${selectMode ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-white/40"}`}>
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                  {settings?.chat_voice_call_enabled && (
                    <button onClick={() => navigate(`/call?user=${chat.activeConv!.otherUser?.id}&type=voice`)}
                      className="w-8 h-8 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center transition-all"
                      disabled={chat.blockStatus?.isBlocked}>
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                  )}
                  {settings?.chat_video_call_enabled && (
                    <button onClick={() => navigate(`/call?user=${chat.activeConv!.otherUser?.id}&type=video`)}
                      className="w-8 h-8 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                      disabled={chat.blockStatus?.isBlocked}>
                      <Video className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                  )}
                  {/* Block menu */}
                  <div className="relative">
                    <button onClick={() => chat.setShowBlockMenu(!chat.showBlockMenu)}
                      className="w-8 h-8 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all">
                      <MoreVertical className="w-3.5 h-3.5 text-white/40" />
                    </button>
                    <AnimatePresence>
                      {chat.showBlockMenu && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute top-full end-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[170px]">
                          <button onClick={chat.handleToggleBlock}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm ${
                              chat.blockStatus?.blockedByMe ? "text-emerald-400 hover:bg-emerald-500/10" : "text-red-400 hover:bg-red-500/10"
                            } transition-colors`}>
                            {chat.blockStatus?.blockedByMe ? (
                              <><Unlock className="w-4 h-4" />{t("chat.unblock", "إلغاء الحظر")}</>
                            ) : (
                              <><Ban className="w-4 h-4" />{t("chat.blockChat", "حظر")}</>
                            )}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── In-conversation search bar ── */}
          <AnimatePresence>
            {chat.showMsgSearch && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="px-3 py-2 bg-white/5 border-b border-white/5">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <input type="text" value={chat.msgSearch} onChange={e => chat.setMsgSearch(e.target.value)}
                      placeholder={t("chat.searchMessages", "ابحث في الرسائل...")}
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 ps-9 pe-8 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/30"
                      autoFocus />
                    {chat.msgSearch && (
                      <button onClick={() => chat.setMsgSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2">
                        <X className="w-3.5 h-3.5 text-white/30" />
                      </button>
                    )}
                  </div>
                  {chat.msgSearch && (
                    <p className="text-[10px] text-white/30 mt-1">{chat.filteredMessages.length} {t("chat.results", "نتيجة")}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Messages Area (with infinite scroll) ── */}
          <div ref={chat.messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-thin relative" onScroll={handleMessagesScroll}>
            {/* Load older indicator */}
            {chat.loadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            )}
            {!chat.hasMoreMessages && chat.messages.length > 0 && (
              <div className="flex justify-center py-2">
                <span className="text-white/20 text-[10px]">{t("chat.noOlderMessages", "لا توجد رسائل أقدم")}</span>
              </div>
            )}

            {/* Encryption & Cost Banner */}
            <div className="flex justify-center gap-2 mb-4 flex-wrap">
              <span className="text-[10px] text-emerald-400/50 bg-emerald-400/5 px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-400/10">
                <ShieldCheck className="w-3 h-3" />
                {t("chat.e2eEncrypted", "مشفر")}
              </span>
              {settings && settings.message_cost > 0 && (
                <span className="text-[10px] text-amber-400/50 bg-amber-400/5 px-3 py-1 rounded-full flex items-center gap-1 border border-amber-400/10">
                  <Coins className="w-3 h-3" />
                  {t("social.messageCost", "تكلفة")}: {settings.message_cost} {t("social.coins", "عملة")}
                </span>
              )}
              {settings && settings.chat_time_limit > 0 && (
                <span className="text-[10px] text-blue-400/50 bg-blue-400/5 px-3 py-1 rounded-full flex items-center gap-1 border border-blue-400/10">
                  <Clock className="w-3 h-3" />
                  {t("chat.timeLimit", "الحد")}: {settings.chat_time_limit} {t("chat.minutes", "دقيقة")}
                </span>
              )}
            </div>

            {/* Block banner */}
            {chat.blockStatus?.isBlocked && (
              <div className="flex justify-center mb-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 flex items-center gap-2 text-red-400 text-xs font-medium">
                  <Ban className="w-4 h-4" />
                  {chat.blockStatus.blockedByMe ? t("chat.youBlockedUser", "لقد حظرت هذا المستخدم") : t("chat.userBlockedYou", "هذا المستخدم حظرك")}
                </div>
              </div>
            )}

            {displayMsgs.length === 0 && !chat.blockStatus?.isBlocked && (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 mx-auto mb-3 flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-primary/30" />
                </div>
                <p className="text-white/25 text-sm font-medium">{t("social.startConversation", "ابدأ المحادثة")}</p>
              </div>
            )}

            {displayMsgs.map((msg, i) => {
              const isMe = msg.senderId === "me" || !!(chat.activeConv?.otherUser && msg.senderId !== chat.activeConv.otherUser.id);
              const showAvatar = !displayMsgs[i - 1] || displayMsgs[i - 1].senderId !== msg.senderId;
              return (
                <div key={msg.id} className={`flex items-center gap-2 ${selectMode ? "cursor-pointer" : ""}`}
                  onClick={selectMode && isMe ? () => toggleSelectMsg(msg.id) : undefined}>
                  {selectMode && isMe && (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      selectedMsgs.has(msg.id) ? "border-primary bg-primary" : "border-white/20"
                    }`}>
                      {selectedMsgs.has(msg.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}
                  <div className="flex-1">
                    <MessageBubble
                      msg={msg}
                      isMe={isMe}
                      showAvatar={showAvatar}
                      otherUser={chat.activeConv?.otherUser}
                      onReport={m => setReportTarget(m)}
                      onReply={m => chat.setReplyTo(m)}
                      onDelete={chat.deleteMyMessage}
                      lang={lang}
                    />
                  </div>
                </div>
              );
            })}

            {chat.isTyping && <TypingIndicator />}
            <div ref={chat.messagesEndRef} />
          </div>

          {/* ── New message indicator ── */}
          {chat.showNewMsgIndicator && (
            <button
              onClick={() => chat.scrollToBottom()}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-white text-xs font-medium shadow-lg animate-bounce"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              {t("chat.newMessages", "رسالة جديدة")}
            </button>
          )}

          {/* ── Bulk delete bar ── */}
          {selectMode && selectedMsgs.size > 0 && (
            <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between">
              <span className="text-sm text-white/70">{selectedMsgs.size} {t("chat.selected", "محدد")}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => { setSelectedMsgs(new Set()); setSelectMode(false); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/5">{t("chat.cancel", "إلغاء")}</button>
                <button onClick={handleBulkDelete}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/20 hover:bg-red-500/30 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> {t("chat.deleteSelected", "حذف المحدد")}
                </button>
              </div>
            </div>
          )}

          {/* ── Reply preview ── */}
          <AnimatePresence>
            {chat.replyTo && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="px-3 py-2 bg-primary/5 border-t border-primary/10 flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-primary font-medium">{t("chat.replyingTo", "الرد على")}</p>
                    <p className="text-xs text-white/50 truncate">{chat.replyTo.content}</p>
                  </div>
                  <button onClick={() => chat.setReplyTo(null)} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-4 h-4 text-white/30" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Message Input ── */}
          <div className="border-t border-white/5 px-3 py-3 bg-white/[0.02]">
            {chat.blockStatus?.isBlocked ? (
              <div className="text-center py-2 text-white/30 text-sm">
                {chat.blockStatus.blockedByMe ? t("chat.unblockToChat", "ألغِ الحظر للمراسلة") : t("chat.blockedCannotChat", "لا يمكنك المراسلة")}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Emoji picker */}
                <div className="relative">
                  <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${showEmojiPicker ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-white/30"}`}>
                    <Smile className="w-4.5 h-4.5" />
                  </button>
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <EmojiPicker onSelect={insertEmoji} />
                    )}
                  </AnimatePresence>
                </div>

                {/* Image upload */}
                {settings?.chat_media_enabled && (
                  <>
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <button onClick={() => imageInputRef.current?.click()}
                      disabled={chat.sendingMsg || chat.blockStatus?.isBlocked}
                      className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/30 hover:text-white/50 transition-all">
                      <Image className="w-4.5 h-4.5" />
                    </button>
                  </>
                )}

                {/* Voice recording */}
                {settings?.chat_media_enabled && (
                  <button onClick={toggleVoiceRecording}
                    disabled={chat.sendingMsg || chat.blockStatus?.isBlocked}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      isRecording ? "bg-red-500/20 text-red-400 animate-pulse" : "hover:bg-white/5 text-white/30 hover:text-white/50"
                    }`}>
                    <Mic className="w-4.5 h-4.5" />
                  </button>
                )}

                <input ref={chat.inputRef} type="text"
                  value={chat.newMessage} onChange={chat.handleInputChange} onKeyDown={handleKeyDown}
                  placeholder={t("social.typeMessage", "اكتب رسالة...")}
                  className="flex-1 bg-white/5 border border-white/8 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/30 transition-all"
                  disabled={chat.blockStatus?.isBlocked} />

                <button onClick={() => chat.sendMessage(t)}
                  disabled={!chat.newMessage.trim() || chat.sendingMsg || chat.blockStatus?.isBlocked}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                    chat.newMessage.trim() && !chat.sendingMsg
                      ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary-rgb),0.5)]"
                      : "bg-white/5 text-white/20"
                  }`}>
                  {chat.sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Report Modal (higher z-index) */}
      <AnimatePresence>
        {reportTarget && (
          <ReportModal msg={reportTarget} onClose={() => setReportTarget(null)} onSubmit={handleReport} />
        )}
      </AnimatePresence>
    </>
  );
}
