import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit3, Trash2, X, AlertCircle, CheckCircle, XCircle,
  Globe, ToggleLeft, ToggleRight, Loader2,
} from "lucide-react";
import { adminPaymentMethods } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { useConfirmDialog } from "../wallet/helpers";
import type { PaymentMethod } from "./financeTypes";
import { PM_TYPE_OPTIONS, PM_USAGE_OPTIONS, PM_ICONS, COUNTRY_OPTIONS } from "./financeTypes";

// ════════════════════════════════════════════════════════════
// FORM FIELD (local utility)
// ════════════════════════════════════════════════════════════

function FormField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/40 font-medium mb-1.5 block">{label}</label>
      <input
        type={type}
        className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PAYMENT METHODS TAB
// ════════════════════════════════════════════════════════════

export function PaymentMethodsTab({ search, refreshSignal = 0 }: { search: string; refreshSignal?: number }) {
  const { t } = useTranslation();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "", nameAr: "", icon: "💳", type: "card", provider: "",
    usageTarget: "both" as "deposit" | "withdrawal" | "both",
    countries: [] as string[], minAmount: "", maxAmount: "", fee: "", instructions: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminPaymentMethods.list();
      if (res.success) setMethods(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshSignal]);

  const openCreate = () => {
    setEditMethod(null);
    setFormData({ name: "", nameAr: "", icon: "💳", type: "card", provider: "", usageTarget: "both", countries: [], minAmount: "", maxAmount: "", fee: "", instructions: "" });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (pm: PaymentMethod) => {
    setEditMethod(pm);
    setFormData({
      name: pm.name,
      nameAr: pm.nameAr,
      icon: pm.icon,
      type: pm.type,
      provider: pm.provider,
      usageTarget: pm.usageTarget || "both",
      countries: pm.countries || [],
      minAmount: String(pm.minAmount),
      maxAmount: String(pm.maxAmount),
      fee: pm.fee,
      instructions: pm.instructions,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.name || !formData.nameAr || !formData.type) {
      setFormError(t("admin.finances.nameRequired"));
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        minAmount: parseInt(formData.minAmount) || 1,
        maxAmount: parseInt(formData.maxAmount) || 10000,
      };
      if (editMethod) {
        await adminPaymentMethods.update(editMethod.id, payload);
      } else {
        await adminPaymentMethods.create(payload);
      }
      setShowForm(false);
      fetchData();
    } catch (e: any) {
      setFormError(e?.message || t("admin.finances.errorOccurred"));
    } finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm(t("admin.finances.confirmDelete")))) return;
    try {
      await adminPaymentMethods.delete(id);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleToggle = async (pm: PaymentMethod) => {
    try {
      await adminPaymentMethods.update(pm.id, { isActive: !pm.isActive });
      setMethods((prev) => prev.map((m) => m.id === pm.id ? { ...m, isActive: !m.isActive } : m));
    } catch (e) { console.error(e); }
  };

  const [toggleAllLoading, setToggleAllLoading] = useState(false);
  const allActive = methods.length > 0 && methods.every((m) => m.isActive);

  const handleToggleAll = async () => {
    const newState = !allActive;
    setToggleAllLoading(true);
    try {
      const results = await Promise.allSettled(methods.map((m) => adminPaymentMethods.update(m.id, { isActive: newState })));
      const failedCount = results.filter(r => r.status === "rejected").length;
      if (failedCount > 0) console.warn(`${failedCount} toggle updates failed`);
      setMethods((prev) => prev.map((m) => ({ ...m, isActive: newState })));
    } catch (e) { console.error(e); }
    finally { setToggleAllLoading(false); }
  };

  const toggleCountry = (code: string) => {
    setFormData((f) => ({
      ...f,
      countries: f.countries.includes(code)
        ? f.countries.filter((c) => c !== code)
        : [...f.countries, code],
    }));
  };

  const getTypeLabel = (type: string) => { const opt = PM_TYPE_OPTIONS.find((o) => o.value === type); return opt ? t(opt.labelKey) : type; };
  const getUsageLabel = (usage?: string) => {
    switch (usage) {
      case "deposit": return "ايداع/شراء";
      case "withdrawal": return "سحب";
      default: return "كلاهما";
    }
  };
  const getTypeStyle = (type: string) => {
    switch (type) {
      case "card": return "bg-blue-400/10 text-blue-400 border-blue-400/20";
      case "e_wallet": return "bg-green-400/10 text-green-400 border-green-400/20";
      case "crypto": return "bg-orange-400/10 text-orange-400 border-orange-400/20";
      case "telecom": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      case "bank_transfer": return "bg-cyan-400/10 text-cyan-400 border-cyan-400/20";
      default: return "bg-white/5 text-white/30 border-white/10";
    }
  };

  const countryLabel = (code: string) => { const opt = COUNTRY_OPTIONS.find((c) => c.code === code); return opt ? t(opt.labelKey) : code; };

  const filteredMethods = useMemo(() => {
    if (!search) return methods;
    const q = search.toLowerCase();
    return methods.filter((pm) =>
      pm.nameAr.toLowerCase().includes(q) ||
      pm.name.toLowerCase().includes(q) ||
      pm.provider.toLowerCase().includes(q)
    );
  }, [methods, search]);

  return (
    <div className="space-y-2.5">
      <ConfirmDialog />
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/50">{t("admin.finances.paymentMethodsCount", { count: filteredMethods.length })}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAll}
            disabled={toggleAllLoading || methods.length === 0}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-bold transition-colors border disabled:opacity-40 ${allActive
                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
              }`}
          >
            {toggleAllLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : allActive ? (
              <><XCircle className="w-3.5 h-3.5" /> {t("admin.finances.deactivateAll")}</>
            ) : (
              <><CheckCircle className="w-3.5 h-3.5" /> {t("admin.finances.activateAll")}</>
            )}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 h-8 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t("admin.finances.addPaymentMethod")}
          </button>
        </div>
      </div>

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-xl h-44 animate-pulse" />
          ))
        ) : filteredMethods.length === 0 ? (
          <div className="col-span-full text-center py-12 text-white/20">{search ? t("admin.finances.noResults") : t("admin.finances.noPaymentMethods")}</div>
        ) : (
          filteredMethods.map((pm, i) => (
            <motion.div
              key={pm.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`bg-[#0c0c1d] border rounded-xl p-4 hover:border-white/10 transition-colors relative ${pm.isActive ? "border-white/5" : "border-red-500/20 opacity-60"}`}
            >
              {/* Top row: icon + name + toggle */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-xl">
                    {pm.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{pm.nameAr}</h3>
                    <p className="text-[11px] text-white/30">{pm.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(pm)}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${pm.isActive ? "bg-green-500" : "bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${pm.isActive ? "left-0.5" : "left-[22px]"}`} />
                </button>
              </div>

              {/* Info rows */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmType")}</span>
                  <span className={`font-bold px-2 py-0.5 rounded-lg border text-[10px] ${getTypeStyle(pm.type)}`}>{getTypeLabel(pm.type)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmProvider")}</span>
                  <span className="text-white/60 font-medium">{pm.provider || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">اتجاه الاستخدام</span>
                  <span className="text-white/60 font-medium">{getUsageLabel(pm.usageTarget)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmLimits")}</span>
                  <span className="text-white/60 font-mono">${pm.minAmount} – ${pm.maxAmount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">{t("admin.finances.pmFee")}</span>
                  <span className="text-yellow-400 font-bold">{pm.fee}</span>
                </div>
              </div>

              {/* Countries */}
              {pm.countries && pm.countries.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {pm.countries.map((code) => (
                    <span key={code} className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded-md font-bold">
                      {countryLabel(code)}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1.5">
                <button
                  className="flex-1 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 font-bold transition-colors flex items-center justify-center gap-1"
                  onClick={() => openEdit(pm)}
                >
                  <Edit3 className="w-3 h-3" /> {t("common.edit")}
                </button>
                <button
                  className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                  onClick={() => handleDelete(pm.id)}
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>

              {/* Inactive badge */}
              {!pm.isActive && (
                <div className="absolute top-2.5 left-2.5 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md font-bold">{t("admin.finances.pmDisabled")}</div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div
              className="relative w-full max-w-lg bg-[#0c0c1d] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">{editMethod ? t("admin.finances.editPaymentMethod") : t("admin.finances.addNewPaymentMethod")}</h3>
                <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Icon Picker */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-2 block">{t("admin.finances.iconLabel")}</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {PM_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`w-full aspect-square rounded-lg text-xl flex items-center justify-center transition-colors ${formData.icon === icon ? "bg-primary/20 border border-primary/40" : "bg-white/5 hover:bg-white/10 border border-transparent"}`}
                        onClick={() => setFormData((f) => ({ ...f, icon }))}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Names */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("admin.finances.nameEn")} value={formData.name} onChange={(v) => setFormData((f) => ({ ...f, name: v }))} placeholder="Visa / Mastercard" />
                  <FormField label={t("admin.finances.nameAr")} value={formData.nameAr} onChange={(v) => setFormData((f) => ({ ...f, nameAr: v }))} placeholder={t("admin.finances.nameArPlaceholder")} />
                </div>

                {/* Type + Usage + Provider */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.finances.pmType")}</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white/70 focus:outline-none"
                      value={formData.type}
                      onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    >
                      {PM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 font-medium mb-1.5 block">اتجاه الاستخدام</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white/70 focus:outline-none"
                      value={formData.usageTarget}
                      onChange={(e) => setFormData((f) => ({ ...f, usageTarget: e.target.value as "deposit" | "withdrawal" | "both" }))}
                    >
                      {PM_USAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <FormField label={t("admin.finances.pmProvider")} value={formData.provider} onChange={(v) => setFormData((f) => ({ ...f, provider: v }))} placeholder="Stripe, PayPal..." />
                </div>

                {/* Amounts + Fee */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField label={t("admin.finances.minAmount")} value={formData.minAmount} onChange={(v) => setFormData((f) => ({ ...f, minAmount: v }))} placeholder="1" type="number" />
                  <FormField label={t("admin.finances.maxAmount")} value={formData.maxAmount} onChange={(v) => setFormData((f) => ({ ...f, maxAmount: v }))} placeholder="10000" type="number" />
                  <FormField label={t("admin.finances.pmFee")} value={formData.fee} onChange={(v) => setFormData((f) => ({ ...f, fee: v }))} placeholder="2.9%" />
                </div>

                {/* Countries */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-2 block flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {t("admin.finances.supportedCountries")}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNTRY_OPTIONS.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleCountry(c.code)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${formData.countries.includes(c.code)
                            ? "bg-primary/15 border-primary/30 text-primary font-bold"
                            : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                          }`}
                      >
                        {t(c.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.finances.paymentInstructions")}</label>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors resize-none h-20"
                    placeholder={t("admin.finances.paymentInstructionsPlaceholder")}
                    value={formData.instructions}
                    onChange={(e) => setFormData((f) => ({ ...f, instructions: e.target.value }))}
                  />
                </div>

                {/* Error */}
                {formError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    disabled={formLoading}
                    onClick={handleSubmit}
                  >
                    {formLoading ? t("admin.finances.saving") : editMethod ? t("admin.finances.saveChanges") : t("common.add")}
                  </button>
                  <button
                    className="px-6 h-10 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-colors"
                    onClick={() => setShowForm(false)}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
