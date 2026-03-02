import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Loader2, AlertCircle, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { profileApi, authApi } from "../lib/authApi";

export function PinEntry() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(null);

    if (value && index < pin.length - 1) {
      const next = document.getElementById(`pin-${index + 1}`);
      next?.focus();
    }

    // Auto-submit when all digits entered (4-6 digits)
    const fullPin = newPin.join("");
    if (fullPin.length >= 4 && newPin.every(d => d !== "")) {
      handleVerifyPin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      const prev = document.getElementById(`pin-${index - 1}`);
      prev?.focus();
    }
  };

  const handleVerifyPin = async (pinStr: string) => {
    setLoading(true);
    setError(null);
    try {
      await profileApi.verifyPin(pinStr);
      setLocation("/");
    } catch (err: any) {
      setError(err?.message || t("pin.error", "رمز PIN غير صحيح"));
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin(["", "", "", "", "", ""]);
      // Focus first input
      setTimeout(() => document.getElementById("pin-0")?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    const pinStr = pin.join("");
    if (pinStr.length >= 4) {
      handleVerifyPin(pinStr);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm glass p-8 rounded-[2.5rem] border-white/10 relative z-10 text-center"
      >
        {/* Lock Icon */}
        <motion.div
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mx-auto mb-6"
        >
          <Lock className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-2xl font-black text-white mb-2">{t("pin.title", "أدخل رمز PIN")}</h2>
        <p className="text-white/60 text-sm mb-8">
          {t("pin.subtitle", "أدخل رمز PIN الخاص بك لفتح ملفك الشخصي")}
        </p>

        {/* PIN Input */}
        <div className="flex justify-center gap-3 mb-6" dir="ltr">
          {pin.map((val, i) => (
            <input
              key={i}
              id={`pin-${i}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={val}
              onChange={(e) => handlePinChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-white text-xl font-bold focus:outline-none focus:border-primary transition-all disabled:opacity-50"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <AlertCircle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive font-medium">{error}</p>
          </motion.div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleManualSubmit}
          disabled={loading || pin.join("").length < 4}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mb-4"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {t("pin.verify", "تحقق")}
        </button>

        {/* Info text */}
        <p className="text-white/30 text-xs mb-4">
          {t("pin.hint", "كل رمز PIN يفتح ملف شخصي مختلف")}
        </p>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-white/40 text-sm hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto"
        >
          <LogOut className="w-4 h-4" />
          {t("pin.logout", "تسجيل خروج")}
        </button>
      </motion.div>
    </div>
  );
}
