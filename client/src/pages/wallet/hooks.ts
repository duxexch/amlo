import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { walletApi, milesApi } from "@/lib/socialApi";
import { getSocket } from "@/lib/socketManager";
import { toast } from "sonner";
import {
  haptic, shareReceipt, biometricConfirm,
  saveWithdrawPrefs, loadWithdrawPrefs,
  validateUsdtAddress, validateEmail,
  formatWithdrawAmount, parseWithdrawAmount, getDateRangeStart,
} from "./helpers";
import type {
  WalletTab, WalletBalance, IncomeStats, ChartDataPoint, ChartPeriod,
  DateRange, RechargePackage, MilesPackage, WalletTransaction, WithdrawalRequest,
} from "./types";

/* ═══════════════════════════════════════════════════════
 * useWalletBalance — balance state, socket, auto-refresh
 * ═══════════════════════════════════════════════════════ */
export function useWalletBalance() {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<WalletBalance>({ coins: 0, diamonds: 0, miles: 0 });
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceHidden, setBalanceHidden] = useState(false);

  const loadBalance = useCallback(async () => {
    try {
      const data = await walletApi.balance();
      setBalance({ coins: data?.coins || 0, diamonds: data?.diamonds || 0, miles: data?.miles || 0 });
    } catch {
      toast.error(t("common.networkError", "خطأ في الاتصال"));
    }
    setBalanceLoading(false);
  }, [t]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  // Socket real-time updates (gift + balance)
  useEffect(() => {
    try {
      const socket = getSocket();
      const handleGiftReceived = (data: { newBalance?: number; amount?: number }) => {
        if (data?.newBalance !== undefined) {
          setBalance(prev => ({ ...prev, coins: data.newBalance! }));
        } else {
          loadBalance();
        }
        toast.success(t("wallet.txGiftReceived"), {
          description: `+${data?.amount || ""} ${t("common.coins")}`,
        });
      };
      const handleBalanceUpdate = (data: { coins?: number; diamonds?: number }) => {
        if (data?.coins !== undefined) setBalance(prev => ({ ...prev, coins: data.coins! }));
        if (data?.diamonds !== undefined) setBalance(prev => ({ ...prev, diamonds: data.diamonds! }));
      };
      socket.on("gift-received", handleGiftReceived);
      socket.on("balance-update", handleBalanceUpdate);
      return () => {
        socket.off("gift-received", handleGiftReceived);
        socket.off("balance-update", handleBalanceUpdate);
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

  return { balance, setBalance, balanceLoading, balanceHidden, setBalanceHidden, loadBalance };
}

/* ═══════════════════════════════════════════════════════
 * useWalletTransactions — history tab state & logic
 * ═══════════════════════════════════════════════════════ */
export function useWalletTransactions(activeTab: WalletTab) {
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txHasMore, setTxHasMore] = useState(true);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [txFilter, setTxFilter] = useState("all");
  const [txSearch, setTxSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  // Load transactions when tab active
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

  // Filtered transactions (search + date range)
  const filteredTx = transactions.filter(tx => {
    if (dateRange !== "all") {
      const rangeStart = getDateRangeStart(dateRange);
      if (rangeStart && tx.createdAt) {
        const txDate = new Date(tx.createdAt);
        if (txDate < rangeStart) return false;
      }
    }
    if (!txSearch.trim()) return true;
    const q = txSearch.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(q) ||
      tx.type?.toLowerCase().includes(q) ||
      tx.id?.toLowerCase().includes(q) ||
      String(tx.amount).includes(q)
    );
  });

  const copyTxId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedTxId(id);
      haptic();
      toast.success(t("wallet.copied"));
      setTimeout(() => setCopiedTxId(null), 2000);
    });
  };

  const handleShareReceipt = async (tx: WalletTransaction) => {
    const shared = await shareReceipt(tx, t, i18n.language);
    if (shared) haptic();
  };

  const refreshTransactions = () => {
    const typeFilter = txFilter === "all" ? undefined : txFilter;
    walletApi.transactions(1, typeFilter).then((data: any) => {
      setTransactions(Array.isArray(data) ? data : data?.data || []);
      setTxPage(1);
      setTxHasMore(true);
    }).catch(() => {});
  };

  return {
    transactions, txLoading, txHasMore, txLoadingMore, loadMoreTx,
    txFilter, setTxFilter, txSearch, setTxSearch,
    dateRange, setDateRange,
    selectedTx, setSelectedTx, copiedTxId,
    filteredTx, copyTxId, handleShareReceipt,
    refreshTransactions,
  };
}

