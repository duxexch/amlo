import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Coins, Diamond, TrendingUp, DollarSign, CheckCircle,
  Ban, Edit3, ChevronRight, ChevronLeft, X, Loader2, FileText, Save,
} from "lucide-react";
import { adminWallets, adminAdjustments } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { getTypeIcon as sharedGetTypeIcon, getStatusStyle as sharedGetStatusStyle } from "./financeHelpers";
import { useEscapeKey, useFocusTrap } from "../wallet/helpers";
import type { Transaction, BalanceAdjustment } from "./financeTypes";
import { TX_TYPE_OPTIONS, TX_STATUS_OPTIONS } from "./financeTypes";

// ════════════════════════════════════════════════════════════
// LOCAL TYPES & CONSTANTS
// ════════════════════════════════════════════════════════════

interface WalletItem {
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  country: string | null;
  coins: number;
  diamonds: number;
  totalBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalGiftsSent: number;
  totalGiftsReceived: number;
  pendingTxs: number;
  txCount: number;
  isActive: boolean;
  isBanned: boolean;
  lastTransaction: string | null;
  createdAt: string;
}

interface WalletSummary {
  totalWallets: number;
  activeWallets: number;
  totalCoins: number;
  totalDiamonds: number;
  avgBalance: number;
  highestBalance: number;
}

interface WalletDetail {
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  country: string | null;
  coins: number;
  diamonds: number;
  totalBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  isBanned: boolean;
}

const WALLET_SORT_OPTIONS = [
  { value: "balance_desc", labelKey: "admin.finances.sortHighest" },
  { value: "balance_asc", labelKey: "admin.finances.sortLowest" },
  { value: "deposits_desc", labelKey: "admin.finances.sortDeposits" },
  { value: "txcount_desc", labelKey: "admin.finances.sortTxCount" },
  { value: "newest", labelKey: "admin.finances.sortNewest" },
];

const WALLET_STATUS_OPTIONS = [
  { value: "", labelKey: "common.all" },
  { value: "active", labelKey: "admin.finances.statusActive" },
  { value: "inactive", labelKey: "admin.finances.statusInactive" },
];

// ════════════════════════════════════════════════════════════
// WALLETS TAB
// ════════════════════════════════════════════════════════════

