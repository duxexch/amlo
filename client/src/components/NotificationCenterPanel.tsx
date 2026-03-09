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
    "notify.friendAccepted.title": "تم قبول طلب الصداقة",
    "notify.friendAccepted.body": "{{name}} قبل طلب صداقتك",
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
    "notify.friendAccepted.title": "Friend Request Accepted",
    "notify.friendAccepted.body": "{{name}} accepted your friend request",
    "notify.admin.title": "Admin Alert",
    "notify.admin.body": "A new admin dashboard update arrived",
    "notify.system.title": "System Update",
    "notify.system.body": "There is a new update",
  },
  fr: {
    "notify.message.title": "Nouveau message",
    "notify.message.body": "{{name}} vous a envoyé un message",
    "notify.call.title": "Appel entrant",
    "notify.call.body": "{{name}} vous appelle",
    "notify.friend.title": "Demande d'ami",
    "notify.friend.body": "{{name}} vous a envoyé une demande d'ami",
    "notify.friendAccepted.title": "Demande d'ami acceptée",
    "notify.friendAccepted.body": "{{name}} a accepté votre demande d'ami",
    "notify.admin.title": "Alerte admin",
    "notify.admin.body": "Nouvelle mise à jour du tableau de bord",
    "notify.system.title": "Mise à jour système",
    "notify.system.body": "Une nouvelle mise à jour est disponible",
  },
  es: {
    "notify.message.title": "Nuevo mensaje",
    "notify.message.body": "{{name}} te envió un mensaje",
    "notify.call.title": "Llamada entrante",
    "notify.call.body": "{{name}} te está llamando",
    "notify.friend.title": "Solicitud de amistad",
    "notify.friend.body": "{{name}} te envió una solicitud de amistad",
    "notify.friendAccepted.title": "Solicitud de amistad aceptada",
    "notify.friendAccepted.body": "{{name}} aceptó tu solicitud de amistad",
    "notify.admin.title": "Alerta de admin",
    "notify.admin.body": "Nueva actualización del panel de administración",
    "notify.system.title": "Actualización del sistema",
    "notify.system.body": "Hay una nueva actualización",
  },
  de: {
    "notify.message.title": "Neue Nachricht",
    "notify.message.body": "{{name}} hat dir eine Nachricht gesendet",
    "notify.call.title": "Eingehender Anruf",
    "notify.call.body": "{{name}} ruft dich an",
    "notify.friend.title": "Freundschaftsanfrage",
    "notify.friend.body": "{{name}} hat dir eine Freundschaftsanfrage gesendet",
    "notify.friendAccepted.title": "Freundschaftsanfrage akzeptiert",
    "notify.friendAccepted.body": "{{name}} hat deine Freundschaftsanfrage akzeptiert",
    "notify.admin.title": "Admin-Warnung",
    "notify.admin.body": "Neues Dashboard-Update",
    "notify.system.title": "Systemaktualisierung",
    "notify.system.body": "Es gibt ein neues Update",
  },
  tr: {
    "notify.message.title": "Yeni mesaj",
    "notify.message.body": "{{name}} sana bir mesaj gönderdi",
    "notify.call.title": "Gelen arama",
    "notify.call.body": "{{name}} seni arıyor",
    "notify.friend.title": "Arkadaşlık isteği",
    "notify.friend.body": "{{name}} sana arkadaşlık isteği gönderdi",
    "notify.friendAccepted.title": "Arkadaşlık isteği kabul edildi",
    "notify.friendAccepted.body": "{{name}} arkadaşlık isteğini kabul etti",
    "notify.admin.title": "Yönetici uyarısı",
    "notify.admin.body": "Yeni yönetim paneli güncellemesi",
    "notify.system.title": "Sistem güncellemesi",
    "notify.system.body": "Yeni bir güncelleme var",
  },
  ur: {
    "notify.message.title": "نیا پیغام",
    "notify.message.body": "{{name}} نے آپ کو پیغام بھیجا",
    "notify.call.title": "آنے والی کال",
    "notify.call.body": "{{name}} آپ کو کال کر رہا ہے",
    "notify.friend.title": "دوستی کی درخواست",
    "notify.friend.body": "{{name}} نے آپ کو دوستی کی درخواست بھیجی",
    "notify.friendAccepted.title": "دوستی کی درخواست قبول",
    "notify.friendAccepted.body": "{{name}} نے آپ کی دوستی کی درخواست قبول کر لی",
    "notify.admin.title": "انتظامی انتباہ",
    "notify.admin.body": "نئی انتظامی اپ ڈیٹ",
    "notify.system.title": "سسٹم اپ ڈیٹ",
    "notify.system.body": "ایک نئی اپ ڈیٹ دستیاب ہے",
  },
  hi: {
    "notify.message.title": "नया संदेश",
    "notify.message.body": "{{name}} ने आपको संदेश भेजा",
    "notify.call.title": "आने वाली कॉल",
    "notify.call.body": "{{name}} आपको कॉल कर रहा है",
    "notify.friend.title": "मित्रता अनुरोध",
    "notify.friend.body": "{{name}} ने आपको मित्रता अनुरोध भेजा",
    "notify.friendAccepted.title": "मित्रता अनुरोध स्वीकृत",
    "notify.friendAccepted.body": "{{name}} ने आपका मित्रता अनुरोध स्वीकार किया",
    "notify.admin.title": "व्यवस्थापक चेतावनी",
    "notify.admin.body": "नया डैशबोर्ड अपडेट",
    "notify.system.title": "सिस्टम अपडेट",
    "notify.system.body": "एक नया अपडेट उपलब्ध है",
  },
  zh: {
    "notify.message.title": "新消息",
    "notify.message.body": "{{name}} 给你发了一条消息",
    "notify.call.title": "来电",
    "notify.call.body": "{{name}} 正在呼叫你",
    "notify.friend.title": "好友请求",
    "notify.friend.body": "{{name}} 向你发送了好友请求",
    "notify.friendAccepted.title": "好友请求已接受",
    "notify.friendAccepted.body": "{{name}} 接受了你的好友请求",
    "notify.admin.title": "管理员提醒",
    "notify.admin.body": "新的管理面板更新",
    "notify.system.title": "系统更新",
    "notify.system.body": "有新的更新可用",
  },
  ja: {
    "notify.message.title": "新しいメッセージ",
    "notify.message.body": "{{name}} からメッセージが届きました",
    "notify.call.title": "着信",
    "notify.call.body": "{{name}} から電話がかかっています",
    "notify.friend.title": "友達リクエスト",
    "notify.friend.body": "{{name}} から友達リクエストが届きました",
    "notify.friendAccepted.title": "友達リクエスト承認",
    "notify.friendAccepted.body": "{{name}} があなたの友達リクエストを承認しました",
    "notify.admin.title": "管理者アラート",
    "notify.admin.body": "新しいダッシュボード更新",
    "notify.system.title": "システム更新",
    "notify.system.body": "新しい更新があります",
  },
  ko: {
    "notify.message.title": "새 메시지",
    "notify.message.body": "{{name}} 님이 메시지를 보냈습니다",
    "notify.call.title": "수신 전화",
    "notify.call.body": "{{name}} 님이 전화하고 있습니다",
    "notify.friend.title": "친구 요청",
    "notify.friend.body": "{{name}} 님이 친구 요청을 보냈습니다",
    "notify.friendAccepted.title": "친구 요청 수락됨",
    "notify.friendAccepted.body": "{{name}} 님이 친구 요청을 수락했습니다",
    "notify.admin.title": "관리자 알림",
    "notify.admin.body": "새 대시보드 업데이트",
    "notify.system.title": "시스템 업데이트",
    "notify.system.body": "새 업데이트가 있습니다",
  },
  pt: {
    "notify.message.title": "Nova mensagem",
    "notify.message.body": "{{name}} enviou uma mensagem",
    "notify.call.title": "Chamada recebida",
    "notify.call.body": "{{name}} está ligando para você",
    "notify.friend.title": "Pedido de amizade",
    "notify.friend.body": "{{name}} enviou um pedido de amizade",
    "notify.friendAccepted.title": "Pedido de amizade aceito",
    "notify.friendAccepted.body": "{{name}} aceitou seu pedido de amizade",
    "notify.admin.title": "Alerta de admin",
    "notify.admin.body": "Nova atualização do painel",
    "notify.system.title": "Atualização do sistema",
    "notify.system.body": "Uma nova atualização está disponível",
  },
  ru: {
    "notify.message.title": "Новое сообщение",
    "notify.message.body": "{{name}} отправил вам сообщение",
    "notify.call.title": "Входящий звонок",
    "notify.call.body": "{{name}} звонит вам",
    "notify.friend.title": "Запрос в друзья",
    "notify.friend.body": "{{name}} отправил вам запрос в друзья",
    "notify.friendAccepted.title": "Запрос в друзья принят",
    "notify.friendAccepted.body": "{{name}} принял ваш запрос в друзья",
    "notify.admin.title": "Уведомление администратора",
    "notify.admin.body": "Новое обновление панели управления",
    "notify.system.title": "Обновление системы",
    "notify.system.body": "Доступно новое обновление",
  },
  id: {
    "notify.message.title": "Pesan baru",
    "notify.message.body": "{{name}} mengirim pesan",
    "notify.call.title": "Panggilan masuk",
    "notify.call.body": "{{name}} sedang menelepon Anda",
    "notify.friend.title": "Permintaan pertemanan",
    "notify.friend.body": "{{name}} mengirim permintaan pertemanan",
    "notify.friendAccepted.title": "Permintaan pertemanan diterima",
    "notify.friendAccepted.body": "{{name}} menerima permintaan pertemanan Anda",
    "notify.admin.title": "Peringatan admin",
    "notify.admin.body": "Pembaruan dasbor baru",
    "notify.system.title": "Pembaruan sistem",
    "notify.system.body": "Ada pembaruan baru tersedia",
  },
  fa: {
    "notify.message.title": "پیام جدید",
    "notify.message.body": "{{name}} پیامی برای شما ارسال کرد",
    "notify.call.title": "تماس ورودی",
    "notify.call.body": "{{name}} با شما تماس می‌گیرد",
    "notify.friend.title": "درخواست دوستی",
    "notify.friend.body": "{{name}} درخواست دوستی ارسال کرد",
    "notify.friendAccepted.title": "درخواست دوستی پذیرفته شد",
    "notify.friendAccepted.body": "{{name}} درخواست دوستی شما را پذیرفت",
    "notify.admin.title": "هشدار مدیر",
    "notify.admin.body": "به‌روزرسانی جدید پنل مدیریت",
    "notify.system.title": "به‌روزرسانی سیستم",
    "notify.system.body": "یک به‌روزرسانی جدید موجود است",
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
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    markNotificationHistoryRead([n.id]);
                    if (n.url) {
                      window.location.href = n.url;
                      setOpen(false);
                    }
                  }}
                  className={`w-full text-start px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors ${n.isRead ? "opacity-75" : ""}`}
                >
                  <p className="text-sm font-bold text-white/85">{n.title}</p>
                  {n.body && <p className="text-xs text-white/55 mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-white/30 mt-1">{new Date(n.createdAt).toLocaleString(i18n.language)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
