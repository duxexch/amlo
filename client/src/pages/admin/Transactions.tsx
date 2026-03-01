import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft, ArrowUpRight, Filter, ChevronRight, ChevronLeft,
  DollarSign, CreditCard, Gift, RefreshCw,
} from "lucide-react";
import { adminTransactions } from "@/lib/adminApi";

interface Transaction {
  id: string;
  userId: string;
  username: string;
  type: string;
  amount: number;
  balanceAfter: number;
  currency: string;
  description: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

const TYPE_OPTIONS = [
  { value: "", label: "كل الأنواع" },
  { value: "purchase", label: "شراء عملات" },
  { value: "gift_sent", label: "إرسال هدية" },
  { value: "gift_received", label: "استلام هدية" },
  { value: "withdrawal", label: "سحب" },
  { value: "refund", label: "استرداد" },
];

const STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "completed", label: "مكتمل" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "failed", label: "فشل" },
];

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ type: "", status: "" });
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      const res = await adminTransactions.list(params);
      if (res.success) {
        setTransactions(res.data || []);
        setPagination((p) => ({ ...p, total: res.pagination?.total || 0, totalPages: res.pagination?.totalPages || 0 }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "purchase": return <CreditCard className="w-4 h-4 text-green-400" />;
      case "gift_sent": return <ArrowUpRight className="w-4 h-4 text-red-400" />;
      case "gift_received": return <ArrowDownLeft className="w-4 h-4 text-blue-400" />;
      case "withdrawal": return <DollarSign className="w-4 h-4 text-orange-400" />;
      case "refund": return <RefreshCw className="w-4 h-4 text-purple-400" />;
      default: return <Gift className="w-4 h-4 text-white/40" />;
    }
  };

  const getTypeLabel = (type: string) => TYPE_OPTIONS.find((t) => t.value === type)?.label || type;
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-400/10 text-green-400";
      case "pending": return "bg-yellow-400/10 text-yellow-400";
      case "failed": return "bg-red-400/10 text-red-400";
      default: return "bg-white/5 text-white/30";
    }
  };
  const getStatusLabel = (status: string) => STATUS_OPTIONS.find((s) => s.value === status)?.label || status;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Outfit" }}>المعاملات المالية</h1>
          <p className="text-white/40 text-sm mt-1">{pagination.total.toLocaleString()} معاملة</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 h-10 text-sm rounded-xl border transition-colors ${showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"}`}
        >
          <Filter className="w-4 h-4" /> فلتر
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <select className="bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white/70 focus:outline-none" value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}>
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white/70 focus:outline-none" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">النوع</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">المستخدم</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">المبلغ</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs hidden md:table-cell">الوصف</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs hidden lg:table-cell">طريقة الدفع</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">الحالة</th>
                <th className="text-right text-white/40 font-medium py-3 px-4 text-xs hidden xl:table-cell">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.02] animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className={`py-3 px-4 ${j >= 3 && j <= 4 ? "hidden md:table-cell" : ""} ${j === 6 ? "hidden xl:table-cell" : ""}`}>
                        <div className="w-16 h-3 bg-white/5 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-white/20">لا يوجد معاملات</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(tx.type)}
                        <span className="text-xs text-white/60">{getTypeLabel(tx.type)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-white">@{tx.username}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-sm font-bold ${tx.type === "gift_sent" || tx.type === "withdrawal" ? "text-red-400" : "text-green-400"}`}>
                        {tx.type === "gift_sent" || tx.type === "withdrawal" ? "-" : "+"}{Math.abs(tx.amount).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-white/25 mr-1">{tx.currency === "coins" ? "عملة" : "ماس"}</span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-xs text-white/40 truncate block max-w-[200px]">{tx.description || "—"}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-xs text-white/40">{tx.paymentMethod || "—"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${getStatusStyle(tx.status)}`}>
                        {getStatusLabel(tx.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden xl:table-cell">
                      <span className="text-xs text-white/30">{new Date(tx.createdAt).toLocaleString("ar-EG")}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/5">
            <p className="text-xs text-white/30">صفحة {pagination.page} من {pagination.totalPages}</p>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 disabled:opacity-30" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