export function WalletsTab({ search, showFilters }: { search: string; showFilters: boolean }) {
  const { t } = useTranslation();
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("balance_desc");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adjustUser, setAdjustUser] = useState<{ id: string; username: string } | null>(null);

  // Reset page on search change
  useEffect(() => { setPagination((p) => ({ ...p, page: 1 })); }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminWallets.list({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        status: statusFilter || undefined,
        sortBy,
      });
      if (res.success) {
        setWallets(res.data || []);
        setPagination((p) => ({
          ...p,
          total: res.pagination?.total || 0,
          totalPages: res.pagination?.totalPages || 0,
        }));
        if (res.summary) setSummary(res.summary as WalletSummary);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, search, statusFilter, sortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-2.5">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <SummaryCard icon={<Users className="w-3.5 h-3.5" />} label={t("admin.finances.totalWallets")} value={summary.totalWallets.toLocaleString()} color="text-white" />
          <SummaryCard icon={<CheckCircle className="w-3.5 h-3.5" />} label={t("admin.finances.activeWallets")} value={summary.activeWallets.toLocaleString()} color="text-green-400" />
          <SummaryCard icon={<Coins className="w-3.5 h-3.5" />} label={t("admin.finances.totalCoins")} value={summary.totalCoins.toLocaleString()} color="text-yellow-400" />
          <SummaryCard icon={<Diamond className="w-3.5 h-3.5" />} label={t("admin.finances.totalDiamonds")} value={summary.totalDiamonds.toLocaleString()} color="text-blue-400" />
          <SummaryCard icon={<TrendingUp className="w-3.5 h-3.5" />} label={t("admin.finances.avgBalance")} value={summary.avgBalance.toLocaleString()} color="text-purple-400" />
          <SummaryCard icon={<DollarSign className="w-3.5 h-3.5" />} label={t("admin.finances.highestBalance")} value={summary.highestBalance.toLocaleString()} color="text-orange-400" />
        </div>
      )}

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.walletStatus")}</label>
            <select
              className="bg-white/5 border border-white/10 rounded-lg h-8 px-2.5 text-xs text-white/70 focus:outline-none"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            >
              {WALLET_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.walletSort")}</label>
            <select
              className="bg-white/5 border border-white/10 rounded-lg h-8 px-2.5 text-xs text-white/70 focus:outline-none"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            >
              {WALLET_SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
            </select>
          </div>
          {(statusFilter || sortBy !== "balance_desc") && (
            <div className="flex items-end">
              <button
                onClick={() => { setStatusFilter(""); setSortBy("balance_desc"); setPagination((p) => ({ ...p, page: 1 })); }}
                className="flex items-center gap-1 px-3 h-8 text-xs text-white/40 hover:text-white/60 rounded-lg bg-white/5 border border-white/10 transition-colors"
              >
                <X className="w-3 h-3" /> {t("admin.finances.reset")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Wallets Table */}
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.userCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.coinsCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.diamondsCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.totalBalanceCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs hidden md:table-cell">{t("admin.finances.depositsCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs hidden lg:table-cell">{t("admin.finances.withdrawalsCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs hidden xl:table-cell">{t("admin.finances.operationsCol")}</th>
                <th className="text-center text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.statusLabel")}</th>
                <th className="text-center text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.02] animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className={`py-2 px-3 ${j === 4 ? "hidden md:table-cell" : ""} ${j === 5 ? "hidden lg:table-cell" : ""} ${j === 6 ? "hidden xl:table-cell" : ""}`}>
                        <div className="w-16 h-3 bg-white/5 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : wallets.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-white/20">{t("admin.finances.noWallets")}</td></tr>
              ) : (
                wallets.map((w) => (
                  <tr
                    key={w.userId}
                    className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelectedUserId(w.userId)}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-blue-500/20 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                          {(w.displayName || w.username).charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[120px]">{w.displayName || w.username}</p>
                          <p className="text-[10px] text-white/30">@{w.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs font-bold text-yellow-400">{w.coins.toLocaleString()}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs font-bold text-blue-400">{w.diamonds.toLocaleString()}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs font-black text-white">{w.totalBalance.toLocaleString()}</span>
                    </td>
                    <td className="py-2 px-3 hidden md:table-cell">
                      <span className="text-xs text-green-400/70">{w.totalDeposits > 0 ? `+${w.totalDeposits.toLocaleString()}` : "—"}</span>
                    </td>
                    <td className="py-2 px-3 hidden lg:table-cell">
                      <span className="text-xs text-red-400/70">{w.totalWithdrawals > 0 ? `-${w.totalWithdrawals.toLocaleString()}` : "—"}</span>
                    </td>
                    <td className="py-2 px-3 hidden xl:table-cell">
                      <span className="text-xs text-white/40">{w.txCount}</span>
                      {w.pendingTxs > 0 && (
                        <span className="text-[10px] text-yellow-400 mr-1">({t("admin.finances.pendingTxs", { count: w.pendingTxs })})</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {w.isBanned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
                          <Ban className="w-2.5 h-2.5" /> {t("admin.finances.statusBanned")}
                        </span>
                      ) : w.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-green-400/10 text-green-400 border border-green-400/20">
                          <CheckCircle className="w-2.5 h-2.5" /> {t("admin.finances.statusActive")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/5 text-white/30 border border-white/10">
                          {t("admin.finances.statusIdle")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setAdjustUser({ id: w.userId, username: w.username }); }}
                        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title={t("admin.finances.adjustBalance")}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
            <p className="text-xs text-white/30">{t("admin.finances.pageOf", { page: pagination.page, total: pagination.totalPages })} ({t("admin.finances.walletCount", { count: pagination.total })})</p>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wallet Detail Modal */}
      <AnimatePresence>
        {selectedUserId && (
          <WalletDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {adjustUser && (
          <AdjustBalanceModal
            userId={adjustUser.id}
            username={adjustUser.username}
            onClose={() => setAdjustUser(null)}
            onSuccess={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SUMMARY CARD
// ════════════════════════════════════════════════════════════

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
      <div className={`flex items-center gap-1.5 mb-1 ${color} opacity-60`}>
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className={`text-base font-black ${color}`}>{value}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WALLET DETAIL MODAL
// ════════════════════════════════════════════════════════════

function WalletDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  useEscapeKey(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [walletInfo, setWalletInfo] = useState<WalletDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [typeFilter, setTypeFilter] = useState("");
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([]);

  const fetchData = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await adminWallets.get(userId, {
        page: pagination.page,
        limit: pagination.limit,
        type: typeFilter || undefined,
      });
      if (res.success) {
        setWalletInfo(res.wallet);
        setTransactions(res.transactions || []);
        setPagination((p) => ({
          ...p,
          total: res.pagination?.total || 0,
          totalPages: res.pagination?.totalPages || 0,
        }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setTxLoading(false); }
  }, [userId, pagination.page, pagination.limit, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load adjustment history
  useEffect(() => {
    (async () => {
      try {
        const res = await adminAdjustments.list(userId);
        setAdjustments(Array.isArray(res?.data) ? res.data : []);
      } catch { setAdjustments([]); }
    })();
  }, [userId]);

  const getTypeLabel = (type: string) => { const opt = TX_TYPE_OPTIONS.find((o) => o.value === type); return opt ? t(opt.labelKey) : type; };
  const getStatusLabel = (status: string) => { const opt = TX_STATUS_OPTIONS.find((o) => o.value === status); return opt ? t(opt.labelKey) : status; };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        ref={trapRef}
        className="relative w-full max-w-2xl bg-[#0c0c1d] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : walletInfo ? (
          <>
            {/* Header */}
            <div className="bg-gradient-to-l from-primary/20 to-blue-500/10 p-5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-blue-500/20 border border-white/10 flex items-center justify-center text-lg font-black text-white/80">
                    {(walletInfo.displayName || walletInfo.username).charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{walletInfo.displayName || walletInfo.username}</h3>
                    <p className="text-xs text-white/40">@{walletInfo.username} {walletInfo.country && `• ${walletInfo.country}`}</p>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={onClose}>
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              {/* Balance Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-yellow-400/60 mb-0.5">{t("admin.finances.coins")}</p>
                  <p className="text-lg font-black text-yellow-400">{walletInfo.coins.toLocaleString()}</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-blue-400/60 mb-0.5">{t("admin.finances.diamonds")}</p>
                  <p className="text-lg font-black text-blue-400">{walletInfo.diamonds.toLocaleString()}</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-green-400/60 mb-0.5">{t("admin.finances.totalDeposits")}</p>
                  <p className="text-sm font-bold text-green-400">+{walletInfo.totalDeposits.toLocaleString()}</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-red-400/60 mb-0.5">{t("admin.finances.totalWithdrawals")}</p>
                  <p className="text-sm font-bold text-red-400">-{walletInfo.totalWithdrawals.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Transactions Section */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/60 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> {t("admin.finances.operationsLog")}
                  <span className="text-[10px] text-white/25 font-normal">({pagination.total})</span>
                </h4>
                <select
                  className="bg-white/5 border border-white/10 rounded-lg h-8 px-2 text-xs text-white/60 focus:outline-none"
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                >
                  {TX_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                </select>
              </div>

              {txLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-white/[0.02] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-white/20 text-sm">{t("admin.finances.noOperations")}</div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-3 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                          {sharedGetTypeIcon(tx.type, "sm")}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white/80">{getTypeLabel(tx.type)}</p>
                          <p className="text-[10px] text-white/25">{tx.description || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <p className={`text-sm font-bold ${tx.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                            {tx.amount < 0 ? "-" : "+"}{Math.abs(tx.amount).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-white/20">{new Date(tx.createdAt).toLocaleDateString(i18n.language)}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sharedGetStatusStyle(tx.status)}`}>
                          {getStatusLabel(tx.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-[10px] text-white/20">{t("admin.finances.pageOf", { page: pagination.page, total: pagination.totalPages })}</p>
                  <div className="flex items-center gap-1">
                    <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Adjustment History */}
            {adjustments.length > 0 && (
              <div className="px-4 py-3 border-t border-white/5">
                <h4 className="text-xs font-bold text-white/50 mb-2">{t("admin.finances.adjustmentHistory", "سجل التعديلات")}</h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {adjustments.map((adj) => (
                    <div key={adj.id} className="flex justify-between items-center bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className={adj.amount > 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                        {adj.amount > 0 ? "+" : ""}{adj.amount} {adj.currency}
                      </span>
                      <span className="text-white/30 truncate max-w-[50%]">{adj.description}</span>
                      <span className="text-white/20">{new Date(adj.createdAt).toLocaleDateString(i18n.language)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-white/5 p-4">
              <button
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-bold hover:bg-white/10 transition-colors"
                onClick={onClose}
              >
                {t("common.close")}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-white/20">{t("admin.finances.userNotFound")}</div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════
// ADJUST BALANCE MODAL
// ════════════════════════════════════════════════════════════

function AdjustBalanceModal({ userId, username, onClose, onSuccess }: {
  userId: string; username: string; onClose: () => void; onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [currency, setCurrency] = useState<"coins" | "diamonds">("coins");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const num = parseInt(amount);
    if (!num || num === 0) { setError(t("admin.finances.invalidAmount")); return; }
    if (!reason.trim()) { setError(t("admin.finances.reasonRequired")); return; }
    setLoading(true);
    setError("");
    try {
      await adminWallets.adjust(userId, { amount: num, reason: reason.trim(), currency });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || t("admin.finances.adjustFailed"));
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">{t("admin.finances.adjustBalance")} — @{username}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</p>}

        <div className="space-y-3">
          {/* Currency toggle */}
          <div className="flex gap-2">
            {(["coins", "diamonds"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${
                  currency === c ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50"
                }`}
              >
                {c === "coins" ? "🪙" : "💎"} {t(`admin.finances.${c}`)}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">{t("admin.finances.adjustAmount")}</label>
            <input
              type="number"
              className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
              placeholder={t("admin.finances.adjustAmountHint")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-[10px] text-white/30 mt-1">{t("admin.finances.adjustAmountHelp")}</p>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">{t("admin.finances.adjustReason")}</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none h-20"
              placeholder={t("admin.finances.adjustReasonHint")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("admin.finances.adjustSubmit")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
