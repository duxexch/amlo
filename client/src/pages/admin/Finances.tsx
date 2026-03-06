import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft, ArrowUpRight, Filter, ChevronRight, ChevronLeft,
  DollarSign, CreditCard, Gift, RefreshCw, Wallet, Plus, Edit3,
  Trash2, X, ToggleLeft, ToggleRight, Globe, Info, AlertCircle,
  CheckCircle, XCircle, Eye, Clock, Ban, MessageSquare, Loader2,
  MoreHorizontal, FileText, Save, Search, TrendingUp, TrendingDown,
  Users, ArrowUpDown, Coins, Diamond, ChevronDown, Phone,
  Download, CalendarDays, AlertTriangle,
} from "lucide-react";
import { adminTransactions, adminPaymentMethods, adminWallets, adminPricing, adminFinanceStats, adminWithdrawals, adminExports, adminAdjustments } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

interface Transaction {
  id: string;
  userId: string;
  username: string;
  userName?: string;
  type: string;
  amount: number;
  balanceAfter: number;
  currency: string;
  description: string;
  paymentMethod: string;
  status: string;
  adminNotes: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  type: string;
  provider: string;
  countries: string[];
  minAmount: number;
  maxAmount: number;
  fee: string;
  isActive: boolean;
  sortOrder: number;
  instructions: string;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════

const TX_TYPE_OPTIONS = [
  { value: "", labelKey: "admin.finances.allTypes" },
  { value: "purchase", labelKey: "admin.finances.txTypePurchase" },
  { value: "gift_sent", labelKey: "admin.finances.txTypeGiftSent" },
  { value: "gift_received", labelKey: "admin.finances.txTypeGiftReceived" },
  { value: "withdrawal", labelKey: "admin.finances.txTypeWithdrawal" },
  { value: "refund", labelKey: "admin.finances.txTypeRefund" },
];

const TX_STATUS_OPTIONS = [
  { value: "", labelKey: "admin.finances.allStatuses" },
  { value: "completed", labelKey: "admin.finances.txStatusCompleted" },
  { value: "pending", labelKey: "admin.finances.txStatusPending" },
  { value: "rejected", labelKey: "admin.finances.txStatusRejected" },
  { value: "failed", labelKey: "admin.finances.txStatusFailed" },
  { value: "refunded", labelKey: "admin.finances.txStatusRefunded" },
];

const PM_TYPE_OPTIONS = [
  { value: "card", labelKey: "admin.finances.pmTypeCard" },
  { value: "e_wallet", labelKey: "admin.finances.pmTypeEWallet" },
  { value: "crypto", labelKey: "admin.finances.pmTypeCrypto" },
  { value: "telecom", labelKey: "admin.finances.pmTypeTelecom" },
  { value: "bank_transfer", labelKey: "admin.finances.pmTypeBankTransfer" },
];

const PM_ICONS = ["💳", "🍎", "📱", "📲", "📞", "🏦", "🪙", "💰", "🅿️", "⚡", "🔗", "💎"];

const COUNTRY_OPTIONS = [
  { code: "SA", labelKey: "admin.finances.countrySA" },
  { code: "EG", labelKey: "admin.finances.countryEG" },
  { code: "AE", labelKey: "admin.finances.countryAE" },
  { code: "IQ", labelKey: "admin.finances.countryIQ" },
  { code: "JO", labelKey: "admin.finances.countryJO" },
  { code: "KW", labelKey: "admin.finances.countryKW" },
  { code: "MA", labelKey: "admin.finances.countryMA" },
  { code: "DZ", labelKey: "admin.finances.countryDZ" },
  { code: "TN", labelKey: "admin.finances.countryTN" },
];

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

type FinanceTab = "transactions" | "wallets" | "payment-methods" | "currencies" | "withdrawals";

const SEARCH_PLACEHOLDERS: Record<FinanceTab, string> = {
  transactions: "admin.finances.searchTransactions",
  wallets: "admin.finances.searchWallets",
  "payment-methods": "admin.finances.searchPaymentMethods",
  currencies: "admin.finances.searchPaymentMethods",
  withdrawals: "admin.finances.searchTransactions",
};

export function FinancesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<FinanceTab>("transactions");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset search when switching tabs
  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setShowFilters(false);
  }, [activeTab]);

  const tabs: { key: FinanceTab; labelKey: string; icon: React.ElementType }[] = [
    { key: "transactions", labelKey: "admin.finances.tabTransactions", icon: Wallet },
    { key: "withdrawals", labelKey: "admin.finances.tabWithdrawals", icon: ArrowUpRight },
    { key: "wallets", labelKey: "admin.finances.tabWallets", icon: DollarSign },
    { key: "payment-methods", labelKey: "admin.finances.tabPaymentMethods", icon: CreditCard },
    { key: "currencies", labelKey: "admin.finances.tabCurrencies", icon: Coins },
  ];

  return (
    <div className="space-y-2.5">
      {/* Financial Dashboard */}
      <FinancialDashboard />

      {/* Header with Search & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl font-black text-white" style={{ fontFamily: "Outfit" }}>
          {t("admin.finances.title")}
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
          {activeTab !== "payment-methods" && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 h-9 text-sm rounded-xl border transition-colors flex-shrink-0 ${
                showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              }`}
            >
              <Filter className="w-4 h-4" /> {t("admin.finances.filterLabel")}
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex gap-1 p-0.5 bg-white/[0.02] border border-white/5 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab.key
                ? "text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {activeTab === tab.key && (
              <motion.div
                layoutId="financeTabBg"
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
        {activeTab === "transactions" ? (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <TransactionsTab search={search} showFilters={showFilters} />
          </motion.div>
        ) : activeTab === "wallets" ? (
          <motion.div
            key="wallets"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <WalletsTab search={search} showFilters={showFilters} />
          </motion.div>
        ) : activeTab === "withdrawals" ? (
          <motion.div
            key="withdrawals"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <WithdrawalsTab search={search} showFilters={showFilters} />
          </motion.div>
        ) : activeTab === "currencies" ? (
          <motion.div
            key="currencies"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <CurrenciesTab />
          </motion.div>
        ) : (
          <motion.div
            key="payment-methods"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <PaymentMethodsTab search={search} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TRANSACTIONS TAB
// ════════════════════════════════════════════════════════════

function TransactionsTab({ search, showFilters }: { search: string; showFilters: boolean }) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ type: "", status: "" });
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reset page on search change
  useEffect(() => { setPagination((p) => ({ ...p, page: 1 })); }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      const res = await adminTransactions.list(params);
      if (res.success) {
        setTransactions(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, filters, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (txId: string, data: { status?: string; adminNotes?: string; rejectionReason?: string; amount?: number; description?: string }) => {
    setActionLoading(txId);
    try {
      const res = await adminTransactions.update(txId, data);
      if (res.success && res.data) {
        const updated = res.data as Transaction;
        setTransactions((prev) => prev.map((t) => t.id === txId ? { ...t, ...updated } : t));
        if (selectedTx?.id === txId) setSelectedTx({ ...selectedTx, ...updated });
      }
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "purchase": return <CreditCard className="w-4 h-4 text-green-400" />;
      case "gift_sent": return <ArrowUpRight className="w-4 h-4 text-red-400" />;
      case "gift_received": return <ArrowDownLeft className="w-4 h-4 text-blue-400" />;
      case "withdrawal": return <DollarSign className="w-4 h-4 text-orange-400" />;
      case "refund": return <RefreshCw className="w-4 h-4 text-purple-400" />;
      default: return <Gift className="w-4 h-4 text-white/40" />;
    }
  };

  const getTypeLabel = (type: string) => { const opt = TX_TYPE_OPTIONS.find((o) => o.value === type); return opt ? t(opt.labelKey) : type; };
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-400/10 text-green-400 border-green-400/20";
      case "pending": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
      case "failed": return "bg-red-400/10 text-red-400 border-red-400/20";
      case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "refunded": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  };
  const getStatusLabel = (status: string) => { const opt = TX_STATUS_OPTIONS.find((o) => o.value === status); return opt ? t(opt.labelKey) : status; };
  const txName = (tx: Transaction) => tx.userName || tx.username || "—";

  // count pending
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-2.5">
      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm text-white/50">{t("admin.finances.transactionCount", { count: pagination.total })}</p>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
            <Clock className="w-3 h-3" />
            {t("admin.finances.pendingReview", { count: pendingCount })}
          </span>
        )}
        <button
          onClick={() => { setFilters({ type: "", status: "pending" }); setPagination((p) => ({ ...p, page: 1 })); }}
          className="flex items-center gap-1.5 px-3 h-8 text-xs font-bold rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
        >
          <Clock className="w-3 h-3" /> {t("admin.finances.pendingOnly")}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.typeLabel")}</label>
            <select className="bg-white/5 border border-white/10 rounded-lg h-8 px-2.5 text-xs text-white/70 focus:outline-none" value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}>
              {TX_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.statusLabel")}</label>
            <select className="bg-white/5 border border-white/10 rounded-lg h-8 px-2.5 text-xs text-white/70 focus:outline-none" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}>
              {TX_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
            </select>
          </div>
          {(filters.type || filters.status) && (
            <div className="flex items-end">
              <button
                onClick={() => { setFilters({ type: "", status: "" }); setPagination((p) => ({ ...p, page: 1 })); }}
                className="flex items-center gap-1 px-3 h-9 text-xs text-white/40 hover:text-white/60 rounded-lg bg-white/5 border border-white/10 transition-colors"
              >
                <X className="w-3 h-3" /> {t("admin.finances.clearFilters")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.typeLabel")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.userCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.amountCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs hidden md:table-cell">{t("admin.finances.descCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs hidden lg:table-cell">{t("admin.finances.paymentMethodCol")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.statusLabel")}</th>
                <th className="text-right text-white/40 font-medium py-2 px-3 text-xs hidden xl:table-cell">{t("admin.finances.dateCol")}</th>
                <th className="text-center text-white/40 font-medium py-2 px-3 text-xs">{t("admin.finances.actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.02] animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className={`py-2 px-3 ${j === 3 ? "hidden md:table-cell" : ""} ${j === 4 ? "hidden lg:table-cell" : ""} ${j === 6 ? "hidden xl:table-cell" : ""}`}>
                        <div className="w-16 h-3 bg-white/5 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-white/20">{t("admin.finances.noTransactions")}</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer ${tx.status === "pending" ? "bg-yellow-400/[0.02]" : ""}`}
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(tx.type)}
                        <span className="text-xs text-white/60">{getTypeLabel(tx.type)}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs font-bold text-white">@{txName(tx)}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-sm font-bold ${tx.type === "gift_sent" || tx.type === "withdrawal" ? "text-red-400" : "text-green-400"}`}>
                        {tx.type === "gift_sent" || tx.type === "withdrawal" ? "-" : "+"}{Math.abs(tx.amount).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-white/25 mr-1">{tx.currency === "coins" ? t("admin.finances.currency_coins") : t("admin.finances.currency_diamonds")}</span>
                    </td>
                    <td className="py-2 px-3 hidden md:table-cell">
                      <span className="text-xs text-white/40 truncate block max-w-[200px]">{tx.description || "—"}</span>
                    </td>
                    <td className="py-2 px-3 hidden lg:table-cell">
                      <span className="text-xs text-white/40">{tx.paymentMethod || "—"}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getStatusStyle(tx.status)}`}>
                        {tx.status === "pending" && <Clock className="w-2.5 h-2.5" />}
                        {tx.status === "completed" && <CheckCircle className="w-2.5 h-2.5" />}
                        {tx.status === "rejected" && <XCircle className="w-2.5 h-2.5" />}
                        {getStatusLabel(tx.status)}
                      </span>
                    </td>
                    <td className="py-2 px-3 hidden xl:table-cell">
                      <span className="text-xs text-white/30">{new Date(tx.createdAt).toLocaleString("ar-EG")}</span>
                    </td>
                    <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="w-6 h-6 rounded-md bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => handleAction(tx.id, { status: "completed" })}
                          disabled={actionLoading === tx.id || tx.status !== "pending"}
                          title={t("admin.finances.approve")}
                        >
                          {actionLoading === tx.id ? <Loader2 className="w-3 h-3 text-green-400 animate-spin" /> : <CheckCircle className="w-3 h-3 text-green-400" />}
                        </button>
                        <button
                          className="w-6 h-6 rounded-md bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => setSelectedTx(tx)}
                          disabled={tx.status !== "pending"}
                          title={t("admin.finances.reject")}
                        >
                          <XCircle className="w-3 h-3 text-red-400" />
                        </button>
                        <button
                          className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                          onClick={() => setSelectedTx(tx)}
                          title={t("admin.finances.viewDetails")}
                        >
                          <Eye className="w-3 h-3 text-white/50" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
            <p className="text-xs text-white/30">{t("admin.finances.pageOf", { page: pagination.page, total: pagination.totalPages })}</p>
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

      {/* Transaction Detail / Action Modal */}
      <AnimatePresence>
        {selectedTx && (
          <TransactionModal
            tx={selectedTx}
            onClose={() => setSelectedTx(null)}
            onAction={handleAction}
            actionLoading={actionLoading}
            getTypeIcon={getTypeIcon}
            getTypeLabel={getTypeLabel}
            getStatusStyle={getStatusStyle}
            getStatusLabel={getStatusLabel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TRANSACTION MODAL
// ════════════════════════════════════════════════════════════

function TransactionModal({
  tx,
  onClose,
  onAction,
  actionLoading,
  getTypeIcon,
  getTypeLabel,
  getStatusStyle,
  getStatusLabel,
}: {
  tx: Transaction;
  onClose: () => void;
  onAction: (txId: string, data: any) => Promise<void>;
  actionLoading: string | null;
  getTypeIcon: (type: string) => React.ReactNode;
  getTypeLabel: (type: string) => string;
  getStatusStyle: (status: string) => string;
  getStatusLabel: (status: string) => string;
}) {
  const { t } = useTranslation();
  const [rejectReason, setRejectReason] = useState("");
  const [adminNotes, setAdminNotes] = useState(tx.adminNotes || "");
  const [editAmount, setEditAmount] = useState(String(tx.amount));
  const [editDesc, setEditDesc] = useState(tx.description || "");
  const [showReject, setShowReject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const txName = tx.userName || tx.username || "—";

  const handleApprove = async () => {
    await onAction(tx.id, { status: "completed", adminNotes: adminNotes || undefined });
  };

  const handleReject = async () => {
    await onAction(tx.id, {
      status: "rejected",
      rejectionReason: rejectReason || undefined,
      adminNotes: adminNotes || undefined,
    });
    setShowReject(false);
  };

  const handleRefund = async () => {
    await onAction(tx.id, { status: "refunded", adminNotes: adminNotes || undefined });
  };

  const handleSaveEdit = async () => {
    setLocalSaving(true);
    await onAction(tx.id, {
      amount: parseInt(editAmount) || tx.amount,
      description: editDesc,
      adminNotes: adminNotes || undefined,
    });
    setLocalSaving(false);
    setShowEdit(false);
  };

  const handleSaveNotes = async () => {
    setLocalSaving(true);
    await onAction(tx.id, { adminNotes });
    setLocalSaving(false);
  };

  const isPending = tx.status === "pending";
  const isCompleted = tx.status === "completed";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg bg-[#0c0c1d] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-primary/20 to-blue-500/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                {getTypeIcon(tx.type)}
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{t("admin.finances.transactionDetails")}</h3>
                <p className="text-xs text-white/40 font-mono">#{tx.id}</p>
              </div>
            </div>
            <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={onClose}>
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${getStatusStyle(tx.status)}`}>
              {tx.status === "pending" && <Clock className="w-3.5 h-3.5" />}
              {tx.status === "completed" && <CheckCircle className="w-3.5 h-3.5" />}
              {tx.status === "rejected" && <XCircle className="w-3.5 h-3.5" />}
              {tx.status === "refunded" && <RefreshCw className="w-3.5 h-3.5" />}
              {getStatusLabel(tx.status)}
            </span>
            <span className="text-xs text-white/30">{new Date(tx.createdAt).toLocaleString("ar-EG")}</span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <TxInfoItem label={t("admin.finances.userCol")} value={`@${txName}`} />
            <TxInfoItem label={t("admin.finances.typeLabel")} value={getTypeLabel(tx.type)} />
            <TxInfoItem
              label={t("admin.finances.amountCol")}
              value={`${tx.type === "gift_sent" || tx.type === "withdrawal" ? "-" : "+"}${Math.abs(tx.amount).toLocaleString()} ${tx.currency === "coins" ? t("admin.finances.currency_coins") : t("admin.finances.currency_diamonds")}`}
              highlight={tx.type === "gift_sent" || tx.type === "withdrawal" ? "red" : "green"}
            />
            <TxInfoItem label={t("admin.finances.balanceAfter")} value={tx.balanceAfter?.toLocaleString() || "—"} />
            <TxInfoItem label={t("admin.finances.descCol")} value={tx.description || "—"} />
            <TxInfoItem label={t("admin.finances.paymentMethodCol")} value={tx.paymentMethod || "—"} />
          </div>

          {/* Rejection reason if exists */}
          {tx.rejectionReason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1"><Ban className="w-3 h-3" /> {t("admin.finances.rejectionReason")}</p>
              <p className="text-xs text-red-300/70">{tx.rejectionReason}</p>
            </div>
          )}

          {/* Admin notes if exists */}
          {tx.adminNotes && !showEdit && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-xs font-bold text-primary/70 mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {t("admin.finances.adminNotes")}</p>
              <p className="text-xs text-white/50">{tx.adminNotes}</p>
            </div>
          )}

          {/* Review info */}
          {tx.reviewedAt && (
            <p className="text-[11px] text-white/20 text-center">
              {t("admin.finances.reviewedAt", { date: new Date(tx.reviewedAt).toLocaleString("ar-EG") })}
            </p>
          )}

          {/* ── EDIT SECTION ────────────────────────── */}
          <AnimatePresence>
            {showEdit && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                  <p className="text-xs font-bold text-white/60 flex items-center gap-1"><Edit3 className="w-3 h-3" /> {t("admin.finances.editTransaction")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.amountCol")}</label>
                      <input
                        type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.descCol")}</label>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.adminNotes")}</label>
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-primary/50 resize-none h-16"
                      placeholder={t("admin.finances.optionalNotePlaceholder")}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 h-9 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      onClick={handleSaveEdit}
                      disabled={localSaving}
                    >
                      {localSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {t("admin.finances.saveEdit")}
                    </button>
                    <button
                      className="px-4 h-9 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-bold hover:bg-white/10 transition-colors"
                      onClick={() => setShowEdit(false)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── REJECT SECTION ──────────────────────── */}
          <AnimatePresence>
            {showReject && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <p className="text-xs font-bold text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {t("admin.finances.rejectTransaction")}</p>
                  <div>
                    <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.rejectReasonOptional")}</label>
                    <textarea
                      className="w-full bg-white/5 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-red-500/40 resize-none h-16"
                      placeholder={t("admin.finances.rejectReasonPlaceholder")}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.adminNotesOptional")}</label>
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-primary/50 resize-none h-16"
                      placeholder={t("admin.finances.internalNotePlaceholder")}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 h-9 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      onClick={handleReject}
                      disabled={actionLoading === tx.id}
                    >
                      {actionLoading === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      {t("admin.finances.confirmReject")}
                    </button>
                    <button
                      className="px-4 h-9 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-bold hover:bg-white/10 transition-colors"
                      onClick={() => setShowReject(false)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── ACTION BUTTONS ──────────────────────── */}
          <div className="flex flex-wrap gap-2 pt-1">
            {isPending && !showReject && !showEdit && (
              <>
                <button
                  className="flex-1 h-10 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  onClick={handleApprove}
                  disabled={actionLoading === tx.id}
                >
                  {actionLoading === tx.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {t("admin.finances.approve")}
                </button>
                <button
                  className="flex-1 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                  onClick={() => { setShowReject(true); setShowEdit(false); }}
                >
                  <XCircle className="w-4 h-4" /> {t("admin.finances.reject")}
                </button>
                <button
                  className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-colors flex items-center gap-2"
                  onClick={() => { setShowEdit(true); setShowReject(false); }}
                >
                  <Edit3 className="w-4 h-4" /> {t("common.edit")}
                </button>
              </>
            )}

            {isCompleted && !showEdit && (
              <button
                className="flex-1 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-bold hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={handleRefund}
                disabled={actionLoading === tx.id}
              >
                {actionLoading === tx.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t("admin.finances.refundAction")}
              </button>
            )}

            {!isPending && !showEdit && (
              <button
                className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-colors flex items-center gap-2"
                onClick={() => { setShowEdit(true); setShowReject(false); }}
              >
                <Edit3 className="w-4 h-4" /> {t("common.edit")}
              </button>
            )}

            {/* Add notes only (for non-pending already reviewed) */}
            {!isPending && !showEdit && tx.adminNotes !== adminNotes && (
              <button
                className="h-10 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold hover:bg-primary/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                onClick={handleSaveNotes}
                disabled={localSaving}
              >
                {localSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("admin.finances.saveNotes")}
              </button>
            )}

            <button
              className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-bold hover:bg-white/10 transition-colors"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>

          {/* Admin notes editable for non-pending */}
          {!isPending && !showEdit && (
            <div>
              <label className="text-[10px] text-white/30 mb-1 block flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> {t("admin.finances.adminNotes")}
              </label>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-primary/50 resize-none h-16"
                placeholder={t("admin.finances.addNotePlaceholder")}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TxInfoItem({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  const colorMap: Record<string, string> = { red: "text-red-400", green: "text-green-400", yellow: "text-yellow-400" };
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
      <p className="text-[10px] text-white/30 mb-1">{label}</p>
      <p className={`text-sm font-bold ${highlight ? colorMap[highlight] || "text-white" : "text-white"}`}>{value}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WALLETS TAB
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

function WalletsTab({ search, showFilters }: { search: string; showFilters: boolean }) {
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
        setWallets((res as any).data || []);
        setPagination((p) => ({
          ...p,
          total: (res as any).pagination?.total || 0,
          totalPages: (res as any).pagination?.totalPages || 0,
        }));
        if ((res as any).summary) setSummary((res as any).summary);
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

function WalletDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [walletInfo, setWalletInfo] = useState<WalletDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [typeFilter, setTypeFilter] = useState("");

  const fetchData = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await adminWallets.get(userId, {
        page: pagination.page,
        limit: pagination.limit,
        type: typeFilter || undefined,
      });
      if (res.success) {
        setWalletInfo((res as any).wallet);
        setTransactions((res as any).transactions || []);
        setPagination((p) => ({
          ...p,
          total: (res as any).pagination?.total || 0,
          totalPages: (res as any).pagination?.totalPages || 0,
        }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setTxLoading(false); }
  }, [userId, pagination.page, pagination.limit, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "purchase": return <CreditCard className="w-3.5 h-3.5 text-green-400" />;
      case "gift_sent": return <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />;
      case "gift_received": return <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400" />;
      case "withdrawal": return <DollarSign className="w-3.5 h-3.5 text-orange-400" />;
      case "refund": return <RefreshCw className="w-3.5 h-3.5 text-purple-400" />;
      default: return <Gift className="w-3.5 h-3.5 text-white/40" />;
    }
  };

  const getTypeLabel = (type: string) => { const opt = TX_TYPE_OPTIONS.find((o) => o.value === type); return opt ? t(opt.labelKey) : type; };
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-400/10 text-green-400 border-green-400/20";
      case "pending": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
      case "failed": return "bg-red-400/10 text-red-400 border-red-400/20";
      case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "refunded": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  };
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
                          {getTypeIcon(tx.type)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white/80">{getTypeLabel(tx.type)}</p>
                          <p className="text-[10px] text-white/25">{tx.description || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <p className={`text-sm font-bold ${tx.type === "gift_sent" || tx.type === "withdrawal" ? "text-red-400" : "text-green-400"}`}>
                            {tx.type === "gift_sent" || tx.type === "withdrawal" ? "-" : "+"}{Math.abs(tx.amount).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-white/20">{new Date(tx.createdAt).toLocaleDateString("ar-EG")}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusStyle(tx.status)}`}>
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
// PAYMENT METHODS TAB
// ════════════════════════════════════════════════════════════

function PaymentMethodsTab({ search }: { search: string }) {
  const { t } = useTranslation();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "", nameAr: "", icon: "💳", type: "card", provider: "",
    countries: [] as string[], minAmount: "", maxAmount: "", fee: "", instructions: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminPaymentMethods.list();
      if (res.success) setMethods(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditMethod(null);
    setFormData({ name: "", nameAr: "", icon: "💳", type: "card", provider: "", countries: [], minAmount: "", maxAmount: "", fee: "", instructions: "" });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (pm: PaymentMethod) => {
    setEditMethod(pm);
    setFormData({
      name: pm.name,
      nameAr: pm.nameAr,
      icon: pm.icon,
      type: pm.type,
      provider: pm.provider,
      countries: pm.countries || [],
      minAmount: String(pm.minAmount),
      maxAmount: String(pm.maxAmount),
      fee: pm.fee,
      instructions: pm.instructions,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.name || !formData.nameAr || !formData.type) {
      setFormError(t("admin.finances.nameRequired"));
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        minAmount: parseInt(formData.minAmount) || 1,
        maxAmount: parseInt(formData.maxAmount) || 10000,
      };
      if (editMethod) {
        await adminPaymentMethods.update(editMethod.id, payload);
      } else {
        await adminPaymentMethods.create(payload);
      }
      setShowForm(false);
      fetchData();
    } catch (e: any) {
      setFormError(e?.message || t("admin.finances.errorOccurred"));
    } finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.finances.confirmDelete"))) return;
    try {
      await adminPaymentMethods.delete(id);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleToggle = async (pm: PaymentMethod) => {
    try {
      await adminPaymentMethods.update(pm.id, { isActive: !pm.isActive });
      setMethods((prev) => prev.map((m) => m.id === pm.id ? { ...m, isActive: !m.isActive } : m));
    } catch (e) { console.error(e); }
  };

  const [toggleAllLoading, setToggleAllLoading] = useState(false);
  const allActive = methods.length > 0 && methods.every((m) => m.isActive);

  const handleToggleAll = async () => {
    const newState = !allActive;
    setToggleAllLoading(true);
    try {
      await Promise.all(methods.map((m) => adminPaymentMethods.update(m.id, { isActive: newState })));
      setMethods((prev) => prev.map((m) => ({ ...m, isActive: newState })));
    } catch (e) { console.error(e); }
    finally { setToggleAllLoading(false); }
  };

  const toggleCountry = (code: string) => {
    setFormData((f) => ({
      ...f,
      countries: f.countries.includes(code)
        ? f.countries.filter((c) => c !== code)
        : [...f.countries, code],
    }));
  };

  const getTypeLabel = (type: string) => { const opt = PM_TYPE_OPTIONS.find((o) => o.value === type); return opt ? t(opt.labelKey) : type; };
  const getTypeStyle = (type: string) => {
    switch (type) {
      case "card": return "bg-blue-400/10 text-blue-400 border-blue-400/20";
      case "e_wallet": return "bg-green-400/10 text-green-400 border-green-400/20";
      case "crypto": return "bg-orange-400/10 text-orange-400 border-orange-400/20";
      case "telecom": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      case "bank_transfer": return "bg-cyan-400/10 text-cyan-400 border-cyan-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  };

  const countryLabel = (code: string) => { const opt = COUNTRY_OPTIONS.find((c) => c.code === code); return opt ? t(opt.labelKey) : code; };

  const filteredMethods = useMemo(() => {
    if (!search) return methods;
    const q = search.toLowerCase();
    return methods.filter((pm) =>
      pm.nameAr.toLowerCase().includes(q) ||
      pm.name.toLowerCase().includes(q) ||
      pm.provider.toLowerCase().includes(q)
    );
  }, [methods, search]);

  return (
    <div className="space-y-2.5">
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/50">{t("admin.finances.paymentMethodsCount", { count: filteredMethods.length })}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAll}
            disabled={toggleAllLoading || methods.length === 0}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-bold transition-colors border disabled:opacity-40 ${
              allActive
                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
            }`}
          >
            {toggleAllLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : allActive ? (
              <><XCircle className="w-3.5 h-3.5" /> {t("admin.finances.deactivateAll")}</>
            ) : (
              <><CheckCircle className="w-3.5 h-3.5" /> {t("admin.finances.activateAll")}</>
            )}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 h-8 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t("admin.finances.addPaymentMethod")}
          </button>
        </div>
      </div>

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-xl h-44 animate-pulse" />
          ))
        ) : filteredMethods.length === 0 ? (
          <div className="col-span-full text-center py-12 text-white/20">{search ? t("admin.finances.noResults") : t("admin.finances.noPaymentMethods")}</div>
        ) : (
          filteredMethods.map((pm, i) => (
            <motion.div
              key={pm.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`bg-[#0c0c1d] border rounded-xl p-4 hover:border-white/10 transition-colors relative ${pm.isActive ? "border-white/5" : "border-red-500/20 opacity-60"}`}
            >
              {/* Top row: icon + name + toggle */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-xl">
                    {pm.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{pm.nameAr}</h3>
                    <p className="text-[11px] text-white/30">{pm.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(pm)}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${pm.isActive ? "bg-green-500" : "bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${pm.isActive ? "left-0.5" : "left-[22px]"}`} />
                </button>
              </div>

              {/* Info rows */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmType")}</span>
                  <span className={`font-bold px-2 py-0.5 rounded-lg border text-[10px] ${getTypeStyle(pm.type)}`}>{getTypeLabel(pm.type)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmProvider")}</span>
                  <span className="text-white/60 font-medium">{pm.provider || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmLimits")}</span>
                  <span className="text-white/60 font-mono">${pm.minAmount} – ${pm.maxAmount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmFee")}</span>
                  <span className="text-yellow-400 font-bold">{pm.fee}</span>
                </div>
              </div>

              {/* Countries */}
              {pm.countries && pm.countries.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {pm.countries.map((code) => (
                    <span key={code} className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded-md font-bold">
                      {countryLabel(code)}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1.5">
                <button
                  className="flex-1 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 font-bold transition-colors flex items-center justify-center gap-1"
                  onClick={() => openEdit(pm)}
                >
                  <Edit3 className="w-3 h-3" /> {t("common.edit")}
                </button>
                <button
                  className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                  onClick={() => handleDelete(pm.id)}
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>

              {/* Inactive badge */}
              {!pm.isActive && (
                <div className="absolute top-2.5 left-2.5 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md font-bold">{t("admin.finances.pmDisabled")}</div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div
              className="relative w-full max-w-lg bg-[#0c0c1d] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">{editMethod ? t("admin.finances.editPaymentMethod") : t("admin.finances.addNewPaymentMethod")}</h3>
                <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Icon Picker */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-2 block">{t("admin.finances.iconLabel")}</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {PM_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`w-full aspect-square rounded-lg text-xl flex items-center justify-center transition-colors ${formData.icon === icon ? "bg-primary/20 border border-primary/40" : "bg-white/5 hover:bg-white/10 border border-transparent"}`}
                        onClick={() => setFormData((f) => ({ ...f, icon }))}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Names */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("admin.finances.nameEn")} value={formData.name} onChange={(v) => setFormData((f) => ({ ...f, name: v }))} placeholder="Visa / Mastercard" />
                  <FormField label={t("admin.finances.nameAr")} value={formData.nameAr} onChange={(v) => setFormData((f) => ({ ...f, nameAr: v }))} placeholder={t("admin.finances.nameArPlaceholder")} />
                </div>

                {/* Type + Provider */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.finances.pmType")}</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white/70 focus:outline-none"
                      value={formData.type}
                      onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    >
                      {PM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                    </select>
                  </div>
                  <FormField label={t("admin.finances.pmProvider")} value={formData.provider} onChange={(v) => setFormData((f) => ({ ...f, provider: v }))} placeholder="Stripe, PayPal..." />
                </div>

                {/* Amounts + Fee */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField label={t("admin.finances.minAmount")} value={formData.minAmount} onChange={(v) => setFormData((f) => ({ ...f, minAmount: v }))} placeholder="1" type="number" />
                  <FormField label={t("admin.finances.maxAmount")} value={formData.maxAmount} onChange={(v) => setFormData((f) => ({ ...f, maxAmount: v }))} placeholder="10000" type="number" />
                  <FormField label={t("admin.finances.pmFee")} value={formData.fee} onChange={(v) => setFormData((f) => ({ ...f, fee: v }))} placeholder="2.9%" />
                </div>

                {/* Countries */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-2 block flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {t("admin.finances.supportedCountries")}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNTRY_OPTIONS.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleCountry(c.code)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          formData.countries.includes(c.code)
                            ? "bg-primary/15 border-primary/30 text-primary font-bold"
                            : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                        }`}
                      >
                        {t(c.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.finances.paymentInstructions")}</label>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors resize-none h-20"
                    placeholder={t("admin.finances.paymentInstructionsPlaceholder")}
                    value={formData.instructions}
                    onChange={(e) => setFormData((f) => ({ ...f, instructions: e.target.value }))}
                  />
                </div>

                {/* Error */}
                {formError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    disabled={formLoading}
                    onClick={handleSubmit}
                  >
                    {formLoading ? t("admin.finances.saving") : editMethod ? t("admin.finances.saveChanges") : t("common.add")}
                  </button>
                  <button
                    className="px-6 h-10 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-colors"
                    onClick={() => setShowForm(false)}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CURRENCIES TAB
// ════════════════════════════════════════════════════════════

const FILTER_LABELS: Record<string, string> = {
  spin_cost: "filterSpin",
  gender_both: "filterGenderBoth",
  gender_male: "filterGenderMale",
  gender_female: "filterGenderFemale",
  age_range: "filterAgeRange",
  country_specific: "filterCountrySpecific",
  country_all: "filterCountryAll",
};

function CurrenciesTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [filters, setFilters] = useState<any[]>([]);
  const [callRates, setCallRates] = useState({ voiceCallRate: 5, videoCallRate: 10 });
  const [messageCosts, setMessageCosts] = useState<any>({});
  const [matchingStats, setMatchingStats] = useState<any>(null);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminPricing.getAll();
      if (res.data) {
        const d = res.data;
        setPackages(d.coinPackages || []);
        if (d.filters) {
          const filterArr = Object.entries(d.filters).map(([key, val]) => ({
            filterType: key, priceCoins: val as number,
          }));
          setFilters(filterArr);
        }
        if (d.calls) {
          setCallRates({
            voiceCallRate: d.calls.voice_call_rate || 5,
            videoCallRate: d.calls.video_call_rate || 10,
          });
        }
        if (d.messages) setMessageCosts(d.messages);
        if (d.matchingStats) setMatchingStats(d.matchingStats);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const saveCallRates = async () => {
    setSaving(true);
    try {
      await adminPricing.updateCallRates(callRates);
      showSuccess(t("admin.finances.savedSuccess"));
    } catch {}
    setSaving(false);
  };

  const saveFilter = async (filterType: string, priceCoins: number) => {
    try {
      await adminPricing.bulkUpdateFilters([{ filterType, priceCoins }]);
      showSuccess(t("admin.finances.savedSuccess"));
    } catch {}
  };

  const saveMessageCosts = async () => {
    setSaving(true);
    try {
      await adminPricing.updateMessageCosts(messageCosts);
      showSuccess(t("admin.finances.savedSuccess"));
    } catch {}
    setSaving(false);
  };

  const deletePackage = async (id: string) => {
    if (!confirm(t("admin.finances.deleteConfirm"))) return;
    try {
      await adminPricing.deleteCoinPackage(id);
      setPackages(prev => prev.filter(p => p.id !== id));
      showSuccess(t("admin.finances.savedSuccess"));
    } catch {}
  };

  const savePackage = async (data: any) => {
    setSaving(true);
    try {
      if (editingPackage?.id) {
        await adminPricing.updateCoinPackage(editingPackage.id, data);
      } else {
        await adminPricing.createCoinPackage(data);
      }
      setShowPackageModal(false);
      setEditingPackage(null);
      loadData();
      showSuccess(t("admin.finances.savedSuccess"));
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success Message */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-emerald-400 text-sm text-center"
          >
            <CheckCircle className="w-4 h-4 inline-block mr-1" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Matching Stats */}
      {matchingStats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-black text-white">{matchingStats.queueSize || 0}</p>
            <p className="text-[10px] text-white/40 font-medium">{t("admin.finances.queueSize")}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
            <Coins className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-black text-white">{matchingStats.activeMatches || 0}</p>
            <p className="text-[10px] text-white/40 font-medium">{t("admin.finances.activeMatches")}</p>
          </div>
        </div>
      )}

      {/* Coin Packages */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            {t("admin.finances.coinPackages")}
          </h3>
          <button
            onClick={() => { setEditingPackage({}); setShowPackageModal(true); }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> {t("admin.finances.addPackage")}
          </button>
        </div>

        {packages.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-6">{t("admin.finances.noPackages")}</p>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{pkg.coins?.toLocaleString()}</span>
                      {(pkg.bonusCoins || 0) > 0 && (
                        <span className="text-emerald-400 text-[10px] font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded">
                          +{pkg.bonusCoins}
                        </span>
                      )}
                      {pkg.isPopular && (
                        <span className="text-amber-400 text-[10px] font-bold bg-amber-400/10 px-1.5 py-0.5 rounded">
                          ⭐
                        </span>
                      )}
                    </div>
                    <span className="text-white/40 text-xs">${pkg.priceUsd}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditingPackage(pkg); setShowPackageModal(true); }}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                  >
                    <Edit3 className="w-3 h-3 text-white/50" />
                  </button>
                  <button
                    onClick={() => deletePackage(pkg.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/5 hover:bg-red-500/15 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3 text-red-400/60" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Rates */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4 text-emerald-400" />
          {t("admin.finances.callRates")}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">
              {t("admin.finances.voiceCallRate")}
            </label>
            <input
              type="number"
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
              value={callRates.voiceCallRate}
              onChange={(e) => setCallRates(prev => ({ ...prev, voiceCallRate: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">
              {t("admin.finances.videoCallRate")}
            </label>
            <input
              type="number"
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
              value={callRates.videoCallRate}
              onChange={(e) => setCallRates(prev => ({ ...prev, videoCallRate: Number(e.target.value) }))}
            />
          </div>
        </div>
        <button
          onClick={saveCallRates}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 text-xs text-white bg-primary/20 hover:bg-primary/30 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t("admin.finances.saveChanges")}
        </button>
      </div>

      {/* Filter Pricing */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-blue-400" />
          {t("admin.finances.filterPricing")}
        </h3>
        <div className="space-y-2">
          {filters.map((f) => (
            <div key={f.filterType} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-3">
              <span className="text-white/60 text-xs font-medium">
                {t(`admin.finances.${FILTER_LABELS[f.filterType] || f.filterType}`)}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  className="w-20 bg-white/5 border border-white/10 rounded-lg h-7 px-2 text-xs text-white text-center focus:outline-none focus:border-primary/50"
                  value={f.priceCoins}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFilters(prev => prev.map(p => p.filterType === f.filterType ? { ...p, priceCoins: val } : p));
                  }}
                  onBlur={() => saveFilter(f.filterType, f.priceCoins)}
                />
                <span className="text-white/30 text-[10px]">{t("matching.coins")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Costs */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          {t("admin.finances.messageCosts")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">
              {t("admin.finances.messageCost")}
            </label>
            <input
              type="number"
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
              value={messageCosts.message_cost || 0}
              onChange={(e) => setMessageCosts((prev: any) => ({ ...prev, message_cost: Number(e.target.value) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "media_enabled", label: "mediaEnabled" },
              { key: "voice_call_enabled", label: "voiceCallEnabled" },
              { key: "video_call_enabled", label: "videoCallEnabled" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
                <span className="text-white/60 text-xs">{t(`admin.finances.${item.label}`)}</span>
                <button
                  onClick={() => setMessageCosts((prev: any) => ({
                    ...prev,
                    [item.key]: prev[item.key] === "true" || prev[item.key] === true ? "false" : "true",
                  }))}
                  className="flex-shrink-0"
                >
                  {messageCosts[item.key] === "true" || messageCosts[item.key] === true ? (
                    <ToggleRight className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-white/20" />
                  )}
                </button>
              </div>
            ))}
            <div>
              <label className="text-[10px] text-white/40 font-medium mb-1 block">
                {t("admin.finances.timeLimit")}
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
                value={messageCosts.time_limit || 0}
                onChange={(e) => setMessageCosts((prev: any) => ({ ...prev, time_limit: Number(e.target.value) }))}
              />
            </div>
          </div>
          <button
            onClick={saveMessageCosts}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-white bg-primary/20 hover:bg-primary/30 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {t("admin.finances.saveChanges")}
          </button>
        </div>
      </div>

      {/* Package Edit Modal */}
      <AnimatePresence>
        {showPackageModal && (
          <PackageEditModal
            pkg={editingPackage}
            saving={saving}
            onSave={savePackage}
            onClose={() => { setShowPackageModal(false); setEditingPackage(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PackageEditModal({ pkg, saving, onSave, onClose }: {
  pkg: any; saving: boolean;
  onSave: (data: any) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [coins, setCoins] = useState(pkg?.coins || 100);
  const [bonusCoins, setBonusCoins] = useState(pkg?.bonusCoins || 0);
  const [priceUsd, setPriceUsd] = useState(pkg?.priceUsd || "0.99");
  const [isPopular, setIsPopular] = useState(pkg?.isPopular || false);
  const [sortOrder, setSortOrder] = useState(pkg?.sortOrder || 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm mx-4 bg-[#12122a] border border-white/10 rounded-2xl p-5"
      >
        <button onClick={onClose} className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-white/50" />
        </button>
        <h3 className="text-base font-bold text-white mb-4 text-center">
          {pkg?.id ? t("admin.finances.editPackage") : t("admin.finances.addPackage")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packageCoins")}</label>
            <input type="number" min={1} className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packageBonus")}</label>
            <input type="number" min={0} className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={bonusCoins} onChange={(e) => setBonusCoins(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packagePrice")}</label>
            <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
          </div>
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
            <span className="text-white/60 text-xs">{t("admin.finances.packagePopular")}</span>
            <button onClick={() => setIsPopular(!isPopular)}>
              {isPopular ? <ToggleRight className="w-6 h-6 text-amber-400" /> : <ToggleLeft className="w-6 h-6 text-white/20" />}
            </button>
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packageSort")}</label>
            <input type="number" min={0} className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
          <button
            onClick={() => onSave({ coins, bonusCoins, priceUsd, isPopular, sortOrder })}
            disabled={saving}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("admin.finances.saveChanges")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════
// UTILITY COMPONENTS
// ════════════════════════════════════════════════════════════

function FormField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/40 font-medium mb-1.5 block">{label}</label>
      <input
        type={type}
        className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// FINANCIAL DASHBOARD — لوحة الإحصائيات المالية
// ════════════════════════════════════════════════════════════

function FinancialDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await adminFinanceStats.get();
      if (res?.data) setStats(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // #13: Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  // #18: Growth indicators
  const weekGrowth = stats.comparison?.weekGrowth ?? null;
  const monthGrowth = stats.comparison?.monthGrowth ?? null;

  const cards = [
    { label: t("admin.finances.dashTotalRevenue"), value: stats.revenue?.total || 0, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: t("admin.finances.dashTodayRevenue"), value: stats.revenue?.today || 0, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: t("admin.finances.dashMonthRevenue"), value: stats.revenue?.month || 0, icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10",
      growth: monthGrowth },
    { label: t("admin.finances.dashTotalWithdrawn"), value: stats.withdrawn || 0, icon: ArrowUpRight, color: "text-red-400", bg: "bg-red-500/10" },
    { label: t("admin.finances.dashPendingWithdrawals"), value: stats.withdrawals?.pending || 0, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", suffix: ` (${(stats.withdrawals?.pendingAmount || 0).toLocaleString()} ${t("admin.finances.coins")})` },
    { label: t("admin.finances.dashGiftVolume"), value: stats.giftVolume || 0, icon: Gift, color: "text-pink-400", bg: "bg-pink-500/10" },
    { label: t("admin.finances.dashTotalCoins"), value: stats.circulation?.totalCoins || 0, icon: Coins, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: t("admin.finances.dashTotalDiamonds"), value: stats.circulation?.totalDiamonds || 0, icon: Diamond, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {cards.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center gap-3"
        >
          <div className={`${c.bg} p-2 rounded-lg`}>
            <c.icon className={`w-4 h-4 ${c.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/40 truncate">{c.label}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-white">{c.value.toLocaleString()}{(c as any).suffix || ""}</p>
              {(c as any).growth !== undefined && (c as any).growth !== null && (
                <span className={`text-[9px] font-bold ${(c as any).growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(c as any).growth >= 0 ? "↑" : "↓"}{Math.abs((c as any).growth)}%
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WITHDRAWALS TAB — طلبات السحب
// ════════════════════════════════════════════════════════════

const WR_STATUS_OPTIONS = [
  { value: "", labelKey: "admin.finances.allStatuses" },
  { value: "pending", labelKey: "admin.finances.txStatusPending" },
  { value: "processing", labelKey: "admin.finances.wrStatusProcessing" },
  { value: "completed", labelKey: "admin.finances.txStatusCompleted" },
  { value: "rejected", labelKey: "admin.finances.txStatusRejected" },
];

function WithdrawalsTab({ search, showFilters }: { search: string; showFilters: boolean }) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedWr, setSelectedWr] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string; amount: number } | null>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminWithdrawals.list({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        search,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (res?.data) {
        setRequests(Array.isArray(res.data) ? res.data : []);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [pagination.page, pagination.limit, statusFilter, search, startDate, endDate]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { setPagination((p) => ({ ...p, page: 1 })); }, [statusFilter, search, startDate, endDate]);

  // #17: Confirm dialog for large withdrawals (> 10,000 coins)
  const LARGE_AMOUNT_THRESHOLD = 10000;

  const handleAction = async (id: string, status: "completed" | "rejected" | "processing") => {
    setActionLoading(id);
    try {
      await adminWithdrawals.update(id, { status, adminNotes: adminNotes || undefined });
      setSelectedWr(null);
      setConfirmAction(null);
      setAdminNotes("");
      loadRequests();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const initiateAction = (id: string, status: "completed" | "rejected" | "processing", amount: number) => {
    if (status === "completed" && amount >= LARGE_AMOUNT_THRESHOLD) {
      setConfirmAction({ id, status, amount });
    } else {
      handleAction(id, status);
    }
  };

  // #14: Load adjustment history when viewing wallet detail
  const loadAdjustments = async (userId: string) => {
    try {
      const res = await adminAdjustments.list(userId);
      setAdjustments(Array.isArray(res?.data) ? res.data : []);
    } catch { setAdjustments([]); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      processing: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      rejected: "bg-red-500/15 text-red-400 border-red-500/20",
    };
    return map[s] || "bg-white/10 text-white/60 border-white/10";
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex gap-2 flex-wrap">
                {WR_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      statusFilter === opt.value ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                    }`}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
              {/* #10: Date filters */}
              <div className="flex gap-2 items-center">
                <CalendarDays className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg h-8 px-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                <span className="text-white/20 text-xs">→</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg h-8 px-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                {(startDate || endDate) && (
                  <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-white/30 hover:text-white/60">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* #11: CSV Export */}
              <div className="flex gap-2">
                <a href={adminExports.withdrawalsCsvUrl(statusFilter || undefined)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                  <Download className="w-3.5 h-3.5" /> {t("admin.finances.exportCsv", "تصدير CSV")}
                </a>
                <a href={adminExports.transactionsCsvUrl({ startDate, endDate })} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors">
                  <Download className="w-3.5 h-3.5" /> {t("admin.finances.exportTransactions", "تصدير المعاملات")}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">{t("admin.finances.noWithdrawals")}</div>
      ) : (
        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-white/40 border-b border-white/5">
                <th className="text-start px-3 py-2.5 font-medium">{t("admin.finances.wrUser")}</th>
                <th className="text-start px-3 py-2.5 font-medium">{t("admin.finances.wrAmount")}</th>
                <th className="text-start px-3 py-2.5 font-medium">{t("admin.finances.wrAmountUsd")}</th>
                <th className="text-start px-3 py-2.5 font-medium">{t("admin.finances.txStatus")}</th>
                <th className="text-start px-3 py-2.5 font-medium">{t("admin.finances.wrDate")}</th>
                <th className="text-end px-3 py-2.5 font-medium">{t("admin.finances.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((wr) => (
                <tr key={wr.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5 text-white font-medium">@{wr.user?.username || wr.userId?.slice(0, 8)}</td>
                  <td className="px-3 py-2.5 text-white">{wr.amount?.toLocaleString()} <span className="text-white/40">{t("admin.finances.coins")}</span></td>
                  <td className="px-3 py-2.5 text-emerald-400 font-medium">${wr.amountUsd || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(wr.status)}`}>
                      {wr.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white/40">{new Date(wr.createdAt).toLocaleDateString("ar")}</td>
                  <td className="px-3 py-2.5 text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      {(wr.status === "pending" || wr.status === "processing") && (
                        <>
                          <button
                            onClick={() => initiateAction(wr.id, "completed", wr.amount)}
                            disabled={actionLoading === wr.id}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            title={t("admin.finances.approve")}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setSelectedWr(wr); setAdminNotes(""); }}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            title={t("admin.finances.reject")}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {wr.status === "pending" && (
                        <button
                          onClick={() => initiateAction(wr.id, "processing", wr.amount)}
                          disabled={actionLoading === wr.id}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title={t("admin.finances.markProcessing")}
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedWr(wr); setAdminNotes(wr.adminNotes || ""); if (wr.user?.id) loadAdjustments(wr.userId); }}
                        className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-white/30">{t("admin.finances.showingOf", { showing: requests.length, total: pagination.total })}</p>
          <div className="flex gap-1">
            <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page <= 1} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            <span className="px-3 py-1.5 text-xs text-white/50">{pagination.page}/{pagination.totalPages}</span>
            <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))} disabled={pagination.page >= pagination.totalPages} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* #17: Confirm dialog for large withdrawals */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a2e] border border-amber-500/20 rounded-2xl w-full max-w-sm p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{t("admin.finances.confirmLargeWithdrawal", "تأكيد طلب سحب كبير")}</h3>
                  <p className="text-xs text-white/40">{t("admin.finances.confirmLargeAmount", "هل أنت متأكد من الموافقة على سحب {{amount}} عملة؟").replace("{{amount}}", confirmAction.amount.toLocaleString())}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(confirmAction.id, confirmAction.status as any)}
                  disabled={!!actionLoading}
                  className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {t("admin.finances.approve")}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2 bg-white/5 text-white/60 font-bold text-xs rounded-xl hover:bg-white/10 transition-colors"
                >
                  {t("admin.finances.cancel", "إلغاء")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail / Reject Modal */}
      <AnimatePresence>
        {selectedWr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedWr(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">{t("admin.finances.wrDetails")}</h3>
                <button onClick={() => setSelectedWr(null)} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-white/40">{t("admin.finances.wrUser")}:</span> <span className="text-white font-medium">@{selectedWr.user?.username || selectedWr.userId?.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">{t("admin.finances.wrAmount")}:</span> <span className="text-white font-medium">{selectedWr.amount?.toLocaleString()} {t("admin.finances.coins")}</span></div>
                <div className="flex justify-between"><span className="text-white/40">{t("admin.finances.wrAmountUsd")}:</span> <span className="text-emerald-400 font-medium">${selectedWr.amountUsd || "—"}</span></div>
                <div className="flex justify-between"><span className="text-white/40">{t("admin.finances.txStatus")}:</span> <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(selectedWr.status)}`}>{selectedWr.status}</span></div>
                {selectedWr.paymentDetails && (
                  <div>
                    <span className="text-white/40 block mb-1">{t("admin.finances.wrPaymentDetails")}:</span>
                    <div className="bg-white/5 rounded-lg p-2 text-white/70 break-all">
                      {typeof selectedWr.paymentDetails === "string" ? selectedWr.paymentDetails : JSON.stringify(selectedWr.paymentDetails, null, 2)}
                    </div>
                  </div>
                )}
              </div>

              {/* #14: Adjustment history */}
              {adjustments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-white/50 mb-2">{t("admin.finances.adjustmentHistory", "سجل التعديلات")}</h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {adjustments.map((adj: any) => (
                      <div key={adj.id} className="flex justify-between items-center bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-[10px]">
                        <span className={adj.amount > 0 ? "text-emerald-400" : "text-red-400"}>
                          {adj.amount > 0 ? "+" : ""}{adj.amount} {adj.currency}
                        </span>
                        <span className="text-white/30 truncate max-w-[50%]">{adj.description}</span>
                        <span className="text-white/20">{new Date(adj.createdAt).toLocaleDateString("ar")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedWr.status === "pending" || selectedWr.status === "processing") && (
                <div className="space-y-3">
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none h-20"
                    placeholder={t("admin.finances.wrAdminNotes")}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => initiateAction(selectedWr.id, "completed", selectedWr.amount)}
                      disabled={!!actionLoading}
                      className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {actionLoading === selectedWr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      {t("admin.finances.approve")}
                    </button>
                    <button
                      onClick={() => handleAction(selectedWr.id, "rejected")}
                      disabled={!!actionLoading}
                      className="flex-1 py-2 bg-red-500/20 text-red-400 font-bold text-xs rounded-xl hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {actionLoading === selectedWr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      {t("admin.finances.reject")}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ADJUST BALANCE MODAL — تعديل رصيد المستخدم
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
