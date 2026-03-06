import {
  ArrowDownLeft, ArrowUpRight,
  DollarSign, CreditCard, Gift, RefreshCw, TrendingUp,
} from "lucide-react";

/**
 * Shared finance UI helpers — getTypeIcon & getStatusStyle
 * Extracted to eliminate duplication across TransactionsTab, WalletDetailModal, etc.
 */

export function getTypeIcon(type: string, size: "sm" | "md" = "md") {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  switch (type) {
    case "purchase": return <CreditCard className={`${cls} text-green-400`} />;
    case "gift_sent": return <ArrowUpRight className={`${cls} text-red-400`} />;
    case "gift_received": return <ArrowDownLeft className={`${cls} text-blue-400`} />;
    case "withdrawal": return <DollarSign className={`${cls} text-orange-400`} />;
    case "refund": return <RefreshCw className={`${cls} text-purple-400`} />;
    case "commission": return <TrendingUp className={`${cls} text-teal-400`} />;
    case "bonus": return <Gift className={`${cls} text-amber-400`} />;
    default: return <Gift className={`${cls} text-white/40`} />;
  }
}

export function getStatusStyle(status: string): string {
  switch (status) {
    case "completed": return "bg-green-400/10 text-green-400 border-green-400/20";
    case "pending": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
    case "failed": return "bg-red-400/10 text-red-400 border-red-400/20";
    case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
    case "refunded": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
    default: return "bg-white/5 text-white/30 border-white/10";
  }
}
