import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, Gift, Send, Heart, UserPlus, Users, UserCheck, MessageCircle, Share2, MoreHorizontal, Crown, Shield } from "lucide-react";
import { useLocation } from "wouter";
import avatarImg from "@/assets/images/avatar-3d.png";
import giftImg from "@/assets/images/gift-3d.png";
import { useTranslation } from "react-i18next";

// ── Mock chat data ─────────────────────────────────────
interface ChatMessage {
  id: number;
  type: 'message' | 'join' | 'gift' | 'follow';
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    level: number;
    badge?: 'vip' | 'mod' | 'top';
    isFollowed?: boolean;
  };
  text?: string;
  giftAmount?: number;
  color: string;
  timestamp: number;
}

const mockUsers = [
  { id: "u1", name: "أحمد", username: "ahmed_99", avatar: avatarImg, level: 15, badge: 'vip' as const, isFollowed: false },
  { id: "u2", name: "ياسمين", username: "yasmine_star", avatar: avatarImg, level: 32, badge: 'top' as const, isFollowed: true },
  { id: "u3", name: "نادر", username: "nader_live", avatar: avatarImg, level: 8, isFollowed: false },
  { id: "u4", name: "طارق", username: "tariq_pro", avatar: avatarImg, level: 45, badge: 'mod' as const, isFollowed: true },
  { id: "u5", name: "ليلى", username: "layla_music", avatar: avatarImg, level: 22, isFollowed: false },
  { id: "u6", name: "محمد علي", username: "moali_gamer", avatar: avatarImg, level: 5, isFollowed: false },
];

// ── User Profile Popup ─────────────────────────────────
function UserProfilePopup({ user, onClose, onFollow, t }: { user: ChatMessage['user']; onClose: () => void; onFollow: (id: string) => void; t: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[28px] border-t border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-white/20 rounded-full" />
      </div>

      {/* Banner */}
      <div className="h-20 bg-gradient-to-r from-primary/40 via-pink-500/30 to-primary/20 relative mx-4 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-10" />
      </div>
      
      {/* Avatar */}
      <div className="flex justify-center -mt-10 relative z-10">
        <div className="w-20 h-20 rounded-full border-4 border-[#0c0c1d] overflow-hidden ring-2 ring-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Info */}
      <div className="text-center px-6 pt-3 pb-6">
        <div className="flex items-center justify-center gap-1.5">
          <h4 className="text-white font-bold text-lg">{user.name}</h4>
          {user.badge === 'vip' && <Crown className="w-4 h-4 text-yellow-400" />}
          {user.badge === 'mod' && <Shield className="w-4 h-4 text-blue-400" />}
          {user.badge === 'top' && <Crown className="w-4 h-4 text-pink-400" />}
        </div>
        <p className="text-white/40 text-xs mt-0.5">@{user.username}</p>
        
        {/* Level */}
        <div className="flex items-center justify-center gap-1 mt-2">
          <span className="bg-gradient-to-r from-primary to-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-full">
            LV.{user.level}
          </span>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-4 text-center">
          <div>
            <p className="text-white font-bold text-base">12.5K</p>
            <p className="text-white/30 text-[10px]">{t("room.followers")}</p>
          </div>
          <div>
            <p className="text-white font-bold text-base">234</p>
            <p className="text-white/30 text-[10px]">{t("room.following")}</p>
          </div>
          <div>
            <p className="text-white font-bold text-base">89</p>
            <p className="text-white/30 text-[10px]">{t("room.gifts")}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onFollow(user.id)}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
              user.isFollowed
                ? 'bg-white/10 text-white/60 border border-white/10'
                : 'bg-primary text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:bg-primary/80'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              {user.isFollowed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {user.isFollowed ? t("room.following") : t("room.follow")}
            </span>
          </button>
          <button className="py-3 px-6 rounded-2xl bg-white/10 text-white/60 border border-white/10 hover:bg-white/20 transition-all">
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── TikTok-style Chat Message ──────────────────────────
function TikTokComment({ message, onUserClick, t }: { message: ChatMessage; onUserClick: (user: ChatMessage['user']) => void; t: any }) {
  if (message.type === 'join') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 py-1"
      >
        <span className="text-yellow-400/80 text-xs font-medium">
          ✨ {t("room.joinMessage", { name: message.user.name })}
        </span>
      </motion.div>
    );
  }

  if (message.type === 'gift') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -30, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.3, type: "spring" }}
        className="flex items-center gap-2 bg-gradient-to-r from-primary/20 to-transparent rounded-full py-1.5 px-3 w-fit"
      >
        <img src={giftImg} alt="Gift" className="w-6 h-6 drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
        <span className="text-white text-xs">
          <span className="font-bold">{message.user.name}</span>
          {' '}{t("room.sent")}{' '}
          <span className="text-primary font-black">{message.giftAmount} {t("room.giftCoinsLabel")}</span>
        </span>
      </motion.div>
    );
  }

  if (message.type === 'follow') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 py-1"
      >
        <span className="text-pink-400/80 text-xs font-medium">
          💖 {t("room.newFollower", { name: message.user.name })}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-2 py-0.5 group"
    >
      {/* Avatar - clickable */}
      <button
        onClick={() => onUserClick(message.user)}
        className="shrink-0 relative"
      >
        <img src={message.user.avatar} alt={message.user.name} className="w-8 h-8 rounded-full object-cover border border-white/20 group-hover:border-primary/50 transition-colors" />
        {message.user.badge && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black flex items-center justify-center">
            {message.user.badge === 'vip' && <Crown className="w-2.5 h-2.5 text-yellow-400" />}
            {message.user.badge === 'mod' && <Shield className="w-2.5 h-2.5 text-blue-400" />}
            {message.user.badge === 'top' && <Crown className="w-2.5 h-2.5 text-pink-400" />}
          </div>
        )}
      </button>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <button onClick={() => onUserClick(message.user)} className="hover:underline">
          <span className={`text-xs font-bold ${message.color}`}>{message.user.name}</span>
          {message.user.level >= 30 && (
            <span className="inline-flex items-center bg-gradient-to-r from-primary/30 to-pink-500/30 text-[8px] font-black text-white px-1.5 py-0 rounded-sm mr-1 ml-1">
              LV.{message.user.level}
            </span>
          )}
        </button>
        <p className="text-white/90 text-sm leading-relaxed">{message.text}</p>
      </div>
    </motion.div>
  );
}

