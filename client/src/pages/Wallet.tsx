import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History, Coins, TrendingUp,
  Filter, Download, Send, CheckCircle2, XCircle, AlertCircle,
  Navigation, Rocket, Plane, Compass, Globe2, Star, Crown,
  Zap, CreditCard, Wallet as WalletIcon, ChevronDown, Eye, EyeOff,
  BadgeDollarSign, Gift, Plus, Minus, RefreshCw, Search, Copy, Check,
  X, BarChart3, CalendarDays, Share2, Ban, DollarSign, Shield,
} from "lucide-react";
import coinImg from "@/assets/images/coin-3d.png";
import { useTranslation } from "react-i18next";
import { walletApi } from "@/lib/socialApi";
import { toast } from "sonner";

import { GlassCard, ShimmerButton, CountUp, Skeleton, SkeletonCard, SkeletonGrid } from "./wallet/components";
import { useStatusBadge, useTxMeta, validateUsdtAddress, haptic, useEscapeKey } from "./wallet/helpers";
import { useWalletBalance, useWalletTransactions, useWithdrawFlow, useIncomeData, useRechargeData } from "./wallet/hooks";
import type { WalletTab, ChartPeriod, DateRange } from "./wallet/types";

/* ─── Main Wallet Page ─── */
export function Wallet() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const touchStartY = useRef(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { getStatusBadge } = useStatusBadge();
  const { getTxMeta, getMethodLabel } = useTxMeta();

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<WalletTab>("recharge");

  // ── Custom hooks ──
  const { balance, balanceLoading, balanceHidden, setBalanceHidden, loadBalance } = useWalletBalance();
  const {
    txLoading, txHasMore, txLoadingMore, loadMoreTx,
    txFilter, setTxFilter, txSearch, setTxSearch,
    dateRange, setDateRange,
    selectedTx, setSelectedTx, copiedTxId,
    filteredTx, copyTxId, handleShareReceipt,
    refreshTransactions,
  } = useWalletTransactions(activeTab);
  const {
    withdrawAmount, withdrawDisplayAmount, withdrawMethod, setWithdrawMethod,
    availableWithdrawMethods,
    withdrawSubmitting, withdrawError, withdrawSuccess,
    showWithdrawConfirm, setShowWithdrawConfirm,
    bankName, setBankName, accountNumber, setAccountNumber, accountHolder, setAccountHolder,
    paypalEmail, setPaypalEmail, usdtNetwork, setUsdtNetwork, usdtAddress, setUsdtAddress, usdtError, setUsdtError,
    customPaymentDetails, setCustomPaymentDetails,
    withdrawalRequests, wrLoading, wrHasMore, wrLoadingMore, cancellingWr,
    withdrawLimits, conversionRate,
    handleWithdrawAmountChange, setQuickAmount,
    handleWithdrawConfirm, handleWithdraw, handleCancelWithdraw,
    loadMoreWr, refreshWithdrawals,
  } = useWithdrawFlow(activeTab, balance, loadBalance);
  const {
    income, incomeLoading,
    totalSpent, spendingBreakdown,
    incomeChart, incomeChartLoading,
    chartPeriod, setChartPeriod,
    refreshIncome,
  } = useIncomeData(activeTab);
  const {
    packages, milesPackages, milesLoading,
    handlePurchase, handleMilesPurchase,
    refreshMiles,
  } = useRechargeData(activeTab, loadBalance);

  // #11: Close modals on Escape key
  useEscapeKey(() => {
    if (selectedTx) setSelectedTx(null);
    else if (showWithdrawConfirm) setShowWithdrawConfirm(false);
  });

  // ── Pull-to-refresh ──
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 60 && window.scrollY === 0) setIsPulling(true);
  };
  const handleTouchEnd = async () => {
    if (isPulling && !isRefreshing) {
      setIsRefreshing(true);
      setIsPulling(false);
      await loadBalance();
      if (activeTab === "history") refreshTransactions();
      else if (activeTab === "income") refreshIncome();
      else if (activeTab === "withdraw") refreshWithdrawals();
      else if (activeTab === "miles") refreshMiles();
      haptic();
      toast.success(t("wallet.title"), { description: t("wallet.refreshed") });
      setIsRefreshing(false);
    }
    setIsPulling(false);
  };

  // Quick amount buttons
  const quickAmounts = [
    { label: "25%", pct: 0.25 },
    { label: "50%", pct: 0.50 },
    { label: "75%", pct: 0.75 },
    { label: "MAX", pct: 1.0 },
  ];

  // ── Helpers ──
  const tabs: { key: WalletTab; icon: React.ReactNode; label: string }[] = [
    { key: "recharge", icon: <Plus className="w-4 h-4" />, label: t("wallet.tabRecharge") },
    { key: "miles", icon: <Navigation className="w-4 h-4" />, label: t("wallet.tabMiles") },
    { key: "history", icon: <History className="w-4 h-4" />, label: t("wallet.tabHistory") },
    { key: "income", icon: <TrendingUp className="w-4 h-4" />, label: t("wallet.tabIncome") },
    { key: "withdraw", icon: <Send className="w-4 h-4" />, label: t("wallet.tabWithdraw") },
  ];

  const tierIcons = [Compass, Plane, Rocket, Star, Crown, Zap];

  const resolveMethodLabel = (id: string | null | undefined) => {
    if (!id) return "-";
    const found = availableWithdrawMethods.find((m) => m.id === id);
    return found?.nameAr || found?.name || getMethodLabel(id);
  };

  // Income chart max for scaling
  const chartMax = Math.max(...incomeChart.map(d => d.total), 1);

  // Chart period options
  const chartPeriods: { days: ChartPeriod; label: string }[] = [
    { days: 7, label: t("wallet.last7Days") },
    { days: 30, label: t("wallet.last30Days") },
    { days: 90, label: t("wallet.last90Days") },
  ];

  // Date range options
  const dateRangeOptions: { key: DateRange; label: string }[] = [
    { key: "all", label: t("wallet.allTime") },
    { key: "today", label: t("wallet.today") },
    { key: "week", label: t("wallet.thisWeek") },
    { key: "month", label: t("wallet.thisMonth") },
  ];

  return (
    <div className="min-h-screen space-y-6 animate-in fade-in duration-700 pb-12 max-w-5xl mx-auto" dir={dir}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(isPulling || isRefreshing) && (
          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className="flex justify-center py-3">
            <RefreshCw className={`w-6 h-6 text-violet-400 ${isRefreshing ? "animate-spin" : ""}`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════ */}
      {/* HERO BALANCE CARD                              */}
      {/* ═══════════════════════════════════════════════ */}
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
        <div className="relative rounded-[2.5rem] overflow-hidden">
          <div className="absolute inset-0 bg-[#060614]" />

          {/* Animated aurora blobs */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div animate={{ x: [0, 60, 0], y: [0, -30, 0], scale: [1, 1.3, 1] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-1/4 -right-1/4 w-[70%] h-[70%] bg-gradient-to-br from-violet-600/30 via-purple-500/20 to-fuchsia-500/10 blur-[120px] rounded-full" />
            <motion.div animate={{ x: [0, -40, 0], y: [0, 40, 0], scale: [1.2, 0.9, 1.2] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-1/4 -left-1/4 w-[60%] h-[60%] bg-gradient-to-tr from-cyan-500/20 via-blue-500/15 to-indigo-500/10 blur-[120px] rounded-full" />
            <motion.div animate={{ x: [0, 30, -30, 0], y: [0, -20, 20, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/3 left-1/3 w-[40%] h-[40%] bg-gradient-to-r from-amber-500/10 to-yellow-400/5 blur-[100px] rounded-full" />
          </div>

          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")` }} />

          {/* Floating orbs */}
          {[...Array(8)].map((_, i) => (
            <motion.div key={i} className="absolute rounded-full bg-white/[0.04]"
              style={{ width: 4 + i * 2, height: 4 + i * 2, left: `${10 + i * 11}%`, top: `${15 + (i % 4) * 20}%` }}
              animate={{ y: [0, -25, 0], opacity: [0.1, 0.4, 0.1], scale: [1, 1.5, 1] }}
              transition={{ duration: 4 + i * 0.7, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
            />
          ))}

          {/* Content */}
          <div className="relative z-10 p-8 md:p-10 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
                  <WalletIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold tracking-wider uppercase">{t("wallet.currentBalance")}</p>
                  {balanceLoading ? (
                    <Skeleton className="h-10 w-48 mt-2" />
                  ) : (
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-4xl md:text-5xl font-black text-white tracking-tight">
                        {balanceHidden ? "•••••" : <CountUp value={balance.coins} />}
                      </p>
                      <img src={coinImg} alt="" className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setBalanceHidden(!balanceHidden)}
                  className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
                  {balanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => { loadBalance(); haptic(); toast.success(t("wallet.refreshed")); }}
                  className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t("wallet.myDiamonds", "ماساتي"), value: balance.diamonds, color: "text-emerald-400", gradient: "from-emerald-500/15 to-emerald-500/5", border: "border-emerald-500/10", icon: <Plus className="w-3.5 h-3.5" /> },
                { label: t("wallet.totalSpentAll"), value: totalSpent, color: "text-red-400", gradient: "from-red-500/15 to-red-500/5", border: "border-red-500/10", icon: <Minus className="w-3.5 h-3.5" /> },
                { label: t("wallet.tabMiles"), value: balance.miles, color: "text-cyan-400", gradient: "from-cyan-500/15 to-cyan-500/5", border: "border-cyan-500/10", icon: <Navigation className="w-3.5 h-3.5" /> },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.08 }}>
                  <div className={`bg-gradient-to-br ${stat.gradient} border ${stat.border} rounded-2xl p-3.5 space-y-1.5`}>
                    <div className={`${stat.color} opacity-70`}>{stat.icon}</div>
                    <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-lg font-black ${stat.color}`}>{balanceHidden ? "•••" : stat.value.toLocaleString()}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════ */}
      {/* TABS                                           */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="flex gap-1.5 p-1.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-x-auto hide-scrollbar">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap flex-1 justify-center
              ${activeTab === tab.key ? "text-white" : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"}`}>
            {activeTab === tab.key && (
              <motion.div layoutId="walletTab" className="absolute inset-0 bg-white/[0.08] border border-white/[0.1] rounded-xl" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />
            )}
            <span className="relative z-10 flex items-center gap-2">{tab.icon} <span className="hidden sm:inline">{tab.label}</span></span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB CONTENT                                    */}
      {/* ═══════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">

        {/* ──────── RECHARGE TAB ──────── */}
        {activeTab === "recharge" && (
          <motion.div key="recharge" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
            {/* #5: Coming Soon overlay */}
            <GlassCard className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/15 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">{t("wallet.comingSoon", "قريباً")}</h3>
              <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
                {t("wallet.rechargeComingSoon", "خدمة الشحن قيد التطوير وستكون متاحة قريباً. ترقبوا!")}
              </p>
            </GlassCard>
          </motion.div>
        )}

        {/* ──────── MILES TAB ──────── */}
        {activeTab === "miles" && (
          <motion.div key="miles" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
            {milesLoading ? (
              <SkeletonGrid count={6} />
            ) : milesPackages.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {milesPackages.map((pkg, i) => {
                  const TierIcon = tierIcons[i % tierIcons.length];
                  return (
                    <motion.div key={pkg.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}>
                      <GlassCard onClick={() => handleMilesPurchase(pkg)} className="p-5 hover:bg-white/[0.06] transition-all cursor-pointer active:scale-95 border-cyan-500/5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/10 flex items-center justify-center">
                            <TierIcon className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-white font-black text-lg">{pkg.miles.toLocaleString()}</p>
                            <p className="text-white/25 text-xs">{t("wallet.milesUnit")}</p>
                          </div>
                        </div>
                        <p className="text-cyan-400 font-bold text-sm">{pkg.price}</p>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <GlassCard className="p-8 text-center">
                <Navigation className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/25 text-sm">{t("common.noResults")}</p>
              </GlassCard>
            )}

            {/* Miles info */}
            <GlassCard className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Globe2 className="w-5 h-5 text-cyan-400" /> {t("wallet.milesInfoTitle")}</h3>
              <p className="text-white/30 text-sm leading-relaxed">{t("wallet.milesInfoDesc")}</p>
              <div className="grid grid-cols-3 gap-3">
                {["milesUse1", "milesUse2", "milesUse3"].map((k, i) => (
                  <div key={k} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                    <p className="text-cyan-400 text-xs font-bold">{t(`wallet.${k}`)}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ──────── HISTORY TAB ──────── */}
        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input type="text" value={txSearch} onChange={e => setTxSearch(e.target.value)}
                placeholder={t("wallet.searchTransactions")}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl py-3.5 ps-11 pe-4 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/15" />
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
              <Filter className="w-4 h-4 text-white/25 shrink-0" />
              {[
                { key: "all", label: t("wallet.filterAll") },
                { key: "recharge", label: t("wallet.filterRecharge") },
                { key: "gift_sent", label: t("wallet.filterGiftSent") },
                { key: "gift_received", label: t("wallet.filterGiftReceived") },
                { key: "withdrawal", label: t("wallet.filterWithdrawal") },
                { key: "commission", label: t("wallet.filterCommission") },
              ].map(f => (
                <button key={f.key} onClick={() => setTxFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    txFilter === f.key
                      ? "bg-violet-600/80 text-white border border-violet-500/50"
                      : "bg-white/[0.04] text-white/30 border border-white/[0.06] hover:text-white/60"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* 9: Date range filter */}
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              <CalendarDays className="w-4 h-4 text-white/25 shrink-0" />
              {dateRangeOptions.map(dr => (
                <button key={dr.key} onClick={() => setDateRange(dr.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    dateRange === dr.key
                      ? "bg-cyan-600/80 text-white border border-cyan-500/50"
                      : "bg-white/[0.04] text-white/30 border border-white/[0.06] hover:text-white/60"
                  }`}>
                  {dr.label}
                </button>
              ))}
            </div>

            {/* Transactions list */}
            {txLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredTx.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <History className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/25 text-sm">{t("wallet.noTransactions")}</p>
              </GlassCard>
            ) : (
              <div className="space-y-2.5">
                {filteredTx.map((tx, i) => {
                  const meta = getTxMeta(tx);
                  return (
                    <motion.div key={tx.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04] hover:bg-white/[0.04] transition-all cursor-pointer active:scale-[0.98]"
                        onClick={() => setSelectedTx(tx)}>
                        {meta.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{meta.label}</p>
                          <p className="text-white/20 text-xs mt-0.5">{tx.createdAt ? new Date(tx.createdAt).toLocaleString(i18n.language) : ""}</p>
                        </div>
                        <div className="text-end shrink-0 space-y-1">
                          <p className={`font-black text-sm ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount?.toLocaleString()}
                          </p>
                          {getStatusBadge(tx.status)}
                        </div>
                        {tx.id && (
                          <button onClick={(e) => { e.stopPropagation(); copyTxId(tx.id); }}
                            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/20 hover:text-white/50 transition-all shrink-0">
                            {copiedTxId === tx.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {txHasMore && (
                  <button onClick={loadMoreTx} disabled={txLoadingMore}
                    className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white/30 text-sm font-bold hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2">
                    {txLoadingMore ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    {t("wallet.loadMore")}
                  </button>
                )}
              </div>
            )}

            {/* #1: Server-side CSV Export */}
            <a href={walletApi.exportTransactionsCsv()} download
              className="flex items-center gap-2 text-sm text-violet-400 font-bold hover:text-violet-300 transition-colors">
              <Download className="w-4 h-4" /> {t("wallet.exportHistory")}
            </a>
          </motion.div>
        )}

        {/* ──────── INCOME TAB ──────── */}
        {activeTab === "income" && (
          <motion.div key="income" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
            {incomeLoading ? (
              <SkeletonGrid count={4} />
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: t("wallet.incomeTotal"), value: income.totalReceived, color: "text-white", gradient: "from-violet-500/20 to-purple-500/5", border: "border-violet-500/10", icon: <BadgeDollarSign className="w-6 h-6" /> },
                  { label: t("wallet.incomeThisMonth"), value: income.monthReceived, color: "text-emerald-400", gradient: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/10", icon: <TrendingUp className="w-6 h-6" /> },
                  { label: t("wallet.incomeThisWeek"), value: income.weekReceived, color: "text-amber-400", gradient: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/10", icon: <Gift className="w-6 h-6" /> },
                  { label: t("wallet.incomeToday"), value: income.todayReceived, color: "text-violet-400", gradient: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/10", icon: <Zap className="w-6 h-6" /> },
                ].map((card, i) => (
                  <motion.div key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}>
                    <GlassCard className={`p-6 bg-gradient-to-br ${card.gradient} border ${card.border}`}>
                      <div className={`${card.color} mb-4 opacity-60`}>{card.icon}</div>
                      <p className="text-white/35 text-xs font-bold mb-2">{card.label}</p>
                      <p className={`text-3xl font-black ${card.color}`}>{card.value.toLocaleString()}</p>
                      <p className="text-white/20 text-xs mt-1">{t("common.coins")}</p>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 10: Income Chart with period switcher */}
            <GlassCard className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-400" />
                  {t("wallet.incomeChart")}
                </h3>
                {/* Period switcher */}
                <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-0.5">
                  {chartPeriods.map(cp => (
                    <button key={cp.days} onClick={() => setChartPeriod(cp.days)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        chartPeriod === cp.days
                          ? "bg-violet-600/80 text-white"
                          : "text-white/30 hover:text-white/60"
                      }`}>
                      {cp.days}d
                    </button>
                  ))}
                </div>
              </div>
              {incomeChartLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : incomeChart.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-white/20 text-sm">{t("wallet.noIncomeData")}</p>
                </div>
              ) : (
                <div className="h-48 flex items-end gap-1 overflow-x-auto hide-scrollbar pb-6 relative">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-white/20 font-mono w-8">
                    <span>{chartMax.toLocaleString()}</span>
                    <span>{Math.round(chartMax / 2).toLocaleString()}</span>
                    <span>0</span>
                  </div>
                  <div className="flex items-end gap-1 flex-1 ms-10">
                    {incomeChart.map((d, i) => {
                      const h = Math.max((d.total / chartMax) * 100, 2);
                      return (
                        <motion.div key={d.day} className="flex-1 min-w-[8px] flex flex-col items-center gap-1"
                          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.02, duration: 0.4 }} style={{ originY: 1 }}>
                          <div className="w-full relative group">
                            {/* Tooltip */}
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1a1a3e] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                              {d.total.toLocaleString()} • {new Date(d.day).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                            </div>
                            <div className={`w-full rounded-t-md transition-all duration-200 group-hover:opacity-100 ${
                              d.total > 0 ? "bg-gradient-to-t from-violet-600 to-violet-400 opacity-70" : "bg-white/[0.06] opacity-40"
                            }`} style={{ height: `${h}%`, minHeight: 3 }} />
                          </div>
                          {i % 5 === 0 && (
                            <span className="text-[8px] text-white/15 font-mono whitespace-nowrap">
                              {new Date(d.day).toLocaleDateString(i18n.language, { day: "numeric" })}
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* #12: Spending Breakdown Chart */}
            {spendingBreakdown.length > 0 && (
              <GlassCard className="p-5 md:p-6">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-400" /> {t("wallet.spendingBreakdown", "توزيع الإنفاق")}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const maxVal = Math.max(...spendingBreakdown.map(s => Math.abs(Number(s.total))), 1);
                    const colors = ["bg-violet-500", "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-emerald-500", "bg-red-500", "bg-blue-500"];
                    return spendingBreakdown.map((item, i) => {
                      const absTotal = Math.abs(Number(item.total));
                      const pct = Math.round((absTotal / maxVal) * 100);
                      return (
                        <div key={item.type} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60 capitalize">{t(`wallet.txType_${item.type}`, item.type.replace(/_/g, " "))}</span>
                            <span className="text-white font-bold">{absTotal.toLocaleString()} <span className="text-white/30 font-normal">({item.count}×)</span></span>
                          </div>
                          <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: i * 0.1 }}
                              className={`h-full rounded-full ${colors[i % colors.length]}`}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* ──────── WITHDRAW TAB ──────── */}
        {activeTab === "withdraw" && (
          <motion.div key="withdraw" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
            {/* Available Balance */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10 flex items-center justify-center">
                  <Coins className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/35 text-xs font-bold">{t("wallet.availableWithdraw")}</p>
                  <p className="text-3xl font-black text-emerald-400 mt-1">{balance.coins.toLocaleString()} <span className="text-sm text-white/30 font-medium">{t("common.coins")}</span></p>
                </div>
              </div>
            </GlassCard>

            {/* #15: Withdrawal Limits Display */}
            {withdrawLimits && (
              <GlassCard className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-white/40 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> {t("wallet.withdrawLimits", "حدود السحب")}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[10px] text-white/30 font-bold mb-1">{t("wallet.dailyLimit", "اليومي")}</p>
                    <div className="w-full bg-white/[0.06] rounded-full h-1.5 mb-1">
                      <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (withdrawLimits.dailyUsed / withdrawLimits.dailyLimit) * 100)}%` }} />
                    </div>
                    <p className="text-xs font-bold text-white/50">
                      <span className="text-violet-400">{withdrawLimits.dailyRemaining.toLocaleString()}</span> / {withdrawLimits.dailyLimit.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[10px] text-white/30 font-bold mb-1">{t("wallet.weeklyLimit", "الأسبوعي")}</p>
                    <div className="w-full bg-white/[0.06] rounded-full h-1.5 mb-1">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (withdrawLimits.weeklyUsed / withdrawLimits.weeklyLimit) * 100)}%` }} />
                    </div>
                    <p className="text-xs font-bold text-white/50">
                      <span className="text-emerald-400">{withdrawLimits.weeklyRemaining.toLocaleString()}</span> / {withdrawLimits.weeklyLimit.toLocaleString()}
                    </p>
                  </div>
                </div>
                {withdrawLimits.hasActiveRequest && (
                  <p className="text-[10px] text-amber-400/70 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {t("wallet.hasActiveWithdrawal", "لديك طلب سحب قيد المعالجة")}
                  </p>
                )}
              </GlassCard>
            )}

            {/* Form */}
            <GlassCard className="p-6 md:p-8 space-y-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-violet-400" /> {t("wallet.requestWithdraw")}
              </h3>

              {/* Amount with number formatting */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-white/50">{t("wallet.withdrawAmount")}</label>
                <div className="relative">
                  <input type="text" value={withdrawDisplayAmount} onChange={handleWithdrawAmountChange} placeholder="1,000"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl py-4 px-6 text-white text-xl font-bold focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all placeholder:text-white/15" dir="ltr" />
                  <span className="absolute end-5 top-1/2 -translate-y-1/2 text-white/20 text-xs font-bold">{t("common.coins")}</span>
                </div>

                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {quickAmounts.map(qa => (
                    <button key={qa.label} onClick={() => setQuickAmount(qa.pct)}
                      className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 text-xs font-bold hover:text-white/70 hover:bg-white/[0.08] transition-all active:scale-95">
                      {qa.label}
                    </button>
                  ))}
                </div>

                <p className="text-white/20 text-xs">{t("wallet.minWithdraw")}: 1,000 {t("common.coins")}</p>
                {withdrawAmount && Number(withdrawAmount) > 0 && (
                  <div className="flex items-center gap-2 bg-violet-500/5 border border-violet-500/10 rounded-xl px-4 py-2 mt-1">
                    <DollarSign className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                    <p className="text-violet-300 text-xs font-medium">
                      ≈ ${(Number(withdrawAmount) / conversionRate).toFixed(2)} USD
                      <span className="text-white/20 mx-1">•</span>
                      <span className="text-white/30">{t("wallet.conversionNote")}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Method */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-white/50">{t("wallet.withdrawMethod")}</label>
                <div className="grid grid-cols-3 gap-3">
                  {(availableWithdrawMethods.length > 0 ? availableWithdrawMethods : [
                    { id: "bank", nameAr: t("wallet.methodBank"), icon: "💳" },
                    { id: "paypal", name: "PayPal", icon: "🅿️" },
                    { id: "usdt", name: "USDT", icon: "🪙" },
                  ]).map((m: any) => (
                    <button key={m.id || m.key} onClick={() => setWithdrawMethod(m.id || m.key)}
                      className={`py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 border flex items-center justify-center gap-2 ${
                        withdrawMethod === (m.id || m.key)
                          ? "bg-violet-600/80 text-white border-violet-500/50 shadow-md shadow-violet-500/15"
                          : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/70 hover:bg-white/[0.06]"
                      }`}>
                      {m.id === "bank" ? <CreditCard className="w-4 h-4" /> : m.id === "paypal" ? <BadgeDollarSign className="w-4 h-4" /> : m.id === "usdt" ? <Coins className="w-4 h-4" /> : <WalletIcon className="w-4 h-4" />} {(m.nameAr || m.name)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Method Fields */}
              <AnimatePresence mode="wait">
                {withdrawMethod === "bank" && (
                  <motion.div key="bank" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                    <input placeholder={t("wallet.bankName")} value={bankName} onChange={e => setBankName(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" />
                    <input placeholder={t("wallet.accountNumber")} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" dir="ltr" />
                    <input placeholder={t("wallet.accountHolder")} value={accountHolder} onChange={e => setAccountHolder(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" />
                  </motion.div>
                )}
                {withdrawMethod === "paypal" && (
                  <motion.div key="paypal" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <input placeholder={t("wallet.paypalEmail")} type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20" dir="ltr" />
                  </motion.div>
                )}
                {withdrawMethod === "usdt" && (
                  <motion.div key="usdt" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                    <select value={usdtNetwork} onChange={e => { setUsdtNetwork(e.target.value); setUsdtError(null); }} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all">
                      <option value="trc20" className="bg-[#0c0c1f]">TRC-20</option>
                      <option value="erc20" className="bg-[#0c0c1f]">ERC-20</option>
                      <option value="bep20" className="bg-[#0c0c1f]">BEP-20</option>
                    </select>
                    <input placeholder={t("wallet.walletAddress")} value={usdtAddress}
                      onChange={e => { setUsdtAddress(e.target.value); setUsdtError(null); }}
                      className={`w-full bg-white/[0.04] border rounded-xl py-3.5 px-5 text-white text-sm focus:outline-none transition-all placeholder:text-white/20 ${
                        usdtError ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.08] focus:border-violet-500/50"
                      }`} dir="ltr" />
                    {usdtError && (
                      <p className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> {usdtError}</p>
                    )}
                    {usdtAddress && !usdtError && (
                      <p className={`text-xs flex items-center gap-1 ${
                        validateUsdtAddress(usdtAddress, usdtNetwork)
                          ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {validateUsdtAddress(usdtAddress, usdtNetwork) ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {validateUsdtAddress(usdtAddress, usdtNetwork)
                          ? usdtNetwork.toUpperCase()
                          : `${usdtNetwork.toUpperCase()}`}
                      </p>
                    )}
                  </motion.div>
                )}
                {!["bank", "paypal", "usdt"].includes(withdrawMethod) && (
                  <motion.div key="custom" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <textarea
                      placeholder={t("wallet.paymentInstructions", "تفاصيل وسيلة الدفع")}
                      value={customPaymentDetails}
                      onChange={(e) => setCustomPaymentDetails(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20 resize-none h-24"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <ShimmerButton
                onClick={handleWithdrawConfirm}
                disabled={!withdrawAmount || Number(withdrawAmount) < 1000 || withdrawSubmitting}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-violet-500/30 transition-all flex items-center justify-center gap-2">
                <Send className="w-5 h-5" />
                {withdrawSubmitting ? t("common.sending") : t("wallet.submitWithdraw")}
              </ShimmerButton>

              {/* Messages */}
              <AnimatePresence>
                {withdrawError && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/15 px-4 py-3 rounded-2xl">
                    <XCircle className="w-4 h-4 shrink-0" /> {withdrawError}
                  </motion.div>
                )}
                {withdrawSuccess && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-500/10 border border-emerald-500/15 px-4 py-3 rounded-2xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {t("wallet.withdrawSuccess")}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Note */}
              <div className="flex items-start gap-3 text-white/20 text-xs p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400/50" />
                <p className="leading-relaxed">{t("wallet.withdrawNote")}</p>
              </div>
            </GlassCard>

            {/* Withdrawal Requests History with pagination + cancel */}
            <GlassCard className="p-6 space-y-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                {t("wallet.withdrawalHistory")}
              </h3>

              {wrLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : withdrawalRequests.length === 0 ? (
                <div className="py-8 text-center">
                  <Send className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/25 text-sm">{t("wallet.noWithdrawals")}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {withdrawalRequests.map((wr, i) => (
                    <motion.div key={wr.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04] hover:bg-white/[0.04] transition-all">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/10 flex items-center justify-center">
                          <Send className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm">{wr.amount?.toLocaleString()} {t("common.coins")}</p>
                          <p className="text-white/20 text-xs mt-0.5">{wr.createdAt ? new Date(wr.createdAt).toLocaleString(i18n.language) : ""}</p>
                          {wr.paymentMethodId && <p className="text-white/15 text-[10px] mt-0.5">{resolveMethodLabel(wr.paymentMethodId)}</p>}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {getStatusBadge(wr.status)}
                          {/* Cancel button for pending withdrawals */}
                          {wr.status === "pending" && (
                            <button
                              onClick={() => {
                                if (confirm(t("wallet.cancelWithdrawConfirm"))) {
                                  handleCancelWithdraw(wr.id);
                                }
                              }}
                              disabled={cancellingWr === wr.id}
                              className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                              title={t("wallet.cancelWithdraw")}>
                              {cancellingWr === wr.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Pagination for withdrawal requests */}
                  {wrHasMore && (
                    <button onClick={loadMoreWr} disabled={wrLoadingMore}
                      className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white/30 text-sm font-bold hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2">
                      {wrLoadingMore ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                      {t("wallet.loadMore")}
                    </button>
                  )}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════ */}
      {/* WITHDRAW CONFIRMATION DIALOG                   */}
      {/* ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {showWithdrawConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setShowWithdrawConfirm(false)}>
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} transition={{ type: "spring", bounce: 0.2 }}
              className="bg-gradient-to-br from-[#12122e] to-[#0a0a1f] border border-white/10 rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
              
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/15 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-white font-black text-lg">{t("wallet.confirmWithdrawTitle")}</h4>
                  <p className="text-white/40 text-sm mt-0.5">{t("wallet.confirmWithdrawDesc")}</p>
                </div>
              </div>

              <div className="bg-white/[0.04] rounded-2xl p-5 space-y-3 border border-white/[0.06]">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">{t("wallet.withdrawAmount")}</span>
                  <span className="text-white font-black">{Number(withdrawAmount).toLocaleString()} {t("common.coins")}</span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">{t("wallet.withdrawMethod")}</span>
                  <span className="text-white font-black">{resolveMethodLabel(withdrawMethod)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowWithdrawConfirm(false)}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-white/60 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
                  {t("common.cancel")}
                </button>
                <button onClick={handleWithdraw}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/20">
                  {t("wallet.confirmWithdraw")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════ */}
      {/* TRANSACTION DETAIL MODAL                       */}
      {/* ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setSelectedTx(null)}>
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} transition={{ type: "spring", bounce: 0.2 }}
              className="bg-gradient-to-br from-[#12122e] to-[#0a0a1f] border border-white/10 rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
              
              <div className="flex items-center justify-between">
                <h4 className="text-white font-black text-lg">{t("wallet.transactionDetails")}</h4>
                <button onClick={() => setSelectedTx(null)} className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center py-4">
                <p className={`text-4xl font-black ${selectedTx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {selectedTx.amount > 0 ? "+" : ""}{selectedTx.amount?.toLocaleString()}
                </p>
                <p className="text-white/30 text-sm mt-1">{t("common.coins")}</p>
              </div>

              <div className="bg-white/[0.04] rounded-2xl p-5 space-y-3 border border-white/[0.06]">
                {[
                  { label: t("wallet.txType"), value: getTxMeta(selectedTx).label },
                  { label: t("wallet.txStatus"), value: getStatusBadge(selectedTx.status) as any },
                  { label: t("wallet.txDate"), value: selectedTx.createdAt ? new Date(selectedTx.createdAt).toLocaleString(i18n.language) : "-" },
                  { label: t("wallet.balanceAfter"), value: selectedTx.balanceAfter?.toLocaleString() || "-" },
                  ...(selectedTx.type === "withdrawal" ? [{ label: t("wallet.txPaymentMethod"), value: getMethodLabel(selectedTx.paymentMethod) }] : []),
                  { label: t("wallet.txId"), value: selectedTx.id?.slice(0, 16) + "..." || "-" },
                ].map((row, i) => (
                  <div key={i}>
                    {i > 0 && <div className="h-px bg-white/[0.04] mb-3" />}
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-white/40">{row.label}</span>
                      <span className="text-white font-bold text-end max-w-[60%] truncate">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                {selectedTx.id && (
                  <button onClick={() => copyTxId(selectedTx.id)}
                    className="flex-1 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white/50 text-sm font-bold hover:bg-white/[0.08] hover:text-white/80 transition-all flex items-center justify-center gap-2">
                    {copiedTxId === selectedTx.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedTxId === selectedTx.id ? t("wallet.copied") : t("wallet.copyTxId")}
                  </button>
                )}
                {/* 16: Share receipt */}
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button onClick={() => handleShareReceipt(selectedTx)}
                    className="py-3 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white/50 text-sm font-bold hover:bg-white/[0.08] hover:text-white/80 transition-all flex items-center justify-center gap-2">
                    <Share2 className="w-4 h-4" /> {t("wallet.shareReceipt")}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

