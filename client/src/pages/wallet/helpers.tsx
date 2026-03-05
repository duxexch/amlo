import { useTranslation } from "react-i18next";
import {
  CheckCircle2, Clock, RefreshCw, XCircle,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import type { WalletTransaction } from "./types";

/**
 * Returns a translated status badge for transaction/withdrawal status.
 */
export function useStatusBadge() {
  const { t } = useTranslation();

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      completed: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: t("wallet.statusCompleted2") },
      pending: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", icon: <Clock className="w-3.5 h-3.5" />, label: t("wallet.statusPending2") },
      processing: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, label: t("wallet.statusProcessing") },
      failed: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", icon: <XCircle className="w-3.5 h-3.5" />, label: t("wallet.statusFailed2") },
      rejected: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", icon: <XCircle className="w-3.5 h-3.5" />, label: t("wallet.statusRejected") },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${s.bg} ${s.text}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  return { getStatusBadge };
}

/**
 * Returns meta info (icon + translated label) for a transaction.
 */
export function useTxMeta() {
  const { t } = useTranslation();

  const getTxMeta = (tx: WalletTransaction) => {
    const isIncoming = tx.amount > 0;
    return {
      icon: isIncoming
        ? <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10 flex items-center justify-center"><ArrowDownLeft className="w-5 h-5 text-emerald-400" /></div>
        : <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/10 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-red-400" /></div>,
      label: (() => {
        switch (tx.type) {
          case "recharge": case "purchase": return t("wallet.txRecharge");
          case "gift_sent": return `${t("wallet.txGiftSent")} → ${tx.description || ""}`;
          case "gift_received": return `${t("wallet.txGiftReceived")} ← ${tx.description || ""}`;
          case "withdrawal": return t("wallet.txWithdrawal");
          case "commission": case "bonus": return t("wallet.txCommission");
          case "refund": return t("wallet.cancelWithdrawSuccess");
          default: return tx.description || tx.type;
        }
      })(),
    };
  };

  /**
   * Translate payment method ID to localized name.
   */
  const getMethodLabel = (method: string | null | undefined) => {
    if (!method) return "-";
    switch (method) {
      case "bank": return t("wallet.methodBank");
      case "paypal": return "PayPal";
      case "usdt": return "USDT";
      default: return method;
    }
  };

  return { getTxMeta, getMethodLabel };
}

/**
 * USDT address validation per network.
 */
export function validateUsdtAddress(address: string, network: string): boolean {
  if (!address.trim()) return false;
  switch (network) {
    case "trc20":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    case "erc20":
    case "bep20":
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    default:
      return address.length >= 20;
  }
}

/**
 * Format number with thousands separators while typing.
 */
export function formatWithdrawAmount(value: string): string {
  const num = value.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("en-US");
}

export function parseWithdrawAmount(formatted: string): string {
  return formatted.replace(/[^\d]/g, "");
}

/**
 * Get date range start date.
 */
export function getDateRangeStart(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "all":
    default:
      return null;
  }
}

/**
 * Trigger haptic feedback if available.
 */
export function haptic(pattern: number | number[] = 50) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/**
 * Share transaction receipt using Web Share API.
 */
export async function shareReceipt(tx: WalletTransaction, t: (key: string, options?: any) => string): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    const text = [
      `${t("wallet.transactionDetails")}`,
      `${t("wallet.txType")}: ${tx.type}`,
      `${t("wallet.txDate")}: ${tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}`,
      `${t("wallet.withdrawAmount")}: ${tx.amount > 0 ? "+" : ""}${tx.amount?.toLocaleString()}`,
      `${t("wallet.balanceAfter")}: ${tx.balanceAfter?.toLocaleString() || "-"}`,
      `${t("wallet.txId")}: ${tx.id}`,
    ].join("\n");
    await navigator.share({ title: t("wallet.transactionDetails"), text });
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt biometric (WebAuthn) confirmation.
 * Returns true if user confirmed, false if not available/cancelled.
 */
export async function biometricConfirm(): Promise<boolean> {
  if (!window.PublicKeyCredential) return true; // fallback: skip if not supported
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return true; // not available, skip
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname,
        allowCredentials: [],
      },
    });
    return true;
  } catch {
    return false; // user cancelled
  }
}

/**
 * LocalStorage helpers for saving preferred withdrawal method.
 */
const PREF_KEY = "ablox_withdraw_prefs";
export function saveWithdrawPrefs(data: Record<string, string>) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(data));
  } catch {}
}
export function loadWithdrawPrefs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
