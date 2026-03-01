import { useState, useEffect, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  UserCog, Lock, Mail, ArrowRight, AlertCircle, LogOut,
  Users, DollarSign, Percent, Link2, Copy, Check,
  TrendingUp, Wallet, ExternalLink,
} from "lucide-react";
import { agentAuth, type AgentData } from "@/lib/agentApi";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ── Agent Auth Context ────────────────────────────────────
interface AgentCtx {
  agent: AgentData | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AgentContext = createContext<AgentCtx>({
  agent: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAgent = () => useContext(AgentContext);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    agentAuth
      .me()
      .then((res) => {
        if (res.success && res.data) setAgent(res.data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await agentAuth.login(email, password);
    if (res.success && res.data) {
      setAgent(res.data);
      setLocation("/agent/dashboard");
    }
  };

  const logout = async () => {
    await agentAuth.logout().catch(() => {});
    setAgent(null);
    setLocation("/agent");
  };

  return (
    <AgentContext.Provider value={{ agent, isLoading, login, logout }}>
      {children}
    </AgentContext.Provider>
  );
}

// ── Agent Login Page ──────────────────────────────────────
export function AgentLoginPage() {
  const { login, isLoading: authLoading, agent } = useAgent();
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && agent) {
      setLocation("/agent/dashboard");
    }
  }, [authLoading, agent, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || t("agent.login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/8 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-[#0c0c1d] border border-white/5 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 to-primary flex items-center justify-center font-bold text-3xl text-white mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <UserCog className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-white mb-1" style={{ fontFamily: "Outfit" }}>
              {t("agent.login.title")}
            </h1>
            <p className="text-white/40 font-medium text-sm">{t("agent.login.subtitle")}</p>
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
              <label className="text-sm font-bold text-white/60 mr-1">{t("agent.login.emailLabel")}</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] transition-all placeholder:text-white/20"
                  placeholder="agent@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-white/60 mr-1">{t("agent.login.passwordLabel")}</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] transition-all placeholder:text-white/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-500/90 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t("agent.login.submitBtn")}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Dev Note */}
          <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/20 text-center leading-relaxed">
              <span className="text-emerald-400/40 font-bold">{t("agent.login.devNoteTitle")}</span>{" "}
              {t("agent.login.devNoteEmail")} <span className="text-white/40 font-mono">horizon@example.com</span> — {t("agent.login.devNotePass")} <span className="text-white/40 font-mono">agent123</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-white/20 text-xs">
          <UserCog className="w-3.5 h-3.5" />
          <span>{t("agent.login.footer")}</span>
        </div>
      </motion.div>
    </div>
  );
}

// ── Agent Dashboard ───────────────────────────────────────
export function AgentDashboardPage() {
  const { agent, isLoading, logout } = useAgent();
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [copiedLink, setCopiedLink] = useState(false);
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !agent) {
      setLocation("/agent");
    }
  }, [isLoading, agent, setLocation]);

  const referralLink = `${window.location.origin}/auth?ref=${agent?.referralCode || ""}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!agent) return (
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  const stats = [
    {
      icon: Users,
      label: t("agent.dashboard.totalUsers"),
      value: agent.totalUsers.toLocaleString(),
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      icon: DollarSign,
      label: t("agent.dashboard.totalRevenue"),
      value: `$${parseFloat(agent.totalRevenue).toLocaleString()}`,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      icon: Wallet,
      label: t("agent.dashboard.balance"),
      value: `$${parseFloat(agent.balance).toLocaleString()}`,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
    {
      icon: Percent,
      label: t("agent.dashboard.commissionRate"),
      value: `${agent.commissionRate}%`,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  return (
    <div className="min-h-screen bg-[#06060f] text-white" dir={dir}>
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#06060f]/80 backdrop-blur-xl border-b border-white/5 px-4 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-primary flex items-center justify-center font-bold text-xl text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white" style={{ fontFamily: "Outfit" }}>
                {t("agent.dashboard.title")}
              </h1>
              <p className="text-[11px] text-white/30">{agent.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t("common.logout")}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-500/10 to-primary/10 border border-emerald-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <UserCog className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t("agent.dashboard.welcome", { name: agent.name })}</h2>
              <p className="text-white/40 text-sm">{agent.email}</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5"
            >
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/30 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Referral Link Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t("agent.dashboard.referralLink")}</h3>
              <p className="text-xs text-white/30">{t("agent.dashboard.referralLinkDesc")}</p>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-emerald-400 truncate select-all" dir="ltr">
                {referralLink}
              </p>
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-sm font-bold transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4" />
                  {t("agent.dashboard.copied")}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {t("agent.dashboard.copyLink")}
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-white/20 mt-3">{t("agent.dashboard.referralLinkHelp")}</p>
        </motion.div>

        {/* How it Works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">{t("agent.dashboard.howItWorks")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "1", title: t("agent.dashboard.step1Title"), desc: t("agent.dashboard.step1Desc"), icon: Link2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
              { step: "2", title: t("agent.dashboard.step2Title"), desc: t("agent.dashboard.step2Desc"), icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
              { step: "3", title: t("agent.dashboard.step3Title"), desc: t("agent.dashboard.step3Desc"), icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-400/10" },
            ].map((s) => (
              <div key={s.step} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{s.title}</h4>
                <p className="text-xs text-white/30">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
