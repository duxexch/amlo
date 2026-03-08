import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Download, X, CheckCircle, XCircle, Loader2, Eye,
  ChevronRight, ChevronLeft, RefreshCw, Ban, Edit3, Save,
  MessageSquare,
} from "lucide-react";
import { adminTransactions, adminExports } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { getTypeIcon as sharedGetTypeIcon, getStatusStyle as sharedGetStatusStyle } from "./financeHelpers";
import { useEscapeKey, useFocusTrap } from "../wallet/helpers";
import { toast } from "sonner";
import type { Transaction } from "./financeTypes";
import { TX_TYPE_OPTIONS, TX_STATUS_OPTIONS } from "./financeTypes";

// ════════════════════════════════════════════════════════════
// TRANSACTIONS TAB
// ════════════════════════════════════════════════════════════

export function TransactionsTab({ search, showFilters, refreshSignal = 0 }: { search: string; showFilters: boolean; refreshSignal?: number }) {
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ type: "", status: "" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Reset page on search change
  useEffect(() => { setPagination((p) => ({ ...p, page: 1 })); }, [search, startDate, endDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await adminTransactions.list(params);
      if (res.success) {
        setTransactions(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, filters, search, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData, refreshSignal]);

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

  const pendingTxIds = useMemo(() => transactions.filter(tx => tx.status === "pending").map(tx => tx.id), [transactions]);

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingTxIds.length && pendingTxIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingTxIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkAction = async (status: "completed" | "rejected") => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const results = await Promise.allSettled(
      Array.from(selectedIds).map(id => adminTransactions.update(id, { status }))
    );
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed > 0) toast.error(t("admin.finances.bulkFailed", { count: failed, defaultValue: "فشل {{count}} عمليات" }));
    else toast.success(t("admin.finances.bulkSuccess", { count: selectedIds.size, defaultValue: "تم تحديث {{count}} عمليات" }));
    setSelectedIds(new Set());
    setBulkLoading(false);
    fetchData();
  };

  const getTypeLabel = (type: string) => { const opt = TX_TYPE_OPTIONS.find((o) => o.value === type); return opt ? t(opt.labelKey) : type; };
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
        <a
          href={adminExports.transactionsCsvUrl({ startDate: startDate || undefined, endDate: endDate || undefined, type: filters.type || undefined })}
          download
          className="flex items-center gap-1.5 px-3 h-8 text-xs font-bold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors ms-auto"
        >
          <Download className="w-3 h-3" /> {t("admin.finances.exportCsv", "تصدير CSV")}
        </a>
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
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.startDate", "من تاريخ")}</label>
            <input type="date" className="bg-white/5 border border-white/10 rounded-lg h-8 px-2.5 text-xs text-white/70 focus:outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">{t("admin.finances.endDate", "إلى تاريخ")}</label>
            <input type="date" className="bg-white/5 border border-white/10 rounded-lg h-8 px-2.5 text-xs text-white/70 focus:outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {(filters.type || filters.status || startDate || endDate) && (
            <div className="flex items-end">
              <button
                onClick={() => { setFilters({ type: "", status: "" }); setStartDate(""); setEndDate(""); setPagination((p) => ({ ...p, page: 1 })); }}
                className="flex items-center gap-1 px-3 h-9 text-xs text-white/40 hover:text-white/60 rounded-lg bg-white/5 border border-white/10 transition-colors"
              >
                <X className="w-3 h-3" /> {t("admin.finances.clearFilters")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-xs text-white/60">{t("admin.finances.selectedCount", { count: selectedIds.size, defaultValue: "{{count}} محدد" })}</span>
          <button
            onClick={() => handleBulkAction("completed")}
            disabled={bulkLoading}
            className="flex items-center gap-1 px-2.5 h-7 text-[11px] font-bold rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            {t("admin.finances.approveAll", "قبول الكل")}
          </button>
          <button
            onClick={() => handleBulkAction("rejected")}
            disabled={bulkLoading}
            className="flex items-center gap-1 px-2.5 h-7 text-[11px] font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            {t("admin.finances.rejectAll", "رفض الكل")}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ms-auto text-xs text-white/40 hover:text-white/60">
            {t("admin.finances.clearSelection", "إلغاء التحديد")}
          </button>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-2 px-2 w-8">
                  <input type="checkbox" className="accent-primary w-3.5 h-3.5" checked={pendingTxIds.length > 0 && selectedIds.size === pendingTxIds.length} onChange={toggleSelectAll} disabled={pendingTxIds.length === 0} />
                </th>
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
                <tr><td colSpan={9} className="text-center py-10 text-white/20">{t("admin.finances.noTransactions")}</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer ${tx.status === "pending" ? "bg-yellow-400/[0.02]" : ""}`}
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td className="py-2 px-2 w-8" onClick={(e) => e.stopPropagation()}>
                      {tx.status === "pending" && (
                        <input type="checkbox" className="accent-primary w-3.5 h-3.5" checked={selectedIds.has(tx.id)} onChange={() => toggleSelect(tx.id)} />
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {sharedGetTypeIcon(tx.type)}
                        <span className="text-xs text-white/60">{getTypeLabel(tx.type)}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs font-bold text-white">@{txName(tx)}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-sm font-bold ${tx.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                        {tx.amount < 0 ? "-" : "+"}{Math.abs(tx.amount).toLocaleString()}
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
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${sharedGetStatusStyle(tx.status)}`}>
                        {tx.status === "pending" && <Clock className="w-2.5 h-2.5" />}
                        {tx.status === "completed" && <CheckCircle className="w-2.5 h-2.5" />}
                        {tx.status === "rejected" && <XCircle className="w-2.5 h-2.5" />}
                        {getStatusLabel(tx.status)}
                      </span>
                    </td>
                    <td className="py-2 px-3 hidden xl:table-cell">
                      <span className="text-xs text-white/30">{new Date(tx.createdAt).toLocaleString(i18n.language)}</span>
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
            getTypeIcon={sharedGetTypeIcon}
            getTypeLabel={getTypeLabel}
            getStatusStyle={sharedGetStatusStyle}
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
  const { t, i18n } = useTranslation();
  useEscapeKey(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>();
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
        ref={trapRef}
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
            <span className="text-xs text-white/30">{new Date(tx.createdAt).toLocaleString(i18n.language)}</span>
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
              {t("admin.finances.reviewedAt", { date: new Date(tx.reviewedAt).toLocaleString(i18n.language) })}
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
