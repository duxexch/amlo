import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, UserCog, Copy, Check, Trash2, Edit3,
  ChevronRight, ChevronLeft, ChevronDown, X, Link2, Filter, Users,
  Monitor, Megaphone, Crown, TrendingUp, Shield,
  FileText, CheckCircle2, XCircle, Eye, MessageCircle,
  Send, Instagram, Twitter, Camera, Phone, Mail,
  Lock, Unlock, Wallet, DollarSign, Percent,
  UserCheck, UserX, Activity, ArrowDownCircle,
  ArrowUpCircle, Gamepad2, Music, GraduationCap, ShoppingCart, Globe, Sparkles, Star, Zap, Mic, Image, ShieldCheck,
} from "lucide-react";
import { adminAgents, adminAgentAccounts, adminVipAgents, adminAgentApplications } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";

// ════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════

type AgentTab = "marketers" | "accounts" | "vip" | "applications";

interface Agent {
  id: string; name: string; email: string; phone: string;
  percentReferralCode: string; fixedReferralCode: string;
  commissionType: "fixed" | "percentage"; commissionRate: string;
  fixedAmount: string; totalUsers: number;
  activeUsers: number; depositedUsers: number; inactiveUsers: number;
  totalRevenue: string; heldBalance: string; availableBalance: string; status: string; createdAt: string;
}

interface AgentAccount {
  id: string; agentId: string; agentName: string; username: string;
  displayName: string; email: string; password: string; referralCode: string;
  userReferralCode: string; agentReferralCode: string;
  type: string; status: string; features: string[];
  commissionRate: string; discount: string; agentInviteCommission: string;
  totalSales: number; totalRevenue: string; coinsEarned: number;
  broadcastHours: number; activeCustomers: number; balanceSent: string;
  createdAt: string;
}

interface VipAgent {
  id: string; name: string; email: string; phone: string | null;
  agentReferralCode: string; userReferralCode: string;
  percentReferralCode: string; fixedReferralCode: string;
  level: "diamond" | "gold" | "silver" | "bronze";
  activityScore: number;
  commissionType: "fixed" | "percentage"; commissionRate: string; fixedAmount: string;
  totalUsers: number; activeUsers: number; depositedUsers: number; inactiveUsers: number;
  invitedAgents: number; invitedUsers: number;
  totalRevenue: string; heldBalance: string; availableBalance: string;
  features: string[];
  totalSales: number; coinsEarned: number; broadcastHours: number;
  activeCustomers: number; balanceSent: string;
  discount: string; agentInviteCommission: string;
  status: string; createdAt: string;
}

interface AgentApplication {
  id: string; referralCode: string; fullName: string;
  email: string; phone: string; bio: string; photoUrl: string;
  socialMedia: { whatsapp: string; telegram: string; instagram: string; twitter: string };
  accountType: "marketer" | "agent" | "both";
  status: "pending" | "approved" | "rejected";
  adminNotes: string; createdAt: string;
}

// ════════════════════════════════════════════════════════════
// Main Page Component
// ════════════════════════════════════════════════════════════

