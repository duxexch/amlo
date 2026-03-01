import { useState } from "react";
import { useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, FileText, Camera, MessageCircle,
  Send, Instagram, Twitter, CheckCircle2, Briefcase,
  Users, UserCog, Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

type AccountType = "marketer" | "agent" | "both";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
  photoUrl: string;
  whatsapp: string;
  telegram: string;
  instagram: string;
  twitter: string;
  accountType: AccountType;
}

const INITIAL_FORM: FormData = {
  fullName: "", email: "", phone: "", bio: "", photoUrl: "",
  whatsapp: "", telegram: "", instagram: "", twitter: "",
  accountType: "agent",
};

export function AgentApply() {
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
      setError(t("agentApply.requiredFields"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/agent-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, referralCode: refCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Error");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || t("agentApply.submitError"));
    } finally {
      setLoading(false);
    }
  };

  const accountTypes: { value: AccountType; labelKey: string; icon: React.ElementType; color: string }[] = [
    { value: "marketer", labelKey: "agentApply.typeMarketer", icon: Users, color: "cyan" },
    { value: "agent", labelKey: "agentApply.typeAgent", icon: UserCog, color: "purple" },
    { value: "both", labelKey: "agentApply.typeBoth", icon: Briefcase, color: "yellow" },
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* BG Blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full" />

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
              <h2 className="text-2xl font-black text-white mb-3">{t("agentApply.successTitle")}</h2>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">{t("agentApply.successMessage")}</p>
            </motion.div>
          ) : (
            /* ── Application Form ── */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-2xl neon-border text-white mb-4">A</div>
                <h2 className="text-2xl font-black text-white">{t("agentApply.title")}</h2>
                <p className="text-white/40 text-sm mt-2 text-center">{t("agentApply.subtitle")}</p>
              </div>

              {/* Referral Badge */}
              {refCode && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-2.5 mb-6"
                >
                  <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                  <p className="text-xs text-cyan-400 font-medium">
                    {t("agentApply.referredBy")} <span className="font-mono font-bold">{refCode}</span>
                  </p>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* ── Personal Info ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">{t("agentApply.sectionPersonal")}</h3>
                  <InputField icon={User} placeholder={t("agentApply.fullName")} value={form.fullName} onChange={(v) => update("fullName", v)} required />
                  <InputField icon={Mail} placeholder={t("agentApply.email")} value={form.email} onChange={(v) => update("email", v)} type="email" required />
                  <InputField icon={Phone} placeholder={t("agentApply.phone")} value={form.phone} onChange={(v) => update("phone", v)} type="tel" required />
                  <InputField icon={Camera} placeholder={t("agentApply.photoUrl")} value={form.photoUrl} onChange={(v) => update("photoUrl", v)} />
                  <div className="relative group">
                    <FileText className="absolute right-4 top-4 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white text-sm focus:outline-none focus:border-primary transition-all resize-none h-24 placeholder:text-white/20"
                      placeholder={t("agentApply.bio")}
                      value={form.bio}
                      onChange={(e) => update("bio", e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Social Media ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">{t("agentApply.sectionSocial")}</h3>
                  <InputField icon={MessageCircle} placeholder={t("agentApply.whatsapp")} value={form.whatsapp} onChange={(v) => update("whatsapp", v)} />
                  <InputField icon={Send} placeholder={t("agentApply.telegram")} value={form.telegram} onChange={(v) => update("telegram", v)} />
                  <InputField icon={Instagram} placeholder={t("agentApply.instagram")} value={form.instagram} onChange={(v) => update("instagram", v)} />
                  <InputField icon={Twitter} placeholder={t("agentApply.twitter")} value={form.twitter} onChange={(v) => update("twitter", v)} />
                </div>

                {/* ── Account Type Selection ── */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">{t("agentApply.sectionAccountType")}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {accountTypes.map((at) => {
                      const isSelected = form.accountType === at.value;
                      const colorMap: Record<string, string> = {
                        cyan: isSelected ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400" : "border-white/10 bg-white/[0.02] text-white/40",
                        purple: isSelected ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.02] text-white/40",
                        yellow: isSelected ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400" : "border-white/10 bg-white/[0.02] text-white/40",
                      };
                      return (
                        <button
                          key={at.value}
                          type="button"
                          onClick={() => update("accountType", at.value)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${colorMap[at.color]}`}
                        >
                          <at.icon className="w-5 h-5" />
                          <span className="text-[11px] font-bold">{t(at.labelKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 text-center"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {t("agentApply.submit")}
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ── Reusable Input Field ── */
function InputField({
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  icon: React.ElementType;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="relative group">
      <Icon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
      <input
        type={type}
        required={required}
        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white text-sm focus:outline-none focus:border-primary transition-all placeholder:text-white/20"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
