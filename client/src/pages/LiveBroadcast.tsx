import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Mic, MicOff, Headphones, Radio, Users, Eye, Crown, Shield, Flame, Play, UserPlus, X, Send, Heart, Gift, Share2, VideoOff, Phone, PhoneOff, UserCheck, MessageCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import avatarImg from "@/assets/images/avatar-3d.png";
import giftImg from "@/assets/images/gift-3d.png";
import { useTranslation } from "react-i18next";

// ══════════════════════════════════════════════════════════
// Mock Data
// ══════════════════════════════════════════════════════════

const mockLiveStreams = [
  { id: "v1", type: "video" as const, host: "سارة أحمد", username: "sara_live", avatar: avatarImg, viewers: 1205, title: "بث مباشر 🔥", tags: ["ترفيه", "دردشة"], isLive: true, level: 35 },
  { id: "v2", type: "video" as const, host: "عمر يوسف", username: "omar_yt", avatar: avatarImg, viewers: 832, title: "ألعاب + توزيعات 🎮", tags: ["ألعاب"], isLive: true, level: 28 },
  { id: "v3", type: "video" as const, host: "ليلى كريم", username: "layla_k", avatar: avatarImg, viewers: 2100, title: "أزياء وإطلالات ✨", tags: ["أزياء", "جمال"], isLive: true, level: 42 },
  { id: "v4", type: "video" as const, host: "خالد محمد", username: "khaled_m", avatar: avatarImg, viewers: 456, title: "دروس تقنية 💻", tags: ["تعليم"], isLive: true, level: 20 },
  { id: "v5", type: "video" as const, host: "نور حسن", username: "noor_h", avatar: avatarImg, viewers: 1890, title: "طبخ عربي 🍳", tags: ["طبخ"], isLive: true, level: 38 },
  { id: "v6", type: "video" as const, host: "أمير رشيد", username: "amir_r", avatar: avatarImg, viewers: 670, title: "رحلة في الطبيعة 🌿", tags: ["سفر"], isLive: true, level: 18 },
];

const mockAudioStreams = [
  { id: "a1", type: "audio" as const, host: "محمد علي", username: "moali_talk", avatar: avatarImg, viewers: 340, title: "سوالف ليلية 🌙", tags: ["دردشة"], isLive: true, level: 25, speakers: ["فاطمة", "أحمد"], maxSpeakers: 5 },
  { id: "a2", type: "audio" as const, host: "هدى سالم", username: "huda_radio", avatar: avatarImg, viewers: 520, title: "قصص وروايات 📚", tags: ["ثقافة"], isLive: true, level: 30, speakers: ["يوسف"], maxSpeakers: 4 },
  { id: "a3", type: "audio" as const, host: "ياسر خان", username: "yaser_k", avatar: avatarImg, viewers: 180, title: "نقاش سياسي 🗳", tags: ["أخبار"], isLive: true, level: 22, speakers: ["مريم", "سعود", "ريم"], maxSpeakers: 6 },
  { id: "a4", type: "audio" as const, host: "رنا أحمد", username: "rana_voice", avatar: avatarImg, viewers: 890, title: "أغاني ومواهب 🎵", tags: ["موسيقى"], isLive: true, level: 40, speakers: ["طارق"], maxSpeakers: 3 },
  { id: "a5", type: "audio" as const, host: "زياد مصطفى", username: "ziad_m", avatar: avatarImg, viewers: 210, title: "تطوير الذات 💡", tags: ["تحفيز"], isLive: true, level: 15, speakers: [], maxSpeakers: 4 },
];

const mockChatUsers = [
  { id: "u1", name: "أحمد", username: "ahmed_99", avatar: avatarImg, level: 15, badge: 'vip' as const },
  { id: "u2", name: "ياسمين", username: "yasmine_star", avatar: avatarImg, level: 32, badge: 'top' as const },
  { id: "u3", name: "نادر", username: "nader_live", avatar: avatarImg, level: 8 },
  { id: "u4", name: "طارق", username: "tariq_pro", avatar: avatarImg, level: 45, badge: 'mod' as const },
  { id: "u5", name: "ليلى", username: "layla_music", avatar: avatarImg, level: 22 },
];

// ══════════════════════════════════════════════════════════
// Live Stream Card Components
// ══════════════════════════════════════════════════════════

