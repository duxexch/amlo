import { toast } from "sonner";

export type AppNotificationType =
  | "message"
  | "call"
  | "friend-request"
  | "admin"
  | "system";

export type AppNotificationEntry = {
  id: string;
  type: AppNotificationType;
  title?: string;
  body?: string;
  titleKey?: string;
  bodyKey?: string;
  params?: Record<string, string | number>;
  createdAt: number;
  url?: string;
  persistent?: boolean;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

type NotificationInput = Omit<AppNotificationEntry, "id" | "createdAt">;

const STORAGE_KEY = "ablox_notification_history_v1";
const MAX_ITEMS = 120;

let permissionRequested = false;
let audioCtx: AudioContext | null = null;
let history: AppNotificationEntry[] = [];
const listeners = new Set<(entries: AppNotificationEntry[]) => void>();

function emit() {
  const snapshot = [...history];
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // Ignore listener errors.
    }
  });
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      history = parsed
        .filter((e) => e && typeof e === "object" && e.id && e.createdAt)
        .slice(0, MAX_ITEMS);
    }
  } catch {
    history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
  } catch {
    // Ignore storage errors.
  }
}

function ensureAudioContext() {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

function playTone(freq: number, duration: number, gain = 0.08, startDelay = 0) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + startDelay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function playNotificationSound(type: AppNotificationType) {
  try {
    if (type === "call") {
      playTone(740, 0.16, 0.09, 0);
      playTone(880, 0.16, 0.09, 0.19);
      playTone(988, 0.2, 0.1, 0.39);
      return;
    }

    if (type === "admin") {
      playTone(520, 0.12, 0.08, 0);
      playTone(660, 0.12, 0.08, 0.14);
      return;
    }

    if (type === "friend-request") {
      playTone(480, 0.1, 0.07, 0);
      playTone(620, 0.14, 0.07, 0.12);
      return;
    }

    playTone(560, 0.09, 0.07, 0);
    playTone(760, 0.12, 0.07, 0.1);
  } catch {
    // Ignore audio errors.
  }
}

export function playNotificationCue(type: AppNotificationType) {
  playNotificationSound(type);
}

function canUseBrowserNotification(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

export async function ensureForegroundNotificationPermission() {
  if (!canUseBrowserNotification()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (permissionRequested) return Notification.permission;

  permissionRequested = true;
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

function showBrowserNotification(entry: AppNotificationEntry) {
  if (!canUseBrowserNotification()) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(entry.title || "Ablox", {
      body: entry.body || "",
      icon: "/icons/icon-192x192.png",
      tag: `ablox-${entry.type}`,
      requireInteraction: Boolean(entry.persistent),
      data: { url: entry.url || "/" },
    });
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore focus errors.
      }
      if (entry.url) window.location.href = entry.url;
      notif.close();
    };
  } catch {
    // Ignore browser notification failures.
  }
}

export function publishNotification(input: NotificationInput) {
  const entry: AppNotificationEntry = {
    ...input,
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  };

  history = [entry, ...history].slice(0, MAX_ITEMS);
  saveHistory();
  emit();

  playNotificationSound(entry.type);

  const toastTitle = entry.title || "Ablox";
  const toastBody = entry.body || "";
  if (toastBody) {
    toast.info(toastTitle, { description: toastBody });
  } else {
    toast.info(toastTitle);
  }

  if (document.hidden || entry.persistent) {
    showBrowserNotification(entry);
  }

  return entry;
}

export function useNotificationHistoryListener(listener: (entries: AppNotificationEntry[]) => void) {
  listeners.add(listener);
  listener([...history]);
  return () => {
    listeners.delete(listener);
  };
}

export function clearNotificationHistory() {
  history = [];
  saveHistory();
  emit();
}

export function initNotificationCenter() {
  if (typeof window === "undefined") return;
  loadHistory();
  emit();
}

export function getNotificationHistory() {
  return [...history];
}
