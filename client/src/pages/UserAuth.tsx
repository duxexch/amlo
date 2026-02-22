import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Lock, ArrowRight, Github, Chrome, Facebook, AlertCircle } from "lucide-react";

export function UserAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [, setLocation] = useLocation();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full" />
      
      <motion.div 
        layout
        className="w-full max-w-md glass p-8 rounded-[2.5rem] border-white/10 relative z-10"
      >
        <AnimatePresence mode="wait">
          {showForgot ? (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-black text-white mb-2 text-center">استعادة كلمة المرور</h2>
              <p className="text-white/60 text-center mb-8">أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة</p>
              <form className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/80 mr-2">البريد الإلكتروني</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input type="email" required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-4 pr-12 text-white focus:outline-none focus:border-primary transition-all" placeholder="name@example.com" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg">إرسال الرابط</button>
                <button onClick={() => setShowForgot(false)} className="w-full text-white/40 text-sm hover:text-white transition-colors">العودة لتسجيل الدخول</button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-2xl neon-border text-white mb-4">A</div>
                <h2 className="text-2xl font-black text-white">{isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}</h2>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                      <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-4 pr-12 text-white focus:outline-none focus:border-primary transition-all" placeholder="اسم المستخدم" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input type="email" required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-4 pr-12 text-white focus:outline-none focus:border-primary transition-all" placeholder="البريد الإلكتروني" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input type="password" required className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-4 pr-12 text-white focus:outline-none focus:border-primary transition-all" placeholder="كلمة المرور" />
                  </div>
                </div>

                {isLogin && (
                  <button type="button" onClick={() => setShowForgot(true)} className="text-primary text-xs font-bold hover:underline block mr-auto">نسيت كلمة المرور؟</button>
                )}

                <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg mt-4">{isLogin ? "دخول" : "إنشاء الحساب"}</button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-white/40">أو عبر</span></div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <button className="flex items-center justify-center py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"><Chrome className="w-5 h-5 text-white" /></button>
                <button className="flex items-center justify-center py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"><Facebook className="w-5 h-5 text-[#1877F2]" /></button>
                <button className="flex items-center justify-center py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"><Github className="w-5 h-5 text-white" /></button>
              </div>

              <p className="mt-8 text-center text-white/60 text-sm">
                {isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
                <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-bold mr-2 hover:underline">
                  {isLogin ? "سجل الآن" : "سجل دخولك"}
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-white/5 text-[10px] text-white/20 text-center space-x-reverse space-x-4">
          <Link href="/terms" className="hover:text-white transition-colors">اتفاقية الاستخدام</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">سياسة الخصوصية</Link>
        </div>
      </motion.div>
    </div>
  );
}