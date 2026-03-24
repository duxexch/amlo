export type AdminProvidersOverviewData = {
    socialLogin: {
        total: number;
        enabled: number;
        configured: number;
        providers: Array<{ provider: string; enabled: boolean; configured: boolean }>;
    };
    otpSms: {
        enabled: boolean;
        provider: string;
        configured: boolean;
    };
    paymentGateways: {
        total: number;
        enabled: number;
        configured: number;
        providers: Array<{ provider: string; enabled: boolean; configured: boolean; mode: string; countries: string[]; priority: number }>;
    };
    paymentMethods: {
        total: number;
        active: number;
        byProvider: Record<string, number>;
        methods: Array<{ id: string; name: string; isActive: boolean; provider: string; usageTarget: string; countries: string[] }>;
    };
    appDownload: {
        enabled: boolean;
        pwaEnabled: boolean;
        apkEnabled: boolean;
        aabEnabled: boolean;
    };
};

const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

export function isAdminProvidersOverviewData(value: unknown): value is AdminProvidersOverviewData {
    if (!value || typeof value !== "object") return false;
    const v = value as any;

    const socialOk = v.socialLogin
        && isNumber(v.socialLogin.total)
        && isNumber(v.socialLogin.enabled)
        && isNumber(v.socialLogin.configured)
        && Array.isArray(v.socialLogin.providers)
        && v.socialLogin.providers.every((p: any) => isString(p?.provider) && isBoolean(p?.enabled) && isBoolean(p?.configured));

    const otpOk = v.otpSms
        && isBoolean(v.otpSms.enabled)
        && isString(v.otpSms.provider)
        && isBoolean(v.otpSms.configured);

    const gatewaysOk = v.paymentGateways
        && isNumber(v.paymentGateways.total)
        && isNumber(v.paymentGateways.enabled)
        && isNumber(v.paymentGateways.configured)
        && Array.isArray(v.paymentGateways.providers)
        && v.paymentGateways.providers.every((p: any) =>
            isString(p?.provider)
            && isBoolean(p?.enabled)
            && isBoolean(p?.configured)
            && isString(p?.mode)
            && isStringArray(p?.countries)
            && isNumber(p?.priority)
        );

    const methodsOk = v.paymentMethods
        && isNumber(v.paymentMethods.total)
        && isNumber(v.paymentMethods.active)
        && v.paymentMethods.byProvider
        && typeof v.paymentMethods.byProvider === "object"
        && Object.values(v.paymentMethods.byProvider).every(isNumber)
        && Array.isArray(v.paymentMethods.methods)
        && v.paymentMethods.methods.every((m: any) =>
            isString(m?.id)
            && isString(m?.name)
            && isBoolean(m?.isActive)
            && isString(m?.provider)
            && isString(m?.usageTarget)
            && isStringArray(m?.countries)
        );

    const appDownloadOk = v.appDownload
        && isBoolean(v.appDownload.enabled)
        && isBoolean(v.appDownload.pwaEnabled)
        && isBoolean(v.appDownload.apkEnabled)
        && isBoolean(v.appDownload.aabEnabled);

    return Boolean(socialOk && otpOk && gatewaysOk && methodsOk && appDownloadOk);
}

export function ensureAdminProvidersOverviewData(value: unknown): AdminProvidersOverviewData {
    if (!isAdminProvidersOverviewData(value)) {
        throw new Error("Invalid providers overview contract");
    }
    return value;
}
