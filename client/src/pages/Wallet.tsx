import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, ShieldCheck, ArrowDownLeft, ArrowUpRight, Coins, TrendingUp, Filter, Download, Send, Clock, CheckCircle2, XCircle, AlertCircle, Navigation, Sparkles, Rocket, Plane, Compass, Globe2, Star } from "lucide-react";
import coinImg from "@/assets/images/coin-3d.png";
import { useTranslation } from "react-i18next";

type WalletTab = "recharge" | "miles" | "history" | "income" | "withdraw";

// Mock transaction history
const mockTransactions = [
  { id: 1, type: "recharge", amount: 5000, date: "2025-01-15 14:30", method: "Visa •••• 4242", status: "completed" as const },
  { id: 2, type: "gift_sent", amount: -200, date: "2025-01-15 12:00", to: "Omar_12", status: "completed" as const },
  { id: 3, type: "gift_received", amount: 500, date: "2025-01-14 20:45", from: "Sara_VIP", status: "completed" as const },
  { id: 4, type: "recharge", amount: 10000, date: "2025-01-13 09:00", method: "Apple Pay", status: "completed" as const },
  { id: 5, type: "withdrawal", amount: -3000, date: "2025-01-12 16:20", method: "Bank ••• 789", status: "pending" as const },
  { id: 6, type: "gift_sent", amount: -100, date: "2025-01-12 11:30", to: "Noor_98", status: "completed" as const },
  { id: 7, type: "commission", amount: 1200, date: "2025-01-11 08:00", from: "System", status: "completed" as const },
  { id: 8, type: "gift_received", amount: 2000, date: "2025-01-10 22:15", from: "Ahmed_Pro", status: "completed" as const },
  { id: 9, type: "recharge", amount: 2000, date: "2025-01-09 10:00", method: "Google Pay", status: "failed" as const },
  { id: 10, type: "withdrawal", amount: -5000, date: "2025-01-08 14:00", method: "PayPal", status: "completed" as const },
];

// Mock income data
const mockIncome = {
  totalEarnings: 45200,
  thisMonth: 8500,
  lastMonth: 12000,
  giftsIncome: 32000,
  commissionIncome: 13200,
  breakdown: [
    { month: "Jan", gifts: 5000, commission: 3500 },
    { month: "Dec", gifts: 8000, commission: 4000 },
    { month: "Nov", gifts: 6500, commission: 2800 },
    { month: "Oct", gifts: 7200, commission: 1900 },
    { month: "Sep", gifts: 5300, commission: 1000 },
  ],
};

