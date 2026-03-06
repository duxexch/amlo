/**
 * Admin Chat — Calls Tab (المكالمات)
 * ════════════════════════════════════════
 */
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Phone, Video, Mic, RefreshCw, PhoneOff } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { EmptyState, PaginationNav, formatDuration, formatDate } from "./AdminChatShared";
import type { AdminCall, Pagination } from "../../chat/chatTypes";

export function CallsTab() {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<AdminCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const loadCalls = useCallback(() => {
    setLoading(true);
    adminChatManagement.getCalls(page, 20, typeFilter, statusFilter)
      .then(res => {
        if (res.success) { setCalls(res.data); setPagination(res.pagination ?? null); }
      })
      .finally(() => setLoading(false));
  }, [page, typeFilter, statusFilter]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const forceEnd = async (id: string) => {
    await adminChatManagement.forceEndCall(id);
    setCalls(prev => prev.map(c => c.id === id ? { ...c, status: "ended" } : c));
  };

  const statusColors: Record<string, string> = {
    ended: "bg-white/10 text-white/60",
    active: "bg-green-500/20 text-green-400",
    missed: "bg-yellow-500/20 text-yellow-400",
    rejected: "bg-red-500/20 text-red-400",
    busy: "bg-orange-500/20 text-orange-400",
    ringing: "bg-blue-500/20 text-blue-400",
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {[{ v: "", l: t("admin.chatManagement.all") }, { v: "voice", l: `🎤 ${t("admin.chatManagement.voice")}` }, { v: "video", l: `📹 ${t("admin.chatManagement.video")}` }].map(f => (
            <button key={f.v} onClick={() => { setTypeFilter(f.v); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${typeFilter === f.v ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"}`}>
              {f.l}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-white/10" />
        <div className="flex gap-2">
          {[{ v: "", l: t("admin.chatManagement.allStatuses") }, { v: "active", l: t("admin.chatManagement.active") }, { v: "ended", l: t("admin.chatManagement.ended") }, { v: "missed", l: t("admin.chatManagement.missed") }].map(f => (
            <button key={f.v} onClick={() => { setStatusFilter(f.v); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${statusFilter === f.v ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"}`}>
              {f.l}
            </button>
          ))}
        </div>
        <button onClick={loadCalls} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors ms-auto">
          <RefreshCw className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Calls Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-white/50 text-sm border-b border-white/10">
                <th className="text-start p-4">{t("admin.chatManagement.caller")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.receiver")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.type")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.status")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.duration")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.charged")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.date")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="p-4"><div className="bg-white/5 rounded h-8 animate-pulse" /></td></tr>
                ))
              ) : calls.length === 0 ? (
                <tr><td colSpan={8}><EmptyState message={t("admin.chatManagement.noCalls")} icon={Phone} /></td></tr>
              ) : (
                calls.map((call) => (
                  <tr key={call.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">
                          {(call.caller?.displayName || "?").charAt(0)}
                        </div>
                        <span className="text-white/80 text-sm">{call.caller?.displayName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold">
                          {(call.receiver?.displayName || "?").charAt(0)}
                        </div>
                        <span className="text-white/80 text-sm">{call.receiver?.displayName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-lg ${call.type === "video" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"}`}>
                        {call.type === "video" ? <><Video className="w-3 h-3 inline me-1" />{t("admin.chatManagement.video")}</> : <><Mic className="w-3 h-3 inline me-1" />{t("admin.chatManagement.voice")}</>}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-lg ${statusColors[call.status] || "bg-white/10 text-white/60"}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="p-4 text-white/60 text-sm font-mono">{formatDuration(call.durationSeconds)}</td>
                    <td className="p-4 text-yellow-400 text-sm">{call.coinsCharged > 0 ? `${call.coinsCharged} 🪙` : "—"}</td>
                    <td className="p-4 text-white/40 text-xs">{formatDate(call.createdAt)}</td>
                    <td className="p-4">
                      {call.status === "active" && (
                        <button onClick={() => forceEnd(call.id)} className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors">
                          <PhoneOff className="w-3 h-3" /> {t("admin.chatManagement.forceEnd")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationNav page={page} totalPages={pagination?.totalPages || 0} onPageChange={setPage} />
      </div>
    </div>
  );
}
