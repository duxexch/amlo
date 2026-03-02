import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, FileText, Globe, Check, Loader2, AlertCircle, ArrowRight, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { profileApi } from "../lib/authApi";

export function PinSetup() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1); // 1 = profile 1 setup, 2 = profile 2 setup, 3 = done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile 1 state
  const [pin1, setPin1] = useState("");
  const [name1, setName1] = useState("");
  const [bio1, setBio1] = useState("");
  const [gender1, setGender1] = useState("");

  // Profile 2 state
  const [pin2, setPin2] = useState("");
  const [name2, setName2] = useState("");
  const [bio2, setBio2] = useState("");
  const [gender2, setGender2] = useState("");

  const handleSetupProfile = async (profileIndex: number) => {
    const isFirst = profileIndex === 1;
    const pin = isFirst ? pin1 : pin2;
    const displayName = isFirst ? name1 : name2;
    const bio = isFirst ? bio1 : bio2;
    const gender = isFirst ? gender1 : gender2;

    if (!pin || pin.length < 4) {
      setError(t("pinSetup.pinRequired", "يرجى إدخال رمز PIN من 4-6 أرقام"));
      return;
    }
    if (!displayName.trim()) {
      setError(t("pinSetup.nameRequired", "يرجى إدخال اسم العرض"));
      return;
    }
    // Ensure PIN 2 is different from PIN 1
    if (profileIndex === 2 && pin2 === pin1) {
      setError(t("pinSetup.differentPin", "يجب أن يكون رمز PIN مختلف عن الأول"));
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

      if (profileIndex === 1) {
        setStep(2);
      } else {
        setStep(3);
        // Auto-redirect after success animation
        setTimeout(() => setLocation("/"), 2000);
      }
    } catch (err: any) {
      setError(err?.message || t("pinSetup.error", "حدث خطأ"));
    } finally {
      setLoading(false);
    }
  };

  const skipSecondProfile = () => {
    setLocation("/");
  };

  const genders = [
    { value: "male", label: t("pinSetup.male", "ذكر") },
    { value: "female", label: t("pinSetup.female", "أنثى") },
    { value: "other", label: t("pinSetup.other", "آخر") },
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full" />

      <motion.div
        layout
        className="w-full max-w-md glass p-8 rounded-[2.5rem] border-white/10 relative z-10"
      >
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                step > s
                  ? "bg-emerald-500 text-white"
                  : step === s
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {step > s ? <Check className="w-5 h-5" /> : s}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 3: Success */}
          {step === 3 ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{t("pinSetup.success", "تم الإعداد بنجاح!")}</h2>
              <p className="text-white/60 text-sm">{t("pinSetup.successDesc", "ملفاتك الشخصية جاهزة. يمكنك التبديل بينها باستخدام رمز PIN")}</p>
            </motion.div>
          ) : (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: step === 1 ? 0 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">
                  {step === 1
                    ? t("pinSetup.title1", "إعداد الملف الشخصي الأول")
                    : t("pinSetup.title2", "إعداد الملف الشخصي الثاني")}
                </h2>
                <p className="text-white/60 text-sm">
                  {step === 1
                    ? t("pinSetup.desc1", "أنشئ رمز PIN وملفك الشخصي الأول")
                    : t("pinSetup.desc2", "أنشئ رمز PIN مختلف وملف شخصي ثاني")}
                </p>
              </div>

              {/* Profile Number Badge */}
              <div className="flex justify-center mb-6">
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                  step === 1 ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                }`}>
                  {t("pinSetup.profileNum", "ملف شخصي")} #{step}
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
                {/* PIN */}
                <div>
                  <label className="text-sm font-bold text-white/80 mb-2 block">
                    {t("pinSetup.pinLabel", "رمز PIN")} ({t("pinSetup.digits", "4-6 أرقام")})
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={step === 1 ? pin1 : pin2}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        step === 1 ? setPin1(val) : setPin2(val);
                        setError(null);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all"
                      placeholder="• • • •"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="text-sm font-bold text-white/80 mb-2 block">{t("pinSetup.displayName", "اسم العرض")}</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      maxLength={100}
                      value={step === 1 ? name1 : name2}
                      onChange={e => step === 1 ? setName1(e.target.value) : setName2(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all"
                      placeholder={step === 1
                        ? t("pinSetup.namePlaceholder1", "اسمك في الملف الأول")
                        : t("pinSetup.namePlaceholder2", "اسمك في الملف الثاني")}
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
                      value={step === 1 ? bio1 : bio2}
                      onChange={e => step === 1 ? setBio1(e.target.value) : setBio2(e.target.value)}
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
                        onClick={() => step === 1 ? setGender1(g.value) : setGender2(g.value)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                          (step === 1 ? gender1 : gender2) === g.value
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
                  onClick={() => handleSetupProfile(step)}
                  disabled={loading}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {step === 1
                    ? t("pinSetup.next", "التالي — الملف الثاني")
                    : t("pinSetup.finish", "إنهاء الإعداد")}
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>

                {step === 2 && (
                  <button
                    onClick={skipSecondProfile}
                    className="w-full text-white/40 text-sm hover:text-white transition-colors py-2"
                  >
                    {t("pinSetup.skipSecond", "تخطي — استخدم ملف شخصي واحد فقط")}
                  </button>
                )}

                {step === 1 && (
                  <button
                    onClick={() => setLocation("/auth")}
                    className="w-full text-white/40 text-sm hover:text-white transition-colors flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t("common.back", "رجوع")}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
