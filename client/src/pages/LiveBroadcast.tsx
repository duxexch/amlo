import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Mic, MicOff, Headphones, Radio, Users, Eye, Crown, Shield, Flame, Play, UserPlus, X, Send, Heart, Gift, Share2, VideoOff, Phone, PhoneOff, UserCheck, MessageCircle, Plus, Languages, Loader2, WifiOff, Search, Calendar, BarChart3, Pin, PinOff, Vote, Monitor, MonitorOff, Circle, Square, Settings, Ban, VolumeX, Volume2, ChevronDown, Clock, Sparkles, Tag, Filter, ArrowLeft, Maximize, Minimize, PictureInPicture2, Timer } from "lucide-react";
import { Link, useLocation } from "wouter";
import avatarImg from "@/assets/images/avatar-3d.png";
import giftImg from "@/assets/images/gift-3d.png";
import { useTranslation } from "react-i18next";
import { getSocket, socketManager } from "@/lib/socketManager";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";
import { streamsApi, walletApi, giftsApi, translateApi } from "@/lib/socialApi";
import { authApi } from "@/lib/authApi";
import { livekitStreamManager, type StreamState, type StreamRole } from "@/lib/livekitStreamManager";

// Stream categories
const STREAM_CATEGORIES = ["chat", "gaming", "music", "education", "sports", "cooking", "art", "other"] as const;
type StreamCategory = typeof STREAM_CATEGORIES[number];

// ══════════════════════════════════════════════════════════
// Stream Types
// ══════════════════════════════════════════════════════════

interface StreamItem {
  id: string;
  userId?: string;
  type: string;
  host: string;
  username: string;
  avatar: string | null;
  viewers: number;
  viewerCount: number;
  title: string;
  tags: string[];
  isLive: boolean;
  level: number;
  speakers?: string[];
  maxSpeakers?: number;
  status: string;
}

// ══════════════════════════════════════════════════════════
// Live Stream Card Components
// ══════════════════════════════════════════════════════════

