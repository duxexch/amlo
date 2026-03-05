import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/lib/countries";

interface CountrySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCountry: string | null;
  onSelect: (code: string | null) => void;
}

export function CountrySelector({ isOpen, onClose, selectedCountry, onSelect }: CountrySelectorProps) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const isAr = i18n.language === "ar";

  const filtered = useMemo(() => {
    if (!search) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(
      c => c.nameAr.includes(q) || c.nameEn.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
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
        className="w-full max-w-md bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[28px] border-t border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] max-h-[70vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h3 className="text-white font-bold text-lg">{t("world.filters.country")}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-white/30 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full bg-white/5 border border-white/10 rounded-xl h-10 ps-10 pe-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* "All countries" option */}
        <div className="px-5 pb-2">
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              !selectedCountry
                ? "bg-primary/20 border border-primary/20 text-primary"
                : "bg-white/5 border border-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            <span className="text-xl">🌍</span>
            <span className="font-bold text-sm flex-1 text-start">{t("world.filters.allCountries")}</span>
            {!selectedCountry && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{t("world.filters.free")}</span>}
          </button>
        </div>

        {/* Country list */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-1">
          {filtered.map(country => (
            <button
              key={country.code}
              onClick={() => { onSelect(country.code); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                selectedCountry === country.code
                  ? "bg-primary/20 border border-primary/20 text-white"
                  : "bg-transparent border border-transparent text-white/60 hover:bg-white/5"
              }`}
            >
              <span className="text-xl">{country.flag}</span>
              <span className="font-medium text-sm flex-1 text-start">
                {isAr ? country.nameAr : country.nameEn}
              </span>
              <span className="text-[10px] text-white/20">{country.code}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
