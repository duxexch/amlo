import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";

interface CallPopupProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  callerName?: string;
  isVideo?: boolean;
}

/** Generates a repeating ringtone using Web Audio API */
function useRingtone(isOpen: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ctxRef.current) ctxRef.current.close().catch(() => { });
      ctxRef.current = null;
      intervalRef.current = null;
      return;
    }

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    const playRingBurst = () => {
      const now = ctx.currentTime;
      for (const freq of [440, 480]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.07, now + 0.05);
        gain.gain.setValueAtTime(0.07, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.05);
      }
    };

    playRingBurst();
    intervalRef.current = setInterval(playRingBurst, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      ctx.close().catch(() => { });
      ctxRef.current = null;
      intervalRef.current = null;
    };
  }, [isOpen]);
}

/**
 * Compact top-of-screen incoming call banner.
 * Overlays above the app without pushing layout, auto-dismisses after 30s.
 */
export function CallPopup({ isOpen, onAccept, onDecline, callerName, isVideo = true }: CallPopupProps) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const displayName = callerName || t("callPopup.defaultCaller");
  const colors = ["from-primary to-secondary", "from-cyan-400 to-blue-500", "from-pink-400 to-rose-500", "from-amber-400 to-orange-500"];
  const color = colors[Math.abs((displayName || "").charCodeAt(0)) % colors.length];
  const initial = (displayName || "?")[0]?.toUpperCase();
  useRingtone(isOpen);

  // Auto-decline after 30s (server timeout is ~35s)
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onDecline, 30_000);
    return () => clearTimeout(timer);
  }, [isOpen, onDecline]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          dir={dir}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[100] pointer-events-none safe-area-top"
        >
          <div className="mx-3 mt-3 pointer-events-auto rounded-2xl bg-[#101028]/95 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Animated accent bar */}
            <div className="h-[3px] bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]" />

            <div className="flex items-center gap-3 px-4 py-3">
              {/* Caller avatar */}
              <div className="relative shrink-0">
                <motion.div
                  className="absolute inset-0 rounded-xl bg-primary/20"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-lg font-bold text-white relative z-10`}>
                  {initial}
                </div>
              </div>

              {/* Caller info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{displayName}</p>
                <p className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                  {isVideo
                    ? <><Video className="w-3 h-3 text-blue-400" /> {t("callPopup.incomingVideo")}</>
                    : <><Phone className="w-3 h-3 text-emerald-400" /> {t("callPopup.incomingAudio")}</>
                  }
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onDecline}
                  className="w-11 h-11 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.4)] active:bg-red-600"
                >
                  <PhoneOff className="w-5 h-5 text-white" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onAccept}
                  className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_12px_rgba(52,211,153,0.4)] active:bg-emerald-600"
                >
                  <Phone className="w-5 h-5 text-white" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}