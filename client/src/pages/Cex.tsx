/**
 * Watch / شاهد — TikTok-Style Vertical Reels Feed
 * ════════════════════════════════════════════════
 * Two tabs: Public (algorithm feed) + Private (own reels + saved)
 * Features: comments, save/bookmark, follow, screenshot protection,
 * visibility control (public/private), watch-time tracking.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi, followApi } from "@/lib/socialApi";
import { startReelUpload, useReelUploadState } from "@/hooks/useReelUpload";
import { authApi } from "@/lib/authApi";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
    Heart, Eye, MessageCircle, Plus, Play, Volume2, VolumeX,
    Loader2, X, Upload, Camera, Bookmark, BookmarkCheck, UserPlus,
    Globe, Lock, Send, Trash2, Film,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

        // Desktop: keyboard shortcuts for screenshots
        const handleKey = (e: KeyboardEvent) => {
            const isPrint = e.key === "PrintScreen";
            const isCtrlShiftS = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key?.toLowerCase() === "s";
            const isMacScreenshot = e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5");

            if (isPrint || isCtrlShiftS || isMacScreenshot) {
                e.preventDefault();
                reportScreenshot();
            }
        };

        // Prevent context menu (right-click / long-press save on mobile)
        const handleContextMenu = (e: Event) => { e.preventDefault(); };

        // Prevent drag-and-drop image saving
        const handleDragStart = (e: Event) => { e.preventDefault(); };

        document.addEventListener("keydown", handleKey, true);
        document.addEventListener("contextmenu", handleContextMenu, true);
        document.addEventListener("dragstart", handleDragStart, true);
        return () => {
            document.removeEventListener("keydown", handleKey, true);
            document.removeEventListener("contextmenu", handleContextMenu, true);
            document.removeEventListener("dragstart", handleDragStart, true);
        };
    }, [isLoggedIn]);

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
// ── Comments Panel ──
// ═══════════════════════════════════════════════
function CommentsPanel({
    postId,
    open,
    onClose,
    meId,
}: {
    postId: string;
    open: boolean;
    onClose: () => void;
    meId: string | null;
}) {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const [text, setText] = useState("");
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: commentsData, isLoading } = useQuery({
        queryKey: ["post-comments", postId],
        queryFn: () => postsApi.getComments(postId),
        enabled: open && !!postId,
        staleTime: 30_000,
    });
    const comments: any[] = Array.isArray(commentsData) ? commentsData : [];

    const addMut = useMutation({
        mutationFn: (t: string) => postsApi.addComment(postId, t),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
            setText("");
        },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => postsApi.deleteComment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
        },
    });

    const handleSubmit = () => {
        const trimmed = text.trim();
        if (!trimmed || !meId) return;
        addMut.mutate(trimmed);
    };

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 300);
    }, [open]);

    if (!open) return null;

    return (
        <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[90] bg-[#0c0c1d] rounded-t-3xl border-t border-white/10 max-h-[70vh] flex flex-col"
            dir={dir}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex flex-col items-center pt-2 pb-3 px-4 border-b border-white/5">
                <div className="w-10 h-1 bg-white/20 rounded-full mb-3" />
                <div className="flex items-center justify-between w-full">
                    <h3 className="text-white font-bold text-sm">{t("cex.comments")} ({comments.length})</h3>
                    <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 overscroll-contain">
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : comments.length === 0 ? (
                    <p className="text-center text-white/30 py-8 text-sm">{t("cex.noComments")}</p>
                ) : (
                    comments.map((c: any) => (
                        <div key={c.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 overflow-hidden">
                                {c.avatar ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : (c.username?.[0]?.toUpperCase() || "?")}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-white text-xs font-bold">{c.displayName || c.username}</span>
                                    <span className="text-white/20 text-[10px]">
                                        {new Date(c.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                                    </span>
                                    {c.userId === meId && (
                                        <button
                                            onClick={() => deleteMut.mutate(c.id)}
                                            className="text-red-400/50 hover:text-red-400 ms-auto"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-white/70 text-xs mt-0.5 break-words">{c.text}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {meId && (
                <div className="px-4 py-3 border-t border-white/5 flex gap-2">
                    <input
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value.slice(0, 300))}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        placeholder={t("cex.addComment")}
                        className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!text.trim() || addMut.isPending}
                        className="bg-primary rounded-full p-2.5 disabled:opacity-30"
                    >
                        {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                    </button>
                </div>
            )}
        </motion.div>
    );
}

// ═══════════════════════════════════════════════
// ── Reel Card ──
// ═══════════════════════════════════════════════
function ReelCard({
    reel,
    isActive,
    onLike,
    onView,
    onSave,
    onUserClick,
    onCommentClick,
    onFollow,
    meId,
}: {
    reel: any;
    isActive: boolean;
    onLike: (id: string) => void;
    onView: (id: string, watchSec: number) => void;
    onSave: (id: string) => void;
    onUserClick: (id: string) => void;
    onCommentClick: (id: string) => void;
    onFollow: (userId: string) => void;
    meId: string | null;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [liked, setLiked] = useState(!!reel.liked);
    const [likeCount, setLikeCount] = useState(reel.likeCount || 0);
    const [saved, setSaved] = useState(!!reel.saved);
    const [showHeart, setShowHeart] = useState(false);
    const lastTapRef = useRef(0);
    const viewRecordedRef = useRef(false);
    const watchStartRef = useRef(0);
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();

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

    const handleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            if (!liked) { setLiked(true); setLikeCount((c: number) => c + 1); onLike(reel.id); }
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
    }, [liked, reel.id, onLike]);

    const handleLikeBtn = useCallback(() => {
        const willLike = !liked;
        setLiked(willLike);
        setLikeCount((c: number) => willLike ? c + 1 : Math.max(0, c - 1));
        onLike(reel.id);
    }, [liked, reel.id, onLike]);

    const handleSaveBtn = useCallback(() => {
        setSaved(!saved);
        onSave(reel.id);
    }, [saved, reel.id, onSave]);

    const fmt = (n: number) => {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
        if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
        return String(n);
    };

    const isOwnPost = meId === reel.userId;

    return (
        <div className="relative w-full h-full snap-start snap-always bg-black flex items-center justify-center select-none"
            style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" } as any}>
            <video
                ref={videoRef}
                src={reel.mediaUrl}
                poster={reel.thumbnailUrl || undefined}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                loop muted={muted} playsInline preload="auto"
                {...{ "webkit-playsinline": "", "x5-playsinline": "" } as any}
            />

            {/* Watermark overlay — deterrence against screenshots */}
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
                {!playing && isActive && (
                    <motion.div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}>
                        <Play className="w-16 h-16 text-white" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Right sidebar */}
            <div className={cn("absolute z-20 flex flex-col items-center gap-4", dir === "rtl" ? "left-3 bottom-24" : "right-3 bottom-24")}>
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); onUserClick(reel.userId); }}>
                        <div className={cn("w-12 h-12 rounded-full border-2 overflow-hidden",
                            reel.isStoryActive ? "border-primary animate-pulse" : "border-white/30")}>
                            {reel.avatar
                                ? <img src={reel.avatar} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-lg font-bold">{reel.username?.[0]?.toUpperCase() || "?"}</div>}
                        </div>
                    </button>
                    {!isOwnPost && meId && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onFollow(reel.userId); }}
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-primary rounded-full w-6 h-6 flex items-center justify-center border-2 border-black"
                        >
                            <UserPlus className="w-3 h-3 text-white" />
                        </button>
                    )}
                </div>

                <button onClick={(e) => { e.stopPropagation(); handleLikeBtn(); }} className="flex flex-col items-center gap-1">
                    <Heart className={cn("w-7 h-7 transition-all", liked ? "text-red-500 fill-red-500 scale-110" : "text-white")} />
                    <span className="text-[11px] text-white font-bold">{fmt(likeCount)}</span>
                </button>

                <button onClick={(e) => { e.stopPropagation(); onCommentClick(reel.id); }} className="flex flex-col items-center gap-1">
                    <MessageCircle className="w-6 h-6 text-white" />
                    <span className="text-[11px] text-white font-bold">{fmt(reel.commentCount || 0)}</span>
                </button>

                <button onClick={(e) => { e.stopPropagation(); handleSaveBtn(); }} className="flex flex-col items-center gap-1">
                    {saved
                        ? <BookmarkCheck className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                        : <Bookmark className="w-6 h-6 text-white" />}
                </button>

                <div className="flex flex-col items-center gap-1">
                    <Eye className="w-5 h-5 text-white/60" />
                    <span className="text-[10px] text-white/60 font-bold">{fmt(reel.viewCount || 0)}</span>
                </div>

                <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}>
                    {muted ? <VolumeX className="w-5 h-5 text-white/60" /> : <Volume2 className="w-5 h-5 text-white/60" />}
                </button>
            </div>

            {/* Bottom info */}
            <div className={cn("absolute bottom-6 z-20 px-4 max-w-[75%]", dir === "rtl" ? "right-4" : "left-4")}>
                <button onClick={(e) => { e.stopPropagation(); onUserClick(reel.userId); }} className="flex items-center gap-2 mb-2">
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