export function Room() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [, setLocation] = useLocation();
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [hearts, setHearts] = useState<{id: number, x: number}[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatMessage['user'] | null>(null);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set(['u2', 'u4']));
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const heartTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup heart timers on unmount
  useEffect(() => {
    return () => {
      heartTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, type: 'join', user: mockUsers[5], color: 'text-yellow-400', timestamp: Date.now() - 30000 },
    { id: 2, type: 'message', user: mockUsers[0], text: t("room.mockMsg1"), color: 'text-blue-400', timestamp: Date.now() - 25000 },
    { id: 3, type: 'message', user: mockUsers[1], text: t("room.mockMsg2"), color: 'text-pink-400', timestamp: Date.now() - 20000 },
    { id: 4, type: 'follow', user: mockUsers[4], color: 'text-pink-400', timestamp: Date.now() - 15000 },
    { id: 5, type: 'message', user: mockUsers[2], text: t("room.mockMsg3"), color: 'text-green-400', timestamp: Date.now() - 10000 },
    { id: 6, type: 'gift', user: mockUsers[3], giftAmount: 50, color: 'text-purple-400', timestamp: Date.now() - 5000 },
    { id: 7, type: 'message', user: mockUsers[4], text: t("room.mockMsg4", "أحلى بث 🔥🎵"), color: 'text-orange-400', timestamp: Date.now() - 2000 },
  ]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate incoming messages
  useEffect(() => {
    const phrases = [
      t("room.mockPhrase1", "ما شاء الله 🌟"),
      t("room.mockPhrase2", "يا سلام عليك!"),
      t("room.mockPhrase3", "هههههه 😂"),
      t("room.mockPhrase4", "تسلم يا بطل 💪"),
      t("room.mockPhrase5", "أبدعت والله ✨"),
      t("room.mockPhrase6", "قلبي عليك ❤️"),
      t("room.mockPhrase7", "يا جماعة اللايك ☝️"),
    ];
    const interval = setInterval(() => {
      const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      const colors = ['text-blue-400', 'text-pink-400', 'text-green-400', 'text-orange-400', 'text-cyan-400', 'text-yellow-400'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      setMessages(prev => [...prev.slice(-30), {
        id: Date.now(),
        type: 'message',
        user: { ...randomUser, isFollowed: followedUsers.has(randomUser.id) },
        text: randomPhrase,
        color: randomColor,
        timestamp: Date.now(),
      }]);
    }, 4000);

    return () => clearInterval(interval);
  }, [followedUsers]);

  const addHeart = () => {
    const id = Date.now();
    const x = Math.random() * 100;
    setHearts(prev => [...prev, {id, x}]);
    const timer = setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2000);
    heartTimersRef.current.push(timer);
  };

  const toggleFollow = (userId: string) => {
    setFollowedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setSelectedUser(prev => prev ? { ...prev, isFollowed: !prev.isFollowed } : null);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'message',
      user: { id: 'me', name: t("room.you", "أنت"), username: 'me', avatar: avatarImg, level: 10, isFollowed: false },
      text: inputValue,
      color: 'text-primary',
      timestamp: Date.now(),
    }]);
    setInputValue('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden" dir={dir}>
      {/* Full-screen Video */}
      <div className="absolute inset-0">
        {videoOn ? (
          <img src={avatarImg} alt="Video Stream" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-primary/50 neon-border animate-pulse-ring">
              <img src={avatarImg} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>
      
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 px-3 pt-[env(safe-area-inset-top,12px)] flex justify-between items-start z-30">
        <div className="flex flex-col gap-1.5 pt-2">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full pr-3 p-1 border border-white/10">
            <img src={avatarImg} className="w-9 h-9 rounded-full border border-primary" alt="Host" />
            <div>
              <p className="text-white text-xs font-bold leading-tight">{t("room.hostName", "سارة أحمد")}</p>
              <div className="flex items-center gap-1 text-white/70 text-[10px]">
                <Users className="w-2.5 h-2.5" />
                <span>1,205</span>
              </div>
            </div>
            <button className="w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors">
              <UserPlus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          
          <div className="flex gap-1.5">
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              {t("common.live")}
            </span>
            <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md">
              {t("room.chat")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button aria-label={t("room.shareBtn", "مشاركة")} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <Share2 className="w-4 h-4 text-white" />
          </button>
          <button 
            onClick={() => setLocation('/')}
            aria-label={t("room.closeBtn", "إغلاق")}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-destructive hover:border-destructive transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Right side action buttons (TikTok-style vertical) */}
      <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-4 z-30">
        {/* Heart */}
        <button 
          onClick={addHeart}
          aria-label={t("room.likeBtn", "إعجاب")}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
            <Heart className="w-5 h-5 fill-current text-primary" />
          </div>
          <span className="text-white/60 text-[10px] font-bold">2.1K</span>
        </button>

        {/* Gift */}
        <button 
          onClick={() => setShowGiftModal(true)}
          aria-label={t("room.giftBtn", "هدية")}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-t from-pink-500/60 to-primary/60 backdrop-blur-md flex items-center justify-center border border-white/15">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <span className="text-white/60 text-[10px] font-bold">{t("room.gifts")}</span>
        </button>

        {/* Camera toggle */}
        <button 
          onClick={() => setVideoOn(!videoOn)}
          aria-label={videoOn ? t("room.cameraOff", "إيقاف الكاميرا") : t("room.cameraOn", "تشغيل الكاميرا")}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${videoOn ? 'bg-black/30 border-white/10 text-white' : 'bg-destructive/50 border-destructive/40 text-white'}`}>
            {videoOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </div>
        </button>

        {/* Mic toggle */}
        <button 
          onClick={() => setMicOn(!micOn)}
          aria-label={micOn ? t("room.micOff", "إيقاف المايك") : t("room.micOn", "تشغيل المايك")}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${micOn ? 'bg-black/30 border-white/10 text-white' : 'bg-destructive/50 border-destructive/40 text-white'}`}>
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </div>
        </button>
      </div>

      {/* Floating Hearts */}
      <div className="absolute bottom-[200px] right-5 w-12 h-40 pointer-events-none z-30">
        <AnimatePresence>
          {hearts.map(heart => (
            <motion.div
              key={heart.id}
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -150, scale: 1.3, x: (heart.x - 50) * 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute bottom-0 right-1/2"
            >
              <Heart className="w-6 h-6 fill-current text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── TikTok-style Comments Area (bottom-left) ── */}
      <div className="absolute bottom-[72px] left-0 right-16 max-h-[30vh] z-20 flex flex-col justify-end px-3">
        <div className="overflow-y-auto no-scrollbar space-y-1 mask-fade-top">
          {messages.map(msg => (
            <TikTokComment
              key={msg.id}
              message={{ ...msg, user: { ...msg.user, isFollowed: followedUsers.has(msg.user.id) } }}
              onUserClick={(user) => setSelectedUser(prev => prev?.id === user.id ? null : user)}
              t={t}
            />
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* User Profile Popup — Bottom Sheet */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50" 
              onClick={() => setSelectedUser(null)} 
            />
            <UserProfilePopup
              user={{ ...selectedUser, isFollowed: followedUsers.has(selectedUser.id) }}
              onClose={() => setSelectedUser(null)}
              onFollow={toggleFollow}
              t={t}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Bottom Input Bar ── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-[env(safe-area-inset-bottom,8px)] pt-2 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={t("room.inputPlaceholder")} 
              className="w-full bg-white/10 backdrop-blur-md border border-white/15 rounded-full py-2.5 px-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/30"
            />
          </div>
          <button 
            onClick={handleSend}
            aria-label={t("room.sendBtn", "إرسال")}
            className="w-10 h-10 shrink-0 rounded-full bg-primary/80 flex items-center justify-center hover:bg-primary transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGiftModal(false)} />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[32px] p-6 border-t border-white/10 max-h-[70vh] flex flex-col"
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full" />
              
              <div className="flex justify-between items-center mb-6 mt-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Gift className="text-primary w-5 h-5" />
                  {t("room.giftModalTitle")}
                </h3>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                  <span className="font-black text-yellow-400 text-lg">1,250</span>
                  <span className="text-xs text-white/60 font-bold">{t("room.giftCoinsLabel")}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 overflow-y-auto p-1 no-scrollbar">
                {[10, 50, 100, 500, 1000, 5000, 10000, 50000].map((val, i) => (
                  <button key={val} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary hover:bg-primary/10 transition-all group hover:-translate-y-1">
                    <img 
                      src={giftImg} 
                      alt="Gift" 
                      className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" 
                      style={{ filter: `hue-rotate(${i * 45}deg)` }}
                    />
                    <span className="text-xs font-black text-white">{val}</span>
                  </button>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                <button className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                  {t("room.giftRecharge")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}