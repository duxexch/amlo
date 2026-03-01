import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plane } from "lucide-react";

interface Globe3DProps {
  state: "idle" | "spinning" | "matched" | "chatting";
  onGlobeClick: () => void;
  matchedCountry?: string;
  small?: boolean;
}

export function Globe3D({ state, onGlobeClick, matchedCountry, small }: Globe3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load earth texture
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    img.onerror = () => {
      // Fallback: draw a gradient sphere
      setLoaded(true);
    };
  }, []);

  // Canvas globe drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = small ? 200 : 320;
    canvas.width = size * 2; // retina
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const cx = size;
    const cy = size;
    const radius = size * 0.85;

    const speed = state === "spinning" ? 0.02 : state === "idle" ? 0.002 : 0.001;

    const draw = () => {
      ctx.clearRect(0, 0, size * 2, size * 2);

      // Atmosphere glow
      const atmosGrad = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.3);
      atmosGrad.addColorStop(0, "rgba(16, 185, 129, 0.0)");
      atmosGrad.addColorStop(0.6, "rgba(16, 185, 129, 0.08)");
      atmosGrad.addColorStop(0.8, "rgba(168, 85, 247, 0.06)");
      atmosGrad.addColorStop(1, "rgba(168, 85, 247, 0.0)");
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = atmosGrad;
      ctx.fill();

      // Globe clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      if (imgRef.current) {
        // Draw texture with rotation offset
        const imgWidth = imgRef.current.width;
        const imgHeight = imgRef.current.height;
        const offsetX = (rotationRef.current * imgWidth) / (Math.PI * 2);

        // Draw image twice for seamless wrapping
        const drawW = radius * 4;
        const drawH = radius * 2;
        const startX = cx - radius - (offsetX % drawW);
        const startY = cy - radius;

        ctx.drawImage(imgRef.current, startX, startY, drawW, drawH);
        ctx.drawImage(imgRef.current, startX + drawW, startY, drawW, drawH);
        ctx.drawImage(imgRef.current, startX - drawW, startY, drawW, drawH);
      } else {
        // Fallback gradient globe
        const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
        grad.addColorStop(0, "#1e4d8a");
        grad.addColorStop(0.5, "#0d3b6e");
        grad.addColorStop(1, "#062240");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size * 2, size * 2);

        // Draw some "continents"
        const numDots = 80;
        for (let i = 0; i < numDots; i++) {
          const angle = (i / numDots) * Math.PI * 2 + rotationRef.current;
          const lat = Math.sin(i * 2.5) * radius * 0.7;
          const x = cx + Math.cos(angle) * radius * 0.6 * Math.cos(lat / radius);
          const y = cy + lat * 0.8;
          const dotRadius = 3 + Math.sin(i * 3.7) * 2;

          if (Math.cos(angle) > -0.2) {
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(34, 197, 94, ${0.2 + Math.cos(angle) * 0.3})`;
            ctx.fill();
          }
        }
      }

      // Light/shadow overlay
      const lightGrad = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.3, 0, cx, cy, radius);
      lightGrad.addColorStop(0, "rgba(255,255,255,0.08)");
      lightGrad.addColorStop(0.5, "rgba(0,0,0,0.0)");
      lightGrad.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = lightGrad;
      ctx.fillRect(0, 0, size * 2, size * 2);

      ctx.restore();

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = state === "spinning" ? "rgba(16, 185, 129, 0.4)" : "rgba(168, 85, 247, 0.15)";
      ctx.lineWidth = 2;
      ctx.stroke();

      rotationRef.current += speed;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [loaded, state, small]);

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Pulse rings */}
      {state === "idle" && (
        <>
          <div className="absolute inset-0 rounded-full animate-pulse-ring" style={{ animationDelay: "0s" }} />
          <div className="absolute inset-0 rounded-full animate-pulse-ring" style={{ animationDelay: "1s" }} />
        </>
      )}

      {/* Spinning glow */}
      {state === "spinning" && (
        <motion.div
          className="absolute inset-[-20px] rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{
            background: "conic-gradient(from 0deg, transparent, rgba(16,185,129,0.3), transparent, rgba(6,182,212,0.2), transparent)",
          }}
        />
      )}

      {/* Canvas Globe */}
      <canvas
        ref={canvasRef}
        onClick={state === "idle" ? onGlobeClick : undefined}
        className={`relative z-10 ${state === "idle" ? "cursor-pointer hover:scale-105 transition-transform" : ""}`}
      />

      {/* Airplane animation during spinning */}
      {state === "spinning" && <AirplaneOrbit small={small} />}

      {/* Tap hint */}
      {state === "idle" && !small && (
        <motion.div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-20"
          animate={{ y: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <span className="text-white/30 text-xs font-medium">{/* tap indicator handled by parent */}</span>
        </motion.div>
      )}
    </div>
  );
}

// ── Airplane orbiting animation ──
function AirplaneOrbit({ small }: { small?: boolean }) {
  const s = small ? 80 : 140;
  return (
    <motion.div
      className="absolute z-30 pointer-events-none"
      animate={{
        x: [0, s, 0, -s, 0],
        y: [-s * 0.6, 0, s * 0.6, 0, -s * 0.6],
        rotate: [0, 90, 180, 270, 360],
      }}
      transition={{
        duration: 3,
        ease: "linear",
        repeat: Infinity,
      }}
    >
      <div className="relative">
        <Plane className="w-8 h-8 text-white drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]" style={{ transform: "rotate(-45deg)" }} />
        {/* Trail */}
        <div className="absolute top-1/2 -translate-y-1/2 -right-12 w-12 h-0.5 bg-gradient-to-l from-transparent to-emerald-400/60 rounded-full" />
      </div>
    </motion.div>
  );
}
