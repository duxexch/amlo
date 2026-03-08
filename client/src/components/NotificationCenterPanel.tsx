import { useEffect, useMemo, useState } from "react";
import { Bell, X, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type AppNotificationEntry,
  clearNotificationHistory,
  useNotificationHistoryListener,
} from "@/lib/notificationCenter";

const MSG: Record<string, Record<string, string>> = {
  ar: {
    "notify.message.title": "رسالة جديدة",
    "notify.message.body": "أرسل {{name}} رسالة جديدة",
    "notify.call.title": "مكالمة واردة",
    "notify.call.body": "{{name}} يتصل بك الآن",
    "notify.friend.title": "طلب صداقة",
    "notify.friend.body": "{{name}} أرسل لك طلب صداقة",
    "notify.admin.title": "تنبيه إداري",
    "notify.admin.body": "تحديث جديد في لوحة الإدارة",
    "notify.system.title": "تحديث النظام",
    "notify.system.body": "هناك تحديث جديد",
  },
  en: {
    "notify.message.title": "New Message",
    "notify.message.body": "{{name}} sent you a new message",
    "notify.call.title": "Incoming Call",
    "notify.call.body": "{{name}} is calling you now",
    "notify.friend.title": "Friend Request",
    "notify.friend.body": "{{name}} sent you a friend request",
    "notify.admin.title": "Admin Alert",
    "notify.admin.body": "A new admin dashboard update arrived",
    "notify.system.title": "System Update",
    "notify.system.body": "There is a new update",
  },
};

function translateTemplate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)),
    template,
  );
}

function resolveText(entry: AppNotificationEntry, lang: string) {
  const baseLang = lang.startsWith("ar") ? "ar" : "en";
  const dict = MSG[baseLang] || MSG.en;

  const titleTemplate = (entry.titleKey && dict[entry.titleKey]) || entry.title || "Ablox";
  const bodyTemplate = (entry.bodyKey && dict[entry.bodyKey]) || entry.body || "";

  return {
    title: translateTemplate(titleTemplate, entry.params),
    body: translateTemplate(bodyTemplate, entry.params),
  };
}

export function NotificationCenterPanel() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AppNotificationEntry[]>([]);

  useEffect(() => {
    return useNotificationHistoryListener(setEntries);
  }, []);

  const rendered = useMemo(
    () => entries.map((entry) => ({ ...entry, ...resolveText(entry, i18n.language) })),
    [entries, i18n.language],
  );

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-[95] w-11 h-11 rounded-full bg-[#101026] border border-white/15 text-white/80 hover:text-white hover:bg-[#161633] shadow-xl flex items-center justify-center"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {entries.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {Math.min(entries.length, 99)}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 left-5 z-[95] w-[min(92vw,420px)] max-h-[70vh] bg-[#0b0b1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
            <span className="text-sm font-bold text-white/85">Notifications</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearNotificationHistory}
                className="p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/10"
                title="Clear"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/10"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            {rendered.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/35 text-sm">No notifications yet</div>
            ) : (
              rendered.map((n) => (
                <div key={n.id} className="px-3 py-2.5 border-b border-white/5">
                  <p className="text-sm font-bold text-white/85">{n.title}</p>
                  {n.body && <p className="text-xs text-white/55 mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-white/30 mt-1">{new Date(n.createdAt).toLocaleString(i18n.language)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
