import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History, ShieldCheck, ArrowDownLeft, ArrowUpRight, Coins, TrendingUp,
  Filter, Download, Send, Clock, CheckCircle2, XCircle, AlertCircle,
  Navigation, Rocket, Plane, Compass, Globe2, Star, Crown,
  Zap, CreditCard, Wallet as WalletIcon, ChevronDown, Eye, EyeOff,
  BadgeDollarSign, Gift, Plus, Minus, RefreshCw, Search, Copy, Check,
  X, BarChart3, CalendarDays, Share2, Ban,
} from "lucide-react";
import coinImg from "@/assets/images/coin-3d.png";
import { useTranslation } from "react-i18next";
import { walletApi } from "@/lib/socialApi";
import { getSocket } from "@/lib/socketManager";
import { toast } from "sonner";

import { GlassCard, ShimmerButton, CountUp, Skeleton, SkeletonCard, SkeletonGrid } from "./wallet/components";
import { useStatusBadge, useTxMeta, validateUsdtAddress, formatWithdrawAmount, parseWithdrawAmount, getDateRangeStart, haptic, shareReceipt, biometricConfirm, saveWithdrawPrefs, loadWithdrawPrefs } from "./wallet/helpers";
import type { WalletTab, WalletBalance, IncomeStats, ChartDataPoint, ChartPeriod, DateRange, RechargePackage, MilesPackage, WalletTransaction, WithdrawalRequest } from "./wallet/types";

