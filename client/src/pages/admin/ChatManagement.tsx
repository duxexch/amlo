/**
 * Admin Chat & Broadcast Management Page
 * ════════════════════════════════════════
 * Main layout with tab navigation; each tab is a separate component.
 * Moderation & Settings unified into single tab.
 */
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, BarChart3, Gauge, Radio, RefreshCw, Shield, ShieldAlert, Timer, Flag, Ban } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { adminCallQos } from "@/lib/adminApi";
import { OverviewTab } from "./chat/OverviewTab";
import { EmptyState, LoadingSkeleton, StatCard, formatDuration } from "./chat/AdminChatShared";
import { LiveStreamsTab } from "./chat/LiveStreamsTab";
import { ModerationSettingsTab } from "./chat/ModerationSettingsTab";
import { ReportsTab } from "./chat/ReportsTab";
import { BlocksTab } from "./chat/BlocksTab";

const TABS = [
  { key: "overview", icon: BarChart3, labelKey: "admin.chatManagement.tabs.overview" },
  { key: "qos", icon: Activity, labelKey: "admin.chatManagement.tabs.calls", fallbackLabel: "Call QoS" },
  { key: "streams", icon: Radio, labelKey: "admin.chatManagement.tabs.streams" },
  { key: "moderation", icon: Shield, labelKey: "admin.chatManagement.tabs.moderation" },
  { key: "reports", icon: Flag, labelKey: "admin.chats.reports" },
  { key: "blocks", icon: Ban, labelKey: "admin.chats.blocks" },
];

