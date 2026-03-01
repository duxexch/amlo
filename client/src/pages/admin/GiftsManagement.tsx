import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit3, Trash2, X, Send, Search, User, CheckCircle2, MessageCircle } from "lucide-react";
import { adminGifts, adminUsers } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";

interface GiftItem {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  price: number;
  category: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  coins: number;
  email: string;
}

const CATEGORY_KEYS = ["catAll", "catGeneral", "catLove", "catCelebration", "catPremium", "catVIP", "catSeasonal"] as const;
const CATEGORY_VALUES: Record<string, string> = {
  catAll: "all",
  catGeneral: "general",
  catLove: "love",
  catCelebration: "celebration",
  catPremium: "premium",
  catVIP: "special",
  catSeasonal: "seasonal",
};

const CATEGORY_COLORS: Record<string, string> = {
  catAll: "border-white/20 text-white/60",
  catGeneral: "border-green-400/30 text-green-400",
  catLove: "border-pink-400/30 text-pink-400",
  catCelebration: "border-yellow-400/30 text-yellow-400",
  catPremium: "border-purple-400/30 text-purple-400",
  catVIP: "border-cyan-400/30 text-cyan-400",
  catSeasonal: "border-orange-400/30 text-orange-400",
};

const CATEGORY_BG_ACTIVE: Record<string, string> = {
  catAll: "bg-white/10 border-white/30",
  catGeneral: "bg-green-400/15 border-green-400/40",
  catLove: "bg-pink-400/15 border-pink-400/40",
  catCelebration: "bg-yellow-400/15 border-yellow-400/40",
  catPremium: "bg-purple-400/15 border-purple-400/40",
  catVIP: "bg-cyan-400/15 border-cyan-400/40",
  catSeasonal: "bg-orange-400/15 border-orange-400/40",
};

const ICONS = [
  "🎁", "❤️", "🌹", "💎", "👑", "🦋", "🚀", "⭐", "🎉", "🎊", "🏆", "💰", "🔥", "🌟", "💜", "🎵",
  "💐", "🌻", "🌷", "🍀", "🌈", "🕊️", "💋", "💌", "💘", "💖", "🍷", "💍", "🧸", "🍫",
  "🎂", "🎈", "🎆", "🎇", "💠", "⚡", "🥇", "🔮", "🏎️", "🐉", "🛥️", "✈️", "🕌", "🪐", "🌠",
  "⛄", "🎄", "🌙", "🏮", "🌌",
];

