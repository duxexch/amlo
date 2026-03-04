import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plane, Globe as GlobeIcon, Loader2, Sparkles, SlidersHorizontal, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { worldApi, WorldSearchFilters } from "@/lib/worldApi";
import { Globe3D } from "@/components/world/Globe3D";
import { FiltersModal } from "@/components/world/FiltersModal";
import { MatchedUserCard } from "@/components/world/MatchedUserCard";
import { MilesCounter } from "@/components/world/MilesCounter";
import { WorldChat } from "@/components/world/WorldChat";
import { getSocket } from "@/lib/socketManager";

// State Machine
type WorldState = "idle" | "filters" | "searching" | "matched" | "chatting" | "ended";

interface MatchedUser {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  country?: string;
  level?: number;
  bio?: string;
}

interface ChatMessage {
  id: string;
  type: "text" | "system" | "gift" | "follow" | "friend";
  senderId: string;
  content?: string;
  giftAmount?: number;
  createdAt: string;
}

const SEARCH_RETRY_INTERVAL = 4000; // retry every 4s  
const SEARCH_MAX_RETRIES = 8;       // max 32s waiting

const FILTERS_STORAGE_KEY = "world_saved_filters";

function getSavedFilters(): WorldSearchFilters {
  try {
    const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        genderFilter: parsed.genderFilter || "both",
        ageMin: parsed.ageMin || 18,
        ageMax: parsed.ageMax || 60,
        countryFilter: parsed.countryFilter || undefined,
        chatType: parsed.chatType || "text",
      };
    }
  } catch {}
  return { genderFilter: "both", ageMin: 18, ageMax: 60, chatType: "text" };
}

function saveFilters(filters: WorldSearchFilters) {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {}
}