/* ─── Main Wallet Page ─── */
export function Wallet() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const touchStartY = useRef(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { getStatusBadge } = useStatusBadge();
  const { getTxMeta, getMethodLabel } = useTxMeta();

  // ── State ──
  const [activeTab, setActiveTab] = useState<WalletTab>("recharge");
  const [txFilter, setTxFilter] = useState("all");
  const [txSearch, setTxSearch] = useState("");
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDisplayAmount, setWithdrawDisplayAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [usdtNetwork, setUsdtNetwork] = useState("trc20");
  const [usdtAddress, setUsdtAddress] = useState("");
  const [usdtError, setUsdtError] = useState<string | null>(null);

  // Data
  const [balance, setBalance] = useState<WalletBalance>({ coins: 0, diamonds: 0 });
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txHasMore, setTxHasMore] = useState(true);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [income, setIncome] = useState<IncomeStats>({ totalReceived: 0, todayReceived: 0, weekReceived: 0, monthReceived: 0 });
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeChart, setIncomeChart] = useState<ChartDataPoint[]>([]);
  const [incomeChartLoading, setIncomeChartLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>(30);
  const [milesPackages, setMilesPackages] = useState<MilesPackage[]>([]);
  const [milesLoading, setMilesLoading] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [wrLoading, setWrLoading] = useState(false);
  const [wrPage, setWrPage] = useState(1);
  const [wrHasMore, setWrHasMore] = useState(true);
  const [wrLoadingMore, setWrLoadingMore] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [cancellingWr, setCancellingWr] = useState<string | null>(null);

  // Packages — fetched from API, with hardcoded fallback
  const fallbackPackages: RechargePackage[] = [
    { coins: 100, price: "$0.99", bonus: 0 },
    { coins: 500, price: "$4.99", bonus: 50 },
    { coins: 1000, price: "$9.99", bonus: 150 },
    { coins: 2000, price: "$18.99", bonus: 350 },
    { coins: 5000, price: "$44.99", bonus: 1000 },
    { coins: 10000, price: "$89.99", bonus: 2500, popular: true },
    { coins: 20000, price: "$169.99", bonus: 6000 },
    { coins: 50000, price: "$399.99", bonus: 18000 },
    { coins: 100000, price: "$749.99", bonus: 40000 },
    { coins: 500000, price: "$2999.99", bonus: 250000 },
  ];
  const [packages, setPackages] = useState<RechargePackage[]>(fallbackPackages);
  const [packagesLoaded, setPackagesLoaded] = useState(false);

  // Fetch coin packages from API
  useEffect(() => {
    if (!packagesLoaded) {
      fetch("/api/payments/packages", { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setPackages(data.data.map((p: any) => ({
              id: p.id,
              coins: p.coins || 0,
              bonus: p.bonus_coins || p.bonusCoins || 0,
              price: `$${p.price_usd || p.priceUsd || "0"}`,
              popular: p.is_popular || p.isPopular || false,
            })));
          }
        })
        .catch(() => {})
        .finally(() => setPackagesLoaded(true));
    }
  }, [packagesLoaded]);

  // ── Load saved withdraw prefs ──
  useEffect(() => {
    const prefs = loadWithdrawPrefs();
    if (prefs.method) setWithdrawMethod(prefs.method);
    if (prefs.bankName) setBankName(prefs.bankName);
    if (prefs.accountNumber) setAccountNumber(prefs.accountNumber);
    if (prefs.accountHolder) setAccountHolder(prefs.accountHolder);
    if (prefs.paypalEmail) setPaypalEmail(prefs.paypalEmail);
    if (prefs.usdtNetwork) setUsdtNetwork(prefs.usdtNetwork);
    if (prefs.usdtAddress) setUsdtAddress(prefs.usdtAddress);
  }, []);

  // ── Balance loader ──
  const loadBalance = useCallback(async () => {
    try {
      const data = await walletApi.balance();
      setBalance({ coins: data?.coins || 0, diamonds: data?.diamonds || 0 });
    } catch {}
    setBalanceLoading(false);
  }, []);

  // ── Data loading ──
  useEffect(() => { loadBalance(); }, [loadBalance]);

  // Real-time balance via Socket.io
  useEffect(() => {
    try {
      const socket = getSocket();
      const handleGiftReceived = (data: { newBalance?: number; amount?: number }) => {
        if (data?.newBalance !== undefined) {
          setBalance(prev => ({ ...prev, coins: data.newBalance! }));
        } else {
          loadBalance();
        }
        toast.success(t("wallet.txGiftReceived"), { description: `+${data?.amount || ""} ${t("common.coins")}` });
      };
      const handleBalanceUpdate = (data: { coins?: number; diamonds?: number }) => {
        if (data?.coins !== undefined) setBalance(prev => ({ ...prev, coins: data.coins! }));
        if (data?.diamonds !== undefined) setBalance(prev => ({ ...prev, diamonds: data.diamonds! }));
      };
      // 12: Socket event for withdrawal status change
      const handleWithdrawalStatus = (data: { withdrawalId: string; status: string }) => {
        setWithdrawalRequests(prev => prev.map(wr =>
          wr.id === data.withdrawalId ? { ...wr, status: data.status } : wr
        ));
        const statusKey = `wallet.status${data.status.charAt(0).toUpperCase() + data.status.slice(1)}2`;
        toast.info(t("wallet.withdrawalHistory"), { description: t(statusKey, data.status) });
        loadBalance();
      };
      socket.on("gift-received", handleGiftReceived);
      socket.on("balance-update", handleBalanceUpdate);
      socket.on("withdrawal-status-change", handleWithdrawalStatus);
      return () => {
        socket.off("gift-received", handleGiftReceived);
        socket.off("balance-update", handleBalanceUpdate);
        socket.off("withdrawal-status-change", handleWithdrawalStatus);
      };
    } catch {}
  }, [loadBalance, t]);

  // Auto-refresh on tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadBalance();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadBalance]);

  // Load transactions
  useEffect(() => {
    if (activeTab === "history") {
      setTxLoading(true);
      setTxPage(1);
      setTxHasMore(true);
      const typeFilter = txFilter === "all" ? undefined : txFilter;
      walletApi.transactions(1, typeFilter)
        .then((data: any) => {
          const items: WalletTransaction[] = Array.isArray(data) ? data : data?.data || [];
          setTransactions(items);
          setTxHasMore(items.length >= 20);
        })
        .catch(() => setTransactions([]))
        .finally(() => setTxLoading(false));
    }
  }, [activeTab, txFilter]);

  // Load income + chart
  useEffect(() => {
    if (activeTab === "income") {
      setIncomeLoading(true);
      walletApi.income()
        .then(data => setIncome(data || { totalReceived: 0, todayReceived: 0, weekReceived: 0, monthReceived: 0 }))
        .catch(() => {})
        .finally(() => setIncomeLoading(false));
    }
  }, [activeTab]);

  // Income chart with period switcher
  useEffect(() => {
    if (activeTab === "income") {
      setIncomeChartLoading(true);
      walletApi.incomeChart(chartPeriod)
        .then((res: any) => setIncomeChart(res?.data || []))
        .catch(() => setIncomeChart([]))
        .finally(() => setIncomeChartLoading(false));
    }
  }, [activeTab, chartPeriod]);

  // Load miles
  useEffect(() => {
    if (activeTab === "miles" && milesPackages.length === 0) {
      setMilesLoading(true);
      fetch("/api/social/miles-pricing", { credentials: "include" })
        .then(r => r.json())
        .then(data => { if (data.success && data.data?.packages) setMilesPackages(data.data.packages); })
        .catch(() => {})
        .finally(() => setMilesLoading(false));
    }
  }, [activeTab]);

  // Load withdrawal requests + total spent
  useEffect(() => {
    if (activeTab === "withdraw") {
      setWrLoading(true);
      setWrPage(1);
      setWrHasMore(true);
      walletApi.withdrawalRequests(1)
        .then((res: any) => {
          const items: WithdrawalRequest[] = res?.data || [];
          setWithdrawalRequests(items);
          setWrHasMore(items.length >= 20);
        })
        .catch(() => setWithdrawalRequests([]))
        .finally(() => setWrLoading(false));
    }
  }, [activeTab]);

  // Load total spent for hero card
  useEffect(() => {
    walletApi.totalSpent()
      .then((res: any) => setTotalSpent(res?.totalSpent || res?.data?.totalSpent || 0))
      .catch(() => {});
  }, []);

  const loadMoreTx = async () => {
    const nextPage = txPage + 1;
    setTxLoadingMore(true);
    try {
      const typeFilter = txFilter === "all" ? undefined : txFilter;
      const data: any = await walletApi.transactions(nextPage, typeFilter);
      const items: WalletTransaction[] = Array.isArray(data) ? data : data?.data || [];
      setTransactions(prev => [...prev, ...items]);
      setTxPage(nextPage);
      setTxHasMore(items.length >= 20);
    } catch {}
    setTxLoadingMore(false);
  };

  // Load more withdrawal requests
  const loadMoreWr = async () => {
    const nextPage = wrPage + 1;
    setWrLoadingMore(true);
    try {
      const res: any = await walletApi.withdrawalRequests(nextPage);
      const items: WithdrawalRequest[] = res?.data || [];
      setWithdrawalRequests(prev => [...prev, ...items]);
      setWrPage(nextPage);
      setWrHasMore(items.length >= 20);
    } catch {}
    setWrLoadingMore(false);
  };

  // Pull-to-refresh
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
      haptic();
      toast.success(t("wallet.title"), { description: t("wallet.refreshed") });
      setIsRefreshing(false);
    }
    setIsPulling(false);
  };

  // ── Withdraw logic ──
  const handleWithdrawConfirm = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount < 1000) return;
    if (withdrawMethod === "bank" && (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim())) {
      toast.error(t("wallet.fillAllFields"));
      return;
    }
    if (withdrawMethod === "paypal" && !paypalEmail.trim()) {
      toast.error(t("wallet.fillAllFields"));
      return;
    }
    if (withdrawMethod === "usdt") {
      if (!usdtAddress.trim()) {
        toast.error(t("wallet.fillAllFields"));
        return;
      }
      if (!validateUsdtAddress(usdtAddress, usdtNetwork)) {
        setUsdtError(t("wallet.fillAllFields"));
        toast.error(t("wallet.fillAllFields"));
        return;
      }
    }
    // Save prefs
    saveWithdrawPrefs({ method: withdrawMethod, bankName, accountNumber, accountHolder, paypalEmail, usdtNetwork, usdtAddress });
    setWithdrawError(null);
    setShowWithdrawConfirm(true);
  };

  const handleWithdraw = async () => {
    setShowWithdrawConfirm(false);
    const amount = Number(withdrawAmount);
    if (!amount || amount < 1000) return;

    // 15: Biometric confirmation
    const bioOk = await biometricConfirm();
    if (!bioOk) {
      toast.error(t("common.cancel"));
      return;
    }

    setWithdrawSubmitting(true);
    setWithdrawError(null);
    setWithdrawSuccess(false);
    let paymentDetails: Record<string, string> = {};
    if (withdrawMethod === "bank") paymentDetails = { bankName, accountNumber, accountHolder };
    else if (withdrawMethod === "paypal") paymentDetails = { paypalEmail };
    else if (withdrawMethod === "usdt") paymentDetails = { network: usdtNetwork, walletAddress: usdtAddress };
    try {
      await walletApi.withdraw({ amount, paymentMethodId: withdrawMethod, paymentDetails: JSON.stringify(paymentDetails) });
      setWithdrawSuccess(true);
      haptic([50, 30, 100]); // 17: Haptic feedback
      toast.success(t("wallet.withdrawSuccess"));
      setWithdrawAmount("");
      setWithdrawDisplayAmount("");
      loadBalance();
      // Refresh withdrawal requests
      walletApi.withdrawalRequests(1).then((res: any) => {
        setWithdrawalRequests(res?.data || []);
        setWrPage(1);
        setWrHasMore((res?.data || []).length >= 20);
      }).catch(() => {});
    } catch (err: any) {
      const msg = err?.message || t("common.error", "حدث خطأ");
      setWithdrawError(msg);
      toast.error(msg);
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Cancel pending withdrawal
  const handleCancelWithdraw = async (wrId: string) => {
    if (cancellingWr) return;
    setCancellingWr(wrId);
    try {
      await walletApi.cancelWithdrawal(wrId);
      haptic();
      toast.success(t("wallet.cancelWithdrawSuccess"));
      setWithdrawalRequests(prev => prev.map(wr => wr.id === wrId ? { ...wr, status: "rejected" } : wr));
      loadBalance();
    } catch (err: any) {
      toast.error(err?.message || t("common.error", "حدث خطأ"));
    } finally {
      setCancellingWr(null);
    }
  };

  // Purchase recharge package
  const handlePurchase = async (pkg: RechargePackage) => {
    try {
      toast.loading(t("wallet.processing"), { id: "recharge" });
      await walletApi.recharge({ amount: pkg.coins, paymentMethod: "store" });
      haptic([50, 30, 100]); // 17: Haptic feedback
      toast.success(t("wallet.rechargeSuccess"), { id: "recharge", description: `+${(pkg.coins + pkg.bonus).toLocaleString()} ${t("common.coins")}` });
      loadBalance();
    } catch (err: any) {
      toast.error(err?.message || t("common.error", "Error"), { id: "recharge" });
    }
  };

  // Purchase miles package with coins
  const handleMilesPurchase = async (pkg: MilesPackage) => {
    try {
      toast.loading(t("wallet.processing"), { id: "miles-purchase" });
      const res = await fetch("/api/social/miles/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      haptic([50, 30, 100]);
      toast.success(t("wallet.buyMilesTitle"), { id: "miles-purchase", description: `+${pkg.miles.toLocaleString()} ${t("wallet.milesUnit")}` });
      loadBalance();
    } catch (err: any) {
      toast.error(err?.message || t("common.error", "Error"), { id: "miles-purchase" });
    }
  };

  // Copy transaction ID
  const copyTxId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedTxId(id);
      haptic();
      toast.success(t("wallet.copied"));
      setTimeout(() => setCopiedTxId(null), 2000);
    });
  };

  // Share receipt
  const handleShareReceipt = async (tx: WalletTransaction) => {
    const shared = await shareReceipt(tx, t);
    if (shared) haptic();
  };

  // Quick amount buttons
  const quickAmounts = [
    { label: "25%", pct: 0.25 },
    { label: "50%", pct: 0.50 },
    { label: "75%", pct: 0.75 },
    { label: "MAX", pct: 1.0 },
  ];

  // 18: Number formatting for withdraw input
  const handleWithdrawAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseWithdrawAmount(e.target.value);
    setWithdrawAmount(raw);
    setWithdrawDisplayAmount(formatWithdrawAmount(raw));
  };

  // Filtered transactions (search + date range)
  const filteredTx = transactions.filter(tx => {
    // Date range filter
    if (dateRange !== "all") {
      const rangeStart = getDateRangeStart(dateRange);
      if (rangeStart && tx.createdAt) {
        const txDate = new Date(tx.createdAt);
        if (txDate < rangeStart) return false;
      }
    }
    // Search filter
    if (!txSearch.trim()) return true;
    const q = txSearch.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(q) ||
      tx.type?.toLowerCase().includes(q) ||
      tx.id?.toLowerCase().includes(q) ||
      String(tx.amount).includes(q)
    );
  });

  // ── Helpers ──
  const tabs: { key: WalletTab; icon: React.ReactNode; label: string }[] = [
    { key: "recharge", icon: <Plus className="w-4 h-4" />, label: t("wallet.tabRecharge") },
    { key: "miles", icon: <Navigation className="w-4 h-4" />, label: t("wallet.tabMiles") },
    { key: "history", icon: <History className="w-4 h-4" />, label: t("wallet.tabHistory") },
    { key: "income", icon: <TrendingUp className="w-4 h-4" />, label: t("wallet.tabIncome") },
    { key: "withdraw", icon: <Send className="w-4 h-4" />, label: t("wallet.tabWithdraw") },
  ];

  const tierIcons = [Compass, Plane, Rocket, Star, Crown, Zap];

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
                { label: t("wallet.totalEarned"), value: balance.diamonds, color: "text-emerald-400", gradient: "from-emerald-500/15 to-emerald-500/5", border: "border-emerald-500/10", icon: <Plus className="w-3.5 h-3.5" /> },
                { label: t("wallet.totalSpentAll"), value: totalSpent, color: "text-red-400", gradient: "from-red-500/15 to-red-500/5", border: "border-red-500/10", icon: <Minus className="w-3.5 h-3.5" /> },
                { label: t("wallet.tabMiles"), value: 0, color: "text-cyan-400", gradient: "from-cyan-500/15 to-cyan-500/5", border: "border-cyan-500/10", icon: <Navigation className="w-3.5 h-3.5" /> },
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{t("wallet.rechargeTitle")}</h2>
              <span className="text-sm text-white/25 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> {t("wallet.securePaymentTitle")}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg, i) => (
                <motion.div key={pkg.coins} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.04 }}>
                  <ShimmerButton
                    onClick={() => handlePurchase(pkg)}
                    className={`w-full text-start p-5 rounded-3xl border transition-all duration-300 active:scale-95 ${
                      pkg.popular
                        ? "bg-gradient-to-br from-violet-600/20 to-purple-600/10 border-violet-500/30 ring-1 ring-violet-500/20"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]"
                    }`}>
                    {pkg.popular && (
                      <span className="absolute -top-2.5 end-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[9px] font-black px-3 py-1 rounded-full shadow-lg shadow-violet-500/25 uppercase tracking-wider">
                        {t("wallet.mostPopular")}
                      </span>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <img src={coinImg} alt="" className="w-10 h-10" />
                      <p className="text-2xl font-black text-white">{pkg.coins.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-white/50 font-bold text-sm">{pkg.price}</p>
                      {pkg.bonus > 0 && (
                        <p className="text-emerald-400 text-xs font-bold mt-0.5">+{pkg.bonus.toLocaleString()} <Gift className="w-3 h-3 inline" /></p>
                      )}
                    </div>
                  </ShimmerButton>
                </motion.div>
              ))}
            </div>

            {/* Secure payment info */}
            <GlassCard className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{t("wallet.securePaymentTitle")}</h3>
                  <p className="text-white/30 text-sm leading-relaxed">{t("wallet.securePaymentDesc")}</p>
                </div>
              </div>
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

            {/* CSV Export */}
            <button onClick={() => {
              const csv = ["ID,Type,Amount,Status,Date", ...filteredTx.map(tx =>
                `${tx.id},${tx.type},${tx.amount},${tx.status},${tx.createdAt ? new Date(tx.createdAt).toISOString() : ""}`)
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "wallet_history.csv"; a.click();
              URL.revokeObjectURL(url);
            }}
              className="flex items-center gap-2 text-sm text-violet-400 font-bold hover:text-violet-300 transition-colors">
              <Download className="w-4 h-4" /> {t("wallet.exportHistory")}
            </button>
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
                  { label: t("wallet.incomeGifts"), value: income.weekReceived, color: "text-amber-400", gradient: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/10", icon: <Gift className="w-6 h-6" /> },
                  { label: t("wallet.incomeCommission"), value: income.todayReceived, color: "text-violet-400", gradient: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/10", icon: <Zap className="w-6 h-6" /> },
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
                    <button key={qa.label} onClick={() => {
                      const val = String(Math.floor(balance.coins * qa.pct));
                      setWithdrawAmount(val);
                      setWithdrawDisplayAmount(formatWithdrawAmount(val));
                    }}
                      className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 text-xs font-bold hover:text-white/70 hover:bg-white/[0.08] transition-all active:scale-95">
                      {qa.label}
                    </button>
                  ))}
                </div>

                <p className="text-white/20 text-xs">{t("wallet.minWithdraw")}: 1,000 {t("common.coins")}</p>
              </div>

              {/* Method */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-white/50">{t("wallet.withdrawMethod")}</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "bank", label: t("wallet.methodBank"), icon: <CreditCard className="w-4 h-4" /> },
                    { key: "paypal", label: "PayPal", icon: <BadgeDollarSign className="w-4 h-4" /> },
                    { key: "usdt", label: "USDT", icon: <Coins className="w-4 h-4" /> },
                  ].map(m => (
                    <button key={m.key} onClick={() => setWithdrawMethod(m.key)}
                      className={`py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 border flex items-center justify-center gap-2 ${
                        withdrawMethod === m.key
                          ? "bg-violet-600/80 text-white border-violet-500/50 shadow-md shadow-violet-500/15"
                          : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/70 hover:bg-white/[0.06]"
                      }`}>
                      {m.icon} {m.label}
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
                          {wr.paymentMethodId && <p className="text-white/15 text-[10px] mt-0.5">{getMethodLabel(wr.paymentMethodId)}</p>}
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
                  <span className="text-white font-black">{getMethodLabel(withdrawMethod)}</span>
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
                  { label: t("wallet.txPaymentMethod"), value: getMethodLabel(selectedTx.paymentMethod) },
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

