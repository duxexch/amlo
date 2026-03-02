import { useState } from "react";
import { useSearch, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Check, AlertCircle, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authApi } from "../lib/authApi";

export function ResetPassword() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token") || "";
  const [, setLocation] = useLocation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password strength checks
  const hasMinLength = password.length >= 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isValid = hasMinLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setError(null);
    setLoading(true);
    try {
      const result = await authApi.resetPassword(token, password);
      if (result.success) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => setLocation("/auth"), 3000);
      }
    } catch (err: any) {
      setError(err?.message || t("resetPassword.error"));
    } finally {
      setLoading(false);
    }
  };

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/10 blur-[120px] rounded-full" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t("resetPassword.invalidLink")}</h2>
            <p className="text-white/60 text-sm mb-6">{t("resetPassword.invalidLinkDesc")}</p>
            <button
              onClick={() => setLocation("/auth")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm"
            >
              {t("auth.backToLogin")}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-500/10 blur-[120px] rounded-full" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Check className="w-10 h-10 text-green-400" />
            </motion.div>
            <h2 className="text-xl font-bold text-white mb-2">{t("resetPassword.successTitle")}</h2>
            <p className="text-white/60 text-sm mb-4">{t("resetPassword.successDesc")}</p>
            <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t("resetPassword.redirecting")}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t("resetPassword.title")}</h1>
          <p className="text-white/60 text-sm">{t("resetPassword.subtitle")}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-5">
          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              {t("resetPassword.newPassword")}
            </label>
            <div className="relative">
              <Lock className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-white/40" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl ps-10 pe-10 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                placeholder={t("resetPassword.newPasswordPlaceholder")}
                required
                minLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-white/40 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              {t("resetPassword.confirmPassword")}
            </label>
            <div className="relative">
              <Lock className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-white/40" />
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl ps-10 pe-10 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-white/40 hover:text-white/60 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password strength indicators */}
          <div className="space-y-2">
            <PasswordCheck ok={hasMinLength} label={t("resetPassword.rule6Chars")} />
            <PasswordCheck ok={hasUpperCase} label={t("resetPassword.ruleUppercase")} />
            <PasswordCheck ok={hasNumber} label={t("resetPassword.ruleNumber")} />
            <PasswordCheck ok={passwordsMatch} label={t("resetPassword.ruleMatch")} />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t("resetPassword.submitBtn")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Back to login */}
          <button
            type="button"
            onClick={() => setLocation("/auth")}
            className="w-full py-2 text-white/50 hover:text-white/80 transition-colors text-sm"
          >
            {t("auth.backToLogin")}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function PasswordCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${ok ? "bg-green-500/20" : "bg-white/5"}`}>
        {ok ? <Check className="w-2.5 h-2.5 text-green-400" /> : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
      </div>
      <span className={ok ? "text-green-400" : "text-white/40"}>{label}</span>
    </div>
  );
}
