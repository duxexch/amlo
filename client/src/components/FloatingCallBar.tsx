/**
 * Floating Mini Call Bar — شريط المكالمة المُصغّر
 * ════════════════════════════════════════
 * Shown at the top when a call is minimized so the user
 * can continue browsing the app while staying in the call.
 */
import { useState, useEffect, useSyncExternalStore } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useLocation } from "wouter";
import { activeCallStore } from "@/lib/activeCallStore";
import { webrtcManager } from "@/lib/webrtcManager";
import { callsApi } from "@/lib/socialApi";
import { useTranslation } from "react-i18next";

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FloatingCallBar() {
    const { t } = useTranslation();
    const [, navigate] = useLocation();
    const call = useSyncExternalStore(activeCallStore.subscribe, activeCallStore.get);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (!call?.isMinimized) return;
        const interval = setInterval(() => {
            setDuration(webrtcManager.getDuration());
        }, 1000);
        return () => clearInterval(interval);
    }, [call?.isMinimized]);

    if (!call?.isMinimized) return null;

    const handleTap = () => {
        navigate(`/call?user=${call.userId}&type=${call.callType}&session=${call.callId}&incoming=0`);
    };

    const handleEnd = async (e: React.MouseEvent) => {
        e.stopPropagation();
        activeCallStore.clear();
        webrtcManager.endCall();
        if (call.callId) {
            try { await callsApi.end(call.callId); } catch { }
        }
    };

    return (
        <div
            onClick={handleTap}
            className="fixed top-0 left-0 right-0 z-[90] bg-emerald-600 safe-area-top cursor-pointer"
        >
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2 min-w-0">
                    {call.callType === "video"
                        ? <Video className="w-4 h-4 text-white flex-shrink-0" />
                        : <Phone className="w-4 h-4 text-white flex-shrink-0" />
                    }
                    <span className="text-white text-sm font-bold truncate">{call.displayName}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse flex-shrink-0" />
                    <span className="text-white/90 text-xs font-mono">{formatDuration(duration)}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-white/80 text-xs">{t("social.tapToReturn", "اضغط للعودة")}</span>
                    <button
                        onClick={handleEnd}
                        className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center"
                    >
                        <PhoneOff className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
}
