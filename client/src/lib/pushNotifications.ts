let subscriptionInFlight: Promise<boolean> | null = null;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function ensurePushSubscription(): Promise<boolean> {
    if (subscriptionInFlight) return subscriptionInFlight;

    subscriptionInFlight = (async () => {
        if (typeof window === "undefined") return false;
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
        if (Notification.permission !== "granted") return false;

        try {
            const reg = await navigator.serviceWorker.ready;

            const keyRes = await fetch("/api/push/vapid-key", { credentials: "include" });
            const keyJson = await keyRes.json().catch(() => null);
            if (!keyRes.ok || !keyJson?.success || !keyJson?.data?.publicKey) return false;

            const appServerKey = urlBase64ToUint8Array(keyJson.data.publicKey);
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: appServerKey as unknown as BufferSource,
                });
            }

            const saveRes = await fetch("/api/push/subscribe", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sub),
            });

            const saveJson = await saveRes.json().catch(() => null);
            return Boolean(saveRes.ok && saveJson?.success);
        } catch {
            return false;
        } finally {
            subscriptionInFlight = null;
        }
    })();

    return subscriptionInFlight;
}
