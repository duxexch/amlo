/**
 * Admin Chat — Messages Tab (الرسائل)
 * ════════════════════════════════════════
 */
import { useEffect, useState, useCallback } from "react";
import { Search, Trash2, MessageSquare } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { EmptyState, PaginationNav, useConfirmDialog, useDebouncedValue, formatDate } from "./AdminChatShared";
import type { AdminMessage, Pagination } from "../../chat/chatTypes";

export function MessagesTab() {
  const { t } = useTranslation();
  const [msgs, setMsgs] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { confirm, dialog } = useConfirmDialog();

  const loadMessages = useCallback(() => {
    setLoading(true);
    adminChatManagement.getMessages(page, 30, debouncedSearch, typeFilter)
      .then(res => {
        if (res.success) { setMsgs(res.data); setPagination(res.pagination ?? null); }
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, typeFilter]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    const ok = await confirm(
      t("admin.chatManagement.confirmBulkDelete", { count: selected.size }),
      t("admin.chatManagement.bulkDeleteDesc", "سيتم حذف الرسائل المحددة نهائياً")
    );
    if (!ok) return;
    const ids: string[] = [];
    selected.forEach(id => ids.push(id));
    await adminChatManagement.bulkDeleteMessages(ids);
    setMsgs(prev => prev.filter(m => !selected.has(m.id)));
    setSelected(new Set());
  };

  const msgTypes = [
    { value: "", label: t("admin.chatManagement.allTypes") },
    { value: "text", label: t("admin.chatManagement.textMsg") },
    { value: "image", label: t("admin.chatManagement.imageMsg") },
    { value: "voice", label: t("admin.chatManagement.voiceMsg") },
    { value: "gift", label: t("admin.chatManagement.giftMsg") },
  ];

  return (
    <div className="space-y-4">
      {dialog}
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder={t("admin.chatManagement.searchMessages")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 ps-10 pe-4 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-2">
          {msgTypes.map(mt => (
            <button
              key={mt.value}
              onClick={() => { setTypeFilter(mt.value); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${typeFilter === mt.value ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"}`}
            >
              {mt.label}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <button onClick={bulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-colors">
            <Trash2 className="w-4 h-4" />
            {t("admin.chatManagement.deleteSelected")} ({selected.size})
          </button>
        )}
      </div>

      {/* Messages Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-white/50 text-sm border-b border-white/10">
                <th className="text-start p-4 w-10">
                  <input type="checkbox" className="accent-purple-500" onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(msgs.map(m => m.id)));
                    else setSelected(new Set());
                  }} />
                </th>
                <th className="text-start p-4">{t("admin.chatManagement.sender")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.content")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.type")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.cost")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.date")}</th>
                <th className="text-start p-4">{t("admin.chatManagement.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="p-4"><div className="bg-white/5 rounded h-8 animate-pulse" /></td></tr>
                ))
              ) : msgs.length === 0 ? (
                <tr><td colSpan={7}><EmptyState message={t("admin.chatManagement.noMessages")} icon={MessageSquare} /></td></tr>
              ) : (
                msgs.map((msg) => (
                  <tr key={msg.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <input type="checkbox" checked={selected.has(msg.id)} onChange={() => toggleSelect(msg.id)} className="accent-purple-500" />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                          {(msg.senderName || "?").charAt(0)}
                        </div>
                        <span className="text-white/80 text-sm">{msg.senderName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-white/60 text-sm max-w-[200px] truncate">{msg.content}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-lg ${
                        msg.type === "text" ? "bg-blue-500/15 text-blue-400" :
                        msg.type === "image" ? "bg-green-500/15 text-green-400" :
                        msg.type === "voice" ? "bg-purple-500/15 text-purple-400" :
                        "bg-yellow-500/15 text-yellow-400"
                      }`}>
                        {msg.type === "text" ? "💬" : msg.type === "image" ? "📷" : msg.type === "voice" ? "🎤" : "🎁"} {msg.type}
                      </span>
                    </td>
                    <td className="p-4 text-yellow-400 text-sm">{msg.coinsCost > 0 ? `${msg.coinsCost} 🪙` : "—"}</td>
                    <td className="p-4 text-white/40 text-xs">{formatDate(msg.createdAt)}</td>
                    <td className="p-4">
                      <button
                        onClick={() => { adminChatManagement.deleteMessage(msg.id); setMsgs(prev => prev.filter(m => m.id !== msg.id)); }}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
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
