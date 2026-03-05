/**
 * ConnectionStatus — شريط حالة الاتصال
 * ═══════════════════════════════════════
 * Shows a non-blocking banner when the user goes offline,
 * and auto-hides when back online.
 */
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ConnectionStatus() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-all duration-300 ${
        isOffline
          ? "bg-red-500/90 text-white"
          : "bg-green-500/90 text-white animate-in fade-in slide-in-from-top-2"
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="w-4 h-4" />
          {t("connection.offline", "لا يوجد اتصال بالإنترنت")}
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4" />
          {t("connection.reconnected", "تم استعادة الاتصال")}
        </>
      )}
    </div>
  );
}
