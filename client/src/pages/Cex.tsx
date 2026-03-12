/**
 * Watch / شاهد — TikTok-Style Vertical Reels Feed
 * ════════════════════════════════════════════════
 * Two tabs: Public (algorithm feed) + Private (own reels + saved)
 * Features: video virtualization (±1), global mute, progress bar,
 * loading skeleton, conditional follow, report, comments backdrop dismiss,
 * screenshot protection, watch-time tracking.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi, followApi } from "@/lib/socialApi";
import { authApi } from "@/lib/authApi";
import { useReelCache } from "@/hooks/useReelCache";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, Play, Loader2, X, Lock, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReelCard } from "@/components/reels/ReelCard";
import { CommentsPanel } from "@/components/reels/CommentsPanel";
import { CreateReelModal } from "@/components/reels/CreateReelModal";
import { PrivateTab } from "@/components/reels/PrivateTab";
import type { Reel } from "@/types/reel";

// ═══════════════════════════════════════════════
// ── Screenshot Protection Hook ──
// ═══════════════════════════════════════════════
function useScreenshotProtection(isLoggedIn: boolean) {
    const [banned, setBanned] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        if (!isLoggedIn) return;
        postsApi.getScreenshotStatus().then((res: any) => {
            if (res?.banned) setBanned(true);
        }).catch(() => { });
    }, [isLoggedIn]);

    useEffect(() => {
        if (!isLoggedIn) return;

        const handleKey = (e: KeyboardEvent) => {
            const isPrint = e.key === "PrintScreen";
            const isCtrlShiftS = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key?.toLowerCase() === "s";
            const isMacScreenshot = e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5");

            if (isPrint || isCtrlShiftS || isMacScreenshot) {
                e.preventDefault();
                reportScreenshot();
            }
        };

        const handleContextMenu = (e: Event) => { e.preventDefault(); };
        const handleDragStart = (e: Event) => { e.preventDefault(); };

        document.addEventListener("keydown", handleKey, true);
        document.addEventListener("contextmenu", handleContextMenu, true);
        document.addEventListener("dragstart", handleDragStart, true);
        return () => {
            document.removeEventListener("keydown", handleKey, true);
            document.removeEventListener("contextmenu", handleContextMenu, true);
            document.removeEventListener("dragstart", handleDragStart, true);
        };
    }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

    const reportScreenshot = useCallback(() => {
        postsApi.reportScreenshot().then((res: any) => {
            if (res?.banned) {
                setBanned(true);
                toast.error(t("cex.screenshotBanned"));
            } else if (res?.warning) {
                toast.warning(`${t("cex.screenshotWarning")} (${res.count}/5)`);
            }
        }).catch(() => { });
    }, [t]);

    return { banned };
}

// ═══════════════════════════════════════════════
// ── Scroll-snap IntersectionObserver Hook ──
// ═══════════════════════════════════════════════
function useScrollSnap(
    containerRef: React.RefObject<HTMLDivElement | null>,
    elemsRef: React.RefObject<Map<number, HTMLDivElement>>,
    dataAttr: string,
    onIndexChange: (idx: number) => void,
    enabled: boolean,
    deps: any[],
) {
    useEffect(() => {
        if (!enabled) return;
        const container = containerRef.current;
        if (!container) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
                        const idx = Number(entry.target.getAttribute(dataAttr));
                        if (!isNaN(idx)) onIndexChange(idx);
                    }
                }
            },
            { root: container, threshold: 0.7 },
        );
        elemsRef.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// ═══════════════════════════════════════════════
// ── Main Watch Page ──
// ═══════════════════════════════════════════════
export function Cex() {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const [, navigate] = useLocation();
    const [activeTab, setActiveTab] = useState<"public" | "private">("public");
    const [activeIndex, setActiveIndex] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const [commentPostId, setCommentPostId] = useState<string | null>(null);
    const [globalMuted, setGlobalMuted] = useState(false);
    const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const reelRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const queryClient = useQueryClient();

    const { data: authUser } = useQuery({
        queryKey: ["/api/auth/me"],
        queryFn: () => authApi.me(),
        staleTime: 5 * 60_000,
        retry: false,
    });
    const isLoggedIn = Boolean(authUser);
    const meId: string | null = (authUser as any)?.user?.id || (authUser as any)?.id || null;

    const { banned } = useScreenshotProtection(isLoggedIn);

    // ── Reel viewer from Private grid ──
    const [viewerReels, setViewerReels] = useState<Reel[] | null>(null);
    const [viewerIndex, setViewerIndex] = useState(0);
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const viewerReelRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const openReelViewer = useCallback((reels: Reel[], startIdx: number) => {
        setViewerReels(reels);
        setViewerIndex(startIdx);
    }, []);

    const closeReelViewer = useCallback(() => {
        setViewerReels(null);
        setViewerIndex(0);
        viewerReelRefs.current.clear();
    }, []);

    // Viewer: scroll to initial reel
    useEffect(() => {
        if (!viewerReels) return;
        const el = viewerReelRefs.current.get(viewerIndex);
        if (el) el.scrollIntoView({ behavior: "instant" });
    }, [viewerReels]); // eslint-disable-line react-hooks/exhaustive-deps

    // Viewer IntersectionObserver (deduplicated)
    useScrollSnap(viewerContainerRef, viewerReelRefs, "data-vidx", setViewerIndex, !!viewerReels, [viewerReels?.length]);

    // ── Feed pagination ──
    const [feedPage, setFeedPage] = useState(0);
    const [accumulatedReels, setAccumulatedReels] = useState<Reel[]>([]);
    const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(new Set());
    const { data: feedData, isLoading: feedLoading, isError: feedError, refetch: refetchFeed } = useQuery({
        queryKey: ["cex-feed", feedPage],
        queryFn: () => postsApi.feed(feedPage * 20, 20),
        staleTime: 0,
        enabled: activeTab === "public",
        retry: 2,
    });

    useEffect(() => {
        if (!feedData || !Array.isArray(feedData)) return;
        if (feedPage === 0) {
            setAccumulatedReels(feedData);
        } else {
            setAccumulatedReels((prev) => {
                const existingIds = new Set(prev.map((r) => r.id));
                const newReels = feedData.filter((r: Reel) => !existingIds.has(r.id));
                return [...prev, ...newReels];
            });
        }
        // Init followedUsers from the isFollowing flag in feed data
        setFollowedUsers(prev => {
            const next = new Set(prev);
            for (const reel of feedData) {
                if ((reel as Reel).isFollowing) next.add((reel as Reel).userId);
            }
            return next.size === prev.size ? prev : next;
        });
    }, [feedData, feedPage]);

    const reels = accumulatedReels.filter(r => !hiddenPostIds.has(r.id));
    const hasMore = Array.isArray(feedData) && feedData.length >= 20;

    // ── Preload + 5-day cache ──
    const { getCachedUrl, preloadAround } = useReelCache(reels);
    const viewerCacheReels = viewerReels || [];
    const { getCachedUrl: getViewerCachedUrl, preloadAround: preloadViewerAround } = useReelCache(viewerCacheReels);

    useEffect(() => {
        if (activeTab === "public" && reels.length > 0) preloadAround(activeIndex);
    }, [activeIndex, reels.length, activeTab, preloadAround]);

    useEffect(() => {
        if (viewerReels && viewerReels.length > 0) preloadViewerAround(viewerIndex);
    }, [viewerIndex, viewerReels?.length, preloadViewerAround]);

    // ── Public feed IntersectionObserver (deduplicated) ──
    useScrollSnap(containerRef, reelRefs, "data-idx", setActiveIndex, activeTab === "public", [reels.length, activeTab]);

    // Clean up stale refs when tab changes
    useEffect(() => {
        if (activeTab !== "public") reelRefs.current.clear();
    }, [activeTab]);

    // Infinite scroll — load next page
    useEffect(() => {
        if (activeIndex >= reels.length - 3 && hasMore) {
            setFeedPage((p) => p + 1);
        }
    }, [activeIndex, reels.length, hasMore]);

    // ── Mutations ──
    const likeMut = useMutation({ mutationFn: (id: string) => postsApi.like(id) });
    const viewMut = useMutation({ mutationFn: ({ id, sec }: { id: string; sec: number }) => postsApi.view(id, sec) });
    const saveMut = useMutation({
        mutationFn: (id: string) => postsApi.save(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-reels"] }),
    });
    const followMut = useMutation({
        mutationFn: (userId: string) => followApi.follow(userId),
        onSuccess: () => toast.success(t("cex.followed")),
    });
    const reportMut = useMutation({
        mutationFn: ({ id, type }: { id: string; type: string }) => postsApi.report(id, type),
        onSuccess: () => toast.success(t("cex.reportSent")),
        onError: () => toast.error(t("cex.uploadError")),
    });

    // ── Callbacks (stable refs via mutation objects) ──
    const handleLike = useCallback((id: string) => { likeMut.mutate(id); }, [likeMut]);
    const handleView = useCallback((id: string, sec: number) => { viewMut.mutate({ id, sec }); }, [viewMut]);
    const handleSave = useCallback((id: string) => { saveMut.mutate(id); }, [saveMut]);
    const handleFollow = useCallback((userId: string) => {
        followMut.mutate(userId);
        setFollowedUsers((prev) => new Set(prev).add(userId));
    }, [followMut]);
    const handleUserClick = useCallback((userId: string) => { navigate(`/user/${userId}`); }, [navigate]);
    const handleCommentClick = useCallback((id: string) => { setCommentPostId(id); }, []);
    const handleToggleMute = useCallback(() => { setGlobalMuted((m) => !m); }, []);
    const handleReport = useCallback((id: string, type: string) => { reportMut.mutate({ id, type }); }, [reportMut]);
    const handleHide = useCallback((id: string) => { setHiddenPostIds(prev => new Set(prev).add(id)); }, []);

    const handleShare = useCallback(async (reel: Reel) => {
        const url = `${window.location.origin}/reel/${reel.id}`;
        const shareData = {
            title: reel.caption || t("cex.shareReelTitle"),
            text: reel.caption || t("cex.shareReelTitle"),
            url,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(url);
                toast.success(t("cex.linkCopied"));
            }
        } catch (err: any) {
            if (err?.name !== "AbortError") {
                await navigator.clipboard.writeText(url).catch(() => { });
                toast.success(t("cex.linkCopied"));
            }
        }
    }, [t]);

    if (banned) {
        return (
            <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center gap-4 p-8">
                <Lock className="w-16 h-16 text-red-500" />
                <h2 className="text-white text-xl font-black text-center">{t("cex.screenshotBannedTitle")}</h2>
                <p className="text-white/50 text-sm text-center max-w-sm">{t("cex.screenshotBannedDesc")}</p>
            </div>
        );
    }

    return (
        <div
            className="select-none"
            style={{ WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
        >
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 safe-area-top bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex items-center gap-1 pointer-events-auto">
                    <h1 className="text-white font-black text-xl drop-shadow-lg">{t("nav.cex")}</h1>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="flex bg-white/10 rounded-full p-0.5">
                        <button onClick={() => { setActiveTab("public"); setFeedPage(0); setAccumulatedReels([]); reelRefs.current.clear(); }}
                            className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                                activeTab === "public" ? "bg-primary text-white" : "text-white/50")}>
                            {t("cex.publicTab")}
                        </button>
                        <button onClick={() => setActiveTab("private")}
                            className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                                activeTab === "private" ? "bg-orange-500 text-white" : "text-white/50")}>
                            {t("cex.privateTab")}
                        </button>
                    </div>

                    {isLoggedIn && (
                        <button onClick={() => setShowCreate(true)} className="bg-primary rounded-full p-2 shadow-lg shadow-primary/30">
                            <Plus className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>
            </div>

            {/* Public Tab */}
            {activeTab === "public" && (
                <>
                    {/* Refresh button at top */}
                    {activeIndex === 0 && reels.length > 0 && (
                        <button
                            onClick={() => { setFeedPage(0); setAccumulatedReels([]); setActiveIndex(0); setHiddenPostIds(new Set()); refetchFeed(); }}
                            className="fixed top-14 left-1/2 -translate-x-1/2 z-[51] bg-primary/90 text-white text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> {t("cex.refreshFeed")}
                        </button>
                    )}

                    {feedLoading && reels.length === 0 ? (
                        <div className="fixed inset-0 bg-black flex items-center justify-center z-40">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : feedError && reels.length === 0 ? (
                        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-40 gap-4">
                            <Play className="w-16 h-16 text-red-400/30" />
                            <p className="text-white/40 text-lg">{t("cex.uploadError")}</p>
                            <button onClick={() => { setFeedPage(0); setAccumulatedReels([]); refetchFeed(); }}
                                className="px-6 py-3 rounded-xl bg-primary text-white font-bold flex items-center gap-2">
                                <Loader2 className="w-4 h-4" /> {t("common.retry")}
                            </button>
                        </div>
                    ) : reels.length === 0 ? (
                        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-40 gap-4">
                            <Play className="w-16 h-16 text-white/20" />
                            <p className="text-white/40 text-lg">{t("cex.noReels")}</p>
                            {isLoggedIn && (
                                <button onClick={() => setShowCreate(true)} className="px-6 py-3 rounded-xl bg-primary text-white font-bold flex items-center gap-2">
                                    <Plus className="w-5 h-5" /> {t("cex.createFirst")}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div ref={containerRef}
                            className="fixed inset-0 z-40 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
                            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
                            {reels.map((reel, idx) => {
                                const loadVideo = Math.abs(idx - activeIndex) <= 1;
                                return (
                                    <div key={reel.id}
                                        ref={(el) => { if (el) reelRefs.current.set(idx, el); else reelRefs.current.delete(idx); }}
                                        data-idx={idx}
                                        className="w-full h-[100dvh] snap-start snap-always">
                                        <ReelCard
                                            reel={reel}
                                            isActive={activeIndex === idx}
                                            loadVideo={loadVideo}
                                            globalMuted={globalMuted}
                                            onToggleMute={handleToggleMute}
                                            isFollowed={followedUsers.has(reel.userId)}
                                            onLike={handleLike}
                                            onView={handleView}
                                            onSave={handleSave}
                                            onUserClick={handleUserClick}
                                            onCommentClick={handleCommentClick}
                                            onFollow={handleFollow}
                                            onShare={handleShare}
                                            onReport={handleReport}
                                            onHide={handleHide}
                                            meId={meId}
                                            cachedUrl={getCachedUrl(reel.mediaUrl)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Private Tab */}
            {activeTab === "private" && (
                isLoggedIn ? (
                    <PrivateTab onCreateClick={() => setShowCreate(true)} onReelClick={openReelViewer} />
                ) : (
                    <div className="fixed inset-0 bg-[#06060f] flex flex-col items-center justify-center z-40 gap-4 pt-16">
                        <Lock className="w-12 h-12 text-white/20" />
                        <p className="text-white/40">{t("cex.loginRequired")}</p>
                    </div>
                )
            )}

            {/* Comments panel */}
            <AnimatePresence>
                {commentPostId && (
                    <CommentsPanel
                        postId={commentPostId}
                        open={!!commentPostId}
                        onClose={() => setCommentPostId(null)}
                        meId={meId}
                    />
                )}
            </AnimatePresence>

            <CreateReelModal open={showCreate} onClose={() => setShowCreate(false)} />

            {/* ── Fullscreen Reel Viewer (from Private grid) ── */}
            <AnimatePresence>
                {viewerReels && viewerReels.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black"
                    >
                        <button onClick={closeReelViewer} className="absolute top-4 right-4 z-[110] bg-black/60 rounded-full p-2">
                            <X className="w-6 h-6 text-white" />
                        </button>
                        <div ref={viewerContainerRef}
                            className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
                            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
                            {viewerReels.map((reel, idx) => {
                                const loadVideo = Math.abs(idx - viewerIndex) <= 1;
                                return (
                                    <div key={reel.id}
                                        ref={(el) => { if (el) viewerReelRefs.current.set(idx, el); else viewerReelRefs.current.delete(idx); }}
                                        data-vidx={idx}
                                        className="w-full h-[100dvh] snap-start snap-always">
                                        <ReelCard
                                            reel={reel}
                                            isActive={viewerIndex === idx}
                                            loadVideo={loadVideo}
                                            globalMuted={globalMuted}
                                            onToggleMute={handleToggleMute}
                                            isFollowed={followedUsers.has(reel.userId)}
                                            onLike={handleLike}
                                            onView={handleView}
                                            onSave={handleSave}
                                            onUserClick={handleUserClick}
                                            onCommentClick={handleCommentClick}
                                            onFollow={handleFollow}
                                            onShare={handleShare}
                                            onReport={handleReport}
                                            onHide={handleHide}
                                            meId={meId}
                                            cachedUrl={getViewerCachedUrl(reel.mediaUrl)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
