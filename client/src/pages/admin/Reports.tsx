import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Flag, AlertTriangle, CheckCircle, XCircle, Clock,
  ChevronRight, ChevronLeft, MessageSquare, Eye,
} from "lucide-react";
import { adminReports } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";

interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  type: string;
  reason: string;
  status: string;
  adminNotes: string;
  createdAt: string;
  reviewedAt: string;
}

const STATUS_TABS = [
  { value: "", labelKey: "admin.reports.all", icon: Flag },
  { value: "pending", labelKey: "admin.reports.pending", icon: Clock },
  { value: "reviewed", labelKey: "admin.reports.reviewed", icon: Eye },
  { value: "resolved", labelKey: "admin.reports.resolved", icon: CheckCircle },
  { value: "dismissed", labelKey: "admin.reports.dismissed", icon: XCircle },
];

const TYPE_LABEL_KEYS: Record<string, string> = {
  harassment: "admin.reports.typeHarassment",
  spam: "admin.reports.typeSpam",
  inappropriate: "admin.reports.typeInappropriate",
  scam: "admin.reports.typeScam",
  other: "admin.reports.typeOther",
};

export function ReportsPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter) params.status = statusFilter;
      const res = await adminReports.list(params);
      if (res.success) {
        setReports(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateStatus = async (id: string, status: string, adminNotes?: string) => {
    setUpdatingId(id);
    try {
      await adminReports.update(id, { status, adminNotes });
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, status, adminNotes: adminNotes || r.adminNotes } : r));
    } catch (e) { console.error(e); }
    finally { setUpdatingId(null); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return { className: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", label: t("admin.reports.pending"), icon: Clock };
      case "reviewed": return { className: "bg-blue-400/10 text-blue-400 border-blue-400/20", label: t("admin.reports.reviewed"), icon: Eye };
      case "resolved": return { className: "bg-green-400/10 text-green-400 border-green-400/20", label: t("admin.reports.resolved"), icon: CheckCircle };
      case "dismissed": return { className: "bg-white/5 text-white/30 border-white/10", label: t("admin.reports.dismissed"), icon: XCircle };
      default: return { className: "bg-white/5 text-white/30 border-white/10", label: status, icon: Flag };
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "harassment": return "bg-red-500/10 text-red-400";
      case "spam": return "bg-orange-400/10 text-orange-400";
      case "inappropriate": return "bg-pink-400/10 text-pink-400";
      case "scam": return "bg-purple-400/10 text-purple-400";
      default: return "bg-white/5 text-white/40";
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Outfit" }}>{t("admin.reports.title")}</h1>
        <p className="text-white/40 text-sm mt-1">{t("admin.reports.reportCount", { count: pagination.total })}</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-xl overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPagination((p) => ({ ...p, page: 1 })); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${statusFilter === tab.value ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white/60"}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-32 animate-pulse" />
          ))
        ) : reports.length === 0 ? (
          <div className="text-center py-20 text-white/20">{t("admin.reports.noReports")}</div>
        ) : (
          reports.map((report, i) => {
            const badge = getStatusBadge(report.status);
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Left: Report Info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${badge.className}`}>{badge.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${getTypeBadge(report.type)}`}>{t(TYPE_LABEL_KEYS[report.type]) || report.type}</span>
                      <span className="text-[10px] text-white/20">{new Date(report.createdAt).toLocaleString("ar-EG")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/40">{t("admin.reports.reporterCol")}:</span>
                      <span className="text-white font-bold">{report.reporterName || t("common.unknown")}</span>
                      <span className="text-white/20">→</span>
                      <span className="text-white/40">{t("admin.reports.reportedCol")}:</span>
                      <span className="text-red-400 font-bold">{report.reportedName || t("common.unknown")}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-white/20 mt-0.5 shrink-0" />
                        <p className="text-xs text-white/50 leading-relaxed">{report.reason}</p>
                      </div>
                    </div>
                    {report.adminNotes && (
                      <p className="text-[11px] text-primary/70 pr-5">
                        {t("admin.reports.adminNotes")}: {report.adminNotes}
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  {report.status === "pending" && (
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleUpdateStatus(report.id, "resolved", t("admin.reports.resolved"))}
                        disabled={updatingId === report.id}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3" /> {t("admin.reports.resolve")}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(report.id, "reviewed", t("admin.reports.reviewed"))}
                        disabled={updatingId === report.id}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                      >
                        <Eye className="w-3 h-3" /> {t("admin.reports.review")}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(report.id, "dismissed", t("admin.reports.dismissed"))}
                        disabled={updatingId === report.id}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-bold hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> {t("admin.reports.dismiss")}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">{t("admin.finances.pageOf", { page: pagination.page, total: pagination.totalPages })}</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
