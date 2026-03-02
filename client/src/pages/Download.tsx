import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Download as DownloadIcon, Smartphone, Globe, Package, ArrowRight, Shield, Zap, Star, ChevronLeft, Loader2, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DownloadType {
  enabled: boolean;
  url: string;
  extension: string;
  description: string;
}

interface DownloadSettings {
  enabled: boolean;
  domain: string;
  pwa: DownloadType;
  apk: DownloadType;
  aab: DownloadType;
}

export function DownloadPage() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<DownloadSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const deferredPromptRef = useRef<any>(null);

  // Capture the beforeinstallprompt event for PWA install
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setPwaInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    fetch("/api/app-download")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setSettings(res.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center" dir={dir}>
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !settings || !settings.enabled) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4" dir={dir}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <DownloadIcon className="w-8 h-8 text-white/40" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t("download.unavailable")}</h2>
          <p className="text-white/50 text-sm mb-6">{t("download.unavailableDesc")}</p>
          <button onClick={() => setLocation("/")} className="px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">
            {t("common.back")}
          </button>
        </motion.div>
      </div>
    );
  }

  const downloadOptions = [
    {
      key: "pwa",
      data: settings.pwa,
      icon: Globe,
      gradient: "from-blue-500 to-cyan-500",
      shadow: "shadow-blue-500/20",
      badge: t("download.pwaBadge"),
      title: t("download.pwaTitle"),
      buttonText: t("download.pwaButton"),
    },
    {
      key: "apk",
      data: settings.apk,
      icon: Smartphone,
      gradient: "from-green-500 to-emerald-500",
      shadow: "shadow-green-500/20",
      badge: "APK",
      title: t("download.apkTitle"),
      buttonText: t("download.apkButton"),
    },
    {
      key: "aab",
      data: settings.aab,
      icon: Package,
      gradient: "from-purple-500 to-pink-500",
      shadow: "shadow-purple-500/20",
      badge: "AAB",
      title: t("download.aabTitle"),
      buttonText: t("download.aabButton"),
    },
  ].filter((opt) => opt.data.enabled);

  const handleDownload = async (opt: DownloadType, key: string) => {
    if (key === "pwa") {
      // Try native PWA install prompt first
      if (deferredPromptRef.current) {
        try {
          await deferredPromptRef.current.prompt();
          const result = await deferredPromptRef.current.userChoice;
          if (result.outcome === "accepted") {
            setPwaInstalled(true);
          }
          deferredPromptRef.current = null;
        } catch {
          // Fallback: open app in new tab
          window.open(opt.url || `${settings!.domain}${opt.extension}`, "_blank", "noopener,noreferrer");
        }
      } else if (pwaInstalled) {
        // Already installed
        return;
      } else {
        // No install prompt available — open the app URL
        const url = opt.url || `${settings!.domain}${opt.extension}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } else {
      // APK / AAB — direct download
      const url = opt.url || `${settings!.domain}${opt.extension}`;
      // Use anchor download for direct file downloads
      const a = document.createElement("a");
      a.href = url;
      a.download = url.split("/").pop() || `ablox.${key}`;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const features = [
    { icon: Zap, label: t("download.featureFast") },
    { icon: Shield, label: t("download.featureSecure") },
    { icon: Star, label: t("download.featureFree") },
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/8 blur-[150px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/8 blur-[150px] rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full" />

      <div className="w-full max-w-lg mx-auto relative z-10">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setLocation("/")}
          className="flex items-center gap-1 text-white/50 hover:text-white/80 transition-colors text-sm mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("common.back")}
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-gradient-to-r from-primary to-secondary rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-primary/20">
            <DownloadIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t("download.title")}</h1>
          <p className="text-white/60 text-sm max-w-sm mx-auto">{t("download.subtitle")}</p>
        </motion.div>

        {/* Features row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-6 mb-8"
        >
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-white/50 text-xs">
              <f.icon className="w-3.5 h-3.5" />
              <span>{f.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Download cards */}
        <div className="space-y-4">
          {downloadOptions.map((opt, index) => (
            <motion.div
              key={opt.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.1 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 bg-gradient-to-r ${opt.gradient} rounded-xl flex items-center justify-center shrink-0 shadow-lg ${opt.shadow}`}>
                  <opt.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-sm">{opt.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${opt.gradient} text-white font-medium`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs mb-3">
                    {opt.data.description || t(`download.${opt.key}Desc`)}
                  </p>
                  <button
                    onClick={() => handleDownload(opt.data, opt.key)}
                    disabled={opt.key === "pwa" && pwaInstalled}
                    className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${opt.gradient} text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all ${opt.key === "pwa" && pwaInstalled ? "opacity-60 cursor-default" : ""}`}
                  >
                    {opt.key === "pwa" && pwaInstalled ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t("download.pwaInstalled")}
                      </>
                    ) : (
                      <>
                        {opt.buttonText}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* No options available */}
        {downloadOptions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-white/40 text-sm">{t("download.noOptions")}</p>
          </motion.div>
        )}

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-white/30 text-xs mt-8"
        >
          {t("download.footer")}
        </motion.p>
      </div>
    </div>
  );
}