/* ═══════════════════════════════════════════════════════
 * useWithdrawFlow — form state, limits, requests, submit
 * ═══════════════════════════════════════════════════════ */
export function useWithdrawFlow(
  activeTab: WalletTab,
  balance: WalletBalance,
  loadBalance: () => Promise<void>,
) {
  const { t } = useTranslation();

  // Form state
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

  // Withdrawal requests
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [wrLoading, setWrLoading] = useState(false);
  const [wrPage, setWrPage] = useState(1);
  const [wrHasMore, setWrHasMore] = useState(true);
  const [wrLoadingMore, setWrLoadingMore] = useState(false);
  const [cancellingWr, setCancellingWr] = useState<string | null>(null);

  // Limits & conversion
  const [withdrawLimits, setWithdrawLimits] = useState<{
    dailyLimit: number; weeklyLimit: number;
    dailyUsed: number; weeklyUsed: number;
    dailyRemaining: number; weeklyRemaining: number;
    hasActiveRequest: boolean;
  } | null>(null);
  const [conversionRate, setConversionRate] = useState(100);

  // #5: Clear success/error when switching tabs
  useEffect(() => {
    setWithdrawSuccess(false);
    setWithdrawError(null);
  }, [activeTab]);

  // Load saved withdraw prefs
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

  // Load withdrawal requests + limits when tab active
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
        .catch(() => toast.error(t("common.networkError", "خطأ في الاتصال")))
        .finally(() => setWrLoading(false));
      walletApi.withdrawLimits()
        .then((res: any) => setWithdrawLimits(res))
        .catch(() => {});
    }
  }, [activeTab, t]);

  // #13: Conversion rate with sessionStorage cache (5 min TTL)
  useEffect(() => {
    const cached = sessionStorage.getItem("wallet:conversionRate");
    if (cached) {
      try {
        const { rate, ts } = JSON.parse(cached);
        if (Date.now() - ts < 5 * 60_000 && rate > 0) { setConversionRate(rate); return; }
      } catch {}
    }
    walletApi.conversionRate()
      .then((res: any) => {
        if (res?.coinsPerUsd > 0) {
          setConversionRate(res.coinsPerUsd);
          sessionStorage.setItem("wallet:conversionRate", JSON.stringify({ rate: res.coinsPerUsd, ts: Date.now() }));
        }
      })
      .catch(() => {});
  }, []);

  // Socket: withdrawal-status-change
  useEffect(() => {
    try {
      const socket = getSocket();
      const handleWithdrawalStatus = (data: { withdrawalId: string; status: string }) => {
        setWithdrawalRequests(prev =>
          prev.map(wr => wr.id === data.withdrawalId ? { ...wr, status: data.status } : wr)
        );
        const statusKey = `wallet.status${data.status.charAt(0).toUpperCase() + data.status.slice(1)}2`;
        toast.info(t("wallet.withdrawalHistory"), { description: t(statusKey, data.status) });
        loadBalance();
      };
      socket.on("withdrawal-status-change", handleWithdrawalStatus);
      return () => { socket.off("withdrawal-status-change", handleWithdrawalStatus); };
    } catch {}
  }, [loadBalance, t]);

  // Number formatting for withdraw input
  const handleWithdrawAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseWithdrawAmount(e.target.value);
    setWithdrawAmount(raw);
    setWithdrawDisplayAmount(formatWithdrawAmount(raw));
  };

  // Quick amount setter (25%, 50%, 75%, MAX)
  const setQuickAmount = (pct: number) => {
    const val = String(Math.floor(balance.coins * pct));
    setWithdrawAmount(val);
    setWithdrawDisplayAmount(formatWithdrawAmount(val));
  };

  const handleWithdrawConfirm = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount < 1000) return;
    if (withdrawLimits) {
      if (withdrawLimits.hasActiveRequest) {
        toast.error(t("wallet.activeRequestExists", "لديك طلب سحب قيد المعالجة"));
        return;
      }
      if (amount > withdrawLimits.dailyRemaining) {
        toast.error(t("wallet.dailyLimitExceeded", "تجاوزت الحد اليومي للسحب"));
        return;
      }
      if (amount > withdrawLimits.weeklyRemaining) {
        toast.error(t("wallet.weeklyLimitExceeded", "تجاوزت الحد الأسبوعي للسحب"));
        return;
      }
    }
    if (withdrawMethod === "bank" && (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim())) {
      toast.error(t("wallet.fillAllFields"));
      return;
    }
    if (withdrawMethod === "paypal" && !paypalEmail.trim()) {
      toast.error(t("wallet.fillAllFields"));
      return;
    }
    if (withdrawMethod === "paypal" && !validateEmail(paypalEmail)) {
      toast.error(t("wallet.invalidEmail", "بريد إلكتروني غير صالح"));
      return;
    }
    if (withdrawMethod === "usdt") {
      if (!usdtAddress.trim()) {
        toast.error(t("wallet.fillAllFields"));
        return;
      }
      if (!validateUsdtAddress(usdtAddress, usdtNetwork)) {
        const msg = t("wallet.invalidUsdtAddress", { network: usdtNetwork.toUpperCase(), defaultValue: `عنوان USDT غير صالح لشبكة ${usdtNetwork.toUpperCase()}` });
        setUsdtError(msg);
        toast.error(msg);
        return;
      }
    }
    saveWithdrawPrefs({ method: withdrawMethod, bankName, accountNumber, accountHolder, paypalEmail, usdtNetwork, usdtAddress });
    setWithdrawError(null);
    setShowWithdrawConfirm(true);
  };

  const handleWithdraw = async () => {
    setShowWithdrawConfirm(false);
    const amount = Number(withdrawAmount);
    if (!amount || amount < 1000) return;

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
      haptic([50, 30, 100]);
      toast.success(t("wallet.withdrawSuccess"));
      setWithdrawAmount("");
      setWithdrawDisplayAmount("");
      loadBalance();
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

  const refreshWithdrawals = () => {
    walletApi.withdrawalRequests(1).then((res: any) => {
      setWithdrawalRequests(res?.data || []);
      setWrPage(1);
      setWrHasMore((res?.data || []).length >= 20);
    }).catch(() => {});
  };

  return {
    // Form state
    withdrawAmount, withdrawDisplayAmount, withdrawMethod, setWithdrawMethod,
    withdrawSubmitting, withdrawError, withdrawSuccess,
    showWithdrawConfirm, setShowWithdrawConfirm,
    bankName, setBankName, accountNumber, setAccountNumber, accountHolder, setAccountHolder,
    paypalEmail, setPaypalEmail, usdtNetwork, setUsdtNetwork, usdtAddress, setUsdtAddress, usdtError, setUsdtError,
    // Requests
    withdrawalRequests, wrLoading, wrHasMore, wrLoadingMore, cancellingWr,
    // Limits & conversion
    withdrawLimits, conversionRate,
    // Handlers
    handleWithdrawAmountChange, setQuickAmount,
    handleWithdrawConfirm, handleWithdraw, handleCancelWithdraw,
    loadMoreWr, refreshWithdrawals,
  };
}

