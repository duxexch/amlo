/**
 * ReelView — Deep link page for viewing a single reel
 * URL: /reel/:id
 * When shared externally, opens the reel directly.
 * Back button returns to previous page or home.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi, followApi } from "@/lib/socialApi";
import { authApi } from "@/lib/authApi";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "wouter";
import {
    Heart, Eye, MessageCircle, Play, Volume2, VolumeX,
    Loader2, ArrowLeft, Bookmark, BookmarkCheck, UserPlus,
    Share2, Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ReelView() {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const params = useParams<{ id: string }>();
    const reelId = params.id;
    const [, navigate] = useLocation();
    const queryClient = useQueryClient();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [saved, setSaved] = useState(false);
    const [showHeart, setShowHeart] = useState(false);
    const lastTapRef = useRef(0);
    const viewRecordedRef = useRef(false);
    const watchStartRef = useRef(0);

    const { data: authUser } = useQuery({
        queryKey: ["/api/auth/me"],
        queryFn: () => authApi.me(),
        staleTime: 5 * 60_000,
        retry: false,
    });
    const meId: string | null = (authUser as any)?.data?.user?.id || (authUser as any)?.data?.id || (authUser as any)?.user?.id || (authUser as any)?.id || null;

    const { data: reel, isLoading, error } = useQuery({
        queryKey: ["reel", reelId],
        queryFn: () => postsApi.get(reelId!),
        enabled: !!reelId,
        staleTime: 60_000,
    });

    useEffect(() => {
        if (reel) {
            setLiked(!!reel.liked);
            setLikeCount(reel.likeCount || reel.like_count || 0);
            setSaved(!!reel.saved);
        }
    }, [reel]);

    // Auto-play
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !reel) return;
        video.play().then(() => {
            setPlaying(true);
            watchStartRef.current = Date.now();
        }).catch(() => setPlaying(false));

        if (!viewRecordedRef.current) {
            const timer = setTimeout(() => {
                const watchSec = Math.round((Date.now() - watchStartRef.current) / 1000);
                viewMut.mutate({ id: reel.id, sec: watchSec });
                viewRecordedRef.current = true;
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [reel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            if (!liked) { setLiked(true); setLikeCount((c) => c + 1); likeMut.mutate(reel?.id); }
            setShowHeart(true);
            setTimeout(() => setShowHeart(false), 800);
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;
        setTimeout(() => {
            if (lastTapRef.current !== 0) {
                const video = videoRef.current;
                if (video) {
                    if (video.paused) { video.play().then(() => setPlaying(true)).catch(() => { }); }
                    else { video.pause(); setPlaying(false); }
                }
            }
        }, 310);
    }, [liked, reel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLikeBtn = () => {
        const willLike = !liked;
        setLiked(willLike);
        setLikeCount((c) => willLike ? c + 1 : Math.max(0, c - 1));
        likeMut.mutate(reel?.id);
    };

    const handleSaveBtn = () => {
        setSaved(!saved);
        saveMut.mutate(reel?.id);
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/reel/${reel?.id}`;
        const shareData = { title: reel?.caption || t("cex.shareReelTitle"), url };
        try {
            if (navigator.share) await navigator.share(shareData);
            else { await navigator.clipboard.writeText(url); toast.success(t("cex.linkCopied")); }
        } catch (err: any) {
            if (err?.name !== "AbortError") { await navigator.clipboard.writeText(url).catch(() => { }); toast.success(t("cex.linkCopied")); }
        }
    };

    const handleBack = () => {
        if (window.history.length > 1) window.history.back();
        else navigate("/cex");
    };

    const fmt = (n: number) => {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
        if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
        return String(n);
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-[200]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !reel) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[200] gap-4 p-8">
                <Lock className="w-16 h-16 text-white/20" />
                <p className="text-white/50 text-lg">{t("cex.reelNotFound")}</p>
                <button onClick={handleBack} className="px-6 py-3 rounded-xl bg-primary text-white font-bold">
                    {t("common.back")}
                </button>
            </div>
        );
    }

    const isOwnPost = meId === reel.userId;

    return (
        <div className="fixed inset-0 bg-black z-[200] select-none"
            style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" } as any}>
            {/* Back button */}
            <button onClick={handleBack}
                className="absolute top-4 left-4 z-[210] bg-black/60 rounded-full p-2.5 rtl:left-auto rtl:right-4">
                <ArrowLeft className={cn("w-6 h-6 text-white", dir === "rtl" && "rotate-180")} />
            </button>

            {/* Video */}
            <video
                ref={videoRef}
                src={reel.mediaUrl}
                poster={reel.thumbnailUrl || undefined}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                loop muted={muted} playsInline preload="auto"
                {...{ "webkit-playsinline": "", "x5-playsinline": "" } as any}
            />

            {/* Tap area */}
            <div className="absolute inset-0 z-10" onClick={handleTap} />

            <AnimatePresence>
                {showHeart && (
                    <motion.div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                        initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.4 }}>
                        <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-2xl" />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!playing && (
                    <motion.div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}>
                        <Play className="w-16 h-16 text-white" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Right sidebar */}
            <div className={cn("absolute z-20 flex flex-col items-center gap-4", dir === "rtl" ? "left-3 bottom-24" : "right-3 bottom-24")}>
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/user/${reel.userId}`); }}>
                        <div className={cn("w-12 h-12 rounded-full border-2 overflow-hidden",
                            reel.isStoryActive ? "border-primary animate-pulse" : "border-white/30")}>
                            {reel.avatar
                                ? <img src={reel.avatar} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-lg font-bold">{reel.username?.[0]?.toUpperCase() || "?"}</div>}
                        </div>
                    </button>
                    {!isOwnPost && meId && (
                        <button onClick={(e) => { e.stopPropagation(); followMut.mutate(reel.userId); }}
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-primary rounded-full w-6 h-6 flex items-center justify-center border-2 border-black">
                            <UserPlus className="w-3 h-3 text-white" />
                        </button>
                    )}
                </div>

                <button onClick={(e) => { e.stopPropagation(); handleLikeBtn(); }} className="flex flex-col items-center gap-1">
                    <Heart className={cn("w-7 h-7 transition-all", liked ? "text-red-500 fill-red-500 scale-110" : "text-white")} />
                    <span className="text-[11px] text-white font-bold">{fmt(likeCount)}</span>
                </button>

                <div className="flex flex-col items-center gap-1">
                    <MessageCircle className="w-6 h-6 text-white" />
                    <span className="text-[11px] text-white font-bold">{fmt(reel.commentCount || reel.comment_count || 0)}</span>
                </div>

                <button onClick={(e) => { e.stopPropagation(); handleSaveBtn(); }} className="flex flex-col items-center gap-1">
                    {saved
                        ? <BookmarkCheck className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                        : <Bookmark className="w-6 h-6 text-white" />}
                </button>

                <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className="flex flex-col items-center gap-1">
                    <Share2 className="w-6 h-6 text-white" />
                </button>

                <div className="flex flex-col items-center gap-1">
                    <Eye className="w-5 h-5 text-white/60" />
                    <span className="text-[10px] text-white/60 font-bold">{fmt(reel.viewCount || reel.view_count || 0)}</span>
                </div>

                <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}>
                    {muted ? <VolumeX className="w-5 h-5 text-white/60" /> : <Volume2 className="w-5 h-5 text-white/60" />}
                </button>
            </div>

            {/* Bottom info */}
            <div className={cn("absolute bottom-6 z-20 px-4 max-w-[75%]", dir === "rtl" ? "right-4" : "left-4")}>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/user/${reel.userId}`); }} className="flex items-center gap-2 mb-2">
                    <span className="text-white font-bold text-sm drop-shadow-lg">@{reel.displayName || reel.username}</span>
                    {reel.countryCode && <span className="text-xs">{reel.countryCode}</span>}
                </button>
                {reel.caption && <p className="text-white/80 text-xs leading-relaxed drop-shadow-lg line-clamp-2">{reel.caption}</p>}
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent z-[5] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/30 to-transparent z-[5] pointer-events-none" />
        </div>
    );
}
