import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Filter, ChevronRight, ChevronLeft, Ban, ShieldCheck,
  Eye, UserX, Users, Globe, Coins, Star, ArrowUpCircle,
  CheckCircle2, XCircle, Clock, Trophy, Sparkles, Crown,
  Zap, Gift, Phone, Palette, Shield, ChevronDown, ChevronUp, DollarSign, Loader2,
} from "lucide-react";
import { adminUsers, adminUpgradeRequests, adminWallets } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import {
  getLevelConfig, getTierForLevel, getAllUnlockedFeatures,
  getLevelProgress, formatXp, getXpForNextLevel, TIERS, MAX_LEVEL,
  type LevelConfig, type TierInfo, type LevelFeature,
} from "@shared/levelConfig";

const COUNTRIES = [
  { code: "", labelKey: "admin.users.allCountries" },
  { code: "SA", label: "السعودية" },
  { code: "EG", label: "مصر" },
  { code: "AE", label: "الإمارات" },
  { code: "IQ", label: "العراق" },
  { code: "JO", label: "الأردن" },
  { code: "KW", label: "الكويت" },
  { code: "MA", label: "المغرب" },
  { code: "DZ", label: "الجزائر" },
  { code: "TN", label: "تونس" },
];

const STATUS_OPTIONS = [
  { value: "", labelKey: "admin.users.allStatuses" },
  { value: "online", labelKey: "admin.users.online" },
  { value: "offline", labelKey: "admin.users.offline" },
  { value: "in_stream", labelKey: "admin.users.inStream" },
  { value: "in_call", labelKey: "admin.users.inCall" },
];

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  coins: number;
  diamonds: number;
  level: number;
  xp: number;
  status: string;
  country: string;
  gender: string;
  isVerified: boolean;
  isBanned: boolean;
  banReason?: string;
  createdAt: string;
  lastOnlineAt: string;
}

interface UpgradeRequest {
  id: string;
  userId: string;
  currentLevel: number;
  requestedLevel: number;
  status: string;
  adminNotes?: string;
  reviewedBy?: string;
  createdAt: string;
  reviewedAt?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    level: number;
    xp: number;
    isVerified: boolean;
  };
}

type TabType = "users" | "upgrades";

