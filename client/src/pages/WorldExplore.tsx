import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plane, Globe as GlobeIcon, Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { worldApi, WorldSearchFilters } from "@/lib/worldApi";
import { Globe3D } from "@/components/world/Globe3D";
import { FiltersModal } from "@/components/world/FiltersModal";
import { MatchedUserCard } from "@/components/world/MatchedUserCard";
import { MilesCounter } from "@/components/world/MilesCounter";
import { WorldChat } from "@/components/world/WorldChat";

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

  // Match
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Chat
  const [messages, setMessages] = useState<any[]>([]);
  const [duration, setDuration] = useState(0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFriendRequested, setIsFriendRequested] = useState(false);

  // Refs
  const durationInterval = useRef<any>(null);
  const messagesPoll = useRef<any>(null);
  const currentUserId = useRef<string>("");

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

  // ── Poll messages while chatting ──
  useEffect(() => {
    if (state === "chatting" && sessionId) {
      const poll = () => {
        worldApi.messages(sessionId).then(data => {
          if (Array.isArray(data)) setMessages(data);
        }).catch(() => {});
      };
      poll();
      messagesPoll.current = setInterval(poll, 2000);
    } else {
      if (messagesPoll.current) clearInterval(messagesPoll.current);
    }
    return () => { if (messagesPoll.current) clearInterval(messagesPoll.current); };
  }, [state, sessionId]);

  // ── Handlers ──
  const handleOpenFilters = () => {
    setState("filters");
  };

  const handleCloseFilters = () => {
    setState("idle");
  };

  const handleStartSearch = useCallback(async (filters: WorldSearchFilters) => {
    setSearchFilters(filters);
    setState("searching");
    setSearchError(null);

    try {
      const result = await worldApi.search(filters);
      if (result.sessionId && result.matchedUser) {
        setSessionId(result.sessionId);
        setMatchedUser(result.matchedUser);
        setMiles(result.miles || miles);
        setUserCoins(result.remainingCoins ?? userCoins);
        setState("matched");
      } else {
        setSearchError(t("world.noMatch"));
        setTimeout(() => {
          setState("idle");
          setSearchError(null);
        }, 3000);
      }
    } catch (err: any) {
      const msg = err?.message || t("world.searchError");
      setSearchError(msg);
      setTimeout(() => {
        setState("idle");
        setSearchError(null);
      }, 3000);
    }
  }, [miles, userCoins, t]);

  const handleStartChat = () => {
    setState("chatting");
  };

  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;
    try {
      const newMsg = await worldApi.sendMessage(sessionId, { content, type: "text" });
      setMessages(prev => [...prev, newMsg]);
    } catch {}
  };

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

  const handleEndSession = async () => {
    if (!sessionId) return;
    try {
      const result = await worldApi.endSession(sessionId);
      setMiles(result?.miles || miles);
    } catch {}
    setState("ended");
    // Clean up
    if (durationInterval.current) clearInterval(durationInterval.current);
    if (messagesPoll.current) clearInterval(messagesPoll.current);
  };

  const handleNewSearch = () => {
    setMatchedUser(null);
    setSessionId(null);
    setMessages([]);
    setDuration(0);
    setIsFollowed(false);
    setIsFriendRequested(false);
    setState("idle");
  };

  // ── Chatting State Renders Full Screen ──
  if (state === "chatting" && matchedUser && sessionId) {
    return (
      <WorldChat
        sessionId={sessionId}
        currentUserId={currentUserId.current}
        matchedUser={matchedUser}
        messages={messages}
        miles={miles}
        duration={duration}
        onSendMessage={handleSendMessage}
        onFollow={handleFollow}
        onFriendRequest={handleFriendRequest}
        onEndSession={handleEndSession}
        isFollowed={isFollowed}
        isFriendRequested={isFriendRequested}
      />
    );
  }

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
          {(state === "idle" || state === "filters") && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-6"
            >
              <Globe3D state="idle" onGlobeClick={handleOpenFilters} />

              {/* Tap to explore */}
              <motion.p
                className="text-white/30 text-sm font-medium"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
              >
                {t("world.tapToExplore")}
              </motion.p>

              {/* Stats */}
              <div className="flex items-center gap-4 mt-2">
                <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                  <Plane className="w-4 h-4 text-emerald-400" />
                  <span className="text-white/60 text-xs">{miles} {t("world.milesLabel")}</span>
                </div>
                <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-white/60 text-xs">{totalSessions} {t("world.sessionsLabel")}</span>
                </div>
              </div>

              {/* Start Button */}
              <motion.button
                onClick={handleOpenFilters}
                className="mt-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold py-3.5 px-10 rounded-2xl text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t("world.startExploring")}
              </motion.button>
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

              {searchError && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400/80 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2"
                >
                  {searchError}
                </motion.p>
              )}
            </motion.div>
          )}

          {/* ── MATCHED STATE ── */}
          {state === "matched" && matchedUser && (
            <motion.div
              key="matched"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center gap-6 w-full max-w-sm"
            >
              {/* Mini globe */}
              <div className="mb-2">
                <Globe3D state="matched" onGlobeClick={() => {}} small />
              </div>

              {/* Match celebration */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-2xl font-black text-white mb-1">✨ {t("world.matchFound")}</h2>
                <p className="text-white/40 text-sm">{t("world.matchFoundDesc")}</p>
              </motion.div>

              <MatchedUserCard
                user={matchedUser}
                onFollow={handleFollow}
                onStartChat={handleStartChat}
                isFollowed={isFollowed}
              />
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

      {/* Filters Modal */}
      <FiltersModal
        isOpen={state === "filters"}
        onClose={handleCloseFilters}
        onStart={(filters) => {
          handleCloseFilters();
          handleStartSearch(filters);
        }}
        pricing={pricing}
        userCoins={userCoins}
      />
    </div>
  );
}
