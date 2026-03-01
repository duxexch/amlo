import { useState } from "react";
import { useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, FileText, CheckCircle2, Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
}

const INITIAL_FORM: FormData = {
  fullName: "", email: "", phone: "", bio: "",
};

export function AccountApply() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const refCode = params.get("ref") || "";

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.fullName || !form.email || !form.phone) {
      setError(t("accountApply.requiredFields"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, accountReferralCode: refCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Error");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || t("accountApply.submitError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* BG Blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />

      <motion.div
        layout
        className="w-full max-w-lg glass p-8 rounded-[2.5rem] border-white/10 relative z-10 my-8"
      >
        <AnimatePresence mode="wait">
          {submitted ? (
            /* ── Success State ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-3">{t("accountApply.successTitle")}</h2>
              <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
                {t("accountApply.successMessage")}
              </p>
            </motion.div>
          ) : (
            /* ── Form ── */
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-blue-400" />
                </div>
                <h1 className="text-xl font-black text-white mb-1">{t("accountApply.title")}</h1>
                <p className="text-white/30 text-sm">{t("accountApply.subtitle")}</p>
                {refCode && (
                  <p className="text-blue-400 text-[11px] mt-2 bg-blue-500/5 border border-blue-500/20 inline-block px-3 py-1 rounded-full font-mono" dir="ltr">
                    ref: {refCode}
                  </p>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-1.5">
                  <User className="w-3 h-3" /> {t("accountApply.fullName")} *
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors"
                  placeholder={t("accountApply.fullNamePlaceholder")}
                />
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-1.5">
                  <Mail className="w-3 h-3" /> {t("accountApply.email")} *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors"
                  dir="ltr"
                  placeholder="email@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-1.5">
                  <Phone className="w-3 h-3" /> {t("accountApply.phone")} *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors"
                  dir="ltr"
                  placeholder="+966XXXXXXXXX"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-1.5">
                  <FileText className="w-3 h-3" /> {t("accountApply.bio")}
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors resize-none"
                  placeholder={t("accountApply.bioPlaceholder")}
                />
              </div>

              {/* What you get */}
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-400 mb-2">{t("accountApply.benefitsTitle")}</p>
                <ul className="space-y-1.5 text-[11px] text-white/40">
                  <li>• {t("accountApply.benefit1")}</li>
                  <li>• {t("accountApply.benefit2")}</li>
                  <li>• {t("accountApply.benefit3")}</li>
                  <li>• {t("accountApply.benefit4")}</li>
                  <li>• {t("accountApply.benefit5")}</li>
                </ul>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 text-center">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {t("accountApply.submitBtn")}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
