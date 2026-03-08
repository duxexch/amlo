import { useRef, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

interface Globe3DProps {
  state: "idle" | "spinning" | "matched" | "chatting";
  onGlobeClick: () => void;
  searchProgress?: number;
  userCountry?: string;
  matchedCountry?: string;
  onFlightComplete?: () => void;
  small?: boolean;
}

type Point = { x: number; y: number };

const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  egypt: { lat: 26.8, lon: 30.8 },
  "مصر": { lat: 26.8, lon: 30.8 },
  saudi: { lat: 23.9, lon: 45.1 },
  "saudi arabia": { lat: 23.9, lon: 45.1 },
  "السعودية": { lat: 23.9, lon: 45.1 },
  uae: { lat: 24.3, lon: 54.3 },
  "united arab emirates": { lat: 24.3, lon: 54.3 },
  "الامارات": { lat: 24.3, lon: 54.3 },
  jordan: { lat: 31.2, lon: 36.3 },
  "الأردن": { lat: 31.2, lon: 36.3 },
  iraq: { lat: 33.2, lon: 43.7 },
  "العراق": { lat: 33.2, lon: 43.7 },
  syria: { lat: 35, lon: 38.5 },
  "سوريا": { lat: 35, lon: 38.5 },
  lebanon: { lat: 33.9, lon: 35.8 },
  "لبنان": { lat: 33.9, lon: 35.8 },
  kuwait: { lat: 29.3, lon: 47.5 },
  "الكويت": { lat: 29.3, lon: 47.5 },
  qatar: { lat: 25.3, lon: 51.2 },
  "قطر": { lat: 25.3, lon: 51.2 },
  bahrain: { lat: 26.1, lon: 50.5 },
  "البحرين": { lat: 26.1, lon: 50.5 },
  oman: { lat: 21.5, lon: 55.9 },
  "عمان": { lat: 21.5, lon: 55.9 },
  yemen: { lat: 15.5, lon: 47.5 },
  "اليمن": { lat: 15.5, lon: 47.5 },
  morocco: { lat: 31.8, lon: -7.1 },
  "المغرب": { lat: 31.8, lon: -7.1 },
  algeria: { lat: 28, lon: 1.7 },
  "الجزائر": { lat: 28, lon: 1.7 },
  tunisia: { lat: 34, lon: 9.5 },
  "تونس": { lat: 34, lon: 9.5 },
  libya: { lat: 26.3, lon: 17.2 },
  "ليبيا": { lat: 26.3, lon: 17.2 },
  usa: { lat: 39.8, lon: -98.6 },
  "united states": { lat: 39.8, lon: -98.6 },
  uk: { lat: 54.6, lon: -2.5 },
  "united kingdom": { lat: 54.6, lon: -2.5 },
  germany: { lat: 51.1, lon: 10.4 },
  france: { lat: 46.2, lon: 2.2 },
  turkey: { lat: 39, lon: 35.2 },
  "تركيا": { lat: 39, lon: 35.2 },
  india: { lat: 22.6, lon: 79.1 },
  pakistan: { lat: 30.4, lon: 69.4 },
  "باكستان": { lat: 30.4, lon: 69.4 },
  indonesia: { lat: -2.5, lon: 118 },
  japan: { lat: 36.2, lon: 138.2 },
  brazil: { lat: -14.2, lon: -51.9 },
  canada: { lat: 56.1, lon: -106.3 },
  australia: { lat: -25.2, lon: 133.8 },
};

function normalizeCountryKey(country?: string): string {
  return String(country || "").trim().toLowerCase();
}

function hashCountryToCoord(country?: string): { lat: number; lon: number } {
  const source = normalizeCountryKey(country) || "unknown";
  let h = 0;
  for (let i = 0; i < source.length; i++) h = (h * 31 + source.charCodeAt(i)) | 0;
  const lat = ((h % 120) + 120) % 120 - 60;
  const lon = (((h >> 3) % 360) + 360) % 360 - 180;
  return { lat, lon };
}

function countryToPoint(country: string | undefined, size: number, radius: number): Point {
  const key = normalizeCountryKey(country);
  const coord = COUNTRY_COORDS[key] || hashCountryToCoord(country);
  const x = size + (coord.lon / 180) * radius * 0.78;
  const y = size - (coord.lat / 90) * radius * 0.62;
  return { x, y };
}

