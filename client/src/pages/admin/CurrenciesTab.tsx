import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit3, Trash2, X, CheckCircle, Loader2, Save,
  Coins, Phone, Users, Filter, MessageSquare, ToggleLeft, ToggleRight,
} from "lucide-react";
import { adminPricing } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { useConfirmDialog } from "../wallet/helpers";
import { toast } from "sonner";

// ════════════════════════════════════════════════════════════
// LOCAL CONSTANTS
// ════════════════════════════════════════════════════════════

const FILTER_LABELS: Record<string, string> = {
  spin_cost: "filterSpin",
  gender_both: "filterGenderBoth",
  gender_male: "filterGenderMale",
  gender_female: "filterGenderFemale",
  age_range: "filterAgeRange",
  country_specific: "filterCountrySpecific",
  country_all: "filterCountryAll",
};

// ════════════════════════════════════════════════════════════
// CURRENCIES TAB
// ════════════════════════════════════════════════════════════

export function CurrenciesTab({ search }: { search: string }) {
  const { t } = useTranslation();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<{ id: string; coins: number; bonusCoins: number; priceUsd: string; isPopular: boolean; sortOrder: number }[]>([]);
  const [filters, setFilters] = useState<{ filterType: string; priceCoins: number }[]>([]);
  const [callRates, setCallRates] = useState<{ voiceCallRate: number; videoCallRate: number }>({ voiceCallRate: 5, videoCallRate: 10 });
  const [messageCosts, setMessageCosts] = useState<Record<string, any>>({});
  const [matchingStats, setMatchingStats] = useState<Record<string, number> | null>(null);
  const [editingPackage, setEditingPackage] = useState<Record<string, any> | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminPricing.getAll();
      if (res.data) {
        const d = res.data;
        setPackages(d.coinPackages || []);
        if (d.filters) {
          const filterArr = Object.entries(d.filters).map(([key, val]) => ({
            filterType: key, priceCoins: val as number,
          }));
          setFilters(filterArr);
        }
        if (d.calls) {
          setCallRates({
            voiceCallRate: d.calls.voice_call_rate || 5,
            videoCallRate: d.calls.video_call_rate || 10,
          });
        }
        if (d.messages) setMessageCosts(d.messages);
        if (d.matchingStats) setMatchingStats(d.matchingStats);
      }
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const saveCallRates = async () => {
    setSaving(true);
    try {
      await adminPricing.updateCallRates(callRates);
      showSuccess(t("admin.finances.savedSuccess"));
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
    setSaving(false);
  };

  const saveFilter = async (filterType: string, priceCoins: number) => {
    try {
      await adminPricing.bulkUpdateFilters([{ filterType, priceCoins }]);
      showSuccess(t("admin.finances.savedSuccess"));
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
  };

  const saveMessageCosts = async () => {
    setSaving(true);
    try {
      await adminPricing.updateMessageCosts(messageCosts);
      showSuccess(t("admin.finances.savedSuccess"));
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
    setSaving(false);
  };

  const deletePackage = async (id: string) => {
    if (!(await confirm(t("admin.finances.deleteConfirm")))) return;
    try {
      await adminPricing.deleteCoinPackage(id);
      setPackages(prev => prev.filter(p => p.id !== id));
      showSuccess(t("admin.finances.savedSuccess"));
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
  };

  const savePackage = async (data: any) => {
    setSaving(true);
    try {
      if (editingPackage?.id) {
        await adminPricing.updateCoinPackage(editingPackage.id, data);
      } else {
        await adminPricing.createCoinPackage(data);
      }
      setShowPackageModal(false);
      setEditingPackage(null);
      loadData();
      showSuccess(t("admin.finances.savedSuccess"));
    } catch { toast.error(t("common.networkError", "خطأ في الاتصال")); }
    setSaving(false);
  };

  const filteredPackages = useMemo(() => {
    if (!search) return packages;
    const q = search.toLowerCase();
    return packages.filter((p: any) =>
      String(p.coins ?? "").includes(q) ||
      String(p.priceUsd ?? "").includes(q) ||
      String(p.label ?? "").toLowerCase().includes(q)
    );
  }, [packages, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      {/* Success Message */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-emerald-400 text-sm text-center"
          >
            <CheckCircle className="w-4 h-4 inline-block mr-1" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Matching Stats */}
      {matchingStats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-black text-white">{matchingStats.queueSize || 0}</p>
            <p className="text-[10px] text-white/40 font-medium">{t("admin.finances.queueSize")}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
            <Coins className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-black text-white">{matchingStats.activeMatches || 0}</p>
            <p className="text-[10px] text-white/40 font-medium">{t("admin.finances.activeMatches")}</p>
          </div>
        </div>
      )}

      {/* Coin Packages */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            {t("admin.finances.coinPackages")}
          </h3>
          <button
            onClick={() => { setEditingPackage({}); setShowPackageModal(true); }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> {t("admin.finances.addPackage")}
          </button>
        </div>

        {filteredPackages.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-6">{t("admin.finances.noPackages")}</p>
        ) : (
          <div className="space-y-2">
            {filteredPackages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{pkg.coins?.toLocaleString()}</span>
                      {(pkg.bonusCoins || 0) > 0 && (
                        <span className="text-emerald-400 text-[10px] font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded">
                          +{pkg.bonusCoins}
                        </span>
                      )}
                      {pkg.isPopular && (
                        <span className="text-amber-400 text-[10px] font-bold bg-amber-400/10 px-1.5 py-0.5 rounded">
                          ⭐
                        </span>
                      )}
                    </div>
                    <span className="text-white/40 text-xs">${pkg.priceUsd}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditingPackage(pkg); setShowPackageModal(true); }}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                  >
                    <Edit3 className="w-3 h-3 text-white/50" />
                  </button>
                  <button
                    onClick={() => deletePackage(pkg.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/5 hover:bg-red-500/15 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3 text-red-400/60" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Rates */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4 text-emerald-400" />
          {t("admin.finances.callRates")}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">
              {t("admin.finances.voiceCallRate")}
            </label>
            <input
              type="number"
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
              value={callRates.voiceCallRate}
              onChange={(e) => setCallRates(prev => ({ ...prev, voiceCallRate: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">
              {t("admin.finances.videoCallRate")}
            </label>
            <input
              type="number"
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
              value={callRates.videoCallRate}
              onChange={(e) => setCallRates(prev => ({ ...prev, videoCallRate: Number(e.target.value) }))}
            />
          </div>
        </div>
        <button
          onClick={saveCallRates}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 text-xs text-white bg-primary/20 hover:bg-primary/30 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t("admin.finances.saveChanges")}
        </button>
      </div>

      {/* Filter Pricing */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-blue-400" />
          {t("admin.finances.filterPricing")}
        </h3>
        <div className="space-y-2">
          {filters.map((f) => (
            <div key={f.filterType} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-3">
              <span className="text-white/60 text-xs font-medium">
                {t(`admin.finances.${FILTER_LABELS[f.filterType] || f.filterType}`)}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  className="w-20 bg-white/5 border border-white/10 rounded-lg h-7 px-2 text-xs text-white text-center focus:outline-none focus:border-primary/50"
                  value={f.priceCoins}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFilters(prev => prev.map(p => p.filterType === f.filterType ? { ...p, priceCoins: val } : p));
                  }}
                  onBlur={() => saveFilter(f.filterType, f.priceCoins)}
                />
                <span className="text-white/30 text-[10px]">{t("matching.coins")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Costs */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          {t("admin.finances.messageCosts")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">
              {t("admin.finances.messageCost")}
            </label>
            <input
              type="number"
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
              value={messageCosts.message_cost || 0}
              onChange={(e) => setMessageCosts((prev: any) => ({ ...prev, message_cost: Number(e.target.value) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "media_enabled", label: "mediaEnabled" },
              { key: "voice_call_enabled", label: "voiceCallEnabled" },
              { key: "video_call_enabled", label: "videoCallEnabled" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
                <span className="text-white/60 text-xs">{t(`admin.finances.${item.label}`)}</span>
                <button
                  onClick={() => setMessageCosts((prev: any) => ({
                    ...prev,
                    [item.key]: prev[item.key] === "true" || prev[item.key] === true ? "false" : "true",
                  }))}
                  className="flex-shrink-0"
                >
                  {messageCosts[item.key] === "true" || messageCosts[item.key] === true ? (
                    <ToggleRight className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-white/20" />
                  )}
                </button>
              </div>
            ))}
            <div>
              <label className="text-[10px] text-white/40 font-medium mb-1 block">
                {t("admin.finances.timeLimit")}
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
                value={messageCosts.time_limit || 0}
                onChange={(e) => setMessageCosts((prev: any) => ({ ...prev, time_limit: Number(e.target.value) }))}
              />
            </div>
          </div>
          <button
            onClick={saveMessageCosts}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-white bg-primary/20 hover:bg-primary/30 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {t("admin.finances.saveChanges")}
          </button>
        </div>
      </div>

      {/* Package Edit Modal */}
      <AnimatePresence>
        {showPackageModal && (
          <PackageEditModal
            pkg={editingPackage}
            saving={saving}
            onSave={savePackage}
            onClose={() => { setShowPackageModal(false); setEditingPackage(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PACKAGE EDIT MODAL
// ════════════════════════════════════════════════════════════

function PackageEditModal({ pkg, saving, onSave, onClose }: {
  pkg: any; saving: boolean;
  onSave: (data: any) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [coins, setCoins] = useState(pkg?.coins || 100);
  const [bonusCoins, setBonusCoins] = useState(pkg?.bonusCoins || 0);
  const [priceUsd, setPriceUsd] = useState(pkg?.priceUsd || "0.99");
  const [isPopular, setIsPopular] = useState(pkg?.isPopular || false);
  const [sortOrder, setSortOrder] = useState(pkg?.sortOrder || 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm mx-4 bg-[#12122a] border border-white/10 rounded-2xl p-5"
      >
        <button onClick={onClose} className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-white/50" />
        </button>
        <h3 className="text-base font-bold text-white mb-4 text-center">
          {pkg?.id ? t("admin.finances.editPackage") : t("admin.finances.addPackage")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packageCoins")}</label>
            <input type="number" min={1} className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packageBonus")}</label>
            <input type="number" min={0} className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={bonusCoins} onChange={(e) => setBonusCoins(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packagePrice")}</label>
            <input type="text" className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
          </div>
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
            <span className="text-white/60 text-xs">{t("admin.finances.packagePopular")}</span>
            <button onClick={() => setIsPopular(!isPopular)}>
              {isPopular ? <ToggleRight className="w-6 h-6 text-amber-400" /> : <ToggleLeft className="w-6 h-6 text-white/20" />}
            </button>
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-medium mb-1 block">{t("admin.finances.packageSort")}</label>
            <input type="number" min={0} className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-primary/50" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
          <button
            onClick={() => onSave({ coins, bonusCoins, priceUsd, isPopular, sortOrder })}
            disabled={saving}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("admin.finances.saveChanges")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
