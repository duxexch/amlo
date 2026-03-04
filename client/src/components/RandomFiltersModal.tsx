/**
 * Random Chat Filters Modal — فلاتر الدردشة العشوائية
 * ════════════════════════════════════════════════════════
 * Shows filter options before starting random matching:
 * - Call type (video/audio)
 * - Gender filter (both/male/female)
 * - Age range slider
 * - Country filter
 * Each filter shows its coin cost from PricingService
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Mic, X, Coins, Users, Globe,
  Loader2, ChevronDown, Search as SearchIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { callsApi } from "@/lib/socialApi";

interface FilterPricing {
  spin_cost: number;
  gender_both: number;
  gender_male: number;
  gender_female: number;
  age_range: number;
  country_specific: number;
  country_all: number;
}

interface RandomFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (filters: MatchFilters) => void;
  initialType?: "video" | "audio";
}

export interface MatchFilters {
  type: "video" | "audio";
  genderFilter: "both" | "male" | "female";
  ageMin: number;
  ageMax: number;
  countryFilter: string;
}

const COUNTRIES = [
  { code: "", labelKey: "matching.allCountries" },
  { code: "SA", label: "🇸🇦 السعودية" },
  { code: "EG", label: "🇪🇬 مصر" },
  { code: "AE", label: "🇦🇪 الإمارات" },
  { code: "IQ", label: "🇮🇶 العراق" },
  { code: "JO", label: "🇯🇴 الأردن" },
  { code: "KW", label: "🇰🇼 الكويت" },
  { code: "MA", label: "🇲🇦 المغرب" },
  { code: "DZ", label: "🇩🇿 الجزائر" },
  { code: "TN", label: "🇹🇳 تونس" },
  { code: "LB", label: "🇱🇧 لبنان" },
  { code: "SY", label: "🇸🇾 سوريا" },
  { code: "BH", label: "🇧🇭 البحرين" },
  { code: "OM", label: "🇴🇲 عمان" },
  { code: "QA", label: "🇶🇦 قطر" },
  { code: "YE", label: "🇾🇪 اليمن" },
  { code: "LY", label: "🇱🇾 ليبيا" },
  { code: "SD", label: "🇸🇩 السودان" },
  { code: "TR", label: "🇹🇷 تركيا" },
  { code: "US", label: "🇺🇸 USA" },
  { code: "GB", label: "🇬🇧 UK" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "FR", label: "🇫🇷 France" },
];

export function RandomFiltersModal({ isOpen, onClose, onStart, initialType = "video" }: RandomFiltersModalProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<"video" | "audio">(initialType);
  const [gender, setGender] = useState<"both" | "male" | "female">("both");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(99);
  const [country, setCountry] = useState("");
  const [pricing, setPricing] = useState<FilterPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Reset type when modal opens with different type
  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setLoading(true);
      callsApi.pricing()
        .then((data: any) => {
          // Build filter pricing from API response
          if (data?.filters) {
            setPricing(data.filters);
          } else {
            setPricing({
              spin_cost: data?.spin_cost || 10,
              gender_both: 0,
              gender_male: data?.gender_male || 5,
              gender_female: data?.gender_female || 5,
              age_range: data?.age_range || 10,
              country_specific: data?.country_specific || 15,
              country_all: 0,
            });
          }
        })
        .catch(() => {
          setPricing({
            spin_cost: 10, gender_both: 0, gender_male: 5,
            gender_female: 5, age_range: 10, country_specific: 15, country_all: 0,
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, initialType]);

  const totalCost = useMemo(() => {
    if (!pricing) return 0;
    let cost = pricing.spin_cost;
    if (gender === "male") cost += pricing.gender_male;
    else if (gender === "female") cost += pricing.gender_female;
    else cost += pricing.gender_both;
    if (ageMin !== 18 || ageMax !== 99) cost += pricing.age_range;
    if (country) cost += pricing.country_specific;
    return cost;
  }, [pricing, gender, ageMin, ageMax, country]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c =>
      c.code.toLowerCase().includes(q) || (c.label || "").toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const handleStart = () => {
    onStart({ type, genderFilter: gender, ageMin, ageMax, countryFilter: country });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md mx-4 bg-[#12122a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto"
          onClick={() => setShowCountryDropdown(false)}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/50" />
          </button>

          {/* Title */}
          <h2 className="text-xl font-black text-white text-center mb-6">
            {t("matching.filtersTitle")}
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Call Type Toggle */}
              <div>
                <label className="text-white/50 text-xs font-bold mb-2 block">
                  {t("matching.callType")}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setType("video")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                      type === "video"
                        ? "bg-primary text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                        : "bg-white/5 text-white/40 hover:text-white/60"
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    {t("matching.video")}
                  </button>
                  <button
                    onClick={() => setType("audio")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                      type === "audio"
                        ? "bg-secondary text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]"
                        : "bg-white/5 text-white/40 hover:text-white/60"
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    {t("matching.audio")}
                  </button>
                </div>
              </div>

              {/* Gender Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/50 text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {t("matching.gender")}
                  </label>
                </div>
                <div className="flex gap-2">
                  {(["both", "male", "female"] as const).map((g) => {
                    const costKey = `gender_${g}` as keyof FilterPricing;
                    const cost = pricing?.[costKey] || 0;
                    return (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold transition-all ${
                          gender === g
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-white/5 text-white/40 hover:text-white/60 border border-transparent"
                        }`}
                      >
                        <span>{t(`matching.gender${g.charAt(0).toUpperCase() + g.slice(1)}`)}</span>
                        {cost > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-400 text-[10px]">
                            <Coins className="w-2.5 h-2.5" /> +{cost}
                          </span>
                        )}
                        {cost === 0 && (
                          <span className="text-emerald-400 text-[10px]">{t("matching.free")}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Age Range */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/50 text-xs font-bold">
                    {t("matching.ageRange")}
                  </label>
                  {(ageMin !== 18 || ageMax !== 99) && pricing && (
                    <span className="flex items-center gap-0.5 text-amber-400 text-[10px] font-bold">
                      <Coins className="w-2.5 h-2.5" /> +{pricing.age_range}
                    </span>
                  )}
                </div>
                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-white font-bold text-lg">
                    <span>{ageMin}</span>
                    <span className="text-white/20">—</span>
                    <span>{ageMax}</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={18}
                      max={99}
                      value={ageMin}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAgeMin(Math.min(val, ageMax - 1));
                      }}
                      className="w-full accent-primary h-1.5"
                    />
                    <input
                      type="range"
                      min={18}
                      max={99}
                      value={ageMax}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAgeMax(Math.max(val, ageMin + 1));
                      }}
                      className="w-full accent-secondary h-1.5"
                    />
                  </div>
                  {(ageMin !== 18 || ageMax !== 99) && (
                    <button
                      onClick={() => { setAgeMin(18); setAgeMax(99); }}
                      className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                    >
                      {t("matching.resetFilters")}
                    </button>
                  )}
                </div>
              </div>

              {/* Country Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/50 text-xs font-bold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    {t("matching.country")}
                  </label>
                  {country && pricing && (
                    <span className="flex items-center gap-0.5 text-amber-400 text-[10px] font-bold">
                      <Coins className="w-2.5 h-2.5" /> +{pricing.country_specific}
                    </span>
                  )}
                </div>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white hover:bg-white/8 transition-colors"
                  >
                    <span>
                      {country
                        ? COUNTRIES.find(c => c.code === country)?.label || country
                        : t("matching.allCountries")
                      }
                    </span>
                    <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${showCountryDropdown ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {showCountryDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full mt-1 w-full bg-[#1a1a3a] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl max-h-52 flex flex-col"
                      >
                        <div className="p-2 border-b border-white/5">
                          <div className="relative">
                            <SearchIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                            <input
                              className="w-full bg-white/5 rounded-lg py-1.5 pr-8 pl-3 text-xs text-white placeholder:text-white/20 focus:outline-none"
                              placeholder={t("matching.searchCountry")}
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-40">
                          {filteredCountries.map((c) => (
                            <button
                              key={c.code}
                              onClick={() => {
                                setCountry(c.code);
                                setShowCountryDropdown(false);
                                setCountrySearch("");
                              }}
                              className={`w-full px-4 py-2 text-sm text-right hover:bg-white/5 transition-colors ${
                                country === c.code ? "bg-primary/10 text-primary" : "text-white/70"
                              }`}
                            >
                              {c.label || t(c.labelKey!)}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Total Cost */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <span className="text-white/60 text-sm font-bold">{t("matching.totalCost")}</span>
                <div className="flex items-center gap-2">
                  {totalCost === 0 ? (
                    <span className="text-emerald-400 font-black text-lg">{t("matching.free")}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-400 font-black text-lg">
                      <Coins className="w-5 h-5" />
                      {totalCost}
                      <span className="text-xs text-amber-400/50 font-medium">{t("matching.coins")}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Start Button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
                  type === "video"
                    ? "bg-primary hover:bg-primary/90 text-white shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                    : "bg-secondary hover:bg-secondary/90 text-white shadow-[0_0_25px_rgba(236,72,153,0.4)]"
                }`}
              >
                {t("matching.startSearch")}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
