// ════════════════════════════════════════════════════════════
// Finance Types & Constants — مشتركة بين جميع ملفات المالية
// ════════════════════════════════════════════════════════════

export interface Transaction {
  id: string;
  userId: string;
  username: string;
  userName?: string;
  type: string;
  amount: number;
  balanceAfter: number;
  currency: string;
  description: string;
  paymentMethod: string;
  status: string;
  adminNotes: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  type: string;
  provider: string;
  countries: string[];
  minAmount: number;
  maxAmount: number;
  fee: string;
  isActive: boolean;
  sortOrder: number;
  instructions: string;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  amountUsd?: number;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentDetails: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
  user?: { id?: string; username: string; displayName?: string };
}

export interface FinanceStats {
  revenue?: { total: number; today: number; month: number };
  withdrawn?: number;
  withdrawals?: { pending: number; pendingAmount: number };
  giftVolume?: number;
  circulation?: { totalCoins: number; totalDiamonds: number };
  comparison?: { weekGrowth: number | null; monthGrowth: number | null };
}

export interface BalanceAdjustment {
  id: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════

export const TX_TYPE_OPTIONS = [
  { value: "", labelKey: "admin.finances.allTypes" },
  { value: "purchase", labelKey: "admin.finances.txTypePurchase" },
  { value: "gift_sent", labelKey: "admin.finances.txTypeGiftSent" },
  { value: "gift_received", labelKey: "admin.finances.txTypeGiftReceived" },
  { value: "withdrawal", labelKey: "admin.finances.txTypeWithdrawal" },
  { value: "refund", labelKey: "admin.finances.txTypeRefund" },
  { value: "commission", labelKey: "admin.finances.txTypeCommission" },
  { value: "bonus", labelKey: "admin.finances.txTypeBonus" },
];

export const TX_STATUS_OPTIONS = [
  { value: "", labelKey: "admin.finances.allStatuses" },
  { value: "completed", labelKey: "admin.finances.txStatusCompleted" },
  { value: "pending", labelKey: "admin.finances.txStatusPending" },
  { value: "rejected", labelKey: "admin.finances.txStatusRejected" },
  { value: "failed", labelKey: "admin.finances.txStatusFailed" },
  { value: "refunded", labelKey: "admin.finances.txStatusRefunded" },
];

export const PM_TYPE_OPTIONS = [
  { value: "card", labelKey: "admin.finances.pmTypeCard" },
  { value: "e_wallet", labelKey: "admin.finances.pmTypeEWallet" },
  { value: "crypto", labelKey: "admin.finances.pmTypeCrypto" },
  { value: "telecom", labelKey: "admin.finances.pmTypeTelecom" },
  { value: "bank_transfer", labelKey: "admin.finances.pmTypeBankTransfer" },
];

export const PM_ICONS = ["💳", "🍎", "📱", "📲", "📞", "🏦", "🪙", "💰", "🅿️", "⚡", "🔗", "💎"];

export const COUNTRY_OPTIONS = [
  { code: "SA", labelKey: "admin.finances.countrySA" },
  { code: "EG", labelKey: "admin.finances.countryEG" },
  { code: "AE", labelKey: "admin.finances.countryAE" },
  { code: "IQ", labelKey: "admin.finances.countryIQ" },
  { code: "JO", labelKey: "admin.finances.countryJO" },
  { code: "KW", labelKey: "admin.finances.countryKW" },
  { code: "MA", labelKey: "admin.finances.countryMA" },
  { code: "DZ", labelKey: "admin.finances.countryDZ" },
  { code: "TN", labelKey: "admin.finances.countryTN" },
];

export const WR_STATUS_OPTIONS = [
  { value: "", labelKey: "admin.finances.allStatuses" },
  { value: "pending", labelKey: "admin.finances.txStatusPending" },
  { value: "processing", labelKey: "admin.finances.wrStatusProcessing" },
  { value: "completed", labelKey: "admin.finances.txStatusCompleted" },
  { value: "rejected", labelKey: "admin.finances.txStatusRejected" },
];

export type FinanceTab = "transactions" | "wallets" | "payment-methods" | "currencies" | "withdrawals";

export const SEARCH_PLACEHOLDERS: Record<FinanceTab, string> = {
  transactions: "admin.finances.searchTransactions",
  wallets: "admin.finances.searchWallets",
  "payment-methods": "admin.finances.searchPaymentMethods",
  currencies: "admin.finances.searchPaymentMethods",
  withdrawals: "admin.finances.searchTransactions",
};