function VideoStreamCard({ stream, onClick }: { stream: typeof mockLiveStreams[0]; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden group border border-white/10 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] text-left"
    >
      <img src={stream.avatar} alt={stream.host} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* LIVE badge */}
      <div className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        LIVE
      </div>

      {/* Viewers */}
      <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
        <Eye className="w-2.5 h-2.5" />
        {stream.viewers >= 1000 ? (stream.viewers / 1000).toFixed(1) + "K" : stream.viewers}
      </div>

      {/* Video icon */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-blue-500/20 backdrop-blur-sm text-blue-400 border border-blue-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
        <Video className="w-2.5 h-2.5" />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-full border-2 border-primary/50 overflow-hidden">
            <img src={stream.avatar} alt={stream.host} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-bold truncate">{stream.host}</p>
            <p className="text-white/40 text-[10px] truncate">{stream.title}</p>
          </div>
        </div>
        {stream.tags?.length > 0 && (
          <div className="flex gap-1 overflow-hidden">
            {stream.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9px] font-medium bg-white/15 backdrop-blur-sm text-white/80 px-1.5 py-0.5 rounded-md">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
}

function AudioStreamCard({ stream, onClick }: { stream: typeof mockAudioStreams[0]; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full rounded-2xl overflow-hidden group border border-white/10 hover:border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-[#0c0c1d] to-cyan-500/5 transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] p-4 text-left"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Headphones className="w-2.5 h-2.5" />
            {t("live.audio")}
          </div>
          <div className="bg-red-500/15 text-red-400 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            LIVE
          </div>
        </div>
        <div className="bg-black/30 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Eye className="w-2.5 h-2.5" />
          {stream.viewers}
        </div>
      </div>

      {/* Host info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/50 overflow-hidden ring-2 ring-emerald-500/20">
            <img src={stream.avatar} alt={stream.host} className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#0c0c1d]">
            <Mic className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-bold truncate">{stream.host}</p>
          <p className="text-white/40 text-xs truncate">{stream.title}</p>
        </div>
      </div>

      {/* Speakers row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {stream.speakers.slice(0, 3).map((s, i) => (
            <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0c0c1d] overflow-hidden bg-emerald-500/10">
              <img src={avatarImg} alt={s} className="w-full h-full object-cover" />
            </div>
          ))}
          {stream.speakers.length === 0 && (
            <div className="text-white/30 text-[10px]">{t("live.noSpeakersYet")}</div>
          )}
        </div>
        {stream.speakers.length > 0 && (
          <span className="text-white/40 text-[10px]">
            {stream.speakers.slice(0, 2).join("، ")} {stream.speakers.length > 2 ? `+${stream.speakers.length - 2}` : ""}
          </span>
        )}
        <div className="mr-auto rtl:ml-auto rtl:mr-0 bg-white/5 text-white/30 text-[10px] px-1.5 py-0.5 rounded-full">
          {stream.speakers.length}/{stream.maxSpeakers} {t("live.speakers")}
        </div>
      </div>

      {/* Tags */}
      {stream.tags?.length > 0 && (
        <div className="flex gap-1">
          {stream.tags.map((tag) => (
            <span key={tag} className="text-[9px] font-medium bg-emerald-500/10 text-emerald-400/70 px-1.5 py-0.5 rounded-md border border-emerald-500/10">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Sound wave animation */}
      <div className="absolute top-4 right-4 flex items-end gap-0.5 h-4">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-0.5 bg-emerald-400/40 rounded-full"
            animate={{ height: [4, 12 + Math.random() * 4, 6, 16, 4] }}
            transition={{ duration: 1.2 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.button>
  );
}

// ══════════════════════════════════════════════════════════
// Audio Room View (full-screen)
// ══════════════════════════════════════════════════════════

interface ChatMsg {
  id: number;
  type: 'message' | 'join' | 'invite' | 'leave';
  user: { id: string; name: string; avatar: string; level: number; badge?: string };
  text?: string;
  color: string;
  timestamp: number;
}

function AudioRoomView({ stream, onClose }: { stream: typeof mockAudioStreams[0]; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [inputValue, setInputValue] = useState('');
  const [hearts, setHearts] = useState<{id: number; x: number}[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [speakers, setSpeakers] = useState(stream.speakers);
  const [isHost] = useState(true); // mock: user is host
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 1, type: 'join', user: { id: 'u1', name: 'أحمد', avatar: avatarImg, level: 15 }, color: 'text-yellow-400', timestamp: Date.now() - 30000 },
    { id: 2, type: 'message', user: { id: 'u2', name: 'ياسمين', avatar: avatarImg, level: 32, badge: 'vip' }, text: 'مرحبا بالجميع! 👋', color: 'text-pink-400', timestamp: Date.now() - 20000 },
    { id: 3, type: 'message', user: { id: 'u3', name: 'نادر', avatar: avatarImg, level: 8 }, text: 'يا سلام على الصوت 🎵', color: 'text-green-400', timestamp: Date.now() - 15000 },
    { id: 4, type: 'invite', user: { id: 'u4', name: 'فاطمة', avatar: avatarImg, level: 20 }, text: t("live.joinedSpeakers"), color: 'text-emerald-400', timestamp: Date.now() - 10000 },
    { id: 5, type: 'message', user: { id: 'u5', name: 'سعود', avatar: avatarImg, level: 18 }, text: 'موضوع ممتاز 👏', color: 'text-blue-400', timestamp: Date.now() - 5000 },
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate incoming messages
  useEffect(() => {
    const phrases = ["ما شاء الله 🌟", "يا سلام!", "هههههه 😂", "أبدعت 💪", "قلبي ❤️", "المزيد! ☝️", "رائع 🔥"];
    const interval = setInterval(() => {
      const u = mockChatUsers[Math.floor(Math.random() * mockChatUsers.length)];
      const colors = ['text-blue-400', 'text-pink-400', 'text-green-400', 'text-orange-400', 'text-cyan-400'];
      setMessages(prev => [...prev.slice(-40), {
        id: Date.now(),
        type: 'message',
        user: u,
        text: phrases[Math.floor(Math.random() * phrases.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        timestamp: Date.now(),
      }]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const addHeart = () => {
    const id = Date.now();
    setHearts(prev => [...prev, { id, x: Math.random() * 100 }]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2000);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'message',
      user: { id: 'me', name: 'أنت', avatar: avatarImg, level: 10 },
      text: inputValue,
      color: 'text-primary',
      timestamp: Date.now(),
    }]);
    setInputValue('');
  };

  const inviteSpeaker = (user: typeof mockChatUsers[0]) => {
    setSpeakers(prev => [...prev, user.name]);
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'invite',
      user,
      text: t("live.joinedSpeakers"),
      color: 'text-emerald-400',
      timestamp: Date.now(),
    }]);
    setShowInviteModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#06060f] overflow-hidden" dir={dir}>
      {/* Background ambient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-black/50" />
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-cyan-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Top Bar */}
      <div className="relative z-30 px-4 pt-[env(safe-area-inset-top,12px)] flex justify-between items-start">
        <div className="flex flex-col gap-1.5 pt-2">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full pr-3 p-1 border border-white/10">
            <div className="relative">
              <img src={stream.avatar} className="w-9 h-9 rounded-full border border-emerald-500" alt="Host" />
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#06060f]">
                <Mic className="w-2 h-2 text-white" />
              </div>
            </div>
            <div>
              <p className="text-white text-xs font-bold leading-tight">{stream.host}</p>
              <div className="flex items-center gap-1 text-white/70 text-[10px]">
                <Users className="w-2.5 h-2.5" />
                <span>{stream.viewers}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {t("common.live")}
            </span>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md flex items-center gap-1">
              <Headphones className="w-2.5 h-2.5" />
              {t("live.audio")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <Share2 className="w-4 h-4 text-white" />
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-destructive hover:border-destructive transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="relative z-20 px-4 mt-4 mb-3">
        <h2 className="text-white font-bold text-lg">{stream.title}</h2>
        <div className="flex gap-1 mt-1">
          {stream.tags.map(tag => (
            <span key={tag} className="text-[10px] bg-emerald-500/10 text-emerald-400/70 px-2 py-0.5 rounded-full border border-emerald-500/15">#{tag}</span>
          ))}
        </div>
      </div>

      {/* Speakers Section */}
      <div className="relative z-20 px-4 mb-4">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white/60">{t("live.onStage")} ({speakers.length + 1}/{stream.maxSpeakers})</span>
            </div>
            {isHost && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-500/25 transition-colors"
              >
                <UserPlus className="w-3 h-3" />
                {t("live.inviteSpeaker")}
              </button>
            )}
          </div>

          {/* Host + Speakers circles */}
          <div className="flex flex-wrap gap-4 justify-center">
            {/* Host */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-emerald-500 overflow-hidden ring-4 ring-emerald-500/20">
                  <img src={stream.avatar} alt={stream.host} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Crown className="w-2 h-2" />
                  {t("live.host")}
                </div>
                {/* Sound wave indicator */}
                <div className="absolute -top-1 -right-1 flex items-end gap-[1px]">
                  {[1,2,3].map(i => (
                    <motion.div key={i} className="w-[2px] bg-emerald-400 rounded-full" animate={{ height: [2, 8 + Math.random() * 4, 3] }} transition={{ duration: 0.6 + i * 0.1, repeat: Infinity }} />
                  ))}
                </div>
              </div>
              <span className="text-white text-[10px] font-bold">{stream.host}</span>
            </div>

            {/* Co-speakers */}
            {speakers.map((name, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-cyan-500/50 overflow-hidden ring-2 ring-cyan-500/15">
                    <img src={avatarImg} alt={name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-cyan-500/80 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full">
                    <Mic className="w-2 h-2 inline" />
                  </div>
                  <div className="absolute -top-1 -right-1 flex items-end gap-[1px]">
                    {[1,2].map(j => (
                      <motion.div key={j} className="w-[2px] bg-cyan-400/60 rounded-full" animate={{ height: [2, 6 + Math.random() * 3, 2] }} transition={{ duration: 0.8 + j * 0.15, repeat: Infinity }} />
                    ))}
                  </div>
                </div>
                <span className="text-white/70 text-[10px] font-medium">{name}</span>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, stream.maxSpeakers - speakers.length - 1) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center bg-white/[0.02]">
                  <UserPlus className="w-5 h-5 text-white/15" />
                </div>
                <span className="text-white/20 text-[10px]">{t("live.emptySlot")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="absolute bottom-[72px] left-0 right-16 max-h-[30vh] z-20 flex flex-col justify-end px-3">
        <div className="overflow-y-auto no-scrollbar space-y-1 mask-fade-top">
          {messages.map(msg => {
            if (msg.type === 'join') {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="py-0.5">
                  <span className="text-yellow-400/70 text-xs">✨ {msg.user.name} {t("live.joinedRoom")}</span>
                </motion.div>
              );
            }
            if (msg.type === 'invite') {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="py-0.5">
                  <span className="text-emerald-400/70 text-xs">🎙️ {msg.user.name} {msg.text}</span>
                </motion.div>
              );
            }
            if (msg.type === 'leave') {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="py-0.5">
                  <span className="text-red-400/70 text-xs">👋 {msg.user.name} {t("live.leftRoom")}</span>
                </motion.div>
              );
            }
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 py-0.5">
                <img src={msg.user.avatar} alt={msg.user.name} className="w-7 h-7 rounded-full object-cover border border-white/15 shrink-0" />
                <div className="min-w-0">
                  <span className={`text-xs font-bold ${msg.color}`}>{msg.user.name}</span>
                  {msg.user.badge === 'vip' && <Crown className="w-3 h-3 text-yellow-400 inline mr-1 ml-1" />}
                  <p className="text-white/85 text-sm">{msg.text}</p>
                </div>
              </motion.div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-4 z-30">
        <button onClick={addHeart} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
            <Heart className="w-5 h-5 fill-current text-primary" />
          </div>
        </button>
        <button onClick={() => setShowGiftModal(true)} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <div className="w-11 h-11 rounded-full bg-gradient-to-t from-pink-500/60 to-primary/60 backdrop-blur-md flex items-center justify-center border border-white/15">
            <Gift className="w-5 h-5 text-white" />
          </div>
        </button>
      </div>

      {/* Floating Hearts */}
      <div className="absolute bottom-[200px] right-5 w-12 h-40 pointer-events-none z-30">
        <AnimatePresence>
          {hearts.map(heart => (
            <motion.div key={heart.id} initial={{ opacity: 1, y: 0, scale: 0.5 }} animate={{ opacity: 0, y: -150, scale: 1.3, x: (heart.x - 50) * 0.3 }} exit={{ opacity: 0 }} transition={{ duration: 2, ease: "easeOut" }} className="absolute bottom-0 right-1/2">
              <Heart className="w-6 h-6 fill-current text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Input */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-[env(safe-area-inset-bottom,8px)] pt-2 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={t("live.typeMessage")} className="w-full bg-white/10 backdrop-blur-md border border-white/15 rounded-full py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/30" />
          </div>
          <button onClick={handleSend} className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/80 flex items-center justify-center hover:bg-emerald-500 transition-colors">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Invite Speaker Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[32px] p-6 border-t border-white/10"
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full" />
              <h3 className="text-lg font-bold text-white mt-4 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                {t("live.inviteSpeaker")}
              </h3>
              <p className="text-white/40 text-xs mb-4">{t("live.inviteDesc")}</p>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {mockChatUsers.filter(u => !speakers.includes(u.name)).map(user => (
                  <button key={user.id} onClick={() => inviteSpeaker(user)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
                  >
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border border-white/10" />
                    <div className="text-right rtl:text-right ltr:text-left flex-1 min-w-0">
                      <p className="text-white text-sm font-bold flex items-center gap-1">
                        {user.name}
                        {user.badge === 'vip' && <Crown className="w-3 h-3 text-yellow-400" />}
                        {user.badge === 'mod' && <Shield className="w-3 h-3 text-blue-400" />}
                      </p>
                      <p className="text-white/30 text-xs">@{user.username}</p>
                    </div>
                    <div className="bg-emerald-500/15 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30">
                      {t("live.invite")}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGiftModal(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
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
                    <img src={giftImg} alt="Gift" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" style={{ filter: `hue-rotate(${i * 45}deg)` }} />
                    <span className="text-xs font-black text-white">{val}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Main Live Broadcast Page
// ══════════════════════════════════════════════════════════

export function LiveBroadcast() {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"video" | "audio">("video");
  const [selectedAudioRoom, setSelectedAudioRoom] = useState<typeof mockAudioStreams[0] | null>(null);

  // If audio room is selected, show full-screen audio room
  if (selectedAudioRoom) {
    return <AudioRoomView stream={selectedAudioRoom} onClose={() => setSelectedAudioRoom(null)} />;
  }

  return (
    <div className="py-6 space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            {t("live.title")}
          </h1>
          <p className="text-white/40 text-sm mt-1">{t("live.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-red-500/15 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full border border-red-500/20 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {mockLiveStreams.length + mockAudioStreams.length} {t("live.liveNow")}
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
        <button
          onClick={() => setActiveTab("video")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
            activeTab === "video"
              ? "bg-gradient-to-r from-blue-500/20 to-primary/20 text-white border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
              : "text-white/40 hover:text-white/60 hover:bg-white/5"
          }`}
        >
          <Video className={`w-5 h-5 ${activeTab === "video" ? "text-blue-400" : ""}`} />
          {t("live.videoLive")}
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === "video" ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/30"}`}>
            {mockLiveStreams.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("audio")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
            activeTab === "audio"
              ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              : "text-white/40 hover:text-white/60 hover:bg-white/5"
          }`}
        >
          <Headphones className={`w-5 h-5 ${activeTab === "audio" ? "text-emerald-400" : ""}`} />
          {t("live.audioLive")}
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === "audio" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30"}`}>
            {mockAudioStreams.length}
          </span>
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "video" ? (
          <motion.div
            key="video"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Video Streams Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {mockLiveStreams.map(stream => (
                <VideoStreamCard
                  key={stream.id}
                  stream={stream}
                  onClick={() => setLocation(`/room/${stream.id}`)}
                />
              ))}
            </div>

            {mockLiveStreams.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Video className="w-16 h-16 text-white/10 mb-4" />
                <p className="text-white/30 text-sm">{t("live.noVideoStreams")}</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="audio"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Audio Streams List */}
            <div className="space-y-3">
              {mockAudioStreams.map(stream => (
                <AudioStreamCard
                  key={stream.id}
                  stream={stream}
                  onClick={() => setSelectedAudioRoom(stream)}
                />
              ))}
            </div>

            {mockAudioStreams.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Headphones className="w-16 h-16 text-white/10 mb-4" />
                <p className="text-white/30 text-sm">{t("live.noAudioStreams")}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
