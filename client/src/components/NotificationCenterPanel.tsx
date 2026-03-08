import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, X, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type AppNotificationEntry,
  clearNotificationHistory,
  markNotificationHistoryRead,
  syncNotificationInboxFromServer,
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
  const [fabPos, setFabPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 16 };
    try {
      const raw = localStorage.getItem("ablox_notification_fab_pos_v1");
      if (!raw) return { x: 16, y: 16 };
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      return {
        x: Number.isFinite(parsed.x) ? Number(parsed.x) : 16,
        y: Number.isFinite(parsed.y) ? Number(parsed.y) : 16,
      };
    } catch {
      return { x: 16, y: 16 };
    }
  });

  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    moved: false,
  });

  const clampFabPos = (x: number, y: number) => {
    const size = 44; // w-11 h-11
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - size - margin);
    const maxY = Math.max(margin, window.innerHeight - size - margin);
    return {
      x: Math.min(Math.max(x, margin), maxX),
      y: Math.min(Math.max(y, margin), maxY),
    };
  };

  useEffect(() => {
    return useNotificationHistoryListener(setEntries);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ablox_notification_fab_pos_v1", JSON.stringify(fabPos));
    } catch {
      // Ignore storage errors.
    }
  }, [fabPos]);

  useEffect(() => {
    const onResize = () => {
      setFabPos((prev) => clampFabPos(prev.x, prev.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== e.pointerId) return;

      const next = clampFabPos(e.clientX - drag.offsetX, e.clientY - drag.offsetY);
      setFabPos(next);

      if (!drag.moved) {
        const dx = Math.abs(e.movementX);
        const dy = Math.abs(e.movementY);
        if (dx > 1 || dy > 1) drag.moved = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== e.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const rendered = useMemo(
    () => entries.map((entry) => ({ ...entry, ...resolveText(entry, i18n.language) })),
    [entries, i18n.language],
  );
  const unreadCount = useMemo(() => entries.reduce((sum, item) => sum + (item.isRead ? 0 : 1), 0), [entries]);

  useEffect(() => {
    void syncNotificationInboxFromServer();
  }, []);

  useEffect(() => {
    if (!open || unreadCount === 0) return;
    markNotificationHistoryRead();
  }, [open, unreadCount]);

  return (
    <>
      <button
        onClick={() => {
          if (dragRef.current.moved) {
            dragRef.current.moved = false;
            return;
          }
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => {
          dragRef.current.active = true;
          dragRef.current.pointerId = e.pointerId;
          dragRef.current.offsetX = e.clientX - fabPos.x;
          dragRef.current.offsetY = e.clientY - fabPos.y;
          dragRef.current.moved = false;
        }}
        style={{ left: `${fabPos.x}px`, top: `${fabPos.y}px` }}
        className="fixed z-[95] w-11 h-11 rounded-full bg-[#101026] border border-white/15 text-white/80 hover:text-white hover:bg-[#161633] shadow-xl flex items-center justify-center touch-none select-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {Math.min(unreadCount, 99)}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{ left: `${fabPos.x}px`, top: `${fabPos.y + 52}px` }}
          className="fixed z-[95] w-[min(92vw,420px)] max-h-[70vh] bg-[#0b0b1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
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
                <div key={n.id} className={`px-3 py-2.5 border-b border-white/5 ${n.isRead ? "opacity-75" : ""}`}>
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
