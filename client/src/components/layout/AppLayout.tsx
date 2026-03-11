import { Link, useLocation } from "wouter";
import { Home, Wallet, Radio, User, MessageCircle, LogIn, Download, Film, Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/authApi";
import { useReelUploadState, dismissReelUpload } from "@/hooks/useReelUpload";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [showDownload, setShowDownload] = useState(false);

  // Cached auth check via React Query — shared across all components
  const { data: authUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => authApi.me(),
    staleTime: 5 * 60 * 1000, // 5 minutes — don't re-fetch on every mount
    retry: false,
  });
  const isLoggedIn = Boolean(authUser);
  const authPayload: any = authUser as any;
  const authUserData = authPayload?.data?.user || authPayload?.data || null;
  const headerAvatar = typeof authUserData?.avatar === "string" ? authUserData.avatar : "";

  // Only fetch download visibility once
  useEffect(() => {
    fetch("/api/app-download")
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.enabled) {
          setShowDownload(true);
        }
      })
      .catch(() => { });
  }, []);

  // Pages without navigation (full-screen experiences)
  const noNavPages = ["/admin", "/auth", "/room"];
  if (noNavPages.some(page => location.startsWith(page))) {
    return <div className="min-h-screen bg-black" dir={dir}>{children}</div>;
  }

  const navItems = [
    { icon: Home, label: t("nav.home"), path: "/" },
    { icon: Radio, label: t("nav.liveStream"), path: "/live" },
    { icon: Film, label: t("nav.cex"), path: "/cex" },
    { icon: MessageCircle, label: t("nav.social"), path: "/friends" },
    { icon: Wallet, label: t("nav.wallet"), path: "/wallet" },
    { icon: User, label: t("nav.profile"), path: "/profile" },
  ];
  const mobileNavItems = navItems.filter((item) => item.path !== "/profile");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row pb-20 md:pb-0 font-sans" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-e border-white/10 h-screen sticky top-0 z-40 p-4">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-xl neon-border text-white">A</div>
          <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary" style={{ fontFamily: 'Outfit' }}>Ablox</span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path || (location.startsWith(item.path) && item.path !== '/' && item.path !== '/room');
            const isRoomActive = item.path === '/live' && (location.startsWith('/live') || location.startsWith('/room'));
            const actuallyActive = isActive || isRoomActive;

            return (
              <Link key={item.path} href={item.path}>
                <a className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  actuallyActive
                    ? "bg-primary/20 text-primary neon-border"
                    : "hover:bg-white/5 text-muted-foreground hover:text-white"
                )}>
                  <item.icon className={cn("w-5 h-5", actuallyActive && "animate-pulse")} />
                  <span className="font-bold text-lg">{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
          {showDownload && (
            <Link href="/download">
              <a className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                location === "/download"
                  ? "bg-primary/20 text-primary neon-border"
                  : "hover:bg-white/5 text-muted-foreground hover:text-white"
              )}>
                <Download className={cn("w-5 h-5", location === "/download" && "animate-pulse")} />
                <span className="font-bold text-lg">{t("nav.download")}</span>
              </a>
            </Link>
          )}
          <LanguageSwitcher />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-2 overflow-y-auto">
        <div className="md:hidden flex justify-between items-center mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-xl neon-border text-white" aria-label="Ablox">A</div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {showDownload && (
              <Link href="/download"><button className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center hover:bg-green-500/20 transition-all" aria-label={t("nav.download")}><Download className="w-5 h-5 text-green-400" /></button></Link>
            )}
            {!isLoggedIn && (
              <Link href="/auth"><button className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold border border-primary/20 flex items-center gap-1.5" aria-label={t("common.login")}><LogIn className="w-4 h-4" />{t("common.login")}</button></Link>
            )}
            {isLoggedIn && (
              <Link href="/profile">
                <button
                  className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all overflow-hidden"
                  aria-label={t("nav.profile")}
                >
                  {headerAvatar ? (
                    <img src={headerAvatar} alt={t("nav.profile")} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-primary" />
                  )}
                </button>
              </Link>
            )}
          </div>
        </div>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 z-50 px-6 py-3 flex justify-between items-center safe-area-bottom">
        {mobileNavItems.map((item) => {
          const isActive = location === item.path || (location.startsWith(item.path) && item.path !== '/' && item.path !== '/live');
          const isRoomActive = item.path === '/live' && (location.startsWith('/live') || location.startsWith('/room'));
          const actuallyActive = isActive || isRoomActive;

          return (
            <Link key={item.path} href={item.path}>
              <a className="flex flex-col items-center gap-1 relative">
                {actuallyActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute -top-3 w-12 h-1 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]"
                  />
                )}
                <item.icon className={cn("w-6 h-6 transition-all duration-300", actuallyActive ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-xs font-bold transition-all duration-300", actuallyActive ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Floating reel upload indicator */}
      <ReelUploadIndicator />
    </div>
  );
}

// ═══════════════════════════════════════════════
// ── Floating Reel Upload Indicator (Draggable) ──
// ═══════════════════════════════════════════════
const PILL_SIZE = 48;
const CARD_W = 280;
const CARD_H = 100;
const EDGE_PAD = 8;

function ReelUploadIndicator() {
  const job = useReelUploadState();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Initialize position (bottom-right, above mobile nav)
  useEffect(() => {
    if (job && !pos) {
      setPos({ x: window.innerWidth - PILL_SIZE - 16, y: window.innerHeight - 140 });
    }
    if (!job) { setPos(null); setExpanded(false); }
  }, [job, pos]);

  // Auto-dismiss 3s after success
  useEffect(() => {
    if (job?.phase === "done") {
      const timer = setTimeout(dismissReelUpload, 3000);
      return () => clearTimeout(timer);
    }
  }, [job?.phase]);

  // Close expanded card on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (cardRef.current?.contains(target)) return;
      if (pillRef.current?.contains(target)) return;
      setExpanded(false);
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("touchstart", handler, true);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchstart", handler, true);
    };
  }, [expanded]);

  // Clamp helper
  const clamp = useCallback((x: number, y: number) => ({
    x: Math.max(EDGE_PAD, Math.min(x, window.innerWidth - PILL_SIZE - EDGE_PAD)),
    y: Math.max(EDGE_PAD, Math.min(y, window.innerHeight - PILL_SIZE - EDGE_PAD)),
  }), []);

  // Drag handlers (pointer events for unified touch+mouse)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos!.x, originY: pos!.y, moved: false };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    setPos(clamp(dragRef.current.originX + dx, dragRef.current.originY + dy));
    if (expanded) setExpanded(false);
  }, [clamp, expanded]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current = null;
    // Snap to nearest horizontal edge
    setPos((p) => {
      if (!p) return p;
      const mid = window.innerWidth / 2;
      return { x: p.x + PILL_SIZE / 2 < mid ? EDGE_PAD : window.innerWidth - PILL_SIZE - EDGE_PAD, y: p.y };
    });
    if (!wasDrag) setExpanded((v) => !v);
  }, []);

  if (!job || !pos) return null;

  const isDone = job.phase === "done";
  const isError = job.phase === "error";
  const isActive = !isDone && !isError;

  // Smart card placement: keep within viewport
  const computeCardStyle = (): React.CSSProperties => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let cx = pos.x + PILL_SIZE / 2 - CARD_W / 2;
    let cy = pos.y - CARD_H - 12;
    // Horizontal clamp
    if (cx < EDGE_PAD) cx = EDGE_PAD;
    if (cx + CARD_W > vw - EDGE_PAD) cx = vw - CARD_W - EDGE_PAD;
    // Vertical: if no room above, show below
    if (cy < EDGE_PAD) cy = pos.y + PILL_SIZE + 12;
    // If still out of bounds below, clamp
    if (cy + CARD_H > vh - EDGE_PAD) cy = vh - CARD_H - EDGE_PAD;
    return { position: "fixed" as const, left: cx, top: cy, width: CARD_W, zIndex: 201 };
  };

  // Progress ring (SVG)
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const strokeOff = circ - (circ * (job.progress / 100));

  return (
    <>
      {/* Draggable pill */}
      <div
        ref={pillRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ position: "fixed", left: pos.x, top: pos.y, width: PILL_SIZE, height: PILL_SIZE, zIndex: 200, touchAction: "none" }}
        className="cursor-grab active:cursor-grabbing select-none"
      >
        <div className={cn(
          "w-full h-full rounded-full shadow-2xl flex items-center justify-center border-2 transition-colors",
          isDone && "bg-green-950/90 border-green-500/50",
          isError && "bg-red-950/90 border-red-500/50",
          isActive && "bg-[#0c0c1d]/95 border-primary/50",
        )}>
          {isActive && (
            <svg width={PILL_SIZE} height={PILL_SIZE} className="absolute">
              <circle cx={PILL_SIZE / 2} cy={PILL_SIZE / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3}
                className="text-white/10" />
              <circle cx={PILL_SIZE / 2} cy={PILL_SIZE / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3}
                strokeDasharray={circ} strokeDashoffset={strokeOff} strokeLinecap="round"
                className="text-primary transition-all duration-300" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
            </svg>
          )}
          {isActive && <Upload className="w-5 h-5 text-primary" />}
          {isDone && <CheckCircle2 className="w-5 h-5 text-green-400" />}
          {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
        </div>
      </div>

      {/* Expanded card */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            style={computeCardStyle()}
          >
            <div className={cn(
              "rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl flex items-center gap-3",
              isDone && "bg-green-950/90 border-green-500/30",
              isError && "bg-red-950/90 border-red-500/30",
              isActive && "bg-[#0c0c1d]/95 border-white/10",
            )}>
              {isActive && <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />}
              {isDone && <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />}
              {isError && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {isDone && t("cex.uploadComplete")}
                  {isError && t("cex.uploadFailed")}
                  {isActive && t("cex.uploadingInBackground")}
                </p>
                {isActive && (
                  <div className="mt-1.5 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${job.progress}%` }} />
                  </div>
                )}
              </div>

              {isActive && <span className="text-xs text-white/50 tabular-nums shrink-0">{job.progress}%</span>}
              {(isDone || isError) && (
                <button onClick={() => { setExpanded(false); dismissReelUpload(); }} className="text-white/40 hover:text-white shrink-0">
                  <Upload className="w-4 h-4 rotate-180" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}