export function Globe3D({ state, onGlobeClick, searchProgress = 0, userCountry, matchedCountry, onFlightComplete, small }: Globe3DProps) {
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

    const clampedProgress = Math.max(0, Math.min(1, searchProgress || 0));
    const speed = state === "spinning"
      ? (0.002 + Math.pow(clampedProgress, 1.9) * 0.055)
      : state === "idle"
        ? 0.0009
        : state === "matched"
          ? 0.0013
          : 0.0008;

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

      {/* Airplane flight to matched partner country */}
      {state === "matched" && (
        <MatchedFlight
          small={small}
          fromCountry={userCountry}
          toCountry={matchedCountry}
          onComplete={onFlightComplete}
        />
      )}

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
  const s = small ? 76 : 136;
  const path = useMemo(() => {
    const points = 8;
    const out: Point[] = [];
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const jitter = (Math.sin(i * 1.73) + Math.cos(i * 2.17)) * 0.12;
      const x = Math.cos(a) * s * (1 + jitter);
      const y = Math.sin(a) * (s * 0.6) * (1 - jitter * 0.7);
      out.push({ x, y });
    }
    out.push(out[0]);
    return out;
  }, [s]);

  const xFrames = path.map((p) => p.x);
  const yFrames = path.map((p) => p.y);

  return (
    <motion.div
      className="absolute z-30 pointer-events-none"
      animate={{
        x: xFrames,
        y: yFrames,
        rotate: [10, 60, 130, 185, 242, 302, 356, 410, 460],
      }}
      transition={{
        duration: small ? 11 : 14,
        ease: "linear",
        repeat: Infinity,
      }}
    >
      <div className="relative">
        <WarplaneIcon className="w-9 h-9 text-slate-200 drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" />
        <div className="absolute top-1/2 -translate-y-1/2 -right-14 w-14 h-0.5 bg-gradient-to-l from-transparent via-white/70 to-white/10 rounded-full" />
      </div>
    </motion.div>
  );
}

function MatchedFlight({
  small,
  fromCountry,
  toCountry,
  onComplete,
}: {
  small?: boolean;
  fromCountry?: string;
  toCountry?: string;
  onComplete?: () => void;
}) {
  const size = small ? 200 : 320;
  const radius = size * 0.85;

  const start = useMemo(() => countryToPoint(fromCountry, size, radius), [fromCountry, size, radius]);
  const end = useMemo(() => countryToPoint(toCountry, size, radius), [toCountry, size, radius]);

  const control = useMemo(() => {
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    return {
      x: mx,
      y: my - Math.min(90, Math.max(36, dist * 0.22)),
    };
  }, [start, end]);

  const [planePos, setPlanePos] = useState<{ x: number; y: number; angle: number }>({ x: start.x, y: start.y, angle: 0 });
  const [trailPath, setTrailPath] = useState<Point[]>([{ x: start.x, y: start.y }]);

  useEffect(() => {
    let raf = 0;
    let completed = false;
    const durationMs = small ? 4200 : 5600;
    const startedAt = performance.now();

    const pointAt = (t: number): Point => {
      const u = 1 - t;
      return {
        x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      };
    };

    const tangentAt = (t: number): Point => ({
      x: 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
      y: 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y),
    });

    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
      const eased = 1 - Math.pow(1 - progress, 2.15);
      const point = pointAt(eased);
      const tangent = tangentAt(eased);
      const angle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;

      setPlanePos({ x: point.x, y: point.y, angle });
      setTrailPath((prev) => {
        const next = [...prev, point];
        return next.slice(-52);
      });

      if (progress >= 1) {
        if (!completed) {
          completed = true;
          onComplete?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    setTrailPath([{ x: start.x, y: start.y }]);
    setPlanePos({ x: start.x, y: start.y, angle: 0 });
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [small, start, end, control, onComplete]);

  const smokePath = useMemo(() => {
    if (trailPath.length < 2) return "";
    return trailPath
      .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [trailPath]);

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size * 2} ${size * 2}`} preserveAspectRatio="none">
        {smokePath && (
          <path
            d={smokePath}
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={small ? 1.4 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>

      <div
        className="absolute"
        style={{
          left: planePos.x,
          top: planePos.y,
          transform: `translate(-50%, -50%) rotate(${planePos.angle}deg)`,
          transformOrigin: "center center",
        }}
      >
        <WarplaneIcon className="w-10 h-10 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
      </div>
    </div>
  );
}

function WarplaneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M59 31.2 44.5 27l-9.7-13.9c-1.1-1.6-3.5-1.6-4.6 0L20.5 27 6 31.2c-1.4.4-1.9 2.1-.9 3.1l9.3 9.5-2 8.4c-.3 1.4 1.1 2.5 2.4 1.9L32 46.6l17.2 7.5c1.3.6 2.7-.5 2.4-1.9l-2-8.4 9.3-9.5c1-1 .5-2.7-.9-3.1ZM31.9 39.7l-8.5 3.7 1.1-4.8-5.3-5.4 8.3-2.3 4.4-6.4 4.4 6.4 8.3 2.3-5.3 5.4 1.1 4.8-8.5-3.7Z"
      />
      <rect x="29.5" y="6" width="5" height="9" rx="2" fill="currentColor" opacity="0.9" />
    </svg>
  );
}