export function WorldExplore() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const isAr = i18n.language === "ar";

  // State machine
  const [state, setState] = useState<WorldState>("idle");
  const [pricing, setPricing] = useState<any[]>([]);
  const [userCoins, setUserCoins] = useState(0);
  const [miles, setMiles] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);

  // Search
  const [searchFilters, setSearchFilters] = useState<WorldSearchFilters | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRetryRef = useRef<any>(null);
  const searchAttemptRef = useRef(0);
  const searchCancelledRef = useRef(false);

  // Match
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [duration, setDuration] = useState(0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFriendRequested, setIsFriendRequested] = useState(false);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Refs
  const durationInterval = useRef<any>(null);
  const currentUserId = useRef<string>("");
  const typingTimeoutRef = useRef<any>(null);

  // ── Load pricing + stats on mount ──
  useEffect(() => {
    worldApi.getPricing().then(data => setPricing(data || [])).catch(() => {});
    worldApi.stats().then(data => {
      setMiles(data?.miles || 0);
      setTotalSessions(data?.totalSessions || 0);
      setUserCoins(data?.coins || 0);
      currentUserId.current = data?.userId || "";
    }).catch(() => {});
  }, []);

  // ── Duration timer while chatting ──
  useEffect(() => {
    if (state === "chatting") {
      durationInterval.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (state !== "ended") setDuration(0);
    }
    return () => { if (durationInterval.current) clearInterval(durationInterval.current); };
  }, [state]);

  // ── Socket.io: Join session room + listen for messages ──
  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();
    
    // Join the session room for real-time messaging
    socket.emit("world-join-session", { sessionId });

    // Listen for new messages
    const handleNewMessage = (data: { sessionId: string; message: ChatMessage }) => {
      if (data.sessionId === sessionId) {
        setMessages(prev => {
          // Deduplicate by ID
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    };

    // Partner disconnected
    const handlePartnerDisconnected = (data: { sessionId: string; userId: string }) => {
      if (data.sessionId === sessionId && data.userId !== currentUserId.current) {
        setPartnerDisconnected(true);
      }
    };

    // Session ended by other side
    const handleSessionEnded = (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        setState("ended");
      }
    };

    // Typing indicator
    const handleTyping = (data: { sessionId: string; userId: string }) => {
      if (data.sessionId === sessionId && data.userId !== currentUserId.current) {
        setIsPartnerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 3000);
      }
    };

    const handleStopTyping = (data: { sessionId: string; userId: string }) => {
      if (data.sessionId === sessionId && data.userId !== currentUserId.current) {
        setIsPartnerTyping(false);
      }
    };

    socket.on("world-chat-message", handleNewMessage);
    socket.on("world-partner-disconnected", handlePartnerDisconnected);
    socket.on("world-session-ended", handleSessionEnded);
    socket.on("world-chat-typing", handleTyping);
    socket.on("world-chat-stop-typing", handleStopTyping);

    // Load initial messages from DB
    worldApi.messages(sessionId).then(data => {
      if (Array.isArray(data)) setMessages(data);
    }).catch(() => {});

    return () => {
      socket.emit("world-leave-session", { sessionId });
      socket.off("world-chat-message", handleNewMessage);
      socket.off("world-partner-disconnected", handlePartnerDisconnected);
      socket.off("world-session-ended", handleSessionEnded);
      socket.off("world-chat-typing", handleTyping);
      socket.off("world-chat-stop-typing", handleStopTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [sessionId]);

  // ── Handlers ──
  const [showFilters, setShowFilters] = useState(false);

  const handleOpenFilters = () => {
    setShowFilters(true);
  };

  const handleCloseFilters = () => {
    setShowFilters(false);
  };

  // Quick search with saved filters (no modal)
  const handleQuickSearch = () => {
    const filters = getSavedFilters();
    setSearchFilters(filters);
    handleStartSearch(filters);
  };

  // Search with retry queue (waits up to ~32s for a match)
  const doSearch = useCallback(async (filters: WorldSearchFilters, isRetry = false): Promise<boolean> => {
    if (searchCancelledRef.current) return false;
    try {
      const result = await worldApi.search(filters);
      if (searchCancelledRef.current) return false;

      // Backend returns { session, matched, matchedUser }
      if (result.matched && result.session?.id && result.matchedUser) {
        setSessionId(result.session.id);
        setMatchedUser(result.matchedUser);
        setUserCoins(prev => Math.max(0, prev - (result.session.coinsSpent || 0)));
        setState("matched");
        return true;
      }
      return false;
    } catch (err: any) {
      if (!isRetry) {
        const msg = err?.message || t("world.searchError");
        setSearchError(msg);
      }
      return false;
    }
  }, [t]);

  const handleStartSearch = useCallback(async (filters: WorldSearchFilters) => {
    setSearchFilters(filters);
    setState("searching");
    setSearchError(null);
    searchCancelledRef.current = false;
    searchAttemptRef.current = 0;

    // First attempt
    const found = await doSearch(filters);
    if (found || searchCancelledRef.current) return;

    // Start retry queue
    searchRetryRef.current = setInterval(async () => {
      searchAttemptRef.current++;
      if (searchAttemptRef.current >= SEARCH_MAX_RETRIES || searchCancelledRef.current) {
        clearInterval(searchRetryRef.current);
        searchRetryRef.current = null;
        if (!searchCancelledRef.current) {
          setSearchError(t("world.noMatch"));
          setTimeout(() => {
            setState("idle");
            setSearchError(null);
          }, 3000);
        }
        return;
      }
      const found = await doSearch(filters, true);
      if (found) {
        clearInterval(searchRetryRef.current);
        searchRetryRef.current = null;
      }
    }, SEARCH_RETRY_INTERVAL);
  }, [doSearch, t]);

  const handleCancelSearch = useCallback(() => {
    searchCancelledRef.current = true;
    if (searchRetryRef.current) {
      clearInterval(searchRetryRef.current);
      searchRetryRef.current = null;
    }
    setState("idle");
    setSearchError(null);
  }, []);

  const handleStartChat = () => {
    setState("chatting");
    setPartnerDisconnected(false);
  };

  // Auto-open chat when match is found (skip matched state → go to chatting)
  useEffect(() => {
    if (state === "matched" && matchedUser && sessionId) {
      // Brief "match found" celebration for 1.5s then auto-open chat
      const timer = setTimeout(() => {
        setState("chatting");
        setPartnerDisconnected(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state, matchedUser, sessionId]);

  // Send message via Socket.io (persisted to DB by server)
  const handleSendMessage = useCallback((content: string) => {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit("world-chat-send", { sessionId, content, type: "text" });
  }, [sessionId]);

  // Typing indicator
  const handleTypingStart = useCallback(() => {
    if (!sessionId || !matchedUser) return;
    const socket = getSocket();
    socket.emit("world-typing", { sessionId, receiverId: matchedUser.id });
  }, [sessionId, matchedUser]);

  const handleTypingStop = useCallback(() => {
    if (!sessionId || !matchedUser) return;
    const socket = getSocket();
    socket.emit("world-stop-typing", { sessionId, receiverId: matchedUser.id });
  }, [sessionId, matchedUser]);

  const handleFollow = async () => {
    if (!sessionId) return;
    try {
      await worldApi.follow(sessionId);
      setIsFollowed(true);
    } catch {}
  };

  const handleFriendRequest = async () => {
    if (!sessionId) return;
    try {
      await worldApi.friendRequest(sessionId);
      setIsFriendRequested(true);
    } catch {}
  };

  const handleReport = async (type: string, reason?: string) => {
    if (!sessionId) return;
    try {
      await worldApi.report(sessionId, { type, reason });
      setState("ended");
    } catch {}
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    try {
      const result = await worldApi.endSession(sessionId);
      setMiles(result?.miles || miles);
    } catch {}
    setState("ended");
    if (durationInterval.current) clearInterval(durationInterval.current);
  };

  // Skip → end current + start new search
  const handleSkip = useCallback(async () => {
    if (sessionId) {
      try { await worldApi.endSession(sessionId); } catch {}
    }
    // Reset and search again with same filters
    setMatchedUser(null);
    setSessionId(null);
    setMessages([]);
    setDuration(0);
    setIsFollowed(false);
    setIsFriendRequested(false);
    setPartnerDisconnected(false);
    setIsPartnerTyping(false);
    if (searchFilters) {
      handleStartSearch(searchFilters);
    } else {
      setState("idle");
    }
  }, [sessionId, searchFilters, handleStartSearch]);

  const handleNewSearch = () => {
    setMatchedUser(null);
    setSessionId(null);
    setMessages([]);
    setDuration(0);
    setIsFollowed(false);
    setIsFriendRequested(false);
    setPartnerDisconnected(false);
    setIsPartnerTyping(false);
    setState("idle");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      searchCancelledRef.current = true;
      if (searchRetryRef.current) clearInterval(searchRetryRef.current);
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, []);

  // ── Chatting State Renders Floating Chat Overlay ──
  const renderFloatingChat = state === "chatting" && matchedUser && sessionId;

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden animate-in fade-in duration-500">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Top Header */}
      <div className="relative z-10 px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-white font-bold text-lg flex items-center gap-2">
          <GlobeIcon className="w-5 h-5 text-emerald-400" />
          {t("world.title")}
        </h1>
        <MilesCounter miles={miles} />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4" style={{ minHeight: "calc(100vh - 140px)" }}>
        <AnimatePresence mode="wait">
          {/* ── IDLE STATE ── */}
          {(state === "idle") && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              {/* Search Button ABOVE Globe — transparent */}
              <motion.button
                onClick={handleQuickSearch}
                className="flex items-center gap-2.5 px-8 py-3 rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-white/80 font-bold text-base hover:bg-white/[0.14] hover:border-emerald-500/30 hover:text-white transition-all shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(16,185,129,0.25)" }}
                whileTap={{ scale: 0.95 }}
              >
                <Search className="w-5 h-5 text-emerald-400" />
                {t("world.searchNow")}
              </motion.button>

              {/* Globe */}
              <Globe3D state="idle" onGlobeClick={handleQuickSearch} />

              {/* Filter Icon BELOW Globe */}
              <motion.button
                onClick={handleOpenFilters}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] text-white/50 text-sm font-medium hover:bg-white/[0.12] hover:border-primary/30 hover:text-white/80 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <SlidersHorizontal className="w-4 h-4 text-primary/70" />
                {t("world.filterSettings")}
              </motion.button>

              {/* Stats */}
              <div className="flex items-center gap-4 mt-1">
                <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                  <Plane className="w-4 h-4 text-emerald-400" />
                  <span className="text-white/60 text-xs">{miles} {t("world.milesLabel")}</span>
                </div>
                <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-white/60 text-xs">{totalSessions} {t("world.sessionsLabel")}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SEARCHING STATE ── */}
          {state === "searching" && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-6"
            >
              <Globe3D state="spinning" onGlobeClick={() => {}} />

              <motion.div
                className="flex flex-col items-center gap-2"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                <p className="text-white/50 text-sm font-medium">{t("world.searching")}</p>
              </motion.div>

              {/* Search progress */}
              <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: SEARCH_MAX_RETRIES * SEARCH_RETRY_INTERVAL / 1000, ease: "linear" }}
                />
              </div>

              {searchError && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400/80 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2"
                >
                  {searchError}
                </motion.p>
              )}

              {/* Cancel search */}
              <motion.button
                onClick={handleCancelSearch}
                className="mt-2 px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-medium hover:bg-white/10 transition-all"
                whileTap={{ scale: 0.95 }}
              >
                {t("common.cancel")}
              </motion.button>
            </motion.div>
          )}

          {/* ── MATCHED STATE (brief celebration → auto-opens chat) ── */}
          {state === "matched" && matchedUser && (
            <motion.div
              key="matched"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-4 w-full max-w-sm"
            >
              <div className="mb-2">
                <Globe3D state="matched" onGlobeClick={() => {}} small />
              </div>
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-2xl font-black text-white mb-1">✨ {t("world.matchFound")}</h2>
                <p className="text-white/40 text-sm">{t("world.matchFoundDesc")}</p>
              </motion.div>
              {/* Loading indicator — auto-opening chat */}
              <motion.div
                className="flex items-center gap-2"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-white/40 text-xs">{t("world.openingChat")}</span>
              </motion.div>
            </motion.div>
          )}

          {/* ── ENDED STATE ── */}
          {state === "ended" && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full max-w-sm text-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Plane className="w-10 h-10 text-emerald-400" />
              </div>

              <div>
                <h2 className="text-xl font-black text-white mb-2">{t("world.sessionEnded")}</h2>
                <p className="text-white/40 text-sm">{t("world.sessionEndedDesc")}</p>
              </div>

              {/* Session Summary */}
              <div className="glass rounded-2xl p-5 w-full">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">{t("world.chat.duration")}</p>
                    <p className="text-white font-bold text-lg">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">{t("world.milesLabel")}</p>
                    <p className="text-emerald-400 font-bold text-lg">+{Math.floor(duration / 60)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">{t("world.messagesCount")}</p>
                    <p className="text-white font-bold text-lg">{messages.filter(m => m.type === "text").length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">{t("world.partner")}</p>
                    <p className="text-primary font-bold text-sm truncate">{matchedUser?.displayName || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <motion.button
                  onClick={() => navigate("/")}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 font-bold text-sm"
                  whileTap={{ scale: 0.95 }}
                >
                  {t("world.backHome")}
                </motion.button>
                <motion.button
                  onClick={handleNewSearch}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  whileTap={{ scale: 0.95 }}
                >
                  {t("world.searchAgain")}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filters Modal (opens from filter icon, not on every search) */}
      <FiltersModal
        isOpen={showFilters}
        onClose={handleCloseFilters}
        onStart={(filters) => {
          saveFilters(filters);
          handleCloseFilters();
          setSearchFilters(filters);
          handleStartSearch(filters);
        }}
        onSave={(filters) => {
          saveFilters(filters);
          handleCloseFilters();
        }}
        pricing={pricing}
        userCoins={userCoins}
        savedFilters={getSavedFilters()}
      />

      {/* Floating Chat Overlay */}
      <AnimatePresence>
        {renderFloatingChat && (
          <motion.div
            key="floating-chat"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50"
          >
            <WorldChat
              sessionId={sessionId!}
              currentUserId={currentUserId.current}
              matchedUser={matchedUser!}
              messages={messages}
              miles={miles}
              duration={duration}
              onSendMessage={handleSendMessage}
              onFollow={handleFollow}
              onFriendRequest={handleFriendRequest}
              onEndSession={handleEndSession}
              onReport={handleReport}
              onSkip={handleSkip}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              isFollowed={isFollowed}
              isFriendRequested={isFriendRequested}
              isPartnerTyping={isPartnerTyping}
              partnerDisconnected={partnerDisconnected}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
