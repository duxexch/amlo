declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
};

import {
    getScopedSettingLookupOrder,
    resolveScopedSettingValue,
    resolveTenantSettingKeyByTenantId,
} from "../server/utils/tenantScope";

describe("tenant scope fallback", () => {
    it("keeps global key for default tenant", () => {
        expect(resolveTenantSettingKeyByTenantId("default", "voice_call_rate")).toBe("voice_call_rate");
    });

    it("builds tenant-scoped key for valid tenant id", () => {
        expect(resolveTenantSettingKeyByTenantId("tenant-a", "voice_call_rate")).toBe("tenant:tenant-a:voice_call_rate");
    });

    it("falls back to global key for invalid tenant id", () => {
        expect(resolveTenantSettingKeyByTenantId("tenant with spaces", "voice_call_rate")).toBe("voice_call_rate");
    });

    it("returns scoped then global lookup order", () => {
        expect(getScopedSettingLookupOrder("tenant-a", "chat_message_cost")).toEqual([
            "tenant:tenant-a:chat_message_cost",
            "chat_message_cost",
        ]);
    });

    it("resolves scoped value when present", () => {
        const source = new Map<string, string>([
            ["chat_message_cost", "1"],
            ["tenant:tenant-a:chat_message_cost", "7"],
        ]);

        const result = resolveScopedSettingValue(source, "tenant-a", "chat_message_cost");
        expect(result).toEqual({
            key: "tenant:tenant-a:chat_message_cost",
            value: "7",
        });
    });

    it("falls back to global value when scoped key missing", () => {
        const source = {
            chat_message_cost: "2",
        } as Record<string, string>;

        const result = resolveScopedSettingValue(source, "tenant-b", "chat_message_cost");
        expect(result).toEqual({
            key: "chat_message_cost",
            value: "2",
        });
    });
});
