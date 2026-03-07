import type { WalletTransaction, WithdrawalRequest } from "@shared/schema";

export type WalletTab = "recharge" | "miles" | "history" | "income" | "withdraw";

export type ChartPeriod = 7 | 30 | 90;
export type DateRange = "all" | "today" | "week" | "month";

export interface WalletBalance {
  coins: number;
  diamonds: number;
  miles: number;
}

export interface IncomeStats {
  totalReceived: number;
  todayReceived: number;
  weekReceived: number;
  monthReceived: number;
}

export interface ChartDataPoint {
  day: string;
  total: number;
}

export interface RechargePackage {
  id?: string;
  coins: number;
  price: string;
  bonus: number;
  popular?: boolean;
}

export interface MilesPackage {
  id: string;
  miles: number;
  price: string;
}

export interface WalletPaymentMethodOption {
  id: string;
  name: string;
  nameAr?: string;
  icon?: string;
  provider?: string;
  usageTarget?: "deposit" | "withdrawal" | "both";
  countries?: string[];
  fee?: string;
  minAmount?: string | number;
  maxAmount?: string | number;
}

// Re-export schema types
export type { WalletTransaction, WithdrawalRequest };