export function UsersManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    adminUpgradeRequests.pendingCount().then((r: any) => {
      if (r.success) setPendingCount(r.count || 0);
    }).catch(() => { });
  }, [activeTab]);

  return (
    <div className="space-y-5">
      {/* Tab Switcher */}
      <div className="flex gap-2 bg-white/[0.02] border border-white/5 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-bold transition-all ${activeTab === "users"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-white/40 hover:text-white/60"
            }`}
        >
          <Users className="w-4 h-4" />
          {t("admin.users.title")}
        </button>
        <button
          onClick={() => setActiveTab("upgrades")}
          className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-bold transition-all relative ${activeTab === "upgrades"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-white/40 hover:text-white/60"
            }`}
        >
          <ArrowUpCircle className="w-4 h-4" />
          {t("admin.users.upgradeRequests")}
          {pendingCount > 0 && (
            <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "users" ? <UsersTab /> : <UpgradeRequestsTab onCountChange={setPendingCount} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// USERS TAB
// ══════════════════════════════════════════════════════════
function UsersTab() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ status: "", country: "", banned: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.country) params.country = filters.country;
      if (filters.banned) params.banned = filters.banned;
      const res = await adminUsers.list(params);
      if (res.success) {
        setUsers(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, search, filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = () => { setSearch(searchInput); setPagination((p) => ({ ...p, page: 1 })); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const handleBan = async (userId: string) => {
    setActionLoading(userId);
    try {
      await adminUsers.ban(userId);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isBanned: true } : u));
      if (selectedUser?.id === userId) setSelectedUser((u) => u ? { ...u, isBanned: true } : u);
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(userId);
    try {
      await adminUsers.unban(userId);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isBanned: false } : u));
      if (selectedUser?.id === userId) setSelectedUser((u) => u ? { ...u, isBanned: false } : u);
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const handleLevelChange = async (userId: string, newLevel: number) => {
    setActionLoading(userId);
    try {
      const res = await adminUsers.setLevel(userId, newLevel);
      if (res.success) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, level: newLevel } : u));
        if (selectedUser?.id === userId) setSelectedUser((u) => u ? { ...u, level: newLevel } : u);
      }
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const handleAdjustBalance = async (userId: string, payload: { amount: number; currency: "coins" | "diamonds" | "miles"; reason: string }) => {
    setAdjusting(true);
    try {
      await adminWallets.adjust(userId, payload);
      setUsers((prev) => prev.map((u) => {
        if (u.id !== userId) return u;
        if (payload.currency === "coins") return { ...u, coins: Math.max(0, u.coins + payload.amount) };
        if (payload.currency === "diamonds") return { ...u, diamonds: Math.max(0, u.diamonds + payload.amount) };
        return u;
      }));
      setSelectedUser((prev) => {
        if (!prev || prev.id !== userId) return prev;
        if (payload.currency === "coins") return { ...prev, coins: Math.max(0, prev.coins + payload.amount) };
        if (payload.currency === "diamonds") return { ...prev, diamonds: Math.max(0, prev.diamonds + payload.amount) };
        return prev;
      });
    } finally {
      setAdjusting(false);
    }
  };

  const getStatusBadge = (status: string, isBanned: boolean) => {
    if (isBanned) return { className: "bg-red-500/10 text-red-400 border-red-500/20", label: t("admin.users.banned") };
    switch (status) {
      case "online": return { className: "bg-green-400/10 text-green-400 border-green-400/20", label: t("admin.users.online") };
      case "in_stream": return { className: "bg-orange-400/10 text-orange-400 border-orange-400/20", label: t("admin.users.inStream") };
      case "in_call": return { className: "bg-blue-400/10 text-blue-400 border-blue-400/20", label: t("admin.users.inCall") };
      default: return { className: "bg-white/5 text-white/30 border-white/10", label: t("admin.users.offline") };
    }
  };

  const countryLabel = (code: string) => COUNTRIES.find((c) => c.code === code)?.label || code || "—";

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Outfit" }}>
            {t("admin.users.title")}
          </h1>
          <p className="text-white/40 text-sm mt-1">{t("admin.users.userCount", { count: pagination.total })}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl h-10 pr-10 pl-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
            placeholder={t("admin.users.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 h-10 text-sm rounded-xl border transition-colors ${showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"}`}
        >
          <Filter className="w-4 h-4" /> {t("common.filter")}
        </button>
        <button onClick={handleSearch} className="px-6 h-10 text-sm rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors">
          {t("common.search")}
        </button>
      </div>

      {/* Filter Bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <select className="bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white/70 focus:outline-none" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
              </select>
              <select className="bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white/70 focus:outline-none" value={filters.country} onChange={(e) => { setFilters((f) => ({ ...f, country: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.labelKey ? t(c.labelKey) : c.label}</option>)}
              </select>
              <select className="bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white/70 focus:outline-none" value={filters.banned} onChange={(e) => { setFilters((f) => ({ ...f, banned: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}>
                <option value="">{t("admin.users.filterAll")}</option>
                <option value="true">{t("admin.users.filterBanned")}</option>
                <option value="false">{t("admin.users.filterNotBanned")}</option>
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">{t("admin.users.usernameCol")}</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs hidden md:table-cell">{t("admin.users.countryCol")}</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs hidden lg:table-cell">{t("admin.users.balanceCol")}</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">{t("admin.users.levelCol")}</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">{t("admin.users.statusCol")}</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs hidden xl:table-cell">{t("admin.users.joinDateCol")}</th>
                <th className="text-center text-white/40 font-medium py-3 px-4 text-xs">{t("admin.users.actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.02] animate-pulse">
                    <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-white/5" /><div className="space-y-1.5"><div className="w-24 h-3 bg-white/5 rounded" /><div className="w-16 h-2 bg-white/5 rounded" /></div></div></td>
                    <td className="py-3 px-4 hidden md:table-cell"><div className="w-16 h-3 bg-white/5 rounded" /></td>
                    <td className="py-3 px-4 hidden lg:table-cell"><div className="w-20 h-3 bg-white/5 rounded" /></td>
                    <td className="py-3 px-4"><div className="w-8 h-3 bg-white/5 rounded" /></td>
                    <td className="py-3 px-4"><div className="w-14 h-5 bg-white/5 rounded-lg" /></td>
                    <td className="py-3 px-4 hidden xl:table-cell"><div className="w-20 h-3 bg-white/5 rounded" /></td>
                    <td className="py-3 px-4"><div className="w-16 h-6 bg-white/5 rounded mx-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-white/20">{t("admin.users.noUsers")}</td></tr>
              ) : (
                users.map((user) => {
                  const badge = getStatusBadge(user.status, user.isBanned);
                  const tier = getTierForLevel(user.level);
                  return (
                    <tr key={user.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setSelectedUser(user)}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${tier.color}20`, color: tier.color, border: `2px solid ${tier.color}40` }}>
                            {(user.displayName || user.username).charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                              {user.displayName || user.username}
                              {user.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                            </p>
                            <p className="text-[11px] text-white/30 truncate">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-xs text-white/50 flex items-center gap-1"><Globe className="w-3 h-3" /> {countryLabel(user.country)}</span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-yellow-400 flex items-center gap-0.5"><Coins className="w-3 h-3" /> {user.coins.toLocaleString()}</span>
                          <span className="text-cyan-400">💎 {user.diamonds.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: `${tier.color}15`, color: tier.color, border: `1px solid ${tier.color}30` }}>
                          {tier.badge} {user.level}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-lg border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden xl:table-cell">
                        <span className="text-xs text-white/30">{new Date(user.createdAt).toLocaleDateString("ar-EG")}</span>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" onClick={() => setSelectedUser(user)}>
                            <Eye className="w-3.5 h-3.5 text-white/50" />
                          </button>
                          {user.isBanned ? (
                            <button className="w-7 h-7 rounded-lg bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center transition-colors" onClick={() => handleUnban(user.id)} disabled={actionLoading === user.id}>
                              <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                            </button>
                          ) : (
                            <button className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors" onClick={() => handleBan(user.id)} disabled={actionLoading === user.id}>
                              <Ban className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/5">
            <p className="text-xs text-white/30">
              {t("admin.finances.pageOf", { page: pagination.page, total: pagination.totalPages })} ({pagination.total} {t("admin.users.usernameCol")})
            </p>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
                <ChevronRight className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
                const page = start + i;
                return (
                  <button key={page} className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${page === pagination.page ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10 text-white/50"}`} onClick={() => setPagination((p) => ({ ...p, page }))}>
                    {page}
                  </button>
                );
              })}
              <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onBan={handleBan}
            onUnban={handleUnban}
            onLevelChange={handleLevelChange}
            onAdjustBalance={handleAdjustBalance}
            actionLoading={actionLoading}
            adjusting={adjusting}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// USER DETAIL MODAL — with Level System
// ══════════════════════════════════════════════════════════
function UserDetailModal({
  user,
  onClose,
  onBan,
  onUnban,
  onLevelChange,
  onAdjustBalance,
  actionLoading,
  adjusting,
}: {
  user: User;
  onClose: () => void;
  onBan: (id: string) => Promise<void>;
  onUnban: (id: string) => Promise<void>;
  onLevelChange: (id: string, level: number) => Promise<void>;
  onAdjustBalance: (id: string, payload: { amount: number; currency: "coins" | "diamonds" | "miles"; reason: string }) => Promise<void>;
  actionLoading: string | null;
  adjusting: boolean;
}) {
  const { t } = useTranslation();
  const [modalTab, setModalTab] = useState<"info" | "level" | "requests">("info");
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  const tier = getTierForLevel(user.level);
  const levelConfig = getLevelConfig(user.level);
  const progress = getLevelProgress(user.level, user.xp || 0);
  const unlockedFeatures = getAllUnlockedFeatures(user.level);
  const nextLevelXp = getXpForNextLevel(user.level);

  const countryLabel = (code: string) => COUNTRIES.find((c) => c.code === code)?.label || code || "—";

  useEffect(() => {
    if (modalTab === "requests") {
      setLoadingRequests(true);
      adminUsers.getUpgradeRequests(user.id).then((r: any) => {
        if (r.success) setUpgradeRequests(r.data || []);
      }).catch(() => { }).finally(() => setLoadingRequests(false));
    }
  }, [modalTab, user.id]);

  const handleReview = async (reqId: string, status: "approved" | "rejected") => {
    setReviewLoading(reqId);
    try {
      const res = await adminUpgradeRequests.review(reqId, status);
      if (res.success) {
        setUpgradeRequests((prev) => prev.map((r) => r.id === reqId ? { ...r, status } : r));
        if (status === "approved") {
          const req = upgradeRequests.find((r) => r.id === reqId);
          if (req) onLevelChange(user.id, req.requestedLevel);
        }
      }
    } catch (e) { console.error(e); }
    finally { setReviewLoading(null); }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-2xl bg-[#0c0c1d] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        {/* Header with Level Frame */}
        <div className="relative p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: tier.gradient }} />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black"
                style={{
                  background: `${tier.color}20`,
                  color: tier.color,
                  border: `3px solid ${tier.color}`,
                  boxShadow: `0 0 20px ${tier.color}40`,
                }}
              >
                {(user.displayName || user.username).charAt(0)}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                style={{ background: tier.color, color: "#fff", boxShadow: `0 2px 8px ${tier.color}60` }}
              >
                {user.level}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-white flex items-center gap-2 truncate">
                {user.displayName || user.username}
                {user.isVerified && <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />}
              </h3>
              <p className="text-sm text-white/40">@{user.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: `${tier.color}20`, color: tier.color, border: `1px solid ${tier.color}40` }}>
                  {tier.badge} {tier.nameAr} — {t("admin.users.levelCol")} {user.level}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-white/5 px-6">
          {(["info", "level", "requests"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setModalTab(tab)}
              className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${modalTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-white/30 hover:text-white/50"
                }`}
            >
              {tab === "info" && t("admin.users.userInfo")}
              {tab === "level" && t("admin.users.levelDetails")}
              {tab === "requests" && t("admin.users.upgradeHistory")}
            </button>
          ))}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ── INFO TAB ── */}
          {modalTab === "info" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label={t("admin.users.levelCol")} value={`${tier.badge} ${user.level} — ${tier.nameAr}`} highlight={tier.color} />
                <InfoItem label={t("admin.users.countryCol")} value={countryLabel(user.country)} />
                <InfoItem label={t("common.coins")} value={user.coins.toLocaleString()} highlight="#facc15" />
                <InfoItem label={t("admin.users.diamonds")} value={user.diamonds.toLocaleString()} highlight="#22d3ee" />
                <InfoItem label={t("admin.users.gender")} value={user.gender === "male" ? t("admin.users.male") : user.gender === "female" ? t("admin.users.female") : "—"} />
                <InfoItem label={t("admin.users.memberSince")} value={new Date(user.createdAt).toLocaleDateString("ar-EG")} />
              </div>

              {user.isBanned && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1"><Ban className="w-3 h-3" /> {t("admin.users.banned")}</p>
                  <p className="text-xs text-red-300/70">{user.banReason || t("admin.users.noBanReason")}</p>
                </div>
              )}

              {/* XP Progress Bar */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40">{t("admin.users.xpProgress")}</span>
                  <span className="text-xs font-bold" style={{ color: tier.color }}>
                    {formatXp(user.xp || 0)} / {user.level >= MAX_LEVEL ? "MAX" : formatXp(nextLevelXp)} XP
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: tier.gradient }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                {user.level < MAX_LEVEL && (
                  <p className="text-[10px] text-white/20 mt-1">
                    {t("admin.users.xpToNext", { xp: formatXp(nextLevelXp - (user.xp || 0)) })}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── LEVEL TAB ── */}
          {modalTab === "level" && (
            <>
              {/* Current Tier Visual */}
              <div className="text-center p-6 rounded-xl border border-white/5" style={{ background: `${tier.color}08` }}>
                <div className="text-5xl mb-2">{tier.badge}</div>
                <h4 className="text-lg font-black text-white">{tier.nameAr}</h4>
                <p className="text-sm text-white/40">{tier.name} — {t("admin.users.levelCol")} {user.level}</p>
              </div>

              {/* Current Perks */}
              <div className="space-y-3">
                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: tier.color }} />
                  {t("admin.users.currentPerks")}
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  <PerkItem icon="🏷️" label={t("admin.users.perkDiscount")} value={`${levelConfig.perks.discount}%`} />
                  <PerkItem icon="🪙" label={t("admin.users.perkDailyCoins")} value={`${levelConfig.perks.dailyCoins}`} />
                  <PerkItem icon="🎁" label={t("admin.users.perkGiftMultiplier")} value={`${levelConfig.perks.giftMultiplier}x`} />
                  <PerkItem icon="👥" label={t("admin.users.perkMaxFriends")} value={`${levelConfig.perks.maxFriends}`} />
                  <PerkItem icon="📞" label={t("admin.users.perkCallBonus")} value={`+${levelConfig.perks.callBonusMinutes} ${t("admin.users.minutes")}`} />
                </div>
              </div>

              {/* Unlocked Features */}
              {unlockedFeatures.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4" style={{ color: tier.color }} />
                    {t("admin.users.unlockedFeatures")} ({unlockedFeatures.length})
                  </h5>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    {unlockedFeatures.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.02] rounded-lg px-2 py-1.5">
                        <span>{f.icon}</span>
                        <span className="text-white/60 truncate">{f.nameAr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Level Changer */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  {t("admin.users.changeLevel")}
                </h5>
                <button
                  onClick={() => setShowLevelPicker(!showLevelPicker)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl hover:bg-white/[0.05] transition-colors"
                >
                  <span className="text-sm text-white/70">{t("admin.users.selectNewLevel")}</span>
                  {showLevelPicker ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </button>

                <AnimatePresence>
                  {showLevelPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto space-y-1 p-2 bg-white/[0.02] border border-white/5 rounded-xl">
                        {TIERS.map((tierItem) => (
                          <div key={tierItem.id}>
                            <p className="text-[10px] font-bold px-2 py-1 sticky top-0" style={{ color: tierItem.color, background: "#0c0c1d" }}>
                              {tierItem.badge} {tierItem.nameAr} ({tierItem.name})
                            </p>
                            <div className="grid grid-cols-5 gap-1 px-1">
                              {Array.from({ length: 5 }, (_, i) => {
                                const lvl = tierItem.id * 5 + i + 1;
                                const isActive = lvl === user.level;
                                return (
                                  <button
                                    key={lvl}
                                    disabled={isActive || actionLoading === user.id}
                                    onClick={() => onLevelChange(user.id, lvl)}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${isActive
                                        ? "ring-2 ring-primary text-white"
                                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                                      }`}
                                    style={isActive ? { background: tierItem.color, color: "#fff" } : {}}
                                  >
                                    {lvl}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* ── REQUESTS TAB ── */}
          {modalTab === "requests" && (
            <div className="space-y-3">
              {loadingRequests ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : upgradeRequests.length === 0 ? (
                <div className="text-center py-8 text-white/20 text-sm">{t("admin.users.noUpgradeRequests")}</div>
              ) : (
                upgradeRequests.map((req) => {
                  const fromTier = getTierForLevel(req.currentLevel);
                  const toTier = getTierForLevel(req.requestedLevel);
                  return (
                    <div key={req.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${fromTier.color}20`, color: fromTier.color }}>
                              {fromTier.badge} {req.currentLevel}
                            </span>
                            <span className="text-white/20">→</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${toTier.color}20`, color: toTier.color }}>
                              {toTier.badge} {req.requestedLevel}
                            </span>
                          </div>
                        </div>
                        <UpgradeStatusBadge status={req.status} />
                      </div>
                      <p className="text-[10px] text-white/20">{new Date(req.createdAt).toLocaleString("ar-EG")}</p>
                      {req.adminNotes && (
                        <p className="text-xs text-white/40 bg-white/[0.02] rounded-lg p-2">{req.adminNotes}</p>
                      )}
                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            disabled={reviewLoading === req.id}
                            onClick={() => handleReview(req.id, "approved")}
                            className="flex-1 h-8 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t("admin.users.approve")}
                          </button>
                          <button
                            disabled={reviewLoading === req.id}
                            onClick={() => handleReview(req.id, "rejected")}
                            className="flex-1 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> {t("admin.users.reject")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 flex gap-2">
          <button
            className="px-4 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-bold hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
            onClick={() => setShowAdjustModal(true)}
            disabled={adjusting}
          >
            {adjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />} {t("admin.finances.adjustBalance", "تحويل رصيد")}
          </button>
          {user.isBanned ? (
            <button
              className="flex-1 h-10 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2"
              onClick={() => { onUnban(user.id); onClose(); }}
            >
              <ShieldCheck className="w-4 h-4" /> {t("admin.users.unban")}
            </button>
          ) : (
            <button
              className="flex-1 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
              onClick={() => { onBan(user.id); onClose(); }}
            >
              <UserX className="w-4 h-4" /> {t("admin.users.ban")}
            </button>
          )}
          <button
            className="px-6 h-10 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-colors"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        <AnimatePresence>
          {showAdjustModal && (
            <UserAdjustBalanceModal
              username={user.username}
              userId={user.id}
              onClose={() => setShowAdjustModal(false)}
              onSubmit={async (payload) => {
                await onAdjustBalance(user.id, payload);
                setShowAdjustModal(false);
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function UserAdjustBalanceModal({
  userId,
  username,
  onClose,
  onSubmit,
}: {
  userId: string;
  username: string;
  onClose: () => void;
  onSubmit: (payload: { amount: number; currency: "coins" | "diamonds" | "miles"; reason: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [currency, setCurrency] = useState<"coins" | "diamonds" | "miles">("coins");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed === 0) {
      setError(t("admin.finances.invalidAmount", "قيمة غير صالحة"));
      return;
    }
    if (!reason.trim()) {
      setError(t("admin.finances.reasonRequired", "سبب العملية مطلوب"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({ amount: Math.trunc(parsed), currency, reason: reason.trim() });
    } catch (err: any) {
      setError(err?.message || t("admin.finances.adjustFailed", "فشل تعديل الرصيد"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#101025] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">{t("admin.finances.adjustBalance", "تحويل رصيد")} — @{username}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><XCircle className="w-4 h-4" /></button>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}

        <div className="flex gap-2">
          {(["coins", "diamonds", "miles"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${currency === c ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50"}`}
            >
              {c === "coins" ? "🪙" : c === "diamonds" ? "💎" : "🧭"} {t(`admin.finances.${c}`, c)}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1 block">{t("admin.finances.adjustAmount", "القيمة")}</label>
          <input
            type="number"
            className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
            placeholder="+100 أو -50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1 block">{t("admin.finances.adjustReason", "السبب")}</label>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none h-20"
            placeholder={t("admin.finances.adjustReasonHint", "اكتب سبب التحويل")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
          {t("admin.finances.adjustSubmit", "تنفيذ")}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════
// UPGRADE REQUESTS TAB
// ══════════════════════════════════════════════════════════
function UpgradeRequestsTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminUpgradeRequests.list({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
      });
      if (res.success) {
        setRequests(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleReview = async (reqId: string, status: "approved" | "rejected") => {
    setReviewLoading(reqId);
    try {
      const res = await adminUpgradeRequests.review(reqId, status);
      if (res.success) {
        setRequests((prev) => prev.map((r) => r.id === reqId ? { ...r, status } : r));
        const countRes = await adminUpgradeRequests.pendingCount();
        if (countRes.success) onCountChange((countRes as any).count || 0);
      }
    } catch (e) { console.error(e); }
    finally { setReviewLoading(null); }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Outfit" }}>
            {t("admin.users.upgradeRequests")}
          </h1>
          <p className="text-white/40 text-sm mt-1">{t("admin.users.upgradeRequestsDesc")}</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {["pending", "approved", "rejected", ""].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPagination((p) => ({ ...p, page: 1 })); }}
            className={`px-4 h-9 text-xs font-bold rounded-lg border transition-colors ${statusFilter === s
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
              }`}
          >
            {s === "pending" ? t("admin.users.statusPending") :
              s === "approved" ? t("admin.users.statusApproved") :
                s === "rejected" ? t("admin.users.statusRejected") :
                  t("admin.users.filterAll")}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-32 h-3 bg-white/5 rounded" />
                  <div className="w-20 h-2 bg-white/5 rounded" />
                </div>
                <div className="w-16 h-6 bg-white/5 rounded-lg" />
              </div>
            </div>
          ))
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-white/20">
            <ArrowUpCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t("admin.users.noUpgradeRequests")}</p>
          </div>
        ) : (
          requests.map((req) => {
            const fromTier = getTierForLevel(req.currentLevel);
            const toTier = getTierForLevel(req.requestedLevel);
            return (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0c0c1d] border border-white/5 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: `${toTier.color}20`, color: toTier.color, border: `2px solid ${toTier.color}40` }}
                    >
                      {(req.user?.displayName || req.user?.username || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        {req.user?.displayName || req.user?.username || req.userId}
                        {req.user?.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                      </p>
                      <p className="text-[11px] text-white/30">@{req.user?.username || "—"}</p>
                    </div>
                  </div>
                  <UpgradeStatusBadge status={req.status} />
                </div>

                {/* Level Change Visual */}
                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-lg" style={{ background: `${fromTier.color}15`, border: `2px solid ${fromTier.color}30` }}>
                      {fromTier.badge}
                    </div>
                    <p className="text-xs font-bold mt-1" style={{ color: fromTier.color }}>{t("admin.users.levelCol")} {req.currentLevel}</p>
                    <p className="text-[10px] text-white/30">{fromTier.nameAr}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ArrowUpCircle className="w-5 h-5 text-primary animate-bounce" />
                    <span className="text-[10px] text-primary font-bold">{t("admin.users.upgrade")}</span>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-lg" style={{ background: `${toTier.color}15`, border: `2px solid ${toTier.color}30` }}>
                      {toTier.badge}
                    </div>
                    <p className="text-xs font-bold mt-1" style={{ color: toTier.color }}>{t("admin.users.levelCol")} {req.requestedLevel}</p>
                    <p className="text-[10px] text-white/30">{toTier.nameAr}</p>
                  </div>
                </div>

                <p className="text-[10px] text-white/20 text-center">{new Date(req.createdAt).toLocaleString("ar-EG")}</p>

                {req.adminNotes && (
                  <p className="text-xs text-white/40 bg-white/[0.02] rounded-lg p-2">{req.adminNotes}</p>
                )}

                {req.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={reviewLoading === req.id}
                      onClick={() => handleReview(req.id, "approved")}
                      className="flex-1 h-9 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {reviewLoading === req.id ? (
                        <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><CheckCircle2 className="w-4 h-4" /> {t("admin.users.approve")}</>
                      )}
                    </button>
                    <button
                      disabled={reviewLoading === req.id}
                      onClick={() => handleReview(req.id, "rejected")}
                      className="flex-1 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {reviewLoading === req.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><XCircle className="w-4 h-4" /> {t("admin.users.reject")}</>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-[#0c0c1d] border border-white/5 rounded-xl">
          <p className="text-xs text-white/30">
            {t("admin.finances.pageOf", { page: pagination.page, total: pagination.totalPages })}
          </p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
              <ChevronRight className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
              const page = start + i;
              return (
                <button key={page} className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${page === pagination.page ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10 text-white/50"}`} onClick={() => setPagination((p) => ({ ...p, page }))}>
                  {page}
                </button>
              );
            })}
            <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════

function InfoItem({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
      <p className="text-[10px] text-white/30 mb-1">{label}</p>
      <p className="text-sm font-bold" style={{ color: highlight || "#fff" }}>{value}</p>
    </div>
  );
}

function PerkItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
      <span className="text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/30 truncate">{label}</p>
        <p className="text-xs font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function UpgradeStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config = {
    pending: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", icon: Clock, label: t("admin.users.statusPending") },
    approved: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", icon: CheckCircle2, label: t("admin.users.statusApproved") },
    rejected: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", icon: XCircle, label: t("admin.users.statusRejected") },
  }[status] || { bg: "bg-white/5", text: "text-white/40", border: "border-white/10", icon: Clock, label: status };

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${config.bg} ${config.text} ${config.border}`}>
      <Icon className="w-3 h-3" /> {config.label}
    </span>
  );
}
