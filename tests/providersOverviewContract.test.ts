declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
    toBe: (expected: unknown) => void;
    not: { toThrow: () => void };
};

import { ensureAdminProvidersOverviewData, isAdminProvidersOverviewData } from "../server/contracts/adminProvidersOverview";

describe("admin providers overview contract", () => {
    const validPayload = {
        socialLogin: {
            total: 2,
            enabled: 1,
            configured: 1,
            providers: [
                { provider: "google", enabled: true, configured: true },
                { provider: "facebook", enabled: false, configured: false },
            ],
        },
        otpSms: {
            enabled: true,
            provider: "twilio",
            configured: true,
        },
        paymentGateways: {
            total: 1,
            enabled: 1,
            configured: 1,
            providers: [
                {
                    provider: "stripe",
                    enabled: true,
                    configured: true,
                    mode: "live",
                    countries: ["US", "GB"],
                    priority: 1,
                },
            ],
        },
        paymentMethods: {
            total: 1,
            active: 1,
            byProvider: { stripe: 1 },
            methods: [
                {
                    id: "pm_1",
                    name: "Stripe Card",
                    isActive: true,
                    provider: "stripe",
                    usageTarget: "both",
                    countries: ["US"],
                },
            ],
        },
        appDownload: {
            enabled: true,
            pwaEnabled: true,
            apkEnabled: true,
            aabEnabled: false,
        },
    };

    it("accepts valid providers overview payload", () => {
        expect(() => ensureAdminProvidersOverviewData(validPayload)).not.toThrow();
    });

    it("rejects payload when required contract field is missing", () => {
        const invalidPayload = {
            ...validPayload,
            paymentMethods: {
                ...validPayload.paymentMethods,
                methods: [
                    {
                        id: "pm_1",
                        name: "Stripe Card",
                        isActive: true,
                        provider: "stripe",
                        countries: ["US"],
                    },
                ],
            },
        };

        expect(isAdminProvidersOverviewData(invalidPayload)).toBe(false);
    });

    it("enforces boolean appDownload flags in contract", () => {
        const invalidPayload = {
            ...validPayload,
            appDownload: {
                ...validPayload.appDownload,
                apkEnabled: "true",
            },
        };

        expect(isAdminProvidersOverviewData(invalidPayload)).toBe(false);
    });
});
