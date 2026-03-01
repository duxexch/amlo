import { motion } from "framer-motion";
import { Plane } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MilesCounterProps {
  miles: number;
}

export function MilesCounter({ miles }: MilesCounterProps) {
  const { t } = useTranslation();

  return (
    <div className="glass rounded-full px-5 py-2.5 flex items-center gap-2.5 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
      <Plane className="w-5 h-5 text-emerald-400" />
      <motion.span
        key={miles}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-white font-bold text-lg"
      >
        {miles.toLocaleString("ar-EG")}
      </motion.span>
      <span className="text-emerald-400/60 text-sm">{t("world.miles")}</span>
    </div>
  );
}
