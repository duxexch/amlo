/**
 * ReelCard — Full-screen TikTok-style reel display
 * ═══════════════════════════════════════════════════
 * Features: video virtualization (loadVideo prop), global muted,
 * progress bar, loading skeleton, conditional follow, report dialog,
 * double-tap like, watch-time tracking.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    Heart, Eye, MessageCircle, Play, Volume2, VolumeX,
    Bookmark, BookmarkCheck, UserPlus, UserCheck, Share2, Flag,
    X, EyeOff, AlertTriangle, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/formatNumber";
import type { Reel } from "@/types/reel";

const REPORT_TYPES = ["spam", "inappropriate", "harassment", "other"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function haptic() { try { navigator.vibrate?.(10); } catch { } }

interface ReelCardProps {
    reel: Reel;
    isActive: boolean;
    loadVideo: boolean;
    globalMuted: boolean;
    onToggleMute: () => void;
    isFollowed: boolean;
    onLike: (id: string) => void;
    onView: (id: string, watchSec: number) => void;
    onSave: (id: string) => void;
    onUserClick: (id: string) => void;
    onCommentClick: (id: string) => void;
    onFollow: (userId: string) => void;
    onShare: (reel: Reel) => void;
    onReport: (id: string, type: string) => void;
    onHide: (id: string) => void;
    meId: string | null;
    cachedUrl?: string | null;
}

export function ReelCard({
    reel,
    isActive,
    loadVideo,
    globalMuted,
    onToggleMute,
    isFollowed,
    onLike,
    onView,
    onSave,
    onUserClick,
    onCommentClick,
    onFollow,
    onShare,
    onReport,
    onHide,
    meId,
    cachedUrl,
}: ReelCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [liked, setLiked] = useState(!!reel.liked);
    const [likeCount, setLikeCount] = useState(reel.likeCount || 0);
    const [saved, setSaved] = useState(!!reel.saved);
    const [showHeart, setShowHeart] = useState(false);
    const [progress, setProgress] = useState(0);
    const [videoReady, setVideoReady] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [expandCaption, setExpandCaption] = useState(false);
    const lastTapRef = useRef(0);
    const viewRecordedRef = useRef(false);
    const watchStartRef = useRef(0);
    const skipProgressTransition = useRef(false);
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();

    // Sync liked/saved state when reel data changes (e.g. refetch)
    useEffect(() => { setLiked(!!reel.liked); setLikeCount(reel.likeCount || 0); }, [reel.id, reel.liked, reel.likeCount]);
    useEffect(() => { setSaved(!!reel.saved); }, [reel.id, reel.saved]);
    useEffect(() => { setVideoError(false); setExpandCaption(false); }, [reel.id]);

    // Play/pause + watch-time tracking
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            video.currentTime = 0;
            video.play().then(() => { setPlaying(true); watchStartRef.current = Date.now(); }).catch(() => setPlaying(false));

            if (!viewRecordedRef.current) {
                const timer = setTimeout(() => {
                    const watchSec = Math.round((Date.now() - watchStartRef.current) / 1000);
                    onView(reel.id, watchSec);
                    viewRecordedRef.current = true;
                }, 2000);
                return () => clearTimeout(timer);
            }
        } else {
            if (watchStartRef.current > 0) {
                const watchSec = Math.round((Date.now() - watchStartRef.current) / 1000);
                if (watchSec > 2) onView(reel.id, watchSec);
                watchStartRef.current = 0;
            }
            video.pause();
            setPlaying(false);
        }
    }, [isActive, reel.id, onView]);

    // Reset videoReady when loadVideo changes
    useEffect(() => {
        if (!loadVideo) setVideoReady(false);
    }, [loadVideo]);

    // Progress bar tracking (with smooth loop reset)
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isActive) return;
        const onTime = () => {
            if (video.duration > 0) setProgress(video.currentTime / video.duration);
        };
        const onSeeking = () => { skipProgressTransition.current = true; };
        const onSeeked = () => { requestAnimationFrame(() => { skipProgressTransition.current = false; }); };
        video.addEventListener("timeupdate", onTime);
        video.addEventListener("seeking", onSeeking);
        video.addEventListener("seeked", onSeeked);
        return () => {
            video.removeEventListener("timeupdate", onTime);
            video.removeEventListener("seeking", onSeeking);
            video.removeEventListener("seeked", onSeeked);
        };
    }, [isActive, loadVideo]);

    const handleTap = useCallback(() => {
        const now = Date.now();
        const diff = now - lastTapRef.current;
        lastTapRef.current = now;

        if (diff < 300) {
            // Double-tap → like (never unlikes)
            lastTapRef.current = 0;
            if (!liked) { setLiked(true); setLikeCount((c) => c + 1); onLike(reel.id); }
            setShowHeart(true);
            haptic();
            setTimeout(() => setShowHeart(false), 800);
            // Resume if paused by the first tap
            const video = videoRef.current;
            if (video && video.paused) { video.play().then(() => setPlaying(true)).catch(() => { }); }
            return;
        }

        // Single tap → instant play/pause (no delay)
        const video = videoRef.current;
        if (video) {
            if (video.paused) { video.play().then(() => setPlaying(true)).catch(() => { }); }
            else { video.pause(); setPlaying(false); }
        }
    }, [liked, reel.id, onLike]);

    const handleLikeBtn = useCallback(() => {
        const willLike = !liked;
        setLiked(willLike);
        setLikeCount((c) => willLike ? c + 1 : Math.max(0, c - 1));
        onLike(reel.id);
        haptic();
    }, [liked, reel.id, onLike]);

    const handleSaveBtn = useCallback(() => {
        setSaved(!saved);
        onSave(reel.id);
        haptic();
    }, [saved, reel.id, onSave]);

    const isOwnPost = meId === reel.userId;

    return (
        <div className="relative w-full h-full snap-start snap-always bg-black flex items-center justify-center select-none"
            style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" } as React.CSSProperties}>

            {/* Video or thumbnail placeholder (virtualization) */}
            {loadVideo ? (
                <>
                    <video
                        ref={videoRef}
                        src={cachedUrl || reel.mediaUrl}
                        poster={reel.thumbnailUrl || undefined}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        loop muted={globalMuted} playsInline preload={isActive ? "auto" : "metadata"}
                        onLoadedData={() => setVideoReady(true)}
                        onError={() => setVideoError(true)}
                        {...{ "webkit-playsinline": "", "x5-playsinline": "" } as any}
                    />
                    {/* Loading skeleton — blurred thumbnail until video is ready */}
                    {!videoReady && reel.thumbnailUrl && (
                        <img
                            src={reel.thumbnailUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                            style={{ filter: "blur(8px)", transform: "scale(1.05)" }}
                        />
                    )}
                </>
            ) : (
                /* Lightweight placeholder — no video loaded */
                <img
                    src={reel.thumbnailUrl || reel.mediaUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    loading="lazy"
                />
            )}

            {/* Video error overlay */}
            {videoError && loadVideo && (
                <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center gap-3">
                    <AlertTriangle className="w-10 h-10 text-red-400/60" />
                    <p className="text-white/40 text-xs">{t("cex.videoError")}</p>
                    <button
                        onClick={(e) => { e.stopPropagation(); setVideoError(false); setVideoReady(false); videoRef.current?.load(); }}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> {t("common.retry")}
                    </button>
                </div>
            )}

            {/* Watermark overlay */}
            {meId && (
                <div className="absolute inset-0 z-[6] pointer-events-none overflow-hidden opacity-[0.06]"
                    style={{ transform: "rotate(-25deg)", transformOrigin: "center center" }}>
                    <div className="flex flex-wrap gap-x-12 gap-y-6 -m-20 w-[200%] h-[200%] items-center justify-start">
                        {Array.from({ length: 30 }, (_, i) => (
                            <span key={i} className="text-white text-xs font-bold whitespace-nowrap">ABLOX</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Tap area */}
            <div className="absolute inset-0 z-10" onClick={handleTap} />

            {/* Double-tap heart animation */}
            <AnimatePresence>
                {showHeart && (
                    <motion.div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                        initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.4 }}>
                        <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-2xl" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Paused play icon */}
            <AnimatePresence>
                {!playing && isActive && loadVideo && (
                    <motion.div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}>
                        <Play className="w-16 h-16 text-white" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Right sidebar */}
            <div className={cn("absolute z-20 flex flex-col items-center gap-4", dir === "rtl" ? "left-3 bottom-24" : "right-3 bottom-24")}>
                {/* User avatar */}
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); onUserClick(reel.userId); }}>
                        <div className={cn("w-12 h-12 rounded-full border-2 overflow-hidden",
                            reel.isStoryActive ? "border-primary animate-pulse" : "border-white/30")}>
                            {reel.avatar
                                ? <img src={reel.avatar} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-lg font-bold">{reel.username?.[0]?.toUpperCase() || "?"}</div>}
                        </div>
                    </button>
                    {/* Follow button — hidden if own post, already followed, or not logged in */}
                    {!isOwnPost && meId && !isFollowed && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onFollow(reel.userId); }}
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-primary rounded-full w-6 h-6 flex items-center justify-center border-2 border-black"
                        >
                            <UserPlus className="w-3 h-3 text-white" />
                        </button>
                    )}
                    {/* Already followed indicator */}
                    {!isOwnPost && meId && isFollowed && (
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-green-600 rounded-full w-6 h-6 flex items-center justify-center border-2 border-black">
                            <UserCheck className="w-3 h-3 text-white" />
                        </div>
                    )}
                </div>

                {/* Like */}
                <button onClick={(e) => { e.stopPropagation(); handleLikeBtn(); }} className="flex flex-col items-center gap-1">
                    <Heart className={cn("w-7 h-7 transition-all", liked ? "text-red-500 fill-red-500 scale-110" : "text-white")} />
                    <span className="text-[11px] text-white font-bold">{formatCount(likeCount)}</span>
                </button>

                {/* Comment */}
                <button onClick={(e) => { e.stopPropagation(); onCommentClick(reel.id); }} className="flex flex-col items-center gap-1">
                    <MessageCircle className="w-6 h-6 text-white" />
                    <span className="text-[11px] text-white font-bold">{formatCount(reel.commentCount || 0)}</span>
                </button>

                {/* Save */}
                <button onClick={(e) => { e.stopPropagation(); handleSaveBtn(); }} className="flex flex-col items-center gap-1">
                    {saved
                        ? <BookmarkCheck className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                        : <Bookmark className="w-6 h-6 text-white" />}
                </button>

                {/* Share */}
                <button onClick={(e) => { e.stopPropagation(); onShare(reel); }} className="flex flex-col items-center gap-1">
                    <Share2 className="w-6 h-6 text-white" />
                </button>

                {/* Report (only for other users' posts) */}
                {meId && !isOwnPost && (
                    <button onClick={(e) => { e.stopPropagation(); setShowReport(true); }} className="flex flex-col items-center gap-1">
                        <Flag className="w-5 h-5 text-white/60" />
                    </button>
                )}

                {/* Not interested (hide from feed) */}
                {meId && !isOwnPost && (
                    <button onClick={(e) => { e.stopPropagation(); onHide(reel.id); }} className="flex flex-col items-center gap-1">
                        <EyeOff className="w-5 h-5 text-white/60" />
                    </button>
                )}

                {/* View count */}
                <div className="flex flex-col items-center gap-1">
                    <Eye className="w-5 h-5 text-white/60" />
                    <span className="text-[10px] text-white/60 font-bold">{formatCount(reel.viewCount || 0)}</span>
                </div>

                {/* Mute toggle (global) */}
                <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }}>
                    {globalMuted ? <VolumeX className="w-5 h-5 text-white/60" /> : <Volume2 className="w-5 h-5 text-white/60" />}
                </button>
            </div>

            {/* Bottom info */}
            <div className={cn("absolute bottom-6 z-20 px-4 max-w-[75%]", dir === "rtl" ? "right-4" : "left-4")}>
                <button onClick={(e) => { e.stopPropagation(); onUserClick(reel.userId); }} className="flex items-center gap-2 mb-2">
                    <span className="text-white font-bold text-sm drop-shadow-lg">@{reel.displayName || reel.username}</span>
                    {reel.countryCode && <span className="text-xs">{reel.countryCode}</span>}
                </button>
                {reel.caption && (
                    <div onClick={(e) => { e.stopPropagation(); setExpandCaption((v) => !v); }} className="cursor-pointer">
                        <p className={cn("text-white/80 text-xs leading-relaxed drop-shadow-lg", !expandCaption && "line-clamp-2")}>{reel.caption}</p>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            {loadVideo && isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] z-30 bg-white/10">
                    <div
                        className="h-full bg-white/70 rounded-full"
                        style={{ width: `${progress * 100}%`, transition: skipProgressTransition.current ? "none" : "width 0.25s linear" }}
                    />
                </div>
            )}

            {/* Gradients */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent z-[5] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/30 to-transparent z-[5] pointer-events-none" />

            {/* Report Dialog */}
            <AnimatePresence>
                {showReport && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-6"
                        onClick={(e) => { e.stopPropagation(); setShowReport(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0c0c1d] rounded-2xl border border-white/10 p-5 w-full max-w-xs"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-bold text-sm">{t("cex.reportTitle")}</h3>
                                <button onClick={() => setShowReport(false)} className="text-white/40 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {REPORT_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            onReport(reel.id, type);
                                            setShowReport(false);
                                        }}
                                        className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 text-sm text-start transition-colors"
                                    >
                                        {t(`cex.report_${type}`)}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