export function ChatManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const allowedTabs = useMemo(() => new Set(TABS.map((tab) => tab.key)), []);

  const setTab = (tabKey: string) => {
    const next = allowedTabs.has(tabKey) ? tabKey : "overview";
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
  };

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("tab") || "";
    if (fromQuery && allowedTabs.has(fromQuery)) {
      setActiveTab(fromQuery);
      return;
    }
    setTab("overview");
  }, [allowedTabs]);

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
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${isActive
                ? "bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-purple-500/30 shadow-lg shadow-purple-500/10"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? "text-purple-400" : ""}`} />
              {t(tab.labelKey, tab.fallbackLabel || tab.labelKey)}
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
          {activeTab === "qos" && <CallQosTab onNavigateTab={setTab} />}
          {activeTab === "streams" && <LiveStreamsTab />}
          {activeTab === "moderation" && <ModerationSettingsTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "blocks" && <BlocksTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

type CallQosTabProps = {
  onNavigateTab: (tab: string) => void;
};

function asNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatBucketTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}

function CallQosTab({ onNavigateTab }: CallQosTabProps) {
  const [windowMinutes, setWindowMinutes] = useState(180);
  const [bucketMinutes, setBucketMinutes] = useState(15);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [aggregation, setAggregation] = useState<any | null>(null);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [snapshotRes, aggregationRes] = await Promise.all([
        adminCallQos.getSnapshot(windowMinutes),
        adminCallQos.getAggregation(windowMinutes, bucketMinutes),
      ]);

      if (snapshotRes.success) setSnapshot(snapshotRes.data ?? null);
      if (aggregationRes.success) setAggregation(aggregationRes.data ?? null);
    } catch {
      toast.error("Failed to load call QoS data");
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [windowMinutes, bucketMinutes]);

  useEffect(() => {
    void load();
  }, [load]);

  const evaluateAlerts = async () => {
    if (evaluating) return;
    setEvaluating(true);
    try {
      const res = await adminCallQos.evaluateAlerts({ windowMinutes });
      if (res.success) {
        setEvaluation(res.data ?? null);
        const incidentCount = (res.data?.incidents ?? []).length;
        toast.success(incidentCount > 0 ? `Detected ${incidentCount} incident(s)` : "No incidents detected");
      }
    } catch {
      toast.error("Failed to evaluate QoS thresholds");
    } finally {
      setEvaluating(false);
    }
  };

  const onWindowChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setWindowMinutes(Number(e.target.value) || 180);
  };

  const onBucketChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setBucketMinutes(Number(e.target.value) || 15);
  };

  const trendRows = useMemo(() => {
    const points = aggregation?.points ?? [];
    return points.map((p: any) => ({
      time: formatBucketTime(p.bucketStart),
      totalCalls: asNumber(p.volume?.totalCalls),
      connectRatePct: asNumber(p.reliability?.connectRatePct),
      failedRatePct: asNumber(p.volume?.totalCalls) > 0
        ? Number((100 - asNumber(p.reliability?.connectRatePct)).toFixed(2))
        : 0,
      missedRatePct: asNumber(p.reliability?.missedRatePct),
      busyRatePct: asNumber(p.reliability?.busyRatePct),
    }));
  }, [aggregation]);

  if (loading) return <LoadingSkeleton />;
  if (!snapshot) return <EmptyState icon={BarChart3} message="No call QoS data found for the selected window" />;

  const callVolume = snapshot.callVolume ?? {};
  const reliability = snapshot.reliability ?? {};
  const duration = snapshot.duration ?? {};
  const queue = snapshot.matchingStats ?? {};
  const incidents = evaluation?.incidents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-xs text-white/50">Window (minutes)</label>
        <select value={windowMinutes} onChange={onWindowChange} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value={60}>60</option>
          <option value={180}>180</option>
          <option value={360}>360</option>
          <option value={720}>720</option>
          <option value={1440}>1440</option>
        </select>

        <label className="text-xs text-white/50">Bucket (minutes)</label>
        <select value={bucketMinutes} onChange={onBucketChange} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={30}>30</option>
          <option value={60}>60</option>
        </select>

        <button onClick={() => void load(true)} disabled={refreshing} className="ms-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>

        <button onClick={evaluateAlerts} disabled={evaluating} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-sm text-amber-300 disabled:opacity-60">
          <ShieldAlert className={`w-4 h-4 ${evaluating ? "animate-pulse" : ""}`} />
          Evaluate alerts
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total calls" value={asNumber(callVolume.totalCalls).toLocaleString()} icon={Activity} color="text-blue-300" bg="bg-blue-500/10 border-blue-500/20" sub={`${asNumber(callVolume.activeCalls)} active`} />
        <StatCard label="Connect rate" value={`${asNumber(reliability.connectRatePct)}%`} icon={Gauge} color="text-emerald-300" bg="bg-emerald-500/10 border-emerald-500/20" sub={`${asNumber(callVolume.endedCalls)} ended`} />
        <StatCard label="Failed calls" value={asNumber(callVolume.failedCalls).toLocaleString()} icon={AlertTriangle} color="text-red-300" bg="bg-red-500/10 border-red-500/20" sub={`${asNumber(reliability.missedRatePct)}% missed`} />
        <StatCard label="P95 duration" value={formatDuration(asNumber(duration.p95DurationSeconds))} icon={Timer} color="text-violet-300" bg="bg-violet-500/10 border-violet-500/20" sub={`Avg ${formatDuration(asNumber(duration.avgDurationSeconds))}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Reliability trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#101324", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} />
              <Line type="monotone" dataKey="connectRatePct" stroke="#34d399" strokeWidth={2} dot={false} name="Connect %" />
              <Line type="monotone" dataKey="missedRatePct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Missed %" />
              <Line type="monotone" dataKey="busyRatePct" stroke="#60a5fa" strokeWidth={2} dot={false} name="Busy %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Volume trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#101324", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} />
              <Area type="monotone" dataKey="totalCalls" stroke="#a78bfa" fill="rgba(167,139,250,0.2)" name="Total calls" />
              <Area type="monotone" dataKey="failedRatePct" stroke="#f87171" fill="rgba(248,113,113,0.18)" name="Failed %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <h3 className="text-white font-semibold">Matching queue snapshot</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-white/50">Pending users</p>
              <p className="text-white text-xl font-bold mt-1">{asNumber(queue.pendingUsers).toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-white/50">Avg wait sec</p>
              <p className="text-white text-xl font-bold mt-1">{asNumber(queue.avgWaitTimeSeconds).toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-white/40">Use this widget with reliability trend to identify if lower connect rate is tied to queue pressure.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-white font-semibold">Alert incidents</h3>
            <span className="text-xs px-2 py-1 rounded-md bg-white/10 text-white/70">{incidents.length} incident(s)</span>
          </div>

          {incidents.length === 0 ? (
            <p className="text-sm text-white/50">Run alert evaluation to detect threshold breaches for the selected window.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident: any) => (
                <div key={incident.code} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{incident.code}</p>
                  <p className="text-xs text-white/50 mt-1">{incident.details}</p>
                  <p className="text-xs mt-1 text-white/60">Value {asNumber(incident.value)} vs threshold {asNumber(incident.threshold)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => onNavigateTab("reports")} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25">Drill down: reports</button>
            <button onClick={() => onNavigateTab("moderation")} className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25">Drill down: moderation</button>
            <button onClick={() => onNavigateTab("overview")} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 text-white/75 border border-white/20 hover:bg-white/15">Drill down: overview KPIs</button>
          </div>
        </div>
      </div>
    </div>
  );
}
