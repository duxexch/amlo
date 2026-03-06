/**
 * Admin Chat — Unified Moderation & Settings Tab (الرقابة والإعدادات)
 * ════════════════════════════════════════
 * Merges the old separate Moderation & Settings tabs into one.
 * Sections: Banned Words, Auto-Moderation Toggles, Pricing, Limits, Features, Stream Whitelist.
 */
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ban, Shield, X, Plus, DollarSign, Users, Radio, Settings, RefreshCw } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { LoadingSkeleton, useDebouncedValue } from "./AdminChatShared";
import type { AdminChatSettings, WhitelistUser } from "../../chat/chatTypes";

export function ModerationSettingsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AdminChatSettings | null>(null);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      adminChatManagement.getSettings(),
      adminChatManagement.getBannedWords(),
    ]).then(([settingsRes, wordsRes]) => {
      if (settingsRes.success) setSettings(settingsRes.data);
      if (wordsRes.success && wordsRes.data) setBannedWords(wordsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const addWord = async () => {
    if (!newWord.trim()) return;
    const res = await adminChatManagement.addBannedWord(newWord.trim());
    if (res.success) { setBannedWords(res.data); setNewWord(""); }
  };

  const removeWord = async (word: string) => {
    const res = await adminChatManagement.removeBannedWord(word);
    if (res.success) setBannedWords(res.data);
  };

  const updateSetting = (key: string, value: string | number | boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const settingsArray = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const res = await adminChatManagement.updateSettings(settingsArray);
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (!settings) return null;

  // ── Toggle fields ──
  const toggleFields = [
    { key: "enable_profanity_filter", label: t("admin.chatManagement.profanityFilter") },
    { key: "enable_spam_detection", label: t("admin.chatManagement.spamDetection") },
    { key: "allow_images", label: t("admin.chatManagement.allowImages") },
    { key: "allow_voice", label: t("admin.chatManagement.allowVoice") },
    { key: "allow_gifts", label: t("admin.chatManagement.allowGifts") },
    { key: "video_streaming_enabled", label: t("admin.chatManagement.videoStreamEnabled", "البث المرئي متاح") },
    { key: "audio_streaming_enabled", label: t("admin.chatManagement.audioStreamEnabled", "البث الصوتي متاح") },
  ];

  // ── Number fields grouped by section ──
  const sections = [
    {
      title: t("admin.chatManagement.chatPricing"),
      icon: DollarSign,
      color: "text-yellow-400",
      fields: [
        { key: "voice_call_rate", label: t("admin.chatManagement.voiceCallRate") },
        { key: "video_call_rate", label: t("admin.chatManagement.videoCallRate") },
        { key: "message_cost", label: t("admin.chatManagement.messageCost") },
      ],
    },
    {
      title: t("admin.chatManagement.chatLimits"),
      icon: Shield,
      color: "text-purple-400",
      fields: [
        { key: "max_message_length", label: t("admin.chatManagement.maxMessageLength") },
        { key: "chat_cooldown", label: t("admin.chatManagement.chatCooldown") },
        { key: "max_call_duration", label: t("admin.chatManagement.maxCallDuration") },
      ],
    },
    {
      title: t("admin.chatManagement.accessLevels"),
      icon: Users,
      color: "text-blue-400",
      fields: [
        { key: "min_level_chat", label: t("admin.chatManagement.minLevelChat") },
        { key: "min_level_call", label: t("admin.chatManagement.minLevelCall") },
        { key: "min_level_stream", label: t("admin.chatManagement.minLevelStream") },
      ],
    },
    {
      title: t("admin.chatManagement.streamSettings"),
      icon: Radio,
      color: "text-red-400",
      fields: [
        { key: "max_concurrent_streams", label: t("admin.chatManagement.maxStreams") },
        { key: "stream_max_viewers", label: t("admin.chatManagement.maxViewers") },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Banned Words ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-400" />
          {t("admin.chatManagement.bannedWords")}
        </h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder={t("admin.chatManagement.addBannedWord")}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50"
          />
          <button onClick={addWord} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-colors">
            <Plus className="w-4 h-4" />
            {t("admin.chatManagement.add")}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {bannedWords.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm"
            >
              {word}
              <button onClick={() => removeWord(word)} className="hover:bg-red-500/30 rounded p-0.5 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </motion.span>
          ))}
          {bannedWords.length === 0 && <p className="text-white/30 text-sm">{t("admin.chatManagement.noBannedWords")}</p>}
        </div>
      </div>

      {/* ── Feature Toggles ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          {t("admin.chatManagement.features")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {toggleFields.map((item) => (
            <label key={item.key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/8 transition-colors">
              <span className="text-white/80 text-sm">{item.label}</span>
              <button
                onClick={() => updateSetting(item.key, !settings[item.key])}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings[item.key] ? "bg-purple-500" : "bg-white/20"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings[item.key] ? "start-[22px]" : "start-0.5"}`} />
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* ── Number Settings by Section ── */}
      {sections.map((section) => (
        <div key={section.title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <section.icon className={`w-5 h-5 ${section.color}`} />
            {section.title}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.fields.map((field) => (
              <div key={field.key} className="p-3 bg-white/5 rounded-xl">
                <label className="text-white/60 text-xs mb-2 block">{field.label}</label>
                <input
                  type="number"
                  value={Number(settings[field.key]) || 0}
                  onChange={(e) => updateSetting(field.key, parseInt(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Save Button ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
          {saving ? t("admin.chatManagement.saving") : t("admin.chatManagement.saveSettings")}
        </button>
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-green-400 text-sm"
            >
              ✅ {t("admin.chatManagement.savedSuccess")}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Stream Whitelist ── */}
      {(settings.video_streaming_enabled === false || settings.audio_streaming_enabled === false) && (
        <StreamWhitelistSection />
      )}
    </div>
  );
}

// ── Stream Whitelist Sub-Section ──
function StreamWhitelistSection() {
  const { t } = useTranslation();
  const [whitelist, setWhitelist] = useState<WhitelistUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 400);
  const [searchResults, setSearchResults] = useState<WhitelistUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminChatManagement.getStreamWhitelist()
      .then(res => { if (res.success) setWhitelist(res.data || []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    adminChatManagement.searchUsersForWhitelist(debouncedQuery.trim())
      .then(res => setSearchResults(res.data || []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  const addToWhitelist = async (user: WhitelistUser) => {
    await adminChatManagement.updateStreamWhitelist(user.id, true);
    setWhitelist(prev => [...prev.filter(u => u.id !== user.id), user]);
    setSearchResults(prev => prev.filter(u => u.id !== user.id));
  };

  const removeFromWhitelist = async (userId: string) => {
    await adminChatManagement.updateStreamWhitelist(userId, false);
    setWhitelist(prev => prev.filter(u => u.id !== userId));
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
        <Shield className="w-5 h-5 text-orange-400" />
        {t("admin.chatManagement.streamWhitelist", "القائمة البيضاء للبث")}
      </h3>
      <p className="text-white/40 text-xs mb-4">
        {t("admin.chatManagement.streamWhitelistDesc", "هؤلاء المستخدمون يمكنهم البث حتى لو كان البث معطلاً عالمياً")}
      </p>

      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t("admin.chatManagement.searchUserToWhitelist", "ابحث عن مستخدم لإضافته...")}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-white/20"
        />
        {searching && <div className="absolute left-3 top-3 w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
          {searchResults.filter(u => !whitelist.find(w => w.id === u.id)).map(user => (
            <div key={user.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                {user.avatar && <img src={user.avatar} className="w-7 h-7 rounded-full" alt="" />}
                <div>
                  <p className="text-white text-sm font-medium">{user.displayName || user.username}</p>
                  <p className="text-white/40 text-[10px]">@{user.username}</p>
                </div>
              </div>
              <button onClick={() => addToWhitelist(user)} className="text-xs bg-orange-500/20 text-orange-400 px-3 py-1 rounded-lg hover:bg-orange-500/30 transition-colors">
                {t("admin.chatManagement.addToWhitelist", "إضافة")}
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : whitelist.length === 0 ? (
        <p className="text-white/20 text-xs text-center py-4">{t("admin.chatManagement.noWhitelistedUsers", "لا يوجد مستخدمون في القائمة البيضاء")}</p>
      ) : (
        <div className="space-y-1">
          {whitelist.map(user => (
            <div key={user.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                {user.avatar && <img src={user.avatar} className="w-7 h-7 rounded-full" alt="" />}
                <div>
                  <p className="text-white text-sm font-medium">{user.displayName || user.username}</p>
                  <p className="text-white/40 text-[10px]">@{user.username} · LV.{user.level}</p>
                </div>
              </div>
              <button onClick={() => removeFromWhitelist(user.id)} className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-lg hover:bg-red-500/30 transition-colors">
                {t("admin.chatManagement.removeFromWhitelist", "إزالة")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
