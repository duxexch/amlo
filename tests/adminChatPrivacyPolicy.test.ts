declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
};

import {
    ADMIN_CHAT_CONTENT_DISABLED_CODE,
    ADMIN_CHAT_CONTENT_DISABLED_MESSAGE,
    ADMIN_CHAT_RESTRICTED_ENDPOINT_PATTERNS,
    isRestrictedAdminChatPath,
} from "../server/utils/adminChatPrivacyPolicy";

describe("admin chat privacy policy", () => {
    it("keeps a stable disabled response contract", () => {
        expect(ADMIN_CHAT_CONTENT_DISABLED_CODE).toBe("ADMIN_CHAT_CONTENT_DISABLED");
        expect(ADMIN_CHAT_CONTENT_DISABLED_MESSAGE).toBe("تم تعطيل عرض محتوى المحادثات والمكالمات في لوحة الإدارة.");
    });

    it("contains all expected restricted endpoint patterns", () => {
        expect(ADMIN_CHAT_RESTRICTED_ENDPOINT_PATTERNS).toEqual([
            "/conversations",
            "/conversations/:id/messages",
            "/messages",
            "/calls",
            "/export/conversations",
            "/export/messages",
        ]);
    });

    it("matches exact restricted paths", () => {
        expect(isRestrictedAdminChatPath("/conversations")).toBe(true);
        expect(isRestrictedAdminChatPath("/messages")).toBe(true);
        expect(isRestrictedAdminChatPath("/calls")).toBe(true);
        expect(isRestrictedAdminChatPath("/export/conversations")).toBe(true);
        expect(isRestrictedAdminChatPath("/export/messages")).toBe(true);
    });

    it("matches parameterized restricted paths", () => {
        expect(isRestrictedAdminChatPath("/conversations/abc-123/messages")).toBe(true);
    });

    it("does not match non-restricted paths", () => {
        expect(isRestrictedAdminChatPath("/conversations/abc-123")).toBe(false);
        expect(isRestrictedAdminChatPath("/overview/stats")).toBe(false);
        expect(isRestrictedAdminChatPath("/moderation/settings")).toBe(false);
    });
});
