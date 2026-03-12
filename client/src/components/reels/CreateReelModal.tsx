/**
 * CreateReelModal — Upload a new reel video
 * ═══════════════════════════════════════════
 * Features: video preview, caption, visibility toggle, background upload
 */
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startReelUpload, useReelUploadState } from "@/hooks/useReelUpload";
import { useTranslation } from "react-i18next";
import { X, Camera, Upload, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateReelModalProps {
    open: boolean;
    onClose: () => void;
}

export function CreateReelModal({ open, onClose }: CreateReelModalProps) {
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
