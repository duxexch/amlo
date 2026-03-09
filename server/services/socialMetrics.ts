export const socialStabilityMetrics = {
    decryptCacheHits: 0,
    decryptCacheMisses: 0,
    decryptCacheErrors: 0,
    liveFlagsCacheHits: 0,
    liveFlagsCacheMisses: 0,
    dailyMissionsFlagCacheHits: 0,
    dailyMissionsFlagCacheMisses: 0,
    scheduledLockAcquired: 0,
    scheduledLockSkipped: 0,
    friendExpiryLockAcquired: 0,
    friendExpiryLockSkipped: 0,
};

export type SocialStabilityMetricKey = keyof typeof socialStabilityMetrics;
