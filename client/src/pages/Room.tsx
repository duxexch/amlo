import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, Gift, Send, Heart, UserPlus, Users } from "lucide-react";
import { useLocation } from "wouter";
import avatarImg from "@/assets/images/avatar-3d.png";
import giftImg from "@/assets/images/gift-3d.png";

export function Room() {
  const [, setLocation] = useLocation();
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showChat] = useState(true);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [hearts, setHearts] = useState<{id: number, x: number}[]>([]);
  
  const addHeart = () => {
    const id = Date.now();
    const x = Math.random() * 100; // random position percentage
    setHearts(prev => [...prev, {id, x}]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col md:flex-row" dir="rtl">
      {/* Main Video Area */}
      <div className="relative flex-1 h-full bg-zinc-900">
        {videoOn ? (
          <img src={avatarImg} alt="Video Stream" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/50 neon-border animate-pulse-ring">
              <img src={avatarImg} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
        
        {/* Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 safe-area-top flex justify-between items-start z-10 pt-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl rounded-full pr-4 p-1 border border-white/10 shadow-lg">
              <img src={avatarImg} className="w-10 h-10 rounded-full border border-primary" alt="Host" />
              <div>
                <p className="text-white text-sm font-bold">سارة أحمد</p>
                <div className="flex items-center gap-1 text-white/70 text-xs">
                  <Users className="w-3 h-3" />
                  <span>1,205</span>
                </div>
              </div>
              <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center ml-1 mr-3 hover:bg-primary/80 transition-colors">
                <UserPlus className="w-4 h-4 text-white" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-md flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                مباشر
              </span>
              <span className="bg-primary/20 text-primary border border-primary/30 text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-md">
                #دردشة
              </span>
            </div>
          </div>

          <button 
            onClick={() => setLocation('/')}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-destructive hover:border-destructive transition-colors shadow-lg"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Floating Hearts Animation */}
        <div className="absolute bottom-24 right-4 w-20 h-64 pointer-events-none z-20">
          <AnimatePresence>
            {hearts.map(heart => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, y: 0, x: heart.x - 50, scale: 0.5 }}
                animate={{ opacity: 0, y: -200, scale: 1.5, x: (heart.x - 50) * 2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute bottom-0 text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                style={{ right: '50%' }}
              >
                <Heart className="w-8 h-8 fill-current" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Action Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 safe-area-bottom flex items-center justify-between z-10 pb-8">
          <div className="flex gap-4">
            <button 
              onClick={() => setMicOn(!micOn)}
              className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-xl border-2 transition-all ${micOn ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-destructive/80 border-destructive text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]'}`}
            >
              {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setVideoOn(!videoOn)}
              className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-xl border-2 transition-all ${videoOn ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-destructive/80 border-destructive text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]'}`}
            >
              {videoOn ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setShowGiftModal(true)}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 to-primary flex items-center justify-center border-2 border-white/20 shadow-[0_0_20px_rgba(236,72,153,0.6)] animate-pulse hover:scale-110 transition-transform"
            >
              <Gift className="w-6 h-6 text-white" />
            </button>
            <button 
              onClick={addHeart}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border-2 border-white/20 text-white hover:bg-primary/50 hover:border-primary transition-all active:scale-95"
            >
              <Heart className="w-6 h-6 fill-current text-primary drop-shadow-md" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Sidebar (Desktop) / Bottom Overlay (Mobile) */}
      <div className={`md:w-96 h-[40vh] md:h-full bg-gradient-to-t from-black/90 via-black/60 to-transparent md:bg-black/60 md:backdrop-blur-2xl border-t md:border-t-0 md:border-r border-white/10 flex flex-col absolute md:relative bottom-0 left-0 right-0 z-20 ${showChat ? 'flex' : 'hidden md:flex'}`}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar flex flex-col justify-end pb-24 md:pb-4">
          
          {/* System Message */}
          <motion.div 
             initial={{ opacity: 0, scale: 0.9, x: -20 }}
             animate={{ opacity: 1, scale: 1, x: 0 }}
             className="bg-gradient-to-r from-yellow-500/20 to-transparent p-3 rounded-2xl border border-yellow-500/30 w-max"
          >
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-sm font-bold">✨ انضم محمد علي إلى الغرفة</span>
            </div>
          </motion.div>

          {/* Mock Chat Messages */}
          {[
            { user: "أحمد", msg: "مرحباً بالجميع!", color: "text-blue-400" },
            { user: "ياسمين", msg: "البث رائع جداً 🔥", color: "text-pink-400" },
            { user: "نادر", msg: "ممكن طلب خاص؟", color: "text-green-400" },
          ].map((chat, i) => (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key={i} 
              className="flex flex-col bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5 self-start max-w-[80%]"
            >
              <span className={`font-bold text-xs ${chat.color} mb-1`}>{chat.user}</span>
              <span className="text-white text-sm leading-relaxed">{chat.msg}</span>
            </motion.div>
          ))}
          
          {/* Gift Message */}
          <motion.div 
             initial={{ opacity: 0, scale: 0.9, x: 20 }}
             animate={{ opacity: 1, scale: 1, x: 0 }}
             className="bg-gradient-to-r from-primary/30 to-transparent p-3 rounded-2xl border border-primary/50 self-start"
          >
            <div className="flex items-center gap-3">
              <img src={giftImg} alt="Gift" className="w-8 h-8 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
              <span className="text-white text-sm font-bold">أرسل طارق <span className="text-primary neon-text">50 كوين!</span></span>
            </div>
          </motion.div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 absolute md:relative bottom-0 left-0 right-0 bg-black/50 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none pb-8 md:pb-4">
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="اكتب تعليقاً..." 
              className="w-full bg-white/10 border border-white/20 rounded-full py-4 px-5 text-white text-sm focus:outline-none focus:border-primary focus:bg-white/15 transition-all pr-14"
            />
            <button className="absolute right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              <Send className="w-5 h-5 text-white -ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGiftModal(false)} />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg glass rounded-t-[40px] md:rounded-3xl p-6 border-t md:border border-white/20 max-h-[80vh] flex flex-col"
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full md:hidden" />
              
              <div className="flex justify-between items-center mb-8 mt-4 md:mt-0">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Gift className="text-primary w-6 h-6" />
                  إرسال هدايا
                </h3>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10 shadow-inner">
                  <span className="font-black text-yellow-400 text-lg">1,250</span>
                  <span className="text-xs text-white/60 font-bold">كوينز</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 overflow-y-auto p-2 no-scrollbar">
                {[10, 50, 100, 500, 1000, 5000, 10000, 50000].map((val, i) => (
                  <button key={val} className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-primary hover:bg-primary/10 transition-all group hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(168,85,247,0.2)]">
                    <img 
                      src={giftImg} 
                      alt="Gift" 
                      className="w-14 h-14 object-contain group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" 
                      style={{ filter: `hue-rotate(${i * 45}deg)` }}
                    />
                    <span className="text-sm font-black text-white bg-black/40 px-2 py-0.5 rounded-md">{val}</span>
                  </button>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                 <button className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                   شحن الرصيد
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}