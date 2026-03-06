/**
 * Matching Screen — شاشة البحث عن شريك
 * ════════════════════════════════════════
 * Full-screen overlay shown while searching for a match:
 * - Animated searching indicator
 * - Timer counting up
 * - Cancel button
 * - Listens for match-found socket event
 * - Transitions to CallScreen with matched user data
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Users, Loader2, Video, Mic, Coins,
  UserCheck, Zap, Clock as ClockIcon, MessageCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSocket } from "@/lib/socketManager";
import { useLocation } from "wouter";
import type { MatchFilters } from "./RandomFiltersModal";

interface MatchedUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  country: string | null;
  level: number;
}

interface MatchingScreenProps {
  isOpen: boolean;
  filters: MatchFilters | null;
  onClose: () => void;
}

export function MatchingScreen({ isOpen, filters, onClose }: MatchingScreenProps) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"searching" | "found" | "timeout" | "error">("searching");
  const [timer, setTimer] = useState(0);
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);

  // Start matching when modal opens
  useEffect(() => {
    if (!isOpen || !filters || hasStartedRef.current) return;

    hasStartedRef.current = true;
    setStatus("searching");
    setTimer(0);
    setMatchedUser(null);
    setErrorMessage(null);

    const socket = getSocket();

    // Emit join queue event
    socket.emit("random-match-start", {
      type: filters.type,
      genderFilter: filters.genderFilter,
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      countryFilter: filters.countryFilter,
    });

    // Listen for match found
    const handleMatchFound = (data: {
      matchedUser: MatchedUser;
      sessionId: string;
      callType: "video" | "audio" | "text";
    }) => {
      setMatchedUser(data.matchedUser);
      setCallSessionId(data.sessionId);
      setStatus("found");

      // Navigate to appropriate screen after brief animation
      setTimeout(() => {
        if (data.callType === "text") {
          // Random text chat — open chat with matched user
          navigate(`/chat?partner=${data.matchedUser.id}&random=1`);
        } else {
          navigate(`/call?user=${data.matchedUser.id}&type=${data.callType}&session=${data.sessionId}&random=1`);
        }
        onClose();
      }, 1500);
    };

    // Listen for match error
    const handleMatchError = (data: { message: string; code?: string }) => {
      if (data.code === "INSUFFICIENT_COINS") {
        setErrorMessage(t("matching.insufficientCoins"));
      } else {
        setErrorMessage(data.message || t("matching.noMatch"));
      }
      setStatus("error");
    };

    // Listen for queue timeout
    const handleTimeout = () => {
      setStatus("timeout");
    };

    socket.on("random-match-found", handleMatchFound);
    socket.on("random-match-error", handleMatchError);
    socket.on("random-match-timeout", handleTimeout);

    // Start timer
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);

    return () => {
      socket.off("random-match-found", handleMatchFound);
      socket.off("random-match-error", handleMatchError);
      socket.off("random-match-timeout", handleTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
      hasStartedRef.current = false;
    };
  }, [isOpen, filters, navigate, onClose, t]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-timeout after 45 seconds — prevents infinite waiting
  useEffect(() => {
    if (!isOpen || status !== "searching") return;
    const timeout = setTimeout(() => {
      setStatus("timeout");
      const socket = getSocket();
      socket.emit("random-match-cancel");
    }, 45_000);
    return () => clearTimeout(timeout);
  }, [isOpen, status]);

  const handleCancel = useCallback(() => {
    const socket = getSocket();
    socket.emit("random-match-cancel");
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setStatus("searching");
    setTimer(0);
    setMatchedUser(null);
    setErrorMessage(null);
    hasStartedRef.current = false;

    if (filters) {
      const socket = getSocket();
      socket.emit("random-match-start", {
        type: filters.type,
        genderFilter: filters.genderFilter,
        ageMin: filters.ageMin,
        ageMax: filters.ageMax,
        countryFilter: filters.countryFilter,
      });

      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
  }, [filters]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#0a0a1a] flex flex-col items-center justify-center"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-secondary/5 blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="absolute top-6 left-6 z-10 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors backdrop-blur-sm"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>

        {/* Call type indicator */}
        <div className="absolute top-6 right-6 flex items-center gap-2 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full">
          {filters?.type === "video" ? (
            <Video className="w-4 h-4 text-primary" />
          ) : filters?.type === "text" ? (
            <MessageCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <Mic className="w-4 h-4 text-secondary" />
          )}
          <span className="text-white/60 text-xs font-bold">
            {filters?.type === "video" ? t("matching.video") : filters?.type === "text" ? t("matching.text") : t("matching.audio")}
          </span>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-6">
          <AnimatePresence mode="wait">
            {/* Searching State */}
            {status === "searching" && (
              <motion.div
                key="searching"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-6"
              >
                {/* Animated search rings */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/20"
                    animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/10"
                    animate={{ scale: [1, 2.1, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                  />
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                    filters?.type === "video" ? "bg-primary/20" : filters?.type === "text" ? "bg-emerald-500/20" : "bg-secondary/20"
                  }`}>
                    {filters?.type === "text" ? (
                      <MessageCircle className="w-12 h-12 text-emerald-400" />
                    ) : (
                      <Users className={`w-12 h-12 ${
                        filters?.type === "video" ? "text-primary" : "text-secondary"
                      }`} />
                    )}
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="text-2xl font-black text-white mb-2">
                    {t("matching.searching")}
                  </h2>
                  <p className="text-white/40 text-sm max-w-xs">
                    {t("matching.searchingDesc")}
                  </p>
                </div>

                {/* Timer */}
                <div className="flex items-center gap-2 text-white/30">
                  <ClockIcon className="w-4 h-4" />
                  <span className="font-mono text-lg font-bold">{formatTime(timer)}</span>
                </div>

                {/* Cancel */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancel}
                  className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-colors border border-white/10"
                >
                  {t("matching.cancel")}
                </motion.button>
              </motion.div>
            )}

            {/* Match Found State */}
            {status === "found" && matchedUser && (
              <motion.div
                key="found"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 10, stiffness: 200 }}
                  className="w-32 h-32 rounded-full bg-emerald-500/20 border-4 border-emerald-500/40 flex items-center justify-center"
                >
                  <UserCheck className="w-16 h-16 text-emerald-400" />
                </motion.div>

                <div className="text-center">
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-black text-white mb-1"
                  >
                    {t("matching.matchFound")}
                  </motion.h2>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-white/50 text-base font-bold"
                  >
                    {matchedUser.displayName}
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-2 text-emerald-400 text-sm"
                >
                  <Zap className="w-4 h-4" />
                  {t("matching.connecting")}...
                </motion.div>
              </motion.div>
            )}

            {/* Timeout State */}
            {status === "timeout" && (
              <motion.div
                key="timeout"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="w-32 h-32 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center">
                  <ClockIcon className="w-16 h-16 text-amber-400/60" />
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-black text-white mb-2">
                    {t("matching.timeout")}
                  </h2>
                  <p className="text-white/40 text-sm max-w-xs">
                    {t("matching.noMatch")}
                  </p>
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRetry}
                    className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                  >
                    {t("matching.tryAgain")}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCancel}
                    className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-colors border border-white/10"
                  >
                    {t("matching.cancel")}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Error State */}
            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="w-32 h-32 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
                  <Coins className="w-16 h-16 text-red-400/60" />
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-black text-white mb-2">
                    {errorMessage || t("matching.noMatch")}
                  </h2>
                  <p className="text-white/40 text-sm max-w-xs">
                    {t("matching.insufficientCoins") === errorMessage
                      ? t("matching.recharge")
                      : t("matching.tryAgain")
                    }
                  </p>
                </div>

                <div className="flex gap-3">
                  {errorMessage === t("matching.insufficientCoins") ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { navigate("/wallet"); onClose(); }}
                      className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-white font-bold text-sm transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                    >
                      {t("matching.recharge")}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleRetry}
                      className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors"
                    >
                      {t("matching.tryAgain")}
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCancel}
                    className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-colors border border-white/10"
                  >
                    {t("matching.cancel")}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
