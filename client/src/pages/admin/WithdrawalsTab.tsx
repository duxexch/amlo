import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CheckCircle, XCircle, Eye, ChevronRight, ChevronLeft,
  Loader2, X, Download, CalendarDays, AlertTriangle,
} from "lucide-react";
import { adminWithdrawals, adminExports, adminAdjustments } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { WithdrawalRequest, BalanceAdjustment } from "./financeTypes";
import { WR_STATUS_OPTIONS } from "./financeTypes";

// ════════════════════════════════════════════════════════════
// WITHDRAWALS TAB — طلبات السحب
// ════════════════════════════════════════════════════════════

export function WithdrawalsTab({ search, showFilters, refreshSignal = 0 }: { search: string; showFilters: boolean; refreshSignal?: number }) {
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedWr, setSelectedWr] = useState<WithdrawalRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: "completed" | "rejected" | "processing"; amount: number } | null>(null);
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([]);

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
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
    setLoading(false);
  }, [pagination.page, pagination.limit, statusFilter, search, startDate, endDate]);

  useEffect(() => { loadRequests(); }, [loadRequests, refreshSignal]);
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
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
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
    } catch { setAdjustments([]); toast.error(t("common.networkError", "خطأ في الاتصال")); }
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
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${statusFilter === opt.value ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
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
                      {WR_STATUS_OPTIONS.find(o => o.value === wr.status)?.labelKey ? t(WR_STATUS_OPTIONS.find(o => o.value === wr.status)!.labelKey) : wr.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white/40">{new Date(wr.createdAt).toLocaleDateString(i18n.language)}</td>
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
                  <p className="text-xs text-white/40">{t("admin.finances.confirmLargeAmount", { amount: confirmAction.amount.toLocaleString(), defaultValue: "هل أنت متأكد من الموافقة على سحب {{amount}} عملة؟" })}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(confirmAction.id, confirmAction.status)}
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
                <div className="flex justify-between"><span className="text-white/40">{t("admin.finances.txStatus")}:</span> <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(selectedWr.status)}`}>{WR_STATUS_OPTIONS.find(o => o.value === selectedWr.status)?.labelKey ? t(WR_STATUS_OPTIONS.find(o => o.value === selectedWr.status)!.labelKey) : selectedWr.status}</span></div>
                {selectedWr.paymentDetails && (
                  <div>
                    <span className="text-white/40 block mb-1">{t("admin.finances.wrPaymentDetails")}:</span>
                    <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
                      {(() => {
                        try {
                          const details = typeof selectedWr.paymentDetails === "string"
                            ? JSON.parse(selectedWr.paymentDetails)
                            : selectedWr.paymentDetails;
                          if (typeof details === "object" && details !== null) {
                            const labels: Record<string, string> = {
                              bankName: t("wallet.bankName", "البنك"),
                              accountNumber: t("wallet.accountNumber", "رقم الحساب"),
                              accountHolder: t("wallet.accountHolder", "صاحب الحساب"),
                              paypalEmail: t("wallet.paypalEmail", "بريد PayPal"),
                              network: t("wallet.usdtNetwork", "الشبكة"),
                              walletAddress: t("wallet.usdtAddress", "عنوان المحفظة"),
                            };
                            return Object.entries(details).map(([key, val]) => (
                              <div key={key} className="flex justify-between items-center">
                                <span className="text-white/40 text-xs">{labels[key] || key}:</span>
                                <span className="text-white/80 text-xs font-medium break-all max-w-[60%] text-end">{String(val)}</span>
                              </div>
                            ));
                          }
                          return <span className="text-white/70 text-xs break-all">{String(details)}</span>;
                        } catch {
                          return <span className="text-white/70 text-xs break-all">{String(selectedWr.paymentDetails)}</span>;
                        }
                      })()}
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
                        <span className="text-white/20">{new Date(adj.createdAt).toLocaleDateString(i18n.language)}</span>
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
