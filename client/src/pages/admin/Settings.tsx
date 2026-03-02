import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Save, Check, Loader2, RefreshCw, Search, Globe, Store,
  Users, Shield, Palette, FileText, ScrollText, Eye, EyeOff, TestTube,
  Smartphone, Mail, MessageSquare, ImageIcon, Link2, ChevronDown,
  ChevronUp, ExternalLink, Copy, Plus, Trash2, AlertCircle, Radio,
  GripVertical, X, UserCheck, Video, Bell, MousePointerClick, Coins,
  Phone, Navigation, MapPin, Download, Link as LinkIcon, Info
} from "lucide-react";
import { adminSettings, adminFeatured, adminAnnouncementPopup } from "@/lib/adminApi";
import { worldAdminApi } from "@/lib/worldApi";
import { useTranslation } from "react-i18next";

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

type TabId = "seo" | "aso" | "socialLogin" | "otp" | "branding" | "seoTexts" | "policies" | "featured" | "popup" | "pricing" | "milesPricing" | "worldPricing" | "appDownload";

interface TabConfig {
  id: TabId;
  icon: React.ElementType;
  labelKey: string;
}

// ══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════

function InputField({ label, value, onChange, type = "text", placeholder = "", dir = "ltr", multiline = false, rows = 3, mono = false, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; dir?: string; multiline?: boolean; rows?: number; mono?: boolean; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-white/50">{label}</label>
      {multiline ? (
        <textarea
          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors resize-none ${mono ? "font-mono text-xs" : ""}`}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={dir} rows={rows} disabled={disabled}
        />
      ) : (
        <input
          type={type}
          className={`w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors ${mono ? "font-mono text-xs" : ""}`}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={dir} disabled={disabled}
        />
      )}
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
      </div>
      <button
        className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${checked ? "bg-green-500" : "bg-white/10"}`}
        onClick={() => onChange(!checked)}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${checked ? "ltr:left-6 rtl:right-6" : "ltr:left-1 rtl:right-1"}`} />
      </button>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, collapsible = false, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden">
      <div
        className={`flex items-center gap-3 px-6 py-4 border-b border-white/5 ${collapsible ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-white flex-1">{title}</h3>
        {collapsible && (open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />)}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="px-6 py-5 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SaveButton({ saving, saved, onClick, label }: { saving: boolean; saved: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`flex items-center gap-2 px-5 h-10 text-sm font-bold rounded-xl transition-all ${
        saved ? "bg-green-500/20 text-green-400 border border-green-500/20" :
        "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
      }`}
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
      {saved ? "✓" : label}
    </button>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-white/50">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 pe-10 text-sm text-white font-mono focus:outline-none focus:border-primary/50 transition-colors"
          value={value} onChange={(e) => onChange(e.target.value)} dir="ltr"
        />
        <button onClick={() => setShow(!show)} className="absolute top-1/2 -translate-y-1/2 end-3 text-white/30 hover:text-white/60">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    connected: "bg-green-500/10 text-green-400 border-green-500/20",
    disconnected: "bg-white/5 text-white/30 border-white/10",
    published: "bg-green-500/10 text-green-400 border-green-500/20",
    draft: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border ${colors[status] || colors.disconnected}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "connected" || status === "published" ? "bg-green-400" : status === "draft" ? "bg-amber-400" : "bg-white/30"}`} />
      {status}
    </span>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: SEO
// ══════════════════════════════════════════════════════════

function SeoTab({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  const update = (key: string, val: string) => setForm((f: any) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <SectionCard title={t("admin.settings.seo.metaTags")} icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.seo.metaTitle") + " (EN)"} value={form.metaTitle || ""} onChange={(v) => update("metaTitle", v)} />
          <InputField label={t("admin.settings.seo.metaTitle") + " (AR)"} value={form.metaTitleAr || ""} onChange={(v) => update("metaTitleAr", v)} dir="rtl" />
          <InputField label={t("admin.settings.seo.metaDescription") + " (EN)"} value={form.metaDescription || ""} onChange={(v) => update("metaDescription", v)} multiline />
          <InputField label={t("admin.settings.seo.metaDescription") + " (AR)"} value={form.metaDescriptionAr || ""} onChange={(v) => update("metaDescriptionAr", v)} multiline dir="rtl" />
          <InputField label={t("admin.settings.seo.metaKeywords") + " (EN)"} value={form.metaKeywords || ""} onChange={(v) => update("metaKeywords", v)} />
          <InputField label={t("admin.settings.seo.metaKeywords") + " (AR)"} value={form.metaKeywordsAr || ""} onChange={(v) => update("metaKeywordsAr", v)} dir="rtl" />
        </div>
      </SectionCard>

      <SectionCard title={t("admin.settings.seo.openGraph")} icon={ImageIcon}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="OG Title" value={form.ogTitle || ""} onChange={(v) => update("ogTitle", v)} />
          <InputField label="OG Description" value={form.ogDescription || ""} onChange={(v) => update("ogDescription", v)} />
          <InputField label="OG Image URL" value={form.ogImage || ""} onChange={(v) => update("ogImage", v)} placeholder="https://..." />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/50">OG Type</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white focus:outline-none focus:border-primary/50" value={form.ogType || "website"} onChange={(e) => update("ogType", e.target.value)}>
              <option value="website" className="bg-[#1a1a2e] text-white">website</option>
              <option value="article" className="bg-[#1a1a2e] text-white">article</option>
              <option value="profile" className="bg-[#1a1a2e] text-white">profile</option>
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("admin.settings.seo.twitterCards")} icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/50">Twitter Card</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white focus:outline-none focus:border-primary/50" value={form.twitterCard || "summary_large_image"} onChange={(e) => update("twitterCard", e.target.value)}>
              <option value="summary" className="bg-[#1a1a2e] text-white">summary</option>
              <option value="summary_large_image" className="bg-[#1a1a2e] text-white">summary_large_image</option>
              <option value="player" className="bg-[#1a1a2e] text-white">player</option>
            </select>
          </div>
          <InputField label="Twitter @Site" value={form.twitterSite || ""} onChange={(v) => update("twitterSite", v)} placeholder="@handle" />
          <InputField label="Twitter @Creator" value={form.twitterCreator || ""} onChange={(v) => update("twitterCreator", v)} placeholder="@handle" />
        </div>
      </SectionCard>

      <SectionCard title={t("admin.settings.seo.technical")} icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Canonical URL" value={form.canonicalUrl || ""} onChange={(v) => update("canonicalUrl", v)} placeholder="https://..." />
          <InputField label="Robots Directives" value={form.robotsDirectives || ""} onChange={(v) => update("robotsDirectives", v)} placeholder="index, follow" />
          <InputField label="Google Verification" value={form.googleVerification || ""} onChange={(v) => update("googleVerification", v)} mono />
          <InputField label="Sitemap URL" value={form.sitemapUrl || ""} onChange={(v) => update("sitemapUrl", v)} placeholder="https://.../sitemap.xml" />
        </div>
        <InputField label="JSON-LD Organization" value={form.jsonLdOrganization || ""} onChange={(v) => update("jsonLdOrganization", v)} multiline rows={6} mono />
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={handleSave} label={t("admin.settings.save")} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: ASO
// ══════════════════════════════════════════════════════════

function AsoTab({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [gp, setGp] = useState<any>({});
  const [as, setAs] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setGp({ ...data.googlePlay });
      setAs({ ...data.appStore });
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ googlePlay: gp, appStore: as }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Google Play */}
      <SectionCard title={t("admin.settings.aso.googlePlay")} icon={Store}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.aso.title")} value={gp.title || ""} onChange={(v) => setGp((f: any) => ({ ...f, title: v }))} />
          <InputField label={t("admin.settings.aso.category")} value={gp.category || ""} onChange={(v) => setGp((f: any) => ({ ...f, category: v }))} />
          <InputField label={t("admin.settings.aso.shortDescription")} value={gp.shortDescription || ""} onChange={(v) => setGp((f: any) => ({ ...f, shortDescription: v }))} multiline rows={2} />
          <InputField label={t("admin.settings.aso.keywords")} value={gp.keywords || ""} onChange={(v) => setGp((f: any) => ({ ...f, keywords: v }))} />
        </div>
        <InputField label={t("admin.settings.aso.fullDescription")} value={gp.fullDescription || ""} onChange={(v) => setGp((f: any) => ({ ...f, fullDescription: v }))} multiline rows={8} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.aso.contentRating")} value={gp.contentRating || ""} onChange={(v) => setGp((f: any) => ({ ...f, contentRating: v }))} />
          <InputField label={t("admin.settings.aso.storeUrl")} value={gp.storeUrl || ""} onChange={(v) => setGp((f: any) => ({ ...f, storeUrl: v }))} placeholder="https://play.google.com/..." />
        </div>
      </SectionCard>

      {/* Apple App Store */}
      <SectionCard title={t("admin.settings.aso.appStore")} icon={Smartphone}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.aso.title")} value={as.title || ""} onChange={(v) => setAs((f: any) => ({ ...f, title: v }))} />
          <InputField label={t("admin.settings.aso.subtitle")} value={as.subtitle || ""} onChange={(v) => setAs((f: any) => ({ ...f, subtitle: v }))} />
        </div>
        <InputField label={t("admin.settings.aso.description")} value={as.description || ""} onChange={(v) => setAs((f: any) => ({ ...f, description: v }))} multiline rows={4} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.aso.keywords")} value={as.keywords || ""} onChange={(v) => setAs((f: any) => ({ ...f, keywords: v }))} />
          <InputField label={t("admin.settings.aso.primaryCategory")} value={as.primaryCategory || ""} onChange={(v) => setAs((f: any) => ({ ...f, primaryCategory: v }))} />
          <InputField label={t("admin.settings.aso.secondaryCategory")} value={as.secondaryCategory || ""} onChange={(v) => setAs((f: any) => ({ ...f, secondaryCategory: v }))} />
          <InputField label={t("admin.settings.aso.storeUrl")} value={as.storeUrl || ""} onChange={(v) => setAs((f: any) => ({ ...f, storeUrl: v }))} placeholder="https://apps.apple.com/..." />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={handleSave} label={t("admin.settings.save")} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: SOCIAL LOGIN
// ══════════════════════════════════════════════════════════

function SocialLoginTab({ data, onSave }: { data: any; onSave: (provider: string, d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<any>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => { if (data) setProviders({ ...data }); }, [data]);

  const PROVIDER_ICONS: Record<string, string> = {
    google: "🔵", facebook: "🟦", apple: "⬛", twitter: "🐦",
    tiktok: "🎵", snapchat: "👻", instagram: "📷", github: "🐙",
  };

  const handleSave = async (provider: string) => {
    setSaving(provider);
    try {
      await onSave(provider, providers[provider]);
      setSaved(provider); setTimeout(() => setSaved(null), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(null); }
  };

  const handleToggle = (provider: string) => {
    setProviders((prev: any) => ({
      ...prev,
      [provider]: { ...prev[provider], enabled: !prev[provider].enabled },
    }));
  };

  return (
    <div className="space-y-3">
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden px-6 py-4">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{t("admin.settings.socialLogin.hint")}</span>
        </div>
      </div>

      {Object.entries(providers).map(([key, provider]: [string, any]) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden"
        >
          <div
            className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-white/[0.02]"
            onClick={() => setExpandedProvider(expandedProvider === key ? null : key)}
          >
            <span className="text-xl">{PROVIDER_ICONS[key] || "🔗"}</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white capitalize">{key}</p>
            </div>
            <StatusBadge status={provider.status || (provider.enabled ? "connected" : "disconnected")} />
            <div onClick={(e) => e.stopPropagation()}>
              <button
                className={`w-12 h-7 rounded-full relative transition-colors ${provider.enabled ? "bg-green-500" : "bg-white/10"}`}
                onClick={() => handleToggle(key)}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${provider.enabled ? "ltr:left-6 rtl:right-6" : "ltr:left-1 rtl:right-1"}`} />
              </button>
            </div>
            {expandedProvider === key ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </div>

          <AnimatePresence>
            {expandedProvider === key && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="px-6 py-5 border-t border-white/5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Client ID" value={provider.clientId || ""} onChange={(v) => setProviders((p: any) => ({ ...p, [key]: { ...p[key], clientId: v } }))} mono />
                    <PasswordField label="Client Secret" value={provider.clientSecret || ""} onChange={(v) => setProviders((p: any) => ({ ...p, [key]: { ...p[key], clientSecret: v } }))} />
                  </div>
                  <InputField label="Redirect URL" value={provider.redirectUrl || ""} onChange={(v) => setProviders((p: any) => ({ ...p, [key]: { ...p[key], redirectUrl: v } }))} mono />
                  {provider.lastTested && (
                    <p className="text-xs text-white/20">{t("admin.settings.socialLogin.lastTested")}: {new Date(provider.lastTested).toLocaleDateString()}</p>
                  )}
                  <div className="flex items-center gap-3 justify-end">
                    <button className="flex items-center gap-2 px-4 h-9 text-xs font-bold rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                      <TestTube className="w-3.5 h-3.5" /> {t("admin.settings.socialLogin.test")}
                    </button>
                    <SaveButton saving={saving === key} saved={saved === key} onClick={() => handleSave(key)} label={t("admin.settings.save")} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: OTP
// ══════════════════════════════════════════════════════════

function OtpTab({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [gmail, setGmail] = useState<any>({});
  const [sms, setSms] = useState<any>({});
  const [otpConfig, setOtpConfig] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setGmail({ ...data.gmail });
      setSms({ ...data.sms });
      setOtpConfig({ ...data.otpConfig });
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ gmail, sms, otpConfig }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Gmail SMTP */}
      <SectionCard title={t("admin.settings.otp.gmail")} icon={Mail}>
        <ToggleField label={t("admin.settings.otp.enableEmail")} checked={gmail.enabled || false} onChange={(v) => setGmail((f: any) => ({ ...f, enabled: v }))} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.otp.host")} value={gmail.host || ""} onChange={(v) => setGmail((f: any) => ({ ...f, host: v }))} mono />
          <InputField label={t("admin.settings.otp.port")} value={String(gmail.port || "")} onChange={(v) => setGmail((f: any) => ({ ...f, port: parseInt(v) || 0 }))} />
          <InputField label={t("admin.settings.otp.username")} value={gmail.username || ""} onChange={(v) => setGmail((f: any) => ({ ...f, username: v }))} mono />
          <PasswordField label={t("admin.settings.otp.password")} value={gmail.password || ""} onChange={(v) => setGmail((f: any) => ({ ...f, password: v }))} />
          <InputField label={t("admin.settings.otp.senderName")} value={gmail.senderName || ""} onChange={(v) => setGmail((f: any) => ({ ...f, senderName: v }))} />
          <InputField label={t("admin.settings.otp.senderEmail")} value={gmail.senderEmail || ""} onChange={(v) => setGmail((f: any) => ({ ...f, senderEmail: v }))} mono />
        </div>
      </SectionCard>

      {/* SMS */}
      <SectionCard title={t("admin.settings.otp.sms")} icon={MessageSquare}>
        <ToggleField label={t("admin.settings.otp.enableSms")} checked={sms.enabled || false} onChange={(v) => setSms((f: any) => ({ ...f, enabled: v }))} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/50">{t("admin.settings.otp.provider")}</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white focus:outline-none focus:border-primary/50" value={sms.provider || "twilio"} onChange={(e) => setSms((f: any) => ({ ...f, provider: e.target.value }))}>
              <option value="twilio" className="bg-[#1a1a2e] text-white">Twilio</option>
              <option value="vonage" className="bg-[#1a1a2e] text-white">Vonage</option>
              <option value="messagebird" className="bg-[#1a1a2e] text-white">MessageBird</option>
            </select>
          </div>
          <InputField label={t("admin.settings.otp.phoneNumber")} value={sms.phoneNumber || ""} onChange={(v) => setSms((f: any) => ({ ...f, phoneNumber: v }))} placeholder="+1234567890" mono />
          <InputField label="API Key" value={sms.apiKey || ""} onChange={(v) => setSms((f: any) => ({ ...f, apiKey: v }))} mono />
          <PasswordField label="API Secret" value={sms.apiSecret || ""} onChange={(v) => setSms((f: any) => ({ ...f, apiSecret: v }))} />
          <InputField label="Sender ID" value={sms.senderId || ""} onChange={(v) => setSms((f: any) => ({ ...f, senderId: v }))} />
        </div>
      </SectionCard>

      {/* OTP Config */}
      <SectionCard title={t("admin.settings.otp.config")} icon={Shield}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.otp.codeLength")} value={String(otpConfig.codeLength || "")} onChange={(v) => setOtpConfig((f: any) => ({ ...f, codeLength: parseInt(v) || 6 }))} type="number" />
          <InputField label={t("admin.settings.otp.expiryMinutes")} value={String(otpConfig.expiryMinutes || "")} onChange={(v) => setOtpConfig((f: any) => ({ ...f, expiryMinutes: parseInt(v) || 5 }))} type="number" />
          <InputField label={t("admin.settings.otp.maxAttempts")} value={String(otpConfig.maxAttempts || "")} onChange={(v) => setOtpConfig((f: any) => ({ ...f, maxAttempts: parseInt(v) || 3 }))} type="number" />
          <InputField label={t("admin.settings.otp.cooldownMinutes")} value={String(otpConfig.cooldownMinutes || "")} onChange={(v) => setOtpConfig((f: any) => ({ ...f, cooldownMinutes: parseInt(v) || 2 }))} type="number" />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={handleSave} label={t("admin.settings.save")} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: BRANDING
// ══════════════════════════════════════════════════════════

function BrandingTab({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  const update = (key: string, val: string) => setForm((f: any) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-white/50">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
        <input
          className="flex-1 bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white font-mono focus:outline-none focus:border-primary/50 transition-colors"
          value={value || ""} onChange={(e) => onChange(e.target.value)} dir="ltr" placeholder="#000000"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionCard title={t("admin.settings.branding.appName")} icon={Palette}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.branding.nameEn")} value={form.appNameEn || ""} onChange={(v) => update("appNameEn", v)} />
          <InputField label={t("admin.settings.branding.nameAr")} value={form.appNameAr || ""} onChange={(v) => update("appNameAr", v)} dir="rtl" />
        </div>
      </SectionCard>

      <SectionCard title={t("admin.settings.branding.logos")} icon={ImageIcon}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label={t("admin.settings.branding.favicon")} value={form.faviconUrl || ""} onChange={(v) => update("faviconUrl", v)} placeholder="https://..." />
          <InputField label={t("admin.settings.branding.appIcon")} value={form.appIconUrl || ""} onChange={(v) => update("appIconUrl", v)} placeholder="https://..." />
          <InputField label={t("admin.settings.branding.logoLight")} value={form.logoLightUrl || ""} onChange={(v) => update("logoLightUrl", v)} placeholder="https://..." />
          <InputField label={t("admin.settings.branding.logoDark")} value={form.logoDarkUrl || ""} onChange={(v) => update("logoDarkUrl", v)} placeholder="https://..." />
          <InputField label={t("admin.settings.branding.backgroundImage")} value={form.backgroundImageUrl || ""} onChange={(v) => update("backgroundImageUrl", v)} placeholder="https://..." />
          <InputField label={t("admin.settings.branding.coverImage")} value={form.coverImageUrl || ""} onChange={(v) => update("coverImageUrl", v)} placeholder="https://..." />
        </div>
        {/* Preview */}
        {(form.appIconUrl || form.logoLightUrl) && (
          <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/5">
            <p className="text-xs text-white/30 mb-3">{t("admin.settings.branding.preview")}</p>
            <div className="flex items-center gap-4">
              {form.appIconUrl && <img src={form.appIconUrl} alt="App Icon" className="w-16 h-16 rounded-2xl bg-white/5 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              {form.logoLightUrl && <img src={form.logoLightUrl} alt="Logo" className="h-10 bg-white/5 rounded-lg px-3 py-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("admin.settings.branding.colors")} icon={Palette}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ColorField label={t("admin.settings.branding.primaryColor")} value={form.colorPrimary || "#a855f7"} onChange={(v) => update("colorPrimary", v)} />
          <ColorField label={t("admin.settings.branding.secondaryColor")} value={form.colorSecondary || "#6366f1"} onChange={(v) => update("colorSecondary", v)} />
          <ColorField label={t("admin.settings.branding.accentColor")} value={form.colorAccent || "#f59e0b"} onChange={(v) => update("colorAccent", v)} />
          <ColorField label={t("admin.settings.branding.bgColor")} value={form.colorBackground || "#06060f"} onChange={(v) => update("colorBackground", v)} />
          <ColorField label={t("admin.settings.branding.surfaceColor")} value={form.colorSurface || "#0c0c1d"} onChange={(v) => update("colorSurface", v)} />
        </div>
        {/* Color Preview */}
        <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/5">
          <p className="text-xs text-white/30 mb-3">{t("admin.settings.branding.colorPreview")}</p>
          <div className="flex gap-3">
            {[form.colorPrimary, form.colorSecondary, form.colorAccent, form.colorBackground, form.colorSurface].filter(Boolean).map((c, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-xl border border-white/10" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-white/20 font-mono mt-1 block">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={handleSave} label={t("admin.settings.save")} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: SEO TEXTS
// ══════════════════════════════════════════════════════════

function SeoTextsTab({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data?.pages) setPages([...data.pages]); }, [data]);

  const updatePage = (idx: number, key: string, val: string) => {
    setPages((prev) => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  };

  const addPage = () => {
    setPages((prev) => [...prev, { slug: "", titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "", keywords: "" }]);
  };

  const removePage = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ pages }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40">{t("admin.settings.seoTexts.hint")}</p>
        <button onClick={addPage} className="flex items-center gap-2 px-4 h-9 text-xs font-bold rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 transition-colors">
          <Plus className="w-3.5 h-3.5" /> {t("admin.settings.seoTexts.addPage")}
        </button>
      </div>

      {pages.map((page, idx) => (
        <SectionCard key={idx} title={page.slug || t("admin.settings.seoTexts.newPage")} icon={FileText} collapsible defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label={t("admin.settings.seoTexts.slug")} value={page.slug} onChange={(v) => updatePage(idx, "slug", v)} mono placeholder="home" />
            <InputField label={t("admin.settings.seoTexts.keywords")} value={page.keywords} onChange={(v) => updatePage(idx, "keywords", v)} />
            <InputField label={t("admin.settings.seoTexts.titleEn")} value={page.titleEn} onChange={(v) => updatePage(idx, "titleEn", v)} />
            <InputField label={t("admin.settings.seoTexts.titleAr")} value={page.titleAr} onChange={(v) => updatePage(idx, "titleAr", v)} dir="rtl" />
            <InputField label={t("admin.settings.seoTexts.descriptionEn")} value={page.descriptionEn} onChange={(v) => updatePage(idx, "descriptionEn", v)} multiline />
            <InputField label={t("admin.settings.seoTexts.descriptionAr")} value={page.descriptionAr} onChange={(v) => updatePage(idx, "descriptionAr", v)} multiline dir="rtl" />
          </div>
          <div className="flex justify-end">
            <button onClick={() => removePage(idx)} className="flex items-center gap-2 px-3 h-8 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> {t("admin.settings.seoTexts.remove")}
            </button>
          </div>
        </SectionCard>
      ))}

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={handleSave} label={t("admin.settings.save")} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: POLICIES
// ══════════════════════════════════════════════════════════

function PoliciesTab({ data, onSave }: { data: any; onSave: (key: string, d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<any>({});
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => { if (data) setPolicies({ ...data }); }, [data]);

  const DOC_LABELS: Record<string, { icon: React.ElementType; labelKey: string }> = {
    privacyPolicy: { icon: Shield, labelKey: "admin.settings.policies.privacyPolicy" },
    termsOfService: { icon: ScrollText, labelKey: "admin.settings.policies.termsOfService" },
    userAgreement: { icon: Users, labelKey: "admin.settings.policies.userAgreement" },
    refundPolicy: { icon: FileText, labelKey: "admin.settings.policies.refundPolicy" },
    communityGuidelines: { icon: Users, labelKey: "admin.settings.policies.communityGuidelines" },
  };

  const handleSave = async (docKey: string) => {
    setSaving(docKey);
    try {
      await onSave(docKey, policies[docKey]);
      setSaved(docKey); setTimeout(() => setSaved(null), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(null); }
  };

  const updateDoc = (docKey: string, field: string, val: string) => {
    setPolicies((prev: any) => ({
      ...prev,
      [docKey]: { ...prev[docKey], [field]: val },
    }));
  };

  return (
    <div className="space-y-3">
      {Object.entries(DOC_LABELS).map(([key, config]) => {
        const doc = policies[key];
        if (!doc) return null;
        const isActive = activeDoc === key;

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0c0c1d] border border-white/5 rounded-2xl overflow-hidden"
          >
            <div
              className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-white/[0.02]"
              onClick={() => setActiveDoc(isActive ? null : key)}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <config.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{t(config.labelKey)}</p>
                {doc.lastUpdated && <p className="text-[11px] text-white/20 mt-0.5">{t("admin.settings.policies.lastUpdated")}: {new Date(doc.lastUpdated).toLocaleDateString()}</p>}
              </div>
              <StatusBadge status={doc.status || "draft"} />
              {isActive ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </div>

            <AnimatePresence>
              {isActive && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div className="px-6 py-5 border-t border-white/5 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/50">{t("admin.settings.policies.status")}</label>
                      <select
                        className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white focus:outline-none focus:border-primary/50 max-w-xs"
                        value={doc.status || "draft"} onChange={(e) => updateDoc(key, "status", e.target.value)}
                      >
                        <option value="published" className="bg-[#1a1a2e] text-white">{t("admin.settings.policies.published")}</option>
                        <option value="draft" className="bg-[#1a1a2e] text-white">{t("admin.settings.policies.draft")}</option>
                      </select>
                    </div>
                    <InputField
                      label={t("admin.settings.policies.contentEn")}
                      value={doc.contentEn || ""}
                      onChange={(v) => updateDoc(key, "contentEn", v)}
                      multiline rows={10} mono
                    />
                    <InputField
                      label={t("admin.settings.policies.contentAr")}
                      value={doc.contentAr || ""}
                      onChange={(v) => updateDoc(key, "contentAr", v)}
                      multiline rows={10} dir="rtl" mono
                    />
                    <div className="flex justify-end">
                      <SaveButton saving={saving === key} saved={saved === key} onClick={() => handleSave(key)} label={t("admin.settings.save")} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: FEATURED STREAMS (البثوث المميزة)
// ══════════════════════════════════════════════════════════

function FeaturedTab() {
  const { t } = useTranslation();
  const [streams, setStreams] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [tags, setTags] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [featRes, accRes] = await Promise.all([
        adminFeatured.list(),
        fetch("/api/admin/agent-accounts?limit=100", { credentials: "include" }).then(r => r.json()),
      ]);
      if (featRes.success) setStreams(featRes.data || []);
      if (accRes.success) setAccounts(accRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!selectedAccount) return;
    setAdding(true);
    try {
      const tagArr = tags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await adminFeatured.add(selectedAccount, tagArr);
      if (res.success) {
        setStreams(prev => [...prev, res.data]);
        setSelectedAccount("");
        setTags("");
        setShowAddForm(false);
      }
    } catch (e) { console.error(e); }
    finally { setAdding(false); }
  };

  const handleRemove = async (id: string) => {
    try {
      await adminFeatured.remove(id);
      setStreams(prev => prev.filter(s => s.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await adminFeatured.update(id, { isActive: !isActive });
      if (res.success) setStreams(prev => prev.map(s => s.id === id ? { ...s, isActive: !isActive } : s));
    } catch (e) { console.error(e); }
  };

  const handleToggleLive = async (id: string, isLive: boolean) => {
    try {
      const res = await adminFeatured.update(id, { isLive: !isLive });
      if (res.success) setStreams(prev => prev.map(s => s.id === id ? { ...s, isLive: !isLive } : s));
    } catch (e) { console.error(e); }
  };

  // Filter out already-featured accounts
  const availableAccounts = accounts.filter(acc => !streams.find(s => s.accountId === acc.id && s.isActive));

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionCard title={t("admin.settings.featured.title")} icon={Radio}>
        <p className="text-xs text-white/40 -mt-2 mb-4">{t("admin.settings.featured.description")}</p>

        {/* Current featured streams list */}
        <div className="space-y-2">
          {streams.length === 0 && (
            <div className="text-center py-8 text-white/20 text-sm">
              {t("admin.settings.featured.empty")}
            </div>
          )}
          {streams.map((stream, idx) => (
            <div key={stream.id} className="flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl px-4 py-3 transition-colors group">
              <div className="w-6 text-center text-xs font-bold text-white/20">{idx + 1}</div>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                <Video className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white truncate">{stream.displayName}</span>
                  {stream.isLive && (
                    <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <span>@{stream.username}</span>
                  <span>·</span>
                  <span>{stream.agentName}</span>
                  {stream.tags?.length > 0 && (
                    <>
                      <span>·</span>
                      {stream.tags.map((tag: string) => (
                        <span key={tag} className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">#{tag}</span>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Live toggle */}
              <button
                onClick={() => handleToggleLive(stream.id, stream.isLive)}
                title={stream.isLive ? t("admin.settings.featured.setOffline") : t("admin.settings.featured.setLive")}
                className={`p-1.5 rounded-lg transition-colors ${stream.isLive ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-white/5 text-white/20 hover:bg-white/10 hover:text-white/40"}`}
              >
                <Radio className="w-3.5 h-3.5" />
              </button>

              {/* Active toggle */}
              <button
                onClick={() => handleToggle(stream.id, stream.isActive)}
                className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${stream.isActive ? "bg-green-500" : "bg-white/10"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${stream.isActive ? "ltr:left-[18px] rtl:right-[18px]" : "ltr:left-0.5 rtl:right-0.5"}`} />
              </button>

              {/* Remove */}
              <button
                onClick={() => handleRemove(stream.id)}
                className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors w-full justify-center mt-3"
          >
            <Plus className="w-4 h-4" /> {t("admin.settings.featured.addStream")}
          </button>
        ) : (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-primary">{t("admin.settings.featured.addStream")}</h4>
              <button onClick={() => setShowAddForm(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/50">{t("admin.settings.featured.selectAccount")}</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
              >
                <option value="" className="bg-[#1a1a2e] text-white">{t("admin.settings.featured.chooseAccount")}</option>
                {availableAccounts.map(acc => (
                  <option key={acc.id} value={acc.id} className="bg-[#1a1a2e] text-white">
                    {acc.displayName} (@{acc.username}) — {acc.agentName}
                  </option>
                ))}
              </select>
            </div>
            <InputField
              label={t("admin.settings.featured.tags")}
              value={tags}
              onChange={setTags}
              placeholder={t("admin.settings.featured.tagsPlaceholder")}
            />
            <button
              onClick={handleAdd}
              disabled={!selectedAccount || adding}
              className="flex items-center gap-2 px-5 h-10 text-sm font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t("admin.settings.featured.addNow")}
            </button>
          </div>
        )}
      </SectionCard>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0c0c1d] border border-white/5 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-white">{streams.length}</p>
          <p className="text-[11px] text-white/30 font-bold">{t("admin.settings.featured.total")}</p>
        </div>
        <div className="bg-[#0c0c1d] border border-white/5 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-green-400">{streams.filter(s => s.isActive).length}</p>
          <p className="text-[11px] text-white/30 font-bold">{t("admin.settings.featured.active")}</p>
        </div>
        <div className="bg-[#0c0c1d] border border-white/5 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-red-400">{streams.filter(s => s.isLive).length}</p>
          <p className="text-[11px] text-white/30 font-bold">{t("admin.settings.featured.liveNow")}</p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ANNOUNCEMENT POPUP TAB (الإشعار المنبثق)
// ══════════════════════════════════════════════════════════

function AnnouncementPopupTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [data, setData] = useState({
    enabled: true,
    imageUrl: "",
    title: "",
    subtitle: "",
    buttons: [] as { label: string; url: string; style: "primary" | "secondary" }[],
    showOnce: true,
    delaySeconds: 8,
  });

  useEffect(() => {
    setLoading(true);
    adminAnnouncementPopup.get()
      .then(res => { if (res.success && res.data) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminAnnouncementPopup.update(data);
      if (res.success && res.data) {
        setData(res.data as typeof data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const addButton = () => {
    if (data.buttons.length >= 4) return;
    setData(prev => ({
      ...prev,
      buttons: [...prev.buttons, { label: "", url: "", style: "primary" }]
    }));
  };

  const removeButton = (index: number) => {
    setData(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index)
    }));
  };

  const updateButton = (index: number, field: string, value: string) => {
    setData(prev => ({
      ...prev,
      buttons: prev.buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn)
    }));
  };

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-32 animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Enable/Disable */}
      <SectionCard title={t("admin.settings.popup.statusTitle")} icon={Bell}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">{t("admin.settings.popup.enableLabel")}</p>
            <p className="text-xs text-white/30 mt-0.5">{t("admin.settings.popup.enableDesc")}</p>
          </div>
          <button
            onClick={() => setData(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${data.enabled ? "bg-green-500" : "bg-white/10"}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${data.enabled ? "ltr:left-[22px] rtl:right-[22px]" : "ltr:left-0.5 rtl:right-0.5"}`} />
          </button>
        </div>
        
        {/* Show Once */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <div>
            <p className="text-sm font-bold text-white">{t("admin.settings.popup.showOnceLabel")}</p>
            <p className="text-xs text-white/30 mt-0.5">{t("admin.settings.popup.showOnceDesc")}</p>
          </div>
          <button
            onClick={() => setData(prev => ({ ...prev, showOnce: !prev.showOnce }))}
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${data.showOnce ? "bg-green-500" : "bg-white/10"}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${data.showOnce ? "ltr:left-[22px] rtl:right-[22px]" : "ltr:left-0.5 rtl:right-0.5"}`} />
          </button>
        </div>

        {/* Delay */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <InputField
            label={t("admin.settings.popup.delayLabel")}
            value={String(data.delaySeconds)}
            onChange={v => setData(prev => ({ ...prev, delaySeconds: parseInt(v) || 0 }))}
            type="number"
            placeholder="8"
          />
          <p className="text-[10px] text-white/20 mt-1">{t("admin.settings.popup.delayDesc")}</p>
        </div>
      </SectionCard>

      {/* Content */}
      <SectionCard title={t("admin.settings.popup.contentTitle")} icon={ImageIcon}>
        <InputField
          label={t("admin.settings.popup.imageUrl")}
          value={data.imageUrl}
          onChange={v => setData(prev => ({ ...prev, imageUrl: v }))}
          placeholder="https://example.com/image.png"
          dir="ltr"
        />
        {data.imageUrl && (
          <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-white/5 h-40 flex items-center justify-center">
            <img src={data.imageUrl} alt="Preview" className="max-h-full max-w-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <div className="mt-3">
          <InputField
            label={t("admin.settings.popup.titleField")}
            value={data.title}
            onChange={v => setData(prev => ({ ...prev, title: v }))}
            placeholder={t("admin.settings.popup.titlePlaceholder")}
            dir="rtl"
          />
        </div>
        <div className="mt-3">
          <InputField
            label={t("admin.settings.popup.subtitleField")}
            value={data.subtitle}
            onChange={v => setData(prev => ({ ...prev, subtitle: v }))}
            placeholder={t("admin.settings.popup.subtitlePlaceholder")}
            dir="rtl"
            multiline
            rows={2}
          />
        </div>
      </SectionCard>

      {/* Buttons */}
      <SectionCard title={t("admin.settings.popup.buttonsTitle")} icon={MousePointerClick}>
        <div className="space-y-3">
          {data.buttons.map((btn, i) => (
            <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-3 relative group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/40">{t("admin.settings.popup.button")} {i + 1}</span>
                <button
                  onClick={() => removeButton(i)}
                  className="p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <InputField
                label={t("admin.settings.popup.buttonLabel")}
                value={btn.label}
                onChange={v => updateButton(i, "label", v)}
                placeholder={t("admin.settings.popup.buttonLabelPlaceholder")}
                dir="rtl"
              />
              <InputField
                label={t("admin.settings.popup.buttonUrl")}
                value={btn.url}
                onChange={v => updateButton(i, "url", v)}
                placeholder="/wallet  or  https://example.com"
                dir="ltr"
              />
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/50">{t("admin.settings.popup.buttonStyle")}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateButton(i, "style", "primary")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      btn.style === "primary"
                        ? "bg-primary text-white border border-primary/50"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {t("admin.settings.popup.stylePrimary")}
                  </button>
                  <button
                    onClick={() => updateButton(i, "style", "secondary")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      btn.style === "secondary"
                        ? "bg-white/20 text-white border border-white/30"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {t("admin.settings.popup.styleSecondary")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.buttons.length < 4 && (
          <button
            onClick={addButton}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors w-full justify-center mt-3"
          >
            <Plus className="w-4 h-4" /> {t("admin.settings.popup.addButton")}
          </button>
        )}
      </SectionCard>

      {/* Preview */}
      <SectionCard title={t("admin.settings.popup.previewTitle")} icon={Eye}>
        <div className="bg-black/50 rounded-2xl overflow-hidden border border-white/10 max-w-xs mx-auto">
          {/* Image */}
          <div className="h-36 bg-gradient-to-br from-primary/30 via-[#0c0c1d] to-pink-500/20 flex items-center justify-center">
            {data.imageUrl ? (
              <img src={data.imageUrl} alt="Preview" className="max-h-full max-w-full object-contain p-3" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <ImageIcon className="w-10 h-10 text-white/10" />
            )}
          </div>
          <div className="p-4">
            {data.title && <h4 className="text-sm font-black text-white text-center mb-1">{data.title}</h4>}
            {data.subtitle && <p className="text-[11px] text-white/40 text-center mb-3">{data.subtitle}</p>}
            <div className="space-y-2">
              {data.buttons.map((btn, i) => (
                <div
                  key={i}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold text-center ${
                    btn.style === "primary"
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/60 border border-white/10"
                  }`}
                >
                  {btn.label || `Button ${i + 1}`}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 h-11 text-sm font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? t("admin.settings.popup.saved") : t("admin.settings.popup.save")}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PRICING TAB — Voice/Video Call & Message Rates
// ══════════════════════════════════════════════════════════

function PricingTab() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [voiceRate, setVoiceRate] = useState("5");
  const [videoRate, setVideoRate] = useState("10");
  const [messageCost, setMessageCost] = useState("1");

  useEffect(() => {
    fetch("/api/social/pricing", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.voice_call_rate !== undefined) setVoiceRate(String(data.voice_call_rate));
        if (data.video_call_rate !== undefined) setVideoRate(String(data.video_call_rate));
        if (data.message_cost !== undefined) setMessageCost(String(data.message_cost));
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings/system", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          settings: [
            { key: "voice_call_rate", value: voiceRate },
            { key: "video_call_rate", value: videoRate },
            { key: "message_cost", value: messageCost },
          ]
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const pricingItems = [
    {
      icon: Phone,
      iconColor: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      label: t("admin.settings.pricing.voiceCallRate"),
      desc: t("admin.settings.pricing.voiceCallRateDesc"),
      value: voiceRate,
      onChange: setVoiceRate,
    },
    {
      icon: Video,
      iconColor: "text-blue-400",
      bgColor: "bg-blue-400/10",
      label: t("admin.settings.pricing.videoCallRate"),
      desc: t("admin.settings.pricing.videoCallRateDesc"),
      value: videoRate,
      onChange: setVideoRate,
    },
    {
      icon: MessageSquare,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
      label: t("admin.settings.pricing.messageCost"),
      desc: t("admin.settings.pricing.messageCostDesc"),
      value: messageCost,
      onChange: setMessageCost,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-amber-400/5 border border-amber-400/20 rounded-2xl p-4 flex items-start gap-3">
        <Coins className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-amber-400 text-sm font-bold">{t("admin.settings.pricing.title")}</p>
          <p className="text-amber-400/60 text-xs mt-1">{t("admin.settings.pricing.subtitle")}</p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-4">
        {pricingItems.map((item, i) => (
          <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center shrink-0`}>
                <item.icon className={`w-6 h-6 ${item.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{item.label}</p>
                <p className="text-white/40 text-xs mt-1">{item.desc}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="relative">
                    <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.value}
                      onChange={e => item.onChange(e.target.value)}
                      className="w-40 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 pr-10 text-white text-sm font-mono focus:outline-none focus:border-primary/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <span className="text-white/30 text-xs">{t("admin.settings.pricing.coinsUnit")}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 h-11 text-sm font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? t("admin.settings.pricing.saved") : t("admin.settings.pricing.save")}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MILES PRICING TAB — أسعار الأميال
// ══════════════════════════════════════════════════════════

const DEFAULT_MILE_PACKAGES = [
  { id: "miles_10", miles: 10, price: "0.99" },
  { id: "miles_50", miles: 50, price: "3.99" },
  { id: "miles_100", miles: 100, price: "6.99" },
  { id: "miles_250", miles: 250, price: "14.99" },
  { id: "miles_500", miles: 500, price: "24.99" },
  { id: "miles_1000", miles: 1000, price: "44.99" },
];

function MilesPricingTab() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState(DEFAULT_MILE_PACKAGES);
  const [costPerMile, setCostPerMile] = useState("5");

  useEffect(() => {
    setLoading(true);
    fetch("/api/social/miles-pricing", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          if (data.data.cost_per_mile !== undefined) setCostPerMile(String(data.data.cost_per_mile));
          if (data.data.packages?.length) setPackages(data.data.packages);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updatePkg = (idx: number, field: "miles" | "price", val: string) => {
    setPackages(prev => prev.map((p, i) => i === idx ? { ...p, [field]: field === "miles" ? parseInt(val) || 0 : val } : p));
  };

  const addPackage = () => {
    setPackages(prev => [...prev, { id: `miles_custom_${Date.now()}`, miles: 0, price: "0" }]);
  };

  const removePackage = (idx: number) => {
    setPackages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings/miles-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ costPerMile: parseInt(costPerMile) || 5, packages }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-2xl p-4 flex items-start gap-3">
        <Navigation className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-cyan-400 text-sm font-bold">{t("admin.settings.milesPricing.title")}</p>
          <p className="text-cyan-400/60 text-xs mt-1">{t("admin.settings.milesPricing.subtitle")}</p>
        </div>
      </div>

      {/* Cost per mile in coins */}
      <div className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-400/10 flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">{t("admin.settings.milesPricing.costPerMile")}</p>
            <p className="text-white/40 text-xs mt-1">{t("admin.settings.milesPricing.costPerMileDesc")}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative">
                <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                <input
                  type="number" min="0" step="1" value={costPerMile}
                  onChange={e => setCostPerMile(e.target.value)}
                  className="w-40 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 pr-10 text-white text-sm font-mono focus:outline-none focus:border-primary/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <span className="text-white/30 text-xs">{t("admin.settings.pricing.coinsUnit")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Navigation className="w-4 h-4 text-cyan-400" />
            {t("admin.settings.milesPricing.packagesTitle")}
          </h4>
          <button onClick={addPackage} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
            <Plus className="w-3.5 h-3.5" /> {t("admin.settings.milesPricing.addPackage")}
          </button>
        </div>

        {packages.map((pkg, i) => (
          <div key={pkg.id} className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center text-lg shrink-0">🗺️</div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30">{t("admin.settings.milesPricing.milesCount")}</label>
                  <input
                    type="number" min="1" value={pkg.miles}
                    onChange={e => updatePkg(i, "miles", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm font-mono focus:outline-none focus:border-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30">{t("admin.settings.milesPricing.priceUsd")}</label>
                  <input
                    type="number" min="0" step="0.01" value={pkg.price}
                    onChange={e => updatePkg(i, "price", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm font-mono focus:outline-none focus:border-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <button onClick={() => removePackage(i)} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 h-11 text-sm font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? t("admin.settings.pricing.saved") : t("admin.settings.pricing.save")}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// WORLD PRICING TAB
// ══════════════════════════════════════════════════════════

const WORLD_PRICE_TYPES = [
  { key: "spin_cost", icon: Globe, iconColor: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  { key: "gender_both", icon: Users, iconColor: "text-blue-400", bgColor: "bg-blue-400/10" },
  { key: "gender_male", icon: Users, iconColor: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  { key: "gender_female", icon: Users, iconColor: "text-pink-400", bgColor: "bg-pink-400/10" },
  { key: "age_range", icon: Shield, iconColor: "text-amber-400", bgColor: "bg-amber-400/10" },
  { key: "country_specific", icon: Globe, iconColor: "text-purple-400", bgColor: "bg-purple-400/10" },
  { key: "country_all", icon: Globe, iconColor: "text-green-400", bgColor: "bg-green-400/10" },
];

function WorldPricingTab() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    worldAdminApi.getPricing()
      .then((res: any) => {
        const data = res.data || res;
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((p: any) => { map[p.filterType] = String(p.priceCoins || 0); });
          setPrices(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const priceList = WORLD_PRICE_TYPES.map(pt => ({
        filterType: pt.key,
        priceCoins: parseInt(prices[pt.key] || "0", 10),
      }));
      await worldAdminApi.bulkUpdatePricing(priceList);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-2xl p-4 flex items-start gap-3">
        <Globe className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-emerald-400 text-sm font-bold">{t("admin.settings.worldPricing.title")}</p>
          <p className="text-emerald-400/60 text-xs mt-1">{t("admin.settings.worldPricing.subtitle")}</p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-4">
        {WORLD_PRICE_TYPES.map((item, i) => (
          <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center shrink-0`}>
                <item.icon className={`w-6 h-6 ${item.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{t(`admin.settings.worldPricing.${item.key}`)}</p>
                <p className="text-white/40 text-xs mt-1">{t(`admin.settings.worldPricing.${item.key}Desc`)}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="relative">
                    <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={prices[item.key] || "0"}
                      onChange={e => setPrices(prev => ({ ...prev, [item.key]: e.target.value }))}
                      className="w-40 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 pr-10 text-white text-sm font-mono focus:outline-none focus:border-primary/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <span className="text-white/30 text-xs">{t("admin.settings.pricing.coinsUnit")}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 h-11 text-sm font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? t("admin.settings.pricing.saved") : t("admin.settings.pricing.save")}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB: APP DOWNLOAD (تحميل التطبيق)
// ══════════════════════════════════════════════════════════

interface AppDownloadForm {
  enabled: boolean;
  domain: string;
  pwa: { enabled: boolean; url: string; extension: string; description: string };
  apk: { enabled: boolean; url: string; extension: string; description: string };
  aab: { enabled: boolean; url: string; extension: string; description: string };
}

const defaultAppDownload: AppDownloadForm = {
  enabled: true,
  domain: "https://mrco.live",
  pwa: { enabled: true, url: "", extension: "/", description: "" },
  apk: { enabled: false, url: "", extension: "/download/ablox.apk", description: "" },
  aab: { enabled: false, url: "", extension: "/download/ablox.aab", description: "" },
};

function AppDownloadTab({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AppDownloadForm>(defaultAppDownload);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setForm({ ...defaultAppDownload, ...data }); }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const updateVersion = (key: "pwa" | "apk" | "aab", field: string, val: any) => {
    setForm(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
  };

  const versionConfigs: { key: "pwa" | "apk" | "aab"; icon: React.ElementType; color: string; bg: string }[] = [
    { key: "pwa", icon: Globe, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
    { key: "apk", icon: Smartphone, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
    { key: "aab", icon: Store, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  ];

  return (
    <div className="space-y-5">
      {/* Master Toggle */}
      <SectionCard title={t("admin.settings.appDownload.sectionTitle")} icon={Download}>
        <ToggleField
          label={t("admin.settings.appDownload.enableSection")}
          description={t("admin.settings.appDownload.enableSectionDesc")}
          checked={form.enabled}
          onChange={(v) => setForm(prev => ({ ...prev, enabled: v }))}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-white/50">{t("admin.settings.appDownload.domain")}</label>
          <input
            type="url"
            className="w-full bg-white/5 border border-white/10 rounded-xl h-10 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors font-mono"
            value={form.domain}
            onChange={(e) => setForm(prev => ({ ...prev, domain: e.target.value }))}
            placeholder="https://mrco.live"
            dir="ltr"
          />
          <p className="text-[11px] text-white/30 flex items-center gap-1.5 mt-1">
            <Info className="w-3.5 h-3.5 shrink-0" />
            {t("admin.settings.appDownload.domainHint")}
          </p>
        </div>
      </SectionCard>

      {/* Version Cards */}
      {versionConfigs.map(({ key, icon: Icon, color, bg }) => (
        <SectionCard
          key={key}
          title={t(`admin.settings.appDownload.${key}.title`)}
          icon={Icon}
          collapsible
          defaultOpen={form[key].enabled}
        >
          <ToggleField
            label={t(`admin.settings.appDownload.${key}.enable`)}
            description={t(`admin.settings.appDownload.${key}.enableDesc`)}
            checked={form[key].enabled}
            onChange={(v) => updateVersion(key, "enabled", v)}
          />

          {form[key].enabled && (
            <div className="space-y-4 pt-2">
              {/* Extension / Path */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/50">{t("admin.settings.appDownload.extension")}</label>
                <div className="flex items-center gap-0 bg-white/5 border border-white/10 rounded-xl overflow-hidden" dir="ltr">
                  <span className="px-3 py-2.5 text-xs text-white/30 bg-white/5 border-e border-white/10 shrink-0 font-mono">
                    {form.domain}
                  </span>
                  <input
                    type="text"
                    className="flex-1 bg-transparent h-10 px-3 text-sm text-white font-mono focus:outline-none"
                    value={form[key].extension}
                    onChange={(e) => updateVersion(key, "extension", e.target.value)}
                    placeholder="/"
                    dir="ltr"
                  />
                </div>
                <p className="text-[11px] text-white/30">
                  {t("admin.settings.appDownload.fullUrl")}: <code className="text-primary/60 font-mono">{form.domain}{form[key].extension}</code>
                </p>
              </div>

              {/* Direct Download URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/50">{t("admin.settings.appDownload.directUrl")}</label>
                <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden group hover:border-primary/30 transition-colors" dir="ltr">
                  <div className="px-3 flex items-center justify-center bg-white/5 border-e border-white/10">
                    <LinkIcon className="w-4 h-4 text-white/30" />
                  </div>
                  <input
                    type="url"
                    className="flex-1 bg-transparent h-10 px-3 text-sm text-white font-mono focus:outline-none placeholder:text-white/15"
                    value={form[key].url}
                    onChange={(e) => updateVersion(key, "url", e.target.value)}
                    placeholder={`https://mrco.live${form[key].extension}`}
                    dir="ltr"
                  />
                </div>
                <p className="text-[11px] text-white/30">
                  {t("admin.settings.appDownload.directUrlHint")}
                </p>
              </div>

              {/* Description */}
              <InputField
                label={t("admin.settings.appDownload.description")}
                value={form[key].description}
                onChange={(v) => updateVersion(key, "description", v)}
                placeholder={t(`admin.settings.appDownload.${key}.descPlaceholder`)}
                dir="rtl"
              />

              {/* Preview Badge */}
              <div className="mt-3 p-4 bg-black/40 rounded-xl border border-white/5">
                <p className="text-[11px] text-white/30 mb-3">{t("admin.settings.appDownload.preview")}</p>
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${bg}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{t(`admin.settings.appDownload.${key}.title`)}</p>
                    <p className="text-xs text-white/40 truncate mt-0.5">
                      {form[key].description || t(`admin.settings.appDownload.${key}.descPlaceholder`)}
                    </p>
                  </div>
                  <a
                    href={form[key].url || `${form.domain}${form[key].extension}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${bg} ${color} hover:opacity-80`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("admin.settings.appDownload.downloadBtn")}
                  </a>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      ))}

      {/* Save */}
      <SaveButton saving={saving} saved={saved} onClick={handleSave} label={t("admin.settings.save")} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ══════════════════════════════════════════════════════════

const TABS: TabConfig[] = [
  { id: "seo", icon: Search, labelKey: "admin.settings.tabs.seo" },
  { id: "aso", icon: Store, labelKey: "admin.settings.tabs.aso" },
  { id: "socialLogin", icon: Users, labelKey: "admin.settings.tabs.socialLogin" },
  { id: "otp", icon: Shield, labelKey: "admin.settings.tabs.otp" },
  { id: "branding", icon: Palette, labelKey: "admin.settings.tabs.branding" },
  { id: "seoTexts", icon: FileText, labelKey: "admin.settings.tabs.seoTexts" },
  { id: "policies", icon: ScrollText, labelKey: "admin.settings.tabs.policies" },
  { id: "featured", icon: Radio, labelKey: "admin.settings.tabs.featured" },
  { id: "popup", icon: Bell, labelKey: "admin.settings.tabs.popup" },
  { id: "pricing", icon: Coins, labelKey: "admin.settings.tabs.pricing" },
  { id: "milesPricing", icon: Navigation, labelKey: "admin.settings.tabs.milesPricing" },
  { id: "worldPricing", icon: Globe, labelKey: "admin.settings.tabs.worldPricing" },
  { id: "appDownload", icon: Download, labelKey: "admin.settings.tabs.appDownload" },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("seo");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminSettings.getAdvanced();
      if (res.success) setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSeo = async (d: any) => { const res = await adminSettings.updateSeo(d); if (res.success) setData((prev: any) => ({ ...prev, seo: res.data })); };
  const handleSaveAso = async (d: any) => { const res = await adminSettings.updateAso(d); if (res.success) setData((prev: any) => ({ ...prev, aso: res.data })); };
  const handleSaveSocialLogin = async (provider: string, d: any) => { const res = await adminSettings.updateSocialLogin(provider, d); if (res.success) setData((prev: any) => ({ ...prev, socialLogin: res.data })); };
  const handleSaveOtp = async (d: any) => { const res = await adminSettings.updateOtp(d); if (res.success) setData((prev: any) => ({ ...prev, otp: res.data })); };
  const handleSaveBranding = async (d: any) => { const res = await adminSettings.updateBranding(d); if (res.success) setData((prev: any) => ({ ...prev, branding: res.data })); };
  const handleSaveSeoTexts = async (d: any) => { const res = await adminSettings.updateSeoTexts(d); if (res.success) setData((prev: any) => ({ ...prev, seoTexts: res.data })); };
  const handleSavePolicies = async (docKey: string, d: any) => { const res = await adminSettings.updatePolicies(docKey, d); if (res.success) setData((prev: any) => ({ ...prev, policies: res.data })); };
  const handleSaveAppDownload = async (d: any) => { const res = await adminSettings.updateAppDownload(d); if (res.success) setData((prev: any) => ({ ...prev, appDownload: res.data })); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Outfit" }}>{t("admin.settings.title")}</h1>
          <p className="text-white/40 text-sm mt-1">{t("admin.settings.subtitle")}</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 h-10 text-sm rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> {t("admin.settings.refresh")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 h-10 text-sm font-bold rounded-xl whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? "bg-primary/20 text-primary border border-primary/20"
                  : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white/60"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#0c0c1d] border border-white/5 rounded-2xl h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "seo" && <SeoTab data={data?.seo} onSave={handleSaveSeo} />}
            {activeTab === "aso" && <AsoTab data={data?.aso} onSave={handleSaveAso} />}
            {activeTab === "socialLogin" && <SocialLoginTab data={data?.socialLogin} onSave={handleSaveSocialLogin} />}
            {activeTab === "otp" && <OtpTab data={data?.otp} onSave={handleSaveOtp} />}
            {activeTab === "branding" && <BrandingTab data={data?.branding} onSave={handleSaveBranding} />}
            {activeTab === "seoTexts" && <SeoTextsTab data={data?.seoTexts} onSave={handleSaveSeoTexts} />}
            {activeTab === "policies" && <PoliciesTab data={data?.policies} onSave={handleSavePolicies} />}
            {activeTab === "featured" && <FeaturedTab />}
            {activeTab === "popup" && <AnnouncementPopupTab />}
            {activeTab === "pricing" && <PricingTab />}
            {activeTab === "milesPricing" && <MilesPricingTab />}
            {activeTab === "worldPricing" && <WorldPricingTab />}
            {activeTab === "appDownload" && <AppDownloadTab data={data?.appDownload} onSave={handleSaveAppDownload} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
