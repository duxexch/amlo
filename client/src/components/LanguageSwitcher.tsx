import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Check, Search, X } from "lucide-react";
import { LANGUAGES, type LangOption } from "@/i18n";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = LANGUAGES.filter(
    (l) =>
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      l.nativeLabel.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  function selectLang(lang: LangOption) {
    i18n.changeLanguage(lang.code);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-xl transition-all duration-300 hover:bg-white/5 text-muted-foreground hover:text-white",
          compact ? "p-2" : "px-4 py-3 w-full"
        )}
        title={t("lang.title")}
      >
        <Globe className="w-5 h-5 shrink-0" />
        {!compact && (
          <>
            <span className="font-bold text-lg flex-1 text-start">{currentLang.nativeLabel}</span>
            <span className="text-xs opacity-60">{currentLang.flag}</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-[100] w-72 max-h-96 rounded-xl glass-panel border border-white/10 shadow-2xl overflow-hidden",
              compact ? "bottom-full mb-2 start-0" : "bottom-full mb-2 start-0"
            )}
          >
            {/* Search */}
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("lang.search")}
                  className="w-full bg-white/5 border border-white/10 rounded-lg ps-9 pe-8 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Language list */}
            <div className="overflow-y-auto max-h-72 p-1.5">
              {filtered.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-6">{t("common.noResults")}</div>
              ) : (
                filtered.map((lang) => {
                  const isActive = lang.code === i18n.language;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => selectLang(lang)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "hover:bg-white/5 text-muted-foreground hover:text-white"
                      )}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <div className="flex-1 text-start">
                        <div className="font-bold text-sm">{lang.nativeLabel}</div>
                        <div className="text-xs opacity-60">{lang.label}</div>
                      </div>
                      {lang.dir === "rtl" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground">
                          RTL
                        </span>
                      )}
                      {isActive && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
