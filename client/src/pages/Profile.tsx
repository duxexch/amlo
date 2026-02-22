import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, LogOut, ChevronLeft, Camera, ShieldCheck } from "lucide-react";
import avatarImg from "@/assets/images/avatar-3d.png";
import coinImg from "@/assets/images/coin-3d.png";

export function Profile() {
  const sections = [
    { icon: User, label: "المعلومات الشخصية", desc: "تعديل الاسم، الصورة، والنبذة" },
    { icon: Bell, label: "الإشعارات", desc: "تنبيهات البث والمكالمات والرسائل" },
    { icon: Shield, label: "الأمان والخصوصية", desc: "كلمة المرور والحسابات المرتبطة" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-white" style={{fontFamily: 'Outfit'}}>الملف الشخصي</h1>
        <button className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/10">
          <Settings className="w-6 h-6 text-white" />
        </button>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col items-center md:flex-row md:items-start gap-8"
      >
        <div className="relative group">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-primary/50 neon-border">
            <img src={avatarImg} alt="Profile" className="w-full h-full object-cover" />
          </div>
          <button className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center border-4 border-[#0d0d1e] text-white shadow-lg hover:scale-110 transition-transform">
            <Camera className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 text-center md:text-right space-y-4">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
              <h2 className="text-3xl font-black text-white">فارس البطل</h2>
              <ShieldCheck className="w-6 h-6 text-blue-400 fill-blue-400/20" />
            </div>
            <p className="text-white/60 font-medium">@fares_hero</p>
          </div>
          
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2">
              <img src={coinImg} className="w-5 h-5" />
              <span className="font-bold text-yellow-400">1,250</span>
            </div>
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
              <span className="text-white/60 ml-1">المتابعين:</span>
              <span className="font-bold text-white">4.2K</span>
            </div>
          </div>

          <p className="text-white/70 max-w-md leading-relaxed">عاشق للتكنولوجيا والدردشة الصوتية. انضم إلي في غرفتي الخاصة كل يوم سبت!</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        {sections.map((item, i) => (
          <button key={i} className="glass p-6 rounded-3xl flex items-center gap-4 hover:bg-white/10 transition-all border border-white/5 group">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <item.icon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-lg font-bold text-white mb-0.5">{item.label}</p>
              <p className="text-sm text-white/40">{item.desc}</p>
            </div>
            <ChevronLeft className="w-6 h-6 text-white/20 group-hover:text-primary transition-colors" />
          </button>
        ))}
        
        <button className="glass p-6 rounded-3xl flex items-center gap-4 hover:bg-destructive/10 transition-all border border-destructive/10 group mt-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
            <LogOut className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex-1 text-right">
            <p className="text-lg font-bold text-destructive mb-0.5">تسجيل الخروج</p>
            <p className="text-sm text-destructive/40">إنهاء الجلسة الحالية</p>
          </div>
        </button>
      </div>
    </div>
  );
}