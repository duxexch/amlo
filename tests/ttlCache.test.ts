/**
 * Tests for server/utils/ttlCache.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TtlCache } from "../server/utils/ttlCache";

describe("TtlCache", () => {
  let cache: TtlCache<string, number>;

  beforeEach(() => {
    cache = new TtlCache({ ttlMs: 1000, maxSize: 5, cleanupIntervalMs: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  it("should set and get values", () => {
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("should return null for missing keys", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("should expire entries after TTL", () => {
    vi.useFakeTimers();
    const c = new TtlCache<string, string>({ ttlMs: 100, maxSize: 10, cleanupIntervalMs: 0 });
    c.set("key", "value");
    expect(c.get("key")).toBe("value");

    vi.advanceTimersByTime(150);
    expect(c.get("key")).toBeNull();

    c.destroy();
    vi.useRealTimers();
  });

  it("should evict oldest when maxSize is reached", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4);
    cache.set("e", 5);
    expect(cache.size).toBe(5);

    cache.set("f", 6); // Should evict "a"
    expect(cache.get("a")).toBeNull();
    expect(cache.get("f")).toBe(6);
    expect(cache.size).toBe(5);
  });

  it("should support has()", () => {
    cache.set("x", 42);
    expect(cache.has("x")).toBe(true);
    expect(cache.has("y")).toBe(false);
  });

  it("should support delete()", () => {
    cache.set("x", 42);
    expect(cache.delete("x")).toBe(true);
    expect(cache.get("x")).toBeNull();
  });

  it("should support clear()", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("should cleanup expired entries", () => {
    vi.useFakeTimers();
    const c = new TtlCache<string, number>({ ttlMs: 100, maxSize: 10, cleanupIntervalMs: 0 });
    c.set("a", 1);
    c.set("b", 2);
    vi.advanceTimersByTime(150);
    c.set("c", 3); // Set after expiry
    c.cleanup();
    expect(c.size).toBe(1); // Only "c" remains
    c.destroy();
    vi.useRealTimers();
  });
});
