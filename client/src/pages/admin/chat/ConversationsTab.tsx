/**
 * Admin Chat — Conversations Tab (المحادثات)
 * ════════════════════════════════════════
 */
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Trash2, Eye, MessageSquare, RefreshCw } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { LoadingSkeleton, EmptyState, PaginationNav, useConfirmDialog, useDebouncedValue, formatDate, formatTime } from "./AdminChatShared";
import type { AdminConversation, AdminMessage, Pagination } from "../../chat/chatTypes";

export function ConversationsTab() {
  const { t } = useTranslation();
  const [convs, setConvs] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const loadConvs = useCallback(() => {
    setLoading(true);
    adminChatManagement.getConversations(page, 20, debouncedSearch)
      .then(res => {
        if (res.success) { setConvs(res.data); setPagination(res.pagination ?? null); }
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  const openConv = (id: string) => {
    setSelectedConv(id);
    setMsgLoading(true);
    adminChatManagement.getConversationMessages(id)
      .then(res => { if (res.success) setMessages(res.data); })
      .finally(() => setMsgLoading(false));
  };

  const deleteConv = async (id: string) => {
    const ok = await confirm(t("admin.chatManagement.confirmDelete"), t("admin.chatManagement.deleteConversationDesc", "سيتم حذف المحادثة وجميع رسائلها نهائياً"));
    if (!ok) return;
    await adminChatManagement.deleteConversation(id);
    setConvs(prev => prev.filter(c => c.id !== id));
    if (selectedConv === id) { setSelectedConv(null); setMessages([]); }
  };

  return (
    <div className="space-y-4">
      {dialog}
      {/* Search Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder={t("admin.chatManagement.searchConversations")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 ps-10 pe-4 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
          />
        </div>
        <button onClick={loadConvs} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
          <RefreshCw className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Conversations List */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">{t("admin.chatManagement.conversations")} ({pagination?.total || 0})</h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-white/5 rounded-xl h-16 animate-pulse" />)}
              </div>
            ) : convs.length === 0 ? (
              <EmptyState message={t("admin.chatManagement.noConversations")} icon={MessageSquare} />
            ) : (
              convs.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedConv === conv.id ? "bg-purple-500/10 border-s-2 border-s-purple-500" : ""}`}
                  onClick={() => openConv(conv.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex -space-x-2 rtl:space-x-reverse">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#0a0a1a]">
                        {(conv.participant1?.displayName || "?").charAt(0)}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#0a0a1a]">
                        {(conv.participant2?.displayName || "?").charAt(0)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {conv.participant1?.displayName} ↔ {conv.participant2?.displayName}
                      </p>
                      <p className="text-white/40 text-xs">{conv.messageCount} {t("admin.chatManagement.messagesLabel")} • {conv.lastMessageAt ? formatDate(conv.lastMessageAt) : "—"}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
          <PaginationNav page={page} totalPages={pagination?.totalPages || 0} onPageChange={setPage} />
        </div>

        {/* Messages Panel */}
        <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">{t("admin.chatManagement.conversationMessages")}</h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
            {!selectedConv ? (
              <EmptyState message={t("admin.chatManagement.selectConversation")} icon={Eye} />
            ) : msgLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-white/5 rounded-xl h-12 animate-pulse" />)}
              </div>
            ) : messages.length === 0 ? (
              <EmptyState message={t("admin.chatManagement.noMessages")} icon={MessageSquare} />
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-3 bg-white/5 rounded-xl group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(msg.senderName || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 text-sm font-medium">{msg.senderName}</span>
                      <span className="text-white/30 text-xs">{formatTime(msg.createdAt)}</span>
                      {msg.type !== "text" && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${msg.type === "image" ? "bg-green-500/20 text-green-400" : msg.type === "voice" ? "bg-purple-500/20 text-purple-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {msg.type === "image" ? "📷" : msg.type === "voice" ? "🎤" : "🎁"} {msg.type}
                        </span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm mt-1">{msg.isDeleted ? <span className="italic text-red-400/50">({t("admin.chatManagement.deleted")})</span> : msg.content}</p>
                  </div>
                  <button
                    onClick={() => { adminChatManagement.deleteMessage(msg.id); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isDeleted: true } : m)); }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
