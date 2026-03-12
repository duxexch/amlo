/**
 * Active Call Store — حالة المكالمة النشطة
 * ════════════════════════════════════════
 * Lightweight global store so the floating mini call bar
 * in App.tsx can show when a call is minimized.
 */

type ActiveCallInfo = {
    callId: string;
    userId: string;
    callType: "voice" | "video";
    displayName: string;
    isMinimized: boolean;
};

type Listener = () => void;

let activeCall: ActiveCallInfo | null = null;
const listeners = new Set<Listener>();

function notify() {
    listeners.forEach((fn) => fn());
}

export const activeCallStore = {
    get: () => activeCall,

    minimize(info: Omit<ActiveCallInfo, "isMinimized">) {
        activeCall = { ...info, isMinimized: true };
        notify();
    },

    restore() {
        if (activeCall) activeCall = { ...activeCall, isMinimized: false };
        notify();
    },

    clear() {
        activeCall = null;
        notify();
    },

    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },
};