export function AgentsManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AgentTab>("marketers");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput(""); setSearch(""); setShowFilters(false);
    setStatusFilter("all"); setTypeFilter("all");
  }, [activeTab]);

  const tabs: { key: AgentTab; labelKey: string; icon: React.ElementType }[] = [
    { key: "marketers", labelKey: "admin.agents.tabMarketers", icon: Megaphone },
    { key: "accounts", labelKey: "admin.agents.tabAccounts", icon: Monitor },
    { key: "vip", labelKey: "admin.agents.tabVip", icon: Crown },
    { key: "applications", labelKey: "admin.agents.tabApplications", icon: FileText },
  ];

  const SEARCH_PLACEHOLDERS: Record<AgentTab, string> = {
    marketers: "admin.agents.searchPlaceholder",
    accounts: "admin.agents.searchAccounts",
    vip: "admin.agents.searchVip",
    applications: "admin.agents.searchApplications",
  };

  return (
    <div className="space-y-2.5">
      {/* Header with Search & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl font-black text-white" style={{ fontFamily: "Outfit" }}>
          {t("admin.agents.title")}
        </h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl h-9 pr-10 pl-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder={t(SEARCH_PLACEHOLDERS[activeTab])}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => { setSearchInput(""); setSearch(""); }}>
                <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 h-9 text-sm rounded-xl border transition-colors flex-shrink-0 ${
              showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
            }`}
          >
            <Filter className="w-4 h-4" /> {t("admin.finances.filterLabel")}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 py-2">
              <select
                className="bg-white/5 border border-white/10 rounded-lg h-8 px-3 text-xs text-white/70 focus:outline-none focus:border-primary/40"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all" className="bg-[#1a1a2e] text-white">{t("admin.agents.filterAllStatus")}</option>
                <option value="active" className="bg-[#1a1a2e] text-white">{t("common.active")}</option>
                {activeTab === "marketers" && <option value="pending" className="bg-[#1a1a2e] text-white">Pending</option>}
                <option value="suspended" className="bg-[#1a1a2e] text-white">{t("admin.agents.suspended")}</option>
                {activeTab === "accounts" && <option value="disabled" className="bg-[#1a1a2e] text-white">{t("admin.agents.statusDisabled")}</option>}
                {activeTab === "accounts" && <option value="expired" className="bg-[#1a1a2e] text-white">{t("admin.agents.statusExpired")}</option>}
                {activeTab === "vip" && <option value="inactive" className="bg-[#1a1a2e] text-white">{t("admin.agents.statusInactive")}</option>}
                {activeTab === "applications" && <option value="pending" className="bg-[#1a1a2e] text-white">{t("admin.agents.appStatusPending")}</option>}
                {activeTab === "applications" && <option value="approved" className="bg-[#1a1a2e] text-white">{t("admin.agents.appStatusApproved")}</option>}
                {activeTab === "applications" && <option value="rejected" className="bg-[#1a1a2e] text-white">{t("admin.agents.appStatusRejected")}</option>}
              </select>
              {activeTab === "accounts" && (
                <select
                  className="bg-white/5 border border-white/10 rounded-lg h-8 px-3 text-xs text-white/70 focus:outline-none focus:border-primary/40"
                  value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all" className="bg-[#1a1a2e] text-white">{t("admin.agents.filterAllTypes")}</option>
                  <option value="broadcast" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeBroadcast")}</option>
                  <option value="promo" className="bg-[#1a1a2e] text-white">{t("admin.agents.typePromo")}</option>
                  <option value="vip" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeVip")}</option>
                  <option value="hosting" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeHosting")}</option>
                  <option value="gaming" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeGaming")}</option>
                  <option value="music" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeMusic")}</option>
                  <option value="education" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeEducation")}</option>
                  <option value="commerce" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeCommerce")}</option>
                  <option value="social" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeSocial")}</option>
                  <option value="entertainment" className="bg-[#1a1a2e] text-white">{t("admin.agents.typeEntertainment")}</option>
                </select>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Horizontal Tabs */}
      <div className="flex gap-1 p-0.5 bg-white/[0.02] border border-white/5 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab.key ? "text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {activeTab === tab.key && (
              <motion.div
                layoutId="agentTabBg"
                className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-lg"
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              />
            )}
            <tab.icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "marketers" && (
          <motion.div key="marketers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <MarketersTab search={search} statusFilter={statusFilter} />
          </motion.div>
        )}
        {activeTab === "accounts" && (
          <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <AccountsTab search={search} statusFilter={statusFilter} typeFilter={typeFilter} />
          </motion.div>
        )}
        {activeTab === "vip" && (
          <motion.div key="vip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <VipTab search={search} statusFilter={statusFilter} />
          </motion.div>
        )}
        {activeTab === "applications" && (
          <motion.div key="applications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <ApplicationsTab search={search} statusFilter={statusFilter} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 1: Marketers (مسوقين)
// ════════════════════════════════════════════════════════════

function MarketersTab({ search, statusFilter }: { search: string; statusFilter: string }) {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "", commissionType: "percentage" as "fixed" | "percentage", commissionRate: "10", fixedAmount: "0", broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [releaseAgent, setReleaseAgent] = useState<Agent | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [upgradeAgent, setUpgradeAgent] = useState<Agent | null>(null);
  const [upgradeData, setUpgradeData] = useState({ type: "broadcast", features: ["بث مباشر"] as string[], commissionRate: "10", discount: "10", agentInviteCommission: "3", broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01" });
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const getReferralLink = (code: string) => `${window.location.origin}/auth?ref=${code}`;

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await adminAgents.list(params);
      if (res.success) {
        setAgents(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(getReferralLink(code));
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openCreateForm = () => {
    setEditAgent(null);
    setFormData({ name: "", email: "", phone: "", password: "", commissionType: "percentage", commissionRate: "10", fixedAmount: "0", broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01" });
    setFormError(""); setShowForm(true);
  };

  const openEditForm = (agent: Agent) => {
    setEditAgent(agent);
    setFormData({ name: agent.name, email: agent.email, phone: agent.phone, password: "", commissionType: agent.commissionType || "percentage", commissionRate: agent.commissionRate, fixedAmount: agent.fixedAmount || "0", broadcastBaseRate: (agent as any).broadcastBaseRate || "0.10", broadcastViewerBonus: (agent as any).broadcastViewerBonus || "0.01" });
    setFormError(""); setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.name || !formData.email) { setFormError(t("admin.agents.nameEmailRequired")); return; }
    if (!editAgent && !formData.password) { setFormError(t("admin.agents.passwordRequired")); return; }
    setFormLoading(true);
    try {
      if (editAgent) {
        const payload: any = { name: formData.name, email: formData.email, phone: formData.phone, commissionType: formData.commissionType, commissionRate: formData.commissionRate, fixedAmount: formData.fixedAmount };
        if (formData.password) payload.password = formData.password;
        await adminAgents.update(editAgent.id, payload);
      } else {
        await adminAgents.create(formData);
      }
      setShowForm(false); fetchAgents();
    } catch (e: any) {
      setFormError(e?.message || "Error");
    } finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.agents.confirmDelete"))) return;
    try { await adminAgents.delete(id); fetchAgents(); } catch (e) { console.error(e); }
  };

  const openReleaseModal = (agent: Agent) => {
    setReleaseAgent(agent);
    setReleaseAmount("");
    setReleaseError("");
  };

  const handleRelease = async () => {
    if (!releaseAgent) return;
    const amount = parseFloat(releaseAmount);
    if (isNaN(amount) || amount <= 0) { setReleaseError(t("admin.agents.invalidAmount")); return; }
    if (amount > parseFloat(releaseAgent.heldBalance)) { setReleaseError(t("admin.agents.insufficientHeld")); return; }
    setReleaseLoading(true);
    setReleaseError("");
    try {
      await adminAgents.releaseBalance(releaseAgent.id, amount);
      setReleaseAgent(null);
      fetchAgents();
    } catch (e: any) {
      setReleaseError(e?.message || "Error");
    } finally { setReleaseLoading(false); }
  };

  const openUpgradeModal = (agent: Agent) => {
    setUpgradeAgent(agent);
    setUpgradeData({ type: "broadcast", features: ["بث مباشر"], commissionRate: agent.commissionRate, discount: "10", agentInviteCommission: "3", broadcastBaseRate: (agent as any).broadcastBaseRate || "0.10", broadcastViewerBonus: (agent as any).broadcastViewerBonus || "0.01" });
    setUpgradeError("");
  };

  const handleUpgradeToAccount = async () => {
    if (!upgradeAgent) return;
    setUpgradeLoading(true); setUpgradeError("");
    try {
      await adminAgents.upgradeToAccount(upgradeAgent.id, upgradeData);
      setUpgradeAgent(null);
      fetchAgents();
    } catch (e: any) { setUpgradeError(e?.message || "Error"); }
    finally { setUpgradeLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{t("admin.agents.agentCount", { count: pagination.total })}</p>
        <button onClick={openCreateForm} className="flex items-center gap-2 px-5 h-9 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> {t("admin.agents.addAgent")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-56 animate-pulse" />)
        ) : agents.length === 0 ? (
          <div className="col-span-full text-center py-20 text-white/20">{t("admin.agents.noAgents")}</div>
        ) : (
          agents.map((agent, i) => {
            const isExpanded = expandedId === agent.id;
            return (
            <motion.div key={agent.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-[#0c0c1d] border border-white/5 rounded-2xl hover:border-white/10 transition-colors group"
            >
              {/* Collapsed Header — always visible */}
              <button onClick={() => toggleExpand(agent.id)} className="w-full p-4 flex items-center justify-between text-start">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCog className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{agent.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-white/30 truncate">{agent.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ms-3">
                  <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/25">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{agent.totalUsers}</span>
                    <span className="text-green-400">${parseFloat(agent.totalRevenue).toLocaleString()}</span>
                  </div>
                  <StatusBadge status={agent.status} />
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  </motion.div>
                </div>
              </button>

              {/* Expandable Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0 space-y-3 border-t border-white/5">

              {/* Dual Referral Links */}
              <div className="space-y-2 pt-3">
                {/* Percentage Link */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Percent className="w-3 h-3 text-primary" />
                      <p className="text-[10px] text-white/30">{t("admin.agents.percentLinkLabel")}</p>
                    </div>
                    <button className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                      onClick={(e) => { e.stopPropagation(); copyCode(agent.percentReferralCode); }} title={t("admin.agents.copyLink")}
                    >
                      {copiedCode === agent.percentReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-primary truncate" dir="ltr">{getReferralLink(agent.percentReferralCode)}</p>
                </div>
                {/* Fixed Link */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3 text-yellow-400" />
                      <p className="text-[10px] text-white/30">{t("admin.agents.fixedLinkLabel")}</p>
                    </div>
                    <button className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                      onClick={(e) => { e.stopPropagation(); copyCode(agent.fixedReferralCode); }} title={t("admin.agents.copyLink")}
                    >
                      {copiedCode === agent.fixedReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-yellow-400 truncate" dir="ltr">{getReferralLink(agent.fixedReferralCode)}</p>
                </div>
              </div>

              {/* Commission Info */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{agent.commissionRate}%</p>
                  <p className="text-[10px] text-white/25">{t("admin.agents.percentDeposits")}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-yellow-400">${parseFloat(agent.fixedAmount || "0").toLocaleString()}</p>
                  <p className="text-[10px] text-white/25">{t("admin.agents.fixedPerUser")}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-green-400">${parseFloat(agent.totalRevenue).toLocaleString()}</p>
                  <p className="text-[10px] text-white/25">{t("admin.agents.revenueCol")}</p>
                </div>
              </div>

              {/* Account Stats */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <p className="text-[10px] font-bold text-white/40">{t("admin.agents.accountStats")}</p>
                  <span className="ms-auto text-[10px] text-white/20">{agent.totalUsers} {t("admin.agents.totalLabel")}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-emerald-400">{agent.activeUsers}</p>
                    <p className="text-[9px] text-emerald-400/50">{t("admin.agents.activeAccounts")}</p>
                  </div>
                  <div className="bg-sky-500/5 border border-sky-500/10 rounded-lg p-2 text-center">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-sky-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-sky-400">{agent.depositedUsers}</p>
                    <p className="text-[9px] text-sky-400/50">{t("admin.agents.depositedAccounts")}</p>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2 text-center">
                    <UserX className="w-3.5 h-3.5 text-red-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-red-400">{agent.inactiveUsers}</p>
                    <p className="text-[9px] text-red-400/50">{t("admin.agents.inactiveAccounts")}</p>
                  </div>
                </div>
              </div>

              {/* Wallet: Held / Available */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] font-bold text-white/40">{t("admin.agents.walletTitle")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Lock className="w-3 h-3 text-orange-400" />
                      <p className="text-[10px] text-orange-400/60">{t("admin.agents.heldBalance")}</p>
                    </div>
                    <p className="text-sm font-bold text-orange-400">${parseFloat(agent.heldBalance).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Unlock className="w-3 h-3 text-emerald-400" />
                      <p className="text-[10px] text-emerald-400/60">{t("admin.agents.availableBalance")}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-400">${parseFloat(agent.availableBalance).toLocaleString()}</p>
                  </div>
                </div>
                {parseFloat(agent.heldBalance) > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); openReleaseModal(agent); }}
                    className="w-full mt-2 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-[11px] text-primary font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Unlock className="w-3 h-3" /> {t("admin.agents.releaseBalance")}
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button className="flex-1 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 font-bold transition-colors flex items-center justify-center gap-1" onClick={(e) => { e.stopPropagation(); openEditForm(agent); }}>
                  <Edit3 className="w-3 h-3" /> {t("common.edit")}
                </button>
                <button className="flex-1 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-emerald-400 font-bold transition-colors flex items-center justify-center gap-1" onClick={(e) => { e.stopPropagation(); openUpgradeModal(agent); }}>
                  <ArrowUpCircle className="w-3 h-3" /> {t("admin.agents.upgradeToAccount")}
                </button>
                <button className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            );
          })
        )}
      </div>

      {pagination.totalPages > 1 && <PaginationBar pagination={pagination} setPagination={setPagination} />}

      {/* Marketer Form Modal */}
      <AnimatePresence>
        {showForm && (
          <FormModal title={editAgent ? t("admin.agents.editTitle") : t("admin.agents.createTitle")} onClose={() => setShowForm(false)}>
            <div className="space-y-4">
              <FormField label={t("admin.agents.nameCol")} value={formData.name} onChange={(v) => setFormData((f) => ({ ...f, name: v }))} placeholder={t("admin.agents.nameCol")} />
              <FormField label={t("admin.agents.emailCol")} value={formData.email} onChange={(v) => setFormData((f) => ({ ...f, email: v }))} placeholder="email@example.com" type="email" />
              <FormField label={t("admin.agents.phoneCol")} value={formData.phone} onChange={(v) => setFormData((f) => ({ ...f, phone: v }))} placeholder="+966XXXXXXXXX" />
              <FormField label={t("admin.agents.passwordLabel")} value={formData.password} onChange={(v) => setFormData((f) => ({ ...f, password: v }))} placeholder="••••••••" type="password" />

              {/* Commission Settings — both fields always shown */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-white/40">{t("admin.agents.commissionSettings")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-primary mb-1.5">
                      <Percent className="w-3 h-3" /> {t("admin.agents.commissionRateLabel")}
                    </label>
                    <input type="number" value={formData.commissionRate} onChange={(e) => setFormData((f) => ({ ...f, commissionRate: e.target.value }))}
                      placeholder="10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-yellow-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.fixedAmountLabel")}
                    </label>
                    <input type="number" value={formData.fixedAmount} onChange={(e) => setFormData((f) => ({ ...f, fixedAmount: e.target.value }))}
                      placeholder="5.00" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-yellow-500/50 outline-none transition-colors" />
                  </div>
                </div>
              </div>

              {/* Broadcast Commission */}
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-blue-400/70">{t("admin.agents.broadcastCommission")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-blue-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.broadcastBaseRate")}
                    </label>
                    <input type="number" step="0.01" value={formData.broadcastBaseRate} onChange={(e) => setFormData((f) => ({ ...f, broadcastBaseRate: e.target.value }))}
                      placeholder="0.10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-cyan-400 mb-1.5">
                      <Users className="w-3 h-3" /> {t("admin.agents.broadcastViewerBonus")}
                    </label>
                    <input type="number" step="0.001" value={formData.broadcastViewerBonus} onChange={(e) => setFormData((f) => ({ ...f, broadcastViewerBonus: e.target.value }))}
                      placeholder="0.01" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-cyan-500/50 outline-none transition-colors" />
                  </div>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5">
                  <p className="text-[10px] text-blue-400/70 leading-relaxed">{t("admin.agents.broadcastFormula")}</p>
                  <p className="text-[10px] text-white/30 mt-1">{t("admin.agents.broadcastFormulaExample")}</p>
                </div>
              </div>

              {formError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{formError}</div>}
              <FormActions loading={formLoading} isEdit={!!editAgent} onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
            </div>
          </FormModal>
        )}
      </AnimatePresence>

      {/* Release Balance Modal */}
      <AnimatePresence>
        {releaseAgent && (
          <FormModal title={t("admin.agents.releaseBalance")} onClose={() => setReleaseAgent(null)}>
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <p className="text-sm font-bold text-white mb-3">{releaseAgent.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 text-center">
                    <Lock className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                    <p className="text-[10px] text-orange-400/60 mb-0.5">{t("admin.agents.heldBalance")}</p>
                    <p className="text-lg font-bold text-orange-400">${parseFloat(releaseAgent.heldBalance).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 text-center">
                    <Unlock className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                    <p className="text-[10px] text-emerald-400/60 mb-0.5">{t("admin.agents.availableBalance")}</p>
                    <p className="text-lg font-bold text-emerald-400">${parseFloat(releaseAgent.availableBalance).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <FormField label={t("admin.agents.releaseAmount")} value={releaseAmount} onChange={setReleaseAmount} placeholder="0.00" type="number" />
              <button onClick={() => setReleaseAmount(releaseAgent.heldBalance)}
                className="w-full h-7 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-[11px] text-orange-400 font-bold transition-colors"
              >
                {t("admin.agents.releaseAll")} (${parseFloat(releaseAgent.heldBalance).toLocaleString()})
              </button>
              {releaseError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{releaseError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setReleaseAgent(null)} className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/50 font-bold transition-colors">{t("common.cancel")}</button>
                <button onClick={handleRelease} disabled={releaseLoading}
                  className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {releaseLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Unlock className="w-4 h-4" />}
                  {t("admin.agents.confirmRelease")}
                </button>
              </div>
            </div>
          </FormModal>
        )}
      </AnimatePresence>

      {/* Upgrade to Account Modal */}
      <AnimatePresence>
        {upgradeAgent && (
          <FormModal title={t("admin.agents.upgradeToAccount")} onClose={() => setUpgradeAgent(null)}>
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 flex items-center gap-3">
                <ArrowUpCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">{upgradeAgent.name}</p>
                  <p className="text-[11px] text-white/30">{t("admin.agents.upgradeToAccountDesc")}</p>
                </div>
              </div>

              {/* Account Type Selection */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-2 block">{t("admin.agents.accType")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCOUNT_TYPES.map((at) => {
                    const Icon = at.icon;
                    const selected = upgradeData.type === at.key;
                    return (
                      <button key={at.key} onClick={() => setUpgradeData(d => ({ ...d, type: at.key }))}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-start ${
                          selected ? "bg-white/10 border-primary/40" : "bg-white/[0.02] border-white/5 hover:border-white/10"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${at.color}`} />
                        <span className={`text-xs font-medium ${selected ? "text-white" : "text-white/40"}`}>{t(`admin.agents.type${at.key.charAt(0).toUpperCase() + at.key.slice(1)}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.agents.vipFeatures")}</label>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                  {[
                    { key: "بث مباشر", label: t("admin.agents.typeBroadcast") },
                    { key: "شارة مميزة", label: t("admin.agents.featBadge") },
                    { key: "دخول غرف VIP", label: t("admin.agents.featVipRooms") },
                    { key: "هدايا حصرية", label: t("admin.agents.featExclusiveGifts") },
                    { key: "ترويج", label: t("admin.agents.typePromo") },
                    { key: "إعلانات", label: t("admin.agents.featAds") },
                    { key: "إحصائيات متقدمة", label: t("admin.agents.featAdvancedStats") },
                    { key: "إطار مميز", label: t("admin.agents.featSpecialFrame") },
                    { key: "دخول أولوية", label: t("admin.agents.featPriorityEntry") },
                    { key: "غرفة خاصة", label: t("admin.agents.featPrivateRoom") },
                    { key: "حماية الحساب", label: t("admin.agents.featAccountProtection") },
                    { key: "تأثيرات دخول", label: t("admin.agents.featEntryEffects") },
                    { key: "بث صوتي", label: t("admin.agents.featVoiceMessages") },
                    { key: "خلفية بروفايل", label: t("admin.agents.featProfileBackground") },
                  ].map((feat) => {
                    const checked = upgradeData.features.includes(feat.key);
                    return (
                      <label key={feat.key} className="flex items-center gap-3 cursor-pointer group" onClick={() =>
                        setUpgradeData(d => ({ ...d, features: checked ? d.features.filter(x => x !== feat.key) : [...d.features, feat.key] }))
                      }>
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${checked ? "bg-primary border-primary" : "border-white/20 group-hover:border-white/40"}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className={`text-xs transition-colors ${checked ? "text-white" : "text-white/50"}`}>{feat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Commission Settings */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-primary mb-1 block">{t("admin.agents.accCommission")}</label>
                  <input type="number" value={upgradeData.commissionRate} onChange={(e) => setUpgradeData(d => ({ ...d, commissionRate: e.target.value }))}
                    className="w-full h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-white placeholder:text-white/20 focus:border-primary/50 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-green-400 mb-1 block">{t("admin.agents.accDiscount")}</label>
                  <input type="number" value={upgradeData.discount} onChange={(e) => setUpgradeData(d => ({ ...d, discount: e.target.value }))}
                    className="w-full h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-white placeholder:text-white/20 focus:border-green-500/50 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-amber-400 mb-1 block">{t("admin.agents.accAgentInviteCommission")}</label>
                  <input type="number" value={upgradeData.agentInviteCommission} onChange={(e) => setUpgradeData(d => ({ ...d, agentInviteCommission: e.target.value }))}
                    className="w-full h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-white placeholder:text-white/20 focus:border-amber-500/50 outline-none" />
                </div>
              </div>

              {/* Broadcast Commission */}
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-blue-400/70">{t("admin.agents.broadcastCommission")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-blue-400 mb-1 block">{t("admin.agents.broadcastBaseRate")}</label>
                    <input type="number" step="0.01" value={upgradeData.broadcastBaseRate} onChange={(e) => setUpgradeData(d => ({ ...d, broadcastBaseRate: e.target.value }))}
                      className="w-full h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-cyan-400 mb-1 block">{t("admin.agents.broadcastViewerBonus")}</label>
                    <input type="number" step="0.001" value={upgradeData.broadcastViewerBonus} onChange={(e) => setUpgradeData(d => ({ ...d, broadcastViewerBonus: e.target.value }))}
                      className="w-full h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-white placeholder:text-white/20 focus:border-cyan-500/50 outline-none" />
                  </div>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2">
                  <p className="text-[10px] text-blue-400/70 leading-relaxed">{t("admin.agents.broadcastFormula")}</p>
                </div>
              </div>

              {upgradeError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{upgradeError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setUpgradeAgent(null)} className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/50 font-bold transition-colors">{t("common.cancel")}</button>
                <button onClick={handleUpgradeToAccount} disabled={upgradeLoading}
                  className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-500/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {upgradeLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                  {t("admin.agents.confirmUpgrade")}
                </button>
              </div>
            </div>
          </FormModal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 2: Accounts (حسابات)
// ════════════════════════════════════════════════════════════

function AccountsTab({ search, statusFilter, typeFilter }: { search: string; statusFilter: string; typeFilter: string }) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editAcc, setEditAcc] = useState<AgentAccount | null>(null);
  const [formData, setFormData] = useState({ agentId: "", username: "", displayName: "", email: "", features: ["بث مباشر"] as string[], commissionRate: "10", discount: "20", agentInviteCommission: "3", broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState<string | null>(null);
  const [upgradeAcc, setUpgradeAcc] = useState<AgentAccount | null>(null);
  const [upgradeVipData, setUpgradeVipData] = useState({ commissionRate: "10", fixedAmount: "0", discount: "10", agentInviteCommission: "3", features: ["بث مباشر"] as string[], broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01" });
  const [upgradeVipLoading, setUpgradeVipLoading] = useState(false);
  const [upgradeVipError, setUpgradeVipError] = useState("");

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));
  const getUserReferralLink = (code: string) => `${window.location.origin}/register?ref=${code}`;
  const getAgentReferralLink = (code: string) => `${window.location.origin}/account-apply?ref=${code}`;

  const copyCode = (code: string, type: "user" | "agent" = "user") => {
    const link = type === "user" ? getUserReferralLink(code) : getAgentReferralLink(code);
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.type = typeFilter;
      const res = await adminAgentAccounts.list(params);
      if (res.success) {
        setAccounts(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, search, statusFilter, typeFilter]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openCreateForm = () => {
    setEditAcc(null);
    setFormData({ agentId: "", username: "", displayName: "", email: "", features: ["بث مباشر"] as string[], commissionRate: "10", discount: "20", agentInviteCommission: "3", broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01" });
    setFormError(""); setShowForm(true);
  };

  const openEditForm = (acc: AgentAccount) => {
    setEditAcc(acc);
    setFormData({ agentId: acc.agentId, username: acc.username, displayName: acc.displayName, email: acc.email, features: acc.features.length > 0 ? [...acc.features] : ["بث مباشر"], commissionRate: acc.commissionRate, discount: acc.discount, agentInviteCommission: acc.agentInviteCommission || "3", broadcastBaseRate: (acc as any).broadcastBaseRate || "0.10", broadcastViewerBonus: (acc as any).broadcastViewerBonus || "0.01" });
    setFormError(""); setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.username || !formData.displayName) { setFormError(t("admin.agents.accFieldsRequired")); return; }
    if (!editAcc && !formData.agentId) { setFormError(t("admin.agents.accAgentRequired")); return; }
    setFormLoading(true);
    try {
      if (editAcc) {
        await adminAgentAccounts.update(editAcc.id, { username: formData.username, displayName: formData.displayName, email: formData.email, features: formData.features, commissionRate: formData.commissionRate, discount: formData.discount, agentInviteCommission: formData.agentInviteCommission });
      } else {
        await adminAgentAccounts.create(formData);
      }
      setShowForm(false); fetchAccounts();
    } catch (e: any) { setFormError(e?.message || "Error"); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.agents.accConfirmDelete"))) return;
    try { await adminAgentAccounts.delete(id); fetchAccounts(); } catch (e) { console.error(e); }
  };

  const handleApprove = async (id: string) => {
    if (!confirm(t("admin.agents.accConfirmApprove"))) return;
    setApproveLoading(id);
    try {
      await adminAgentAccounts.approve(id);
      fetchAccounts();
    } catch (e) { console.error(e); }
    finally { setApproveLoading(null); }
  };

  const openUpgradeVipModal = (acc: AgentAccount) => {
    setUpgradeAcc(acc);
    setUpgradeVipData({ commissionRate: acc.commissionRate, fixedAmount: "0", discount: acc.discount, agentInviteCommission: acc.agentInviteCommission, features: [...acc.features], broadcastBaseRate: (acc as any).broadcastBaseRate || "0.10", broadcastViewerBonus: (acc as any).broadcastViewerBonus || "0.01" });
    setUpgradeVipError("");
  };

  const handleUpgradeToVip = async () => {
    if (!upgradeAcc) return;
    setUpgradeVipLoading(true); setUpgradeVipError("");
    try {
      await adminAgentAccounts.upgradeToVip(upgradeAcc.id, upgradeVipData);
      setUpgradeAcc(null);
      fetchAccounts();
    } catch (e: any) { setUpgradeVipError(e?.message || "Error"); }
    finally { setUpgradeVipLoading(false); }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "broadcast": return "bg-blue-400/10 text-blue-400 border-blue-400/20";
      case "promo": return "bg-orange-400/10 text-orange-400 border-orange-400/20";
      case "vip": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      case "hosting": return "bg-pink-400/10 text-pink-400 border-pink-400/20";
      case "gaming": return "bg-indigo-400/10 text-indigo-400 border-indigo-400/20";
      case "music": return "bg-fuchsia-400/10 text-fuchsia-400 border-fuchsia-400/20";
      case "education": return "bg-teal-400/10 text-teal-400 border-teal-400/20";
      case "commerce": return "bg-amber-400/10 text-amber-400 border-amber-400/20";
      case "social": return "bg-rose-400/10 text-rose-400 border-rose-400/20";
      case "entertainment": return "bg-lime-400/10 text-lime-400 border-lime-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  };
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "broadcast": return t("admin.agents.typeBroadcast");
      case "promo": return t("admin.agents.typePromo");
      case "vip": return t("admin.agents.typeVip");
      case "hosting": return t("admin.agents.typeHosting");
      case "gaming": return t("admin.agents.typeGaming");
      case "music": return t("admin.agents.typeMusic");
      case "education": return t("admin.agents.typeEducation");
      case "commerce": return t("admin.agents.typeCommerce");
      case "social": return t("admin.agents.typeSocial");
      case "entertainment": return t("admin.agents.typeEntertainment");
      default: return type;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{t("admin.agents.accCount", { count: pagination.total })}</p>
        <button onClick={openCreateForm} className="flex items-center gap-2 px-5 h-9 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> {t("admin.agents.addAccount")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-48 animate-pulse" />)
        ) : accounts.length === 0 ? (
          <div className="col-span-full text-center py-20 text-white/20">{t("admin.agents.noAccounts")}</div>
        ) : (
          accounts.map((acc, i) => {
            const isExpanded = expandedId === acc.id;
            return (
            <motion.div key={acc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-[#0c0c1d] border border-white/5 rounded-2xl hover:border-white/10 transition-colors"
            >
              {/* Collapsed Header */}
              <button onClick={() => toggleExpand(acc.id)} className="w-full p-4 flex items-center justify-between text-start">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Monitor className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{acc.displayName}</h3>
                    <p className="text-[11px] text-white/30 font-mono truncate" dir="ltr">@{acc.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ms-3">
                  <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/25">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{acc.totalSales}</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded-md border ${getTypeStyle(acc.type)}`}>{getTypeLabel(acc.type)}</span>
                  </div>
                  <StatusBadge status={acc.status} />
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  </motion.div>
                </div>
              </button>

              {/* Expandable Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0 space-y-3 border-t border-white/5">

              {/* Pending Alert */}
              {acc.status === "pending" && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-yellow-400" />
                    <p className="text-xs text-yellow-400 font-bold">{t("admin.agents.accPendingApproval")}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApprove(acc.id); }}
                    disabled={approveLoading === acc.id}
                    className="flex items-center gap-1.5 px-4 h-7 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-[11px] text-green-400 font-bold transition-colors disabled:opacity-50"
                  >
                    {approveLoading === acc.id ? <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    {t("admin.agents.accApproveBtn")}
                  </button>
                </div>
              )}

              {/* User Referral Link */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 mt-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-blue-400" />
                    <p className="text-[10px] text-white/30">{t("admin.agents.accUserReferralLink")}</p>
                  </div>
                  <button className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    onClick={(e) => { e.stopPropagation(); copyCode(acc.userReferralCode, "user"); }}
                  >
                    {copiedCode === acc.userReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-blue-400 truncate" dir="ltr">{getUserReferralLink(acc.userReferralCode)}</p>
              </div>

              {/* Agent Referral Link */}
              <div className="bg-white/[0.03] border border-purple-500/10 rounded-xl p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-purple-400" />
                    <p className="text-[10px] text-white/30">{t("admin.agents.accAgentReferralLink")}</p>
                  </div>
                  <button className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    onClick={(e) => { e.stopPropagation(); copyCode(acc.agentReferralCode, "agent"); }}
                  >
                    {copiedCode === acc.agentReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-purple-400 truncate" dir="ltr">{getAgentReferralLink(acc.agentReferralCode)}</p>
              </div>

              {/* Agent + Commission + Discount + Agent Invite Commission */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-white/30 mb-0.5">{t("admin.agents.linkedAgent")}</p>
                  <p className="text-[11px] font-bold text-white truncate">{acc.agentName}</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-white/30 mb-0.5">{t("admin.agents.accCommission")}</p>
                  <p className="text-sm font-bold text-primary">{acc.commissionRate}%</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-white/30 mb-0.5">{t("admin.agents.accDiscount")}</p>
                  <p className="text-sm font-bold text-green-400">{acc.discount}%</p>
                </div>
                <div className="bg-white/[0.03] border border-amber-500/10 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-white/30 mb-0.5">{t("admin.agents.accAgentInviteCommission")}</p>
                  <p className="text-sm font-bold text-amber-400">{acc.agentInviteCommission}%</p>
                </div>
              </div>

              {/* Activity Stats */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <p className="text-[10px] font-bold text-white/40">{t("admin.agents.accActivity")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-emerald-400">{acc.totalSales}</p>
                    <p className="text-[9px] text-emerald-400/50">{t("admin.agents.accTotalSales")}</p>
                  </div>
                  <div className="bg-sky-500/5 border border-sky-500/10 rounded-lg p-2 text-center">
                    <DollarSign className="w-3.5 h-3.5 text-sky-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-sky-400">${acc.totalRevenue}</p>
                    <p className="text-[9px] text-sky-400/50">{t("admin.agents.accRevenue")}</p>
                  </div>
                  <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-2 text-center">
                    <Crown className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-yellow-400">{acc.coinsEarned.toLocaleString()}</p>
                    <p className="text-[9px] text-yellow-400/50">{t("admin.agents.accCoins")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-2 text-center">
                    <Monitor className="w-3.5 h-3.5 text-purple-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-purple-400">{acc.broadcastHours}h</p>
                    <p className="text-[9px] text-purple-400/50">{t("admin.agents.accBroadcast")}</p>
                  </div>
                  <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2 text-center">
                    <Users className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-cyan-400">{acc.activeCustomers}</p>
                    <p className="text-[9px] text-cyan-400/50">{t("admin.agents.accCustomers")}</p>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 text-center">
                    <Wallet className="w-3.5 h-3.5 text-orange-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-orange-400">${acc.balanceSent}</p>
                    <p className="text-[9px] text-orange-400/50">{t("admin.agents.accBalanceSent")}</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              {acc.features.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {acc.features.map((f, idx) => (
                    <span key={idx} className="text-[10px] bg-white/5 border border-white/5 text-white/40 px-2 py-0.5 rounded-md">{f}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button className="flex-1 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 font-bold transition-colors flex items-center justify-center gap-1" onClick={(e) => { e.stopPropagation(); openEditForm(acc); }}>
                  <Edit3 className="w-3 h-3" /> {t("common.edit")}
                </button>
                <button className="flex-1 h-8 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-xs text-yellow-400 font-bold transition-colors flex items-center justify-center gap-1" onClick={(e) => { e.stopPropagation(); openUpgradeVipModal(acc); }}>
                  <Crown className="w-3 h-3" /> {t("admin.agents.upgradeToVip")}
                </button>
                <button className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            );
          })
        )}
      </div>

      {pagination.totalPages > 1 && <PaginationBar pagination={pagination} setPagination={setPagination} />}

      <AnimatePresence>
        {showForm && (
          <FormModal title={editAcc ? t("admin.agents.editAccount") : t("admin.agents.createAccount")} onClose={() => setShowForm(false)}>
            <div className="space-y-4">
              {!editAcc && <FormField label={t("admin.agents.accAgentId")} value={formData.agentId} onChange={(v) => setFormData((f) => ({ ...f, agentId: v }))} placeholder="agent-001" />}
              <FormField label={t("admin.agents.accUsername")} value={formData.username} onChange={(v) => setFormData((f) => ({ ...f, username: v }))} placeholder="username_live" />
              <FormField label={t("admin.agents.accDisplayName")} value={formData.displayName} onChange={(v) => setFormData((f) => ({ ...f, displayName: v }))} placeholder={t("admin.agents.accDisplayName")} />
              <FormField label={t("admin.agents.emailCol")} value={formData.email} onChange={(v) => setFormData((f) => ({ ...f, email: v }))} placeholder="email@example.com" type="email" />
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.agents.accType")}</label>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 max-h-52 overflow-y-auto">
                  {[
                    { key: "بث مباشر", label: t("admin.agents.typeBroadcast") },
                    { key: "شارة مميزة", label: t("admin.agents.featBadge") },
                    { key: "دخول غرف VIP", label: t("admin.agents.featVipRooms") },
                    { key: "هدايا حصرية", label: t("admin.agents.featExclusiveGifts") },
                    { key: "ترويج", label: t("admin.agents.typePromo") },
                    { key: "إعلانات", label: t("admin.agents.featAds") },
                    { key: "إحصائيات متقدمة", label: t("admin.agents.featAdvancedStats") },
                    { key: "إطار مميز", label: t("admin.agents.featSpecialFrame") },
                    { key: "دخول أولوية", label: t("admin.agents.featPriorityEntry") },
                    { key: "غرفة خاصة", label: t("admin.agents.featPrivateRoom") },
                    { key: "حماية الحساب", label: t("admin.agents.featAccountProtection") },
                    { key: "تأثيرات دخول", label: t("admin.agents.featEntryEffects") },
                    { key: "بث صوتي", label: t("admin.agents.featVoiceMessages") },
                    { key: "خلفية بروفايل", label: t("admin.agents.featProfileBackground") },
                  ].map((feat) => {
                    const checked = formData.features.includes(feat.key);
                    return (
                      <label key={feat.key} className="flex items-center gap-3 cursor-pointer group" onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          features: checked ? f.features.filter((x) => x !== feat.key) : [...f.features, feat.key],
                        }))
                      }>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          checked ? "bg-primary border-primary" : "border-white/20 group-hover:border-white/40"
                        }`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm transition-colors ${checked ? "text-white" : "text-white/50"}`}>{feat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-white/40">{t("admin.agents.commissionSettings")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-primary mb-1.5">
                      <Percent className="w-3 h-3" /> {t("admin.agents.accCommission")}
                    </label>
                    <input type="number" value={formData.commissionRate} onChange={(e) => setFormData((f) => ({ ...f, commissionRate: e.target.value }))}
                      placeholder="10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-green-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.accDiscount")}
                    </label>
                    <input type="number" value={formData.discount} onChange={(e) => setFormData((f) => ({ ...f, discount: e.target.value }))}
                      placeholder="20" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-green-500/50 outline-none transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1.5">
                    <Users className="w-3 h-3" /> {t("admin.agents.accAgentInviteCommission")}
                  </label>
                  <input type="number" value={formData.agentInviteCommission} onChange={(e) => setFormData((f) => ({ ...f, agentInviteCommission: e.target.value }))}
                    placeholder="3" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-amber-500/50 outline-none transition-colors" />
                </div>
              </div>

              {/* Broadcast Commission */}
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-blue-400/70">{t("admin.agents.broadcastCommission")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-blue-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.broadcastBaseRate")}
                    </label>
                    <input type="number" step="0.01" value={formData.broadcastBaseRate} onChange={(e) => setFormData((f) => ({ ...f, broadcastBaseRate: e.target.value }))}
                      placeholder="0.10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-cyan-400 mb-1.5">
                      <Users className="w-3 h-3" /> {t("admin.agents.broadcastViewerBonus")}
                    </label>
                    <input type="number" step="0.001" value={formData.broadcastViewerBonus} onChange={(e) => setFormData((f) => ({ ...f, broadcastViewerBonus: e.target.value }))}
                      placeholder="0.01" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-cyan-500/50 outline-none transition-colors" />
                  </div>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5">
                  <p className="text-[10px] text-blue-400/70 leading-relaxed">{t("admin.agents.broadcastFormula")}</p>
                  <p className="text-[10px] text-white/30 mt-1">{t("admin.agents.broadcastFormulaExample")}</p>
                </div>
              </div>

              {formError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{formError}</div>}
              <FormActions loading={formLoading} isEdit={!!editAcc} onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
            </div>
          </FormModal>
        )}
      </AnimatePresence>

      {/* Upgrade to VIP Modal */}
      <AnimatePresence>
        {upgradeAcc && (
          <FormModal title={t("admin.agents.upgradeToVip")} onClose={() => setUpgradeAcc(null)}>
            <div className="space-y-4">
              <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 flex items-center gap-3">
                <Crown className="w-6 h-6 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">{upgradeAcc.displayName}</p>
                  <p className="text-[11px] text-white/30">{t("admin.agents.upgradeToVipDesc")}</p>
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.agents.vipFeatures")}</label>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                  {[
                    { key: "بث مباشر", label: t("admin.agents.typeBroadcast") },
                    { key: "شارة مميزة", label: t("admin.agents.featBadge") },
                    { key: "دخول غرف VIP", label: t("admin.agents.featVipRooms") },
                    { key: "هدايا حصرية", label: t("admin.agents.featExclusiveGifts") },
                    { key: "ترويج", label: t("admin.agents.typePromo") },
                    { key: "إعلانات", label: t("admin.agents.featAds") },
                    { key: "إحصائيات متقدمة", label: t("admin.agents.featAdvancedStats") },
                    { key: "إطار مميز", label: t("admin.agents.featSpecialFrame") },
                    { key: "دخول أولوية", label: t("admin.agents.featPriorityEntry") },
                    { key: "غرفة خاصة", label: t("admin.agents.featPrivateRoom") },
                    { key: "حماية الحساب", label: t("admin.agents.featAccountProtection") },
                    { key: "تأثيرات دخول", label: t("admin.agents.featEntryEffects") },
                    { key: "بث صوتي", label: t("admin.agents.featVoiceMessages") },
                    { key: "خلفية بروفايل", label: t("admin.agents.featProfileBackground") },
                  ].map((feat) => {
                    const checked = upgradeVipData.features.includes(feat.key);
                    return (
                      <label key={feat.key} className="flex items-center gap-3 cursor-pointer group" onClick={() =>
                        setUpgradeVipData(d => ({ ...d, features: checked ? d.features.filter(x => x !== feat.key) : [...d.features, feat.key] }))
                      }>
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${checked ? "bg-primary border-primary" : "border-white/20 group-hover:border-white/40"}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className={`text-xs transition-colors ${checked ? "text-white" : "text-white/50"}`}>{feat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Commission Settings */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-white/40">{t("admin.agents.commissionSettings")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-primary mb-1.5"><Percent className="w-3 h-3" /> {t("admin.agents.commissionRateLabel")}</label>
                    <input type="number" value={upgradeVipData.commissionRate} onChange={(e) => setUpgradeVipData(d => ({ ...d, commissionRate: e.target.value }))}
                      className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-yellow-400 mb-1.5"><DollarSign className="w-3 h-3" /> {t("admin.agents.fixedAmountLabel")}</label>
                    <input type="number" value={upgradeVipData.fixedAmount} onChange={(e) => setUpgradeVipData(d => ({ ...d, fixedAmount: e.target.value }))}
                      className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-yellow-500/50 outline-none transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-green-400 mb-1.5"><DollarSign className="w-3 h-3" /> {t("admin.agents.accDiscount")}</label>
                    <input type="number" value={upgradeVipData.discount} onChange={(e) => setUpgradeVipData(d => ({ ...d, discount: e.target.value }))}
                      className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-green-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1.5"><Users className="w-3 h-3" /> {t("admin.agents.accAgentInviteCommission")}</label>
                    <input type="number" value={upgradeVipData.agentInviteCommission} onChange={(e) => setUpgradeVipData(d => ({ ...d, agentInviteCommission: e.target.value }))}
                      className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-amber-500/50 outline-none transition-colors" />
                  </div>
                </div>
              </div>

              {/* Broadcast Commission */}
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-blue-400/70">{t("admin.agents.broadcastCommission")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-blue-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.broadcastBaseRate")}
                    </label>
                    <input type="number" step="0.01" value={upgradeVipData.broadcastBaseRate} onChange={(e) => setUpgradeVipData(d => ({ ...d, broadcastBaseRate: e.target.value }))}
                      placeholder="0.10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-cyan-400 mb-1.5">
                      <Users className="w-3 h-3" /> {t("admin.agents.broadcastViewerBonus")}
                    </label>
                    <input type="number" step="0.001" value={upgradeVipData.broadcastViewerBonus} onChange={(e) => setUpgradeVipData(d => ({ ...d, broadcastViewerBonus: e.target.value }))}
                      placeholder="0.01" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-cyan-500/50 outline-none transition-colors" />
                  </div>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5">
                  <p className="text-[10px] text-blue-400/70 leading-relaxed">{t("admin.agents.broadcastFormula")}</p>
                </div>
              </div>

              {upgradeVipError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{upgradeVipError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setUpgradeAcc(null)} className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/50 font-bold transition-colors">{t("common.cancel")}</button>
                <button onClick={handleUpgradeToVip} disabled={upgradeVipLoading}
                  className="flex-1 h-10 rounded-xl bg-yellow-500 text-black text-sm font-bold hover:bg-yellow-500/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {upgradeVipLoading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Crown className="w-4 h-4" />}
                  {t("admin.agents.confirmUpgrade")}
                </button>
              </div>
            </div>
          </FormModal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Shared constants for features & account types
// ════════════════════════════════════════════════════════════

const ACCOUNT_TYPES = [
  { key: "broadcast", icon: Monitor, color: "text-blue-400" },
  { key: "promo", icon: Megaphone, color: "text-orange-400" },
  { key: "vip", icon: Crown, color: "text-purple-400" },
  { key: "hosting", icon: Mic, color: "text-pink-400" },
  { key: "gaming", icon: Gamepad2, color: "text-indigo-400" },
  { key: "music", icon: Music, color: "text-fuchsia-400" },
  { key: "education", icon: GraduationCap, color: "text-teal-400" },
  { key: "commerce", icon: ShoppingCart, color: "text-amber-400" },
  { key: "social", icon: Globe, color: "text-rose-400" },
  { key: "entertainment", icon: Sparkles, color: "text-lime-400" },
];

// ════════════════════════════════════════════════════════════
// Tab 3: VIP Agents (المميزين) — Full Featured
// ════════════════════════════════════════════════════════════

const LEVEL_CONFIG = {
  diamond: { icon: "💎", color: "text-cyan-300", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
  gold: { icon: "🥇", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  silver: { icon: "🥈", color: "text-gray-300", bg: "bg-gray-400/10", border: "border-gray-400/20" },
  bronze: { icon: "🥉", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
};

function VipTab({ search, statusFilter }: { search: string; statusFilter: string }) {
  const { t } = useTranslation();
  const [vips, setVips] = useState<VipAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editVip, setEditVip] = useState<VipAgent | null>(null);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "",
    commissionRate: "10", fixedAmount: "0",
    discount: "10", agentInviteCommission: "3",
    features: ["بث مباشر"] as string[],
    broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [releaseVip, setReleaseVip] = useState<VipAgent | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState("");

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const fetchVips = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await adminVipAgents.list(params);
      if (res.success) {
        setVips(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => { fetchVips(); }, [fetchVips]);

  const getAgentReferralLink = (code: string) => `${window.location.origin}/agent-apply?ref=${code}`;
  const getUserReferralLink = (code: string) => `${window.location.origin}/auth?ref=${code}`;
  const getReferralLink = (code: string) => `${window.location.origin}/auth?ref=${code}`;

  const copyCode = (code: string, linkFn: (c: string) => string = getUserReferralLink) => {
    navigator.clipboard.writeText(linkFn(code));
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openCreateForm = () => {
    setEditVip(null);
    setFormData({ name: "", email: "", phone: "", commissionRate: "10", fixedAmount: "0", discount: "10", agentInviteCommission: "3", features: ["بث مباشر"], broadcastBaseRate: "0.10", broadcastViewerBonus: "0.01" });
    setFormError(""); setShowForm(true);
  };
  const openEditForm = (vip: VipAgent) => {
    setEditVip(vip);
    setFormData({
      name: vip.name, email: vip.email, phone: vip.phone || "",
      commissionRate: vip.commissionRate, fixedAmount: vip.fixedAmount,
      discount: vip.discount, agentInviteCommission: vip.agentInviteCommission,
      features: vip.features.length > 0 ? [...vip.features] : ["بث مباشر"],
      broadcastBaseRate: (vip as any).broadcastBaseRate || "0.10", broadcastViewerBonus: (vip as any).broadcastViewerBonus || "0.01",
    });
    setFormError(""); setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.name || !formData.email) { setFormError(t("admin.agents.nameEmailRequired")); return; }
    setFormLoading(true);
    try {
      if (editVip) {
        await adminVipAgents.update(editVip.id, formData);
      } else {
        await adminVipAgents.create(formData);
      }
      setShowForm(false); fetchVips();
    } catch (e: any) { setFormError(e?.message || "Error"); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.agents.vipConfirmDelete"))) return;
    try { await adminVipAgents.delete(id); fetchVips(); } catch (e) { console.error(e); }
  };

  const openReleaseModal = (vip: VipAgent) => {
    setReleaseVip(vip); setReleaseAmount(""); setReleaseError("");
  };

  const handleRelease = async () => {
    if (!releaseVip) return;
    const amount = parseFloat(releaseAmount);
    if (isNaN(amount) || amount <= 0) { setReleaseError(t("admin.agents.invalidAmount")); return; }
    if (amount > parseFloat(releaseVip.heldBalance)) { setReleaseError(t("admin.agents.insufficientHeld")); return; }
    setReleaseLoading(true); setReleaseError("");
    try {
      await adminVipAgents.releaseBalance(releaseVip.id, amount);
      setReleaseVip(null); fetchVips();
    } catch (e: any) { setReleaseError(e?.message || "Error"); }
    finally { setReleaseLoading(false); }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "diamond": return t("admin.agents.levelDiamond");
      case "gold": return t("admin.agents.levelGold");
      case "silver": return t("admin.agents.levelSilver");
      case "bronze": return t("admin.agents.levelBronze");
      default: return level;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{t("admin.agents.vipCount", { count: pagination.total })}</p>
        <button onClick={openCreateForm} className="flex items-center gap-2 px-5 h-9 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> {t("admin.agents.addVip")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-56 animate-pulse" />)
        ) : vips.length === 0 ? (
          <div className="col-span-full text-center py-20 text-white/20">{t("admin.agents.noVip")}</div>
        ) : (
          vips.map((vip, i) => {
            const isExpanded = expandedId === vip.id;
            const levelCfg = LEVEL_CONFIG[vip.level] || LEVEL_CONFIG.bronze;
            return (
            <motion.div key={vip.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-[#0c0c1d] border border-white/5 rounded-2xl hover:border-white/10 transition-colors group"
            >
              {/* Collapsed Header */}
              <button onClick={() => toggleExpand(vip.id)} className="w-full p-4 flex items-center justify-between text-start">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0 relative">
                    <Crown className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white truncate">{vip.name}</h3>
                      {/* Level Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${levelCfg.bg} ${levelCfg.color} ${levelCfg.border} flex items-center gap-1`}>
                        <span>{levelCfg.icon}</span> {getLevelLabel(vip.level)}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/30 truncate">{vip.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ms-3">
                  <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/25">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{vip.totalUsers}</span>
                    <span className="text-green-400">${parseFloat(vip.totalRevenue).toLocaleString()}</span>
                    <span className={`font-bold ${levelCfg.color}`}>
                      <TrendingUp className="w-3 h-3 inline-block ms-0.5" />{vip.activityScore}%
                    </span>
                  </div>
                  <StatusBadge status={vip.status} />
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  </motion.div>
                </div>
              </button>

              {/* Expandable Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0 space-y-3 border-t border-white/5">

              {/* 4 Referral Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-cyan-400" />
                      <p className="text-[10px] text-white/30">{t("admin.agents.vipAgentLink")}</p>
                    </div>
                    <button className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); copyCode(vip.agentReferralCode, getAgentReferralLink); }}>
                      {copiedCode === vip.agentReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-cyan-400 truncate" dir="ltr">{getAgentReferralLink(vip.agentReferralCode)}</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <p className="text-[10px] text-white/30">{t("admin.agents.vipUserLink")}</p>
                    </div>
                    <button className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); copyCode(vip.userReferralCode); }}>
                      {copiedCode === vip.userReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-emerald-400 truncate" dir="ltr">{getUserReferralLink(vip.userReferralCode)}</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Percent className="w-3 h-3 text-primary" />
                      <p className="text-[10px] text-white/30">{t("admin.agents.percentLinkLabel")}</p>
                    </div>
                    <button className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); copyCode(vip.percentReferralCode, getReferralLink); }}>
                      {copiedCode === vip.percentReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-primary truncate" dir="ltr">{getReferralLink(vip.percentReferralCode)}</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3 text-yellow-400" />
                      <p className="text-[10px] text-white/30">{t("admin.agents.fixedLinkLabel")}</p>
                    </div>
                    <button className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); copyCode(vip.fixedReferralCode, getReferralLink); }}>
                      {copiedCode === vip.fixedReferralCode ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5 text-white/40" />}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-yellow-400 truncate" dir="ltr">{getReferralLink(vip.fixedReferralCode)}</p>
                </div>
              </div>

              {/* Commission + Discount Info */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center bg-white/[0.02] rounded-lg p-2">
                  <p className="text-sm font-bold text-primary">{vip.commissionRate}%</p>
                  <p className="text-[10px] text-white/25">{t("admin.agents.percentDeposits")}</p>
                </div>
                <div className="text-center bg-white/[0.02] rounded-lg p-2">
                  <p className="text-sm font-bold text-yellow-400">${parseFloat(vip.fixedAmount).toLocaleString()}</p>
                  <p className="text-[10px] text-white/25">{t("admin.agents.fixedPerUser")}</p>
                </div>
                <div className="text-center bg-white/[0.02] rounded-lg p-2">
                  <p className="text-sm font-bold text-green-400">{vip.discount}%</p>
                  <p className="text-[10px] text-white/25">{t("admin.agents.accDiscount")}</p>
                </div>
                <div className="text-center bg-white/[0.02] rounded-lg p-2">
                  <p className="text-sm font-bold text-amber-400">{vip.agentInviteCommission}%</p>
                  <p className="text-[10px] text-white/25">{t("admin.agents.accAgentInviteCommission")}</p>
                </div>
              </div>

              {/* Account Stats */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <p className="text-[10px] font-bold text-white/40">{t("admin.agents.accountStats")}</p>
                  <span className="ms-auto text-[10px] text-white/20">{vip.totalUsers} {t("admin.agents.totalLabel")}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-emerald-400">{vip.activeUsers}</p>
                    <p className="text-[9px] text-emerald-400/50">{t("admin.agents.activeAccounts")}</p>
                  </div>
                  <div className="bg-sky-500/5 border border-sky-500/10 rounded-lg p-2 text-center">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-sky-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-sky-400">{vip.depositedUsers}</p>
                    <p className="text-[9px] text-sky-400/50">{t("admin.agents.depositedAccounts")}</p>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2 text-center">
                    <UserX className="w-3.5 h-3.5 text-red-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-red-400">{vip.inactiveUsers}</p>
                    <p className="text-[9px] text-red-400/50">{t("admin.agents.inactiveAccounts")}</p>
                  </div>
                </div>
              </div>

              {/* Activity Stats (from Accounts) */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <p className="text-[10px] font-bold text-white/40">{t("admin.agents.accActivity")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-emerald-400">{vip.totalSales}</p>
                    <p className="text-[9px] text-emerald-400/50">{t("admin.agents.accTotalSales")}</p>
                  </div>
                  <div className="bg-sky-500/5 border border-sky-500/10 rounded-lg p-2 text-center">
                    <DollarSign className="w-3.5 h-3.5 text-sky-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-sky-400">${parseFloat(vip.totalRevenue).toLocaleString()}</p>
                    <p className="text-[9px] text-sky-400/50">{t("admin.agents.accRevenue")}</p>
                  </div>
                  <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-2 text-center">
                    <Crown className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-yellow-400">{vip.coinsEarned.toLocaleString()}</p>
                    <p className="text-[9px] text-yellow-400/50">{t("admin.agents.accCoins")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-2 text-center">
                    <Monitor className="w-3.5 h-3.5 text-purple-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-purple-400">{vip.broadcastHours}h</p>
                    <p className="text-[9px] text-purple-400/50">{t("admin.agents.accBroadcast")}</p>
                  </div>
                  <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2 text-center">
                    <Users className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-cyan-400">{vip.activeCustomers}</p>
                    <p className="text-[9px] text-cyan-400/50">{t("admin.agents.accCustomers")}</p>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 text-center">
                    <Wallet className="w-3.5 h-3.5 text-orange-400 mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-orange-400">${vip.balanceSent}</p>
                    <p className="text-[9px] text-orange-400/50">{t("admin.agents.accBalanceSent")}</p>
                  </div>
                </div>
              </div>

              {/* Wallet: Held / Available */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] font-bold text-white/40">{t("admin.agents.walletTitle")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Lock className="w-3 h-3 text-orange-400" />
                      <p className="text-[10px] text-orange-400/60">{t("admin.agents.heldBalance")}</p>
                    </div>
                    <p className="text-sm font-bold text-orange-400">${parseFloat(vip.heldBalance).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Unlock className="w-3 h-3 text-emerald-400" />
                      <p className="text-[10px] text-emerald-400/60">{t("admin.agents.availableBalance")}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-400">${parseFloat(vip.availableBalance).toLocaleString()}</p>
                  </div>
                </div>
                {parseFloat(vip.heldBalance) > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); openReleaseModal(vip); }}
                    className="w-full mt-2 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-[11px] text-primary font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Unlock className="w-3 h-3" /> {t("admin.agents.releaseBalance")}
                  </button>
                )}
              </div>

              {/* Features */}
              {vip.features.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {vip.features.map((f, idx) => (
                    <span key={idx} className="text-[10px] bg-white/5 border border-white/5 text-white/40 px-2 py-0.5 rounded-md">{f}</span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button className="flex-1 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 font-bold transition-colors flex items-center justify-center gap-1" onClick={(e) => { e.stopPropagation(); openEditForm(vip); }}>
                  <Edit3 className="w-3 h-3" /> {t("common.edit")}
                </button>
                <button className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors" onClick={(e) => { e.stopPropagation(); handleDelete(vip.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            );
          })
        )}
      </div>

      {pagination.totalPages > 1 && <PaginationBar pagination={pagination} setPagination={setPagination} />}

      {/* VIP Form Modal */}
      <AnimatePresence>
        {showForm && (
          <FormModal title={editVip ? t("admin.agents.editVip") : t("admin.agents.createVip")} onClose={() => setShowForm(false)}>
            <div className="space-y-4">
              <FormField label={t("admin.agents.nameCol")} value={formData.name} onChange={(v) => setFormData((f) => ({ ...f, name: v }))} placeholder={t("admin.agents.nameCol")} />
              <FormField label={t("admin.agents.emailCol")} value={formData.email} onChange={(v) => setFormData((f) => ({ ...f, email: v }))} placeholder="email@example.com" type="email" />
              <FormField label={t("admin.agents.phoneCol")} value={formData.phone} onChange={(v) => setFormData((f) => ({ ...f, phone: v }))} placeholder="+966XXXXXXXXX" />

              {/* Features (Checkboxes) */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.agents.vipFeatures")}</label>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 max-h-52 overflow-y-auto">
                  {[
                    { key: "بث مباشر", label: t("admin.agents.typeBroadcast") },
                    { key: "شارة مميزة", label: t("admin.agents.featBadge") },
                    { key: "دخول غرف VIP", label: t("admin.agents.featVipRooms") },
                    { key: "هدايا حصرية", label: t("admin.agents.featExclusiveGifts") },
                    { key: "ترويج", label: t("admin.agents.typePromo") },
                    { key: "إعلانات", label: t("admin.agents.featAds") },
                    { key: "إحصائيات متقدمة", label: t("admin.agents.featAdvancedStats") },
                    { key: "إطار مميز", label: t("admin.agents.featSpecialFrame") },
                    { key: "دخول أولوية", label: t("admin.agents.featPriorityEntry") },
                    { key: "غرفة خاصة", label: t("admin.agents.featPrivateRoom") },
                    { key: "حماية الحساب", label: t("admin.agents.featAccountProtection") },
                    { key: "تأثيرات دخول", label: t("admin.agents.featEntryEffects") },
                    { key: "بث صوتي", label: t("admin.agents.featVoiceMessages") },
                    { key: "خلفية بروفايل", label: t("admin.agents.featProfileBackground") },
                  ].map((feat) => {
                    const checked = formData.features.includes(feat.key);
                    return (
                      <label key={feat.key} className="flex items-center gap-3 cursor-pointer group" onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          features: checked ? f.features.filter((x) => x !== feat.key) : [...f.features, feat.key],
                        }))
                      }>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          checked ? "bg-primary border-primary" : "border-white/20 group-hover:border-white/40"
                        }`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm transition-colors ${checked ? "text-white" : "text-white/50"}`}>{feat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Commission & Discount Settings */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-white/40">{t("admin.agents.commissionSettings")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-primary mb-1.5">
                      <Percent className="w-3 h-3" /> {t("admin.agents.commissionRateLabel")}
                    </label>
                    <input type="number" value={formData.commissionRate} onChange={(e) => setFormData((f) => ({ ...f, commissionRate: e.target.value }))}
                      placeholder="10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-primary/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-yellow-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.fixedAmountLabel")}
                    </label>
                    <input type="number" value={formData.fixedAmount} onChange={(e) => setFormData((f) => ({ ...f, fixedAmount: e.target.value }))}
                      placeholder="5.00" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-yellow-500/50 outline-none transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-green-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.accDiscount")}
                    </label>
                    <input type="number" value={formData.discount} onChange={(e) => setFormData((f) => ({ ...f, discount: e.target.value }))}
                      placeholder="10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-green-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1.5">
                      <Users className="w-3 h-3" /> {t("admin.agents.accAgentInviteCommission")}
                    </label>
                    <input type="number" value={formData.agentInviteCommission} onChange={(e) => setFormData((f) => ({ ...f, agentInviteCommission: e.target.value }))}
                      placeholder="3" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-amber-500/50 outline-none transition-colors" />
                  </div>
                </div>
              </div>

              {/* Broadcast Commission */}
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-blue-400/70">{t("admin.agents.broadcastCommission")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-blue-400 mb-1.5">
                      <DollarSign className="w-3 h-3" /> {t("admin.agents.broadcastBaseRate")}
                    </label>
                    <input type="number" step="0.01" value={formData.broadcastBaseRate} onChange={(e) => setFormData((f) => ({ ...f, broadcastBaseRate: e.target.value }))}
                      placeholder="0.10" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] text-cyan-400 mb-1.5">
                      <Users className="w-3 h-3" /> {t("admin.agents.broadcastViewerBonus")}
                    </label>
                    <input type="number" step="0.001" value={formData.broadcastViewerBonus} onChange={(e) => setFormData((f) => ({ ...f, broadcastViewerBonus: e.target.value }))}
                      placeholder="0.01" className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/20 focus:border-cyan-500/50 outline-none transition-colors" />
                  </div>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5">
                  <p className="text-[10px] text-blue-400/70 leading-relaxed">{t("admin.agents.broadcastFormula")}</p>
                  <p className="text-[10px] text-white/30 mt-1">{t("admin.agents.broadcastFormulaExample")}</p>
                </div>
              </div>

              {formError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{formError}</div>}
              <FormActions loading={formLoading} isEdit={!!editVip} onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
            </div>
          </FormModal>
        )}
      </AnimatePresence>

      {/* Release Balance Modal */}
      <AnimatePresence>
        {releaseVip && (
          <FormModal title={t("admin.agents.releaseBalance")} onClose={() => setReleaseVip(null)}>
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-bold text-white">{releaseVip.name}</p>
                  {(() => { const lc = LEVEL_CONFIG[releaseVip.level] || LEVEL_CONFIG.bronze; return (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${lc.bg} ${lc.color} ${lc.border} flex items-center gap-1`}>
                      <span>{lc.icon}</span> {getLevelLabel(releaseVip.level)}
                    </span>
                  ); })()}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 text-center">
                    <Lock className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                    <p className="text-[10px] text-orange-400/60 mb-0.5">{t("admin.agents.heldBalance")}</p>
                    <p className="text-lg font-bold text-orange-400">${parseFloat(releaseVip.heldBalance).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 text-center">
                    <Unlock className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                    <p className="text-[10px] text-emerald-400/60 mb-0.5">{t("admin.agents.availableBalance")}</p>
                    <p className="text-lg font-bold text-emerald-400">${parseFloat(releaseVip.availableBalance).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <FormField label={t("admin.agents.releaseAmount")} value={releaseAmount} onChange={setReleaseAmount} placeholder="0.00" type="number" />
              <button onClick={() => setReleaseAmount(releaseVip.heldBalance)}
                className="w-full h-7 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-[11px] text-orange-400 font-bold transition-colors"
              >
                {t("admin.agents.releaseAll")} (${parseFloat(releaseVip.heldBalance).toLocaleString()})
              </button>
              {releaseError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{releaseError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setReleaseVip(null)} className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/50 font-bold transition-colors">{t("common.cancel")}</button>
                <button onClick={handleRelease} disabled={releaseLoading}
                  className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {releaseLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Unlock className="w-4 h-4" />}
                  {t("admin.agents.confirmRelease")}
                </button>
              </div>
            </div>
          </FormModal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 4: Agent Applications (طلبات الانضمام)
// ════════════════════════════════════════════════════════════

function ApplicationsTab({ search, statusFilter }: { search: string; statusFilter: string }) {
  const { t } = useTranslation();
  const [apps, setApps] = useState<AgentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [viewApp, setViewApp] = useState<AgentApplication | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await adminAgentApplications.list(params);
      if (res.success) {
        setApps(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleUpdateStatus = async (id: string, status: "approved" | "rejected") => {
    const confirmKey = status === "approved" ? "admin.agents.appConfirmApprove" : "admin.agents.appConfirmReject";
    if (!confirm(t(confirmKey))) return;
    try {
      const res = await adminAgentApplications.update(id, { status }) as any;
      if (res.success && status === "approved" && res.newAgent) {
        alert(t("admin.agents.appApprovedMarketerCreated", { name: res.newAgent.name }));
      }
      fetchApps();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.agents.appConfirmDelete"))) return;
    try { await adminAgentApplications.delete(id); fetchApps(); } catch (e) { console.error(e); }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "marketer": return t("admin.agents.appTypeMarketer");
      case "agent": return t("admin.agents.appTypeAgent");
      case "both": return t("admin.agents.appTypeBoth");
      default: return type;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "marketer": return "bg-cyan-400/10 text-cyan-400 border-cyan-400/20";
      case "agent": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      case "both": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  };

  const getAppStatusStyle = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
      case "approved": return "bg-green-400/10 text-green-400 border-green-400/20";
      case "rejected": return "bg-red-400/10 text-red-400 border-red-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  };

  const getAppStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return t("admin.agents.appStatusPending");
      case "approved": return t("admin.agents.appStatusApproved");
      case "rejected": return t("admin.agents.appStatusRejected");
      default: return status;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{t("admin.agents.appCount", { count: pagination.total })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-72 animate-pulse" />)
        ) : apps.length === 0 ? (
          <div className="col-span-full text-center py-20 text-white/20">{t("admin.agents.noApplications")}</div>
        ) : (
          apps.map((app, i) => (
            <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
            >
              {/* Header: Photo + Name + Status */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {app.photoUrl ? (
                    <img src={app.photoUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-white">{app.fullName}</h3>
                    <p className="text-[11px] text-white/30">{app.email}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${getAppStatusStyle(app.status)}`}>
                  {getAppStatusLabel(app.status)}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2 text-[11px] text-white/40">
                  <Phone className="w-3 h-3" /> <span dir="ltr">{app.phone}</span>
                </div>
                {app.referralCode && (
                  <div className="flex items-center gap-2 text-[11px] text-white/40">
                    <Link2 className="w-3 h-3" /> <span className="font-mono text-cyan-400/70">{app.referralCode}</span>
                  </div>
                )}
              </div>

              {/* Account Type */}
              <div className="mb-3">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${getAccountTypeColor(app.accountType)}`}>
                  {getAccountTypeLabel(app.accountType)}
                </span>
              </div>

              {/* Social Media Row */}
              <div className="flex items-center gap-2 mb-4">
                {app.socialMedia.whatsapp && (
                  <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center" title={app.socialMedia.whatsapp}>
                    <MessageCircle className="w-3.5 h-3.5 text-green-400" />
                  </div>
                )}
                {app.socialMedia.telegram && (
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center" title={app.socialMedia.telegram}>
                    <Send className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                )}
                {app.socialMedia.instagram && (
                  <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center" title={app.socialMedia.instagram}>
                    <Instagram className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                )}
                {app.socialMedia.twitter && (
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center" title={app.socialMedia.twitter}>
                    <Twitter className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 font-bold transition-colors flex items-center justify-center gap-1"
                  onClick={() => setViewApp(app)}
                >
                  <Eye className="w-3 h-3" /> {t("admin.agents.appView")}
                </button>
                {app.status === "pending" && (
                  <>
                    <button className="w-8 h-8 rounded-lg bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center transition-colors"
                      onClick={() => handleUpdateStatus(app.id, "approved")} title={t("admin.agents.appApprove")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    </button>
                    <button className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                      onClick={() => handleUpdateStatus(app.id, "rejected")} title={t("admin.agents.appReject")}
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </>
                )}
                <button className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                  onClick={() => handleDelete(app.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {pagination.totalPages > 1 && <PaginationBar pagination={pagination} setPagination={setPagination} />}

      {/* View Application Detail Modal */}
      <AnimatePresence>
        {viewApp && (
          <FormModal title={t("admin.agents.appDetail")} onClose={() => setViewApp(null)}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Photo */}
              {viewApp.photoUrl && (
                <div className="flex justify-center">
                  <img src={viewApp.photoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border border-white/10" />
                </div>
              )}

              {/* Info Rows */}
              <div className="space-y-3">
                <InfoRow icon={<UserCog className="w-4 h-4" />} label={t("admin.agents.appFullName")} value={viewApp.fullName} />
                <InfoRow icon={<Mail className="w-4 h-4" />} label={t("admin.agents.emailCol")} value={viewApp.email} />
                <InfoRow icon={<Phone className="w-4 h-4" />} label={t("admin.agents.phoneCol")} value={viewApp.phone} />
                {viewApp.referralCode && (
                  <InfoRow icon={<Link2 className="w-4 h-4" />} label={t("admin.agents.appReferral")} value={viewApp.referralCode} />
                )}
              </div>

              {/* Bio */}
              {viewApp.bio && (
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.agents.appBio")}</label>
                  <p className="text-sm text-white/70 bg-white/[0.03] border border-white/5 rounded-xl p-3">{viewApp.bio}</p>
                </div>
              )}

              {/* Account Type */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.agents.appAccountType")}</label>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${getAccountTypeColor(viewApp.accountType)}`}>
                  {getAccountTypeLabel(viewApp.accountType)}
                </span>
              </div>

              {/* Social Media */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-2 block">{t("admin.agents.appSocialMedia")}</label>
                <div className="space-y-2">
                  {viewApp.socialMedia.whatsapp && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <MessageCircle className="w-3.5 h-3.5 text-green-400" /> <span>{viewApp.socialMedia.whatsapp}</span>
                    </div>
                  )}
                  {viewApp.socialMedia.telegram && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Send className="w-3.5 h-3.5 text-blue-400" /> <span>{viewApp.socialMedia.telegram}</span>
                    </div>
                  )}
                  {viewApp.socialMedia.instagram && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Instagram className="w-3.5 h-3.5 text-pink-400" /> <span>{viewApp.socialMedia.instagram}</span>
                    </div>
                  )}
                  {viewApp.socialMedia.twitter && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Twitter className="w-3.5 h-3.5 text-sky-400" /> <span>{viewApp.socialMedia.twitter}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.agents.appStatus")}</label>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${getAppStatusStyle(viewApp.status)}`}>
                  {getAppStatusLabel(viewApp.status)}
                </span>
              </div>

              {/* Actions */}
              {viewApp.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 h-10 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2"
                    onClick={() => { handleUpdateStatus(viewApp.id, "approved"); setViewApp(null); }}
                  >
                    <CheckCircle2 className="w-4 h-4" /> {t("admin.agents.appApprove")}
                  </button>
                  <button
                    className="flex-1 h-10 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                    onClick={() => { handleUpdateStatus(viewApp.id, "rejected"); setViewApp(null); }}
                  >
                    <XCircle className="w-4 h-4" /> {t("admin.agents.appReject")}
                  </button>
                </div>
              )}
            </div>
          </FormModal>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
      <div className="text-white/30">{icon}</div>
      <div>
        <p className="text-[10px] text-white/30">{label}</p>
        <p className="text-xs text-white/70 font-medium">{value}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Shared Components
// ════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const style = (() => {
    switch (status) {
      case "active": return "bg-green-400/10 text-green-400 border-green-400/20";
      case "pending": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
      case "suspended": return "bg-red-400/10 text-red-400 border-red-400/20";
      case "disabled": return "bg-gray-400/10 text-gray-400 border-gray-400/20";
      case "expired": return "bg-orange-400/10 text-orange-400 border-orange-400/20";
      case "inactive": return "bg-gray-400/10 text-gray-400 border-gray-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  })();
  const label = (() => {
    switch (status) {
      case "active": return t("common.active");
      case "pending": return "Pending";
      case "suspended": return t("admin.agents.suspended");
      case "disabled": return t("admin.agents.statusDisabled");
      case "expired": return t("admin.agents.statusExpired");
      case "inactive": return t("admin.agents.statusInactive");
      default: return status;
    }
  })();
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${style}`}>{label}</span>;
}

function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md max-h-[90vh] bg-[#0c0c1d] border border-white/10 rounded-2xl flex flex-col" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={onClose}>
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6 flex-1 min-h-0">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="text-xs text-white/40 font-medium mb-1.5 block">{label}</label>
      <input type={type} className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
        placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FormActions({ loading, isEdit, onSubmit, onCancel }: { loading: boolean; isEdit: boolean; onSubmit: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2 pt-2">
      <button className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50" disabled={loading} onClick={onSubmit}>
        {loading ? t("common.loading") : isEdit ? t("common.save") : t("common.add")}
      </button>
      <button className="px-6 h-10 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-colors" onClick={onCancel}>
        {t("common.cancel")}
      </button>
    </div>
  );
}

function PaginationBar({ pagination, setPagination }: { pagination: { page: number; totalPages: number }; setPagination: React.Dispatch<React.SetStateAction<any>> }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-white/30">{t("admin.finances.pageOf", { page: pagination.page, total: pagination.totalPages })}</p>
      <div className="flex items-center gap-1">
        <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page <= 1} onClick={() => setPagination((p: any) => ({ ...p, page: p.page - 1 }))}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p: any) => ({ ...p, page: p.page + 1 }))}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
