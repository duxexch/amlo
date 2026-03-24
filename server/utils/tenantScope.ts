export function resolveTenantSettingKeyByTenantId(tenantId: string, key: string): string {
    if (!tenantId || tenantId === "default") return key;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)) return key;
    return `tenant:${tenantId}:${key}`;
}

export function getScopedSettingLookupOrder(tenantId: string, key: string): string[] {
    const scopedKey = resolveTenantSettingKeyByTenantId(tenantId, key);
    if (scopedKey === key) return [key];
    return [scopedKey, key];
}

export function resolveScopedSettingValue<T>(
    source: Map<string, T> | Record<string, T>,
    tenantId: string,
    key: string,
): { key: string; value: T | undefined } {
    const order = getScopedSettingLookupOrder(tenantId, key);

    if (source instanceof Map) {
        for (const candidate of order) {
            if (source.has(candidate)) {
                return { key: candidate, value: source.get(candidate) };
            }
        }
        return { key, value: undefined };
    }

    for (const candidate of order) {
        if (Object.prototype.hasOwnProperty.call(source, candidate)) {
            return { key: candidate, value: source[candidate] };
        }
    }

    return { key, value: undefined };
}