// ═══════════════════════════════════════════════
// ── Create Reel Modal (with visibility toggle) ──
// ═══════════════════════════════════════════════
function CreateReelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState("");
    const [caption, setCaption] = useState("");
    const [visibility, setVisibility] = useState<"public" | "private">("public");
    const fileRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const bgUpload = useReelUploadState();
    const isBusy = bgUpload && bgUpload.phase !== "done" && bgUpload.phase !== "error";

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("video/")) { toast.error(t("cex.invalidFileType")); return; }
        if (f.size > 100 * 1024 * 1024) { toast.error(t("cex.fileTooLarge")); return; }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleUpload = () => {
        if (!file || isBusy) return;
        startReelUpload(
            file,
            caption.trim() || undefined,
            visibility,
            () => {
                queryClient.invalidateQueries({ queryKey: ["cex-feed"] });
                queryClient.invalidateQueries({ queryKey: ["my-reels"] });
                toast.success(t("cex.reelPublished"));
            },
            (msg) => toast.error(msg || t("cex.uploadError")),
        );
        toast.info(t("cex.uploadingInBackground"));
        setFile(null); setPreview(""); setCaption(""); setVisibility("public");
        onClose();
    };

    useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[#0c0c1d] rounded-2xl border border-white/10 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">{t("cex.newReel")}</h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4">
                    {!file ? (
                        <button onClick={() => fileRef.current?.click()}
                            className="w-full aspect-[9/16] max-h-[50vh] rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:border-primary/30 transition-colors">
                            <Camera className="w-12 h-12 text-white/30" />
                            <span className="text-sm text-white/40">{t("cex.selectVideo")}</span>
                        </button>
                    ) : (
                        <div className="relative w-full aspect-[9/16] max-h-[50vh] rounded-xl overflow-hidden bg-black">
                            <video src={preview} className="w-full h-full object-cover" controls playsInline muted />
                            <button onClick={() => { setFile(null); setPreview(""); }} className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"><X className="w-4 h-4 text-white" /></button>
                        </div>
                    )}

                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />

                    <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                        placeholder={t("cex.captionPlaceholder")}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none h-20" />
                    <p className="text-[11px] text-white/30 text-end">{caption.length}/500</p>

                    {/* Visibility toggle */}
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                        <button
                            onClick={() => setVisibility("public")}
                            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                                visibility === "public" ? "bg-primary text-white" : "text-white/40 hover:text-white/60")}
                        >
                            <Globe className="w-4 h-4" /> {t("cex.public")}
                        </button>
                        <button
                            onClick={() => setVisibility("private")}
                            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                                visibility === "private" ? "bg-orange-500 text-white" : "text-white/40 hover:text-white/60")}
                        >
                            <Lock className="w-4 h-4" /> {t("cex.private")}
                        </button>
                    </div>

                    <button onClick={handleUpload} disabled={!file || !!isBusy}
                        className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                        <Upload className="w-5 h-5" />
                        {t("cex.publish")}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════
