/**
 * Chat Page — الدردشة الخاصة
 * ════════════════════════════════════════
 * Real-time encrypted chat with coin system,
 * message reports, chat blocks, and feature toggles.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Search, Send, ArrowRight, Phone, Video,
  Image, Mic, Smile, ChevronDown, Check, CheckCheck,
  Clock, Coins, Loader2, Plus, MoreVertical, Trash2, X,
  Shield, ShieldCheck, Flag, Ban, AlertTriangle, Lock, Unlock
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { chatApi, callsApi, chatBlocksApi, messageReportsApi } from "@/lib/socialApi";
import { useLocation } from "wouter";
import { io as socketIO, Socket } from "socket.io-client";

type ViewMode = "list" | "chat";

// ── Socket singleton ──
let socket: Socket | null = null;
function getSocket(): Socket {
  if (!socket) {
    socket = socketIO({ transports: ["websocket", "polling"] });
  }
  return socket;
}

// ── User Avatar ──
function UserAvatar({ user, size = "md" }: { user: any; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "w-10 h-10", md: "w-12 h-12", lg: "w-14 h-14" };
  const colors = ["from-primary to-secondary", "from-cyan-400 to-blue-500", "from-pink-400 to-rose-500", "from-amber-400 to-orange-500", "from-emerald-400 to-teal-500", "from-violet-400 to-purple-500"];
  const color = colors[Math.abs((user?.displayName || user?.username || "").charCodeAt(0)) % colors.length];
  const initial = (user?.displayName || user?.username || "?")[0]?.toUpperCase();

  return (
    <div className="relative shrink-0">
      {user?.avatar ? (
        <img src={user.avatar} alt="" className={`${sizeClasses[size]} rounded-2xl object-cover`} />
      ) : (
        <div className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white ${size === "lg" ? "text-xl" : size === "md" ? "text-lg" : "text-sm"}`}>
          {initial}
        </div>
      )}
      {user?.isOnline && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a1a] shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      )}
    </div>
  );
}

// ── Conversation item ──
function ConversationItem({ conv, isActive, onClick }: { conv: any; isActive: boolean; onClick: () => void }) {
  const timeStr = formatTime(new Date(conv.lastMessageAt || conv.lastMessage?.createdAt || Date.now()));
  const isMe = conv.lastMessage?.senderId !== conv.otherUser?.id;

  return (
    <motion.button
      layout
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-start ${
        isActive
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <UserAvatar user={conv.otherUser} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-white font-bold text-sm truncate">{conv.otherUser?.displayName || conv.otherUser?.username}</p>
            <Lock className="w-3 h-3 text-emerald-400/60 shrink-0" />
          </div>
          <span className="text-white/30 text-[10px] shrink-0">{timeStr}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-white/40 text-xs truncate flex items-center gap-1">
            {isMe && <CheckCheck className="w-3 h-3 text-primary shrink-0" />}
            {conv.lastMessage?.content || "..."}
          </p>
          {conv.unreadCount > 0 && (
            <span className="shrink-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ── Message Bubble with report/block context menu ──
function MessageBubble({
  msg, isMe, showAvatar, otherUser, onReport, settings
}: {
  msg: any; isMe: boolean; showAvatar: boolean; otherUser: any;
  onReport: (msg: any) => void; settings: any;
}) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15 }}
      className={`flex items-end gap-2 group ${isMe ? "flex-row-reverse" : ""}`}
    >
      <div className={`w-7 h-7 shrink-0 ${showAvatar ? "" : "invisible"}`}>
        {showAvatar && !isMe && <UserAvatar user={otherUser} size="sm" />}
      </div>
      <div className="relative max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-2.5 cursor-pointer ${
            isMe
              ? "bg-primary text-white rounded-bl-md"
              : "bg-white/8 text-white rounded-br-md"
          }`}
          onContextMenu={(e) => { e.preventDefault(); if (!isMe) setShowMenu(true); }}
          onClick={() => { if (!isMe && showMenu) setShowMenu(false); }}
        >
          {msg.type === "image" && msg.mediaUrl && (
            <img src={msg.mediaUrl} alt="" className="rounded-xl max-h-60 mb-2" />
          )}
          {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-start" : "justify-end"}`}>
            <span className="text-[10px] opacity-50">
              {formatTime(new Date(msg.createdAt))}
            </span>
            {msg.isEncrypted && <Lock className="w-2.5 h-2.5 opacity-30" />}
            {isMe && (
              msg.isRead
                ? <CheckCheck className="w-3 h-3 opacity-70" />
                : <Check className="w-3 h-3 opacity-40" />
            )}
          </div>
        </div>

        {/* Report button on hover (received messages only) */}
        {!isMe && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="absolute -top-1 left-0 rtl:left-auto rtl:right-0 w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-3 h-3 text-white/50" />
          </button>
        )}

        {/* Context menu */}
        <AnimatePresence>
          {showMenu && !isMe && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-full left-0 rtl:left-auto rtl:right-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[160px]"
            >
              <button
                onClick={() => { onReport(msg); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Flag className="w-4 h-4" />
                {t("chat.reportMessage")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Typing indicator ──
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex gap-1 bg-white/8 rounded-2xl px-4 py-3 rounded-br-md">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-white/40"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Report Modal ──
function ReportModal({ msg, onClose, onSubmit }: { msg: any; onClose: () => void; onSubmit: (category: string, reason: string) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const categories = [
    { value: "harassment", label: t("chat.report.harassment") },
    { value: "spam", label: t("chat.report.spam") },
    { value: "inappropriate", label: t("chat.report.inappropriate") },
    { value: "scam", label: t("chat.report.scam") },
    { value: "threat", label: t("chat.report.threat") },
    { value: "other", label: t("chat.report.other") },
  ];

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(category, reason);
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md glass rounded-2xl border border-white/10 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Flag className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t("chat.report.title")}</h3>
            <p className="text-white/40 text-xs">{t("chat.report.subtitle")}</p>
          </div>
        </div>

        {/* Reported message preview */}
        <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
          <p className="text-white/60 text-sm truncate">{msg.content}</p>
        </div>

        {/* Category */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                category === cat.value
                  ? "bg-red-500/20 border border-red-500/30 text-red-400"
                  : "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Reason */}
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t("chat.report.reasonPlaceholder")}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/30 resize-none h-20 mb-4"
        />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 font-medium text-sm hover:bg-white/10 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
            {t("chat.report.submit")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Time formatter ──
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "الآن";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}د`;
  if (diff < 86400000) return date.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return date.toLocaleDateString("ar", { weekday: "short" });
  return date.toLocaleDateString("ar", { month: "short", day: "numeric" });
}

// ════════════════════════════════════════════════════════
// MAIN CHAT COMPONENT
// ════════════════════════════════════════════════════════
export function Chat() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [view, setView] = useState<ViewMode>("list");
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [blockStatus, setBlockStatus] = useState<any>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [convs, chatSettings] = await Promise.all([
          chatApi.conversations(),
          chatApi.settings(),
        ]);
        setConversations(convs || []);
        setSettings(chatSettings);
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Socket listeners
  useEffect(() => {
    const s = getSocket();

    const handleNewMessage = (data: { message: any; conversationId: string; sender: any }) => {
      // Update messages if in the same conversation
      if (activeConv?.id === data.conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

        // Emit read receipt
        if (activeConv?.otherUser?.id) {
          s.emit("messages-read", {
            conversationId: data.conversationId,
            receiverId: activeConv.otherUser.id,
          });
        }
      }

      // Update conversation list
      setConversations(prev =>
        prev.map(c => {
          if (c.id === data.conversationId) {
            return {
              ...c,
              lastMessage: data.message,
              lastMessageAt: data.message.createdAt,
              unreadCount: activeConv?.id === data.conversationId ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    };

    const handleTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === activeConv?.id) setIsTyping(true);
    };

    const handleStopTyping = (data: { conversationId: string }) => {
      if (data.conversationId === activeConv?.id) setIsTyping(false);
    };

    const handleMessagesRead = (data: { conversationId: string }) => {
      if (data.conversationId === activeConv?.id) {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      }
    };

    const handleChatBlocked = (data: { blockerId: string }) => {
      if (activeConv?.otherUser?.id === data.blockerId) {
        setBlockStatus({ isBlocked: true, blockedByThem: true, blockedByMe: false });
      }
    };

    s.on("new-message", handleNewMessage);
    s.on("typing", handleTyping);
    s.on("stop-typing", handleStopTyping);
    s.on("messages-read", handleMessagesRead);
    s.on("chat-blocked", handleChatBlocked);

    return () => {
      s.off("new-message", handleNewMessage);
      s.off("typing", handleTyping);
      s.off("stop-typing", handleStopTyping);
      s.off("messages-read", handleMessagesRead);
      s.off("chat-blocked", handleChatBlocked);
    };
  }, [activeConv]);

  const filteredConvs = useMemo(() =>
    conversations.filter(c =>
      !searchFilter ||
      (c.otherUser?.displayName || c.otherUser?.username || "").toLowerCase().includes(searchFilter.toLowerCase())
    ),
    [conversations, searchFilter]
  );

  const totalUnread = useMemo(() =>
    conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  const openConversation = async (conv: any) => {
    setActiveConv(conv);
    setView("chat");
    setMessages([]);
    setIsTyping(false);
    setBlockStatus(null);

    try {
      const [msgs, blockSt] = await Promise.all([
        chatApi.messages(conv.id),
        chatBlocksApi.status(conv.otherUser?.id),
      ]);
      setMessages(msgs || []);
      setBlockStatus(blockSt);

      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c)
      );

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);

      const s = getSocket();
      s.emit("messages-read", { conversationId: conv.id, receiverId: conv.otherUser?.id });
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const goBack = () => {
    setView("list");
    setActiveConv(null);
    setMessages([]);
    setBlockStatus(null);
    setShowBlockMenu(false);
  };

  // Send message with optimistic update
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !activeConv || sendingMsg) return;
    if (blockStatus?.isBlocked) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    const optimisticMsg = {
      id: tempId,
      senderId: "me",
      content,
      type: "text",
      createdAt: new Date().toISOString(),
      isRead: false,
      isEncrypted: true,
      _pending: true,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage("");
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    const s = getSocket();
    s.emit("stop-typing", { conversationId: activeConv.id, receiverId: activeConv.otherUser?.id });

    try {
      setSendingMsg(true);
      const sentMsg = await chatApi.sendMessage(activeConv.id, { content, type: "text" }) as any;

      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...sentMsg, senderId: "me", _pending: false } : m)
      );

      setConversations(prev =>
        prev.map(c => c.id === activeConv.id
          ? { ...c, lastMessage: { ...sentMsg, content }, lastMessageAt: sentMsg.createdAt }
          : c
        )
      );
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      if (err.status === 402) {
        alert(t("chat.notEnoughCoins"));
      } else if (err.status === 403) {
        alert(err.message || t("chat.blocked"));
      }
    } finally {
      setSendingMsg(false);
    }
  }, [newMessage, activeConv, sendingMsg, blockStatus, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!activeConv) return;

    const s = getSocket();
    s.emit("typing", { conversationId: activeConv.id, receiverId: activeConv.otherUser?.id });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      s.emit("stop-typing", { conversationId: activeConv.id, receiverId: activeConv.otherUser?.id });
    }, 2000);
  };

  const handleReport = async (category: string, reason: string) => {
    if (!reportTarget || !activeConv) return;
    try {
      await messageReportsApi.report({
        messageId: reportTarget.id,
        conversationId: activeConv.id,
        reportedUserId: activeConv.otherUser?.id,
        category,
        reason,
      });
      setReportTarget(null);
    } catch (err) {
      console.error("Failed to report message:", err);
    }
  };

  const handleToggleBlock = async () => {
    if (!activeConv?.otherUser?.id) return;
    try {
      if (blockStatus?.blockedByMe) {
        await chatBlocksApi.unblock(activeConv.otherUser.id);
        setBlockStatus({ isBlocked: false, blockedByMe: false, blockedByThem: false });
      } else {
        await chatBlocksApi.block(activeConv.otherUser.id);
        setBlockStatus({ isBlocked: true, blockedByMe: true, blockedByThem: false });
      }
      setShowBlockMenu(false);
    } catch (err) {
      console.error("Block error:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-[calc(100dvh-5rem)] flex flex-col">
      <AnimatePresence mode="wait">
        {view === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            {/* List Header */}
            <div className="py-4 px-1">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <MessageCircle className="w-7 h-7 text-primary" />
                  {t("social.messages")}
                  {totalUnread > 0 && (
                    <span className="text-sm bg-primary text-white px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]">
                      {totalUnread}
                    </span>
                  )}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-400/10 px-2 py-1 rounded-lg">
                    <ShieldCheck className="w-3 h-3" />
                    {t("chat.encrypted")}
                  </div>
                  {settings && settings.message_cost > 0 && (
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-400/10 px-3 py-1.5 rounded-xl">
                      <Coins className="w-3.5 h-3.5" />
                      {settings.message_cost} / {t("social.perMessage")}
                    </div>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder={t("social.searchConversations")}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/30 transition-all"
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-1 space-y-1 scrollbar-thin">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : filteredConvs.length > 0 ? (
                filteredConvs.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={activeConv?.id === conv.id}
                    onClick={() => openConversation(conv)}
                  />
                ))
              ) : (
                <div className="text-center py-16">
                  <MessageCircle className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <p className="text-white/40 text-lg font-bold">{t("social.noConversations")}</p>
                  <p className="text-white/20 text-sm mt-1">{t("social.noConversationsDesc")}</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full"
          >
            {/* Chat Header */}
            <div className="glass-panel border-b border-white/5 py-2 px-2 flex items-center gap-3">
              <button onClick={goBack} className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center transition-all">
                <ArrowRight className="w-5 h-5 text-white/60" />
              </button>
              
              {activeConv && (
                <>
                  <UserAvatar user={activeConv.otherUser} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white font-bold text-sm truncate">{activeConv.otherUser?.displayName}</p>
                      <Lock className="w-3 h-3 text-emerald-400/60" />
                    </div>
                    <p className={`text-[10px] font-medium ${activeConv.isOnline || activeConv.otherUser?.isOnline ? "text-emerald-400" : "text-white/30"}`}>
                      {isTyping && <span className="text-primary ml-1">{t("social.typing")}</span>}
                      {!isTyping && (activeConv.isOnline || activeConv.otherUser?.isOnline ? t("social.online") : t("social.offline"))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {settings?.chat_voice_call_enabled && (
                      <button
                        onClick={() => navigate(`/call?user=${activeConv.otherUser?.id}&type=voice`)}
                        className="w-9 h-9 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center transition-all"
                        disabled={blockStatus?.isBlocked}
                      >
                        <Phone className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}
                    {settings?.chat_video_call_enabled && (
                      <button
                        onClick={() => navigate(`/call?user=${activeConv.otherUser?.id}&type=video`)}
                        className="w-9 h-9 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                        disabled={blockStatus?.isBlocked}
                      >
                        <Video className="w-4 h-4 text-blue-400" />
                      </button>
                    )}
                    {/* More menu (block) */}
                    <div className="relative">
                      <button
                        onClick={() => setShowBlockMenu(!showBlockMenu)}
                        className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center transition-all"
                      >
                        <MoreVertical className="w-4 h-4 text-white/40" />
                      </button>
                      <AnimatePresence>
                        {showBlockMenu && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute top-full left-0 rtl:left-auto rtl:right-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[180px]"
                          >
                            <button
                              onClick={handleToggleBlock}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm ${
                                blockStatus?.blockedByMe
                                  ? "text-emerald-400 hover:bg-emerald-500/10"
                                  : "text-red-400 hover:bg-red-500/10"
                              } transition-colors`}
                            >
                              {blockStatus?.blockedByMe ? (
                                <>
                                  <Unlock className="w-4 h-4" />
                                  {t("chat.unblock")}
                                </>
                              ) : (
                                <>
                                  <Ban className="w-4 h-4" />
                                  {t("chat.blockChat")}
                                </>
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

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 scrollbar-thin">
              {/* Encryption & Cost Banner */}
              <div className="flex justify-center gap-2 mb-4 flex-wrap">
                <span className="text-[10px] text-emerald-400/60 bg-emerald-400/5 px-3 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {t("chat.e2eEncrypted")}
                </span>
                {settings && settings.message_cost > 0 && (
                  <span className="text-[10px] text-amber-400/60 bg-amber-400/5 px-3 py-1 rounded-full flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    {t("social.messageCost")}: {settings.message_cost} {t("social.coins")}
                  </span>
                )}
                {settings?.chat_time_limit > 0 && (
                  <span className="text-[10px] text-blue-400/60 bg-blue-400/5 px-3 py-1 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t("chat.timeLimit")}: {settings.chat_time_limit} {t("chat.minutes")}
                  </span>
                )}
              </div>

              {/* Block banner */}
              {blockStatus?.isBlocked && (
                <div className="flex justify-center mb-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 flex items-center gap-2 text-red-400 text-xs font-medium">
                    <Ban className="w-4 h-4" />
                    {blockStatus.blockedByMe ? t("chat.youBlockedUser") : t("chat.userBlockedYou")}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isMe = msg.senderId === "me" || (activeConv?.otherUser && msg.senderId !== activeConv.otherUser.id);
                const prevMsg = messages[i - 1];
                const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMe={isMe}
                    showAvatar={showAvatar}
                    otherUser={activeConv?.otherUser}
                    onReport={(m) => setReportTarget(m)}
                    settings={settings}
                  />
                );
              })}

              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="glass-panel border-t border-white/5 p-3">
              {blockStatus?.isBlocked ? (
                <div className="text-center py-2 text-white/30 text-sm">
                  {blockStatus.blockedByMe ? t("chat.unblockToChat") : t("chat.blockedCannotChat")}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={t("social.typeMessage")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/30 transition-all"
                      disabled={blockStatus?.isBlocked}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sendingMsg || blockStatus?.isBlocked}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      newMessage.trim() && !sendingMsg
                        ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary-rgb),0.5)]"
                        : "bg-white/5 text-white/20"
                    }`}
                  >
                    {sendingMsg ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportTarget && (
          <ReportModal
            msg={reportTarget}
            onClose={() => setReportTarget(null)}
            onSubmit={handleReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
