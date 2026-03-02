/**
 * useConnectionQuality — هوك جودة الاتصال
 * ════════════════════════════════════════
 * Monitors connection quality in real-time and provides
 * adaptive settings for UI components.
 */
import { useState, useEffect, useMemo } from "react";
import { socketManager, type ConnectionInfo, type ConnectionQuality } from "@/lib/socketManager";

export function useConnectionQuality() {
  const [info, setInfo] = useState<ConnectionInfo>(socketManager.getConnectionInfo());

  useEffect(() => {
    const unsub = socketManager.onQualityChange(setInfo);
    return unsub;
  }, []);

  const adaptive = useMemo(() => ({
    // Should we show images?
    showImages: info.quality !== "offline" && (info.quality !== "poor" || !info.dataSaver),
    // Should we use thumbnails instead of full images?
    useThumbnails: info.quality === "poor" || info.quality === "fair" || info.dataSaver,
    // Should we disable animations?
    disableAnimations: info.quality === "poor" || info.dataSaver,
    // Should we load avatars?
    loadAvatars: info.quality !== "offline",
    // Max image quality (0-100)
    imageQuality: info.quality === "poor" ? 30 : info.quality === "fair" ? 50 : 80,
    // Should we enable auto-play for media?
    autoPlayMedia: info.quality === "excellent" || info.quality === "good",
    // Message page size
    messagePageSize: info.quality === "poor" ? 20 : info.quality === "fair" ? 30 : 50,
    // Should video be available? (or force audio-only)
    allowVideo: info.quality !== "poor" && info.quality !== "offline" && !info.dataSaver,
    // Connection quality label for UI
    qualityLabel: getQualityLabel(info.quality),
    qualityColor: getQualityColor(info.quality),
  }), [info]);

  return {
    ...info,
    ...adaptive,
    setDataSaver: (enabled: boolean) => socketManager.setDataSaver(enabled),
    isDataSaver: info.dataSaver,
  };
}

function getQualityLabel(q: ConnectionQuality): string {
  switch (q) {
    case "excellent": return "ممتاز";
    case "good": return "جيد";
    case "fair": return "متوسط";
    case "poor": return "ضعيف";
    case "offline": return "غير متصل";
  }
}

function getQualityColor(q: ConnectionQuality): string {
  switch (q) {
    case "excellent": return "text-emerald-400";
    case "good": return "text-green-400";
    case "fair": return "text-amber-400";
    case "poor": return "text-red-400";
    case "offline": return "text-white/30";
  }
}