// ── Private Tab (My Reels + Saved) ──
// ═══════════════════════════════════════════════
function PrivateTab({ onCreateClick, onReelClick }: { onCreateClick: () => void; onReelClick: (reels: any[], startIdx: number) => void }) {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const [sub, setSub] = useState<"my" | "saved">("my");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: myData, isLoading: myLoading } = useQuery({
        queryKey: ["my-reels"],
        queryFn: () => postsApi.myReels(),
        staleTime: 60_000,
    });
    const myReels: any[] = Array.isArray(myData) ? myData : [];

    const { data: savedData, isLoading: savedLoading } = useQuery({
        queryKey: ["saved-reels"],
        queryFn: () => postsApi.savedReels(),
        staleTime: 60_000,
        enabled: sub === "saved",
    });
    const savedReels: any[] = Array.isArray(savedData) ? savedData : [];

    const toggleVisMut = useMutation({
        mutationFn: ({ id, visibility }: { id: string; visibility: "public" | "private" }) =>
            postsApi.toggleVisibility(id, visibility),
        onSuccess: (_data, { visibility }) => {
            queryClient.invalidateQueries({ queryKey: ["my-reels"] });
            queryClient.invalidateQueries({ queryKey: ["cex-feed"] });
            toast.success(visibility === "public" ? t("cex.madePublic") : t("cex.madePrivate"));
        },
        onError: () => toast.error(t("cex.uploadError")),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => postsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["my-reels"] });
            queryClient.invalidateQueries({ queryKey: ["cex-feed"] });
            toast.success(t("cex.reelDeleted"));
            setDeleteTarget(null);
        },
        onError: () => toast.error(t("cex.uploadError")),
    });

    const items = sub === "my" ? myReels : savedReels;
    const loading = sub === "my" ? myLoading : savedLoading;

    return (
        <div className="min-h-screen bg-[#06060f] pt-16 pb-24" dir={dir}>
            <div className="flex p-1 bg-white/5 rounded-xl mx-4 mb-4">
                <button onClick={() => setSub("my")} className={cn("flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5",
                    sub === "my" ? "bg-primary text-white" : "text-white/40")}>
                    <Film className="w-4 h-4" /> {t("cex.myReels")}
                </button>
                <button onClick={() => setSub("saved")} className={cn("flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5",
                    sub === "saved" ? "bg-yellow-500 text-white" : "text-white/40")}>
                    <Bookmark className="w-4 h-4" /> {t("cex.savedReels")}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    {sub === "my" ? <Film className="w-16 h-16 text-white/10" /> : <Bookmark className="w-16 h-16 text-white/10" />}
                    <p className="text-white/30">{sub === "my" ? t("cex.noMyReels") : t("cex.noSavedReels")}</p>
                    {sub === "my" && (
                        <button onClick={onCreateClick} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" /> {t("cex.createFirst")}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1 px-2">
                    {items.map((reel: any, idx: number) => (
                        <div key={reel.id} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-white/5 group cursor-pointer"
                            onClick={() => onReelClick(items, idx)}>
                            <img src={reel.thumbnailUrl || reel.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                <Play className="w-6 h-6 text-white/70" />
                            </div>
                            {sub === "my" && (
                                <div className="absolute top-1.5 end-1.5 flex flex-col gap-1 z-10">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleVisMut.mutate({ id: reel.id, visibility: reel.visibility === "public" ? "private" : "public" }); }}
                                        className="bg-black/60 rounded-full p-1.5"
                                        disabled={toggleVisMut.isPending}
                                    >
                                        {reel.visibility === "public"
                                            ? <Globe className="w-3.5 h-3.5 text-primary" />
                                            : <Lock className="w-3.5 h-3.5 text-orange-400" />}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(reel.id); }}
                                        className="bg-black/60 rounded-full p-1.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                </div>
                            )}
                            <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1">
                                <Eye className="w-3 h-3 text-white/70" />
                                <span className="text-[10px] text-white/70 font-bold">{reel.viewCount || 0}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AnimatePresence>
                {deleteTarget && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-6"
                        onClick={() => setDeleteTarget(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0c0c1d] rounded-2xl border border-white/10 p-6 w-full max-w-sm text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <h3 className="text-white font-bold text-lg mb-2">{t("cex.deleteReel")}</h3>
                            <p className="text-white/50 text-sm mb-6">{t("cex.deleteReelConfirm")}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-sm"
                                >
                                    {t("common.cancel")}
                                </button>
                                <button
                                    onClick={() => deleteMut.mutate(deleteTarget)}
                                    disabled={deleteMut.isPending}
                                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    {t("cex.deleteReel")}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
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
    const meId: string | null = (authUser as any)?.data?.user?.id || (authUser as any)?.data?.id || (authUser as any)?.user?.id || (authUser as any)?.id || null;

    const { banned } = useScreenshotProtection(isLoggedIn);

    // ── Reel viewer from Private grid ──
    const [viewerReels, setViewerReels] = useState<any[] | null>(null);
    const [viewerIndex, setViewerIndex] = useState(0);
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const viewerReelRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const openReelViewer = useCallback((reels: any[], startIdx: number) => {
        setViewerReels(reels);
        setViewerIndex(startIdx);
    }, []);

    const closeReelViewer = useCallback(() => {
        setViewerReels(null);
        setViewerIndex(0);
    }, []);

    // Viewer IntersectionObserver
    useEffect(() => {
        if (!viewerReels) return;
        const container = viewerContainerRef.current;
        if (!container) return;
        // Scroll to initial reel
        const el = viewerReelRefs.current.get(viewerIndex);
        if (el) el.scrollIntoView({ behavior: "instant" });
    }, [viewerReels]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!viewerReels) return;
        const container = viewerContainerRef.current;
        if (!container) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
                        const idx = Number(entry.target.getAttribute("data-vidx"));
                        if (!isNaN(idx)) setViewerIndex(idx);
                    }
                }
            },
            { root: container, threshold: 0.7 },
        );
        viewerReelRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [viewerReels?.length]);

    const [feedPage, setFeedPage] = useState(0);
    const { data: feedData, isLoading: feedLoading } = useQuery({
        queryKey: ["cex-feed", feedPage],
        queryFn: () => postsApi.feed(feedPage * 20, 20),
        staleTime: 0,
        enabled: activeTab === "public",
    });
    const reels: any[] = Array.isArray(feedData) ? feedData : [];
    const hasMore = reels.length >= 20;

    useEffect(() => {
        if (activeTab !== "public") return;
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
    }, [reels.length, activeTab]);

    useEffect(() => {
        if (activeIndex >= reels.length - 3 && hasMore) {
            setFeedPage((p) => p + 1);
        }
    }, [activeIndex, reels.length, hasMore]);

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

    const handleLike = useCallback((id: string) => { likeMut.mutate(id); }, []);
    const handleView = useCallback((id: string, sec: number) => { viewMut.mutate({ id, sec }); }, []);
    const handleSave = useCallback((id: string) => { saveMut.mutate(id); }, []);
    const handleFollow = useCallback((userId: string) => { followMut.mutate(userId); }, []);
    const handleUserClick = useCallback((userId: string) => { navigate(`/user/${userId}`); }, [navigate]);
    const handleCommentClick = useCallback((id: string) => { setCommentPostId(id); }, []);

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
            style={{ WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } as any}
        >
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 safe-area-top bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex items-center gap-1 pointer-events-auto">
                    <h1 className="text-white font-black text-xl drop-shadow-lg">{t("nav.cex")}</h1>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="flex bg-white/10 rounded-full p-0.5">
                        <button onClick={() => setActiveTab("public")}
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
                    {feedLoading ? (
                        <div className="fixed inset-0 bg-black flex items-center justify-center z-40">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                            style={{ WebkitOverflowScrolling: "touch" } as any}>
                            {reels.map((reel: any, idx: number) => (
                                <div key={reel.id}
                                    ref={(el) => { if (el) reelRefs.current.set(idx, el); }}
                                    data-idx={idx}
                                    className="w-full h-[100dvh] snap-start snap-always">
                                    <ReelCard
                                        reel={reel}
                                        isActive={activeIndex === idx}
                                        onLike={handleLike}
                                        onView={handleView}
                                        onSave={handleSave}
                                        onUserClick={handleUserClick}
                                        onCommentClick={handleCommentClick}
                                        onFollow={handleFollow}
                                        meId={meId}
                                    />
                                </div>
                            ))}
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
                            style={{ WebkitOverflowScrolling: "touch" } as any}>
                            {viewerReels.map((reel: any, idx: number) => (
                                <div key={reel.id}
                                    ref={(el) => { if (el) viewerReelRefs.current.set(idx, el); }}
                                    data-vidx={idx}
                                    className="w-full h-[100dvh] snap-start snap-always">
                                    <ReelCard
                                        reel={reel}
                                        isActive={viewerIndex === idx}
                                        onLike={handleLike}
                                        onView={handleView}
                                        onSave={handleSave}
                                        onUserClick={handleUserClick}
                                        onCommentClick={handleCommentClick}
                                        onFollow={handleFollow}
                                        meId={meId}
                                    />
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
