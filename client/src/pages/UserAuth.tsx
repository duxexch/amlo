import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Lock, ArrowRight, AlertCircle, Gift, Phone, Eye, EyeOff, Check, ChevronLeft, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authApi, loginOtpApi } from "../lib/authApi";

// Social providers with brand colors
const socialProviders = [
  { key: "google", name: "Google", color: "#EA4335", icon: "G" },
  { key: "facebook", name: "Facebook", color: "#1877F2", icon: "f" },
  { key: "apple", name: "Apple", color: "#FFFFFF", icon: "" },
  { key: "twitter", name: "X", color: "#000000", icon: "𝕏" },
  { key: "tiktok", name: "TikTok", color: "#00F2EA", icon: "♪" },
  { key: "snapchat", name: "Snapchat", color: "#FFFC00", icon: "👻" },
  { key: "instagram", name: "Instagram", color: "#E4405F", icon: "📷" },
  { key: "github", name: "GitHub", color: "#FFFFFF", icon: "⚡" },
];

export function UserAuth() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const refCode = params.get("ref") || "";
  const [isLogin, setIsLogin] = useState(!refCode);
  const [showForgot, setShowForgot] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [showOtp, setShowOtp] = useState(false);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<"register" | "login">("register");
  const [showLoginChoice, setShowLoginChoice] = useState(false);
  const [loginOtpEmail, setLoginOtpEmail] = useState("");
  const [showLoginOtp, setShowLoginOtp] = useState(false);
  const [loginOtpValues, setLoginOtpValues] = useState(["", "", "", "", "", ""]);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (authMethod === "phone") {
      // Phone OTP not yet implemented
      setAuthError(t("auth.phoneComingSoon", "تسجيل الدخول عبر الهاتف قريباً"));
      return;
    }

    setAuthLoading(true);
    try {
      if (isLogin) {
        // Login
        const result = await authApi.login({ login: email, password });
        if (result.data.needsPinVerify) {
          // User has profiles — show choice: PIN or OTP
          setShowLoginChoice(true);
        } else {
          setLocation("/");
        }
      } else {
        // Register — send OTP first
        if (!username.trim()) {
          setAuthError(t("auth.usernameRequired", "يرجى إدخال اسم المستخدم"));
          return;
        }
        if (!email.trim()) {
          setAuthError(t("auth.emailRequired", "يرجى إدخال البريد الإلكتروني"));
          return;
        }
        // Send OTP to email for verification
        const otpResult = await authApi.sendRegisterOtp(email.trim());
        if (otpResult.success) {
          setOtpEmail(email.trim());
          setOtpPurpose("register");
          setShowOtp(true);
          setOtpTimer(60);
          setOtpValues(["", "", "", "", "", ""]);
          setAuthSuccess(otpResult.message);
        } else {
          setAuthError(otpResult.message);
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || t("auth.error", "حدث خطأ، حاول مرة أخرى"));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    try {
      const result = await authApi.forgotPassword(forgotEmail.trim());
      setAuthSuccess(result.message);
    } catch (err: any) {
      setAuthError(err?.message || t("auth.error", "حدث خطأ، حاول مرة أخرى"));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    // Social login — redirect to OAuth provider
    // TODO: Implement OAuth flows for each provider in production
    setAuthError(t("auth.socialComingSoon", `تسجيل الدخول عبر ${provider} قريباً`));
  };

  const handleOtpSubmit = async () => {
    const code = otpValues.join("");
    if (code.length !== 6) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      // Verify OTP
      const verifyResult = await authApi.verifyOtp(otpEmail, code);
      if (!verifyResult.success) {
        setAuthError(verifyResult.message);
        return;
      }

      if (otpPurpose === "register") {
        // OTP verified — now register
        const result = await authApi.register({
          username: username.trim(),
          email: email.trim(),
          password,
          displayName: username.trim(),
          referralCode: refCode || undefined,
        });
        // Go directly to Home — no forced PIN setup
        setLocation("/");
      } else {
        // Login OTP verified
        setLocation("/");
      }
    } catch (err: any) {
      setAuthError(err?.message || t("auth.error", "حدث خطأ، حاول مرة أخرى"));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpValues];
    newOtp[index] = value;
    setOtpValues(newOtp);
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full" />
      
      <motion.div 
        layout
        className="w-full max-w-md glass p-8 rounded-[2.5rem] border-white/10 relative z-10"
      >
        {/* Close Button */}
        <button
          onClick={() => setLocation('/')}
          className="absolute top-5 end-5 w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all z-20 group"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
        </button>

        <AnimatePresence mode="wait">
          {/* Login OTP Verify Screen */}
          {showLoginOtp ? (
            <motion.div
              key="login-otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{t("auth.otpTitle", "رمز التحقق")}</h2>
              <p className="text-white/60 text-sm mb-4">{t("auth.loginOtpSubtitle", "تم إرسال رمز التحقق إلى بريدك")}</p>
              <p className="text-white/40 text-xs mb-6 font-mono" dir="ltr">{loginOtpEmail}</p>

              {authError && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">{authError}</p>
                </motion.div>
              )}

              <div className="flex justify-center gap-3 mb-6" dir="ltr">
                {loginOtpValues.map((val, i) => (
                  <input
                    key={i}
                    id={`login-otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.length > 1 || (v && !/^\d$/.test(v))) return;
                      const arr = [...loginOtpValues]; arr[i] = v; setLoginOtpValues(arr);
                      if (v && i < 5) document.getElementById(`login-otp-${i + 1}`)?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !loginOtpValues[i] && i > 0) document.getElementById(`login-otp-${i - 1}`)?.focus();
                    }}
                    className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-white text-xl font-bold focus:outline-none focus:border-primary transition-all"
                  />
                ))}
              </div>

              <button
                onClick={async () => {
                  const code = loginOtpValues.join("");
                  if (code.length !== 6) return;
                  setAuthLoading(true); setAuthError(null);
                  try {
                    await loginOtpApi.verifyOtp(code);
                    setLocation("/");
                  } catch (err: any) {
                    setAuthError(err?.message || "رمز غير صحيح");
                  } finally { setAuthLoading(false); }
                }}
                disabled={loginOtpValues.some(v => !v) || authLoading}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mb-4 flex items-center justify-center gap-2"
              >
                {authLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                {t("auth.verifyOtp", "تحقق")}
              </button>

              <button onClick={() => { setShowLoginOtp(false); setShowLoginChoice(true); setLoginOtpValues(["", "", "", "", "", ""]); setAuthError(null); }} className="w-full text-white/40 text-sm hover:text-white transition-colors flex items-center justify-center gap-1">
                <ChevronLeft className="w-4 h-4" />
                {t("common.back", "رجوع")}
              </button>
            </motion.div>

          ) : showLoginChoice ? (
            /* Login Method Choice: PIN or OTP */
            <motion.div
              key="login-choice"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{t("auth.chooseLoginMethod", "اختر طريقة الدخول")}</h2>
              <p className="text-white/60 text-sm mb-8">{t("auth.chooseLoginMethodDesc", "يمكنك الدخول عبر رمز PIN أو رمز تحقق بالبريد")}</p>

              {authError && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">{authError}</p>
                </motion.div>
              )}

              <div className="space-y-3">
                {/* PIN Option */}
                <button
                  onClick={() => { setShowLoginChoice(false); setLocation("/pin"); }}
                  className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 text-end">
                    <p className="text-white font-bold text-sm">{t("auth.loginWithPin", "الدخول برمز PIN")}</p>
                    <p className="text-white/40 text-xs">{t("auth.loginWithPinDesc", "أدخل رمز PIN الخاص بملفك الشخصي")}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/50 transition-colors" />
                </button>

                {/* OTP Option */}
                <button
                  onClick={async () => {
                    setAuthLoading(true); setAuthError(null);
                    try {
                      const result = await loginOtpApi.sendOtp();
                      setLoginOtpEmail(result.email || "");
                      setShowLoginChoice(false);
                      setShowLoginOtp(true);
                      setLoginOtpValues(["", "", "", "", "", ""]);
                      setOtpTimer(60);
                    } catch (err: any) {
                      setAuthError(err?.message || "حدث خطأ");
                    } finally { setAuthLoading(false); }
                  }}
                  disabled={authLoading}
                  className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 text-end">
                    <p className="text-white font-bold text-sm">{t("auth.loginWithOtp", "الدخول برمز تحقق")}</p>
                    <p className="text-white/40 text-xs">{t("auth.loginWithOtpDesc", "إرسال رمز تحقق إلى بريدك الإلكتروني")}</p>
                  </div>
                  {authLoading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/50 transition-colors" />}
                </button>
              </div>

              <button onClick={() => { setShowLoginChoice(false); setAuthError(null); }} className="w-full text-white/40 text-sm hover:text-white transition-colors mt-6 flex items-center justify-center gap-1">
                <ChevronLeft className="w-4 h-4" />
                {t("common.back", "رجوع")}
              </button>
            </motion.div>

          ) : showOtp ? (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{t("auth.otpTitle")}</h2>
              <p className="text-white/60 text-sm mb-4">{t("auth.otpSubtitle")}</p>
              <p className="text-white/40 text-xs mb-6 font-mono" dir="ltr">{otpEmail}</p>

              {authError && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">{authError}</p>
                </motion.div>
              )}

              <div className="flex justify-center gap-3 mb-6" dir="ltr">
                {otpValues.map((val, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-white text-xl font-bold focus:outline-none focus:border-primary transition-all"
                  />
                ))}
              </div>

              <button
                onClick={handleOtpSubmit}
                disabled={otpValues.some(v => !v) || authLoading}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mb-4 flex items-center justify-center gap-2"
              >
                {authLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                {t("auth.verifyOtp")}
              </button>

              <div className="flex items-center justify-center gap-2 text-sm">
                {otpTimer > 0 ? (
                  <span className="text-white/40">{t("auth.resendIn")} <span className="text-primary font-bold">{otpTimer}s</span></span>
                ) : (
                  <button className="text-primary font-bold hover:underline" onClick={async () => {
                    try {
                      const result = otpPurpose === "register"
                        ? await authApi.sendRegisterOtp(otpEmail)
                        : await authApi.sendOtp(otpEmail);
                      if (result.success) {
                        setOtpTimer(60);
                        setOtpValues(["", "", "", "", "", ""]);
                      }
                    } catch (err: any) {
                      setAuthError(err?.message || "فشل إعادة الإرسال");
                    }
                  }}>{t("auth.resendOtp")}</button>
                )}
              </div>

              <button
                onClick={() => { setShowOtp(false); setOtpValues(["", "", "", "", "", ""]); setAuthError(null); setAuthSuccess(null); }}
                className="w-full text-white/40 text-sm hover:text-white transition-colors mt-4 flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                {t("common.back")}
              </button>
            </motion.div>

          ) : showForgot ? (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-black text-white mb-2 text-center">{t("auth.forgotTitle")}</h2>
              <p className="text-white/60 text-center mb-8">{t("auth.forgotSubtitle")}</p>
              {authSuccess && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 mb-4">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400 font-medium">{authSuccess}</p>
                </motion.div>
              )}
              {authError && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">{authError}</p>
                </motion.div>
              )}
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/80 me-2">{t("auth.email")}</label>
                  <div className="relative group">
                    <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 ps-12 pe-4 text-white focus:outline-none focus:border-primary transition-all" placeholder="name@example.com" />
                  </div>
                </div>
                <button type="submit" disabled={authLoading} className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {authLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {t("auth.sendLink")}
                </button>
                <button type="button" onClick={() => { setShowForgot(false); setAuthError(null); setAuthSuccess(null); }} className="w-full text-white/40 text-sm hover:text-white transition-colors">{t("auth.backToLogin")}</button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-2xl neon-border text-white mb-4">A</div>
                <h2 className="text-2xl font-black text-white">{isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}</h2>
              </div>

              {/* Auth Method Tabs */}
              <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/10">
                <button
                  onClick={() => setAuthMethod("email")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${authMethod === "email" ? "bg-primary text-white shadow-md" : "text-white/50 hover:text-white"}`}
                >
                  <Mail className="w-4 h-4" />
                  {t("auth.email")}
                </button>
                <button
                  onClick={() => setAuthMethod("phone")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${authMethod === "phone" ? "bg-primary text-white shadow-md" : "text-white/50 hover:text-white"}`}
                >
                  <Phone className="w-4 h-4" />
                  {t("auth.phone")}
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {/* Referral Badge */}
                {!isLogin && refCode && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5"
                  >
                    <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-400 font-medium">
                      {t("auth.referralInvite")} <span className="font-mono font-bold">{refCode}</span>
                    </p>
                  </motion.div>
                )}

                {!isLogin && (
                  <div className="relative group">
                    <User className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input type="text" required value={username} onChange={e => setUsername(e.target.value)} aria-label={t("auth.username")} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 ps-12 pe-4 text-white focus:outline-none focus:border-primary transition-all" placeholder={t("auth.username")} />
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {authMethod === "email" ? (
                    <motion.div key="email-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <div className="relative group">
                        <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} aria-label={t("auth.email")} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 ps-12 pe-4 text-white focus:outline-none focus:border-primary transition-all" placeholder={t("auth.email")} />
                      </div>
                      <div className="relative group">
                        <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                        <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} aria-label={t("auth.password")} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 ps-12 pe-12 text-white focus:outline-none focus:border-primary transition-all" placeholder={t("auth.password")} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-4 top-1/2 -translate-y-1/2">
                          {showPassword ? <EyeOff className="w-5 h-5 text-white/30" /> : <Eye className="w-5 h-5 text-white/30" />}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="phone-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <div className="relative group">
                        <Phone className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                        <input type="tel" required aria-label={t("auth.phone")} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 ps-12 pe-4 text-white focus:outline-none focus:border-primary transition-all" placeholder={t("auth.phonePlaceholder")} dir="ltr" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Remember Me + Forgot */}
                {isLogin && authMethod === "email" && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${rememberMe ? "bg-primary border-primary" : "bg-white/5 border-white/10"}`}
                      >
                        {rememberMe && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className="text-white/60 text-xs">{t("auth.rememberMe")}</span>
                    </label>
                    <button type="button" onClick={() => setShowForgot(true)} className="text-primary text-xs font-bold hover:underline">{t("auth.forgotPassword")}</button>
                  </div>
                )}

                {/* Terms checkbox (register only) */}
                {!isLogin && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setAgreeTerms(!agreeTerms)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all mt-0.5 shrink-0 ${agreeTerms ? "bg-primary border-primary" : "bg-white/5 border-white/10"}`}
                    >
                      {agreeTerms && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <span className="text-white/60 text-xs leading-relaxed">
                      {t("auth.agreeText")}{" "}
                      <Link href="/terms" className="text-primary hover:underline">{t("auth.termsLink")}</Link>
                      {" "}{t("auth.and")}{" "}
                      <Link href="/privacy" className="text-primary hover:underline">{t("auth.privacyLink")}</Link>
                    </span>
                  </label>
                )}

                {authError && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-medium">{authError}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={authLoading || (!isLogin && !agreeTerms)}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  {authLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {authMethod === "phone"
                    ? t("auth.sendOtp")
                    : isLogin ? t("auth.loginBtn") : t("auth.registerBtn")}
                </button>
              </form>

              {/* Social Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-white/40">{t("auth.socialDivider")}</span></div>
              </div>

              {/* Social Login Grid — 8 providers */}
              <div className="grid grid-cols-4 gap-3">
                {socialProviders.map((provider) => (
                  <button
                    key={provider.key}
                    onClick={() => handleSocialLogin(provider.name)}
                    className="flex items-center justify-center py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group relative"
                    title={provider.name}
                  >
                    <span
                      className="text-base font-bold transition-transform group-hover:scale-110"
                      style={{ color: provider.color }}
                    >
                      {provider.icon}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-center text-white/60 text-sm">
                {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
                <button onClick={() => { setIsLogin(!isLogin); setAgreeTerms(false); }} className="text-primary font-bold me-2 hover:underline">
                  {isLogin ? t("auth.registerNow") : t("auth.loginNow")}
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-white/5 text-[10px] text-white/20 text-center space-x-reverse space-x-4">
          <Link href="/terms" className="hover:text-white transition-colors">{t("auth.termsLink")}</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">{t("auth.privacyLink")}</Link>
        </div>
      </motion.div>
    </div>
  );
}