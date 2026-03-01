/**
 * Admin Chat & Broadcast Management Page
 * ════════════════════════════════════════
 * 7-tab professional admin section for managing
 * conversations, messages, calls, live streams, moderation, and settings.
 */
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Phone, Video, Radio, Shield, Settings, BarChart3,
  Search, Trash2, Eye, Ban, Filter, RefreshCw, Download, ChevronDown,
  Users, DollarSign, TrendingUp, Clock, Mic, Image, Gift,
  AlertTriangle, X, Plus, Play, Square, Volume2, VolumeX,
  PhoneCall, PhoneOff, MonitorPlay, Wifi, WifiOff, Send,
  Flag, CheckCircle2, XCircle, Loader2, Unlock, ToggleLeft, ToggleRight,
  Coins, Image as ImageIcon,
} from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ════════════════════════════════════════════════════════
// Shared Components
// ════════════════════════════════════════════════════════

function StatCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; bg: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 ${bg}`}
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className={`w-6 h-6 ${color}`} />
        <span className={`text-xs font-medium ${color}`}>{sub}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="bg-white/5 rounded-2xl h-32" />)}
      </div>
      <div className="bg-white/5 rounded-2xl h-80" />
    </div>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/30">
      <Icon className="w-16 h-16 mb-4" />
      <p className="text-lg">{message}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 1: Overview (نظرة عامة)
// ════════════════════════════════════════════════════════

function OverviewTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [topChatters, setTopChatters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminChatManagement.getStats(),
      adminChatManagement.getTrends(),
      adminChatManagement.getTopChatters(),
    ]).then(([statsRes, trendsRes, chattersRes]) => {
      if (statsRes.success) setStats(statsRes.data);
      if (trendsRes.success) setTrends(trendsRes.data);
      if (chattersRes.success) setTopChatters(chattersRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!stats) return <EmptyState message={t("admin.chatManagement.noData")} icon={BarChart3} />;

  const statsCards = [
    { label: t("admin.chatManagement.totalConversations"), value: stats.totalConversations?.toLocaleString(), icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", sub: `${stats.activeChatsNow} ${t("admin.chatManagement.activeNow")}` },
    { label: t("admin.chatManagement.totalMessages"), value: stats.totalMessages?.toLocaleString(), icon: Send, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", sub: `${stats.messagesToday} ${t("admin.chatManagement.today")}` },
    { label: t("admin.chatManagement.totalCalls"), value: stats.totalCalls?.toLocaleString(), icon: Phone, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20", sub: `${stats.activeCallsNow} ${t("admin.chatManagement.activeNow")}` },
    { label: t("admin.chatManagement.totalRevenue"), value: `${((stats.totalCallRevenue || 0) + (stats.totalMessageRevenue || 0)).toLocaleString()} 🪙`, icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", sub: `${t("admin.chatManagement.today")}: ${((stats.callRevenueToday || 0) + (stats.messageRevenueToday || 0)).toLocaleString()}` },
    { label: t("admin.chatManagement.onlineUsers"), value: stats.onlineUsers?.toLocaleString(), icon: Users, color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/20", sub: t("admin.chatManagement.liveNow") },
    { label: t("admin.chatManagement.voiceCalls"), value: stats.voiceCalls?.toLocaleString(), icon: Mic, color: "text-indigo-400", bg: "bg-indigo-400/10 border-indigo-400/20", sub: `${stats.videoCalls} ${t("admin.chatManagement.videoCalls")}` },
    { label: t("admin.chatManagement.avgCallDuration"), value: `${Math.floor((stats.avgCallDuration || 0) / 60)}:${String((stats.avgCallDuration || 0) % 60).padStart(2, "0")}`, icon: Clock, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20", sub: t("admin.chatManagement.minutes") },
    { label: t("admin.chatManagement.avgMsgPerConv"), value: stats.avgMessagesPerConv?.toLocaleString(), icon: TrendingUp, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20", sub: t("admin.chatManagement.average") },
  ];

  // Message type distribution for pie chart
  const msgTypeData = [
    { name: t("admin.chatManagement.textMsg"), value: stats.textMessages || 0, color: "#60a5fa" },
    { name: t("admin.chatManagement.imageMsg"), value: stats.imageMessages || 0, color: "#34d399" },
    { name: t("admin.chatManagement.voiceMsg"), value: stats.voiceMessages || 0, color: "#a78bfa" },
    { name: t("admin.chatManagement.giftMsg"), value: stats.giftMessages || 0, color: "#fbbf24" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trends Chart */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">{t("admin.chatManagement.activityTrend")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                labelStyle={{ color: "#fff" }}
              />
              <Area type="monotone" dataKey="messages" stroke="#60a5fa" fill="rgba(96,165,250,0.15)" name={t("admin.chatManagement.messages")} />
              <Area type="monotone" dataKey="calls" stroke="#a78bfa" fill="rgba(167,139,250,0.15)" name={t("admin.chatManagement.calls")} />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Message Types Pie */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">{t("admin.chatManagement.messageTypes")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={msgTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {msgTypeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
              <Legend formatter={(value: string) => <span className="text-white/70 text-xs">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">{t("admin.chatManagement.dailyRevenue")}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Bar dataKey="revenue" fill="#fbbf24" radius={[6, 6, 0, 0]} name={t("admin.chatManagement.revenue")} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Chatters */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">{t("admin.chatManagement.topChatters")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-white/50 text-sm border-b border-white/10">
                <th className="text-start pb-3 pe-4">#</th>
                <th className="text-start pb-3 pe-4">{t("admin.chatManagement.user")}</th>
                <th className="text-start pb-3 pe-4">{t("admin.chatManagement.messagesCount")}</th>
                <th className="text-start pb-3 pe-4">{t("admin.chatManagement.callsCount")}</th>
                <th className="text-start pb-3">{t("admin.chatManagement.totalSpent")}</th>
              </tr>
            </thead>
            <tbody>
              {topChatters.map((u: any, i: number) => (
                <tr key={u.userId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 pe-4 text-white/40">{i + 1}</td>
                  <td className="py-3 pe-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        {(u.displayName || "?").charAt(0)}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{u.displayName}</p>
                        <p className="text-white/40 text-xs">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pe-4 text-white/80">{u.messageCount?.toLocaleString()}</td>
                  <td className="py-3 pe-4 text-white/80">{u.callCount?.toLocaleString()}</td>
                  <td className="py-3 text-yellow-400">{u.totalSpent?.toLocaleString()} 🪙</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 2: Conversations (المحادثات)
// ════════════════════════════════════════════════════════

function ConversationsTab() {
  const { t } = useTranslation();
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const loadConvs = useCallback(() => {
    setLoading(true);
    adminChatManagement.getConversations(page, 20, search)
      .then(res => {
        if (res.success) { setConvs(res.data); setPagination(res.pagination); }
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  const openConv = (id: string) => {
    setSelectedConv(id);
    setMsgLoading(true);
    adminChatManagement.getConversationMessages(id)
      .then(res => { if (res.success) setMessages(res.data); })
      .finally(() => setMsgLoading(false));
  };

  const deleteConv = async (id: string) => {
    if (!confirm(t("admin.chatManagement.confirmDelete"))) return;
    await adminChatManagement.deleteConversation(id);
    setConvs(prev => prev.filter(c => c.id !== id));
    if (selectedConv === id) { setSelectedConv(null); setMessages([]); }
  };

  return (
    <div className="space-y-4">
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
              convs.map((conv: any) => (
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
                      <p className="text-white/40 text-xs">{conv.messageCount} {t("admin.chatManagement.messagesLabel")} • {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString("ar") : "—"}</p>
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
          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 border-t border-white/10">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">←</button>
              <span className="text-white/50 text-sm">{page} / {pagination.totalPages}</span>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">→</button>
            </div>
          )}
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
              messages.map((msg: any) => (
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
                      <span className="text-white/30 text-xs">{new Date(msg.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
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

// ════════════════════════════════════════════════════════
// Tab 3: Messages (الرسائل)
// ════════════════════════════════════════════════════════

function MessagesTab() {
  const { t } = useTranslation();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadMessages = useCallback(() => {
    setLoading(true);
    adminChatManagement.getMessages(page, 30, search, typeFilter)
      .then(res => {
        if (res.success) { setMsgs(res.data); setPagination(res.pagination); }
      })
      .finally(() => setLoading(false));
  }, [page, search, typeFilter]);

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
    if (!confirm(t("admin.chatManagement.confirmBulkDelete", { count: selected.size }))) return;
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
                msgs.map((msg: any) => (
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
                    <td className="p-4 text-white/40 text-xs">{new Date(msg.createdAt).toLocaleDateString("ar")}</td>
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
        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-white/10">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">←</button>
            <span className="text-white/50 text-sm">{page} / {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">→</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 4: Calls (المكالمات)
// ════════════════════════════════════════════════════════

function CallsTab() {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  const loadCalls = useCallback(() => {
    setLoading(true);
    adminChatManagement.getCalls(page, 20, typeFilter, statusFilter)
      .then(res => {
        if (res.success) { setCalls(res.data); setPagination(res.pagination); }
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

  const formatDuration = (sec: number) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
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
                calls.map((call: any) => (
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
                    <td className="p-4 text-white/40 text-xs">{new Date(call.createdAt).toLocaleDateString("ar")}</td>
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
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-white/10">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">←</button>
            <span className="text-white/50 text-sm">{page} / {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">→</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 5: Live Streams (البث المباشر)
// ════════════════════════════════════════════════════════

function LiveStreamsTab() {
  const { t } = useTranslation();
  const [streams, setStreams] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminChatManagement.getActiveStreams(),
      adminChatManagement.getStreamStats(),
    ]).then(([streamsRes, statsRes]) => {
      if (streamsRes.success) setStreams(streamsRes.data);
      if (statsRes.success) setStats(statsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const endStream = async (id: string) => {
    await adminChatManagement.forceEndStream(id);
    setStreams(prev => prev.map(s => s.id === id ? { ...s, status: "ended" } : s));
  };

  if (loading) return <LoadingSkeleton />;

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Stream Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label={t("admin.chatManagement.activeStreams")} value={stats.activeNow} icon={Radio} color="text-red-400" bg="bg-red-400/10 border-red-400/20" sub={`${t("admin.chatManagement.liveNow")}`} />
          <StatCard label={t("admin.chatManagement.totalViewers")} value={stats.totalViewers?.toLocaleString()} icon={Eye} color="text-blue-400" bg="bg-blue-400/10 border-blue-400/20" sub={`${t("admin.chatManagement.peak")}: ${stats.peakConcurrent}`} />
          <StatCard label={t("admin.chatManagement.todayStreams")} value={stats.totalToday} icon={MonitorPlay} color="text-green-400" bg="bg-green-400/10 border-green-400/20" sub={`${t("admin.chatManagement.avg")}: ${formatDuration(stats.avgDuration)}`} />
          <StatCard label={t("admin.chatManagement.todayGifts")} value={`${stats.totalRevenueToday?.toLocaleString()} 🪙`} icon={Gift} color="text-yellow-400" bg="bg-yellow-400/10 border-yellow-400/20" sub={`${stats.totalGiftsToday} ${t("admin.chatManagement.gifts")}`} />
        </div>
      )}

      {/* Categories */}
      {stats?.topCategories && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">{t("admin.chatManagement.topCategories")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.topCategories.map((cat: any, i: number) => {
              const colors = ["from-red-500 to-orange-500", "from-blue-500 to-cyan-500", "from-green-500 to-emerald-500", "from-purple-500 to-pink-500"];
              return (
                <div key={i} className="bg-white/5 rounded-xl p-4 text-center">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors[i % 4]} mx-auto mb-3 flex items-center justify-center text-white text-lg font-bold`}>
                    {cat.count}
                  </div>
                  <p className="text-white text-sm font-medium">{cat.name}</p>
                  <p className="text-white/40 text-xs mt-1">{cat.viewers?.toLocaleString()} {t("admin.chatManagement.viewers")}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Streams */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-400 animate-pulse" />
            {t("admin.chatManagement.activeStreams")}
          </h3>
          <span className="text-white/50 text-sm">{streams.filter(s => s.status === "live").length} {t("admin.chatManagement.liveNow")}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          {streams.map((stream: any) => (
            <motion.div
              key={stream.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl border p-4 ${stream.status === "live" ? "bg-gradient-to-br from-red-500/5 to-purple-500/5 border-red-500/20" : "bg-white/5 border-white/10 opacity-60"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {(stream.displayName || "?").charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{stream.displayName}</p>
                    <p className="text-white/40 text-xs">@{stream.username}</p>
                  </div>
                </div>
                {stream.status === "live" && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <p className="text-white/70 text-sm mb-3">{stream.title}</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center bg-white/5 rounded-lg py-2">
                  <p className="text-white font-semibold text-sm">{stream.viewers?.toLocaleString()}</p>
                  <p className="text-white/40 text-[10px]">{t("admin.chatManagement.viewers")}</p>
                </div>
                <div className="text-center bg-white/5 rounded-lg py-2">
                  <p className="text-white font-semibold text-sm">{stream.giftsReceived}</p>
                  <p className="text-white/40 text-[10px]">{t("admin.chatManagement.gifts")}</p>
                </div>
                <div className="text-center bg-white/5 rounded-lg py-2">
                  <p className="text-yellow-400 font-semibold text-sm">{stream.coinsEarned?.toLocaleString()}</p>
                  <p className="text-white/40 text-[10px]">🪙</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/30 text-xs">{formatDuration(stream.duration)}</span>
                {stream.status === "live" && (
                  <button onClick={() => endStream(stream.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors">
                    <Square className="w-3 h-3" /> {t("admin.chatManagement.stopStream")}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 6: Moderation (الحظر والرقابة)
// ════════════════════════════════════════════════════════

function ModerationTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<any>(null);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      adminChatManagement.getModerationSettings(),
      adminChatManagement.getBannedWords(),
    ]).then(([settingsRes, wordsRes]) => {
      if (settingsRes.success) setSettings(settingsRes.data);
      if (wordsRes.success && wordsRes.data) setBannedWords(wordsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const addWord = async () => {
    if (!newWord.trim()) return;
    const res = await adminChatManagement.addBannedWord(newWord.trim());
    if (res.success) { setBannedWords(res.data); setNewWord(""); }
  };

  const removeWord = async (word: string) => {
    const res = await adminChatManagement.removeBannedWord(word);
    if (res.success) setBannedWords(res.data);
  };

  const updateSetting = async (key: string, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    await adminChatManagement.updateModerationSettings({ [key]: value });
    setSaving(false);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Banned Words */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-400" />
          {t("admin.chatManagement.bannedWords")}
        </h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder={t("admin.chatManagement.addBannedWord")}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50"
          />
          <button onClick={addWord} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-colors">
            <Plus className="w-4 h-4" />
            {t("admin.chatManagement.add")}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {bannedWords.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm"
            >
              {word}
              <button onClick={() => removeWord(word)} className="hover:bg-red-500/30 rounded p-0.5 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </motion.span>
          ))}
          {bannedWords.length === 0 && <p className="text-white/30 text-sm">{t("admin.chatManagement.noBannedWords")}</p>}
        </div>
      </div>

      {/* Auto Moderation Settings */}
      {settings && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            {t("admin.chatManagement.autoModeration")}
            {saving && <span className="text-xs text-purple-400 animate-pulse">{t("admin.chatManagement.saving")}...</span>}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Toggle switches */}
            {[
              { key: "autoDelete", label: t("admin.chatManagement.autoDeleteBanned") },
              { key: "enableProfanityFilter", label: t("admin.chatManagement.profanityFilter") },
              { key: "enableSpamDetection", label: t("admin.chatManagement.spamDetection") },
              { key: "autoMuteSpammers", label: t("admin.chatManagement.autoMuteSpammers") },
              { key: "allowImages", label: t("admin.chatManagement.allowImages") },
              { key: "allowVoice", label: t("admin.chatManagement.allowVoice") },
              { key: "allowGifts", label: t("admin.chatManagement.allowGifts") },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/8 transition-colors">
                <span className="text-white/80 text-sm">{item.label}</span>
                <button
                  onClick={() => updateSetting(item.key, !settings[item.key])}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings[item.key] ? "bg-purple-500" : "bg-white/20"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings[item.key] ? "start-[22px]" : "start-0.5"}`} />
                </button>
              </label>
            ))}
          </div>

          {/* Numeric settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {[
              { key: "maxMessageLength", label: t("admin.chatManagement.maxMessageLength"), min: 50, max: 10000, step: 50 },
              { key: "maxMessagesPerMinute", label: t("admin.chatManagement.maxMsgPerMinute"), min: 1, max: 100, step: 1 },
              { key: "chatCooldown", label: t("admin.chatManagement.chatCooldown"), min: 0, max: 30, step: 1 },
              { key: "spamThreshold", label: t("admin.chatManagement.spamThreshold"), min: 1, max: 50, step: 1 },
              { key: "minLevelToChat", label: t("admin.chatManagement.minLevelChat"), min: 0, max: 50, step: 1 },
              { key: "minLevelToCall", label: t("admin.chatManagement.minLevelCall"), min: 0, max: 50, step: 1 },
              { key: "minLevelToStream", label: t("admin.chatManagement.minLevelStream"), min: 0, max: 50, step: 1 },
              { key: "maxCallDuration", label: t("admin.chatManagement.maxCallDuration"), min: 60, max: 14400, step: 60 },
              { key: "maxConcurrentStreams", label: t("admin.chatManagement.maxStreams"), min: 1, max: 1000, step: 10 },
            ].map((item) => (
              <div key={item.key} className="p-3 bg-white/5 rounded-xl">
                <label className="text-white/60 text-xs mb-2 block">{item.label}</label>
                <input
                  type="number"
                  value={settings[item.key] || 0}
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  onChange={(e) => updateSetting(item.key, parseInt(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 7: Settings (الإعدادات)
// ════════════════════════════════════════════════════════

function SettingsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminChatManagement.getSettings()
      .then(res => { if (res.success) setSettings(res.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const settingsArray = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const res = await adminChatManagement.updateSettings(settingsArray);
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (!settings) return null;

  const sections = [
    {
      title: t("admin.chatManagement.chatPricing"),
      icon: DollarSign,
      color: "text-yellow-400",
      fields: [
        { key: "voice_call_rate", label: t("admin.chatManagement.voiceCallRate"), type: "number" as const },
        { key: "video_call_rate", label: t("admin.chatManagement.videoCallRate"), type: "number" as const },
        { key: "message_cost", label: t("admin.chatManagement.messageCost"), type: "number" as const },
      ],
    },
    {
      title: t("admin.chatManagement.chatLimits"),
      icon: Shield,
      color: "text-purple-400",
      fields: [
        { key: "max_message_length", label: t("admin.chatManagement.maxMessageLength"), type: "number" as const },
        { key: "chat_cooldown", label: t("admin.chatManagement.chatCooldown"), type: "number" as const },
        { key: "max_call_duration", label: t("admin.chatManagement.maxCallDuration"), type: "number" as const },
      ],
    },
    {
      title: t("admin.chatManagement.accessLevels"),
      icon: Users,
      color: "text-blue-400",
      fields: [
        { key: "min_level_chat", label: t("admin.chatManagement.minLevelChat"), type: "number" as const },
        { key: "min_level_call", label: t("admin.chatManagement.minLevelCall"), type: "number" as const },
        { key: "min_level_stream", label: t("admin.chatManagement.minLevelStream"), type: "number" as const },
      ],
    },
    {
      title: t("admin.chatManagement.streamSettings"),
      icon: Radio,
      color: "text-red-400",
      fields: [
        { key: "max_concurrent_streams", label: t("admin.chatManagement.maxStreams"), type: "number" as const },
        { key: "stream_max_viewers", label: t("admin.chatManagement.maxViewers"), type: "number" as const },
      ],
    },
    {
      title: t("admin.chatManagement.features"),
      icon: Settings,
      color: "text-green-400",
      fields: [
        { key: "allow_images", label: t("admin.chatManagement.allowImages"), type: "boolean" as const },
        { key: "allow_voice", label: t("admin.chatManagement.allowVoice"), type: "boolean" as const },
        { key: "allow_gifts", label: t("admin.chatManagement.allowGifts"), type: "boolean" as const },
        { key: "enable_profanity_filter", label: t("admin.chatManagement.profanityFilter"), type: "boolean" as const },
        { key: "enable_spam_detection", label: t("admin.chatManagement.spamDetection"), type: "boolean" as const },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <section.icon className={`w-5 h-5 ${section.color}`} />
            {section.title}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.fields.map((field) => (
              <div key={field.key} className="p-3 bg-white/5 rounded-xl">
                <label className="text-white/60 text-xs mb-2 block">{field.label}</label>
                {field.type === "boolean" ? (
                  <button
                    onClick={() => setSettings((prev: any) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${settings[field.key] ? "bg-purple-500" : "bg-white/20"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings[field.key] ? "start-[22px]" : "start-0.5"}`} />
                  </button>
                ) : (
                  <input
                    type="number"
                    value={settings[field.key] || 0}
                    onChange={(e) => setSettings((prev: any) => ({ ...prev, [field.key]: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
          {saving ? t("admin.chatManagement.saving") : t("admin.chatManagement.saveSettings")}
        </button>
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-green-400 text-sm"
            >
              ✅ {t("admin.chatManagement.savedSuccess")}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 8: Reports (البلاغات)
// ════════════════════════════════════════════════════════

function ReportsTab() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<any[]>([]);
  const [reportStats, setReportStats] = useState<any>(null);
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
                <span className="text-white/20 text-[10px]">{new Date(report.createdAt).toLocaleDateString("ar")}</span>
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

// ════════════════════════════════════════════════════════
// Tab 9: Blocks (الحظر)
// ════════════════════════════════════════════════════════

function BlocksTab() {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<any[]>([]);
  const [blockPage, setBlockPage] = useState(1);
  const [blockTotal, setBlockTotal] = useState(0);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminChatManagement.getChatBlocks(blockPage);
      setBlocks(res.data || []);
      setBlockTotal(res.pagination?.total || 0);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [blockPage]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleRemoveBlock = async (id: string) => {
    setRemovingBlockId(id);
    try {
      await adminChatManagement.removeChatBlock(id);
      setBlocks(prev => prev.filter(b => b.id !== id));
    } catch (err) { console.error(err); }
    setRemovingBlockId(null);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {blocks.length > 0 ? (
        <div className="space-y-3">
          {blocks.map(block => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <Ban className="w-5 h-5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {block.blocker?.displayName || block.blocker?.username || block.blockerId}
                  </p>
                  <p className="text-white/30 text-[11px]">
                    {t("admin.chats.blocked")}: {block.blocked?.displayName || block.blocked?.username || block.blockedId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-white/20 text-[10px]">{new Date(block.createdAt).toLocaleDateString("ar")}</span>
                <button
                  onClick={() => handleRemoveBlock(block.id)}
                  disabled={removingBlockId === block.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {removingBlockId === block.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                  {t("admin.chats.removeBlock")}
                </button>
              </div>
            </motion.div>
          ))}

          {blockTotal > 20 && (
            <div className="flex justify-center gap-2 pt-4">
              <button onClick={() => setBlockPage(p => Math.max(1, p - 1))} disabled={blockPage <= 1} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30">{t("common.previous")}</button>
              <span className="px-3 py-1.5 text-xs text-white/30">{blockPage}</span>
              <button onClick={() => setBlockPage(p => p + 1)} disabled={blocks.length < 20} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30">{t("common.next")}</button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState message={t("admin.chats.noBlocks")} icon={Ban} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Main Page Component
// ════════════════════════════════════════════════════════

const TABS = [
  { key: "overview", icon: BarChart3, labelKey: "admin.chatManagement.tabs.overview" },
  { key: "conversations", icon: MessageSquare, labelKey: "admin.chatManagement.tabs.conversations" },
  { key: "messages", icon: Send, labelKey: "admin.chatManagement.tabs.messages" },
  { key: "calls", icon: Phone, labelKey: "admin.chatManagement.tabs.calls" },
  { key: "streams", icon: Radio, labelKey: "admin.chatManagement.tabs.streams" },
  { key: "moderation", icon: Shield, labelKey: "admin.chatManagement.tabs.moderation" },
  { key: "reports", icon: Flag, labelKey: "admin.chats.reports" },
  { key: "blocks", icon: Ban, labelKey: "admin.chats.blocks" },
  { key: "settings", icon: Settings, labelKey: "admin.chatManagement.tabs.settings" },
];

export function ChatManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t("admin.chatManagement.title")}</h1>
        <p className="text-white/50 text-sm mt-1">{t("admin.chatManagement.subtitle")}</p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-purple-500/30 shadow-lg shadow-purple-500/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? "text-purple-400" : ""}`} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "conversations" && <ConversationsTab />}
          {activeTab === "messages" && <MessagesTab />}
          {activeTab === "calls" && <CallsTab />}
          {activeTab === "streams" && <LiveStreamsTab />}
          {activeTab === "moderation" && <ModerationTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "blocks" && <BlocksTab />}
          {activeTab === "settings" && <SettingsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
