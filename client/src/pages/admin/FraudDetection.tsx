import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, Search, Filter, AlertTriangle, Eye, ChevronDown,
  X, Users, Bot, RefreshCw, Ban, UserX, CheckCircle2, XCircle,
  Clock, Activity, DollarSign, Fingerprint, Globe, TrendingUp,
  MessageSquare, ChevronLeft, ChevronRight, Loader2, Link2,
  Zap, ArrowLeftRight, Gift, UserPlus, CreditCard, Send,
} from "lucide-react";
import { adminFraud } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";

interface FraudAlert {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  userId: string | null;
  userName: string | null;
  agentId: string | null;
  agentName: string | null;
  evidence: { label: string; value: string }[];
  riskScore: number;
  amount: string | null;
  ipAddress: string | null;
  deviceFingerprint: string | null;
  relatedAlertIds: string[];
  adminNotes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  autoAction: string | null;
  createdAt: string;
}

interface FraudStats {
  total: number;
  newAlerts: number;
  investigating: number;
  confirmed: number;
  critical: number;
  high: number;
  totalAmount: string;
  avgRiskScore: number;
  byCategory: Record<string, number>;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  timeline: { day: string; count: number }[];
  categoryTitles: Record<string, string>;
}

// ═══════════════════════════════════════════════════════
// FRAUD DETECTION PAGE
// ═══════════════════════════════════════════════════════

