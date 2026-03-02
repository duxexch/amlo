import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, User, Bell, Shield, LogOut, Camera, ShieldCheck, ChevronDown,
  Copy, Share2, Users, Gift, Clock, Heart, Star, Check, X, Eye, EyeOff,
  Smartphone, Mail, Globe, Calendar, MapPin, Link2, Key,
  Monitor, Trash2, Download, Palette, MessageSquare, Phone,
  Crown, Award, Zap, Pencil, Lock, Plus, RefreshCw
} from "lucide-react";
import avatarImg from "@/assets/images/avatar-3d.png";
import coinImg from "@/assets/images/coin-3d.png";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { profileApi } from "@/lib/authApi";
import { PinSetup } from "@/pages/PinSetup";

// Mock user data
const mockUser = {
  id: "USR-001",
  name: "فارس البطل",
  username: "fares_hero",
  email: "fares@example.com",
  phone: "+966 55 123 4567",
  bio: "عاشق للتكنولوجيا والدردشة الصوتية. انضم إلي في غرفتي الخاصة كل يوم سبت!",
  gender: "male",
  country: "SA",
  birthday: "1998-03-15",
  avatar: avatarImg,
  level: 24,
  xp: 7500,
  xpNext: 10000,
  isVerified: true,
  isVip: true,
  vipLevel: "gold",
  coins: 1250,
  stats: {
    followers: 4200,
    following: 312,
    giftsReceived: 856,
    giftsSent: 234,
    streamHours: 128,
    friends: 89,
  },
  referral: {
    code: "FARES2024",
    link: "https://ablox.app/ref/FARES2024",
    invited: 23,
    earnings: 450,
  },
  linkedAccounts: {
    google: { connected: true, email: "fares@gmail.com" },
    facebook: { connected: false, email: "" },
    apple: { connected: true, email: "fares@icloud.com" },
    twitter: { connected: false, email: "" },
    tiktok: { connected: false, email: "" },
    snapchat: { connected: false, email: "" },
    instagram: { connected: true, email: "@fares_hero" },
    github: { connected: false, email: "" },
  },
  notifications: {
    streams: true,
    calls: true,
    messages: true,
    gifts: true,
    followers: true,
    promotions: false,
    sounds: true,
    vibration: true,
  },
  sessions: [
    { id: 1, device: "iPhone 15 Pro", location: "Riyadh, SA", lastActive: "now", current: true },
    { id: 2, device: "MacBook Pro", location: "Riyadh, SA", lastActive: "2h ago", current: false },
    { id: 3, device: "iPad Air", location: "Jeddah, SA", lastActive: "3d ago", current: false },
  ],
  joinDate: "2024-01-15",
};

const countries = [
  { code: "SA", name: "السعودية", flag: "🇸🇦" },
  { code: "AE", name: "الإمارات", flag: "🇦🇪" },
  { code: "EG", name: "مصر", flag: "🇪🇬" },
  { code: "KW", name: "الكويت", flag: "🇰🇼" },
  { code: "QA", name: "قطر", flag: "🇶🇦" },
  { code: "BH", name: "البحرين", flag: "🇧🇭" },
  { code: "OM", name: "عمان", flag: "🇴🇲" },
  { code: "JO", name: "الأردن", flag: "🇯🇴" },
  { code: "IQ", name: "العراق", flag: "🇮🇶" },
  { code: "LB", name: "لبنان", flag: "🇱🇧" },
  { code: "MA", name: "المغرب", flag: "🇲🇦" },
  { code: "TN", name: "تونس", flag: "🇹🇳" },
  { code: "DZ", name: "الجزائر", flag: "🇩🇿" },
  { code: "TR", name: "تركيا", flag: "🇹🇷" },
  { code: "US", name: "أمريكا", flag: "🇺🇸" },
  { code: "GB", name: "بريطانيا", flag: "🇬🇧" },
  { code: "FR", name: "فرنسا", flag: "🇫🇷" },
  { code: "DE", name: "ألمانيا", flag: "🇩🇪" },
];

