import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Radio, Film, MessageCircle, Wallet, Eye, EyeOff,
    Lock, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { adminSections } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";

interface SectionDef {
    key: string;
    icon: React.ElementType;
    labelKey: string;
    descKey: string;
    color: string;
    bg: string;
}

const SECTIONS: SectionDef[] = [
    { key: "live", icon: Radio, labelKey: "admin.sectionsVisibility.live", descKey: "admin.sectionsVisibility.liveDesc", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
    { key: "cex", icon: Film, labelKey: "admin.sectionsVisibility.cex", descKey: "admin.sectionsVisibility.cexDesc", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
    { key: "friends", icon: MessageCircle, labelKey: "admin.sectionsVisibility.friends", descKey: "admin.sectionsVisibility.friendsDesc", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
    { key: "wallet", icon: Wallet, labelKey: "admin.sectionsVisibility.wallet", descKey: "admin.sectionsVisibility.walletDesc", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
];

export function SectionsVisibilityPage() {
    const { t } = useTranslation();
    const [sections, setSections] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        adminSections.get()
            .then((res) => { if (res.success && res.data) setSections(res.data); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleToggle = async (key: string, currentVisible: boolean) => {
        if (!password.trim()) {
            setError(t("admin.sectionsVisibility.passwordRequired"));
            return;
        }
        setError("");
        setSuccess("");
        setToggling(key);

        try {
            const res = await adminSections.toggle(key, !currentVisible, password);
            if (res.success) {
                setSections((prev) => ({ ...prev, [key]: !currentVisible }));
                setSuccess(t("admin.sectionsVisibility.updated"));
                setTimeout(() => setSuccess(""), 3000);
            } else {
                setError(res.message || t("admin.sectionsVisibility.error"));
            }
        } catch (err: any) {
            setError(err.message || t("admin.sectionsVisibility.error"));
        } finally {
            setToggling(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/5 rounded-2xl h-24" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white" style={{ fontFamily: "Outfit" }}>
                    {t("admin.sectionsVisibility.title")}
                </h1>
                <p className="text-white/40 text-sm mt-1">{t("admin.sectionsVisibility.subtitle")}</p>
            </div>

            {/* Password Input */}
            <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5">
                <label className="text-sm font-bold text-white/60 mb-2 block">{t("admin.sectionsVisibility.passwordLabel")}</label>
                <div className="relative max-w-md">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-12 pl-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/20"
                        placeholder="••••••••"
                    />
                </div>
                <p className="text-[11px] text-white/20 mt-2">{t("admin.sectionsVisibility.passwordHint")}</p>
            </div>

            {/* Messages */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium"
                >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </motion.div>
            )}
            {success && (
                <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm font-medium"
                >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {success}
                </motion.div>
            )}

            {/* Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SECTIONS.map((section, i) => {
                    const visible = sections[section.key] !== false;
                    const isToggling = toggling === section.key;

                    return (
                        <motion.div
                            key={section.key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`bg-[#0c0c1d] border rounded-2xl p-5 transition-all ${visible ? "border-white/5 hover:border-white/10" : "border-red-500/20 bg-red-500/[0.02]"
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${section.bg}`}>
                                        <section.icon className={`w-6 h-6 ${section.color}`} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">{t(section.labelKey)}</h3>
                                        <p className="text-xs text-white/30 mt-0.5">{t(section.descKey)}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleToggle(section.key, visible)}
                                    disabled={isToggling}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${visible
                                            ? "bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20"
                                            : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                                        } disabled:opacity-50`}
                                >
                                    {isToggling ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : visible ? (
                                        <Eye className="w-4 h-4" />
                                    ) : (
                                        <EyeOff className="w-4 h-4" />
                                    )}
                                    {visible ? t("admin.sectionsVisibility.visible") : t("admin.sectionsVisibility.hidden")}
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Info Note */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <p className="text-[11px] text-white/20 text-center leading-relaxed">
                    <span className="text-primary/40 font-bold">{t("admin.sectionsVisibility.noteTitle")}</span>{" "}
                    {t("admin.sectionsVisibility.noteText")}
                </p>
            </div>
        </div>
    );
}