/* ═══════════════════════════════════════════════════════
 * useIncomeData — income stats, spending, chart
 * ═══════════════════════════════════════════════════════ */
export function useIncomeData(activeTab: WalletTab) {
  const { t } = useTranslation();
  const [income, setIncome] = useState<IncomeStats>({ totalReceived: 0, todayReceived: 0, weekReceived: 0, monthReceived: 0 });
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [spendingBreakdown, setSpendingBreakdown] = useState<{ type: string; total: number; count: number }[]>([]);
  const [incomeChart, setIncomeChart] = useState<ChartDataPoint[]>([]);
  const [incomeChartLoading, setIncomeChartLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>(30);

  // Load income + spending summary
  useEffect(() => {
    if (activeTab === "income") {
      setIncomeLoading(true);
      walletApi.income()
        .then(data => setIncome(data || { totalReceived: 0, todayReceived: 0, weekReceived: 0, monthReceived: 0 }))
        .catch(() => toast.error(t("common.networkError", "خطأ في الاتصال")))
        .finally(() => setIncomeLoading(false));
      walletApi.spendingSummary()
        .then((res: any) => {
          setTotalSpent(res?.totalSpent || 0);
          setSpendingBreakdown(Array.isArray(res?.breakdown) ? res.breakdown : []);
        })
        .catch(() => toast.error(t("common.networkError", "خطأ في الاتصال")));
    }
  }, [activeTab, t]);

  // Chart data with period switcher
  useEffect(() => {
    if (activeTab === "income") {
      setIncomeChartLoading(true);
      walletApi.incomeChart(chartPeriod)
        .then((res: any) => setIncomeChart(res?.data || []))
        .catch(() => toast.error(t("common.networkError", "خطأ في الاتصال")))
        .finally(() => setIncomeChartLoading(false));
    }
  }, [activeTab, chartPeriod, t]);

  const refreshIncome = () => {
    walletApi.income()
      .then(data => setIncome(data || { totalReceived: 0, todayReceived: 0, weekReceived: 0, monthReceived: 0 }))
      .catch(() => {});
    walletApi.spendingSummary()
      .then((res: any) => {
        setTotalSpent(res?.totalSpent || 0);
        setSpendingBreakdown(Array.isArray(res?.breakdown) ? res.breakdown : []);
      })
      .catch(() => {});
  };

  return {
    income, incomeLoading,
    totalSpent, spendingBreakdown,
    incomeChart, incomeChartLoading,
    chartPeriod, setChartPeriod,
    refreshIncome,
  };
}

/* ═══════════════════════════════════════════════════════
 * useRechargeData — packages, miles, purchases
 * ═══════════════════════════════════════════════════════ */
export function useRechargeData(activeTab: WalletTab, loadBalance: () => Promise<void>) {
  const { t } = useTranslation();

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
  const [milesPackages, setMilesPackages] = useState<MilesPackage[]>([]);
  const [milesLoading, setMilesLoading] = useState(false);

  // Fetch coin packages from API
  useEffect(() => {
    if (!packagesLoaded) {
      walletApi.rechargePackages()
        .then((data: any) => {
          const pkgs = Array.isArray(data) ? data : data?.data || [];
          if (pkgs.length > 0) {
            setPackages(pkgs.map((p: any) => ({
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

  // Load miles packages when tab active
  useEffect(() => {
    if (activeTab === "miles" && milesPackages.length === 0) {
      setMilesLoading(true);
      walletApi.milesPricing()
        .then((data: any) => { if (data?.packages) setMilesPackages(data.packages); })
        .catch(() => toast.error(t("common.networkError", "خطأ في الاتصال")))
        .finally(() => setMilesLoading(false));
    }
  }, [activeTab, t]);

  const handlePurchase = async (pkg: RechargePackage) => {
    try {
      toast.loading(t("wallet.processing"), { id: "recharge" });
      await walletApi.recharge({ amount: pkg.coins, paymentMethod: "store" });
      haptic([50, 30, 100]);
      toast.success(t("wallet.rechargeSuccess"), { id: "recharge", description: `+${(pkg.coins + pkg.bonus).toLocaleString()} ${t("common.coins")}` });
      loadBalance();
    } catch (err: any) {
      toast.error(err?.message || t("common.error", "Error"), { id: "recharge" });
    }
  };

  const handleMilesPurchase = async (pkg: MilesPackage) => {
    try {
      toast.loading(t("wallet.processing"), { id: "miles-purchase" });
      await milesApi.purchase(pkg.id);
      haptic([50, 30, 100]);
      toast.success(t("wallet.buyMilesTitle"), { id: "miles-purchase", description: `+${pkg.miles.toLocaleString()} ${t("wallet.milesUnit")}` });
      loadBalance();
    } catch (err: any) {
      toast.error(err?.message || t("common.error", "Error"), { id: "miles-purchase" });
    }
  };

  const refreshMiles = () => {
    setMilesLoading(true);
    walletApi.milesPricing()
      .then((data: any) => { if (data?.packages) setMilesPackages(data.packages); })
      .catch(() => {})
      .finally(() => setMilesLoading(false));
  };

  return {
    packages, milesPackages, milesLoading,
    handlePurchase, handleMilesPurchase,
    refreshMiles,
  };
}
