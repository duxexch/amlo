/**
 * GiftAnimation — تأثيرات الهدايا المتحركة
 * ==========================================
 * Renders animated gift effects when gifts are sent in streams.
 * Uses CSS keyframe animations + requestAnimationFrame for smooth rendering.
 */
import { useState, useEffect, useCallback, useRef } from "react";

interface GiftAnimationProps {
  gift: {
    id: string;
    name: string;
    icon: string;
    price: number;
  };
  sender: {
    name: string;
  };
  onComplete?: () => void;
}

// ── Particle effect for premium gifts (price >= 500) ──
function GiftParticles({ count, color }: { count: number; color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i;
        const delay = Math.random() * 0.3;
        const distance = 60 + Math.random() * 80;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full"
            style={{
              backgroundColor: color,
              animation: `gift-particle 1.2s ${delay}s ease-out forwards`,
              transform: `translate(-50%, -50%)`,
              ["--px" as any]: `${Math.cos((angle * Math.PI) / 180) * distance}px`,
              ["--py" as any]: `${Math.sin((angle * Math.PI) / 180) * distance}px`,
            }}
          />
        );
      })}
    </div>
  );
}

export function GiftAnimation({ gift, sender, onComplete }: GiftAnimationProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isPremium = gift.price >= 500;
  const isLegendary = gift.price >= 2000;

  useEffect(() => {
    const duration = isLegendary ? 4000 : isPremium ? 3000 : 2000;
    timerRef.current = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPremium, isLegendary, onComplete]);

  if (!visible) return null;

  const animClass = isLegendary
    ? "animate-gift-legendary"
    : isPremium
      ? "animate-gift-premium"
      : "animate-gift-basic";

  const glowColor = isLegendary
    ? "rgba(255, 215, 0, 0.6)"
    : isPremium
      ? "rgba(168, 85, 247, 0.5)"
      : "rgba(59, 130, 246, 0.3)";

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
      <div className={`relative ${animClass}`}>
        {/* Glow effect */}
        {(isPremium || isLegendary) && (
          <div
            className="absolute inset-0 rounded-full blur-xl"
            style={{
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
              transform: "scale(2)",
              animation: "gift-glow 1.5s ease-in-out infinite alternate",
            }}
          />
        )}

        {/* Particles for premium */}
        {isPremium && (
          <GiftParticles
            count={isLegendary ? 20 : 12}
            color={isLegendary ? "#FFD700" : "#A855F7"}
          />
        )}

        {/* Gift icon */}
        <div className="relative text-6xl md:text-8xl animate-bounce">
          {gift.icon}
        </div>

        {/* Gift info banner */}
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap
                     bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full
                     text-sm font-bold shadow-lg animate-gift-slide-up"
        >
          <span className="text-yellow-400">{sender.name}</span>
          <span className="mx-1">أرسل</span>
          <span className="text-pink-400">{gift.name}</span>
          {gift.price > 0 && (
            <span className="text-amber-300 mr-1">🪙 {gift.price}</span>
          )}
        </div>

        {/* Combo counter for legendary */}
        {isLegendary && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl font-black text-yellow-400 animate-gift-combo">
            ✨ أسطوري ✨
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gift Animation Queue Manager ──
// Manages multiple gifts arriving in rapid succession
interface QueuedGift {
  id: string;
  gift: GiftAnimationProps["gift"];
  sender: GiftAnimationProps["sender"];
}

export function GiftAnimationQueue() {
  const [queue, setQueue] = useState<QueuedGift[]>([]);
  const [current, setCurrent] = useState<QueuedGift | null>(null);

  const processQueue = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrent(null);
        return prev;
      }
      const [next, ...rest] = prev;
      setCurrent(next);
      return rest;
    });
  }, []);

  // Process queue when current finishes
  const handleComplete = useCallback(() => {
    processQueue();
  }, [processQueue]);

  // Start processing when items arrive
  useEffect(() => {
    if (!current && queue.length > 0) {
      processQueue();
    }
  }, [current, queue.length, processQueue]);

  // Public method to add gift to queue (attach to window for socket events)
  useEffect(() => {
    (window as any).__addGiftAnimation = (gift: QueuedGift) => {
      setQueue((prev) => [...prev.slice(-9), gift]); // max 10 queued
    };
    return () => {
      delete (window as any).__addGiftAnimation;
    };
  }, []);

  if (!current) return null;

  return (
    <GiftAnimation
      key={current.id}
      gift={current.gift}
      sender={current.sender}
      onComplete={handleComplete}
    />
  );
}

export default GiftAnimation;
