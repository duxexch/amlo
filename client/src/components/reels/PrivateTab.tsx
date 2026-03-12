/**
 * PrivateTab — My Reels + Saved Reels grid
 * ═════════════════════════════════════════
 * Features: sub-tabs, visibility toggle, delete with confirmation
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi } from "@/lib/socialApi";
import { formatCount } from "@/lib/formatNumber";
import { useTranslation } from "react-i18next";
import {
    Plus, Play, Eye, Loader2, Film, Bookmark,
    Globe, Lock, Trash2, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Reel } from "@/types/reel";

interface PrivateTabProps {
    onCreateClick: () => void;
    onReelClick: (reels: Reel[], startIdx: number) => void;
}

export function PrivateTab({ onCreateClick, onReelClick }: PrivateTabProps) {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const [sub, setSub] = useState<"my" | "saved">("my");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [myCursor, setMyCursor] = useState<string | undefined>(undefined);
    const [savedCursor, setSavedCursor] = useState<string | undefined>(undefined);
    const [myAccum, setMyAccum] = useState<Reel[]>([]);
    const [savedAccum, setSavedAccum] = useState<Reel[]>([]);
    const queryClient = useQueryClient();

    const { data: myData, isLoading: myLoading, isFetching: myFetching } = useQuery({
        queryKey: ["my-reels", myCursor || "initial"],
        queryFn: () => postsApi.myReels(myCursor),
        staleTime: 60_000,
    });
    // Accumulate pages
    const myPage: Reel[] = Array.isArray(myData) ? myData : [];
    if (myPage.length > 0 && (myAccum.length === 0 || myAccum[myAccum.length - 1]?.id !== myPage[myPage.length - 1]?.id)) {
        const ids = new Set(myAccum.map(r => r.id));
        const newItems = myPage.filter(r => !ids.has(r.id));
        if (newItems.length > 0) setMyAccum(prev => myCursor ? [...prev, ...newItems] : myPage);
    }
    const myReels = myAccum.length > 0 ? myAccum : myPage;
    const myHasMore = myPage.length >= 30;

    const { data: savedData, isLoading: savedLoading, isFetching: savedFetching } = useQuery({
        queryKey: ["saved-reels", savedCursor || "initial"],
        queryFn: () => postsApi.savedReels(savedCursor),
        staleTime: 60_000,
        enabled: sub === "saved",
    });
    const savedPage: Reel[] = Array.isArray(savedData) ? savedData : [];
    if (savedPage.length > 0 && (savedAccum.length === 0 || savedAccum[savedAccum.length - 1]?.id !== savedPage[savedPage.length - 1]?.id)) {
        const ids = new Set(savedAccum.map(r => r.id));
        const newItems = savedPage.filter(r => !ids.has(r.id));
        if (newItems.length > 0) setSavedAccum(prev => savedCursor ? [...prev, ...newItems] : savedPage);
    }
    const savedReels = savedAccum.length > 0 ? savedAccum : savedPage;
    const savedHasMore = savedPage.length >= 30;

    const loadMoreMy = useCallback(() => {
        if (myReels.length > 0) setMyCursor(myReels[myReels.length - 1].createdAt);
    }, [myReels]);
    const loadMoreSaved = useCallback(() => {
        if (savedReels.length > 0) setSavedCursor(savedReels[savedReels.length - 1].createdAt);
    }, [savedReels]);

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
    const fetching = sub === "my" ? myFetching : savedFetching;
    const hasMore = sub === "my" ? myHasMore : savedHasMore;
    const loadMore = sub === "my" ? loadMoreMy : loadMoreSaved;

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
                <>
                    <div className="grid grid-cols-3 gap-1 px-2">
                        {items.map((reel, idx) => (
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
                                    <span className="text-[10px] text-white/70 font-bold">{formatCount(reel.viewCount || 0)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More */}
                    {hasMore && (
                        <div className="flex justify-center py-6">
                            <button
                                onClick={loadMore}
                                disabled={fetching}
                                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm flex items-center gap-2 disabled:opacity-40"
                            >
                                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                                {t("common.loadMore")}
                            </button>
                        </div>
                    )}
                </>
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
