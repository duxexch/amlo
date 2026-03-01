import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, DollarSign, Activity, UserCog, TrendingUp, TrendingDown,
  Clock, Flag, Eye, ArrowUpRight,
} from "lucide-react";
import { adminStats } from "@/lib/adminApi";
import { Link } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";

export function DashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminStats.get()
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/5 rounded-2xl h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-2xl h-80" />
          <div className="bg-white/5 rounded-2xl h-80" />
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-white/40 text-center py-20">{t("common.loading")}</p>;

  const statCards = [
    {
      label: t("admin.dashboard.totalUsers"),
      value: data.totalUsers?.toLocaleString(),
      sub: t("admin.dashboard.onlineNow", { count: data.onlineUsers }),
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-400/10 border-blue-400/20",
      trend: "+12.5%",
      up: true,
    },
    {
      label: t("admin.dashboard.todayRevenue"),
      value: `$${(data.todayRevenue * 0.01).toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
      sub: t("admin.dashboard.totalRevenue", { amount: (data.totalRevenue * 0.01).toLocaleString(undefined, { minimumFractionDigits: 0 }) }),
      icon: DollarSign,
      color: "text-green-400",
      bg: "bg-green-400/10 border-green-400/20",
      trend: "+8.3%",
      up: true,
    },
    {
      label: t("admin.dashboard.activeStreams"),
      value: data.activeStreams?.toLocaleString(),
      sub: t("admin.dashboard.newUsersToday", { count: data.newUsersToday }),
      icon: Activity,
      color: "text-orange-400",
      bg: "bg-orange-400/10 border-orange-400/20",
      trend: "+5.2%",
      up: true,
    },
    {
      label: t("admin.dashboard.pendingReports"),
      value: data.pendingReports?.toLocaleString(),
      sub: t("admin.dashboard.bannedCount", { count: data.bannedUsers }),
      icon: Flag,
      color: "text-red-400",
      bg: "bg-red-400/10 border-red-400/20",
      trend: "-3.1%",
      up: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white" style={{ fontFamily: "Outfit" }}>
            {t("admin.dashboard.title")}
          </h1>
          <p className="text-white/40 text-sm mt-1">{t("admin.dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
          <Clock className="w-3.5 h-3.5" />
          {t("admin.dashboard.lastUpdate")} {new Date().toLocaleTimeString("ar-EG")}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5 relative overflow-hidden group hover:border-white/10 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-lg ${stat.up ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                {stat.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stat.trend}
              </span>
            </div>
            <h3 className="text-2xl font-black text-white mb-1">{stat.value}</h3>
            <p className="text-xs text-white/40 font-medium">{stat.label}</p>
            <p className="text-[11px] text-white/25 mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Users Growth Chart */}
        <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-sm">{t("admin.dashboard.usersGrowth")}</h3>
            <span className="text-xs text-white/30">{t("admin.dashboard.last6Months")}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.monthlyGrowth}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12, color: "#fff" }}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              />
              <Area type="monotone" dataKey="users" stroke="#a855f7" strokeWidth={2} fill="url(#colorUsers)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Chart */}
        <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-sm">{t("admin.dashboard.revenue")}</h3>
            <span className="text-xs text-white/30">{t("admin.dashboard.last6Months")}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12, color: "#fff" }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, t("admin.dashboard.revenue")]}
              />
              <Bar dataKey="revenue" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: Recent Users + Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-sm">{t("admin.dashboard.recentUsers")}</h3>
            <Link href="/admin/users">
              <a className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1">
                {t("common.viewAll")} <ArrowUpRight className="w-3 h-3" />
              </a>
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentUsers?.map((user: any) => (
              <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(user.displayName || user.username).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.displayName || user.username}</p>
                  <p className="text-[11px] text-white/30">@{user.username}</p>
                </div>
                <div className="text-left">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${
                    user.status === "online" ? "bg-green-400/10 text-green-400" :
                    user.status === "in_stream" ? "bg-orange-400/10 text-orange-400" :
                    "bg-white/5 text-white/30"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      user.status === "online" ? "bg-green-400" :
                      user.status === "in_stream" ? "bg-orange-400" :
                      "bg-white/20"
                    }`} />
                    {user.status === "online" ? t("admin.dashboard.statusOnline") : user.status === "in_stream" ? t("admin.dashboard.statusInStream") : t("admin.dashboard.statusOffline")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-sm">{t("admin.dashboard.activityLog")}</h3>
            <span className="text-xs text-white/30">{data.recentLogs?.length || 0} {t("admin.dashboard.operations")}</span>
          </div>
          <div className="space-y-2">
            {data.recentLogs?.length > 0 ? (
              data.recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70">{log.details}</p>
                    <p className="text-[10px] text-white/25 mt-1">
                      {new Date(log.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/20 text-center py-10">{t("admin.dashboard.noActivity")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-bold text-white">{data.activeAgents}</p>
            <p className="text-[10px] text-white/30">{t("admin.dashboard.activeAgent")}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-orange-400" />
          <div>
            <p className="text-sm font-bold text-white">{data.activeStreams}</p>
            <p className="text-[10px] text-white/30">{t("admin.dashboard.activeStream")}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-bold text-white">{data.onlineUsers}</p>
            <p className="text-[10px] text-white/30">{t("common.online")}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5" />
        <div className="flex items-center gap-3">
          <Flag className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-sm font-bold text-white">{data.pendingReports}</p>
            <p className="text-[10px] text-white/30">{t("admin.dashboard.pendingReport")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
