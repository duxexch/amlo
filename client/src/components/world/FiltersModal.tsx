import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Coins, Plane, ChevronDown, MessageSquare, Mic, Video, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CountrySelector, COUNTRIES } from "./CountrySelector";

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (filters: {
    genderFilter: "male" | "female" | "both";
    ageMin: number;
    ageMax: number;
    countryFilter?: string;
    chatType: "text" | "voice" | "video";
  }) => void;
  onSave?: (filters: {
    genderFilter: "male" | "female" | "both";
    ageMin: number;
    ageMax: number;
    countryFilter?: string;
    chatType: "text" | "voice" | "video";
  }) => void;
  pricing: any[];
  userCoins: number;
  loading?: boolean;
  savedFilters?: {
    genderFilter: "male" | "female" | "both";
    ageMin: number;
    ageMax: number;
    countryFilter?: string;
    chatType: "text" | "voice" | "video";
  };
}

export function FiltersModal({ isOpen, onClose, onStart, onSave, pricing, userCoins, loading, savedFilters }: FiltersModalProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [gender, setGender] = useState<"male" | "female" | "both">(savedFilters?.genderFilter || "both");
  const [ageMin, setAgeMin] = useState(savedFilters?.ageMin || 18);
  const [ageMax, setAgeMax] = useState(savedFilters?.ageMax || 60);
  const [country, setCountry] = useState<string | null>(savedFilters?.countryFilter || null);
  const [chatType, setChatType] = useState<"text" | "voice" | "video">(savedFilters?.chatType || "text");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Sync with saved filters when modal opens
  useEffect(() => {
    if (isOpen && savedFilters) {
      setGender(savedFilters.genderFilter || "both");
      setAgeMin(savedFilters.ageMin || 18);
      setAgeMax(savedFilters.ageMax || 60);
      setCountry(savedFilters.countryFilter || null);
      setChatType(savedFilters.chatType || "text");
    }
  }, [isOpen, savedFilters]);

  // Calculate cost
  const calculateCost = useCallback(() => {
    let total = 0;
    const getPrice = (type: string) => pricing.find(p => p.filterType === type)?.priceCoins || 0;

    total += getPrice("spin_cost");
    total += getPrice(`gender_${gender}`);
    if (ageMin !== 18 || ageMax !== 60) total += getPrice("age_range");
    if (country) total += getPrice("country_specific");

    return total;
  }, [pricing, gender, ageMin, ageMax, country]);

  const cost = calculateCost();
  const canAfford = userCoins >= cost;

  const selectedCountryData = country ? COUNTRIES.find(c => c.code === country) : null;

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[28px] border-t border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3">
            <h3 className="text-white font-bold text-xl">{t("world.filters.title")}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Gender Filter */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/70">{t("world.filters.gender")}</span>
                {pricing.find(p => p.filterType === `gender_${gender}`)?.priceCoins > 0 && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                    +{pricing.find(p => p.filterType === `gender_${gender}`)?.priceCoins} {t("common.coins")}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {(["both", "male", "female"] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      gender === g
                        ? "bg-primary/20 text-primary border border-primary/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                        : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                    }`}
                  >
                    {g === "both" ? "⚧️ " : g === "male" ? "♂️ " : "♀️ "}
                    {t(`world.filters.gender${g.charAt(0).toUpperCase() + g.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Age Range */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/70">{t("world.filters.age")}</span>
                {(ageMin !== 18 || ageMax !== 60) && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                    +{pricing.find(p => p.filterType === "age_range")?.priceCoins || 0} {t("common.coins")}
                  </span>
                )}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs">{t("world.filters.ageRange")}</span>
                  <span className="text-white font-bold text-sm">{ageMin} — {ageMax}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/30 w-6">Min</span>
                    <input
                      type="range"
                      min={13}
                      max={ageMax - 1}
                      value={ageMin}
                      onChange={e => setAgeMin(parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                    />
                    <span className="text-white font-bold text-xs w-8 text-center">{ageMin}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/30 w-6">Max</span>
                    <input
                      type="range"
                      min={ageMin + 1}
                      max={100}
                      value={ageMax}
                      onChange={e => setAgeMax(parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                    />
                    <span className="text-white font-bold text-xs w-8 text-center">{ageMax}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Country Filter */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/70">{t("world.filters.country")}</span>
                {country && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                    +{pricing.find(p => p.filterType === "country_specific")?.priceCoins || 0} {t("common.coins")}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowCountryPicker(true)}
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl h-12 px-4 hover:bg-white/[0.08] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{selectedCountryData?.flag || "🌍"}</span>
                  <span className="text-sm text-white/70">
                    {selectedCountryData
                      ? (isAr ? selectedCountryData.nameAr : selectedCountryData.nameEn)
                      : t("world.filters.allCountries")}
                  </span>
                  {!country && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">{t("world.filters.free")}</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-white/30" />
              </button>
            </div>

            {/* Chat Type Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/70">{t("world.filters.chatType")}</span>
              </div>
              <div className="flex gap-2">
                {([
                  { type: "text" as const, icon: MessageSquare, label: t("world.filters.chatText") },
                  { type: "voice" as const, icon: Mic, label: t("world.filters.chatVoice") },
                  { type: "video" as const, icon: Video, label: t("world.filters.chatVideo") },
                ] as const).map(({ type: ct, icon: Icon, label }) => (
                  <button
                    key={ct}
                    onClick={() => setChatType(ct)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      chatType === ct
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total Cost */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-sm">{t("world.filters.totalCost")}</span>
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="text-white font-black text-xl">{cost}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/30">{t("world.filters.currentBalance")}</span>
                <span className={`font-bold ${canAfford ? "text-emerald-400" : "text-red-400"}`}>
                  {userCoins.toLocaleString()} {t("common.coins")}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Save Settings */}
              {onSave && (
                <button
                  onClick={() => onSave({ genderFilter: gender, ageMin, ageMax, countryFilter: country || undefined, chatType })}
                  className="flex-1 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                >
                  <Save className="w-4 h-4" />
                  {t("world.filters.saveSettings")}
                </button>
              )}

              {/* Start Search */}
              <button
                onClick={() => onStart({ genderFilter: gender, ageMin, ageMax, countryFilter: country || undefined, chatType })}
                disabled={!canAfford || loading}
                className={`${onSave ? 'flex-1' : 'w-full'} py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${
                  canAfford && !loading
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] transform hover:scale-[1.02]"
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plane className="w-5 h-5" />
                    {canAfford ? t("world.filters.startSearch") : t("world.insufficientCoins")}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Country Picker overlay */}
      <AnimatePresence>
        {showCountryPicker && (
          <CountrySelector
            isOpen={showCountryPicker}
            onClose={() => setShowCountryPicker(false)}
            selectedCountry={country}
            onSelect={setCountry}
          />
        )}
      </AnimatePresence>
    </>
  );
}
