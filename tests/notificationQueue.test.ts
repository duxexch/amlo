import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/redis", () => ({
    getRedis: vi.fn(),
    createRedisDuplicate: vi.fn(),
}));

vi.mock("../server/services/notificationDispatch", () => ({
    sendLocalizedPush: vi.fn(),
}));

describe("notificationQueue dedup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("enqueues when dedup key is new", async () => {
        const redis = {
            set: vi.fn().mockResolvedValue("OK"),
            lpush: vi.fn().mockResolvedValue(1),
        };

        const redisMod = await import("../server/redis");
        vi.mocked(redisMod.getRedis).mockReturnValue(redis as any);

        const queueMod = await import("../server/services/notificationQueue");
        const ok = await queueMod.enqueueNotificationJob({
            userId: "u1",
            preferenceKey: "messages",
            kind: "message",
            actorName: "Alice",
            bodyPreview: "hello",
            url: "/chat/c1",
        });

        expect(ok).toBe(true);
        expect(redis.set).toHaveBeenCalledTimes(1);
        expect(redis.lpush).toHaveBeenCalledTimes(1);
    });

    it("does not re-enqueue duplicate notification in dedup window", async () => {
        const redis = {
            set: vi.fn().mockResolvedValue(null),
            lpush: vi.fn().mockResolvedValue(1),
        };

        const redisMod = await import("../server/redis");
        vi.mocked(redisMod.getRedis).mockReturnValue(redis as any);

        const queueMod = await import("../server/services/notificationQueue");
        const ok = await queueMod.enqueueNotificationJob({
            userId: "u1",
            preferenceKey: "messages",
            kind: "message",
            actorName: "Alice",
            bodyPreview: "hello",
            url: "/chat/c1",
        });

        expect(ok).toBe(true);
        expect(redis.set).toHaveBeenCalledTimes(1);
        expect(redis.lpush).not.toHaveBeenCalled();
    });

    it("uses distinct dedup keys for distinct payload fingerprints", async () => {
        const redis = {
            set: vi.fn().mockResolvedValue("OK"),
            lpush: vi.fn().mockResolvedValue(1),
        };

        const redisMod = await import("../server/redis");
        vi.mocked(redisMod.getRedis).mockReturnValue(redis as any);

        const queueMod = await import("../server/services/notificationQueue");

        await queueMod.enqueueNotificationJob({
            userId: "u1",
            preferenceKey: "messages",
            kind: "message",
            actorName: "Alice",
            bodyPreview: "first",
            url: "/chat/c1",
        });

        await queueMod.enqueueNotificationJob({
            userId: "u1",
            preferenceKey: "messages",
            kind: "message",
            actorName: "Alice",
            bodyPreview: "second",
            url: "/chat/c1",
        });

        const firstKey = redis.set.mock.calls[0][0];
        const secondKey = redis.set.mock.calls[1][0];

        expect(firstKey).not.toBe(secondKey);
        expect(redis.lpush).toHaveBeenCalledTimes(2);
    });

    it("returns false if Redis is unavailable", async () => {
        const redisMod = await import("../server/redis");
        vi.mocked(redisMod.getRedis).mockReturnValue(null);

        const queueMod = await import("../server/services/notificationQueue");
        const ok = await queueMod.enqueueNotificationJob({
            userId: "u1",
            preferenceKey: "messages",
            kind: "message",
            actorName: "Alice",
            bodyPreview: "hello",
            url: "/chat/c1",
        });

        expect(ok).toBe(false);
    });
});
