/**
 * CommentsPanel — Slide-up bottom sheet for reel comments
 * ═══════════════════════════════════════════════════════
 * Features: backdrop dismiss, keyboard submit, auto-focus input
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi } from "@/lib/socialApi";
import { useTranslation } from "react-i18next";
import { Loader2, X, Send, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import type { ReelComment } from "@/types/reel";

interface CommentsPanelProps {
    postId: string;
    open: boolean;
    onClose: () => void;
    meId: string | null;
}

export function CommentsPanel({ postId, open, onClose, meId }: CommentsPanelProps) {
    const { t, i18n } = useTranslation();
    const dir = i18n.dir();
    const [text, setText] = useState("");
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: commentsRaw, isLoading } = useQuery({
        queryKey: ["post-comments", postId],
        queryFn: () => postsApi.getComments(postId),
        enabled: open && !!postId,
        staleTime: 30_000,
    });
    const comments: ReelComment[] = Array.isArray(commentsRaw) ? commentsRaw : [];

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

    return (
        <>
            {/* Backdrop — tap to dismiss (motion for exit fade) */}
            <motion.div
                key="comments-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[149] bg-black/40"
                onClick={onClose}
            />

            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[150] bg-[#0c0c1d] rounded-t-3xl border-t border-white/10 max-h-[70vh] flex flex-col"
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
                        comments.map((c) => (
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
        </>
    );
}
