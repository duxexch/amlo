import React from "react";
import { motion } from "framer-motion";

/* ─── GlassCard ─── */
export const GlassCard = ({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-3xl overflow-hidden ${className}`} {...props}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

/* ─── ShimmerButton ─── */
export const ShimmerButton = ({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={`relative overflow-hidden group ${className}`} {...props}>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
    {children}
  </button>
);

/* ─── CountUp — uses ref to avoid stale closure ─── */
export const CountUp = ({ value }: { value: number }) => {
  const [display, setDisplay] = React.useState(0);
  const fromRef = React.useRef(0);
  React.useEffect(() => {
    fromRef.current = display;
    const dur = 800;
    const start = performance.now();
    const from = fromRef.current;
    let raf: number;
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * ease));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString()}</>;
};

/* ─── Skeleton Loaders ─── */
export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-white/[0.06] rounded-2xl ${className}`} />
);

export const SkeletonCard = () => (
  <GlassCard className="p-6 space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="w-12 h-12 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  </GlassCard>
);

export const SkeletonGrid = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-32" />
    ))}
  </div>
);
