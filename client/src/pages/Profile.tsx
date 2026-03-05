import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, User, Bell, Shield, LogOut, Camera, ShieldCheck, ChevronDown,
  Copy, Share2, Users, Gift, Clock, Heart, Star, Check, X, Eye, EyeOff,
  Smartphone, Mail, Globe, Calendar, MapPin, Link2, Key,
  Monitor, Trash2, Download, Palette, MessageSquare, Phone,
  Crown, Award, Zap, Pencil, Lock, Plus, RefreshCw, Languages
} from "lucide-react";
import avatarImg from "@/assets/images/avatar-3d.png";
import coinImg from "@/assets/images/coin-3d.png";
import { useTranslation } from "react-i18next";
import { authApi, profileApi } from "@/lib/authApi";
import { PinSetup } from "@/pages/PinSetup";
import { useLocation } from "wouter";
import { LANGUAGES } from "@/i18n";
import { COUNTRIES } from "@/lib/countries";

// Default user shape (used before API data loads)
const defaultUser = {
  id: "",
  name: "",
  username: "",
  email: "",
  phone: "",
  bio: "",
  gender: "",
  country: "",
  birthday: "",
  avatar: avatarImg,
  level: 1,
  xp: 0,
  xpNext: 1000,
  isVerified: false,
  isVip: false,
  vipLevel: "",
  coins: 0,
  stats: { followers: 0, following: 0, giftsReceived: 0, giftsSent: 0, streamHours: 0, friends: 0 },
  referral: { code: "", link: "", invited: 0, earnings: 0 },
  linkedAccounts: {} as Record<string, { connected: boolean; email: string }>,
  notifications: { streams: true, calls: true, messages: true, gifts: true, followers: true, promotions: false, sounds: true, vibration: true },
  sessions: [] as { id: number; device: string; location: string; lastActive: string; current: boolean }[],
  joinDate: "",
};

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
  const [, navigate] = useLocation();
  const [user, setUser] = useState(defaultUser);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(defaultUser.notifications);
  const [saving, setSaving] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // PIN management state
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [showPinSetup, setShowPinSetup] = useState<number | null>(null);
  const [changingPin, setChangingPin] = useState<number | null>(null);
  const [changePinForm, setChangePinForm] = useState({ current: "", newPin: "", confirm: "" });
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [changePinLoading, setChangePinLoading] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<number | null>(null);

  // Load user data from API
  const loadUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      if (res.success && res.data) {
        const u = res.data.user || res.data;
        setUser({
          id: u.id || "",
          name: u.displayName || u.username || "",
          username: u.username || "",
          email: u.email || "",
          phone: u.phone || "",
          bio: u.bio || "",
          gender: u.gender || "",
          country: u.country || "",
          birthday: u.birthDate || "",
          avatar: u.avatar || avatarImg,
          level: u.level || 1,
          xp: u.xp || 0,
          xpNext: (u.level || 1) * 1000,
          isVerified: u.isVerified || false,
          isVip: false,
          vipLevel: "",
          coins: u.coins || 0,
          stats: { followers: 0, following: 0, giftsReceived: 0, giftsSent: 0, streamHours: 0, friends: 0 },
          referral: {
            code: u.referralCode || "",
            link: u.referralCode ? `${window.location.origin}/ref/${u.referralCode}` : "",
            invited: 0,
            earnings: 0,
          },
          linkedAccounts: {},
          notifications: defaultUser.notifications,
          sessions: [],
          joinDate: u.createdAt || "",
        });
        setTwoFaEnabled(!!u.twoFactorEnabled);
      }
    } catch {
      // Will show default empty state
    } finally {
      setLoading(false);
    }
  }, []);

  // Load notification preferences from API
  const loadNotifications = useCallback(async () => {
    try {
      const res = await authApi.getNotificationPreferences();
      if (res.success && res.data) {
        setNotifications({
          streams: res.data.streams ?? true,
          calls: res.data.calls ?? true,
          messages: res.data.messages ?? true,
          gifts: res.data.gifts ?? true,
          followers: res.data.friendRequests ?? true,
          promotions: res.data.marketing ?? false,
          sounds: true,
          vibration: true,
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadUser();
    loadNotifications();
  }, [loadUser, loadNotifications]);

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
  const saveEdit = async (field: string) => {
    setSaving(true);
    try {
      const fieldMap: Record<string, string> = {
        name: "displayName",
        email: "email",
        bio: "bio",
        gender: "gender",
        country: "country",
        birthday: "birthDate",
      };
      const apiField = fieldMap[field] || field;
      const value = editValues[field] || (user as any)[field];
      await profileApi.updateProfile(1, { [apiField]: value });
      setUser({ ...user, [field]: value });
      setEditing(null);
    } catch (err: any) {
      alert(err?.message || t("common.error", "حدث خطأ"));
    } finally {
      setSaving(false);
    }
  };
  const cancelEdit = () => setEditing(null);
  const copyReferral = () => {
    navigator.clipboard.writeText(user.referral.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const toggleNotification = async (key: keyof typeof notifications) => {
    const newValue = !notifications[key];
    setNotifications({ ...notifications, [key]: newValue });
    try {
      // Map frontend keys to backend keys
      const backendMap: Record<string, string> = {
        streams: "streams",
        calls: "calls",
        messages: "messages",
        gifts: "gifts",
        followers: "friendRequests",
        promotions: "marketing",
      };
      const backendKey = backendMap[key];
      if (backendKey) {
        await authApi.updateNotificationPreferences({ [backendKey]: newValue });
      }
    } catch {
      // Revert on error
      setNotifications({ ...notifications, [key]: !newValue });
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!passwordForm.current || !passwordForm.new) {
      setPasswordError(t("profile.fillAllFields", "يرجى ملء جميع الحقول"));
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordError(t("profile.passwordMin6", "كلمة المرور يجب أن تكون 6 أحرف على الأقل"));
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError(t("profile.passwordMismatch", "كلمة المرور غير متطابقة"));
      return;
    }
    setPasswordSaving(true);
    try {
      await authApi.changePassword(passwordForm.current, passwordForm.new);
      setPasswordForm({ current: "", new: "", confirm: "" });
      setPasswordError(null);
      alert(t("profile.passwordChanged", "تم تغيير كلمة المرور بنجاح"));
    } catch (err: any) {
      setPasswordError(err?.message || t("common.error", "حدث خطأ"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      navigate("/auth");
    } catch {
      navigate("/auth");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError(t("profile.enterPasswordToDelete", "يرجى إدخال كلمة المرور للتأكيد"));
      return;
    }
    setDeleting(true);
    try {
      await authApi.deleteAccount(deletePassword);
      navigate("/auth");
    } catch (err: any) {
      setDeleteError(err?.message || t("common.error", "حدث خطأ"));
    } finally {
      setDeleting(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-black text-white" style={{ fontFamily: 'Outfit' }}>{t("profile.title")}</h1>
        <button className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/10">
          <Settings className="w-5 h-5 text-white" />
        </button>
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
                <select value={user.gender} onChange={async (e) => { const v = e.target.value; setUser({ ...user, gender: v }); try { await profileApi.updateProfile(1, { gender: v }); } catch {} }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary mt-1 appearance-none cursor-pointer">
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
                <select value={user.country} onChange={async (e) => { const v = e.target.value; setUser({ ...user, country: v }); try { await profileApi.updateProfile(1, { country: v }); } catch {} }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary mt-1 appearance-none cursor-pointer">
                  {COUNTRIES.map(c => (<option key={c.code} value={c.code} className="bg-[#1a1a2e] text-white">{c.flag} {c.nameAr}</option>))}
                </select>
              </div>
            </div>
            {/* Birthday */}
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-white/30 shrink-0" />
              <div>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{t("profile.fieldBirthday")}</p>
                <input type="date" value={user.birthday} onChange={async (e) => { const v = e.target.value; setUser({ ...user, birthday: v }); try { await profileApi.updateProfile(1, { birthDate: v }); } catch {} }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary mt-1" dir="ltr" />
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
                {passwordError && <p className="text-destructive text-xs font-medium bg-destructive/10 px-3 py-2 rounded-lg">{passwordError}</p>}
                <button onClick={handleChangePassword} disabled={passwordSaving} className="w-full bg-primary/10 border border-primary/20 text-primary font-bold py-2.5 rounded-xl text-sm hover:bg-primary/20 transition-all disabled:opacity-50">
                  {passwordSaving ? t("common.saving", "جاري الحفظ...") : t("profile.updatePassword")}
                </button>
              </div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">{t("profile.twoFA", "المصادقة الثنائية")}</p>
                  <p className="text-white/40 text-xs mt-0.5">{t("profile.twoFADesc", "حماية إضافية عند تسجيل الدخول")}</p>
                </div>
                {twoFaEnabled ? (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-bold border border-green-500/20">{t("common.active", "مفعّل")}</span>
                ) : (
                  <span className="text-xs bg-white/10 text-white/40 px-2.5 py-1 rounded-full font-bold">{t("common.inactive", "معطّل")}</span>
                )}
              </div>

              {!twoFaEnabled && !twoFaSetup && (
                <button
                  onClick={async () => {
                    setTwoFaLoading(true); setTwoFaError(null);
                    try {
                      const res = await authApi.setup2FA();
                      setTwoFaSetup(res.data);
                    } catch (err: any) {
                      setTwoFaError(err?.message || "خطأ");
                    } finally { setTwoFaLoading(false); }
                  }}
                  disabled={twoFaLoading}
                  className="mt-3 w-full py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {twoFaLoading ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Shield className="w-4 h-4" />}
                  {t("profile.enable2FA", "تفعيل المصادقة الثنائية")}
                </button>
              )}

              {twoFaSetup && (
                <div className="mt-3 space-y-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <p className="text-white/60 text-xs mb-2">{t("profile.scanQR", "امسح هذا الرمز بتطبيق المصادقة (Google Authenticator)")}</p>
                    <div className="bg-white rounded-xl p-3 inline-block">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(twoFaSetup.otpauthUri)}`} alt="QR" className="w-[180px] h-[180px]" />
                    </div>
                    <p className="text-white/40 text-[10px] mt-2 font-mono break-all" dir="ltr">{twoFaSetup.secret}</p>
                  </div>
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[0.4em] font-mono px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    dir="ltr"
                  />
                  {twoFaError && <p className="text-destructive text-xs bg-destructive/10 px-3 py-2 rounded-lg">{twoFaError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (twoFaCode.length !== 6) return;
                        setTwoFaLoading(true); setTwoFaError(null);
                        try {
                          await authApi.verifySetup2FA(twoFaCode);
                          setTwoFaEnabled(true);
                          setTwoFaSetup(null);
                          setTwoFaCode("");
                        } catch (err: any) {
                          setTwoFaError(err?.message || "رمز غير صحيح");
                        } finally { setTwoFaLoading(false); }
                      }}
                      disabled={twoFaCode.length !== 6 || twoFaLoading}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {twoFaLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                      {t("profile.verify", "تحقق")}
                    </button>
                    <button onClick={() => { setTwoFaSetup(null); setTwoFaCode(""); setTwoFaError(null); }} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10">
                      {t("common.cancel", "إلغاء")}
                    </button>
                  </div>
                </div>
              )}

              {twoFaEnabled && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("profile.enterCodeToDisable", "أدخل الرمز لإلغاء التفعيل")}
                      className="flex-1 text-center font-mono px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-primary"
                      dir="ltr"
                    />
                    <button
                      onClick={async () => {
                        if (twoFaCode.length !== 6) return;
                        setTwoFaLoading(true); setTwoFaError(null);
                        try {
                          await authApi.disable2FA(twoFaCode);
                          setTwoFaEnabled(false);
                          setTwoFaCode("");
                        } catch (err: any) {
                          setTwoFaError(err?.message || "رمز غير صحيح");
                        } finally { setTwoFaLoading(false); }
                      }}
                      disabled={twoFaCode.length !== 6 || twoFaLoading}
                      className="px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-bold text-sm hover:bg-destructive/20 disabled:opacity-50"
                    >
                      {t("profile.disable2FA", "إلغاء")}
                    </button>
                  </div>
                  {twoFaError && <p className="text-destructive text-xs bg-destructive/10 px-3 py-2 rounded-lg">{twoFaError}</p>}
                </div>
              )}
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
                {/* Only show profile 1 for PIN management — profile 2 is always hidden */}
                {profiles.filter(p => p.profileIndex === 1).map((profile) => (
                  <div key={profile.profileIndex} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold bg-blue-500/20 text-blue-400">
                          <Lock className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="text-white font-bold text-sm">{t("profile.pinCode", "رمز PIN")}</p>
                          <p className="text-white/40 text-xs">{t("profile.pinActive", "نشط ومفعّل")}</p>
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

                {/* Create first profile PIN if none exist */}
                {profiles.length === 0 && (
                  <button
                    onClick={() => setShowPinSetup(1)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-primary/10 border-2 border-dashed border-primary/30 text-primary font-bold hover:bg-primary/20 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    {t("profile.createPin", "إنشاء رمز PIN")}
                  </button>
                )}

                {/* Create second secret profile — only show button if profile 1 exists but 2 doesn't */}
                {profiles.length === 1 && !profiles.find(p => p.profileIndex === 2) && (
                  <button
                    onClick={() => setShowPinSetup(2)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-purple-500/10 border-2 border-dashed border-purple-500/30 text-purple-400 font-bold hover:bg-purple-500/20 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    {t("profile.createSecondProfile", "إضافة حساب ثاني")}
                  </button>
                )}

                {/* Status indicator for second profile — no details revealed */}
                {profiles.find(p => p.profileIndex === 2) && (
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold bg-purple-500/10 text-purple-400/60">
                      <Lock className="w-4 h-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-white/40 font-medium text-sm">{t("profile.secondProfileActive", "الحساب الثاني مفعّل")}</p>
                      <p className="text-white/20 text-xs">{t("profile.secondProfileHint", "استخدم رمز PIN في بحث الأصدقاء للتبديل")}</p>
                    </div>
                  </div>
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

            {/* Translation Language Preference */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-primary/70" />
                <span className="text-white text-sm font-medium">{t("chat.translateLang")}</span>
              </div>
              <p className="text-white/40 text-xs">{t("chat.selectTranslateLang")}</p>
              <select
                value={localStorage.getItem("ablox_translate_lang") || i18n.language || "ar"}
                onChange={(e) => { localStorage.setItem("ablox_translate_lang", e.target.value); }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-[#0c0c1d] text-white">
                    {lang.flag} {lang.nativeLabel} ({lang.label})
                  </option>
                ))}
              </select>
            </div>

            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><Palette className="w-4 h-4 text-white/50" /><span className="text-white text-sm font-medium">{t("profile.changeTheme")}</span></button>
          </div>
        </ExpandableSection>

        {/* Logout */}
        <ExpandableSection icon={LogOut} title={t("common.logout")} desc={t("profile.logoutDesc")} danger>
          <div className="space-y-3">
            <p className="text-white/60 text-sm">{t("profile.logoutConfirm")}</p>
            <button onClick={handleLogout} className="w-full bg-destructive/10 border border-destructive/20 text-destructive font-bold py-3 rounded-xl text-sm hover:bg-destructive/20 transition-all">{t("common.logout")}</button>
          </div>
        </ExpandableSection>

        {/* Delete Account */}
        <ExpandableSection icon={Trash2} title={t("profile.deleteAccount")} desc={t("profile.deleteAccountDesc")} danger>
          <div className="space-y-3">
            <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4">
              <p className="text-destructive/80 text-sm leading-relaxed">{t("profile.deleteWarning")}</p>
            </div>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-destructive"
              placeholder={t("profile.enterPasswordToDelete", "أدخل كلمة المرور للتأكيد")}
              dir="ltr"
            />
            {deleteError && <p className="text-destructive text-xs font-medium bg-destructive/10 px-3 py-2 rounded-lg">{deleteError}</p>}
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || !deletePassword}
              className="w-full bg-destructive/10 border border-destructive/20 text-destructive font-bold py-3 rounded-xl text-sm hover:bg-destructive/20 transition-all disabled:opacity-50"
            >
              {deleting ? t("common.deleting", "جاري الحذف...") : t("profile.deleteAccountBtn")}
            </button>
          </div>
        </ExpandableSection>
      </div>
    </div>
  );
}