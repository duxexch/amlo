/**
 * Social Hub — تواصل
 * ════════════════════════════════════════
 * Unified friends + chats experience:
 * - Online friends strip (stories-style)
 * - 3 tabs: Chats, Friends, Requests
 * - Full chat popup with Reply/Reactions/Emoji/Search
 * - Global user search + PIN switch
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Search, Bell, Check, X, MessageCircle,
  Phone, Video, Loader2, UserCheck, Clock, Globe,
  CheckCheck, Lock, ShieldCheck, Coins, Eye
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { friendsApi, chatApi } from "@/lib/socialApi";
import { friendVisibilityApi, profileApi } from "@/lib/authApi";
import { useLocation } from "wouter";
import { useConversations } from "./chat/chatHooks";
import { ChatPopupModal } from "./chat/ChatPopupModal";
import type { Conversation } from "./chat/chatTypes";
import { io as socketIO, Socket } from "socket.io-client";

// ── Types ──
type Tab = "chats" | "friends" | "requests";

// ── Socket singleton ──
let socket: Socket | null = null;
let socketRefCount = 0;
function getSocket(): Socket {
  if (!socket) socket = socketIO({ transports: ["websocket", "polling"] });
  return socket;
}
function acquireSocket(): Socket {
  socketRefCount++;
  return getSocket();
}
function releaseSocket() {
  socketRefCount--;
  if (socketRefCount <= 0 && socket) {
    socket.disconnect();
    socket = null;
    socketRefCount = 0;
  }
}

// ── Time format ──
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const lang = document.documentElement.lang || navigator.language || "ar";
  if (diff < 60000) return lang.startsWith("ar") ? "الآن" : "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}${lang.startsWith("ar") ? "د" : "m"}`;
  if (diff < 86400000) return date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return date.toLocaleDateString(lang, { weekday: "short" });
  return date.toLocaleDateString(lang, { month: "short", day: "numeric" });
}



// ═══════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════

function UserAvatar({ user, size = "md" }: { user: any; size?: "xs" | "sm" | "md" | "lg" }) {
  const sizeClasses = { xs: "w-8 h-8", sm: "w-10 h-10", md: "w-12 h-12", lg: "w-14 h-14" };
  const textClasses = { xs: "text-xs", sm: "text-sm", md: "text-lg", lg: "text-xl" };
  const colors = [
    "from-primary to-secondary", "from-cyan-400 to-blue-500", "from-pink-400 to-rose-500",
    "from-amber-400 to-orange-500", "from-emerald-400 to-teal-500", "from-violet-400 to-purple-500",
  ];
  const color = colors[Math.abs((user?.displayName || user?.username || "").charCodeAt(0)) % colors.length];
  const initial = (user?.displayName || user?.username || "?")[0]?.toUpperCase();

  return (
    <div className="relative shrink-0">
      {user?.avatar ? (
        <img src={user.avatar} alt="" className={`${sizeClasses[size]} rounded-2xl object-cover`} />
      ) : (
        <div className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white ${textClasses[size]}`}>
          {initial}
        </div>
      )}
      {user?.isOnline && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a1a] shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      )}
      {user?.isVerified && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </div>
  );
}

// ── Online Friends Strip (stories-style) ──
function OnlineStrip({ friends, onChat, onSearch }: { friends: any[]; onChat: (id: string) => void; onSearch: () => void }) {
  const { t } = useTranslation();
  const colors = [
    "from-primary to-secondary", "from-cyan-400 to-blue-500", "from-pink-400 to-rose-500",
    "from-amber-400 to-orange-500", "from-emerald-400 to-teal-500", "from-violet-400 to-purple-500",
  ];

  if (friends.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex gap-4 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {/* Add friend button */}
        <button onClick={onSearch} className="flex flex-col items-center gap-1.5 shrink-0 group">
          <div className="w-[3.5rem] h-[3.5rem] rounded-full bg-white/5 border-2 border-dashed border-white/15 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-all">
            <UserPlus className="w-5 h-5 text-white/30 group-hover:text-primary transition-colors" />
          </div>
          <span className="text-[10px] text-white/30 font-medium w-14 truncate text-center">{t("social.addFriend")}</span>
        </button>

        {/* Online friends */}
        {friends.map(f => {
          const color = colors[Math.abs((f.displayName || f.username || "").charCodeAt(0)) % colors.length];
          const initial = (f.displayName || f.username || "?")[0]?.toUpperCase();
          return (
            <button key={f.id} onClick={() => onChat(f.id)} className="flex flex-col items-center gap-1.5 shrink-0 group">
              <div className="relative">
                <div className="w-[3.5rem] h-[3.5rem] rounded-full p-[2.5px] bg-gradient-to-br from-primary/60 to-secondary/60 group-hover:from-primary group-hover:to-secondary transition-all shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)] group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
                  {f.avatar ? (
                    <img src={f.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className={`w-full h-full rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white text-sm`}>
                      {initial}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-[2.5px] border-[#0a0a1a] shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              </div>
              <span className="text-[10px] text-white/50 font-medium w-14 truncate text-center group-hover:text-white/80 transition-colors">
                {(f.displayName || f.username || "").split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Conversation Item ──
function ConversationItem({ conv, onClick }: { conv: any; onClick: () => void }) {
  const timeStr = formatTime(new Date(conv.lastMessageAt || conv.lastMessage?.createdAt || Date.now()));
  const isMe = conv.lastMessage?.senderId !== conv.otherUser?.id;

  return (
    <motion.button
      layout
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-start hover:bg-white/[0.04] border border-transparent hover:border-white/5"
    >
      <UserAvatar user={conv.otherUser} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-white font-bold text-sm truncate">{conv.otherUser?.displayName || conv.otherUser?.username}</p>
            <Lock className="w-3 h-3 text-emerald-400/40 shrink-0" />
          </div>
          <span className="text-white/25 text-[10px] shrink-0 font-medium">{timeStr}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-white/35 text-xs truncate flex items-center gap-1">
            {isMe && <CheckCheck className="w-3 h-3 text-primary/60 shrink-0" />}
            {conv.lastMessage?.content || "..."}
          </p>
          {conv.unreadCount > 0 && (
            <span className="shrink-0 min-w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1 shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ── Friend Card ──
function FriendCard({ friend, onMessage, onCall }: { friend: any; onMessage: () => void; onCall: (type: "voice" | "video") => void }) {
  const { t } = useTranslation();
  const [visibleProfile, setVisibleProfile] = useState<number>(friend.visibleProfileIndex || 1);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleSetVisibility = async (profileIndex: number) => {
    setVisibleProfile(profileIndex);
    setShowProfileMenu(false);
    try {
      await friendVisibilityApi.set(friend.id, profileIndex);
    } catch {
      setVisibleProfile(friend.visibleProfileIndex || 1); // revert on error
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all group"
    >
      <UserAvatar user={friend} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-bold text-sm truncate">{friend.displayName || friend.username}</p>
          <span className="text-[10px] text-primary/50 font-bold bg-primary/5 px-1.5 py-0.5 rounded-md">Lv.{friend.level}</span>
        </div>
        <p className={`text-[11px] mt-0.5 font-medium flex items-center gap-1 ${friend.isOnline ? "text-emerald-400/80" : "text-white/25"}`}>
          {friend.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
          {friend.isOnline ? t("social.online") : t("social.offline")}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Profile Visibility Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              visibleProfile === 2
                ? "bg-purple-500/15 hover:bg-purple-500/25"
                : "bg-white/5 hover:bg-white/10"
            }`}
            title={t("social.profileVisibility", "ملف ظاهر")}
          >
            <Eye className={`w-3.5 h-3.5 ${visibleProfile === 2 ? "text-purple-400" : "text-white/40"}`} />
          </button>
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                className="absolute top-full right-0 rtl:right-auto rtl:left-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[140px]"
              >
                <button
                  onClick={() => handleSetVisibility(1)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    visibleProfile === 1 ? "text-blue-400 bg-blue-500/10" : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">1</span>
                  {t("social.profile1", "ملف 1")}
                  {visibleProfile === 1 && <Check className="w-3.5 h-3.5 mr-auto" />}
                </button>
                <button
                  onClick={() => handleSetVisibility(2)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    visibleProfile === 2 ? "text-purple-400 bg-purple-500/10" : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center">2</span>
                  {t("social.profile2", "ملف 2")}
                  {visibleProfile === 2 && <Check className="w-3.5 h-3.5 mr-auto" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={onMessage} className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all" title={t("social.sendMessage")}>
          <MessageCircle className="w-3.5 h-3.5 text-primary" />
        </button>
        <button onClick={() => onCall("voice")} className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center transition-all" title={t("social.voiceCall")}>
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
        </button>
        <button onClick={() => onCall("video")} className="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-all" title={t("social.videoCall")}>
          <Video className="w-3.5 h-3.5 text-blue-400" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Request Card ──
function RequestCard({ request, onAccept, onReject }: { request: any; onAccept: () => void; onReject: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <motion.div layout initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
      <UserAvatar user={request.sender} />
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{request.sender.displayName || request.sender.username}</p>
        <p className="text-white/25 text-[10px] flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" />
          {new Date(request.createdAt).toLocaleDateString(navigator.language || "ar")}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => { setBusy(true); onAccept(); }} disabled={busy} className="w-9 h-9 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white flex items-center justify-center transition-all">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button onClick={() => { setBusy(true); onReject(); }} disabled={busy} className="w-9 h-9 rounded-xl bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Search Result (dropdown) ──
function SearchResult({ user, onAdd }: { user: any; onAdd: () => void }) {
  const { t } = useTranslation();
  const [sent, setSent] = useState(user.friendshipStatus === "pending");
  const isFriend = user.friendshipStatus === "accepted";
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
      <UserAvatar user={user} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{user.displayName || user.username}</p>
        <p className="text-white/30 text-xs">@{user.username}</p>
      </div>
      {isFriend ? (
        <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1.5 rounded-lg">
          <UserCheck className="w-3 h-3" /> {t("social.alreadyFriends")}
        </span>
      ) : sent ? (
        <span className="text-amber-400 text-[10px] font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-1.5 rounded-lg">
          <Clock className="w-3 h-3" /> {t("social.requestSent")}
        </span>
      ) : (
        <button onClick={() => { setSent(true); onAdd(); }} className="flex items-center gap-1 bg-primary/15 hover:bg-primary text-primary hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all">
          <UserPlus className="w-3 h-3" /> {t("social.addFriend")}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT — SOCIAL HUB
// ═══════════════════════════════════════════════════
export function Friends() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();

  // ── Socket lifecycle — connect on mount, disconnect on unmount ──
  useEffect(() => {
    acquireSocket();
    return () => releaseSocket();
  }, []);

  // ── Tab ──
  const [tab, setTab] = useState<Tab>("chats");

  // ── Friends state ──
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // ── Global search ──
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Chat state (delegated to hooks) ──
  const { conversations, setConversations, settings: chatSettings, loading, totalUnread } = useConversations();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [pinSwitching, setPinSwitching] = useState(false);
  const [pinSwitchSuccess, setPinSwitchSuccess] = useState<string | null>(null);

  // ── Computed ──
  const onlineFriends = useMemo(() => friends.filter(f => f.isOnline), [friends]);
  const offlineFriends = useMemo(() => friends.filter(f => !f.isOnline), [friends]);
  const showSearchResults = globalSearch.length >= 2 && !/^\d+$/.test(globalSearch);

  const filteredConvs = useMemo(() =>
    conversations.filter(c =>
      !searchFilter || (c.otherUser?.displayName || c.otherUser?.username || "").toLowerCase().includes(searchFilter.toLowerCase())
    ), [conversations, searchFilter]
  );

  // ── Load friends & requests ──
  useEffect(() => {
    (async () => {
      setFriendsLoading(true);
      try {
        const [friendsList, requestsList] = await Promise.all([
          friendsApi.list(),
          friendsApi.requests(),
        ]);
        setFriends(friendsList || []);
        setRequests(requestsList || []);
      } catch {}
      setFriendsLoading(false);
    })();
  }, []);

  // ── Handle ?user= query param ──
  useEffect(() => {
    if (!loading) {
      const params = new URLSearchParams(window.location.search);
      const userId = params.get("user");
      if (userId) {
        handleOpenChatWithUser(userId);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [loading]);

  // ── Global search debounce ──
  const handleGlobalSearch = async () => {
    if (globalSearch.length < 2) return;
    setSearching(true);
    try {
      const data = await friendsApi.searchUsers(globalSearch);
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  useEffect(() => {
    if (globalSearch.length >= 2 && !/^\d+$/.test(globalSearch)) {
      const timer = setTimeout(handleGlobalSearch, 400);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [globalSearch]);

  // ── Click outside search ──
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Open chat with user (from strip/friends tab) ──
  const handleOpenChatWithUser = async (userId: string) => {
    const existing = conversations.find(c => c.otherUser?.id === userId);
    if (existing) { setActiveConv(existing as Conversation); return; }
    try {
      const conv = await chatApi.createConversation(userId);
      setConversations(prev => [conv as Conversation, ...prev]);
      setActiveConv(conv as Conversation);
    } catch {
      setTab("chats");
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await friendsApi.accept(id);
      const updated = await friendsApi.list();
      setFriends(updated || []);
    } catch {}
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleReject = async (id: string) => {
    try { await friendsApi.reject(id); } catch {}
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleCall = (userId: string, type: "voice" | "video") => {
    navigate(`/call?user=${userId}&type=${type}`);
  };

  const tabs: { key: Tab; label: string; icon: typeof MessageCircle; count?: number }[] = [
    { key: "chats", label: t("social.chats"), icon: MessageCircle, count: totalUnread },
    { key: "friends", label: t("social.friends"), icon: Users, count: friends.length },
    { key: "requests", label: t("social.requests"), icon: Bell, count: requests.length },
  ];

  // ═══════════════════════════════════
  // RENDER
  // ═══════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto h-[calc(100dvh-5rem)] flex flex-col">
      {/* ═══ HUB (always visible) ═══ */}
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="pt-3 pb-2 px-1">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  {t("social.socialHub")}
                </h1>
                <div className="flex items-center gap-2">
                  {chatSettings && chatSettings.message_cost > 0 && (
                    <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold bg-amber-400/10 px-2 py-1 rounded-lg">
                      <Coins className="w-3 h-3" />
                      {chatSettings.message_cost}/{t("social.perMessage")}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-400/10 px-2 py-1 rounded-lg">
                    <ShieldCheck className="w-3 h-3" />
                    {t("chat.encrypted")}
                  </div>
                </div>
              </div>

              {/* Online Strip */}
              <OnlineStrip
                friends={onlineFriends}
                onChat={handleOpenChatWithUser}
                onSearch={() => {
                  setSearchFocused(true);
                  searchRef.current?.querySelector("input")?.focus();
                }}
              />

              {/* Global Search */}
              <div ref={searchRef} className="relative z-20 mb-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setGlobalSearch(val);
                      setSearchFocused(true);

                      // PIN switch: if exactly 4 digits, try to verify as PIN
                      if (/^\d{4}$/.test(val) && !pinSwitching) {
                        setPinSwitching(true);
                        profileApi.verifyPin(val)
                          .then((res) => {
                            setPinSwitchSuccess(res.data?.displayName || t("social.profileSwitched", "تم التبديل!"));
                            setGlobalSearch("");
                            setSearchResults([]);
                            setSearchFocused(false);
                            setTimeout(() => setPinSwitchSuccess(null), 3000);
                            // Reload page data
                            window.location.reload();
                          })
                          .catch(() => {
                            // Not a valid PIN — treat as normal search
                          })
                          .finally(() => setPinSwitching(false));
                      }
                    }}
                    onFocus={() => setSearchFocused(true)}
                    placeholder={t("social.globalSearchPlaceholder")}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-2.5 pr-10 pl-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/25 focus:bg-white/[0.06] transition-all"
                  />
                  {(searching || pinSwitching) && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
                  {!searching && !pinSwitching && globalSearch.length > 0 && (
                    <button
                      onClick={() => { setGlobalSearch(""); setSearchResults([]); setSearchFocused(false); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors" />
                    </button>
                  )}
                  {!searching && !pinSwitching && !globalSearch && (
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/15" />
                  )}
                </div>

                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {searchFocused && showSearchResults && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-1.5 glass rounded-2xl border border-white/10 shadow-2xl shadow-black/40 max-h-[min(350px,50vh)] overflow-y-auto z-50"
                    >
                      <div className="p-2.5 border-b border-white/5 flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-bold text-white/40">{t("social.globalSearchTitle")}</span>
                        {searchResults.length > 0 && (
                          <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold ml-auto">
                            {searchResults.length} {t("social.results")}
                          </span>
                        )}
                      </div>
                      <div className="p-1.5">
                        {searchResults.map(u => (
                          <SearchResult key={u.id} user={u} onAdd={() => friendsApi.sendRequest(u.id).catch(() => {})} />
                        ))}
                      </div>
                      {searchResults.length === 0 && !searching && (
                        <div className="text-center py-6">
                          <Search className="w-8 h-8 text-white/8 mx-auto mb-1.5" />
                          <p className="text-white/30 text-xs">{t("social.noResults")}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* PIN Switch Success Toast */}
              <AnimatePresence>
                {pinSwitchSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="mb-3 flex items-center gap-3 bg-emerald-500/15 border border-emerald-500/20 rounded-xl px-4 py-3"
                  >
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-emerald-400 text-sm font-bold">{t("social.profileSwitched", "تم التبديل!")}</p>
                      <p className="text-emerald-400/60 text-xs">{pinSwitchSuccess}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tabs — Segmented Control */}
              <div className="flex bg-white/[0.03] rounded-xl p-1 gap-1">
                {tabs.map(ti => (
                  <button
                    key={ti.key}
                    onClick={() => setTab(ti.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all relative ${
                      tab === ti.key
                        ? "bg-primary/15 text-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]"
                        : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                    }`}
                  >
                    <ti.icon className="w-3.5 h-3.5" />
                    <span>{ti.label}</span>
                    {ti.count !== undefined && ti.count > 0 && (
                      <span className={`min-w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full px-1 ${
                        tab === ti.key ? "bg-primary/25 text-primary" : "bg-white/8 text-white/30"
                      }`}>
                        {ti.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-1 pt-2 scrollbar-thin">
              <AnimatePresence mode="wait">
                {/* ── CHATS TAB ── */}
                {tab === "chats" && (
                  <motion.div key="chats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
                    {conversations.length > 3 && (
                      <div className="relative mb-2">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                        <input
                          type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                          placeholder={t("social.searchConversations")}
                          className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pr-9 pl-4 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/20 transition-all"
                        />
                      </div>
                    )}
                    {loading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-7 h-7 text-primary animate-spin" />
                      </div>
                    ) : filteredConvs.length > 0 ? (
                      filteredConvs.map(conv => (
                        <ConversationItem key={conv.id} conv={conv} onClick={() => setActiveConv(conv as Conversation)} />
                      ))
                    ) : (
                      <div className="text-center py-14">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] mx-auto mb-3 flex items-center justify-center">
                          <MessageCircle className="w-8 h-8 text-white/8" />
                        </div>
                        <p className="text-white/30 text-sm font-bold">{t("social.noConversations")}</p>
                        <p className="text-white/15 text-xs mt-1">{t("social.noConversationsDesc")}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── FRIENDS TAB ── */}
                {tab === "friends" && (
                  <motion.div key="friends" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
                    {onlineFriends.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                          <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
                            {t("social.onlineNow")} ({onlineFriends.length})
                          </span>
                        </div>
                        {onlineFriends.map(f => (
                          <FriendCard key={f.id} friend={f} onMessage={() => handleOpenChatWithUser(f.id)} onCall={type => handleCall(f.id, type)} />
                        ))}
                      </div>
                    )}
                    {offlineFriends.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/15" />
                          <span className="text-white/25 text-[10px] font-bold uppercase tracking-wider">
                            {t("social.offlineFriends")} ({offlineFriends.length})
                          </span>
                        </div>
                        <div className="opacity-60">
                          {offlineFriends.map(f => (
                            <FriendCard key={f.id} friend={f} onMessage={() => handleOpenChatWithUser(f.id)} onCall={type => handleCall(f.id, type)} />
                          ))}
                        </div>
                      </div>
                    )}
                    {friends.length === 0 && (
                      <div className="text-center py-14">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] mx-auto mb-3 flex items-center justify-center">
                          <Users className="w-8 h-8 text-white/8" />
                        </div>
                        <p className="text-white/30 text-sm font-bold">{t("social.noFriends")}</p>
                        <p className="text-white/15 text-xs mt-1">{t("social.noFriendsDesc")}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── REQUESTS TAB ── */}
                {tab === "requests" && (
                  <motion.div key="requests" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                    {requests.length > 0 ? (
                      requests.map(r => (
                        <RequestCard key={r.id} request={r} onAccept={() => handleAccept(r.id)} onReject={() => handleReject(r.id)} />
                      ))
                    ) : (
                      <div className="text-center py-14">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] mx-auto mb-3 flex items-center justify-center">
                          <Bell className="w-8 h-8 text-white/8" />
                        </div>
                        <p className="text-white/30 text-sm font-bold">{t("social.noRequests")}</p>
                        <p className="text-white/15 text-xs mt-1">{t("social.noRequestsDesc")}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

      {/* ═══ CHAT POPUP MODAL (delegated to ChatPopupModal component) ═══ */}
      <AnimatePresence>
        {activeConv && (
          <ChatPopupModal
            initialConv={activeConv}
            conversations={conversations}
            setConversations={setConversations}
            settings={chatSettings}
            onClose={() => setActiveConv(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
