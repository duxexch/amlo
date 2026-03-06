import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2, Clock, RefreshCw, XCircle,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import type { WalletTransaction } from "./types";

/**
 * Reusable hook: close a modal on Escape key.
 */
export function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
}

/**
 * useFocusTrap — traps Tab focus within a modal container.
 * Returns a ref to attach to the modal container element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const focusable = () =>
      el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    el.addEventListener("keydown", handler);
    // Auto-focus first focusable element
    const items = focusable();
    if (items.length > 0) items[0].focus();

    return () => el.removeEventListener("keydown", handler);
  }, []);

  return ref;
}

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
 * Validate email format.
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
 * @param locale — i18n.language for date formatting
 */
export async function shareReceipt(tx: WalletTransaction, t: (key: string, options?: any) => string, locale?: string): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    const text = [
      `${t("wallet.transactionDetails")}`,
      `${t("wallet.txType")}: ${tx.type}`,
      `${t("wallet.txDate")}: ${tx.createdAt ? new Date(tx.createdAt).toLocaleString(locale) : "-"}`,
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
 * Returns true if user confirmed or biometrics unavailable (with warning), false if cancelled.
 */
export async function biometricConfirm(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    console.warn("[biometricConfirm] WebAuthn not supported — skipping verification");
    return true;
  }
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      console.warn("[biometricConfirm] Platform authenticator not available — skipping");
      return true;
    }
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

/**
 * useConfirmDialog — replaces browser confirm() with a custom in-app dialog.
 * Returns { confirm, ConfirmDialog } — render <ConfirmDialog /> in your JSX.
 */
export function useConfirmDialog() {
  const { t } = useTranslation();
  const [state, setState] = useState<{
    message: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  function ConfirmDialog() {
    if (!state) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />
        <div className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 mx-4">
          <p className="text-sm text-white/80">{state.message}</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 bg-red-500/20 text-red-400 font-bold text-xs rounded-xl hover:bg-red-500/30 transition-colors"
            >
              {t("common.confirm", "تأكيد")}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-2 bg-white/5 text-white/60 font-bold text-xs rounded-xl hover:bg-white/10 transition-colors"
            >
              {t("common.cancel", "إلغاء")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return { confirm, ConfirmDialog };
}