export function FraudDetectionPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [noteText, setNoteText] = useState<Record<string, string>>({});

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFraud.stats();
      if (res.success) setStats(res.data);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFraud.list({
        page,
        limit: 20,
        search,
        status: statusFilter !== "all" ? statusFilter : undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
      });
      if (res.success) {
        setAlerts(res.data || []);
        setTotalPages(res.pagination?.totalPages || 1);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [page, search, statusFilter, severityFilter, categoryFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleStatusChange = async (alertId: string, newStatus: string) => {
    setActionLoading(alertId);
    try {
      const notes = noteText[alertId];
      await adminFraud.update(alertId, { status: newStatus, ...(notes ? { adminNotes: notes } : {}) });
      await fetchAlerts();
      await fetchStats();
    } catch (e) { /* ignore */ }
    setActionLoading(null);
  };

  const handleBanUser = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await adminFraud.banUser(alertId);
      await fetchAlerts();
      await fetchStats();
    } catch (e) { /* ignore */ }
    setActionLoading(null);
  };

  const handleSuspendAgent = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await adminFraud.suspendAgent(alertId);
      await fetchAlerts();
      await fetchStats();
    } catch (e) { /* ignore */ }
    setActionLoading(null);
  };

  const severityConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: t("admin.fraud.critical") },
    high: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", label: t("admin.fraud.high") },
    medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: t("admin.fraud.medium") },
    low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: t("admin.fraud.low") },
  };

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    new: { color: "text-red-400", bg: "bg-red-500/15", label: t("admin.fraud.statusNew") },
    investigating: { color: "text-yellow-400", bg: "bg-yellow-500/15", label: t("admin.fraud.statusInvestigating") },
    confirmed: { color: "text-orange-400", bg: "bg-orange-500/15", label: t("admin.fraud.statusConfirmed") },
    dismissed: { color: "text-white/40", bg: "bg-white/5", label: t("admin.fraud.statusDismissed") },
    resolved: { color: "text-green-400", bg: "bg-green-500/15", label: t("admin.fraud.statusResolved") },
  };

  const categoryIcons: Record<string, any> = {
    multi_account: Users,
    rapid_transactions: Zap,
    abnormal_gifts: Gift,
    suspicious_referral: UserPlus,
    fake_engagement: Activity,
    money_laundering: ArrowLeftRight,
    bot_activity: Bot,
    chargeback: CreditCard,
  };

  const categoryColors: Record<string, string> = {
    multi_account: "text-purple-400",
    rapid_transactions: "text-orange-400",
    abnormal_gifts: "text-pink-400",
    suspicious_referral: "text-cyan-400",
    fake_engagement: "text-yellow-400",
    money_laundering: "text-red-400",
    bot_activity: "text-emerald-400",
    chargeback: "text-blue-400",
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${t("admin.fraud.timeAgo")} ${mins} ${t("admin.fraud.minutes")}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${t("admin.fraud.timeAgo")} ${hrs} ${t("admin.fraud.hours")}`;
    const days = Math.floor(hrs / 24);
    return `${t("admin.fraud.timeAgo")} ${days} ${t("admin.fraud.days")}`;
  };

  const getRiskColor = (score: number) => {
    if (score >= 90) return "text-red-400";
    if (score >= 70) return "text-orange-400";
    if (score >= 50) return "text-yellow-400";
    return "text-green-400";
  };

  const getRiskBg = (score: number) => {
    if (score >= 90) return "bg-red-500";
    if (score >= 70) return "bg-orange-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            {t("admin.fraud.title")}
          </h1>
          <p className="text-white/50 text-sm mt-1">{t("admin.fraud.subtitle")}</p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchAlerts(); }}
          className="flex items-center gap-2 px-4 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-bold transition-colors border border-white/10"
        >
          <RefreshCw className="w-4 h-4" />
          {t("admin.fraud.refresh")}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={ShieldAlert} color="text-red-400" bg="bg-red-500/10 border-red-500/20"
            label={t("admin.fraud.newAlerts")} value={String(stats.newAlerts)}
          />
          <StatCard
            icon={Eye} color="text-yellow-400" bg="bg-yellow-500/10 border-yellow-500/20"
            label={t("admin.fraud.investigating")} value={String(stats.investigating)}
          />
          <StatCard
            icon={AlertTriangle} color="text-orange-400" bg="bg-orange-500/10 border-orange-500/20"
            label={t("admin.fraud.criticalActive")} value={String(stats.critical)}
          />
          <StatCard
            icon={DollarSign} color="text-pink-400" bg="bg-pink-500/10 border-pink-500/20"
            label={t("admin.fraud.amountAtRisk")} value={stats.totalAmount}
          />
          <StatCard
            icon={Activity} color="text-cyan-400" bg="bg-cyan-500/10 border-cyan-500/20"
            label={t("admin.fraud.avgRiskScore")} value={`${stats.avgRiskScore}/100`}
          />
          <StatCard
            icon={CheckCircle2} color="text-green-400" bg="bg-green-500/10 border-green-500/20"
            label={t("admin.fraud.totalAlerts")} value={String(stats.total)}
          />
        </div>
      )}

      {/* Severity Breakdown Bar */}
      {stats && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <p className="text-xs font-bold text-white/30 mb-3">{t("admin.fraud.severityBreakdown")}</p>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-white/5">
            {stats.bySeverity.critical > 0 && (
              <div className="bg-red-500 rounded-r-sm" style={{ width: `${(stats.bySeverity.critical / stats.total) * 100}%` }} title={`Critical: ${stats.bySeverity.critical}`} />
            )}
            {stats.bySeverity.high > 0 && (
              <div className="bg-orange-500" style={{ width: `${(stats.bySeverity.high / stats.total) * 100}%` }} title={`High: ${stats.bySeverity.high}`} />
            )}
            {stats.bySeverity.medium > 0 && (
              <div className="bg-yellow-500" style={{ width: `${(stats.bySeverity.medium / stats.total) * 100}%` }} title={`Medium: ${stats.bySeverity.medium}`} />
            )}
            {stats.bySeverity.low > 0 && (
              <div className="bg-blue-500 rounded-l-sm" style={{ width: `${(stats.bySeverity.low / stats.total) * 100}%` }} title={`Low: ${stats.bySeverity.low}`} />
            )}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-red-500" /> {t("admin.fraud.critical")} ({stats.bySeverity.critical})</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-orange-500" /> {t("admin.fraud.high")} ({stats.bySeverity.high})</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-yellow-500" /> {t("admin.fraud.medium")} ({stats.bySeverity.medium})</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-blue-500" /> {t("admin.fraud.low")} ({stats.bySeverity.low})</span>
          </div>
        </div>
      )}

      {/* Timeline Chart */}
      {stats && stats.timeline.length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <p className="text-xs font-bold text-white/30 mb-3">{t("admin.fraud.alertsTimeline")}</p>
          <div className="flex items-end gap-2 h-20">
            {stats.timeline.map((d, i) => {
              const maxCount = Math.max(...stats.timeline.map(x => x.count), 1);
              const height = (d.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-white/30">{d.count}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-red-500/40 to-red-500/80 transition-all min-h-[4px]"
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  <span className="text-[9px] text-white/20">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("admin.fraud.searchPlaceholder")}
            className="w-full h-10 rounded-xl bg-white/5 border border-white/10 pr-10 pl-4 text-sm text-white placeholder:text-white/20 focus:border-red-500/50 outline-none transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 h-10 rounded-xl border text-sm font-bold transition-colors ${
            showFilters ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-white/50"
          }`}
        >
          <Filter className="w-4 h-4" />
          {t("admin.fraud.filters")}
        </button>
      </div>

      {/* Filter Dropdowns */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">{t("admin.fraud.filterStatus")}</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white focus:border-red-500/50 outline-none"
                >
                  <option value="all" className="bg-[#1a1a2e] text-white">{t("admin.fraud.all")}</option>
                  <option value="new" className="bg-[#1a1a2e] text-white">{t("admin.fraud.statusNew")}</option>
                  <option value="investigating" className="bg-[#1a1a2e] text-white">{t("admin.fraud.statusInvestigating")}</option>
                  <option value="confirmed" className="bg-[#1a1a2e] text-white">{t("admin.fraud.statusConfirmed")}</option>
                  <option value="resolved" className="bg-[#1a1a2e] text-white">{t("admin.fraud.statusResolved")}</option>
                  <option value="dismissed" className="bg-[#1a1a2e] text-white">{t("admin.fraud.statusDismissed")}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">{t("admin.fraud.filterSeverity")}</label>
                <select
                  value={severityFilter}
                  onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white focus:border-red-500/50 outline-none"
                >
                  <option value="all" className="bg-[#1a1a2e] text-white">{t("admin.fraud.all")}</option>
                  <option value="critical" className="bg-[#1a1a2e] text-white">{t("admin.fraud.critical")}</option>
                  <option value="high" className="bg-[#1a1a2e] text-white">{t("admin.fraud.high")}</option>
                  <option value="medium" className="bg-[#1a1a2e] text-white">{t("admin.fraud.medium")}</option>
                  <option value="low" className="bg-[#1a1a2e] text-white">{t("admin.fraud.low")}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">{t("admin.fraud.filterCategory")}</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white focus:border-red-500/50 outline-none"
                >
                  <option value="all" className="bg-[#1a1a2e] text-white">{t("admin.fraud.all")}</option>
                  <option value="multi_account" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catMultiAccount")}</option>
                  <option value="rapid_transactions" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catRapidTransactions")}</option>
                  <option value="abnormal_gifts" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catAbnormalGifts")}</option>
                  <option value="suspicious_referral" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catSuspiciousReferral")}</option>
                  <option value="fake_engagement" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catFakeEngagement")}</option>
                  <option value="money_laundering" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catMoneyLaundering")}</option>
                  <option value="bot_activity" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catBotActivity")}</option>
                  <option value="chargeback" className="bg-[#1a1a2e] text-white">{t("admin.fraud.catChargeback")}</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
        </div>
      )}

      {/* Alerts List */}
      {!loading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-white/30">
          <ShieldAlert className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-bold">{t("admin.fraud.noAlerts")}</p>
        </div>
      )}

      {!loading && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const sev = severityConfig[alert.severity] || severityConfig.medium;
            const stat = statusConfig[alert.status] || statusConfig.new;
            const CatIcon = categoryIcons[alert.category] || ShieldAlert;
            const catColor = categoryColors[alert.category] || "text-white/40";
            const isExpanded = expandedId === alert.id;
            const isLoading = actionLoading === alert.id;

            return (
              <motion.div
                key={alert.id}
                layout
                className={`bg-white/[0.02] rounded-2xl border transition-colors overflow-hidden ${
                  alert.severity === "critical" && (alert.status === "new" || alert.status === "investigating")
                    ? "border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                    : alert.severity === "high" && alert.status === "new"
                    ? "border-orange-500/20"
                    : "border-white/5"
                }`}
              >
                {/* Card Header — clickable */}
                <div
                  className="p-3 sm:p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Severity + Category Icon */}
                    <div className={`w-10 h-10 rounded-xl ${sev.bg} border ${sev.border} flex items-center justify-center flex-shrink-0`}>
                      <CatIcon className={`w-5 h-5 ${catColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Severity Badge */}
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${sev.bg} ${sev.color} border ${sev.border}`}>
                          {sev.label}
                        </span>
                        {/* Status Badge */}
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${stat.bg} ${stat.color}`}>
                          {stat.label}
                        </span>
                        {/* Risk Score */}
                        <span className={`text-[9px] font-bold ${getRiskColor(alert.riskScore)}`}>
                          {t("admin.fraud.risk")}: {alert.riskScore}%
                        </span>
                        {/* Time */}
                        <span className="text-[9px] text-white/20">{timeAgo(alert.createdAt)}</span>
                      </div>

                      <h3 className="text-sm font-bold text-white leading-tight mb-1">{alert.title}</h3>

                      <div className="flex items-center gap-3 flex-wrap">
                        {alert.userName && (
                          <span className="flex items-center gap-1 text-[10px] text-blue-400">
                            <Users className="w-2.5 h-2.5" />{alert.userName}
                          </span>
                        )}
                        {alert.agentName && (
                          <span className="flex items-center gap-1 text-[10px] text-purple-400">
                            <Link2 className="w-2.5 h-2.5" />{alert.agentName}
                          </span>
                        )}
                        {alert.amount && (
                          <span className="flex items-center gap-1 text-[10px] text-pink-400">
                            <DollarSign className="w-2.5 h-2.5" />{alert.amount}
                          </span>
                        )}
                        {alert.autoAction && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400">
                            <Zap className="w-2.5 h-2.5" />{alert.autoAction}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Risk Score Circle + Expand Chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Risk Circle */}
                      <div className="relative w-10 h-10">
                        <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="14" fill="none"
                            className={getRiskBg(alert.riskScore).replace("bg-", "stroke-")}
                            strokeWidth="3"
                            strokeDasharray={`${alert.riskScore * 0.88} 88`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${getRiskColor(alert.riskScore)}`}>
                          {alert.riskScore}
                        </span>
                      </div>

                      <ChevronDown className={`w-4 h-4 text-white/20 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 sm:px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        {/* Description */}
                        <p className="text-xs text-white/50 leading-relaxed">{alert.description}</p>

                        {/* Evidence */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-red-400/60 mb-2">{t("admin.fraud.evidence")}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {alert.evidence.map((ev, i) => (
                              <div key={i} className="flex justify-between items-center bg-white/[0.02] rounded-lg px-2.5 py-1.5">
                                <span className="text-[10px] text-white/30">{ev.label}</span>
                                <span className="text-[10px] font-bold text-white/80 font-mono" dir="ltr">{ev.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Technical Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {alert.ipAddress && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
                              <Globe className="w-3 h-3 text-white/20 mx-auto mb-0.5" />
                              <p className="text-[9px] text-white/20">{t("admin.fraud.ipAddress")}</p>
                              <p className="text-[10px] font-mono text-white/60" dir="ltr">{alert.ipAddress}</p>
                            </div>
                          )}
                          {alert.deviceFingerprint && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
                              <Fingerprint className="w-3 h-3 text-white/20 mx-auto mb-0.5" />
                              <p className="text-[9px] text-white/20">{t("admin.fraud.fingerprint")}</p>
                              <p className="text-[10px] font-mono text-white/60" dir="ltr">{alert.deviceFingerprint}</p>
                            </div>
                          )}
                          {alert.reviewedBy && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
                              <Eye className="w-3 h-3 text-white/20 mx-auto mb-0.5" />
                              <p className="text-[9px] text-white/20">{t("admin.fraud.reviewedBy")}</p>
                              <p className="text-[10px] font-bold text-white/60">{alert.reviewedBy}</p>
                            </div>
                          )}
                          {alert.relatedAlertIds.length > 0 && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
                              <Link2 className="w-3 h-3 text-white/20 mx-auto mb-0.5" />
                              <p className="text-[9px] text-white/20">{t("admin.fraud.relatedAlerts")}</p>
                              <p className="text-[10px] font-mono text-white/60" dir="ltr">{alert.relatedAlertIds.join(", ")}</p>
                            </div>
                          )}
                        </div>

                        {/* Admin Notes */}
                        {alert.adminNotes && (
                          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-2.5">
                            <p className="text-[10px] text-yellow-400/60 mb-1">{t("admin.fraud.adminNotes")}</p>
                            <p className="text-xs text-white/60">{alert.adminNotes}</p>
                          </div>
                        )}

                        {/* Notes Input */}
                        <textarea
                          value={noteText[alert.id] || ""}
                          onChange={(e) => setNoteText(prev => ({ ...prev, [alert.id]: e.target.value }))}
                          placeholder={t("admin.fraud.addNote")}
                          className="w-full h-16 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-red-500/50 outline-none resize-none transition-colors"
                        />

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          {(alert.status === "new" || alert.status === "investigating") && (
                            <>
                              <button
                                disabled={isLoading}
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(alert.id, "investigating"); }}
                                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-[11px] font-bold border border-yellow-500/20 transition-colors disabled:opacity-50"
                              >
                                <Eye className="w-3 h-3" />{t("admin.fraud.investigate")}
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(alert.id, "confirmed"); }}
                                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[11px] font-bold border border-orange-500/20 transition-colors disabled:opacity-50"
                              >
                                <AlertTriangle className="w-3 h-3" />{t("admin.fraud.confirm")}
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(alert.id, "dismissed"); }}
                                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 text-[11px] font-bold border border-white/10 transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" />{t("admin.fraud.dismiss")}
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(alert.id, "resolved"); }}
                                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[11px] font-bold border border-green-500/20 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3 h-3" />{t("admin.fraud.resolve")}
                              </button>
                            </>
                          )}

                          {/* Quick Actions */}
                          {alert.userId && (alert.status === "new" || alert.status === "investigating" || alert.status === "confirmed") && (
                            <button
                              disabled={isLoading}
                              onClick={(e) => { e.stopPropagation(); handleBanUser(alert.id); }}
                              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-bold border border-red-500/20 transition-colors disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                              {t("admin.fraud.banUser")}
                            </button>
                          )}
                          {alert.agentId && (alert.status === "new" || alert.status === "investigating" || alert.status === "confirmed") && (
                            <button
                              disabled={isLoading}
                              onClick={(e) => { e.stopPropagation(); handleSuspendAgent(alert.id); }}
                              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[11px] font-bold border border-purple-500/20 transition-colors disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
                              {t("admin.fraud.suspendAgent")}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/40">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stat Card Component ──
function StatCard({ icon: Icon, color, bg, label, value }: { icon: any; color: string; bg: string; label: string; value: string }) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`bg-white/[0.02] border rounded-xl p-3 ${bg}`}
    >
      <Icon className={`w-4 h-4 ${color} mb-1.5`} />
      <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
      <p className={`text-lg font-black ${color}`}>{value}</p>
    </motion.div>
  );
}