export function Wallet() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [activeTab, setActiveTab] = useState<WalletTab>("recharge");
  const [txFilter, setTxFilter] = useState<string>("all");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank");

  const packages = [
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

  const filteredTx = txFilter === "all" ? mockTransactions : mockTransactions.filter(tx => tx.type === txFilter);

  const [milesPackages, setMilesPackages] = useState<{id: string; miles: number; price: string}[]>([]);
  const [milesLoading, setMilesLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "miles" && milesPackages.length === 0) {
      setMilesLoading(true);
      fetch("/api/social/miles-pricing", { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data?.packages) setMilesPackages(data.data.packages);
        })
        .catch(() => {})
        .finally(() => setMilesLoading(false));
    }
  }, [activeTab]);

  const tabs: { key: WalletTab; icon: React.ReactNode; label: string }[] = [
    { key: "recharge", icon: <Coins className="w-4 h-4" />, label: t("wallet.tabRecharge") },
    { key: "miles", icon: <Navigation className="w-4 h-4" />, label: t("wallet.tabMiles") },
    { key: "history", icon: <History className="w-4 h-4" />, label: t("wallet.tabHistory") },
    { key: "income", icon: <TrendingUp className="w-4 h-4" />, label: t("wallet.tabIncome") },
    { key: "withdraw", icon: <Send className="w-4 h-4" />, label: t("wallet.tabWithdraw") },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-400" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-400" />;
      default: return null;
    }
  };

  const getTxIcon = (type: string) => {
    if (type === "recharge" || type === "gift_received" || type === "commission") {
      return <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><ArrowDownLeft className="w-5 h-5 text-emerald-400" /></div>;
    }
    return <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-red-400" /></div>;
  };

  const getTxLabel = (tx: typeof mockTransactions[0]) => {
    switch (tx.type) {
      case "recharge": return t("wallet.txRecharge");
      case "gift_sent": return `${t("wallet.txGiftSent")} → ${tx.to}`;
      case "gift_received": return `${t("wallet.txGiftReceived")} ← ${tx.from}`;
      case "withdrawal": return t("wallet.txWithdrawal");
      case "commission": return t("wallet.txCommission");
      default: return tx.type;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir={dir}>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-white" style={{fontFamily: 'Outfit'}}>{t("wallet.title")}</h1>
      </div>

      {/* Balance Card — Dynamic Dual Currency */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl group"
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a2e] via-[#12123a] to-[#0a1628]" />
        <div className="absolute inset-0 opacity-40">
          <motion.div 
            animate={{ x: [0, 40, 0], y: [0, -20, 0], scale: [1, 1.2, 1] }} 
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/30 blur-[100px] rounded-full"
          />
          <motion.div 
            animate={{ x: [0, -30, 0], y: [0, 30, 0], scale: [1.2, 1, 1.2] }} 
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/25 blur-[100px] rounded-full"
          />
          <motion.div 
            animate={{ x: [0, 20, -20, 0], y: [0, -15, 15, 0] }} 
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[30%] left-[40%] w-[30%] h-[30%] bg-yellow-400/15 blur-[80px] rounded-full"
          />
        </div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{ 
              y: [0, -20, 0], 
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1]
            }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
          />
        ))}

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'0.5\'/%3E%3C/svg%3E")' }} />

        <div className="relative z-10 p-8 md:p-10">
          {/* Top row — card label + chip */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white/90 font-bold text-sm tracking-wider uppercase">{t("wallet.currentBalance")}</p>
                <p className="text-white/40 text-xs">Ablox Wallet</p>
              </div>
            </div>
            <motion.div 
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border border-yellow-400/20 flex items-center justify-center backdrop-blur-sm"
            >
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400/30" />
            </motion.div>
          </div>

          {/* Dual balance display */}
          <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10 mb-8">
            {/* Coins Balance */}
            <motion.div 
              className="flex-1"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center">
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <span className="text-yellow-400/80 text-xs font-bold uppercase tracking-wide">{t("common.coins")}</span>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-5xl md:text-6xl font-black text-white tracking-tight" style={{ textShadow: '0 0 40px rgba(255,255,255,0.15)' }}>1,250</span>
              </div>
            </motion.div>

            {/* Divider */}
            <div className="hidden md:block w-px h-20 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            <div className="md:hidden h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Miles Balance */}
            <motion.div 
              className="flex-1"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-cyan-400/20 flex items-center justify-center">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <span className="text-cyan-400/80 text-xs font-bold uppercase tracking-wide">{t("wallet.milesUnit")}</span>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-5xl md:text-6xl font-black text-cyan-400 tracking-tight" style={{ textShadow: '0 0 40px rgba(34,211,238,0.2)' }}>0</span>
              </div>
            </motion.div>

            {/* 3D Coin image */}
            <motion.div 
              className="hidden lg:block"
              animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src={coinImg} alt="Coins" className="w-32 h-32 object-contain drop-shadow-[0_20px_40px_rgba(234,179,8,0.3)]" />
            </motion.div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t("wallet.totalSpent"), value: "15,300", color: "text-red-400", icon: <ArrowUpRight className="w-3 h-3" />, bg: "bg-red-500/10 border-red-500/20" },
              { label: t("wallet.totalEarned"), value: "45,200", color: "text-emerald-400", icon: <ArrowDownLeft className="w-3 h-3" />, bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: t("wallet.milesBalance"), value: "0", color: "text-cyan-400", icon: <Navigation className="w-3 h-3" />, bg: "bg-cyan-500/10 border-cyan-500/20" },
              { label: t("wallet.tabIncome"), value: "8,500", color: "text-yellow-400", icon: <TrendingUp className="w-3 h-3" />, bg: "bg-yellow-500/10 border-yellow-500/20" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border backdrop-blur-sm ${stat.bg}`}
              >
                <div className={`${stat.color}`}>{stat.icon}</div>
                <div>
                  <p className="text-white/40 text-[10px] font-medium">{stat.label}</p>
                  <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-primary text-white shadow-md" : "text-white/50 hover:text-white"}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* ---- RECHARGE TAB ---- */}
        {activeTab === "recharge" && (
          <motion.div key="recharge" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                {t("wallet.rechargeTitle")}
                <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">{t("wallet.packagesAvailable", { count: 10 })}</span>
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {packages.map((pkg, i) => (
                  <motion.button 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    key={i}
                    className={`glass p-6 rounded-3xl flex flex-col items-center text-center relative overflow-hidden group transition-all duration-300 hover:-translate-y-2 ${pkg.popular ? 'border-2 border-primary neon-border bg-primary/5' : 'border border-white/10 hover:border-primary/50'}`}
                  >
                    {pkg.popular && (
                      <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold py-1.5 shadow-md">
                        {t("wallet.mostPopular")}
                      </div>
                    )}
                    
                    <div className="w-20 h-20 mt-6 mb-4 relative">
                      <img src={coinImg} alt="Coin" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-lg" />
                    </div>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-3xl font-black text-white">{pkg.coins.toLocaleString()}</span>
                    </div>
                    
                    {pkg.bonus > 0 ? (
                      <div className="text-sm font-bold text-green-400 mb-6 bg-green-400/10 px-3 py-1 rounded-lg border border-green-400/20">
                        +{pkg.bonus.toLocaleString()} {t("common.bonus")}
                      </div>
                    ) : (
                       <div className="h-8 mb-6" />
                    )}
                    
                    <div className="w-full py-3 md:py-4 rounded-2xl bg-white/10 font-bold text-white mt-auto group-hover:bg-primary transition-all duration-300 text-lg border border-white/5">
                      {pkg.price}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="glass p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 border-white/10 bg-gradient-to-r from-white/5 to-transparent">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                  <ShieldCheck className="text-green-400 w-6 h-6" />
                  {t("wallet.securePaymentTitle")}
                </h3>
                <p className="text-white/70 max-w-md font-medium leading-relaxed">
                  {t("wallet.securePaymentDesc")}
                </p>
              </div>
              <div className="flex gap-4 flex-wrap justify-center">
                {["Visa", "MasterCard", "Apple Pay", "Google Pay"].map((m) => (
                  <div key={m} className="h-14 px-6 bg-white/10 rounded-xl flex items-center justify-center font-bold text-white border border-white/10 hover:bg-white/20 transition-colors">{m}</div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ---- MILES TAB ---- */}
        {activeTab === "miles" && (
          <motion.div key="miles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            {/* Miles Balance — Compact */}
            <div className="glass p-5 rounded-3xl border border-cyan-500/20 flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />
              <motion.div 
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center relative z-10"
              >
                <Globe2 className="w-7 h-7 text-cyan-400" />
              </motion.div>
              <div className="relative z-10 flex-1">
                <p className="text-white/50 text-xs font-bold">{t("wallet.milesBalance")}</p>
                <p className="text-3xl font-black text-cyan-400">0 <span className="text-sm text-white/40 font-medium">{t("wallet.milesUnit")}</span></p>
              </div>
              <div className="relative z-10 text-end">
                <p className="text-white/30 text-[10px] font-medium">{t("wallet.totalSpent")}</p>
                <p className="text-white/60 font-bold text-sm">0 {t("wallet.milesUnit")}</p>
              </div>
            </div>

            {/* Miles Packages */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                {t("wallet.buyMilesTitle")}
              </h2>
              <p className="text-white/40 text-sm mb-6">{t("wallet.buyMilesDesc")}</p>

              {milesLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="glass rounded-3xl h-64 animate-pulse border border-white/5" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6">
                  {milesPackages.map((pkg, i) => {
                    const isPopular = i === Math.floor(milesPackages.length / 2);
                    // Tiered icon system based on package size
                    const tier = i < milesPackages.length * 0.33 ? "basic" 
                               : i < milesPackages.length * 0.66 ? "pro" 
                               : "elite";
                    
                    const tierConfig = {
                      basic: { 
                        Icon: Compass, 
                        gradient: "from-cyan-400/20 via-blue-400/10 to-transparent",
                        iconBg: "from-cyan-500/30 to-blue-500/20",
                        ring: "border-cyan-400/30",
                        glow: "shadow-cyan-500/20",
                        accent: "text-cyan-400"
                      },
                      pro: { 
                        Icon: Plane, 
                        gradient: "from-violet-400/20 via-purple-400/10 to-transparent",
                        iconBg: "from-violet-500/30 to-purple-500/20",
                        ring: "border-violet-400/30",
                        glow: "shadow-violet-500/20",
                        accent: "text-violet-400"
                      },
                      elite: { 
                        Icon: Rocket, 
                        gradient: "from-amber-400/20 via-orange-400/10 to-transparent",
                        iconBg: "from-amber-500/30 to-orange-500/20",
                        ring: "border-amber-400/30",
                        glow: "shadow-amber-500/20",
                        accent: "text-amber-400"
                      },
                    };
                    
                    const config = tierConfig[tier];
                    const TierIcon = config.Icon;

                    return (
                      <motion.button
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        key={pkg.id}
                        className={`relative p-6 rounded-3xl flex flex-col items-center text-center overflow-hidden group transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${config.glow} ${
                          isPopular
                            ? "border-2 border-cyan-400 bg-white/[0.08] backdrop-blur-md"
                            : "border border-white/10 bg-white/[0.04] backdrop-blur-sm hover:border-white/20"
                        }`}
                      >
                        {/* Background gradient */}
                        <div className={`absolute inset-0 bg-gradient-to-b ${config.gradient} opacity-60 pointer-events-none`} />
                        
                        {isPopular && (
                          <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-xs font-bold py-1.5 shadow-md z-10">
                            {t("wallet.mostPopular")}
                          </div>
                        )}

                        {/* Tier badge */}
                        <div className={`absolute top-3 ${isPopular ? 'top-10' : 'top-3'} end-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.ring} ${config.accent} bg-white/5 z-10`}>
                          {tier === "basic" ? "🌍" : tier === "pro" ? "✈️" : "🚀"} {tier}
                        </div>

                        {/* Icon with animated ring */}
                        <div className={`relative w-20 h-20 ${isPopular ? 'mt-8' : 'mt-6'} mb-4 z-10`}>
                          <motion.div 
                            className={`absolute inset-0 rounded-full border-2 border-dashed ${config.ring} opacity-40`}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                          />
                          <div className={`absolute inset-2 rounded-full bg-gradient-to-br ${config.iconBg} border ${config.ring} flex items-center justify-center`}>
                            <TierIcon className={`w-8 h-8 ${config.accent} group-hover:scale-110 transition-transform duration-500`} />
                          </div>
                          {/* Sparkle dots */}
                          <motion.div
                            className={`absolute -top-1 -end-1 w-2 h-2 rounded-full ${tier === 'basic' ? 'bg-cyan-400' : tier === 'pro' ? 'bg-violet-400' : 'bg-amber-400'}`}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                          />
                          <motion.div
                            className={`absolute -bottom-0.5 -start-1 w-1.5 h-1.5 rounded-full ${tier === 'basic' ? 'bg-blue-400' : tier === 'pro' ? 'bg-purple-400' : 'bg-orange-400'}`}
                            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                          />
                        </div>

                        {/* Miles amount */}
                        <div className="flex items-center gap-1 mb-1 z-10">
                          <span className="text-3xl font-black text-white">{pkg.miles.toLocaleString()}</span>
                        </div>
                        <p className={`text-sm font-bold mb-5 z-10 ${config.accent}`}>{t("wallet.milesUnit")}</p>

                        {/* Price button */}
                        <div className={`w-full py-3 md:py-4 rounded-2xl font-bold text-white mt-auto z-10 text-lg border transition-all duration-300 ${
                          isPopular 
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400/30 shadow-lg shadow-cyan-500/20" 
                            : "bg-white/10 border-white/5 group-hover:bg-gradient-to-r group-hover:from-cyan-500/80 group-hover:to-blue-500/80 group-hover:border-cyan-400/20"
                        }`}>
                          ${pkg.price}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Miles Info */}
            <div className="glass p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 border-white/10 bg-gradient-to-r from-cyan-500/5 to-transparent">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                  <Globe2 className="text-cyan-400 w-6 h-6" />
                  {t("wallet.milesInfoTitle")}
                </h3>
                <p className="text-white/70 max-w-md font-medium leading-relaxed">
                  {t("wallet.milesInfoDesc")}
                </p>
              </div>
              <div className="flex gap-4 flex-wrap justify-center">
                {[t("wallet.milesUse1"), t("wallet.milesUse2"), t("wallet.milesUse3")].map((m) => (
                  <div key={m} className="h-14 px-6 bg-cyan-500/10 rounded-xl flex items-center justify-center font-bold text-cyan-400 border border-cyan-500/20 text-sm">{m}</div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ---- HISTORY TAB ---- */}
        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Filter Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-4 h-4 text-white/40" />
              {[
                { key: "all", label: t("wallet.filterAll") },
                { key: "recharge", label: t("wallet.filterRecharge") },
                { key: "gift_sent", label: t("wallet.filterGiftSent") },
                { key: "gift_received", label: t("wallet.filterGiftReceived") },
                { key: "withdrawal", label: t("wallet.filterWithdrawal") },
                { key: "commission", label: t("wallet.filterCommission") },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setTxFilter(f.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${txFilter === f.key ? "bg-primary text-white" : "bg-white/5 text-white/50 hover:text-white border border-white/10"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Transactions List */}
            <div className="space-y-3">
              {filteredTx.length === 0 ? (
                <div className="glass p-12 rounded-2xl text-center border border-white/10">
                  <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 font-medium">{t("wallet.noTransactions")}</p>
                </div>
              ) : (
                filteredTx.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass p-4 rounded-2xl border border-white/10 flex items-center gap-4 hover:bg-white/5 transition-all"
                  >
                    {getTxIcon(tx.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{getTxLabel(tx)}</p>
                      <p className="text-white/40 text-xs mt-0.5" dir="ltr">{tx.date}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className={`font-black text-sm ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        {getStatusIcon(tx.status)}
                        <span className={`text-xs font-medium ${tx.status === "completed" ? "text-emerald-400/70" : tx.status === "pending" ? "text-yellow-400/70" : "text-red-400/70"}`}>
                          {t(`wallet.status${tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}`)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Export Button */}
            <button className="flex items-center gap-2 text-sm text-primary font-bold hover:underline mt-2">
              <Download className="w-4 h-4" />
              {t("wallet.exportHistory")}
            </button>
          </motion.div>
        )}

        {/* ---- INCOME TAB ---- */}
        {activeTab === "income" && (
          <motion.div key="income" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Income Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: t("wallet.incomeTotal"), value: mockIncome.totalEarnings, color: "text-white" },
                { label: t("wallet.incomeThisMonth"), value: mockIncome.thisMonth, color: "text-emerald-400" },
                { label: t("wallet.incomeGifts"), value: mockIncome.giftsIncome, color: "text-yellow-400" },
                { label: t("wallet.incomeCommission"), value: mockIncome.commissionIncome, color: "text-primary" },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="glass p-5 rounded-2xl border border-white/10"
                >
                  <p className="text-white/50 text-xs font-bold mb-2">{card.label}</p>
                  <p className={`text-2xl font-black ${card.color}`}>{card.value.toLocaleString()}</p>
                  <p className="text-white/30 text-xs mt-1">{t("common.coins")}</p>
                </motion.div>
              ))}
            </div>

            {/* Monthly Breakdown */}
            <div className="glass p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">{t("wallet.monthlyBreakdown")}</h3>
              <div className="space-y-3">
                {mockIncome.breakdown.map((row, i) => {
                  const total = row.gifts + row.commission;
                  const giftPct = Math.round((row.gifts / total) * 100);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70 font-medium">{row.month}</span>
                        <span className="text-white font-bold">{total.toLocaleString()}</span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
                        <div className="bg-yellow-400/80 rounded-r-none rounded-l-full transition-all" style={{ width: `${giftPct}%` }} />
                        <div className="bg-primary/80 rounded-l-none rounded-r-full transition-all" style={{ width: `${100 - giftPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-6 mt-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400/80" />{t("wallet.incomeGifts")}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary/80" />{t("wallet.incomeCommission")}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ---- WITHDRAW TAB ---- */}
        {activeTab === "withdraw" && (
          <motion.div key="withdraw" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Available for Withdrawal */}
            <div className="glass p-6 rounded-2xl border border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Coins className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-white/50 text-xs font-bold">{t("wallet.availableWithdraw")}</p>
                <p className="text-2xl font-black text-emerald-400">45,200 <span className="text-sm text-white/40 font-medium">{t("common.coins")}</span></p>
              </div>
            </div>

            {/* Withdraw Form */}
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-5">
              <h3 className="text-lg font-bold text-white">{t("wallet.requestWithdraw")}</h3>

              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70">{t("wallet.withdrawAmount")}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary transition-all text-lg font-bold"
                    dir="ltr"
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">{!withdrawAmount && ""}</span>
                </div>
                <p className="text-white/30 text-xs">{t("wallet.minWithdraw")}: 1,000 {t("common.coins")}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70">{t("wallet.withdrawMethod")}</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "bank", label: t("wallet.methodBank") },
                    { key: "paypal", label: "PayPal" },
                    { key: "usdt", label: "USDT" },
                  ].map(m => (
                    <button
                      key={m.key}
                      onClick={() => setWithdrawMethod(m.key)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all border ${withdrawMethod === m.key ? "bg-primary text-white border-primary" : "bg-white/5 text-white/50 border-white/10 hover:text-white"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {withdrawMethod === "bank" && (
                <div className="space-y-3">
                  <input placeholder={t("wallet.bankName")} aria-label={t("wallet.bankName")} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary" />
                  <input placeholder={t("wallet.accountNumber")} aria-label={t("wallet.accountNumber")} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary" dir="ltr" />
                  <input placeholder={t("wallet.accountHolder")} aria-label={t("wallet.accountHolder")} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary" />
                </div>
              )}

              {withdrawMethod === "paypal" && (
                <input placeholder={t("wallet.paypalEmail")} aria-label={t("wallet.paypalEmail")} type="email" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary" dir="ltr" />
              )}

              {withdrawMethod === "usdt" && (
                <div className="space-y-3">
                  <select className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary">
                    <option value="trc20" className="bg-[#1a1a2e] text-white">TRC-20</option>
                    <option value="erc20" className="bg-[#1a1a2e] text-white">ERC-20</option>
                    <option value="bep20" className="bg-[#1a1a2e] text-white">BEP-20</option>
                  </select>
                  <input placeholder={t("wallet.walletAddress")} aria-label={t("wallet.walletAddress")} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary" dir="ltr" />
                </div>
              )}

              <button
                disabled={!withdrawAmount || Number(withdrawAmount) < 1000}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {t("wallet.submitWithdraw")}
              </button>

              <div className="flex items-start gap-2 text-white/30 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{t("wallet.withdrawNote")}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}