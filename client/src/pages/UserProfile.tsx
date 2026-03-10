/**
 * UserProfile — Public Profile Page
 * ═══════════════════════════════════
 * Shows user's non-sensitive data, photos grid, reels grid.
 * Accessible at /user/:id
 */
import { useState, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi, followApi, friendsApi, uploadMedia } from "@/lib/socialApi";
import { authApi } from "@/lib/authApi";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Heart, Eye, Play, Grid3X3, Film, MapPin, Calendar,
    UserPlus, UserCheck, MessageCircle, Loader2, Camera, Plus, Upload, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Photo Upload Modal ──
function CreatePhotoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState("");
    const [caption, setCaption] = useState("");
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) {
            toast.error(t("profile.invalidImageType"));
            return;
        }
        if (f.size > 25 * 1024 * 1024) {
            toast.error(t("profile.fileTooLarge"));
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const mediaUrl = await uploadMedia(file, file.name, (p) => setProgress(p.percent));
            await postsApi.create({ type: "photo", mediaUrl, caption: caption.trim() || undefined });
            queryClient.invalidateQueries({ queryKey: ["user-posts"] });
            toast.success(t("userProfile.photoPublished"));
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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-[#0c0c1d] rounded-2xl border border-white/10 w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">{t("userProfile.newPhoto")}</h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4">
                    {!file ? (
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="w-full aspect-square max-h-[50vh] rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:border-primary/30 transition-colors"
                        >
                            <Camera className="w-12 h-12 text-white/30" />
                            <span className="text-sm text-white/40">{t("userProfile.selectImage")}</span>
                        </button>
                    ) : (
                        <div className="relative w-full aspect-square max-h-[50vh] rounded-xl overflow-hidden bg-black">
                            <img src={preview} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => { setFile(null); setPreview(""); }} className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                    <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                        placeholder={t("cex.captionPlaceholder")}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none h-20"
                    />
                    {uploading && (
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
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

// ── Reel Viewer Modal ──
function ReelViewerModal({ reel, onClose }: { reel: any; onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    return (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={onClose}>
            <button className="absolute top-4 right-4 z-10 text-white/60 hover:text-white" onClick={onClose}>
                <X className="w-6 h-6" />
            </button>
            <video
                ref={videoRef}
                src={reel.mediaUrl}
                poster={reel.thumbnailUrl || undefined}
                className="max-w-full max-h-full object-contain"
                controls
                autoPlay
                playsInline
                loop
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

// ── Post Grid Item ──
function PostGridItem({ post, onClick }: { post: any; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="relative aspect-square rounded-xl overflow-hidden bg-white/5 group"
        >
            {post.type === "reel" ? (
                <>
                    <img
                        src={post.thumbnailUrl || post.mediaUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white/80" />
                    </div>
                    {post.duration && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {Math.floor(post.duration / 60)}:{String(post.duration % 60).padStart(2, "0")}
                        </span>
                    )}
                </>
            ) : (
                <img
                    src={post.mediaUrl}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex items-center gap-2">
                <Heart className="w-3 h-3 text-white" />
                <span className="text-[10px] text-white font-bold">{post.likeCount || 0}</span>
            </div>
        </button>
    );
}

// ── Main Public Profile ──
export function UserProfile() {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const [, navigate] = useLocation();
    const [, params] = useRoute("/user/:id");
    const userId = params?.id || "";
    const [tab, setTab] = useState<"photos" | "reels">("photos");
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [viewingReel, setViewingReel] = useState<any>(null);
    const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Auth
    const { data: authUser } = useQuery({
        queryKey: ["/api/auth/me"],
        queryFn: () => authApi.me(),
        staleTime: 5 * 60_000,
        retry: false,
    });
    const meId = (authUser as any)?.data?.user?.id || (authUser as any)?.data?.id;
    const isOwnProfile = meId === userId;

    // User posts data
    const { data: postsData, isLoading } = useQuery({
        queryKey: ["user-posts", userId, tab],
        queryFn: () => postsApi.userPosts(userId, tab === "photos" ? "photo" : "reel"),
        enabled: !!userId,
        staleTime: 60_000,
    });

    const user = (postsData as any)?.user;
    const posts = (postsData as any)?.posts || [];

    // Follow status
    const { data: followStatus } = useQuery({
        queryKey: ["follow-status", userId],
        queryFn: () => followApi.status(userId),
        enabled: !!userId && !isOwnProfile && !!meId,
        staleTime: 60_000,
    });

    // Follow counts
    const { data: followCounts } = useQuery({
        queryKey: ["follow-counts", userId],
        queryFn: () => followApi.counts(userId),
        enabled: !!userId,
        staleTime: 60_000,
    });

    const followMut = useMutation({
        mutationFn: () => (followStatus as any)?.following
            ? followApi.unfollow(userId)
            : followApi.follow(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["follow-status", userId] });
            queryClient.invalidateQueries({ queryKey: ["follow-counts", userId] });
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-[#06060f] flex flex-col items-center justify-center gap-4">
                <p className="text-white/40">{t("userProfile.notFound")}</p>
                <button onClick={() => navigate("/")} className="text-primary text-sm">{t("common.back")}</button>
            </div>
        );
    }

    const formatDate = (d: string) => {
        try { return new Date(d).toLocaleDateString(i18n.language); } catch { return ""; }
    };

    return (
        <div className="min-h-screen bg-[#06060f]" dir={dir}>
            {/* Header */}
            <div className="relative">
                {/* Back */}
                <button
                    onClick={() => window.history.length > 1 ? window.history.back() : navigate("/")}
                    className="absolute top-4 left-4 z-10 bg-black/40 rounded-full p-2"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>

                {/* Profile header */}
                <div className="pt-16 pb-6 px-6 flex flex-col items-center gap-4">
                    {/* Avatar with glow */}
                    <div className={cn(
                        "w-24 h-24 rounded-full overflow-hidden border-3",
                        user.hasActiveStory
                            ? "border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)] animate-pulse"
                            : "border-white/20"
                    )}>
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.displayName || user.username} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                                {user.username?.[0]?.toUpperCase() || "?"}
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <div className="text-center">
                        <h1 className="text-xl font-black text-white">{user.displayName || user.username}</h1>
                        <p className="text-sm text-white/40">@{user.username}</p>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-white/30">
                        {user.countryCode && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{user.countryCode}</span>
                        )}
                        {user.joinedAt && (
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(user.joinedAt)}</span>
                        )}
                    </div>

                    {/* Bio */}
                    {user.bio && (
                        <p className="text-sm text-white/50 text-center max-w-xs">{user.bio}</p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <p className="text-lg font-black text-white">{(followCounts as any)?.followers ?? 0}</p>
                            <p className="text-[11px] text-white/30">{t("userProfile.followers")}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-black text-white">{(followCounts as any)?.following ?? 0}</p>
                            <p className="text-[11px] text-white/30">{t("userProfile.following")}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-black text-white">{posts.length}</p>
                            <p className="text-[11px] text-white/30">{t("userProfile.posts")}</p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    {!isOwnProfile && meId && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => followMut.mutate()}
                                disabled={followMut.isPending}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
                                    (followStatus as any)?.following
                                        ? "bg-white/10 text-white border border-white/10"
                                        : "bg-primary text-white"
                                )}
                            >
                                {(followStatus as any)?.following
                                    ? <><UserCheck className="w-4 h-4" />{t("userProfile.following")}</>
                                    : <><UserPlus className="w-4 h-4" />{t("userProfile.follow")}</>
                                }
                            </button>
                            <button
                                onClick={() => navigate("/friends")}
                                className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold border border-white/10"
                            >
                                <MessageCircle className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Own profile: add content */}
                    {isOwnProfile && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowPhotoModal(true)}
                                className="px-5 py-2.5 rounded-xl bg-primary/20 text-primary text-sm font-bold border border-primary/20 flex items-center gap-2"
                            >
                                <Camera className="w-4 h-4" /> {t("userProfile.addPhoto")}
                            </button>
                            <button
                                onClick={() => navigate("/cex")}
                                className="px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold border border-white/10 flex items-center gap-2"
                            >
                                <Film className="w-4 h-4" /> {t("userProfile.addReel")}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="sticky top-0 z-30 bg-[#06060f] border-b border-white/5">
                <div className="flex">
                    <button
                        onClick={() => setTab("photos")}
                        className={cn(
                            "flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2",
                            tab === "photos" ? "text-primary border-primary" : "text-white/30 border-transparent"
                        )}
                    >
                        <Grid3X3 className="w-4 h-4" /> {t("userProfile.photos")}
                    </button>
                    <button
                        onClick={() => setTab("reels")}
                        className={cn(
                            "flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2",
                            tab === "reels" ? "text-primary border-primary" : "text-white/30 border-transparent"
                        )}
                    >
                        <Film className="w-4 h-4" /> {t("userProfile.reels")}
                    </button>
                </div>
            </div>

            {/* Posts grid */}
            <div className="px-3 py-4">
                {posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        {tab === "photos" ? <Grid3X3 className="w-12 h-12 text-white/10" /> : <Film className="w-12 h-12 text-white/10" />}
                        <p className="text-white/30 text-sm">{t("userProfile.noPosts")}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                        {posts.map((post: any) => (
                            <PostGridItem
                                key={post.id}
                                post={post}
                                onClick={() => {
                                    if (post.type === "reel") {
                                        setViewingReel(post);
                                    } else {
                                        setShowImageViewer(post.mediaUrl);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreatePhotoModal open={showPhotoModal} onClose={() => setShowPhotoModal(false)} />

            {viewingReel && <ReelViewerModal reel={viewingReel} onClose={() => setViewingReel(null)} />}

            {/* Image viewer */}
            {showImageViewer && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setShowImageViewer(null)}>
                    <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setShowImageViewer(null)}>
                        <X className="w-6 h-6" />
                    </button>
                    <img src={showImageViewer} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}
