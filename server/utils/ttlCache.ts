/**
 * TtlCache — Generic TTL + max-size in-memory cache
 * ══════════════════════════════════════════════════
 * Simple LRU-like cache with:
 *  - Per-entry TTL (time-to-live)
 *  - Max size eviction (removes oldest entries when full)
 *  - Periodic cleanup of expired entries
 *
 * Usage:
 *   const cache = new TtlCache<string, UserInfo>({ ttlMs: 60_000, maxSize: 1000 });
 *   cache.set("user123", userInfo);
 *   const info = cache.get("user123"); // null if expired
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

interface TtlCacheOptions {
  /** TTL in milliseconds */
  ttlMs: number;
  /** Maximum number of entries before eviction */
  maxSize: number;
  /** Cleanup interval in ms (default: ttlMs * 2) */
  cleanupIntervalMs?: number;
}

export class TtlCache<K, V> {
  private readonly map = new Map<K, CacheEntry<V>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: TtlCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.maxSize = opts.maxSize;

    // Periodic cleanup of expired entries
    const interval = opts.cleanupIntervalMs ?? opts.ttlMs * 2;
    if (interval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), interval);
      this.cleanupTimer.unref(); // don't block process exit
    }
  }

  /** Get a value (returns null if expired or missing) */
  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Set a value with TTL */
  set(key: K, value: V): void {
    // Evict oldest if at max size (Map maintains insertion order)
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Check if key exists and is not expired */
  has(key: K): boolean {
    return this.get(key) !== null;
  }

  /** Delete a specific key */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /** Clear all entries */
  clear(): void {
    this.map.clear();
  }

  /** Current number of entries (may include expired) */
  get size(): number {
    return this.map.size;
  }

  /** Remove all expired entries */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) this.map.delete(key);
    }
  }

  /** Stop the cleanup timer */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.map.clear();
  }
}
