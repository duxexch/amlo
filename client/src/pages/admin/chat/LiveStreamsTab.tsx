/**
 * Admin Chat — Live Streams Tab (البث المباشر)
 * ════════════════════════════════════════
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Eye, MonitorPlay, Gift, Square } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { StatCard, LoadingSkeleton, formatDuration } from "./AdminChatShared";
import type { AdminStream, StreamStats } from "../../chat/chatTypes";

export function LiveStreamsTab() {
  const { t } = useTranslation();
  const [streams, setStreams] = useState<AdminStream[]>([]);
  const [stats, setStats] = useState<StreamStats | null>(null);
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

  return (
    <div className="space-y-6">
      {/* Stream Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label={t("admin.chatManagement.activeStreams")} value={stats.activeNow} icon={Radio} color="text-red-400" bg="bg-red-400/10 border-red-400/20" sub={t("admin.chatManagement.liveNow")} />
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
            {stats.topCategories.map((cat, i) => {
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
          {streams.map((stream) => (
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