const vipBadges: Record<string, { color: string; icon: typeof Crown; label: string }> = {
  diamond: { color: "from-cyan-400 to-blue-500", icon: Crown, label: "Diamond" },
  gold: { color: "from-yellow-400 to-amber-500", icon: Award, label: "Gold" },
  silver: { color: "from-gray-300 to-gray-400", icon: Star, label: "Silver" },
  bronze: { color: "from-orange-400 to-orange-600", icon: Zap, label: "Bronze" },
};

const socialProviders = [
  { key: "google", name: "Google", color: "#EA4335", icon: "G" },
  { key: "facebook", name: "Facebook", color: "#1877F2", icon: "f" },
  { key: "apple", name: "Apple", color: "#FFFFFF", icon: "" },
  { key: "twitter", name: "X (Twitter)", color: "#1DA1F2", icon: "𝕏" },
  { key: "tiktok", name: "TikTok", color: "#00F2EA", icon: "♪" },
  { key: "snapchat", name: "Snapchat", color: "#FFFC00", icon: "👻" },
  { key: "instagram", name: "Instagram", color: "#E4405F", icon: "📷" },
  { key: "github", name: "GitHub", color: "#FFFFFF", icon: "⚡" },
];

function SectionToggle({ label, desc, enabled, onChange }: { label: string; desc?: string; enabled: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1">
        <p className="text-white font-medium text-sm">{label}</p>
        {desc && <p className="text-white/40 text-xs mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={onChange}
        className={`relative w-12 h-7 rounded-full transition-all duration-300 ${enabled ? 'bg-primary' : 'bg-white/10'}`}
      >
        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${enabled ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

function ExpandableSection({ icon: Icon, title, desc, children, defaultOpen = false, danger = false }: {
  icon: any; title: string; desc: string; children: React.ReactNode; defaultOpen?: boolean; danger?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div layout className={`glass rounded-3xl border ${danger ? 'border-destructive/20' : 'border-white/5'} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 flex items-center gap-4 hover:bg-white/5 transition-all"
      >
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${danger ? 'bg-destructive/10 border-destructive/20' : 'bg-primary/10 border-primary/20'}`}>
          <Icon className={`w-5 h-5 ${danger ? 'text-destructive' : 'text-primary'}`} />
        </div>
        <div className="flex-1 text-right">
          <p className={`text-base font-bold ${danger ? 'text-destructive' : 'text-white'}`}>{title}</p>
          <p className={`text-xs ${danger ? 'text-destructive/50' : 'text-white/40'}`}>{desc}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-white/30 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/5 pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Profile() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState(mockUser);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [notifications, setNotifications] = useState(user.notifications);
  const [saving, setSaving] = useState(false);

  // PIN management state
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [showPinSetup, setShowPinSetup] = useState<number | null>(null); // profileIndex to create
  const [changingPin, setChangingPin] = useState<number | null>(null);
  const [changePinForm, setChangePinForm] = useState({ current: "", newPin: "", confirm: "" });
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [changePinLoading, setChangePinLoading] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<number | null>(null);

  // Load profiles on mount
  useEffect(() => {
    (async () => {
      setLoadingProfiles(true);
      try {
        const res = await profileApi.getProfiles();
        setProfiles(res.data || []);
      } catch {
        setProfiles([]);
      } finally {
        setLoadingProfiles(false);
      }
    })();
  }, []);

  const handleChangePin = async (profileIndex: number) => {
    if (!/^\d{4}$/.test(changePinForm.newPin)) {
      setChangePinError(t("pinSetup.pinExact4", "رمز PIN يجب أن يكون 4 أرقام بالضبط"));
      return;
    }
    if (changePinForm.newPin !== changePinForm.confirm) {
      setChangePinError(t("pinSetup.pinMismatch", "رمز PIN غير متطابق"));
      return;
    }
    setChangePinLoading(true);
    setChangePinError(null);
    try {
      await profileApi.changePin(profileIndex, changePinForm.current, changePinForm.newPin);
      setChangingPin(null);
      setChangePinForm({ current: "", newPin: "", confirm: "" });
    } catch (err: any) {
      setChangePinError(err?.message || t("pinSetup.error", "حدث خطأ"));
    } finally {
      setChangePinLoading(false);
    }
  };

  const handleDeleteProfile = async (index: number) => {
    setDeletingProfile(index);
    try {
      await profileApi.deleteProfile(index);
      setProfiles(prev => prev.filter(p => p.profileIndex !== index));
    } catch (err: any) {
      alert(err?.message || t("pinSetup.error", "حدث خطأ"));
    } finally {
      setDeletingProfile(null);
    }
  };

  const handlePinSetupSuccess = async () => {
    setShowPinSetup(null);
    try {
      const res = await profileApi.getProfiles();
      setProfiles(res.data || []);
    } catch {}
  };

  const startEdit = (field: string, value: string) => {
    setEditing(field);
    setEditValues({ ...editValues, [field]: value });
  };
  const saveEdit = (field: string) => {
    setSaving(true);
    setTimeout(() => {
      setUser({ ...user, [field]: editValues[field] || (user as any)[field] });
      setEditing(null);
      setSaving(false);
    }, 500);
  };
  const cancelEdit = () => setEditing(null);
  const copyReferral = () => {
    navigator.clipboard.writeText(user.referral.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications({ ...notifications, [key]: !notifications[key] });
  };

  const vipBadge = vipBadges[user.vipLevel];
  const levelProgress = (user.xp / user.xpNext) * 100;
  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  // Inline editable field helper
  const EditableField = ({ field, value, icon: FieldIcon, label, dir: fieldDir }: { field: string; value: string; icon: any; label: string; dir?: string }) => (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FieldIcon className="w-4 h-4 text-white/30 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{label}</p>
          {editing === field ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                value={editValues[field] ?? value}
                onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
                className="bg-white/5 border border-primary/30 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary w-full"
                dir={fieldDir || undefined}
                autoFocus
              />
              <button onClick={() => saveEdit(field)} className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center hover:bg-primary/30">
                <Check className="w-4 h-4 text-primary" />
              </button>
              <button onClick={cancelEdit} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>
          ) : (
            <p className="text-white font-medium text-sm truncate" dir={fieldDir || undefined}>{value}</p>
          )}
        </div>
      </div>
      {editing !== field && (
        <button onClick={() => startEdit(field, value)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/5">
          <Pencil className="w-3.5 h-3.5 text-white/30" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-black text-white" style={{ fontFamily: 'Outfit' }}>{t("profile.title")}</h1>
        <Link href="/auth">
          <button className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/10">
            <Settings className="w-5 h-5 text-white" />
          </button>
        </Link>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden border border-white/10"
      >
        <div className="absolute top-0 right-0 w-60 h-60 bg-primary/15 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-secondary/10 blur-[60px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center md:flex-row md:items-start gap-6">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-primary/50 neon-border">
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <button className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-primary flex items-center justify-center border-3 border-[#0d0d1e] text-white shadow-lg hover:scale-110 transition-transform">
              <Camera className="w-4 h-4" />
            </button>
            {user.isVip && vipBadge && (
              <div className={`absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br ${vipBadge.color} flex items-center justify-center shadow-lg border-2 border-[#0d0d1e]`}>
                <vipBadge.icon className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 text-center md:text-right space-y-3 min-w-0">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-black text-white truncate">{user.name}</h2>
                {user.isVerified && <ShieldCheck className="w-5 h-5 text-blue-400 fill-blue-400/20 shrink-0" />}
                {user.isVip && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${vipBadge?.color} text-white shrink-0`}>
                    {vipBadge?.label}
                  </span>
                )}
              </div>
              <p className="text-white/50 font-medium text-sm">@{user.username}</p>
            </div>
            {/* Level bar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">Lv.{user.level}</span>
              </div>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                />
              </div>
              <span className="text-[10px] text-white/40 font-medium">{user.xp.toLocaleString()}/{user.xpNext.toLocaleString()}</span>
            </div>
            {/* Quick stats */}
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <img src={coinImg} className="w-4 h-4" alt="Coins" />
                <span className="font-bold text-yellow-400 text-sm">{user.coins.toLocaleString()}</span>
              </div>
              <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white/50" />
                <span className="font-bold text-white text-sm">{formatNumber(user.stats.followers)}</span>
                <span className="text-white/40 text-xs">{t("profile.followers")}</span>
              </div>
              <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-white/50" />
                <span className="text-white/40 text-xs">{t("profile.memberSince")} {new Date(user.joinDate).toLocaleDateString('ar')}</span>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed max-w-md">{user.bio}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { icon: Users, label: t("profile.statFollowers"), value: formatNumber(user.stats.followers), color: "text-blue-400" },
          { icon: Heart, label: t("profile.statFollowing"), value: formatNumber(user.stats.following), color: "text-pink-400" },
          { icon: Gift, label: t("profile.statGiftsReceived"), value: formatNumber(user.stats.giftsReceived), color: "text-purple-400" },
          { icon: Gift, label: t("profile.statGiftsSent"), value: formatNumber(user.stats.giftsSent), color: "text-green-400" },
          { icon: Clock, label: t("profile.statStreamHours"), value: user.stats.streamHours + "h", color: "text-orange-400" },
          { icon: Users, label: t("profile.statFriends"), value: user.stats.friends.toString(), color: "text-cyan-400" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.05 }} className="glass p-3 rounded-2xl text-center border border-white/5">
            <stat.icon className={`w-5 h-5 mx-auto mb-1.5 ${stat.color}`} />
            <p className="text-lg font-black text-white">{stat.value}</p>
            <p className="text-[10px] text-white/40 font-medium">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Sections */}
      <div className="space-y-3">
        {/* Personal Info */}
        <ExpandableSection icon={User} title={t("profile.personalInfo")} desc={t("profile.personalInfoDesc")} defaultOpen>
          <div className="space-y-4">
            <EditableField field="name" value={user.name} icon={User} label={t("profile.fieldName")} />
            <div className="flex items-center gap-3">
              <span className="text-white/30 text-sm font-bold shrink-0">@</span>
              <div><p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{t("profile.fieldUsername")}</p><p className="text-white font-medium text-sm">@{user.username}</p></div>
            </div>
            <EditableField field="email" value={user.email} icon={Mail} label={t("profile.fieldEmail")} dir="ltr" />
            <EditableField field="phone" value={user.phone} icon={Phone} label={t("profile.fieldPhone")} dir="ltr" />
            {/* Bio */}
            <div className="flex items-start justify-between group">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <MessageSquare className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{t("profile.fieldBio")}</p>
                  {editing === "bio" ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <textarea value={editValues.bio ?? user.bio} onChange={(e) => setEditValues({ ...editValues, bio: e.target.value })} className="bg-white/5 border border-primary/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary w-full resize-none h-20" maxLength={200} autoFocus />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30">{(editValues.bio ?? user.bio).length}/200</span>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit("bio")} className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30"><Check className="w-3 h-3 inline mr-1" />{t("common.save")}</button>
                          <button onClick={cancelEdit} className="px-3 py-1 rounded-lg bg-white/5 text-white/50 text-xs font-bold hover:bg-white/10">{t("common.cancel")}</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/70 text-sm leading-relaxed">{user.bio}</p>
                  )}
                </div>
              </div>
              {editing !== "bio" && (
                <button onClick={() => startEdit("bio", user.bio)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/5"><Pencil className="w-3.5 h-3.5 text-white/30" /></button>
              )}
            </div>
            {/* Gender */}
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-white/30 shrink-0" />
              <div>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{t("profile.fieldGender")}</p>
                <select value={user.gender} onChange={(e) => setUser({ ...user, gender: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary mt-1 appearance-none cursor-pointer">
                  <option value="male" className="bg-[#1a1a2e] text-white">{t("profile.genderMale")}</option>
                  <option value="female" className="bg-[#1a1a2e] text-white">{t("profile.genderFemale")}</option>
                  <option value="other" className="bg-[#1a1a2e] text-white">{t("profile.genderOther")}</option>
                </select>
              </div>
            </div>
            {/* Country */}
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-white/30 shrink-0" />
              <div>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{t("profile.fieldCountry")}</p>
                <select value={user.country} onChange={(e) => setUser({ ...user, country: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary mt-1 appearance-none cursor-pointer">
                  {countries.map(c => (<option key={c.code} value={c.code} className="bg-[#1a1a2e] text-white">{c.flag} {c.name}</option>))}
                </select>
              </div>
            </div>
            {/* Birthday */}
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-white/30 shrink-0" />
              <div>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{t("profile.fieldBirthday")}</p>
                <input type="date" value={user.birthday} onChange={(e) => setUser({ ...user, birthday: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary mt-1" dir="ltr" />
              </div>
            </div>
          </div>
        </ExpandableSection>

        {/* Referral */}
        <ExpandableSection icon={Share2} title={t("profile.referral")} desc={t("profile.referralDesc")}>
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 font-bold mb-2">{t("profile.referralCode")}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 font-mono text-lg font-bold text-primary tracking-widest text-center" dir="ltr">{user.referral.code}</div>
                <button onClick={copyReferral} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${copied ? 'bg-green-500/20 border-green-500/30' : 'bg-primary/10 border-primary/20 hover:bg-primary/20'} border`}>
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-primary" />}
                </button>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 font-bold mb-2">{t("profile.referralLink")}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/60 truncate" dir="ltr">{user.referral.link}</div>
                <button onClick={copyReferral} className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all"><Share2 className="w-4 h-4 text-primary" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-2xl font-black text-white">{user.referral.invited}</p>
                <p className="text-[10px] text-white/40">{t("profile.referralInvited")}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <img src={coinImg} className="w-5 h-5 mx-auto mb-1" alt="Coins" />
                <p className="text-2xl font-black text-yellow-400">{user.referral.earnings}</p>
                <p className="text-[10px] text-white/40">{t("profile.referralEarnings")}</p>
              </div>
            </div>
          </div>
        </ExpandableSection>

        {/* Linked Accounts */}
        <ExpandableSection icon={Link2} title={t("profile.linkedAccounts")} desc={t("profile.linkedAccountsDesc")}>
          <div className="space-y-2">
            {socialProviders.map((provider) => {
              const account = (user.linkedAccounts as any)[provider.key];
              const isConnected = account?.connected;
              return (
                <div key={provider.key} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border border-white/10" style={{ backgroundColor: provider.color + "15", color: provider.color }}>{provider.icon}</div>
                    <div>
                      <p className="text-white font-medium text-sm">{provider.name}</p>
                      {isConnected && <p className="text-white/30 text-[10px]">{account.email}</p>}
                    </div>
                  </div>
                  <button className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${isConnected ? 'bg-white/5 border border-white/10 text-white/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20' : 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20'}`}>
                    {isConnected ? t("profile.disconnect") : t("profile.connect")}
                  </button>
                </div>
              );
            })}
          </div>
        </ExpandableSection>

        {/* Security */}
        <ExpandableSection icon={Shield} title={t("profile.security")} desc={t("profile.securityDesc")}>
          <div className="space-y-5">
            <div>
              <p className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Key className="w-4 h-4 text-primary" />{t("profile.changePassword")}</p>
              <div className="space-y-3">
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary" placeholder={t("profile.currentPassword")} dir="ltr" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2">{showPassword ? <EyeOff className="w-4 h-4 text-white/30" /> : <Eye className="w-4 h-4 text-white/30" />}</button>
                </div>
                <input type="password" value={passwordForm.new} onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary" placeholder={t("profile.newPassword")} dir="ltr" />
                <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary" placeholder={t("profile.confirmPassword")} dir="ltr" />
                <button className="w-full bg-primary/10 border border-primary/20 text-primary font-bold py-2.5 rounded-xl text-sm hover:bg-primary/20 transition-all">{t("profile.updatePassword")}</button>
              </div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <SectionToggle label={t("profile.twoFA")} desc={t("profile.twoFADesc")} enabled={twoFaEnabled} onChange={() => setTwoFaEnabled(!twoFaEnabled)} />
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Monitor className="w-4 h-4 text-primary" />{t("profile.activeSessions")}</p>
              <div className="space-y-2">
                {user.sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-white/40" />
                      <div>
                        <p className="text-white text-sm font-medium flex items-center gap-2">
                          {session.device}
                          {session.current && <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold border border-green-500/20">{t("profile.currentSession")}</span>}
                        </p>
                        <p className="text-white/30 text-[10px]">{session.location} · {session.lastActive}</p>
                      </div>
                    </div>
                    {!session.current && <button className="text-destructive text-xs font-bold hover:underline">{t("profile.endSession")}</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ExpandableSection>

        {/* PIN & Profiles Management */}
        <ExpandableSection icon={Lock} title={t("profile.pinProfiles", "رمز PIN والحسابات")} desc={t("profile.pinProfilesDesc", "إدارة رمز PIN والملفات الشخصية")}>
          <div className="space-y-4">
            {loadingProfiles ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : showPinSetup !== null ? (
              /* Embedded PinSetup form */
              <div className="border border-white/10 rounded-2xl p-4 bg-white/[0.02]">
                <PinSetup
                  profileIndex={showPinSetup}
                  isSecondProfile={showPinSetup === 2}
                  onSuccess={handlePinSetupSuccess}
                  onBack={() => setShowPinSetup(null)}
                />
              </div>
            ) : (
              <>
                {/* Existing profiles */}
                {profiles.map((profile) => (
                  <div key={profile.profileIndex} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                          profile.profileIndex === 1 ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                        }`}>
                          {profile.profileIndex}
                        </span>
                        <div>
                          <p className="text-white font-bold text-sm">{profile.displayName || t("profile.unnamed", "بدون اسم")}</p>
                          <p className="text-white/40 text-xs">{t("pinSetup.profileNum", "ملف شخصي")} #{profile.profileIndex}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setChangingPin(profile.profileIndex); setChangePinForm({ current: "", newPin: "", confirm: "" }); setChangePinError(null); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t("profile.changePin", "تغيير PIN")}
                        </button>
                        {/* Only allow deleting profile 2, or profile 1 if no profile 2 */}
                        {(profile.profileIndex === 2 || (profile.profileIndex === 1 && profiles.length === 1)) && (
                          <button
                            onClick={() => handleDeleteProfile(profile.profileIndex)}
                            disabled={deletingProfile === profile.profileIndex}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            {deletingProfile === profile.profileIndex ? (
                              <div className="w-3 h-3 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            {t("common.delete", "حذف")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Change PIN form */}
                    <AnimatePresence>
                      {changingPin === profile.profileIndex && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-white/10 pt-3 space-y-3">
                            {changePinError && (
                              <p className="text-destructive text-xs font-medium bg-destructive/10 px-3 py-2 rounded-lg">{changePinError}</p>
                            )}
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              value={changePinForm.current}
                              onChange={e => setChangePinForm({ ...changePinForm, current: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary text-center tracking-[0.3em]"
                              placeholder={t("profile.currentPin", "رمز PIN الحالي")}
                              dir="ltr"
                            />
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              value={changePinForm.newPin}
                              onChange={e => setChangePinForm({ ...changePinForm, newPin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary text-center tracking-[0.3em]"
                              placeholder={t("profile.newPin", "رمز PIN الجديد (4 أرقام)")}
                              dir="ltr"
                            />
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              value={changePinForm.confirm}
                              onChange={e => setChangePinForm({ ...changePinForm, confirm: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary text-center tracking-[0.3em]"
                              placeholder={t("profile.confirmNewPin", "تأكيد رمز PIN الجديد")}
                              dir="ltr"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleChangePin(profile.profileIndex)}
                                disabled={changePinLoading || changePinForm.current.length !== 4 || changePinForm.newPin.length !== 4 || changePinForm.confirm.length !== 4}
                                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
                              >
                                {changePinLoading ? t("common.saving", "جاري الحفظ...") : t("common.save", "حفظ")}
                              </button>
                              <button
                                onClick={() => { setChangingPin(null); setChangePinError(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 font-bold text-sm hover:bg-white/10 transition-all"
                              >
                                {t("common.cancel", "إلغاء")}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}

                {/* Create profile buttons */}
                {profiles.length === 0 && (
                  <button
                    onClick={() => setShowPinSetup(1)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-primary/10 border-2 border-dashed border-primary/30 text-primary font-bold hover:bg-primary/20 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    {t("profile.createPin", "إنشاء رمز PIN")}
                  </button>
                )}

                {profiles.length === 1 && (
                  <button
                    onClick={() => setShowPinSetup(2)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-purple-500/10 border-2 border-dashed border-purple-500/30 text-purple-400 font-bold hover:bg-purple-500/20 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    {t("profile.createSecondProfile", "إضافة حساب ثاني")}
                  </button>
                )}

                {profiles.length >= 1 && (
                  <p className="text-white/30 text-xs text-center">
                    {t("profile.pinHint", "يمكنك التبديل بين الحسابات بكتابة رمز PIN في مربع البحث في الأصدقاء")}
                  </p>
                )}
              </>
            )}
          </div>
        </ExpandableSection>

        {/* Notifications */}
        <ExpandableSection icon={Bell} title={t("profile.notifications")} desc={t("profile.notificationsDesc")}>
          <div className="space-y-1 divide-y divide-white/5">
            <SectionToggle label={t("profile.notifStreams")} desc={t("profile.notifStreamsDesc")} enabled={notifications.streams} onChange={() => toggleNotification("streams")} />
            <SectionToggle label={t("profile.notifCalls")} desc={t("profile.notifCallsDesc")} enabled={notifications.calls} onChange={() => toggleNotification("calls")} />
            <SectionToggle label={t("profile.notifMessages")} desc={t("profile.notifMessagesDesc")} enabled={notifications.messages} onChange={() => toggleNotification("messages")} />
            <SectionToggle label={t("profile.notifGifts")} desc={t("profile.notifGiftsDesc")} enabled={notifications.gifts} onChange={() => toggleNotification("gifts")} />
            <SectionToggle label={t("profile.notifFollowers")} desc={t("profile.notifFollowersDesc")} enabled={notifications.followers} onChange={() => toggleNotification("followers")} />
            <SectionToggle label={t("profile.notifPromos")} desc={t("profile.notifPromosDesc")} enabled={notifications.promotions} onChange={() => toggleNotification("promotions")} />
            <div className="border-t border-white/10 pt-2 mt-2">
              <SectionToggle label={t("profile.notifSounds")} enabled={notifications.sounds} onChange={() => toggleNotification("sounds")} />
              <SectionToggle label={t("profile.notifVibration")} enabled={notifications.vibration} onChange={() => toggleNotification("vibration")} />
            </div>
          </div>
        </ExpandableSection>

        {/* Account Settings */}
        <ExpandableSection icon={Settings} title={t("profile.accountSettings")} desc={t("profile.accountSettingsDesc")}>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><Download className="w-4 h-4 text-white/50" /><span className="text-white text-sm font-medium">{t("profile.downloadData")}</span></button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><Globe className="w-4 h-4 text-white/50" /><span className="text-white text-sm font-medium">{t("profile.changeLanguage")}</span></button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><Palette className="w-4 h-4 text-white/50" /><span className="text-white text-sm font-medium">{t("profile.changeTheme")}</span></button>
          </div>
        </ExpandableSection>

        {/* Logout */}
        <ExpandableSection icon={LogOut} title={t("common.logout")} desc={t("profile.logoutDesc")} danger>
          <div className="space-y-3">
            <p className="text-white/60 text-sm">{t("profile.logoutConfirm")}</p>
            <button className="w-full bg-destructive/10 border border-destructive/20 text-destructive font-bold py-3 rounded-xl text-sm hover:bg-destructive/20 transition-all">{t("common.logout")}</button>
          </div>
        </ExpandableSection>

        {/* Delete Account */}
        <ExpandableSection icon={Trash2} title={t("profile.deleteAccount")} desc={t("profile.deleteAccountDesc")} danger>
          <div className="space-y-3">
            <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4">
              <p className="text-destructive/80 text-sm leading-relaxed">{t("profile.deleteWarning")}</p>
            </div>
            <button className="w-full bg-destructive/10 border border-destructive/20 text-destructive font-bold py-3 rounded-xl text-sm hover:bg-destructive/20 transition-all">{t("profile.deleteAccountBtn")}</button>
          </div>
        </ExpandableSection>
      </div>
    </div>
  );
}