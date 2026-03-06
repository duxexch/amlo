/**
 * Admin Chat — Reports Tab (البلاغات)
 * ════════════════════════════════════════
 */
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Flag, AlertTriangle, Eye, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { StatCard, LoadingSkeleton, EmptyState, formatDate } from "./AdminChatShared";
import type { MessageReport, ReportStats } from "../../chat/chatTypes";

export function ReportsTab() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [reportStats, setReportStats] = useState<ReportStats | null>(null);
  const [reportFilter, setReportFilter] = useState("all");
  const [reportPage, setReportPage] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, reportsRes] = await Promise.all([
        adminChatManagement.getMessageReportStats(),
        adminChatManagement.getMessageReports(reportPage, reportFilter),
      ]);
      setReportStats(statsRes.data || statsRes);
      setReports(reportsRes.data || []);
      setReportTotal(reportsRes.pagination?.total || 0);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [reportPage, reportFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdateReport = async (id: string, status: string) => {
    setUpdatingReportId(id);
    try {
      await adminChatManagement.updateMessageReport(id, status);
      loadData();
    } catch (err) { console.error(err); }
    setUpdatingReportId(null);
  };

  const statusColors: Record<string, string> = {
    pending: "text-amber-400 bg-amber-400/10",
    reviewed: "text-blue-400 bg-blue-400/10",
    resolved: "text-emerald-400 bg-emerald-400/10",
    dismissed: "text-white/40 bg-white/5",
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Report Stats */}
      {reportStats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label={t("admin.chats.pendingReports")} value={reportStats.pending || 0} icon={AlertTriangle} color="text-amber-400" bg="bg-amber-400/10 border-amber-400/20" />
          <StatCard label={t("admin.chats.reviewedReports")} value={reportStats.reviewed || 0} icon={Eye} color="text-blue-400" bg="bg-blue-400/10 border-blue-400/20" />
          <StatCard label={t("admin.chats.resolvedReports")} value={reportStats.resolved || 0} icon={CheckCircle2} color="text-emerald-400" bg="bg-emerald-400/10 border-emerald-400/20" />
          <StatCard label={t("admin.chats.dismissedReports")} value={reportStats.dismissed || 0} icon={XCircle} color="text-white/40" bg="bg-white/5 border-white/10" />
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "pending", "reviewed", "resolved", "dismissed"].map(st => (
          <button
            key={st}
            onClick={() => { setReportFilter(st); setReportPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              reportFilter === st
                ? "bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-purple-500/30"
                : "text-white/40 hover:text-white bg-white/5 border border-transparent"
            }`}
          >
            {t(`admin.chats.status_${st}`)}
          </button>
        ))}
      </div>

      {/* Reports list */}
      {reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map(report => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <Flag className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {t("admin.chats.reportBy")}: {report.reporter?.displayName || report.reporter?.username || report.reporterId}
                    </p>
                    <p className="text-white/30 text-[11px]">
                      {t("admin.chats.against")}: {report.reportedUser?.displayName || report.reportedUser?.username || report.reportedUserId}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 ${statusColors[report.status] || "text-white/40 bg-white/5"}`}>
                  {t(`admin.chats.status_${report.status}`)}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-medium">{report.category}</span>
                <span className="text-white/20 text-[10px]">{formatDate(report.createdAt)}</span>
              </div>

              {report.messageContent && (
                <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                  <p className="text-white/50 text-xs truncate">{report.messageContent}</p>
                </div>
              )}

              {report.reason && (
                <p className="text-white/30 text-xs">{t("admin.chats.reason")}: {report.reason}</p>
              )}

              {report.status === "pending" && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleUpdateReport(report.id, "resolved")}
                    disabled={updatingReportId === report.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {updatingReportId === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    {t("admin.chats.resolve")}
                  </button>
                  <button
                    onClick={() => handleUpdateReport(report.id, "reviewed")}
                    disabled={updatingReportId === report.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    <Eye className="w-3 h-3" />
                    {t("admin.chats.review")}
                  </button>
                  <button
                    onClick={() => handleUpdateReport(report.id, "dismissed")}
                    disabled={updatingReportId === report.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/40 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" />
                    {t("admin.chats.dismiss")}
                  </button>
                </div>
              )}
            </motion.div>
          ))}

          {reportTotal > 20 && (
            <div className="flex justify-center gap-2 pt-4">
              <button onClick={() => setReportPage(p => Math.max(1, p - 1))} disabled={reportPage <= 1} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30">{t("common.previous")}</button>
              <span className="px-3 py-1.5 text-xs text-white/30">{reportPage}</span>
              <button onClick={() => setReportPage(p => p + 1)} disabled={reports.length < 20} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30">{t("common.next")}</button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState message={t("admin.chats.noReports")} icon={Flag} />
      )}
    </div>
  );
}
