/**
 * CEX — TikTok-Style Vertical Reels Feed
 * ════════════════════════════════════════
 * Full-screen, snap-scroll, auto-play/pause with IntersectionObserver.
 * Double-tap like, preload next video, swipe navigation.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi, uploadMedia } from "@/lib/socialApi";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Heart, Eye, MessageCircle, Share2, Plus, Play, Pause, Volume2, VolumeX, ChevronUp, Loader2, X, Upload, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/authApi";

// ── Reel Card (single reel in the scroll) ──
function ReelCard({
    reel,
    isActive,
    onLike,
    onView,
    onUserClick,
}: {
    reel: any;
    isActive: boolean;
    onLike: (id: string) => void;
    onView: (id: string) => void;
    onUserClick: (id: string) => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [liked, setLiked] = useState(!!reel.liked);
    const [likeCount, setLikeCount] = useState(reel.likeCount || 0);
    const [showHeart, setShowHeart] = useState(false);
    const lastTapRef = useRef(0);
    const viewRecordedRef = useRef(false);
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();

    // Auto play/pause based on visibility
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            video.currentTime = 0;
            video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
            // Record view after 2s of watching
            if (!viewRecordedRef.current) {
                const timer = setTimeout(() => {
                    onView(reel.id);
                    viewRecordedRef.current = true;
                }, 2000);
                return () => clearTimeout(timer);
            }
        } else {
            video.pause();
            setPlaying(false);
        }
    }, [isActive, reel.id, onView]);

    // Toggle play/pause on single tap
    const handleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            // Double tap → like
            if (!liked) {
                setLiked(true);
                setLikeCount((c: number) => c + 1);
                onLike(reel.id);
            }
            setShowHeart(true);
            setTimeout(() => setShowHeart(false), 800);
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;

        // Delay single-tap to check for double tap
        setTimeout(() => {
            if (lastTapRef.current !== 0) {
                const video = videoRef.current;
                if (video) {
                    if (video.paused) {
                        video.play().then(() => setPlaying(true)).catch(() => { });
                    } else {
                        video.pause();
                        setPlaying(false);
                    }
                }
            }
        }, 310);
    }, [liked, reel.id, onLike]);

    const handleLikeBtn = useCallback(() => {
        const willLike = !liked;
        setLiked(willLike);
        setLikeCount((c: number) => willLike ? c + 1 : Math.max(0, c - 1));
        onLike(reel.id);
    }, [liked, reel.id, onLike]);

    const formatCount = (n: number) => {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
        if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
        return String(n);
    };

    return (
        <div className="relative w-full h-full snap-start snap-always bg-black flex items-center justify-center">
            {/* Video */}
            <video
                ref={videoRef}
                src={reel.mediaUrl}
                poster={reel.thumbnailUrl || undefined}
                className="absolute inset-0 w-full h-full object-cover"
                loop
                muted={muted}
                playsInline
                preload="auto"
                webkit-playsinline=""
                x5-playsinline=""
            />

            {/* Tap overlay */}
            <div className="absolute inset-0 z-10" onClick={handleTap} />

            {/* Double-tap heart animation */}
            <AnimatePresence>
                {showHeart && (
                    <motion.div
                        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1.2, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-2xl" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Play/Pause indicator */}
            <AnimatePresence>
                {!playing && isActive && (
                    <motion.div
                        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        exit={{ opacity: 0 }}
                    >
                        <Play className="w-16 h-16 text-white" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Right sidebar actions */}
            <div className={cn("absolute z-20 flex flex-col items-center gap-5", dir === "rtl" ? "left-3 bottom-28" : "right-3 bottom-28")}>
                {/* Avatar */}
                <button
                    onClick={(e) => { e.stopPropagation(); onUserClick(reel.userId); }}
                    className="relative"
                >
                    <div className={cn(
                        "w-12 h-12 rounded-full border-2 overflow-hidden",
                        reel.isStoryActive ? "border-primary animate-pulse" : "border-white/30"
                    )}>
                        {reel.avatar ? (
                            <img src={reel.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-lg font-bold">
                                {reel.username?.[0]?.toUpperCase() || "?"}
                            </div>
                        )}
                    </div>
                </button>

                {/* Like */}
                <button onClick={(e) => { e.stopPropagation(); handleLikeBtn(); }} className="flex flex-col items-center gap-1">
                    <Heart className={cn("w-7 h-7 transition-all", liked ? "text-red-500 fill-red-500 scale-110" : "text-white")} />
                    <span className="text-[11px] text-white font-bold">{formatCount(likeCount)}</span>
                </button>

                {/* Views */}
                <div className="flex flex-col items-center gap-1">
                    <Eye className="w-6 h-6 text-white/70" />
                    <span className="text-[11px] text-white/70 font-bold">{formatCount(reel.viewCount || 0)}</span>
                </div>

                {/* Mute/Unmute */}
                <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="flex flex-col items-center gap-1">
                    {muted ? <VolumeX className="w-6 h-6 text-white/70" /> : <Volume2 className="w-6 h-6 text-white/70" />}
                </button>
            </div>

            {/* Bottom info overlay */}
            <div className={cn("absolute bottom-6 z-20 px-4 max-w-[80%]", dir === "rtl" ? "right-4" : "left-4")}>
                <button
                    onClick={(e) => { e.stopPropagation(); onUserClick(reel.userId); }}
                    className="flex items-center gap-2 mb-2"
                >
                    <span className="text-white font-bold text-sm drop-shadow-lg">
                        @{reel.displayName || reel.username}
                    </span>
                    {reel.countryCode && (
                        <span className="text-xs">{reel.countryCode}</span>
                    )}
                </button>
                {reel.caption && (
                    <p className="text-white/80 text-xs leading-relaxed drop-shadow-lg line-clamp-2">{reel.caption}</p>
                )}
            </div>

            {/* Gradient overlays */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent z-[5] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/30 to-transparent z-[5] pointer-events-none" />
        </div>
    );
}

// ── Create Reel Modal ──
function CreateReelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>("");
    const [caption, setCaption] = useState("");
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("video/")) {
            toast.error(t("cex.invalidFileType"));
            return;
        }
        if (f.size > 100 * 1024 * 1024) {
            toast.error(t("cex.fileTooLarge"));
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            // Get video duration
            const duration = await new Promise<number>((resolve) => {
                const video = document.createElement("video");
                video.preload = "metadata";
                video.onloadedmetadata = () => {
                    resolve(Math.round(video.duration));
                    URL.revokeObjectURL(video.src);
                };
                video.onerror = () => resolve(0);
                video.src = URL.createObjectURL(file);
            });

            const mediaUrl = await uploadMedia(file, file.name, (p) => setProgress(p.percent));

            // Generate thumbnail from first frame
            let thumbnailUrl: string | undefined;
            try {
                const canvas = document.createElement("canvas");
                const video = document.createElement("video");
                video.src = mediaUrl;
                video.crossOrigin = "anonymous";
                video.preload = "auto";
                await new Promise<void>((resolve, reject) => {
                    video.onloadeddata = () => resolve();
                    video.onerror = () => reject();
                    setTimeout(resolve, 3000);
                });
                video.currentTime = 0.5;
                await new Promise<void>((r) => { video.onseeked = () => r(); setTimeout(r, 2000); });
                canvas.width = video.videoWidth || 360;
                canvas.height = video.videoHeight || 640;
                canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.7));
                if (blob) {
                    thumbnailUrl = await uploadMedia(blob, "thumbnail.jpg");
                }
            } catch {
                // Thumbnail is optional
            }

            await postsApi.create({
                type: "reel",
                mediaUrl,
                thumbnailUrl,
                caption: caption.trim() || undefined,
                duration: duration || undefined,
            });

            queryClient.invalidateQueries({ queryKey: ["cex-feed"] });
            toast.success(t("cex.reelPublished"));
            setFile(null);
            setPreview("");
            setCaption("");
            onClose();
        } catch (err: any) {
            toast.error(err?.message || t("cex.uploadError"));
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    useEffect(() => {
        return () => { if (preview) URL.revokeObjectURL(preview); };
    }, [preview]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-[#0c0c1d] rounded-2xl border border-white/10 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">{t("cex.newReel")}</h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 space-y-4">
                    {!file ? (
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="w-full aspect-[9/16] max-h-[50vh] rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:border-primary/30 transition-colors"
                        >
                            <Camera className="w-12 h-12 text-white/30" />
                            <span className="text-sm text-white/40">{t("cex.selectVideo")}</span>
                        </button>
                    ) : (
                        <div className="relative w-full aspect-[9/16] max-h-[50vh] rounded-xl overflow-hidden bg-black">
                            <video src={preview} className="w-full h-full object-cover" controls playsInline muted />
                            <button
                                onClick={() => { setFile(null); setPreview(""); }}
                                className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    )}

                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />

                    <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                        placeholder={t("cex.captionPlaceholder")}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none h-20"
                    />
                    <p className="text-[11px] text-white/30 text-end">{caption.length}/500</p>

                    {uploading && (
                        <div className="space-y-2">
                            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-xs text-white/40 text-center">{progress}%</p>
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        {uploading ? t("cex.uploading") : t("cex.publish")}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main CEX Page ──
export function Cex() {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const [, navigate] = useLocation();
    const [activeIndex, setActiveIndex] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const reelRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const { data: authUser } = useQuery({
        queryKey: ["/api/auth/me"],
        queryFn: () => authApi.me(),
        staleTime: 5 * 60_000,
        retry: false,
    });
    const isLoggedIn = Boolean(authUser);

    // Infinite scroll feed
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteQuery({
        queryKey: ["cex-feed"],
        queryFn: async ({ pageParam }) => {
            const res = await postsApi.feed(pageParam, 10);
            // The response wraps differently — adapt
            if (Array.isArray(res)) return { data: res, nextCursor: null };
            return res;
        },
        getNextPageParam: (lastPage: any) => lastPage?.nextCursor ?? undefined,
        initialPageParam: undefined as string | undefined,
        staleTime: 60_000,
    });

    const reels = data?.pages.flatMap((page: any) => page?.data || page || []) || [];

    // Intersection Observer for active reel detection
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
                        const idx = Number(entry.target.getAttribute("data-idx"));
                        if (!isNaN(idx)) setActiveIndex(idx);
                    }
                }
            },
            { root: container, threshold: 0.7 },
        );

        reelRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [reels.length]);

    // Load more when near end
    useEffect(() => {
        if (activeIndex >= reels.length - 3 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [activeIndex, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const likeMutation = useMutation({
        mutationFn: (id: string) => postsApi.like(id),
    });

    const viewMutation = useMutation({
        mutationFn: (id: string) => postsApi.view(id),
    });

    const handleLike = useCallback((id: string) => {
        likeMutation.mutate(id);
    }, [likeMutation]);

    const handleView = useCallback((id: string) => {
        viewMutation.mutate(id);
    }, [viewMutation]);

    const handleUserClick = useCallback((userId: string) => {
        navigate(`/user/${userId}`);
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (reels.length === 0) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-40 gap-4">
                <Play className="w-16 h-16 text-white/20" />
                <p className="text-white/40 text-lg">{t("cex.noReels")}</p>
                {isLoggedIn && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-6 py-3 rounded-xl bg-primary text-white font-bold flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> {t("cex.createFirst")}
                    </button>
                )}
                <CreateReelModal open={showCreate} onClose={() => setShowCreate(false)} />
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 safe-area-top bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                <h1 className="text-white font-black text-xl pointer-events-auto drop-shadow-lg">{t("nav.cex")}</h1>
                {isLoggedIn && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="pointer-events-auto bg-primary rounded-full p-2.5 shadow-lg shadow-primary/30"
                    >
                        <Plus className="w-5 h-5 text-white" />
                    </button>
                )}
            </div>

            {/* Vertical scroll container */}
            <div
                ref={containerRef}
                className="fixed inset-0 z-40 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
                style={{ WebkitOverflowScrolling: "touch" }}
            >
                {reels.map((reel: any, idx: number) => (
                    <div
                        key={reel.id}
                        ref={(el) => { if (el) reelRefs.current.set(idx, el); }}
                        data-idx={idx}
                        className="w-full h-[100dvh] snap-start snap-always"
                    >
                        <ReelCard
                            reel={reel}
                            isActive={activeIndex === idx}
                            onLike={handleLike}
                            onView={handleView}
                            onUserClick={handleUserClick}
                        />
                    </div>
                ))}

                {/* Loading more indicator */}
                {isFetchingNextPage && (
                    <div className="w-full h-20 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                )}
            </div>

            <CreateReelModal open={showCreate} onClose={() => setShowCreate(false)} />
        </>
    );
}
