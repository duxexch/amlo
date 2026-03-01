import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { useAdmin } from "./AdminLayout";
import { useTranslation } from "react-i18next";

export function AdminLoginPage() {
  const { login, isLoading: authLoading } = useAdmin();
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || t("admin.login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* Decorative Blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/8 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="bg-[#0c0c1d] border border-white/5 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-3xl text-white mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
              A
            </div>
            <h1 className="text-3xl font-black text-white mb-1" style={{ fontFamily: "Outfit" }}>
              Aplo Admin
            </h1>
            <p className="text-white/40 font-medium text-sm">{t("admin.login.subtitle")}</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-white/60 mr-1">{t("admin.login.usernameLabel")}</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all placeholder:text-white/20"
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-white/60 mr-1">{t("admin.login.passwordLabel")}</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all placeholder:text-white/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t("admin.login.submitBtn")}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Dev Note */}
          <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/20 text-center leading-relaxed">
              <span className="text-primary/40 font-bold">{t("admin.login.devNoteTitle")}</span>{" "}
              {t("admin.login.devNoteUser")} <span className="text-white/40 font-mono">admin</span> — {t("admin.login.devNotePass")} <span className="text-white/40 font-mono">admin123</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-white/20 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>{t("admin.login.footer")}</span>
        </div>
      </motion.div>
    </div>
  );
}
