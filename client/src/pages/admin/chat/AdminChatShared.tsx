/**
 * Admin Chat — Shared Components
 * ════════════════════════════════════════
 */
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";

// ── Stat Card ──
export function StatCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string | number; sub?: string;
  icon: LucideIcon; color: string; bg: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 ${bg}`}
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className={`w-6 h-6 ${color}`} />
        <span className={`text-xs font-medium ${color}`}>{sub}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </motion.div>
  );
}

// ── Loading Skeleton ──
export function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="bg-white/5 rounded-2xl h-32" />)}
      </div>
      <div className="bg-white/5 rounded-2xl h-80" />
    </div>
  );
}

// ── Empty State ──
export function EmptyState({ message, icon: Icon }: { message: string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/30">
      <Icon className="w-16 h-16 mb-4" />
      <p className="text-lg">{message}</p>
    </div>
  );
}

// ── Pagination ──
export function PaginationNav({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 p-3 border-t border-white/10">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">←</button>
      <span className="text-white/50 text-sm">{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-3 py-1 text-sm bg-white/5 rounded-lg text-white/60 disabled:opacity-30 hover:bg-white/10">→</button>
    </div>
  );
}

// ── Confirm Dialog (replaces window.confirm) ──
export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, destructive = true }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-white/50">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">
            {t("common.cancel", "إلغاء")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-purple-600 hover:bg-purple-700 text-white"
            }
          >
            {t("common.confirm", "تأكيد")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── useConfirmDialog hook ──
export function useConfirmDialog() {
  const [state, setState] = useState<{ open: boolean; title: string; description?: string; resolve?: (v: boolean) => void }>({ open: false, title: "" });

  const confirm = (title: string, description?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, title, description, resolve });
    });
  };

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) {
          state.resolve?.(false);
          setState({ open: false, title: "" });
        }
      }}
      title={state.title}
      description={state.description}
      onConfirm={() => {
        state.resolve?.(true);
        setState({ open: false, title: "" });
      }}
    />
  );

  return { confirm, dialog };
}

// ── Debounced value hook ──
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return debouncedValue;
}

// ── Format helpers ──
export function formatDuration(sec: number): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDate(dateStr: string): string {
  const lang = document.documentElement.lang || navigator.language || "ar";
  return new Date(dateStr).toLocaleDateString(lang.startsWith("ar") ? "ar" : lang);
}

export function formatTime(dateStr: string): string {
  const lang = document.documentElement.lang || navigator.language || "ar";
  return new Date(dateStr).toLocaleTimeString(lang.startsWith("ar") ? "ar" : lang, { hour: "2-digit", minute: "2-digit" });
}
