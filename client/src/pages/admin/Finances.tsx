import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, Filter, Wallet, X, Search,
  DollarSign, CreditCard, Coins,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { FinanceTab } from "./financeTypes";
import { SEARCH_PLACEHOLDERS } from "./financeTypes";
import { TransactionsTab } from "./TransactionsTab";
import { WalletsTab } from "./WalletsTab";
import { PaymentMethodsTab } from "./PaymentMethodsTab";
import { CurrenciesTab } from "./CurrenciesTab";
import { WithdrawalsTab } from "./WithdrawalsTab";
import { FinancialDashboard } from "./FinancialDashboard";
import { getSocket } from "@/lib/socketManager";

export function FinancesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<FinanceTab>("transactions");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset search when switching tabs
  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setShowFilters(false);
  }, [activeTab]);

  useEffect(() => {
    const socket = getSocket();
    const onFinanceUpdated = () => setRefreshSignal((v) => v + 1);
    socket.on("finance-updated", onFinanceUpdated);
    return () => {
      socket.off("finance-updated", onFinanceUpdated);
    };
  }, []);

  const tabs: { key: FinanceTab; labelKey: string; icon: React.ElementType }[] = [
    { key: "transactions", labelKey: "admin.finances.tabTransactions", icon: Wallet },
    { key: "withdrawals", labelKey: "admin.finances.tabWithdrawals", icon: ArrowUpRight },
    { key: "wallets", labelKey: "admin.finances.tabWallets", icon: DollarSign },
    { key: "payment-methods", labelKey: "admin.finances.tabPaymentMethods", icon: CreditCard },
    { key: "currencies", labelKey: "admin.finances.tabCurrencies", icon: Coins },
  ];

  return (
    <div className="space-y-2.5">
      {/* Financial Dashboard */}
      <FinancialDashboard refreshSignal={refreshSignal} />

      {/* Header with Search & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl font-black text-white" style={{ fontFamily: "Outfit" }}>
          {t("admin.finances.title")}
        </h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl h-9 pr-10 pl-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder={t(SEARCH_PLACEHOLDERS[activeTab])}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => { setSearchInput(""); setSearch(""); }}>
                <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
              </button>
            )}
          </div>
          {activeTab !== "payment-methods" && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 h-9 text-sm rounded-xl border transition-colors flex-shrink-0 ${showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                }`}
            >
              <Filter className="w-4 h-4" /> {t("admin.finances.filterLabel")}
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex gap-1 p-0.5 bg-white/[0.02] border border-white/5 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab.key
                ? "text-white"
                : "text-white/40 hover:text-white/60"
              }`}
          >
            {activeTab === tab.key && (
              <motion.div
                layoutId="financeTabBg"
                className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-lg"
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              />
            )}
            <tab.icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "transactions" ? (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary>
              <TransactionsTab search={search} showFilters={showFilters} refreshSignal={refreshSignal} />
            </ErrorBoundary>
          </motion.div>
        ) : activeTab === "wallets" ? (
          <motion.div
            key="wallets"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary>
              <WalletsTab search={search} showFilters={showFilters} refreshSignal={refreshSignal} />
            </ErrorBoundary>
          </motion.div>
        ) : activeTab === "withdrawals" ? (
          <motion.div
            key="withdrawals"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary>
              <WithdrawalsTab search={search} showFilters={showFilters} refreshSignal={refreshSignal} />
            </ErrorBoundary>
          </motion.div>
        ) : activeTab === "currencies" ? (
          <motion.div
            key="currencies"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary>
              <CurrenciesTab search={search} />
            </ErrorBoundary>
          </motion.div>
        ) : (
          <motion.div
            key="payment-methods"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary>
              <PaymentMethodsTab search={search} refreshSignal={refreshSignal} />
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