function VideoStreamCard({ stream, onClick }: { stream: StreamItem; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden group border border-white/10 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] text-left"
    >
      <img src={stream.avatar || avatarImg} alt={stream.host} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* LIVE badge */}
      <div className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        LIVE
      </div>

      {/* Viewers */}
      <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
        <Eye className="w-2.5 h-2.5" />
        {(stream.viewers || stream.viewerCount || 0) >= 1000 ? ((stream.viewers || stream.viewerCount || 0) / 1000).toFixed(1) + "K" : (stream.viewers || stream.viewerCount || 0)}
      </div>

      {/* Video icon */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-blue-500/20 backdrop-blur-sm text-blue-400 border border-blue-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
        <Video className="w-2.5 h-2.5" />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-full border-2 border-primary/50 overflow-hidden">
            <img src={stream.avatar || avatarImg} alt={stream.host} className="w-full h-full object-cover" />
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

function AudioStreamCard({ stream, onClick }: { stream: StreamItem; onClick: () => void }) {
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
          {stream.viewers || stream.viewerCount || 0}
        </div>
      </div>

      {/* Host info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/50 overflow-hidden ring-2 ring-emerald-500/20">
            <img src={stream.avatar || avatarImg} alt={stream.host} className="w-full h-full object-cover" />
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
          {(stream.speakers || []).slice(0, 3).map((s: any, i: number) => (
            <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0c0c1d] overflow-hidden bg-emerald-500/10">
              <img src={avatarImg} alt={s} className="w-full h-full object-cover" />
            </div>
          ))}
          {(!stream.speakers || stream.speakers.length === 0) && (
            <div className="text-white/30 text-[10px]">{t("live.noSpeakersYet")}</div>
          )}
        </div>
        {stream.speakers && stream.speakers.length > 0 && (
          <span className="text-white/40 text-[10px]">
            {stream.speakers.slice(0, 2).join("، ")}{" "}{stream.speakers.length > 2 ? `+${stream.speakers.length - 2}` : ""}
          </span>
        )}
        <div className="mr-auto rtl:ml-auto rtl:mr-0 bg-white/5 text-white/30 text-[10px] px-1.5 py-0.5 rounded-full">
          {(stream.speakers || []).length}/{stream.maxSpeakers || 4} {t("live.speakers")}
        </div>
      </div>

      {/* Tags */}
      {stream.tags?.length > 0 && (
        <div className="flex gap-1">
          {(stream.tags || []).map((tag: string) => (
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

// ── Live Chat Message with inline translation ──
function LiveChatMsg({ msg }: { msg: ChatMsg }) {
  const { t, i18n } = useTranslation();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handleTranslate = async () => {
    if (translated) { setShow(!show); return; }
    if (!msg.text || loading) return;
    setLoading(true);
    try {
      const targetLang = localStorage.getItem("ablox_translate_lang") || i18n.language || "ar";
      const result = await translateApi.translate(msg.text, targetLang);
      setTranslated(result.translatedText);
      setShow(true);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 py-0.5">
      <img src={msg.user.avatar} alt={msg.user.name} className="w-7 h-7 rounded-full object-cover border border-white/15 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className={`text-xs font-bold ${msg.color}`}>{msg.user.name}</span>
          {msg.user.badge === 'vip' && <Crown className="w-3 h-3 text-yellow-400 inline" />}
          <button onClick={handleTranslate} className={`opacity-40 hover:opacity-80 transition-opacity ${show ? "!opacity-70" : ""}`} title={t("chat.translate")}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin text-white/50" /> : <Languages className="w-3 h-3 text-white/50" />}
          </button>
        </div>
        <p className="text-white/85 text-sm">{msg.text}</p>
        {show && translated && (
          <p className="text-white/60 text-xs italic mt-0.5">{translated}</p>
        )}
      </div>
    </motion.div>
  );
}

function AudioRoomView({ stream, onClose }: { stream: StreamItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [inputValue, setInputValue] = useState('');
  const [hearts, setHearts] = useState<{id: number; x: number}[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [speakers, setSpeakers] = useState<{ id: string; name: string; avatar: string }[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [roomViewers, setRoomViewers] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{ roomId: string; hostId: string; hostName: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<string | null>(null);
  const [activePoll, setActivePoll] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [giftAnimations, setGiftAnimations] = useState<{ id: number; name: string; image: string; sender: string }[]>([]);
  const conn = useConnectionQuality();
  const MAX_MESSAGES = conn.quality === 'poor' ? 25 : 50;
  const [lkState, setLkState] = useState<StreamState>('idle');
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());

  const [messages, setMessages] = useState<ChatMsg[]>([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Determine if current user is host + connect LiveKit audio
  useEffect(() => {
    let cancelled = false;

    const initLiveKit = async () => {
      try {
        const res = await authApi.me();
        const userId = res?.data?.id || '';
        if (cancelled) return;
        setCurrentUserId(userId);
        setCurrentUserName(res?.data?.displayName || res?.data?.username || '');
        const hostMode = !!(userId && stream.userId && userId === stream.userId);
        setIsHost(hostMode);

        // Fetch LiveKit token
        setLkState('connecting');
        const tokenRes = await streamsApi.token(stream.id);
        if (cancelled) return;

        const { token, wsUrl, role } = tokenRes;
        if (!token || !wsUrl) {
          setLkState('failed');
          return;
        }

        // Connect to LiveKit — audio only (no video for audio rooms)
        await livekitStreamManager.connect(wsUrl, token, role as StreamRole, {
          onStateChange: (state: StreamState) => {
            if (!cancelled) setLkState(state);
          },
          onActiveSpeakersChanged: (speakerIdentities: string[]) => {
            if (!cancelled) setActiveSpeakerIds(new Set(speakerIdentities));
          },
          onError: (msg: string) => {
            console.error('[AudioRoom] LiveKit error:', msg);
            if (!cancelled) setLkState('failed');
          },
        }, { publishVideo: false, publishAudio: hostMode });
      } catch (err) {
        console.error('[AudioRoom] Init error:', err);
        if (!cancelled) setLkState('failed');
      }
    };

    initLiveKit();

    // Fetch pinned message & active poll
    streamsApi.detail(stream.id).then((d: any) => { if (d?.pinnedMessage) setPinnedMessage(d.pinnedMessage); }).catch(() => {});
    streamsApi.getActivePoll(stream.id).then((p: any) => { if (p?.id) setActivePoll(p); }).catch(() => {});

    return () => {
      cancelled = true;
      livekitStreamManager.disconnect();
    };
  }, [stream.id, stream.userId]);

  // Socket-based chat + speaker events
  useEffect(() => {
    const socket = getSocket();
    const roomId = stream.id;
    socket.emit('join-room', roomId);

    const handleChatMessage = (data: any) => {
      if (!data?.message) return;
      const colors = ['text-blue-400', 'text-pink-400', 'text-green-400', 'text-orange-400', 'text-cyan-400'];
      setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), {
        id: data.id || Date.now(),
        type: 'message',
        user: data.user
          ? { ...data.user, avatar: data.user.avatar || avatarImg, level: data.user.level || 1 }
          : { id: 'unknown', name: 'مجهول', avatar: avatarImg, level: 1 },
        text: data.message,
        color: colors[Math.floor(Math.random() * colors.length)],
        timestamp: data.ts || Date.now(),
      }]);
    };

    const handleSpeakerJoined = (data: any) => {
      if (data?.roomId === roomId && data?.userId) {
        setSpeakers(prev => {
          if (prev.find(s => s.id === data.userId)) return prev;
          return [...prev, { id: data.userId, name: data.userName || 'مستخدم', avatar: avatarImg }];
        });
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'invite',
          user: { id: data.userId, name: data.userName || 'مستخدم', avatar: avatarImg, level: 1 },
          text: t("live.joinedSpeakers"),
          color: 'text-emerald-400',
          timestamp: Date.now(),
        }]);
      }
    };

    const handleSpeakerRemoved = (data: any) => {
      if (data?.roomId === roomId && data?.userId) {
        setSpeakers(prev => prev.filter(s => s.id !== data.userId));
      }
    };

    const handleSpeakerInvite = (data: any) => {
      if (data?.roomId === roomId) {
        setPendingInvite({ roomId: data.roomId, hostId: data.hostId, hostName: data.hostName || 'المضيف' });
      }
    };

    const handleSpeakerDeclined = (data: any) => {
      if (data?.roomId === roomId) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'leave',
          user: { id: data.userId, name: 'مستخدم', avatar: avatarImg, level: 1 },
          text: t("live.declinedInvite", "رفض الدعوة"),
          color: 'text-red-400',
          timestamp: Date.now(),
        }]);
      }
    };

    const handleGiftReceived = (data: any) => {
      if (data?.streamId === roomId || data?.roomId === roomId) {
        setGiftAnimations(prev => [...prev, { id: Date.now(), name: data.giftName || 'هدية', image: data.giftImage || giftImg, sender: data.senderName || '' }]);
      }
    };

    const handlePinned = (data: any) => {
      if (data?.streamId === roomId) setPinnedMessage(data.message || null);
    };

    const handlePollUpdate = (data: any) => {
      if (data?.streamId === roomId) setActivePoll(data.poll || null);
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('speaker-joined', handleSpeakerJoined);
    socket.on('speaker-removed', handleSpeakerRemoved);
    socket.on('speaker-invite', handleSpeakerInvite);
    socket.on('speaker-declined', handleSpeakerDeclined);
    socket.on('gift-received', handleGiftReceived);
    socket.on('stream-pinned', handlePinned);
    socket.on('stream-poll-update', handlePollUpdate);

    return () => {
      socket.emit('leave-room', roomId);
      socket.off('chat-message', handleChatMessage);
      socket.off('speaker-joined', handleSpeakerJoined);
      socket.off('speaker-removed', handleSpeakerRemoved);
      socket.off('speaker-invite', handleSpeakerInvite);
      socket.off('speaker-declined', handleSpeakerDeclined);
      socket.off('gift-received', handleGiftReceived);
      socket.off('stream-pinned', handlePinned);
      socket.off('stream-poll-update', handlePollUpdate);
    };
  }, []);

  // Fetch viewers when invite modal opens
  useEffect(() => {
    if (showInviteModal) {
      setLoadingViewers(true);
      streamsApi.viewers(stream.id)
        .then((data: any) => setRoomViewers(Array.isArray(data) ? data : (data?.data || [])))
        .catch(() => setRoomViewers([]))
        .finally(() => setLoadingViewers(false));
    }
  }, [showInviteModal, stream.id]);

  const addHeart = () => {
    const id = Date.now();
    setHearts(prev => [...prev, { id, x: Math.random() * 100 }]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2000);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    socketManager.emit('chat-message', {
      roomId: stream.id,
      message: inputValue.trim(),
      user: { id: currentUserId || 'me', name: currentUserName || t('live.you', 'أنت') },
    });
    setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), {
      id: Date.now(),
      type: 'message',
      user: { id: currentUserId || 'me', name: currentUserName || t('live.you', 'أنت'), avatar: avatarImg, level: 10 },
      text: inputValue,
      color: 'text-primary',
      timestamp: Date.now(),
    }]);
    setInputValue('');
  };

  const inviteSpeaker = (user: any) => {
    const socket = getSocket();
    socket.emit('invite-speaker', {
      roomId: stream.id,
      targetUserId: user.id,
      hostName: stream.host,
    });
    // Pre-promote in LiveKit so they can publish when they accept
    streamsApi.promote(stream.id, user.id).catch(() => {});
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'invite',
      user: { id: user.id, name: user.displayName || user.username || 'مستخدم', avatar: user.avatar || avatarImg, level: user.level || 1 },
      text: t("live.inviteSent", "تم إرسال دعوة"),
      color: 'text-yellow-400',
      timestamp: Date.now(),
    }]);
    setShowInviteModal(false);
  };

  const removeSpeaker = (speakerId: string) => {
    const socket = getSocket();
    socket.emit('remove-speaker', { roomId: stream.id, targetUserId: speakerId });
    // Also revoke LiveKit publish permission
    streamsApi.demote(stream.id, speakerId).catch(() => {});
  };

  const acceptInvite = async () => {
    if (!pendingInvite) return;
    const socket = getSocket();
    socket.emit('accept-speaker-invite', { roomId: pendingInvite.roomId, userName: currentUserName || t('live.you', 'أنت') });
    setPendingInvite(null);
    setIsSpeaker(true);

    // Promote in LiveKit — request new token with speaker role and start publishing audio
    try {
      await streamsApi.promote(stream.id, currentUserId);
      // Reconnect with speaker permissions to start publishing audio
      const tokenRes = await streamsApi.token(stream.id);
      if (tokenRes?.token && tokenRes?.wsUrl) {
        livekitStreamManager.disconnect();
        await livekitStreamManager.connect(tokenRes.wsUrl, tokenRes.token, 'speaker', {
          onStateChange: (state: StreamState) => setLkState(state),
          onActiveSpeakersChanged: (ids: string[]) => setActiveSpeakerIds(new Set(ids)),
          onError: (msg: string) => console.error('[AudioRoom] LiveKit error:', msg),
        }, { publishVideo: false, publishAudio: true });
      }
    } catch (err) {
      console.error('[AudioRoom] Failed to start speaker audio:', err);
    }
  };

  const declineInvite = () => {
    if (!pendingInvite) return;
    const socket = getSocket();
    socket.emit('decline-speaker-invite', { roomId: pendingInvite.roomId, hostId: pendingInvite.hostId });
    setPendingInvite(null);
  };

  // ── New feature handlers ──
  const handlePinMessage = async () => {
    const msg = prompt(t("live.enterPinMessage", "أدخل الرسالة المثبتة:"));
    if (msg?.trim()) {
      try { await streamsApi.pin(stream.id, msg.trim()); setPinnedMessage(msg.trim()); } catch { /* silent */ }
    }
  };
  const handleUnpin = async () => { try { await streamsApi.unpin(stream.id); setPinnedMessage(null); } catch { /* silent */ } };
  const handleCreatePoll = async (question: string, options: string[]) => {
    try { const res = await streamsApi.createPoll(stream.id, question, options); setActivePoll(res); setShowCreatePoll(false); } catch { /* silent */ }
  };
  const handleVotePoll = async (pollId: string, option: string) => {
    try { const res = await streamsApi.votePoll(stream.id, pollId, option); setActivePoll(res); } catch { /* silent */ }
  };
  const handleEndPoll = async (pollId: string) => {
    try { await streamsApi.endPoll(stream.id, pollId); setActivePoll(null); } catch { /* silent */ }
  };
  const toggleRecording = async () => {
    try { if (isRecording) { await streamsApi.stopRecording(stream.id); setIsRecording(false); } else { await streamsApi.startRecording(stream.id); setIsRecording(true); } } catch { /* silent */ }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#06060f] overflow-hidden" dir={dir}>
      {/* Gift Animation Overlay */}
      <GiftAnimationOverlay gifts={giftAnimations} onDone={id => setGiftAnimations(prev => prev.filter(g => g.id !== id))} />

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
              <img src={stream.avatar || avatarImg} className="w-9 h-9 rounded-full border border-emerald-500" alt="Host" />
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
                <div className={`w-16 h-16 rounded-full border-2 overflow-hidden ring-4 transition-all ${activeSpeakerIds.has(stream.userId || '') ? 'border-emerald-400 ring-emerald-400/30' : 'border-emerald-500 ring-emerald-500/20'}`}>
                  <img src={stream.avatar || avatarImg} alt={stream.host} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Crown className="w-2 h-2" />
                  {t("live.host")}
                </div>
                {/* Sound wave indicator — active when speaking via LiveKit */}
                {activeSpeakerIds.has(stream.userId || '') && (
                  <div className="absolute -top-1 -right-1 flex items-end gap-[1px]">
                    {[1,2,3].map(i => (
                      <motion.div key={i} className="w-[2px] bg-emerald-400 rounded-full" animate={{ height: [2, 8 + Math.random() * 4, 3] }} transition={{ duration: 0.6 + i * 0.1, repeat: Infinity }} />
                    ))}
                  </div>
                )}
              </div>
              <span className="text-white text-[10px] font-bold">{stream.host}</span>
            </div>

            {/* Co-speakers */}
            {speakers.map((speaker) => (
              <div key={speaker.id} className="flex flex-col items-center gap-1.5 relative">
                <div className="relative">
                  <div className={`w-14 h-14 rounded-full border-2 overflow-hidden ring-2 transition-all ${activeSpeakerIds.has(speaker.id) ? 'border-cyan-400 ring-cyan-400/25' : 'border-cyan-500/50 ring-cyan-500/15'}`}>
                    <img src={speaker.avatar || avatarImg} alt={speaker.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-cyan-500/80 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full">
                    <Mic className="w-2 h-2 inline" />
                  </div>
                  {activeSpeakerIds.has(speaker.id) && (
                    <div className="absolute -top-1 -right-1 flex items-end gap-[1px]">
                      {[1,2].map(j => (
                        <motion.div key={j} className="w-[2px] bg-cyan-400/60 rounded-full" animate={{ height: [2, 6 + Math.random() * 3, 2] }} transition={{ duration: 0.8 + j * 0.15, repeat: Infinity }} />
                      ))}
                    </div>
                  )}
                  {isHost && (
                    <button onClick={() => removeSpeaker(speaker.id)} className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center">
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  )}
                </div>
                <span className="text-white/70 text-[10px] font-medium">{speaker.name}</span>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, (stream.maxSpeakers || 4) - speakers.length - 1) }).map((_, i) => (
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

      {/* Pinned Message */}
      <div className="relative z-20">
        <AnimatePresence>
          <PinnedMessageBanner message={pinnedMessage} isHost={isHost} onUnpin={handleUnpin} />
        </AnimatePresence>
      </div>

      {/* Poll */}
      <div className="relative z-20">
        <AnimatePresence>
          <PollWidget poll={activePoll} onVote={handleVotePoll} onEnd={handleEndPoll} isHost={isHost} />
        </AnimatePresence>
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
              <LiveChatMsg key={msg.id} msg={msg} />
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-4 z-30">
        {/* Mic toggle for host/speakers */}
        {(isHost || isSpeaker) && (
          <button
            onClick={async () => {
              try {
                const isMuted = await livekitStreamManager.toggleMicrophone();
                setMicOn(!isMuted);
              } catch { setMicOn(m => !m); }
            }}
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          >
            <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border transition-all ${micOn ? 'bg-emerald-500/30 border-emerald-500/40 text-emerald-400' : 'bg-destructive/50 border-destructive/40 text-white'}`}>
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </div>
          </button>
        )}
        {/* Connection status indicator */}
        {(lkState === 'connecting' || lkState === 'reconnecting') && (
          <div className="w-11 h-11 rounded-full bg-yellow-500/20 backdrop-blur-md flex items-center justify-center border border-yellow-500/30">
            <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
          </div>
        )}
        {lkState === 'failed' && (
          <div className="w-11 h-11 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center border border-red-500/30">
            <WifiOff className="w-5 h-5 text-red-400" />
          </div>
        )}
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
        {/* Host extra controls */}
        {isHost && (
          <>
            <button onClick={handlePinMessage} className="active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Pin className="w-5 h-5 text-white/70" />
              </div>
            </button>
            <button onClick={() => setShowCreatePoll(true)} className="active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Vote className="w-5 h-5 text-white/70" />
              </div>
            </button>
            <button onClick={toggleRecording} className="active:scale-90 transition-transform">
              <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border ${isRecording ? 'bg-red-600/40 border-red-600/50 text-red-400 animate-pulse' : 'bg-black/30 border-white/10 text-white/70'}`}>
                {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-5 h-5" />}
              </div>
            </button>
            <button onClick={() => setShowStats(true)} className="active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <BarChart3 className="w-5 h-5 text-white/70" />
              </div>
            </button>
            <button onClick={() => setShowModeration(true)} className="active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Shield className="w-5 h-5 text-white/70" />
              </div>
            </button>
          </>
        )}
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
                {loadingViewers ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : roomViewers.filter(v => v.role === 'viewer' && v.id !== currentUserId && !speakers.find(s => s.id === v.id)).length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-8">{t("live.noViewersToInvite")}</p>
                ) : (
                  roomViewers.filter(v => v.role === 'viewer' && v.id !== currentUserId && !speakers.find(s => s.id === v.id)).map(viewer => (
                    <button
                      key={viewer.id}
                      onClick={() => inviteSpeaker(viewer)}
                      className="w-full flex items-center gap-3 bg-white/5 hover:bg-emerald-500/10 rounded-xl p-3 transition-colors border border-transparent hover:border-emerald-500/20"
                    >
                      <img src={viewer.avatar || avatarImg} alt={viewer.displayName} className="w-10 h-10 rounded-full border border-white/10" />
                      <div className="flex-1 text-right">
                        <p className="text-white text-sm font-bold">{viewer.displayName || viewer.username}</p>
                        <p className="text-white/40 text-[10px]">@{viewer.username} · LV.{viewer.level}</p>
                      </div>
                      <div className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-full border border-emerald-500/30">
                        {t("live.invite", "دعوة")}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Speaker Invite Notification */}
      <AnimatePresence>
        {pendingInvite && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-4 right-4 z-[110] bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/40 rounded-2xl p-4 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-bold">{t("live.speakerInviteTitle", "دعوة للتحدث")}</p>
                <p className="text-white/60 text-xs">{t("live.speakerInviteDesc", "{{host}} يدعوك للتحدث في البث", { host: pendingInvite.hostName })}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={acceptInvite} className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">
                {t("live.acceptInvite", "قبول")}
              </button>
              <button onClick={declineInvite} className="flex-1 py-2 rounded-xl bg-white/10 text-white/60 text-sm font-bold hover:bg-white/20 transition-colors">
                {t("live.declineInvite", "رفض")}
              </button>
            </div>
          </motion.div>
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
              <GiftModalContent streamId={stream.id} onClose={() => setShowGiftModal(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {showStats && <HostStatsModal streamId={stream.id} onClose={() => setShowStats(false)} />}
      </AnimatePresence>

      {/* Moderation Modal */}
      <AnimatePresence>
        {showModeration && <ModerationModal streamId={stream.id} onClose={() => setShowModeration(false)} />}
      </AnimatePresence>

      {/* Create Poll Modal */}
      <AnimatePresence>
        {showCreatePoll && <CreatePollModal onClose={() => setShowCreatePoll(false)} onCreate={handleCreatePoll} />}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Gift Modal Content (shared)
// ══════════════════════════════════════════════════════════

function GiftModalContent({ streamId, onClose }: { streamId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [coinBalance, setCoinBalance] = useState(0);
  const [giftCatalog, setGiftCatalog] = useState<any[]>([]);

  useEffect(() => {
    walletApi.balance().then(r => setCoinBalance(r.coins || 0)).catch(() => {});
    giftsApi.list().then(setGiftCatalog).catch(() => {});
  }, []);

  const sendGift = async (gift: any) => {
    try {
      await giftsApi.send({ giftId: gift.id, receiverId: streamId, streamId });
      setCoinBalance(prev => Math.max(0, prev - (gift.price || gift.coinCost || 0)));
    } catch { /* ignore */ }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6 mt-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="text-primary w-5 h-5" />
          {t("room.giftModalTitle")}
        </h3>
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
          <span className="font-black text-yellow-400 text-lg">{coinBalance.toLocaleString()}</span>
          <span className="text-xs text-white/60 font-bold">{t("room.giftCoinsLabel")}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 overflow-y-auto p-1 no-scrollbar">
        {giftCatalog.length > 0 ? giftCatalog.map((gift, i) => (
          <button key={gift.id} onClick={() => sendGift(gift)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary hover:bg-primary/10 transition-all group hover:-translate-y-1">
            <img src={gift.imageUrl || giftImg} alt={gift.name} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" style={{ filter: gift.imageUrl ? undefined : `hue-rotate(${i * 45}deg)` }} />
            <span className="text-xs font-black text-white">{gift.price || gift.coinCost || 0}</span>
          </button>
        )) : [10, 50, 100, 500, 1000, 5000, 10000, 50000].map((val, i) => (
          <button key={val} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary hover:bg-primary/10 transition-all group hover:-translate-y-1">
            <img src={giftImg} alt="Gift" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" style={{ filter: `hue-rotate(${i * 45}deg)` }} />
            <span className="text-xs font-black text-white">{val}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// Gift Animation Overlay
// ══════════════════════════════════════════════════════════

function GiftAnimationOverlay({ gifts, onDone }: { gifts: { id: number; name: string; image: string; sender: string }[]; onDone: (id: number) => void }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[90]">
      <AnimatePresence>
        {gifts.map(g => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, scale: 0.3, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 2, y: -200 }}
            transition={{ duration: 2, ease: "easeOut" }}
            onAnimationComplete={() => onDone(g.id)}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            <img src={g.image || giftImg} alt={g.name} className="w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.8)]" />
            <div className="mt-2 bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/20">
              <span className="text-white text-sm font-bold">{g.sender}</span>
              <span className="text-primary text-sm mx-1">🎁</span>
              <span className="text-yellow-400 text-sm font-bold">{g.name}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Pinned Message Banner
// ══════════════════════════════════════════════════════════

function PinnedMessageBanner({ message, isHost, onUnpin }: { message: string | null; isHost: boolean; onUnpin: () => void }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-3 mb-2 bg-primary/15 border border-primary/30 rounded-xl px-3 py-2 flex items-center gap-2 backdrop-blur-md z-20 relative"
    >
      <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
      <p className="text-white/90 text-xs flex-1 truncate">{message}</p>
      {isHost && (
        <button onClick={onUnpin} className="text-white/40 hover:text-white/80 transition-colors shrink-0">
          <PinOff className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════
// Poll Widget
// ══════════════════════════════════════════════════════════

function PollWidget({ poll, onVote, onEnd, isHost }: {
  poll: { id: string; question: string; options: string[]; votes: Record<string, number>; isActive: boolean } | null;
  onVote: (pollId: string, option: string) => void;
  onEnd: (pollId: string) => void;
  isHost: boolean;
}) {
  const { t } = useTranslation();
  if (!poll) return null;

  const totalVotes = Object.values(poll.votes || {}).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mx-3 mb-2 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-3 backdrop-blur-md z-20 relative"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Vote className="w-4 h-4 text-indigo-400" />
          <span className="text-white text-xs font-bold">{poll.question}</span>
        </div>
        {isHost && poll.isActive && (
          <button onClick={() => onEnd(poll.id)} className="text-white/40 hover:text-red-400 text-[10px] font-bold transition-colors">
            {t("live.endPoll", "إنهاء")}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const count = poll.votes?.[opt] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          return (
            <button
              key={opt}
              onClick={() => poll.isActive && onVote(poll.id, opt)}
              disabled={!poll.isActive}
              className="w-full relative rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors disabled:cursor-default"
            >
              <div className="absolute inset-y-0 left-0 bg-indigo-500/20 transition-all" style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between px-3 py-1.5">
                <span className="text-white/90 text-xs">{opt}</span>
                <span className="text-white/50 text-[10px] font-bold">{pct}% ({count})</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-white/30 text-[10px] mt-1.5 text-center">{totalVotes} {t("live.totalVotes", "صوت")}</p>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════
// Create Poll Modal
// ══════════════════════════════════════════════════════════

function CreatePollModal({ onClose, onCreate }: { onClose: () => void; onCreate: (q: string, opts: string[]) => void }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const addOption = () => { if (options.length < 6) setOptions([...options, ""]); };
  const updateOption = (i: number, v: string) => { const n = [...options]; n[i] = v; setOptions(n); };

  const valid = question.trim() && options.filter(o => o.trim()).length >= 2;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="relative bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-2xl p-5 border border-white/10 w-[90%] max-w-sm">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <Vote className="w-5 h-5 text-indigo-400" />
          {t("live.createPoll", "إنشاء تصويت")}
        </h3>
        <input value={question} onChange={e => setQuestion(e.target.value)} placeholder={t("live.pollQuestion", "السؤال...")}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm mb-3 focus:outline-none focus:border-indigo-500/50 placeholder:text-white/20" />
        {options.map((opt, i) => (
          <input key={i} value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`${t("live.option", "خيار")} ${i + 1}`}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs mb-2 focus:outline-none focus:border-indigo-500/50 placeholder:text-white/20" />
        ))}
        {options.length < 6 && (
          <button onClick={addOption} className="text-indigo-400 text-xs font-bold mb-3 hover:text-indigo-300">{t("live.addOption", "+ إضافة خيار")}</button>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-bold">{t("common.cancel", "إلغاء")}</button>
          <button onClick={() => valid && onCreate(question.trim(), options.filter(o => o.trim()))} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold disabled:opacity-40">{t("live.startPoll", "بدء التصويت")}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Host Stats Modal
// ══════════════════════════════════════════════════════════

function HostStatsModal({ streamId, onClose }: { streamId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    streamsApi.stats(streamId).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [streamId]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="relative bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-2xl p-5 border border-white/10 w-[90%] max-w-sm">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-yellow-400" />
          {t("live.streamStats", "إحصائيات البث")}
        </h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
        ) : stats ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
              <span className="text-white/60 text-xs">{t("live.peakViewers", "ذروة المشاهدين")}</span>
              <span className="text-white font-bold text-sm">{stats.peakViewers || 0}</span>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
              <span className="text-white/60 text-xs">{t("live.uniqueViewers", "مشاهدون فريدون")}</span>
              <span className="text-white font-bold text-sm">{stats.uniqueViewers || 0}</span>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
              <span className="text-white/60 text-xs">{t("live.totalGifts", "إجمالي الهدايا")}</span>
              <span className="text-yellow-400 font-bold text-sm">{stats.totalGifts || 0}</span>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
              <span className="text-white/60 text-xs">{t("live.duration", "المدة")}</span>
              <span className="text-white font-bold text-sm">{stats.duration || "0:00"}</span>
            </div>
            {stats.topGifters?.length > 0 && (
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-white/60 text-xs mb-2">{t("live.topGifters", "أكثر المهدين")}</p>
                {stats.topGifters.slice(0, 3).map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-white text-xs">{i + 1}. {g.name || g.displayName}</span>
                    <span className="text-yellow-400 text-xs font-bold">{g.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-white/30 text-xs text-center py-4">{t("live.noStats", "لا توجد إحصائيات")}</p>
        )}
        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 transition-colors">
          {t("common.close", "إغلاق")}
        </button>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Quality Selector
// ══════════════════════════════════════════════════════════

function QualitySelector({ current, onChange }: { current: string; onChange: (q: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const qualities = [
    { value: "low", label: t("live.qualityLow", "منخفضة"), desc: "360p" },
    { value: "medium", label: t("live.qualityMedium", "متوسطة"), desc: "720p" },
    { value: "high", label: t("live.qualityHigh", "عالية"), desc: "1080p" },
  ];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
        <Settings className="w-5 h-5 text-white/70" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-full right-0 mb-2 bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-xl border border-white/10 overflow-hidden min-w-[140px]">
            {qualities.map(q => (
              <button key={q.value} onClick={() => { onChange(q.value); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${current === q.value ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/5'}`}>
                <span className="font-bold">{q.label}</span>
                <span className="text-white/30">{q.desc}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Moderation Modal
// ══════════════════════════════════════════════════════════

function ModerationModal({ streamId, onClose }: { streamId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [tab, setTab] = useState<"words" | "muted">("words");
  const [words, setWords] = useState<any[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    streamsApi.getBannedWords(streamId).then(setWords).catch(() => {}).finally(() => setLoading(false));
  }, [streamId]);

  const addWord = async () => {
    if (!newWord.trim()) return;
    try {
      await streamsApi.addBannedWord(streamId, newWord.trim());
      setWords(prev => [...prev, { id: Date.now().toString(), word: newWord.trim() }]);
      setNewWord("");
    } catch { /* silent */ }
  };

  const removeWord = async (wordId: string) => {
    try {
      await streamsApi.removeBannedWord(streamId, wordId);
      setWords(prev => prev.filter(w => String(w.id) !== String(wordId)));
    } catch { /* silent */ }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" dir={dir}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[32px] p-6 border-t border-white/10 max-h-[60vh]">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full" />
        <h3 className="text-white font-bold text-base mt-4 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          {t("live.moderation", "إدارة الدردشة")}
        </h3>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("words")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${tab === "words" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-white/40"}`}>
            <Ban className="w-3 h-3 inline mr-1" />{t("live.bannedWords", "كلمات محظورة")}
          </button>
        </div>

        {tab === "words" && (
          <div>
            <div className="flex gap-2 mb-3">
              <input value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWord()}
                placeholder={t("live.addBannedWord", "أضف كلمة محظورة...")}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/20" />
              <button onClick={addWord} className="bg-red-500/20 text-red-400 px-3 rounded-lg text-xs font-bold border border-red-500/30">
                {t("common.add", "إضافة")}
              </button>
            </div>
            <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-white/20 animate-spin" /></div>
              ) : words.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-4">{t("live.noBannedWords", "لا توجد كلمات محظورة")}</p>
              ) : words.map(w => (
                <div key={w.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-white/70 text-xs">{w.word}</span>
                  <button onClick={() => removeWord(String(w.id))} className="text-red-400/60 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Video Stream View (full-screen video broadcast viewer)
// ══════════════════════════════════════════════════════════

function VideoStreamView({ stream, onClose }: { stream: StreamItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [inputValue, setInputValue] = useState('');
  const [hearts, setHearts] = useState<{id: number; x: number}[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<string | null>(null);
  const [activePoll, setActivePoll] = useState<any>(null);
  const [quality, setQuality] = useState("high");
  const [giftAnimations, setGiftAnimations] = useState<{ id: number; name: string; image: string; sender: string }[]>([]);
  const [isPiP, setIsPiP] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const conn = useConnectionQuality();
  const MAX_MESSAGES = conn.quality === 'poor' ? 25 : 50;
  const [lkState, setLkState] = useState<StreamState>('idle');
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize LiveKit video connection
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const res = await authApi.me();
        const userId = res?.data?.id || '';
        if (cancelled) return;
        setCurrentUserId(userId);
        setCurrentUserName(res?.data?.displayName || res?.data?.username || '');
        const hostMode = !!(userId && stream.userId && userId === stream.userId);
        setIsHost(hostMode);

        setLkState('connecting');
        const tokenRes = await streamsApi.token(stream.id);
        if (cancelled) return;
        const { token, wsUrl, role } = tokenRes;
        if (!token || !wsUrl) { setLkState('failed'); return; }

        await livekitStreamManager.connect(wsUrl, token, role as StreamRole, {
          onStateChange: (state: StreamState) => { if (!cancelled) setLkState(state); },
          onActiveSpeakersChanged: () => {},
          onError: () => { if (!cancelled) setLkState('failed'); },
          onRemoteVideoTrack: (track: MediaStreamTrack) => {
            if (videoRef.current) {
              videoRef.current.srcObject = new MediaStream([track]);
              videoRef.current.play().catch(() => {});
            }
          },
          onLocalVideoTrack: (track: MediaStreamTrack) => {
            if (videoRef.current) {
              videoRef.current.srcObject = new MediaStream([track]);
              videoRef.current.play().catch(() => {});
            }
          },
        }, { publishVideo: hostMode, publishAudio: hostMode });
      } catch { if (!cancelled) setLkState('failed'); }
    };
    init();
    // Fetch pinned message & active poll
    streamsApi.detail(stream.id).then((d: any) => { if (d?.pinnedMessage) setPinnedMessage(d.pinnedMessage); }).catch(() => {});
    streamsApi.getActivePoll(stream.id).then((p: any) => { if (p?.id) setActivePoll(p); }).catch(() => {});

    return () => { cancelled = true; livekitStreamManager.disconnect(); };
  }, [stream.id, stream.userId]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join-room', stream.id);

    const handleChat = (data: any) => {
      if (!data?.message) return;
      const colors = ['text-blue-400', 'text-pink-400', 'text-green-400', 'text-orange-400', 'text-cyan-400'];
      setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), {
        id: data.id || Date.now(), type: 'message',
        user: data.user ? { ...data.user, avatar: data.user.avatar || avatarImg, level: data.user.level || 1 } : { id: 'unknown', name: 'مجهول', avatar: avatarImg, level: 1 },
        text: data.message, color: colors[Math.floor(Math.random() * colors.length)], timestamp: data.ts || Date.now(),
      }]);
    };

    const handleGiftReceived = (data: any) => {
      if (data?.streamId === stream.id || data?.roomId === stream.id) {
        setGiftAnimations(prev => [...prev, { id: Date.now(), name: data.giftName || 'هدية', image: data.giftImage || giftImg, sender: data.senderName || '' }]);
      }
    };

    const handlePinned = (data: any) => {
      if (data?.streamId === stream.id) setPinnedMessage(data.message || null);
    };

    const handlePollUpdate = (data: any) => {
      if (data?.streamId === stream.id) setActivePoll(data.poll || null);
    };

    socket.on('chat-message', handleChat);
    socket.on('gift-received', handleGiftReceived);
    socket.on('stream-pinned', handlePinned);
    socket.on('stream-poll-update', handlePollUpdate);

    return () => {
      socket.emit('leave-room', stream.id);
      socket.off('chat-message', handleChat);
      socket.off('gift-received', handleGiftReceived);
      socket.off('stream-pinned', handlePinned);
      socket.off('stream-poll-update', handlePollUpdate);
    };
  }, []);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    socketManager.emit('chat-message', {
      roomId: stream.id, message: inputValue.trim(),
      user: { id: currentUserId || 'me', name: currentUserName || t('live.you', 'أنت') },
    });
    setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), {
      id: Date.now(), type: 'message',
      user: { id: currentUserId || 'me', name: currentUserName || t('live.you', 'أنت'), avatar: avatarImg, level: 10 },
      text: inputValue, color: 'text-primary', timestamp: Date.now(),
    }]);
    setInputValue('');
  };

  const addHeart = () => {
    const id = Date.now();
    setHearts(prev => [...prev, { id, x: Math.random() * 100 }]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2000);
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch { /* PiP not supported */ }
  };

  const toggleScreenShare = async () => {
    try {
      if (screenSharing) {
        await livekitStreamManager.setScreenShareEnabled?.(false);
        setScreenSharing(false);
      } else {
        await livekitStreamManager.setScreenShareEnabled?.(true);
        setScreenSharing(true);
      }
    } catch { /* silent */ }
  };

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        await streamsApi.stopRecording(stream.id);
        setIsRecording(false);
      } else {
        await streamsApi.startRecording(stream.id);
        setIsRecording(true);
      }
    } catch { /* silent */ }
  };

  const handlePinMessage = async () => {
    const msg = prompt(t("live.enterPinMessage", "أدخل الرسالة المثبتة:"));
    if (msg?.trim()) {
      try {
        await streamsApi.pin(stream.id, msg.trim());
        setPinnedMessage(msg.trim());
      } catch { /* silent */ }
    }
  };

  const handleUnpin = async () => {
    try {
      await streamsApi.unpin(stream.id);
      setPinnedMessage(null);
    } catch { /* silent */ }
  };

  const handleCreatePoll = async (question: string, options: string[]) => {
    try {
      const res = await streamsApi.createPoll(stream.id, question, options);
      setActivePoll(res);
      setShowCreatePoll(false);
    } catch { /* silent */ }
  };

  const handleVotePoll = async (pollId: string, option: string) => {
    try {
      const res = await streamsApi.votePoll(stream.id, pollId, option);
      setActivePoll(res);
    } catch { /* silent */ }
  };

  const handleEndPoll = async (pollId: string) => {
    try {
      await streamsApi.endPoll(stream.id, pollId);
      setActivePoll(null);
    } catch { /* silent */ }
  };

  const handleMuteUser = async (userId: string) => {
    try {
      await streamsApi.muteUser(stream.id, userId);
    } catch { /* silent */ }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden" dir={dir}>
      {/* Video */}
      <video ref={videoRef} autoPlay playsInline muted={isHost} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      {/* Gift Animation */}
      <GiftAnimationOverlay gifts={giftAnimations} onDone={id => setGiftAnimations(prev => prev.filter(g => g.id !== id))} />

      {/* Top Bar */}
      <div className="relative z-30 px-4 pt-[env(safe-area-inset-top,12px)] flex justify-between items-start">
        <div className="flex flex-col gap-1.5 pt-2">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full pr-3 p-1 border border-white/10">
            <div className="relative">
              <img src={stream.avatar || avatarImg} className="w-9 h-9 rounded-full border border-blue-500" alt="Host" />
            </div>
            <div>
              <p className="text-white text-xs font-bold leading-tight">{stream.host}</p>
              <div className="flex items-center gap-1 text-white/70 text-[10px]">
                <Eye className="w-2.5 h-2.5" /><span>{stream.viewers}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{t("common.live")}
            </span>
            {isRecording && (
              <span className="bg-red-600/20 text-red-300 border border-red-600/30 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md flex items-center gap-1 animate-pulse">
                <Circle className="w-2 h-2 fill-red-500" />REC
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          {/* PiP */}
          <button onClick={togglePiP} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <PictureInPicture2 className={`w-4 h-4 ${isPiP ? 'text-primary' : 'text-white'}`} />
          </button>
          <button className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <Share2 className="w-4 h-4 text-white" />
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-destructive/70 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="relative z-20 px-4 mt-3">
        <h2 className="text-white font-bold text-base">{stream.title}</h2>
        {stream.tags?.length > 0 && (
          <div className="flex gap-1 mt-1">
            {stream.tags.map(tag => (
              <span key={tag} className="text-[10px] bg-blue-500/10 text-blue-400/70 px-2 py-0.5 rounded-full border border-blue-500/15">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Pinned Message */}
      <div className="relative z-20 mt-2">
        <AnimatePresence>
          <PinnedMessageBanner message={pinnedMessage} isHost={isHost} onUnpin={handleUnpin} />
        </AnimatePresence>
      </div>

      {/* Poll */}
      <div className="relative z-20">
        <AnimatePresence>
          <PollWidget poll={activePoll} onVote={handleVotePoll} onEnd={handleEndPoll} isHost={isHost} />
        </AnimatePresence>
      </div>

      {/* Chat Area */}
      <div className="absolute bottom-[72px] left-0 right-16 max-h-[30vh] z-20 flex flex-col justify-end px-3">
        <div className="overflow-y-auto no-scrollbar space-y-1 mask-fade-top">
          {messages.map(msg => (
            <LiveChatMsg key={msg.id} msg={msg} />
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-3 z-30">
        {/* Connection */}
        {(lkState === 'connecting' || lkState === 'reconnecting') && (
          <div className="w-11 h-11 rounded-full bg-yellow-500/20 backdrop-blur-md flex items-center justify-center border border-yellow-500/30">
            <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
          </div>
        )}
        {lkState === 'failed' && (
          <div className="w-11 h-11 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center border border-red-500/30">
            <WifiOff className="w-5 h-5 text-red-400" />
          </div>
        )}
        {/* Host controls */}
        {isHost && (
          <>
            <button onClick={async () => { try { const m = await livekitStreamManager.toggleMicrophone(); setMicOn(!m); } catch { setMicOn(v => !v); } }}
              className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border ${micOn ? 'bg-emerald-500/30 border-emerald-500/40 text-emerald-400' : 'bg-destructive/50 border-destructive/40 text-white'}`}>
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </div>
            </button>
            <button onClick={async () => { try { await livekitStreamManager.toggleCamera?.(); setCamOn(v => !v); } catch { setCamOn(v => !v); } }}
              className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border ${camOn ? 'bg-blue-500/30 border-blue-500/40 text-blue-400' : 'bg-destructive/50 border-destructive/40 text-white'}`}>
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </div>
            </button>
            {/* Screen sharing */}
            <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border ${screenSharing ? 'bg-cyan-500/30 border-cyan-500/40 text-cyan-400' : 'bg-black/30 border-white/10 text-white/70'}`}>
                {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </div>
            </button>
            {/* Recording */}
            <button onClick={toggleRecording} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border ${isRecording ? 'bg-red-600/40 border-red-600/50 text-red-400 animate-pulse' : 'bg-black/30 border-white/10 text-white/70'}`}>
                {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-5 h-5" />}
              </div>
            </button>
            {/* Pin */}
            <button onClick={handlePinMessage} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Pin className="w-5 h-5 text-white/70" />
              </div>
            </button>
            {/* Poll */}
            <button onClick={() => setShowCreatePoll(true)} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Vote className="w-5 h-5 text-white/70" />
              </div>
            </button>
            {/* Stats */}
            <button onClick={() => setShowStats(true)} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <BarChart3 className="w-5 h-5 text-white/70" />
              </div>
            </button>
            {/* Moderation */}
            <button onClick={() => setShowModeration(true)} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Shield className="w-5 h-5 text-white/70" />
              </div>
            </button>
          </>
        )}
        {/* Viewer controls */}
        {!isHost && (
          <QualitySelector current={quality} onChange={setQuality} />
        )}
        <button onClick={addHeart} className="active:scale-90 transition-transform">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10">
            <Heart className="w-5 h-5 fill-current text-primary" />
          </div>
        </button>
        <button onClick={() => setShowGiftModal(true)} className="active:scale-90 transition-transform">
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
              placeholder={t("live.typeMessage")} className="w-full bg-white/10 backdrop-blur-md border border-white/15 rounded-full py-2.5 px-4 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/30" />
          </div>
          <button onClick={handleSend} className="w-10 h-10 shrink-0 rounded-full bg-blue-500/80 flex items-center justify-center hover:bg-blue-500 transition-colors">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGiftModal(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[32px] p-6 border-t border-white/10 max-h-[70vh] flex flex-col">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full" />
              <GiftModalContent streamId={stream.id} onClose={() => setShowGiftModal(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {showStats && <HostStatsModal streamId={stream.id} onClose={() => setShowStats(false)} />}
      </AnimatePresence>

      {/* Moderation Modal */}
      <AnimatePresence>
        {showModeration && <ModerationModal streamId={stream.id} onClose={() => setShowModeration(false)} />}
      </AnimatePresence>

      {/* Create Poll Modal */}
      <AnimatePresence>
        {showCreatePoll && <CreatePollModal onClose={() => setShowCreatePoll(false)} onCreate={handleCreatePoll} />}
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
  const [selectedAudioRoom, setSelectedAudioRoom] = useState<StreamItem | null>(null);
  const [selectedVideoStream, setSelectedVideoStream] = useState<StreamItem | null>(null);
  const [videoStreams, setVideoStreams] = useState<StreamItem[]>([]);
  const [audioStreams, setAudioStreams] = useState<StreamItem[]>([]);
  const [scheduledStreams, setScheduledStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState<"live" | "audio">("live");
  const [createTags, setCreateTags] = useState("");
  const [createCategory, setCreateCategory] = useState<string>("chat");
  const [createScheduledAt, setCreateScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StreamItem[] | null>(null);
  const [followNotif, setFollowNotif] = useState<{ host: string; title: string; streamId: string } | null>(null);

  const categoryLabels: Record<string, string> = {
    all: t("live.catAll", "الكل"),
    chat: t("live.catChat", "دردشة"),
    gaming: t("live.catGaming", "ألعاب"),
    music: t("live.catMusic", "موسيقى"),
    education: t("live.catEducation", "تعليم"),
    sports: t("live.catSports", "رياضة"),
    cooking: t("live.catCooking", "طبخ"),
    art: t("live.catArt", "فن"),
    other: t("live.catOther", "أخرى"),
  };

  const parseStream = (s: any): StreamItem => ({
    id: String(s.id),
    userId: s.userId || undefined,
    type: s.type || 'video',
    host: s.hostName || s.host || 'مجهول',
    username: s.hostUsername || '',
    avatar: s.hostAvatar || null,
    viewers: s.viewerCount || s.viewers || 0,
    viewerCount: s.viewerCount || s.viewers || 0,
    title: s.title || '',
    tags: s.tags || [],
    isLive: true,
    level: s.hostLevel || 1,
    speakers: s.speakers || [],
    maxSpeakers: s.maxSpeakers || 4,
    status: s.status || 'live',
  });

  // Fetch active streams (with optional category filter)
  const fetchStreams = useCallback((category?: string) => {
    setLoading(true);
    const cat = category && category !== 'all' ? category : undefined;
    streamsApi.active(cat)
      .then((streams: any[]) => {
        const vids: StreamItem[] = [];
        const auds: StreamItem[] = [];
        for (const s of streams) {
          const item = parseStream(s);
          if (item.type === 'audio') auds.push(item);
          else vids.push(item);
        }
        setVideoStreams(vids);
        setAudioStreams(auds);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStreams(selectedCategory);
  }, [selectedCategory, fetchStreams]);

  // Fetch scheduled streams
  useEffect(() => {
    streamsApi.scheduled()
      .then((data: any[]) => setScheduledStreams(data.map(parseStream)))
      .catch(() => {});
  }, []);

  // Follow notification listener (stream-started socket event)
  useEffect(() => {
    const socket = getSocket();
    const handleStreamStarted = (data: any) => {
      if (data?.hostName && data?.title) {
        setFollowNotif({ host: data.hostName, title: data.title, streamId: String(data.streamId || data.id) });
        setTimeout(() => setFollowNotif(null), 6000);
      }
    };
    socket.on('stream-started', handleStreamStarted);
    return () => { socket.off('stream-started', handleStreamStarted); };
  }, []);

  // Search handler
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults(null); return; }
    try {
      const data = await streamsApi.search(q.trim());
      setSearchResults(data.map(parseStream));
    } catch { setSearchResults([]); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleCreateStream = async () => {
    if (!createTitle.trim() || creating) return;
    setCreating(true);
    try {
      const tags = createTags.split(",").map(t => t.trim()).filter(Boolean);
      const createData: any = { title: createTitle.trim(), type: createType, tags, category: createCategory };
      if (createScheduledAt) createData.scheduledAt = new Date(createScheduledAt).toISOString();
      const res = await streamsApi.create(createData);
      if (res?.id) {
        setShowCreateModal(false);
        setCreateTitle("");
        setCreateTags("");
        setCreateScheduledAt("");
        if (createScheduledAt) {
          // Scheduled stream — refresh scheduled list
          streamsApi.scheduled().then((data: any[]) => setScheduledStreams(data.map(parseStream))).catch(() => {});
        } else if (createType === "audio") {
          const item = parseStream({ ...res, type: "audio" });
          setSelectedAudioRoom(item);
        } else {
          const item = parseStream({ ...res, type: "live" });
          setSelectedVideoStream(item);
        }
      }
    } catch { /* silent */ } finally {
      setCreating(false);
    }
  };

  // If audio room is selected, show full-screen audio room
  if (selectedAudioRoom) {
    return <AudioRoomView stream={selectedAudioRoom} onClose={() => setSelectedAudioRoom(null)} />;
  }

  // If video stream is selected, show full-screen video stream view
  if (selectedVideoStream) {
    return <VideoStreamView stream={selectedVideoStream} onClose={() => setSelectedVideoStream(null)} />;
  }

  const displayStreams = searchResults !== null;
  const filteredVideo = displayStreams ? searchResults.filter(s => s.type !== 'audio') : videoStreams;
  const filteredAudio = displayStreams ? searchResults.filter(s => s.type === 'audio') : audioStreams;

  return (
    <div className="py-6 space-y-6" dir={dir}>
      {/* Follow Notification Toast */}
      <AnimatePresence>
        {followNotif && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -50, x: "-50%" }}
            className="fixed top-6 left-1/2 z-[200] bg-primary/20 backdrop-blur-xl border border-primary/40 rounded-2xl px-5 py-3 shadow-[0_0_30px_rgba(168,85,247,0.3)] cursor-pointer"
            onClick={() => {
              if (followNotif.streamId) {
                const s = videoStreams.find(v => v.id === followNotif.streamId) || audioStreams.find(a => a.id === followNotif.streamId);
                if (s) {
                  if (s.type === 'audio') setSelectedAudioRoom(s);
                  else setSelectedVideoStream(s);
                }
              }
              setFollowNotif(null);
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">{followNotif.host} {t("live.startedStreaming", "بدأ البث!")}</p>
                <p className="text-white/60 text-xs">{followNotif.title}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            {videoStreams.length + audioStreams.length} {t("live.liveNow")}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t("live.searchStreams", "ابحث عن بث...")}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 rtl:pr-10 rtl:pl-4 pr-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/20"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="absolute right-3 rtl:left-3 rtl:right-auto top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {["all", ...STREAM_CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
              selectedCategory === cat
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
            }`}
          >
            {categoryLabels[cat] || cat}
          </button>
        ))}
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
            {filteredVideo.length}
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
            {filteredAudio.length}
          </span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Content */}
      {!loading && (
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
                {filteredVideo.map(stream => (
                  <VideoStreamCard
                    key={stream.id}
                    stream={stream}
                    onClick={() => setSelectedVideoStream(stream)}
                  />
                ))}
              </div>

              {filteredVideo.length === 0 && (
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
                {filteredAudio.map(stream => (
                  <AudioStreamCard
                    key={stream.id}
                    stream={stream}
                    onClick={() => setSelectedAudioRoom(stream)}
                  />
                ))}
              </div>

              {filteredAudio.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Headphones className="w-16 h-16 text-white/10 mb-4" />
                  <p className="text-white/30 text-sm">{t("live.noAudioStreams")}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Scheduled Streams Section */}
      {scheduledStreams.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-yellow-400" />
            {t("live.scheduledStreams", "بثوث مجدولة")}
          </h2>
          <div className="space-y-2">
            {scheduledStreams.map(stream => (
              <div key={stream.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-yellow-500/30 overflow-hidden bg-yellow-500/10 shrink-0">
                  <img src={stream.avatar || avatarImg} alt={stream.host} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{stream.title}</p>
                  <p className="text-white/40 text-[10px]">{stream.host}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-yellow-500/20">
                  <Clock className="w-3 h-3" />
                  {t("live.upcoming", "قريباً")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Go Live Floating Button */}
      <motion.button
        onClick={() => setShowCreateModal(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-red-500 to-primary flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] transition-shadow"
      >
        <Plus className="w-7 h-7 text-white" />
      </motion.button>

      {/* Create Stream Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-t-[32px] p-6 border-t border-white/10 max-h-[85vh] overflow-y-auto"
              dir={dir}
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full" />

              <h3 className="text-xl font-black text-white flex items-center gap-2 mt-4 mb-6">
                <Radio className="w-5 h-5 text-red-400" />
                {t("live.goLive", "بدء البث المباشر")}
              </h3>

              {/* Stream Type Selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setCreateType("live")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                    createType === "live"
                      ? "bg-gradient-to-r from-blue-500/20 to-primary/20 text-white border border-blue-500/30"
                      : "text-white/40 bg-white/5 border border-white/5"
                  }`}
                >
                  <Video className="w-4 h-4" />
                  {t("live.videoLive", "بث فيديو")}
                </button>
                <button
                  onClick={() => setCreateType("audio")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                    createType === "audio"
                      ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30"
                      : "text-white/40 bg-white/5 border border-white/5"
                  }`}
                >
                  <Headphones className="w-4 h-4" />
                  {t("live.audioLive", "غرفة صوتية")}
                </button>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="text-white/60 text-xs font-bold mb-1.5 block">{t("live.streamTitle", "عنوان البث")}</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder={t("live.streamTitlePlaceholder", "اكتب عنوان البث...")}
                  maxLength={200}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/20"
                />
              </div>

              {/* Category Selector */}
              <div className="mb-4">
                <label className="text-white/60 text-xs font-bold mb-1.5 block">{t("live.category", "التصنيف")}</label>
                <div className="flex flex-wrap gap-2">
                  {STREAM_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCreateCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        createCategory === cat
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-white/5 text-white/40 border-white/5"
                      }`}
                    >
                      {categoryLabels[cat] || cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="mb-4">
                <label className="text-white/60 text-xs font-bold mb-1.5 block">{t("live.streamTags", "الوسوم (اختياري)")}</label>
                <input
                  type="text"
                  value={createTags}
                  onChange={e => setCreateTags(e.target.value)}
                  placeholder={t("live.streamTagsPlaceholder", "دردشة, ألعاب, موسيقى")}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/20"
                />
              </div>

              {/* Schedule (optional) */}
              <div className="mb-6">
                <label className="text-white/60 text-xs font-bold mb-1.5 block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {t("live.scheduleStream", "جدولة البث (اختياري)")}
                </label>
                <input
                  type="datetime-local"
                  value={createScheduledAt}
                  onChange={e => setCreateScheduledAt(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
                />
                {createScheduledAt && (
                  <button onClick={() => setCreateScheduledAt("")} className="text-white/40 text-[10px] mt-1 hover:text-white/60">
                    {t("live.clearSchedule", "× إلغاء الجدولة")}
                  </button>
                )}
              </div>

              {/* Start Button */}
              <button
                onClick={handleCreateStream}
                disabled={!createTitle.trim() || creating}
                className="w-full py-4 rounded-2xl font-black text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-red-500 to-primary shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] flex items-center justify-center gap-2"
              >
                {creating ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : createScheduledAt ? (
                  <>
                    <Calendar className="w-5 h-5" />
                    {t("live.scheduleBtn", "جدولة البث")}
                  </>
                ) : (
                  <>
                    <Radio className="w-5 h-5" />
                    {t("live.startStream", "بدء البث")}
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
