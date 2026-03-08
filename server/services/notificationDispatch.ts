import { createLogger } from "../logger";
import { storage } from "../storage";
import { sendPushToUser } from "./pushNotification";

const notificationLog = createLogger("notifications");

export type NotificationPreferenceKey =
    | "messages"
    | "calls"
    | "friendRequests"
    | "gifts"
    | "streams"
    | "systemUpdates"
    | "marketing";

export type LocalizedPushJob = {
    userId: string;
    preferenceKey: NotificationPreferenceKey;
    kind: "message" | "call" | "friend";
    idempotencyKey?: string;
    actorName?: string;
    bodyPreview?: string;
    url: string;
    persistent?: boolean;
};

function sanitizeNotificationText(input: unknown, maxLen = 120): string {
    const text = String(input || "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!text) return "";
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}...` : text;
}

function isEnglishLang(value: unknown): boolean {
    const lang = String(value || "").toLowerCase();
    return lang.startsWith("en");
}

export async function sendLocalizedPush(job: LocalizedPushJob): Promise<void> {
    const { userId, preferenceKey, kind, actorName, bodyPreview, url, persistent } = job;

    try {
        const prefs = await storage.getNotificationPreferences(userId);
        if (prefs && prefs[preferenceKey] === false) return;

        const actor = sanitizeNotificationText(actorName || "User", 50);
        const preview = sanitizeNotificationText(bodyPreview || "", 120);
        const en = isEnglishLang(prefs?.chatTranslateLang);

        let title = "Ablox";
        let body = "";
        let tag = "ablox-system";
        let requireInteraction = false;

        if (kind === "message") {
            title = en ? "New Message" : "رسالة جديدة";
            body = preview || (en ? `${actor} sent you a new message` : `${actor} أرسل لك رسالة جديدة`);
            tag = "ablox-message";
        } else if (kind === "call") {
            title = en ? "Incoming Call" : "مكالمة واردة";
            body = en ? `${actor} is calling you now` : `${actor} يتصل بك الآن`;
            tag = "ablox-call";
            requireInteraction = true;
        } else if (kind === "friend") {
            title = en ? "Friend Request" : "طلب صداقة";
            body = en ? `${actor} sent you a friend request` : `${actor} أرسل لك طلب صداقة`;
            tag = "ablox-friend";
        }

        await sendPushToUser(userId, {
            title,
            body,
            tag,
            url,
            data: {
                type: kind,
                requireInteraction: persistent || requireInteraction,
                lang: en ? "en" : "ar",
                openActionTitle: en ? "Open" : "فتح",
                dismissActionTitle: en ? "Dismiss" : "تجاهل",
            },
        });
    } catch (err: any) {
        notificationLog.warn(`Localized push failed for user ${userId}: ${err?.message || "unknown error"}`);
    }
}
