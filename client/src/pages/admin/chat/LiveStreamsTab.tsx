/**
 * Admin Chat — Live Streams Tab (البث المباشر)
 * ════════════════════════════════════════
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Eye, MonitorPlay, Gift, Square, RefreshCw, AlertTriangle } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { StatCard, LoadingSkeleton, formatDuration } from "./AdminChatShared";
import type { AdminStream, StreamAlertConfig, StreamAlertStatus, StreamStats, StreamTelemetry } from "../../chat/chatTypes";
import { toast } from "sonner";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface TelemetryPoint {
  time: string;
  joins: number;
  leaves: number;
  chatMessages: number;
  giftsRateLimited: number;
}

interface LiveAlert {
  id: string;
  level: "high" | "medium" | "low";
  title: string;
  detail: string;
}

interface SmoothedTelemetry {
  joins: number;
  leaves: number;
  giftsRateLimited: number;
  chatBannedWordBlocked: number;
  chatMutedBlocked: number;
  giftsSocketRejected: number;
}

const ALERT_LAST_SEEN_STORAGE_KEY = "admin-live-alert-last-seen-v1";

const DEFAULT_ALERT_THRESHOLDS: StreamAlertConfig = {
  giftsRateLimited: 10,
  chatBannedWordBlocked: 12,
  chatMutedBlocked: 8,
  giftsSocketRejected: 1,
  joinImbalanceOffset: 40,
  cooldownMinutes: 5,
};

export function LiveStreamsTab() {
  const { t } = useTranslation();
  const [streams, setStreams] = useState<AdminStream[]>([]);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const [telemetry, setTelemetry] = useState<StreamTelemetry | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertThresholds, setAlertThresholds] = useState<StreamAlertConfig>(DEFAULT_ALERT_THRESHOLDS);
  const [alertStatus, setAlertStatus] = useState<StreamAlertStatus | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "active" | "resolved">("all");
  const [historyLevelFilter, setHistoryLevelFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyClearing, setHistoryClearing] = useState<"none" | "resolved" | "all">("none");
  const alertLastSeenRef = useRef<Record<string, number>>({});
  const HISTORY_PAGE_SIZE = 8;

  const updateThreshold = (key: keyof StreamAlertConfig, value: string) => {
    const parsed = Number.parseInt(value, 10);
    const safe = Number.isFinite(parsed)
      ? (key === "cooldownMinutes" ? Math.max(1, parsed) : Math.max(0, parsed))
      : (key === "cooldownMinutes" ? 1 : 0);
    setAlertThresholds(prev => ({ ...prev, [key]: safe }));
  };

  const loadAlertConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await adminChatManagement.getStreamAlertConfig();
      if (res.success && res.data) {
        setAlertThresholds({
          giftsRateLimited: Math.max(0, Number(res.data.giftsRateLimited ?? DEFAULT_ALERT_THRESHOLDS.giftsRateLimited)),
          chatBannedWordBlocked: Math.max(0, Number(res.data.chatBannedWordBlocked ?? DEFAULT_ALERT_THRESHOLDS.chatBannedWordBlocked)),
          chatMutedBlocked: Math.max(0, Number(res.data.chatMutedBlocked ?? DEFAULT_ALERT_THRESHOLDS.chatMutedBlocked)),
          giftsSocketRejected: Math.max(0, Number(res.data.giftsSocketRejected ?? DEFAULT_ALERT_THRESHOLDS.giftsSocketRejected)),
          joinImbalanceOffset: Math.max(0, Number(res.data.joinImbalanceOffset ?? DEFAULT_ALERT_THRESHOLDS.joinImbalanceOffset)),
          cooldownMinutes: Math.max(1, Number(res.data.cooldownMinutes ?? DEFAULT_ALERT_THRESHOLDS.cooldownMinutes)),
        });
      }
    } catch {
      toast.error(t("admin.chatManagement.alertConfigLoadFailed", "تعذر تحميل إعدادات تنبيه البث"));
    } finally {
      setConfigLoading(false);
    }
  };

  const saveAlertConfig = async () => {
    setConfigSaving(true);
    try {
      await adminChatManagement.updateStreamAlertConfig(alertThresholds);
      toast.success(t("admin.chatManagement.alertConfigSaved", "تم حفظ إعدادات التنبيه"));
    } catch {
      toast.error(t("admin.chatManagement.alertConfigSaveFailed", "فشل حفظ إعدادات التنبيه"));
    } finally {
      setConfigSaving(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALERT_LAST_SEEN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      alertLastSeenRef.current = parsed;
    } catch {
      alertLastSeenRef.current = {};
    }
  }, []);

  const smoothedTelemetry = useMemo<SmoothedTelemetry | null>(() => {
    if (!telemetry) return null;
    const windowPoints = telemetryHistory.slice(-3);

    if (windowPoints.length === 0) {
      return {
        joins: telemetry.joins,
        leaves: telemetry.leaves,
        giftsRateLimited: telemetry.giftsRateLimited,
        chatBannedWordBlocked: telemetry.chatBannedWordBlocked,
        chatMutedBlocked: telemetry.chatMutedBlocked,
        giftsSocketRejected: telemetry.giftsSocketRejected,
      };
    }

    const sums = windowPoints.reduce(
      (acc, point) => {
        acc.joins += point.joins;
        acc.leaves += point.leaves;
        acc.giftsRateLimited += point.giftsRateLimited;
        return acc;
      },
      { joins: 0, leaves: 0, giftsRateLimited: 0 },
    );

    const count = windowPoints.length;
    return {
      joins: Math.round(sums.joins / count),
      leaves: Math.round(sums.leaves / count),
      giftsRateLimited: Math.round(sums.giftsRateLimited / count),
      chatBannedWordBlocked: telemetry.chatBannedWordBlocked,
      chatMutedBlocked: telemetry.chatMutedBlocked,
      giftsSocketRejected: telemetry.giftsSocketRejected,
    };
  }, [telemetry, telemetryHistory]);

  const liveAlerts = useMemo<LiveAlert[]>(() => {
    if (!telemetry || !smoothedTelemetry) return [];
    const alerts: LiveAlert[] = [];

    if (smoothedTelemetry.giftsRateLimited >= alertThresholds.giftsRateLimited) {
      alerts.push({
        id: "gift-rate-limit-spike",
        level: "high",
        title: t("admin.chatManagement.alertGiftSpike", "ارتفاع حاد في محاولات الهدايا"),
        detail: t("admin.chatManagement.alertGiftSpikeDetail", "متوسط آخر 3 دورات: {{count}} تقييد هدايا", { count: smoothedTelemetry.giftsRateLimited }),
      });
    }

    if (smoothedTelemetry.chatBannedWordBlocked >= alertThresholds.chatBannedWordBlocked) {
      alerts.push({
        id: "banned-words-spike",
        level: "medium",
        title: t("admin.chatManagement.alertBannedWords", "ارتفاع رسائل مخالفة الكلمات المحظورة"),
        detail: t("admin.chatManagement.alertBannedWordsDetail", "تم حظر {{count}} رسالة بكلمات محظورة", { count: smoothedTelemetry.chatBannedWordBlocked }),
      });
    }

    if (smoothedTelemetry.chatMutedBlocked >= alertThresholds.chatMutedBlocked) {
      alerts.push({
        id: "muted-blocked-spike",
        level: "medium",
        title: t("admin.chatManagement.alertMutedUsers", "نشاط مرتفع لمستخدمين مكتومين"),
        detail: t("admin.chatManagement.alertMutedUsersDetail", "تم رفض {{count}} رسالة لمستخدمين مكتومين", { count: smoothedTelemetry.chatMutedBlocked }),
      });
    }

    if (smoothedTelemetry.giftsSocketRejected >= alertThresholds.giftsSocketRejected) {
      alerts.push({
        id: "legacy-socket-gift",
        level: "low",
        title: t("admin.chatManagement.alertLegacyClient", "عملاء قديمة تستخدم مسار هدايا غير مدعوم"),
        detail: t("admin.chatManagement.alertLegacyClientDetail", "تم رفض {{count}} حدث Socket gift", { count: smoothedTelemetry.giftsSocketRejected }),
      });
    }

    if (smoothedTelemetry.joins >= smoothedTelemetry.leaves * 3 + alertThresholds.joinImbalanceOffset) {
      alerts.push({
        id: "join-leave-imbalance",
        level: "low",
        title: t("admin.chatManagement.alertJoinImbalance", "عدم توازن الانضمام/المغادرة"),
        detail: t("admin.chatManagement.alertJoinImbalanceDetail", "متوسط انضمام {{joins}} مقابل مغادرة {{leaves}}", { joins: smoothedTelemetry.joins, leaves: smoothedTelemetry.leaves }),
      });
    }

    return alerts;
  }, [alertThresholds, smoothedTelemetry, telemetry, t]);

  useEffect(() => {
    if (liveAlerts.length === 0) return;

    const cooldownMs = alertThresholds.cooldownMinutes * 60_000;
    const now = Date.now();
    const nextMap = { ...alertLastSeenRef.current };

    const freshAlerts = liveAlerts.filter(alert => {
      const lastSeen = nextMap[alert.id] ?? 0;
      return now - lastSeen >= cooldownMs;
    });

    if (freshAlerts.length === 0) return;

    for (const alert of freshAlerts) {
      nextMap[alert.id] = now;
      toast.warning(alert.title, {
        description: alert.detail,
        duration: 5000,
      });
    }

    alertLastSeenRef.current = nextMap;
    localStorage.setItem(ALERT_LAST_SEEN_STORAGE_KEY, JSON.stringify(nextMap));
  }, [alertThresholds.cooldownMinutes, liveAlerts]);

  const loadData = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [streamsRes, statsRes, telemetryRes, alertRes] = await Promise.all([
        adminChatManagement.getActiveStreams(),
        adminChatManagement.getStreamStats(),
        adminChatManagement.getStreamTelemetry(),
        adminChatManagement.getStreamAlertStatus(historyFilter, historyLevelFilter, historyPage, HISTORY_PAGE_SIZE),
      ]);
      if (streamsRes.success) setStreams(streamsRes.data);
      if (statsRes.success) setStats(statsRes.data);
      if (telemetryRes.success) {
        setTelemetry(telemetryRes.data);
        const point: TelemetryPoint = {
          time: new Date(telemetryRes.data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          joins: telemetryRes.data.joins,
          leaves: telemetryRes.data.leaves,
          chatMessages: telemetryRes.data.chatMessages,
          giftsRateLimited: telemetryRes.data.giftsRateLimited,
        };
        setTelemetryHistory(prev => {
          const next = [...prev, point];
          return next.slice(-30);
        });
      }
      if (alertRes.success) setAlertStatus(alertRes.data);
    } catch {
      setError(t("admin.chatManagement.loadError", "تعذر تحميل بيانات البث"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredAlertHistory = useMemo(() => {
    return alertStatus?.history ?? [];
  }, [alertStatus]);

  const clearAlertHistory = async (mode: "resolved" | "all") => {
    const confirmMsg = mode === "all"
      ? t("admin.chatManagement.confirmClearAllAlerts", "سيتم مسح كل سجل التنبيهات. هل أنت متأكد؟")
      : t("admin.chatManagement.confirmClearResolvedAlerts", "سيتم مسح التنبيهات المحلولة فقط. هل تريد المتابعة؟");
    if (!window.confirm(confirmMsg)) return;

    setHistoryClearing(mode);
    try {
      await adminChatManagement.clearStreamAlertHistory(mode);
      toast.success(mode === "all"
        ? t("admin.chatManagement.clearedAllAlerts", "تم مسح كل سجل التنبيهات")
        : t("admin.chatManagement.clearedResolvedAlerts", "تم مسح التنبيهات المحلولة"));
      setHistoryPage(1);
      await loadData(true);
    } catch {
      toast.error(t("admin.chatManagement.clearAlertHistoryFailed", "فشل مسح سجل التنبيهات"));
    } finally {
      setHistoryClearing("none");
    }
  };

  const exportAlertHistoryCsv = async () => {
    if (!alertStatus) {
      toast.error(t("admin.chatManagement.noAlertHistory", "لا يوجد سجل تنبيهات للتصدير"));
      return;
    }

    try {
      const pageSize = 100;
      const first = await adminChatManagement.getStreamAlertStatus(historyFilter, historyLevelFilter, 1, pageSize);
      if (!first.success || !first.data) {
        toast.error(t("admin.chatManagement.noAlertHistory", "لا يوجد سجل تنبيهات للتصدير"));
        return;
      }

      const allRows = [...(first.data.history || [])];
      const totalPages = first.data.pagination?.totalPages || 1;
      for (let p = 2; p <= totalPages; p++) {
        const next = await adminChatManagement.getStreamAlertStatus(historyFilter, historyLevelFilter, p, pageSize);
        if (next.success && next.data?.history) {
          allRows.push(...next.data.history);
        }
      }

      if (allRows.length === 0) {
        toast.error(t("admin.chatManagement.noAlertHistory", "لا يوجد سجل تنبيهات للتصدير"));
        return;
      }

      const rows = [
        ["id", "title", "level", "hits", "status", "firstSeenAt", "lastSeenAt", "lastDetail"],
        ...allRows.map(entry => [
          entry.id,
          entry.title,
          entry.level,
          String(entry.hits),
          entry.isActive ? "active" : "resolved",
          entry.firstSeenAt,
          entry.lastSeenAt,
          entry.lastDetail.replaceAll("\n", " "),
        ]),
      ];

      const csv = rows
        .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stream-alert-history-${historyFilter}-${historyLevelFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("admin.chatManagement.exportAlertHistoryFailed", "فشل تصدير سجل التنبيهات"));
    }
  };

  useEffect(() => {
    loadData();
    loadAlertConfig();
    const timer = setInterval(() => loadData(true), 20_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    loadData(true);
  }, [historyFilter, historyLevelFilter, historyPage]);

  const endStream = async (id: string) => {
    try {
      await adminChatManagement.forceEndStream(id);
      setStreams(prev => prev.map(s => s.id === id ? { ...s, status: "ended" } : s));
      toast.success(t("admin.chatManagement.streamStopped", "تم إيقاف البث"));
      loadData(true);
    } catch {
      toast.error(t("admin.chatManagement.streamStopFailed", "فشل إيقاف البث"));
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Load Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => loadData()} className="text-xs px-2.5 py-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">
            {t("common.retry", "إعادة المحاولة")}
          </button>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => loadData(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/80 text-xs hover:bg-white/15 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {t("common.refresh", "تحديث")}
        </button>
      </div>

      {/* Stream Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label={t("admin.chatManagement.activeStreams")} value={stats.activeNow} icon={Radio} color="text-red-400" bg="bg-red-400/10 border-red-400/20" sub={t("admin.chatManagement.liveNow")} />
          <StatCard label={t("admin.chatManagement.totalViewers")} value={stats.totalViewers?.toLocaleString()} icon={Eye} color="text-blue-400" bg="bg-blue-400/10 border-blue-400/20" sub={`${t("admin.chatManagement.peak")}: ${stats.peakConcurrent}`} />
          <StatCard label={t("admin.chatManagement.todayStreams")} value={stats.totalToday} icon={MonitorPlay} color="text-green-400" bg="bg-green-400/10 border-green-400/20" sub={`${t("admin.chatManagement.avg")}: ${formatDuration(stats.avgDuration)}`} />
          <StatCard label={t("admin.chatManagement.todayGifts")} value={`${stats.totalRevenueToday?.toLocaleString()} 🪙`} icon={Gift} color="text-yellow-400" bg="bg-yellow-400/10 border-yellow-400/20" sub={`${stats.totalGiftsToday} ${t("admin.chatManagement.gifts")}`} />
        </div>
      )}

      {/* Live Telemetry */}
      {telemetry && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">{t("admin.chatManagement.liveTelemetry", "مراقبة البث المباشر")}</h3>
            <span className="text-white/40 text-xs">{new Date(telemetry.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.joins", "انضمام")}</p><p className="text-white font-bold text-sm">{telemetry.joins}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.leaves", "مغادرة")}</p><p className="text-white font-bold text-sm">{telemetry.leaves}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.chatMessages", "رسائل البث")}</p><p className="text-white font-bold text-sm">{telemetry.chatMessages}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.mutedBlocked", "محظور بالكتم")}</p><p className="text-white font-bold text-sm">{telemetry.chatMutedBlocked}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.bannedWordsBlocked", "محظور بالكلمات")}</p><p className="text-white font-bold text-sm">{telemetry.chatBannedWordBlocked}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.giftsRateLimited", "هدايا محدودة")}</p><p className="text-white font-bold text-sm">{telemetry.giftsRateLimited}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.giftsSocketRejected", "هدايا سوكت مرفوضة")}</p><p className="text-white font-bold text-sm">{telemetry.giftsSocketRejected}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.invites", "دعوات متحدث")}</p><p className="text-white font-bold text-sm">{telemetry.speakerInvites}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.accepts", "قبول الدعوة")}</p><p className="text-white font-bold text-sm">{telemetry.speakerAccepts}</p></div>
            <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-[10px]">{t("admin.chatManagement.rejects", "رفض الدعوة")}</p><p className="text-white font-bold text-sm">{telemetry.speakerRejects}</p></div>
          </div>

          {smoothedTelemetry && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-white/60 text-xs mb-2">{t("admin.chatManagement.telemetrySmoothed", "متوسط آخر 3 عينات")}</p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded-md bg-white/10 text-white/85">
                  {t("admin.chatManagement.joins", "انضمام")}: {smoothedTelemetry.joins}
                </span>
                <span className="px-2 py-1 rounded-md bg-white/10 text-white/85">
                  {t("admin.chatManagement.leaves", "مغادرة")}: {smoothedTelemetry.leaves}
                </span>
                <span className="px-2 py-1 rounded-md bg-white/10 text-white/85">
                  {t("admin.chatManagement.giftsRateLimited", "هدايا محدودة")}: {smoothedTelemetry.giftsRateLimited}
                </span>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-xs">{t("admin.chatManagement.alertThresholds", "إعدادات عتبات التنبيه")}</p>
              <div className="flex items-center gap-2">
                {configLoading && <span className="text-[11px] text-white/50">{t("common.loading", "جاري التحميل...")}</span>}
                <button
                  onClick={() => setAlertThresholds(DEFAULT_ALERT_THRESHOLDS)}
                  className="text-[11px] px-2 py-1 rounded-md bg-white/10 text-white/80 hover:bg-white/15 transition-colors"
                >
                  {t("admin.chatManagement.resetThresholds", "إعادة الافتراضي")}
                </button>
                <button
                  onClick={saveAlertConfig}
                  disabled={configSaving}
                  className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-60"
                >
                  {configSaving ? t("common.saving", "جاري الحفظ...") : t("common.save", "حفظ")}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              <label className="text-[11px] text-white/70 space-y-1">
                <span>{t("admin.chatManagement.giftsRateLimited", "هدايا محدودة")}</span>
                <input
                  type="number"
                  min={0}
                  value={alertThresholds.giftsRateLimited}
                  onChange={(e) => updateThreshold("giftsRateLimited", e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-md px-2 py-1 text-white"
                />
              </label>
              <label className="text-[11px] text-white/70 space-y-1">
                <span>{t("admin.chatManagement.bannedWordsBlocked", "محظور بالكلمات")}</span>
                <input
                  type="number"
                  min={0}
                  value={alertThresholds.chatBannedWordBlocked}
                  onChange={(e) => updateThreshold("chatBannedWordBlocked", e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-md px-2 py-1 text-white"
                />
              </label>
              <label className="text-[11px] text-white/70 space-y-1">
                <span>{t("admin.chatManagement.mutedBlocked", "محظور بالكتم")}</span>
                <input
                  type="number"
                  min={0}
                  value={alertThresholds.chatMutedBlocked}
                  onChange={(e) => updateThreshold("chatMutedBlocked", e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-md px-2 py-1 text-white"
                />
              </label>
              <label className="text-[11px] text-white/70 space-y-1">
                <span>{t("admin.chatManagement.giftsSocketRejected", "هدايا سوكت مرفوضة")}</span>
                <input
                  type="number"
                  min={0}
                  value={alertThresholds.giftsSocketRejected}
                  onChange={(e) => updateThreshold("giftsSocketRejected", e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-md px-2 py-1 text-white"
                />
              </label>
              <label className="text-[11px] text-white/70 space-y-1">
                <span>{t("admin.chatManagement.joinOffset", "فرق الانضمام")}</span>
                <input
                  type="number"
                  min={0}
                  value={alertThresholds.joinImbalanceOffset}
                  onChange={(e) => updateThreshold("joinImbalanceOffset", e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-md px-2 py-1 text-white"
                />
              </label>
              <label className="text-[11px] text-white/70 space-y-1">
                <span>{t("admin.chatManagement.alertCooldown", "تبريد التنبيه (دقائق)")}</span>
                <input
                  type="number"
                  min={1}
                  value={alertThresholds.cooldownMinutes}
                  onChange={(e) => updateThreshold("cooldownMinutes", e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-md px-2 py-1 text-white"
                />
              </label>
            </div>
          </div>

          {telemetryHistory.length > 1 && (
            <div className="pt-2">
              <p className="text-white/60 text-xs mb-2">{t("admin.chatManagement.telemetryTrend", "اتجاه آخر القياسات")}</p>
              <div className="h-60 w-full bg-white/[0.03] border border-white/10 rounded-xl p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={telemetryHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} minTickGap={24} />
                    <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10 }}
                      labelStyle={{ color: "#cbd5e1" }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Line type="monotone" dataKey="joins" stroke="#22c55e" strokeWidth={2} dot={false} name={t("admin.chatManagement.joins", "انضمام")} />
                    <Line type="monotone" dataKey="leaves" stroke="#ef4444" strokeWidth={2} dot={false} name={t("admin.chatManagement.leaves", "مغادرة")} />
                    <Line type="monotone" dataKey="chatMessages" stroke="#3b82f6" strokeWidth={2} dot={false} name={t("admin.chatManagement.chatMessages", "رسائل البث")} />
                    <Line type="monotone" dataKey="giftsRateLimited" stroke="#f59e0b" strokeWidth={2} dot={false} name={t("admin.chatManagement.giftsRateLimited", "هدايا محدودة")} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {liveAlerts.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-white/60 text-xs">{t("admin.chatManagement.liveAlerts", "تنبيهات التشغيل")}</p>
              {liveAlerts.map((alert) => {
                const styles =
                  alert.level === "high"
                    ? "bg-red-500/10 border-red-500/30 text-red-200"
                    : alert.level === "medium"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      : "bg-blue-500/10 border-blue-500/30 text-blue-200";
                return (
                  <div key={alert.id} className={`rounded-xl border px-3 py-2 ${styles}`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{alert.title}</p>
                        <p className="text-[11px] opacity-80">{alert.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {alertStatus && (
            <div className="pt-2 space-y-2">
              {alertStatus.summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                  <div className="bg-white/5 rounded-lg p-2 border border-white/10"><p className="text-white/45 text-[10px]">{t("admin.chatManagement.total", "الإجمالي")}</p><p className="text-white font-bold text-xs">{alertStatus.summary.total}</p></div>
                  <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20"><p className="text-red-200/80 text-[10px]">{t("admin.chatManagement.active", "نشط")}</p><p className="text-red-200 font-bold text-xs">{alertStatus.summary.active}</p></div>
                  <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20"><p className="text-emerald-200/80 text-[10px]">{t("admin.chatManagement.resolved", "تم الحل")}</p><p className="text-emerald-200 font-bold text-xs">{alertStatus.summary.resolved}</p></div>
                  <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20"><p className="text-red-200/80 text-[10px]">HIGH</p><p className="text-red-200 font-bold text-xs">{alertStatus.summary.high}</p></div>
                  <div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/20"><p className="text-amber-200/80 text-[10px]">MEDIUM</p><p className="text-amber-200 font-bold text-xs">{alertStatus.summary.medium}</p></div>
                  <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20"><p className="text-blue-200/80 text-[10px]">LOW</p><p className="text-blue-200 font-bold text-xs">{alertStatus.summary.low}</p></div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-white/60 text-xs">{t("admin.chatManagement.alertHistory", "سجل التنبيهات")}</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    onClick={() => {
                      setHistoryFilter("all");
                      setHistoryPage(1);
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${historyFilter === "all" ? "bg-white/20 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  >
                    {t("admin.chatManagement.all", "الكل")}
                  </button>
                  <button
                    onClick={() => {
                      setHistoryFilter("active");
                      setHistoryPage(1);
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${historyFilter === "active" ? "bg-red-500/25 text-red-200" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  >
                    {t("admin.chatManagement.active", "نشط")}
                  </button>
                  <button
                    onClick={() => {
                      setHistoryFilter("resolved");
                      setHistoryPage(1);
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${historyFilter === "resolved" ? "bg-emerald-500/25 text-emerald-200" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  >
                    {t("admin.chatManagement.resolved", "تم الحل")}
                  </button>
                  <button
                    onClick={() => {
                      setHistoryLevelFilter("all");
                      setHistoryPage(1);
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${historyLevelFilter === "all" ? "bg-white/20 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  >
                    LVL: ALL
                  </button>
                  <button
                    onClick={() => {
                      setHistoryLevelFilter("high");
                      setHistoryPage(1);
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${historyLevelFilter === "high" ? "bg-red-500/25 text-red-200" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  >
                    LVL: HIGH
                  </button>
                  <button
                    onClick={() => {
                      setHistoryLevelFilter("medium");
                      setHistoryPage(1);
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${historyLevelFilter === "medium" ? "bg-amber-500/25 text-amber-200" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  >
                    LVL: MEDIUM
                  </button>
                  <button
                    onClick={() => {
                      setHistoryLevelFilter("low");
                      setHistoryPage(1);
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${historyLevelFilter === "low" ? "bg-blue-500/25 text-blue-200" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  >
                    LVL: LOW
                  </button>
                  <button
                    onClick={() => clearAlertHistory("resolved")}
                    disabled={historyClearing !== "none"}
                    className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition-colors disabled:opacity-60"
                  >
                    {t("admin.chatManagement.clearResolved", "مسح المحلول")}
                  </button>
                  <button
                    onClick={() => clearAlertHistory("all")}
                    disabled={historyClearing !== "none"}
                    className="px-2 py-1 rounded-md bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-60"
                  >
                    {t("admin.chatManagement.clearAll", "مسح الكل")}
                  </button>
                  <button
                    onClick={exportAlertHistoryCsv}
                    className="px-2 py-1 rounded-md bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 transition-colors"
                  >
                    {t("admin.chatManagement.exportCsv", "تصدير CSV")}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-12 text-[11px] bg-white/5 text-white/60 px-3 py-2">
                  <span className="col-span-4">{t("admin.chatManagement.alert", "التنبيه")}</span>
                  <span className="col-span-2 text-center">{t("admin.chatManagement.hits", "التكرار")}</span>
                  <span className="col-span-3 text-center">{t("admin.chatManagement.lastSeen", "آخر ظهور")}</span>
                  <span className="col-span-3 text-center">{t("admin.chatManagement.status", "الحالة")}</span>
                </div>
                <div className="divide-y divide-white/10">
                  {filteredAlertHistory.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="grid grid-cols-12 items-center px-3 py-2 text-[11px]">
                      <div className="col-span-4 min-w-0">
                        <p className="text-white/85 truncate">{entry.title}</p>
                        <p className="text-white/45 truncate">{entry.lastDetail}</p>
                      </div>
                      <span className="col-span-2 text-center text-white/80">{entry.hits}</span>
                      <span className="col-span-3 text-center text-white/60">{new Date(entry.lastSeenAt).toLocaleTimeString()}</span>
                      <span className="col-span-3 flex justify-center">
                        <span className={`px-2 py-0.5 rounded-md ${entry.isActive ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                          {entry.isActive ? t("admin.chatManagement.active", "نشط") : t("admin.chatManagement.resolved", "تم الحل")}
                        </span>
                      </span>
                    </div>
                  ))}
                  {filteredAlertHistory.length === 0 && (
                    <div className="px-3 py-4 text-center text-[11px] text-white/50">
                      {t("admin.chatManagement.noAlertHistory", "لا يوجد سجل تنبيهات")}
                    </div>
                  )}
                </div>
                {alertStatus?.pagination && (
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-t border-white/10 text-[11px]">
                    <span className="text-white/55">
                      {t("admin.chatManagement.pageInfo", "صفحة {{page}} من {{totalPages}}")
                        .replace("{{page}}", String(alertStatus.pagination.page))
                        .replace("{{totalPages}}", String(alertStatus.pagination.totalPages))}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={alertStatus.pagination.page <= 1}
                        className="px-2 py-1 rounded-md bg-white/10 text-white/80 hover:bg-white/15 disabled:opacity-50"
                      >
                        {t("common.prev", "السابق")}
                      </button>
                      <button
                        onClick={() => setHistoryPage(p => Math.min(alertStatus.pagination?.totalPages || p, p + 1))}
                        disabled={alertStatus.pagination.page >= alertStatus.pagination.totalPages}
                        className="px-2 py-1 rounded-md bg-white/10 text-white/80 hover:bg-white/15 disabled:opacity-50"
                      >
                        {t("common.next", "التالي")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
