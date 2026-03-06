/**
 * Admin Chat — Overview Tab (نظرة عامة)
 * ════════════════════════════════════════
 */
import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { MessageSquare, Phone, Send, DollarSign, Users, Mic, Clock, TrendingUp, BarChart3, Download } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { StatCard, LoadingSkeleton, EmptyState } from "./AdminChatShared";
import type { ChatOverviewStats, TrendDay, TopChatter } from "../chat/../../../pages/chat/chatTypes";

export function OverviewTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ChatOverviewStats | null>(null);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [topChatters, setTopChatters] = useState<TopChatter[]>([]);
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

  const msgTypeData = [
    { name: t("admin.chatManagement.textMsg"), value: stats.textMessages || 0, color: "#60a5fa" },
    { name: t("admin.chatManagement.imageMsg"), value: stats.imageMessages || 0, color: "#34d399" },
    { name: t("admin.chatManagement.voiceMsg"), value: stats.voiceMessages || 0, color: "#a78bfa" },
    { name: t("admin.chatManagement.giftMsg"), value: stats.giftMessages || 0, color: "#fbbf24" },
  ];

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={() => adminChatManagement.exportConversations()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs hover:bg-blue-500/20 transition-colors">
          <Download className="w-3.5 h-3.5" /> {t("admin.chatManagement.exportConversations", "تصدير المحادثات")}
        </button>
        <button onClick={() => adminChatManagement.exportMessages()} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs hover:bg-green-500/20 transition-colors">
          <Download className="w-3.5 h-3.5" /> {t("admin.chatManagement.exportMessages", "تصدير الرسائل")}
        </button>
        <button onClick={() => adminChatManagement.exportReports()} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition-colors">
          <Download className="w-3.5 h-3.5" /> {t("admin.chatManagement.exportReports", "تصدير البلاغات")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.map((card, i) => <StatCard key={i} {...card} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">{t("admin.chatManagement.activityTrend")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} labelStyle={{ color: "#fff" }} />
              <Area type="monotone" dataKey="messages" stroke="#60a5fa" fill="rgba(96,165,250,0.15)" name={t("admin.chatManagement.messages")} />
              <Area type="monotone" dataKey="calls" stroke="#a78bfa" fill="rgba(167,139,250,0.15)" name={t("admin.chatManagement.calls")} />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">{t("admin.chatManagement.messageTypes")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={msgTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {msgTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
              <Legend formatter={(value: string) => <span className="text-white/70 text-xs">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

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
              {topChatters.map((u, i) => (
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
