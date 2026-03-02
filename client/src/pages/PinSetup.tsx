import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, FileText, Check, Loader2, AlertCircle, ArrowRight, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { profileApi } from "../lib/authApi";

interface PinSetupProps {
  /** Which profile index to create (1 or 2) */
  profileIndex?: number;
  /** Called on success instead of redirect */
  onSuccess?: () => void;
  /** Called on back/cancel */
  onBack?: () => void;
  /** Is this the second profile? */
  isSecondProfile?: boolean;
}

export function PinSetup({ profileIndex = 1, onSuccess, onBack, isSecondProfile = false }: PinSetupProps) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");

  const handleSetup = async () => {
    // Validate PIN is exactly 4 digits
    if (!/^\d{4}$/.test(pin)) {
      setError(t("pinSetup.pinExact4", "رمز PIN يجب أن يكون 4 أرقام بالضبط"));
      return;
    }
    if (pin !== pinConfirm) {
      setError(t("pinSetup.pinMismatch", "رمز PIN غير متطابق"));
      return;
    }
    if (!displayName.trim()) {
      setError(t("pinSetup.nameRequired", "يرجى إدخال اسم العرض"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await profileApi.setupPin({
        pin,
        profileIndex,
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        gender: gender || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          setLocation("/");
        }
      }, 1500);
    } catch (err: any) {
      setError(err?.message || t("pinSetup.error", "حدث خطأ"));
    } finally {
      setLoading(false);
    }
  };

  const genders = [
    { value: "male", label: t("pinSetup.male", "ذكر") },
    { value: "female", label: t("pinSetup.female", "أنثى") },
    { value: "other", label: t("pinSetup.other", "آخر") },
  ];

  const goBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation("/profile");
    }
  };

  const isStandalone = !onSuccess && !onBack;

  const content = (
    <AnimatePresence mode="wait">
      {success ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">
            {isSecondProfile
              ? t("pinSetup.successSecond", "تم إنشاء الحساب الثاني!")
              : t("pinSetup.success", "تم إعداد رمز PIN بنجاح!")}
          </h2>
          <p className="text-white/60 text-sm">
            {isSecondProfile
              ? t("pinSetup.successSecondDesc", "يمكنك التبديل بين الحسابين بكتابة رمز PIN في مربع البحث")
              : t("pinSetup.successDesc", "يمكنك الآن استخدام رمز PIN للدخول إلى ملفك الشخصي")}
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              {isSecondProfile
                ? t("pinSetup.title2", "إنشاء حساب ثاني")
                : t("pinSetup.title1", "إعداد رمز PIN")}
            </h2>
            <p className="text-white/60 text-sm">
              {isSecondProfile
                ? t("pinSetup.desc2", "أنشئ رمز PIN مختلف وملف شخصي ثاني")
                : t("pinSetup.desc1", "أنشئ رمز PIN من 4 أرقام لحماية ملفك الشخصي")}
            </p>
          </div>

          {/* Profile Badge */}
          <div className="flex justify-center mb-6">
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
              isSecondProfile ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
            }`}>
              {t("pinSetup.profileNum", "ملف شخصي")} #{profileIndex}
            </span>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4"
            >
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive font-medium">{error}</p>
            </motion.div>
          )}

          <div className="space-y-4">
            {/* PIN Input */}
            <div>
              <label className="text-sm font-bold text-white/80 mb-2 block">
                {t("pinSetup.pinLabel", "رمز PIN")} (4 {t("pinSetup.digitsExact", "أرقام بالضبط")})
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPin(val);
                    setError(null);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all text-center tracking-[0.5em] text-xl font-bold"
                  placeholder="• • • •"
                  dir="ltr"
                />
              </div>
              {pin.length > 0 && pin.length < 4 && (
                <p className="text-xs text-amber-400/80 mt-1">{4 - pin.length} {t("pinSetup.digitsRemaining", "أرقام متبقية")}</p>
              )}
              {pin.length === 4 && (
                <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1"><Check className="w-3 h-3" />{t("pinSetup.pinComplete", "رمز PIN مكتمل")}</p>
              )}
            </div>

            {/* PIN Confirm */}
            <div>
              <label className="text-sm font-bold text-white/80 mb-2 block">{t("pinSetup.pinConfirm", "تأكيد رمز PIN")}</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinConfirm}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPinConfirm(val);
                    setError(null);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all text-center tracking-[0.5em] text-xl font-bold"
                  placeholder="• • • •"
                  dir="ltr"
                />
              </div>
              {pinConfirm.length === 4 && pin === pinConfirm && (
                <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1"><Check className="w-3 h-3" />{t("pinSetup.pinMatch", "متطابق ✓")}</p>
              )}
              {pinConfirm.length === 4 && pin !== pinConfirm && (
                <p className="text-xs text-destructive/80 mt-1">{t("pinSetup.pinMismatch", "رمز PIN غير متطابق")}</p>
              )}
            </div>

            {/* Display Name */}
            <div>
              <label className="text-sm font-bold text-white/80 mb-2 block">{t("pinSetup.displayName", "اسم العرض")}</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all"
                  placeholder={isSecondProfile
                    ? t("pinSetup.namePlaceholder2", "اسمك في الملف الثاني")
                    : t("pinSetup.namePlaceholder1", "اسمك في هذا الملف")}
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="text-sm font-bold text-white/80 mb-2 block">{t("pinSetup.bio", "نبذة")} ({t("common.optional", "اختياري")})</label>
              <div className="relative group">
                <FileText className="absolute left-4 top-3 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                <textarea
                  maxLength={500}
                  rows={3}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all resize-none"
                  placeholder={t("pinSetup.bioPlaceholder", "اكتب نبذة عنك...")}
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="text-sm font-bold text-white/80 mb-2 block">{t("pinSetup.gender", "الجنس")} ({t("common.optional", "اختياري")})</label>
              <div className="flex gap-2">
                {genders.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGender(g.value)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                      gender === g.value
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleSetup}
              disabled={loading || pin.length !== 4 || pinConfirm.length !== 4 || pin !== pinConfirm || !displayName.trim()}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {isSecondProfile
                ? t("pinSetup.createSecondProfile", "إنشاء الحساب الثاني")
                : t("pinSetup.createPin", "إنشاء رمز PIN")}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>

            <button
              onClick={goBack}
              className="w-full text-white/40 text-sm hover:text-white transition-colors flex items-center justify-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("common.back", "رجوع")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full" />
        <motion.div layout className="w-full max-w-md glass p-8 rounded-[2.5rem] border-white/10 relative z-10">
          {content}
        </motion.div>
      </div>
    );
  }

  return content;
}
