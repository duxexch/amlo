export const ADMIN_CHAT_CONTENT_DISABLED_CODE = "ADMIN_CHAT_CONTENT_DISABLED";
export const ADMIN_CHAT_CONTENT_DISABLED_MESSAGE = "تم تعطيل عرض محتوى المحادثات والمكالمات في لوحة الإدارة.";

export const ADMIN_CHAT_RESTRICTED_ENDPOINT_PATTERNS = [
    "/conversations",
    "/conversations/:id/messages",
    "/messages",
    "/calls",
    "/export/conversations",
    "/export/messages",
] as const;

function normalizePath(pathname: string): string {
    const normalized = pathname.trim();
    if (!normalized) return "/";
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function matchRoutePattern(pathname: string, pattern: string): boolean {
    const pathSegments = normalizePath(pathname).split("/").filter(Boolean);
    const patternSegments = normalizePath(pattern).split("/").filter(Boolean);

    if (pathSegments.length !== patternSegments.length) return false;

    for (let i = 0; i < patternSegments.length; i += 1) {
        const token = patternSegments[i];
        if (token.startsWith(":")) continue;
        if (token !== pathSegments[i]) return false;
    }

    return true;
}

export function isRestrictedAdminChatPath(pathname: string): boolean {
    return ADMIN_CHAT_RESTRICTED_ENDPOINT_PATTERNS.some((pattern) => matchRoutePattern(pathname, pattern));
}
