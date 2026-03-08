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
  isRead?: boolean;
  readAt?: number;
};

type NotificationInput = Omit<AppNotificationEntry, "id" | "createdAt">;

const STORAGE_KEY = "ablox_notification_history_v1";
const MAX_ITEMS = 120;
const SOUND_CONFIG_TTL_MS = 2 * 60 * 1000;

let permissionRequested = false;
let audioCtx: AudioContext | null = null;
let history: AppNotificationEntry[] = [];
const listeners = new Set<(entries: AppNotificationEntry[]) => void>();

type SoundSlot = {
  enabled: boolean;
  kind: "tone" | "file";
  mediaType: "audio" | "video" | "voice";
  url: string;
  volume: number;
};

type SoundConfigMap = Record<AppNotificationType, SoundSlot>;

const DEFAULT_SOUND_SLOT: SoundSlot = {
  enabled: false,
  kind: "tone",
  mediaType: "audio",
  url: "",
  volume: 1,
};

let soundConfig: SoundConfigMap = {
  message: { ...DEFAULT_SOUND_SLOT },
  call: { ...DEFAULT_SOUND_SLOT },
  "friend-request": { ...DEFAULT_SOUND_SLOT },
  admin: { ...DEFAULT_SOUND_SLOT },
  system: { ...DEFAULT_SOUND_SLOT },
};
let soundConfigLoadedAt = 0;

async function fetchInboxFromServer(limit = MAX_ITEMS): Promise<AppNotificationEntry[] | null> {
  try {
    const res = await fetch(`/api/auth/notifications/inbox?limit=${Math.max(1, Math.min(limit, MAX_ITEMS))}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json?.success || !json?.data?.items || !Array.isArray(json.data.items)) {
      return null;
    }
    return json.data.items as AppNotificationEntry[];
  } catch {
    return null;
  }
}

async function pushInboxItemToServer(entry: AppNotificationEntry): Promise<void> {
  try {
    await fetch("/api/auth/notifications/inbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {
    // Ignore sync failures and keep local inbox functional.
  }
}

async function markInboxReadOnServer(ids?: string[]): Promise<void> {
  try {
    await fetch("/api/auth/notifications/inbox/mark-read", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [] }),
    });
  } catch {
    // Ignore sync failures and keep local inbox functional.
  }
}

async function clearInboxOnServer(): Promise<void> {
  try {
    await fetch("/api/auth/notifications/inbox", {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // Ignore sync failures and keep local inbox functional.
  }
}

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

async function refreshNotificationSoundConfig(force = false) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (!force && soundConfigLoadedAt > 0 && now - soundConfigLoadedAt < SOUND_CONFIG_TTL_MS) return;

  try {
    const res = await fetch("/api/notification-sounds", { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json?.success || !json?.data) return;

    const incoming = json.data as Record<string, Partial<SoundSlot>>;
    const normalizeSlot = (slot?: Partial<SoundSlot>): SoundSlot => ({
      enabled: Boolean(slot?.enabled),
      kind: slot?.kind === "file" ? "file" : "tone",
      mediaType: slot?.mediaType === "video" || slot?.mediaType === "voice" ? slot.mediaType : "audio",
      url: typeof slot?.url === "string" ? slot.url : "",
      volume: typeof slot?.volume === "number" ? Math.max(0, Math.min(1, slot.volume)) : 1,
    });

    soundConfig = {
      message: normalizeSlot(incoming.message),
      call: normalizeSlot(incoming.call),
      "friend-request": normalizeSlot(incoming["friend-request"]),
      admin: normalizeSlot(incoming.admin),
      system: normalizeSlot(incoming.system),
    };
    soundConfigLoadedAt = Date.now();
  } catch {
    // Ignore config fetch errors.
  }
}

function playMediaFile(url: string, mediaType: SoundSlot["mediaType"], volume: number) {
  if (typeof window === "undefined") return;

  const isVideo = mediaType === "video";
  const media = document.createElement(isVideo ? "video" : "audio");
  media.src = url;
  media.preload = "auto";
  media.volume = Math.max(0, Math.min(1, volume));

  if (isVideo) {
    (media as HTMLVideoElement).playsInline = true;
    media.style.position = "fixed";
    media.style.width = "1px";
    media.style.height = "1px";
    media.style.opacity = "0";
    media.style.pointerEvents = "none";
    media.style.left = "-9999px";
    document.body.appendChild(media);
  }

  const cleanup = () => {
    media.pause();
    media.removeAttribute("src");
    media.load();
    if (isVideo && media.parentElement) {
      media.parentElement.removeChild(media);
    }
  };

  media.onended = cleanup;
  media.onerror = cleanup;
  void media.play().catch(() => {
    cleanup();
  });
}

function playNotificationSound(type: AppNotificationType) {
  try {
    const slot = soundConfig[type];
    if (slot?.enabled && slot.kind === "file" && slot.url) {
      playMediaFile(slot.url, slot.mediaType, slot.volume);
      return;
    }

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
  void refreshNotificationSoundConfig();
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
    isRead: false,
  };

  history = [entry, ...history].slice(0, MAX_ITEMS);
  saveHistory();
  emit();

  void refreshNotificationSoundConfig();
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

  void pushInboxItemToServer(entry);

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
  void clearInboxOnServer();
}

export function initNotificationCenter() {
  if (typeof window === "undefined") return;
  loadHistory();
  emit();
  void refreshNotificationSoundConfig(true);
  void syncNotificationInboxFromServer();
}

export function getNotificationHistory() {
  return [...history];
}

export async function syncNotificationInboxFromServer() {
  const serverItems = await fetchInboxFromServer(MAX_ITEMS);
  if (!serverItems) return;
  history = [...serverItems].slice(0, MAX_ITEMS);
  saveHistory();
  emit();
}

export function markNotificationHistoryRead(ids?: string[]) {
  const set = new Set((ids || []).filter(Boolean));
  const markAll = set.size === 0;
  const now = Date.now();
  let changed = false;

  history = history.map((item) => {
    if (item.isRead) return item;
    if (markAll || set.has(item.id)) {
      changed = true;
      return { ...item, isRead: true, readAt: now };
    }
    return item;
  });

  if (changed) {
    saveHistory();
    emit();
  }
  void markInboxReadOnServer(ids);
}