export function GiftsManagementPage() {
  const { t } = useTranslation();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGift, setEditGift] = useState<GiftItem | null>(null);
  const [formData, setFormData] = useState({ name: "", nameAr: "", icon: "🎁", price: "", category: "general", sortOrder: "0" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("catAll");
  const [search, setSearch] = useState("");

  // Send gift state
  const [sendGift, setSendGift] = useState<GiftItem | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [sendMessage, setSendMessage] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchGifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGifts.list();
      if (res.success) setGifts(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGifts(); }, [fetchGifts]);

  // Filter gifts by category and search
  const filteredGifts = gifts.filter(g => {
    const catMatch = activeCategory === "catAll" || g.category === CATEGORY_VALUES[activeCategory];
    const searchMatch = !search || g.nameAr.includes(search) || g.name.toLowerCase().includes(search.toLowerCase());
    return catMatch && searchMatch;
  });

  const openCreate = () => {
    setEditGift(null);
    setFormData({ name: "", nameAr: "", icon: "🎁", price: "", category: "general", sortOrder: "0" });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (g: GiftItem) => {
    setEditGift(g);
    setFormData({ name: g.name, nameAr: g.nameAr, icon: g.icon, price: g.price.toString(), category: g.category, sortOrder: g.sortOrder.toString() });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.name || !formData.nameAr || !formData.price) { setFormError(t("admin.gifts.allFieldsRequired")); return; }
    setFormLoading(true);
    try {
      const payload = { ...formData, price: parseInt(formData.price), sortOrder: parseInt(formData.sortOrder) };
      if (editGift) {
        await adminGifts.update(editGift.id, payload);
      } else {
        await adminGifts.create(payload);
      }
      setShowForm(false);
      fetchGifts();
    } catch (e: any) { setFormError(e?.message || "حدث خطأ"); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.gifts.confirmDelete"))) return;
    try { await adminGifts.delete(id); fetchGifts(); } catch (e) { console.error(e); }
  };

  // Send gift functions
  const openSendGift = (g: GiftItem) => {
    setSendGift(g);
    setUserSearch("");
    setUserResults([]);
    setSelectedUser(null);
    setSendMessage("");
    setSendSuccess(false);
  };

  const searchUsersDebounced = (query: string) => {
    setUserSearch(query);
    setSelectedUser(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) { setUserResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setUserLoading(true);
      try {
        const res = await adminUsers.list({ search: query, limit: 10 });
        if (res.success) setUserResults(res.data || []);
      } catch (e) { console.error(e); }
      finally { setUserLoading(false); }
    }, 300);
  };

  const handleSendGift = async () => {
    if (!sendGift || !selectedUser) return;
    setSendLoading(true);
    try {
      const res = await adminGifts.send(sendGift.id, selectedUser.id, sendMessage || undefined) as any;
      if (res.success) {
        setSendSuccess(true);
        setTimeout(() => { setSendGift(null); setSendSuccess(false); }, 2000);
      }
    } catch (e) { console.error(e); }
    finally { setSendLoading(false); }
  };

  // Count per category
  const catCounts: Record<string, number> = { catAll: gifts.length };
  for (const key of CATEGORY_KEYS) {
    if (key !== "catAll") {
      catCounts[key] = gifts.filter(g => g.category === CATEGORY_VALUES[key]).length;
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Outfit" }}>{t("admin.gifts.title")}</h1>
          <p className="text-white/40 text-sm mt-1">{t("admin.gifts.catalogCount", { count: gifts.length })}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> {t("admin.gifts.addGift")}
        </button>
      </div>

      {/* Search + Category Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("admin.gifts.searchGifts")}
            className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 pr-10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${activeCategory === cat ? CATEGORY_BG_ACTIVE[cat] : `bg-transparent ${CATEGORY_COLORS[cat]} hover:bg-white/5`}`}
            >
              {t(`admin.gifts.${cat}`)} <span className="opacity-50 mr-1">({catCounts[cat] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Gifts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-52 animate-pulse" />
          ))
        ) : filteredGifts.length === 0 ? (
          <div className="col-span-full text-center py-20 text-white/20">{t("admin.gifts.noGifts")}</div>
        ) : (
          filteredGifts.map((gift, i) => (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`bg-[#0c0c1d] border rounded-2xl p-4 hover:border-white/10 transition-colors group relative ${gift.isActive ? "border-white/5" : "border-red-500/20 opacity-60"}`}
            >
              <div className="text-center mb-3">
                <span className="text-4xl block">{gift.icon}</span>
              </div>
              <h3 className="text-sm font-bold text-white text-center mb-0.5 truncate">{gift.nameAr}</h3>
              <p className="text-[10px] text-white/25 text-center mb-2 truncate">{gift.name}</p>
              <div className="flex items-center justify-center gap-1 mb-3">
                <span className="text-xs font-bold text-yellow-400">{gift.price.toLocaleString()}</span>
                <span className="text-[10px] text-white/25">{t("common.coins")}</span>
              </div>
              <div className="flex gap-1">
                <button className="flex-1 h-7 rounded-lg bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center transition-colors" onClick={() => openSendGift(gift)} title={t("admin.gifts.sendToUser")}>
                  <Send className="w-3 h-3 text-green-400" />
                </button>
                <button className="flex-1 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" onClick={() => openEdit(gift)}>
                  <Edit3 className="w-3 h-3 text-white/40" />
                </button>
                <button className="flex-1 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors" onClick={() => handleDelete(gift.id)}>
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
              {!gift.isActive && (
                <div className="absolute top-2 left-2 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md font-bold">{t("common.disabled")}</div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div className="relative w-full max-w-md bg-[#0c0c1d] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">{editGift ? t("admin.gifts.editTitle") : t("admin.gifts.createTitle")}</h3>
                <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
              <div className="space-y-4">
                {/* Icon Picker */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-2 block">{t("admin.gifts.iconCol")}</label>
                  <div className="grid grid-cols-10 gap-1.5 max-h-32 overflow-y-auto">
                    {ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`w-full aspect-square rounded-lg text-lg flex items-center justify-center transition-colors ${formData.icon === icon ? "bg-primary/20 border border-primary/40" : "bg-white/5 hover:bg-white/10 border border-transparent"}`}
                        onClick={() => setFormData((f) => ({ ...f, icon }))}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("admin.gifts.nameEnCol")} value={formData.name} onChange={(v) => setFormData((f) => ({ ...f, name: v }))} placeholder="Rose" />
                  <Field label={t("admin.gifts.nameArCol")} value={formData.nameAr} onChange={(v) => setFormData((f) => ({ ...f, nameAr: v }))} placeholder="وردة" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("admin.gifts.priceCol")} value={formData.price} onChange={(v) => setFormData((f) => ({ ...f, price: v }))} placeholder="100" type="number" />
                  <div>
                    <label className="text-xs text-white/40 font-medium mb-1.5 block">{t("admin.gifts.categoryCol")}</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white/70 focus:outline-none"
                      value={formData.category}
                      onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                    >
                      <option value="general" className="bg-[#1a1a2e] text-white">{t("admin.gifts.catGeneral")}</option>
                      <option value="love" className="bg-[#1a1a2e] text-white">{t("admin.gifts.catLove")}</option>
                      <option value="celebration" className="bg-[#1a1a2e] text-white">{t("admin.gifts.catCelebration")}</option>
                      <option value="premium" className="bg-[#1a1a2e] text-white">{t("admin.gifts.catPremium")}</option>
                      <option value="special" className="bg-[#1a1a2e] text-white">{t("admin.gifts.catVIP")}</option>
                      <option value="seasonal" className="bg-[#1a1a2e] text-white">{t("admin.gifts.catSeasonal")}</option>
                    </select>
                  </div>
                </div>
                <Field label={t("admin.gifts.sortOrderCol")} value={formData.sortOrder} onChange={(v) => setFormData((f) => ({ ...f, sortOrder: v }))} placeholder="0" type="number" />
                {formError && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{formError}</div>}
                <div className="flex gap-2 pt-2">
                  <button className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50" disabled={formLoading} onClick={handleSubmit}>
                    {formLoading ? t("common.loading") : editGift ? t("common.save") : t("common.add")}
                  </button>
                  <button className="px-6 h-10 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-colors" onClick={() => setShowForm(false)}>{t("common.cancel")}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Send Gift Modal ── */}
      <AnimatePresence>
        {sendGift && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !sendLoading && setSendGift(null)} />
            <motion.div className="relative w-full max-w-md bg-[#0c0c1d] border border-white/10 rounded-2xl p-6" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              {sendSuccess ? (
                <motion.div className="text-center py-8" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                  <div className="text-6xl mb-4">{sendGift.icon}</div>
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">{t("admin.gifts.sendSuccess")}</h3>
                  <p className="text-sm text-white/40">{t("admin.gifts.sendSuccessDesc", { gift: sendGift.nameAr, user: selectedUser?.displayName || selectedUser?.username })}</p>
                </motion.div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white">{t("admin.gifts.sendToUser")}</h3>
                    <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={() => setSendGift(null)}>
                      <X className="w-4 h-4 text-white/50" />
                    </button>
                  </div>

                  {/* Gift Preview */}
                  <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-xl p-4 mb-5">
                    <span className="text-4xl">{sendGift.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white">{sendGift.nameAr}</h4>
                      <p className="text-[11px] text-white/30">{sendGift.name}</p>
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-yellow-400">{sendGift.price.toLocaleString()}</span>
                      <span className="text-[10px] text-white/25 block">{t("common.coins")}</span>
                    </div>
                  </div>

                  {/* User Search */}
                  <div className="mb-4">
                    <label className="text-xs text-white/40 font-medium mb-2 block">{t("admin.gifts.selectUser")}</label>
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input
                        value={userSearch}
                        onChange={e => searchUsersDebounced(e.target.value)}
                        placeholder={t("admin.gifts.searchUserPlaceholder")}
                        className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 pr-10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>

                    {/* Selected User */}
                    {selectedUser && (
                      <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-xl p-3 mt-2">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          {selectedUser.avatar ? (
                            <img src={selectedUser.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{selectedUser.displayName}</p>
                          <p className="text-[10px] text-white/30">@{selectedUser.username} — {selectedUser.coins?.toLocaleString()} {t("common.coins")}</p>
                        </div>
                        <button onClick={() => { setSelectedUser(null); setUserSearch(""); }} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                          <X className="w-3 h-3 text-white/40" />
                        </button>
                      </div>
                    )}

                    {/* User Results */}
                    {!selectedUser && userSearch && (
                      <div className="mt-2 bg-[#0a0a18] border border-white/5 rounded-xl max-h-48 overflow-y-auto">
                        {userLoading ? (
                          <div className="p-4 text-center text-white/20 text-xs">{t("common.loading")}...</div>
                        ) : userResults.length === 0 ? (
                          <div className="p-4 text-center text-white/20 text-xs">{t("admin.gifts.noUsersFound")}</div>
                        ) : (
                          userResults.map(user => (
                            <button
                              key={user.id}
                              onClick={() => { setSelectedUser(user); setUserSearch(user.displayName); setUserResults([]); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-right"
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                {user.avatar ? (
                                  <img src={user.avatar} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{user.displayName}</p>
                                <p className="text-[10px] text-white/25">@{user.username}</p>
                              </div>
                              <span className="text-[10px] text-yellow-400/50">{user.coins?.toLocaleString()} {t("common.coins")}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Optional Message */}
                  <div className="mb-5">
                    <label className="text-xs text-white/40 font-medium mb-1.5 flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3" /> {t("admin.gifts.messageOptional")}
                    </label>
                    <input
                      value={sendMessage}
                      onChange={e => setSendMessage(e.target.value)}
                      placeholder={t("admin.gifts.messagePlaceholder")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    disabled={!selectedUser || sendLoading}
                    onClick={handleSendGift}
                    className="w-full h-11 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold hover:bg-green-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {sendLoading ? t("common.loading") : t("admin.gifts.confirmSend")}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="text-xs text-white/40 font-medium mb-1.5 block">{label}</label>
      <input type={type} className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
