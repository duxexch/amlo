import { motion } from "framer-motion";
import { Users, DollarSign, Activity, Link as LinkIcon, Plus, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function Admin() {
  const [copied, setCopied] = useState<number | null>(null);

  const stats = [
    { label: "إجمالي المستخدمين", value: "14,592", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
    { label: "الأرباح اليوم", value: "$4,250", icon: DollarSign, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
    { label: "البثوث النشطة", value: "342", icon: Activity, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
    { label: "الوكلاء النشطين", value: "28", icon: Users, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  ];

  const agents = [
    { id: 1, name: "شركة الأفق", users: 1250, revenue: "$12,400", status: "نشط" },
    { id: 2, name: "وكالة النجوم", users: 840, revenue: "$8,100", status: "نشط" },
    { id: 3, name: "الوسيط الماسي", users: 430, revenue: "$3,200", status: "مراجعة" },
  ];

  const handleCopy = (id: number) => {
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white mb-2" style={{fontFamily: 'Outfit'}}>لوحة التحكم الإدارية</h1>
          <p className="text-white/70 text-lg">إدارة الوكلاء، الروابط، ومتابعة إحصائيات المشروع</p>
        </div>
        <button className="bg-primary hover:bg-primary/90 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all transform hover:scale-105">
          <Plus className="w-5 h-5" />
          إضافة وكيل جديد
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="glass p-6 rounded-3xl border border-white/10 flex flex-col gap-4 relative overflow-hidden group hover:border-white/30 transition-colors"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className={`w-24 h-24 ${stat.color} -mt-6 -mr-6`} />
            </div>
            
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${stat.bg} relative z-10`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div className="relative z-10">
              <p className="text-base font-bold text-white/70 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-white">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Affiliate Links Section */}
        <div className="glass p-8 rounded-[2rem] border border-white/10 lg:col-span-1 flex flex-col">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <LinkIcon className="text-primary w-5 h-5" />
            </div>
            روابط الإحالة
          </h2>
          
          <div className="space-y-8 flex-1">
            <div className="space-y-3">
              <label className="text-base font-bold text-white/80">رابط دعوة مستخدمين (عام)</label>
              <div className="flex bg-black/40 rounded-2xl border border-white/10 overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="px-5 py-4 flex-1 text-sm text-white/80 font-mono truncate">
                  https://ablox.app/ref/global-promo
                </div>
                <button 
                  onClick={() => handleCopy(0)}
                  className="bg-white/5 px-5 flex items-center justify-center hover:bg-white/10 transition-colors border-r border-white/10"
                >
                  {copied === 0 ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-white/70" />}
                </button>
              </div>
            </div>

            <div className="w-full h-px bg-white/10" />

            <div className="space-y-3">
              <label className="text-base font-bold text-white/80">توليد رابط وكيل مخصص</label>
              <select className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 text-white text-base focus:outline-none focus:border-primary transition-colors appearance-none">
                <option value="1" className="bg-gray-900">شركة الأفق</option>
                <option value="2" className="bg-gray-900">وكالة النجوم</option>
              </select>
              <button className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold mt-4 transition-colors border border-white/10">
                توليد الرابط
              </button>
            </div>
          </div>
        </div>

        {/* Agents Table */}
        <div className="glass p-8 rounded-[2rem] border border-white/10 lg:col-span-2 overflow-hidden flex flex-col">
          <h2 className="text-2xl font-bold text-white mb-8">الوكلاء المسجلين</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[600px]" dir="rtl">
              <thead>
                <tr className="border-b border-white/10 text-white/60 text-sm">
                  <th className="pb-4 font-bold px-4">اسم الوكيل</th>
                  <th className="pb-4 font-bold px-4 text-center">المستخدمين المسجلين</th>
                  <th className="pb-4 font-bold px-4 text-center">إجمالي الأرباح</th>
                  <th className="pb-4 font-bold px-4 text-center">الحالة</th>
                  <th className="pb-4 font-bold px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr key={agent.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group">
                    <td className="py-5 px-4 font-bold text-white text-lg">{agent.name}</td>
                    <td className="py-5 px-4 text-white/80 text-center font-medium">{agent.users}</td>
                    <td className="py-5 px-4 text-green-400 font-bold text-center">{agent.revenue}</td>
                    <td className="py-5 px-4 text-center">
                      <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold border ${agent.status === 'نشط' ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-orange-400/10 text-orange-400 border-orange-400/20'}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <button className="text-primary hover:text-primary/80 font-bold text-sm bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-xl transition-colors">التفاصيل</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}