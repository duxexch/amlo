import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, ArrowUpRight, Clock, Gift, Coins, Diamond, Loader2,
} from "lucide-react";
import { adminFinanceStats } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FinanceStats } from "./financeTypes";

// ════════════════════════════════════════════════════════════
// FINANCIAL DASHBOARD — لوحة المالية
// ════════════════════════════════════════════════════════════

export function FinancialDashboard({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await adminFinanceStats.get();
      if (res?.data) {
        setStats(res.data);
        setLastUpdated(new Date());
      }
    } catch {
      toast.error(t("common.networkError", "خطأ في الاتصال"));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats, refreshSignal]);

  // #13: Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  // #18: Growth indicators
  const weekGrowth = stats.comparison?.weekGrowth ?? null;
  const monthGrowth = stats.comparison?.monthGrowth ?? null;

  interface DashCard {
    label: string;
    value: number;
    icon: typeof DollarSign;
    color: string;
    bg: string;
    suffix?: string;
    growth?: number | null;
  }

  const cards: DashCard[] = [
    { label: t("admin.finances.dashTotalRevenue"), value: stats.revenue?.total || 0, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: t("admin.finances.dashTodayRevenue"), value: stats.revenue?.today || 0, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
    {
      label: t("admin.finances.dashMonthRevenue"), value: stats.revenue?.month || 0, icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10",
      growth: monthGrowth
    },
    { label: t("admin.finances.dashTotalWithdrawn"), value: stats.withdrawn || 0, icon: ArrowUpRight, color: "text-red-400", bg: "bg-red-500/10" },
    { label: t("admin.finances.dashPendingWithdrawals"), value: stats.withdrawals?.pending || 0, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", suffix: ` (${(stats.withdrawals?.pendingAmount || 0).toLocaleString()} ${t("admin.finances.coins")})` },
    { label: t("admin.finances.dashGiftVolume"), value: stats.giftVolume || 0, icon: Gift, color: "text-pink-400", bg: "bg-pink-500/10" },
    { label: t("admin.finances.dashTotalCoins"), value: stats.circulation?.totalCoins || 0, icon: Coins, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: t("admin.finances.dashTotalDiamonds"), value: stats.circulation?.totalDiamonds || 0, icon: Diamond, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  return (
    <div className="space-y-1.5">
      {lastUpdated && (
        <div className="flex justify-end">
          <span className="text-[10px] text-white/25">{t("admin.finances.lastUpdated", "آخر تحديث")}: {lastUpdated.toLocaleTimeString(i18n.language)}</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center gap-3"
          >
            <div className={`${c.bg} p-2 rounded-lg`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 truncate">{c.label}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-white">{c.value.toLocaleString()}{c.suffix || ""}</p>
                {c.growth !== undefined && c.growth !== null && (
                  <span className={`text-[9px] font-bold ${c.growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {c.growth >= 0 ? "↑" : "↓"}{Math.abs(c.growth)}%
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
