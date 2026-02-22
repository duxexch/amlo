import { motion } from "framer-motion";
import { Video, Mic, Users, Flame } from "lucide-react";
import { Link } from "wouter";
import avatarImg from "@/assets/images/avatar-3d.png";
import heroBg from "@/assets/images/hero-bg.png";
import { useState } from "react";

export function Home() {
  const [activeTab, setActiveTab] = useState<'random' | 'live'>('random');

  const liveStreams = [
    { id: 1, name: "سارة أحمد", viewers: 1205, tags: ["موسيقى", "دردشة"], img: avatarImg },
    { id: 2, name: "DJ يلا نرقص", viewers: 3400, tags: ["حفلة", "دي جي"], img: avatarImg },
    { id: 3, name: "محمد علي", viewers: 450, tags: ["ألعاب"], img: avatarImg },
    { id: 4, name: "نور يوسف", viewers: 890, tags: ["موضة"], img: avatarImg },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Hero Section */}
      <section className="relative w-full h-[250px] md:h-[300px] rounded-3xl overflow-hidden shadow-2xl">
        <img src={heroBg} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-black text-white mb-2 neon-text"
            style={{fontFamily: 'Outfit'}}
          >
            عالم Aplo
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white/80 max-w-md text-lg"
          >
            تواصل، دردش، شارك لحظاتك مع العالم واكسب الهدايا
          </motion.p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex p-1.5 bg-white/5 rounded-2xl w-full max-w-md mx-auto backdrop-blur-md border border-white/10">
        <button 
          onClick={() => setActiveTab('random')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-lg transition-all duration-300 ${activeTab === 'random' ? 'bg-primary text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'text-white/60 hover:text-white'}`}
        >
          دردشة عشوائية
        </button>
        <button 
          onClick={() => setActiveTab('live')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-lg transition-all duration-300 ${activeTab === 'live' ? 'bg-secondary text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'text-white/60 hover:text-white'}`}
        >
          بث مباشر
        </button>
      </div>

      {/* Random Match Section */}
      {activeTab === 'random' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-6"
        >
          <div className="glass p-8 rounded-3xl flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center mb-6 neon-border relative">
              <div className="absolute inset-0 rounded-full animate-pulse-ring" />
              <Video className="w-14 h-14 text-primary" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">فيديو عشوائي</h3>
            <p className="text-muted-foreground mb-8 text-lg">تعرف على أشخاص جدد وجهاً لوجه</p>
            <Link href="/room/video">
              <a className="bg-primary hover:bg-primary/90 text-white font-bold text-xl py-4 px-10 rounded-full w-full max-w-[250px] shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all transform hover:scale-105 inline-block">
                ابدأ الآن
              </a>
            </Link>
          </div>

          <div className="glass p-8 rounded-3xl flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-28 h-28 rounded-full bg-secondary/20 flex items-center justify-center mb-6 neon-border-secondary relative">
              <div className="absolute inset-0 rounded-full animate-pulse-ring" style={{animationDelay: '1s'}} />
              <Mic className="w-14 h-14 text-secondary" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">صوت عشوائي</h3>
            <p className="text-muted-foreground mb-8 text-lg">تحدث بحرية وتعرف على أصدقاء</p>
            <Link href="/room/audio">
              <a className="bg-secondary hover:bg-secondary/90 text-white font-bold text-xl py-4 px-10 rounded-full w-full max-w-[250px] shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all transform hover:scale-105 inline-block">
                ابدأ الآن
              </a>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Live Streams Section */}
      {activeTab === 'live' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" /> 
              الأكثر شعبية
            </h2>
            <button className="text-primary hover:text-primary/80 font-medium text-lg">عرض الكل</button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {liveStreams.map((stream, i) => (
              <Link key={stream.id} href={`/room/${stream.id}`}>
                <a className="glass rounded-3xl overflow-hidden group block border-white/10">
                  <div className="relative aspect-[3/4]">
                    <img src={stream.img} alt={stream.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    
                    {/* Live Badge */}
                    <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-white"></span>
                      مباشر
                    </div>
                    
                    {/* Viewers */}
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stream.viewers}
                    </div>

                    {/* Info */}
                    <div className="absolute bottom-4 right-4 left-4">
                      <h3 className="text-xl font-bold text-white mb-1">{stream.name}</h3>
                      <div className="flex gap-2">
                        {stream.tags.map(tag => (
                          <span key={tag} className="text-xs font-medium bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded-lg">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}