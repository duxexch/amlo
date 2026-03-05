import type { WalletTransaction, WithdrawalRequest } from "@shared/schema";

export type WalletTab = "recharge" | "miles" | "history" | "income" | "withdraw";

export type ChartPeriod = 7 | 30 | 90;
export type DateRange = "all" | "today" | "week" | "month";

export interface WalletBalance {
  coins: number;
  diamonds: number;
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

// Re-export schema types
export type { WalletTransaction, WithdrawalRequest };
