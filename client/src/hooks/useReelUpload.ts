/**
 * Background Reel Upload Store
 * ════════════════════════════
 * Facebook-style: user taps publish → modal closes → floating indicator
 * shows progress → toast on completion. Works across page navigation.
 *
 * Uses useSyncExternalStore for zero-dependency React integration.
 */
import { useSyncExternalStore } from "react";
import { uploadMedia, postsApi } from "@/lib/socialApi";
import { useQueryClient } from "@tanstack/react-query";
import i18n from "i18next";

export interface ReelUploadJob {
    id: string;
    file: File;
    caption?: string;
    visibility: "public" | "private";
    /** 0–100 overall progress */
    progress: number;
    phase: "metadata" | "uploading" | "thumbnail" | "publishing" | "done" | "error";
    error?: string;
}

// ── Singleton store ──
let _current: ReelUploadJob | null = null;
const _listeners = new Set<() => void>();

function emit() { _listeners.forEach((l) => l()); }

function getSnapshot(): ReelUploadJob | null { return _current; }
function subscribe(cb: () => void) { _listeners.add(cb); return () => { _listeners.delete(cb); }; }

function set(patch: Partial<ReelUploadJob>) {
    if (!_current) return;
    _current = { ..._current, ...patch };
    emit();
}

/** Start a background upload job. Only one at a time. */
export function startReelUpload(
    file: File,
    caption: string | undefined,
    visibility: "public" | "private",
    onDone: () => void,
    onError: (msg: string) => void,
) {
    if (_current && _current.phase !== "done" && _current.phase !== "error") return;

    const id = crypto.randomUUID?.() || Date.now().toString(36);
    _current = { id, file, caption, visibility, progress: 0, phase: "metadata" };
    emit();

    (async () => {
        try {
            // 1. Get duration
            const duration = await new Promise<number>((resolve) => {
                const v = document.createElement("video");
                v.preload = "metadata";
                v.onloadedmetadata = () => { resolve(Math.round(v.duration)); URL.revokeObjectURL(v.src); };
                v.onerror = () => resolve(0);
                v.src = URL.createObjectURL(file);
            });

            // 2. Pre-validate: check duration limit BEFORE uploading
            if (duration > 0) {
                let durationError: string | null = null;
                try {
                    const limits = await postsApi.getLimits();
                    if (limits?.maxReelDurationSec && duration > limits.maxReelDurationSec) {
                        durationError = i18n.t("cex.durationTooLong", { max: limits.maxReelDurationSec });
                    }
                } catch {
                    // If limits endpoint fails, proceed and let server validate
                }
                if (durationError) throw new Error(durationError);
            }

            // 3. Upload video (0→70%)
            set({ phase: "uploading", progress: 2 });
            const mediaUrl = await uploadMedia(file, file.name, (p) => {
                set({ progress: Math.round(p.percent * 0.7) });
            });

            // 4. Thumbnail (70→85%)
            set({ phase: "thumbnail", progress: 72 });
            let thumbnailUrl: string | undefined;
            try {
                const canvas = document.createElement("canvas");
                const v = document.createElement("video");
                v.src = mediaUrl; v.crossOrigin = "anonymous"; v.preload = "auto";
                await new Promise<void>((res, rej) => {
                    v.onloadeddata = () => res();
                    v.onerror = () => rej();
                    setTimeout(res, 3000);
                });
                v.currentTime = 0.5;
                await new Promise<void>((r) => { v.onseeked = () => r(); setTimeout(r, 2000); });
                canvas.width = v.videoWidth || 360;
                canvas.height = v.videoHeight || 640;
                canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.7));
                if (blob) {
                    set({ progress: 78 });
                    thumbnailUrl = await uploadMedia(blob, "thumbnail.jpg");
                }
            } catch { /* thumbnail is optional */ }

            // 5. Create post (85→100%)
            set({ phase: "publishing", progress: 88 });
            await postsApi.create({
                type: "reel",
                mediaUrl,
                thumbnailUrl,
                caption: caption?.trim() || undefined,
                duration: duration || undefined,
                visibility,
            });

            set({ phase: "done", progress: 100 });
            onDone();
        } catch (err: any) {
            const msg = err?.message || "Upload failed";
            set({ phase: "error", error: msg });
            onError(msg);
        }
    })();
}

/** Dismiss the indicator after done/error */
export function dismissReelUpload() {
    _current = null;
    emit();
}

/** React hook to read the current upload state */
export function useReelUploadState(): ReelUploadJob | null {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
