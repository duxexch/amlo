import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, Smartphone, Monitor, Apple } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { useTranslation } from "react-i18next";

/**
 * PWA Install Banner — shows at the bottom of the screen.
 * - Android/Desktop: shows native install prompt
 * - iOS: shows manual instructions (Safari → Share → Add to Home Screen)
 * - Hidden when already installed or recently dismissed
 */
export function PWAInstallBanner() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const { canInstall, isInstalled, install, dismiss, isDismissed, platform } = usePWA();

  // Show iOS instructions if on iOS (no native prompt)
  const showIOSHint = platform === "ios" && !isInstalled && !isDismissed;
  // Show native install prompt for Android/Desktop
  const showNativePrompt = canInstall && !isInstalled && !isDismissed;

  if (!showIOSHint && !showNativePrompt) return null;

  const handleInstall = async () => {
    const accepted = await install();
    if (!accepted) dismiss();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-3 right-3 z-[9999] md:left-auto md:right-4 md:max-w-sm"
        dir={dir}
      >
        <div className="relative bg-gradient-to-br from-[#12122a] to-[#0c0c1d] border border-primary/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(168,85,247,0.15)] backdrop-blur-xl">
          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-2 left-2 rtl:left-auto rtl:right-2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label={t("pwa.dismiss", "إغلاق")}
          >
            <X className="w-3.5 h-3.5 text-white/60" />
          </button>

          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              {platform === "ios" ? (
                <Apple className="w-7 h-7 text-primary" />
              ) : platform === "android" ? (
                <Smartphone className="w-7 h-7 text-primary" />
              ) : (
                <Monitor className="w-7 h-7 text-primary" />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h4 className="text-white text-sm font-bold mb-0.5">
                {t("pwa.installTitle", "ثبّت تطبيق Ablox")}
              </h4>
              <p className="text-white/50 text-xs leading-tight">
                {platform === "ios"
                  ? t("pwa.iosInstructions", "اضغط على زر المشاركة ↑ ثم \"إضافة إلى الشاشة الرئيسية\"")
                  : t("pwa.installDesc", "تجربة أسرع وإشعارات فورية — بدون تحميل من المتجر")}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {showNativePrompt && (
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                {t("pwa.installBtn", "تثبيت الآن")}
              </button>
            )}
            {showIOSHint && (
              <div className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white/80 text-xs font-bold py-2.5 rounded-xl">
                <Share className="w-4 h-4" />
                {t("pwa.iosShareBtn", "اضغط المشاركة ➜ أضف للشاشة")}
              </div>
            )}
            <button
              onClick={dismiss}
              className="px-4 py-2.5 text-white/40 hover:text-white/60 text-xs font-bold rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              {t("pwa.later", "لاحقاً")}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
