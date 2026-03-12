/**
 * useReelCache — IndexedDB-backed video cache with 5-day rolling window
 * ═══════════════════════════════════════════════════════════════════════
 * Preloads the next N reels into IndexedDB for instant playback.
 * Cached blobs expire after 5 days (rolling: oldest day purged, current day added).
 * 
 * Usage in Cex:
 *   const { getCachedUrl, preloadAround } = useReelCache(reels);
 *   // On activeIndex change:  preloadAround(activeIndex);
 *   // On <video>:             src={getCachedUrl(reel.mediaUrl) || reel.mediaUrl}
 */

import { useRef, useCallback, useEffect } from "react";

// ── IndexedDB constants ──
const DB_NAME = "ablox_reel_cache";
const DB_VERSION = 1;
const STORE_NAME = "videos";
const MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const MAX_CACHE_ENTRIES = 200; // safety cap

/** Adaptive preload count based on network quality */
function getPreloadAhead(): number {
    const conn = (navigator as any).connection;
    if (!conn) return 3;
    const etype = conn.effectiveType;
    if (etype === "slow-2g" || etype === "2g") return 1;
    if (etype === "3g") return 2;
    return 5; // 4g or better
}

// ── Helpers ──
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "url" });
                store.createIndex("cachedAt", "cachedAt", { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getCachedBlob(url: string): Promise<Blob | null> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(url);
            req.onsuccess = () => {
                const record = req.result;
                if (!record) { resolve(null); return; }
                if (Date.now() - record.cachedAt > MAX_AGE_MS) {
                    // Expired — delete asynchronously
                    const delTx = db.transaction(STORE_NAME, "readwrite");
                    delTx.objectStore(STORE_NAME).delete(url);
                    resolve(null);
                    return;
                }
                resolve(record.blob as Blob);
            };
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function putCachedBlob(url: string, blob: Blob): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ url, blob, cachedAt: Date.now() });
    } catch {
        // Quota exceeded or other — silently skip
    }
}

/** Remove all entries older than MAX_AGE_MS + cap at MAX_CACHE_ENTRIES */
async function purgeExpired(): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const idx = store.index("cachedAt");
        const cutoff = Date.now() - MAX_AGE_MS;

        // Delete expired
        const range = IDBKeyRange.upperBound(cutoff);
        const cursorReq = idx.openCursor(range);
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        await new Promise<void>((resolve) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });

        // Cap total entries
        const countTx = db.transaction(STORE_NAME, "readwrite");
        const countStore = countTx.objectStore(STORE_NAME);
        const countReq = countStore.count();
        countReq.onsuccess = () => {
            if (countReq.result <= MAX_CACHE_ENTRIES) return;
            const excess = countReq.result - MAX_CACHE_ENTRIES;
            const delIdx = countStore.index("cachedAt");
            let deleted = 0;
            const c = delIdx.openCursor();
            c.onsuccess = () => {
                const cur = c.result;
                if (cur && deleted < excess) {
                    cur.delete();
                    deleted++;
                    cur.continue();
                }
            };
        };
    } catch {
        // Non-critical
    }
}

// ═══════════════════════════════════════════════
// ── Hook ──
// ═══════════════════════════════════════════════
export function useReelCache(reels: any[]) {
    const blobUrlMap = useRef<Map<string, string>>(new Map());
    const fetching = useRef<Set<string>>(new Set());

    // Purge expired entries on mount (once)
    useEffect(() => {
        purgeExpired();
        // Cleanup blob URLs on unmount
        return () => {
            blobUrlMap.current.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
            blobUrlMap.current.clear();
        };
    }, []);

    /**
     * Get a cached blob URL for a media URL (if in cache).
     * Returns null if not cached yet — caller should use original URL.
     */
    const getCachedUrl = useCallback((mediaUrl: string): string | null => {
        return blobUrlMap.current.get(mediaUrl) || null;
    }, []);

    /**
     * Preload a single reel video into IndexedDB + in-memory blob URL.
     */
    const preloadOne = useCallback(async (mediaUrl: string) => {
        if (!mediaUrl || blobUrlMap.current.has(mediaUrl) || fetching.current.has(mediaUrl)) return;
        fetching.current.add(mediaUrl);

        try {
            // Check IndexedDB first
            const cached = await getCachedBlob(mediaUrl);
            if (cached) {
                const url = URL.createObjectURL(cached);
                blobUrlMap.current.set(mediaUrl, url);
                fetching.current.delete(mediaUrl);
                return;
            }

            // Fetch from network
            const res = await fetch(mediaUrl, { mode: "cors", credentials: "same-origin" });
            if (!res.ok) { fetching.current.delete(mediaUrl); return; }
            const blob = await res.blob();

            // Store in IndexedDB
            await putCachedBlob(mediaUrl, blob);

            // Create blob URL for immediate use
            const url = URL.createObjectURL(blob);
            blobUrlMap.current.set(mediaUrl, url);
        } catch {
            // Network error or quota — skip silently
        } finally {
            fetching.current.delete(mediaUrl);
        }
    }, []);

    /**
     * Preload reels around a given index.
     * Loads index + next PRELOAD_AHEAD items.
     */
    const preloadAround = useCallback((activeIdx: number) => {
        if (!reels.length) return;
        const ahead = getPreloadAhead();
        const start = activeIdx;
        const end = Math.min(activeIdx + ahead + 1, reels.length);
        for (let i = start; i < end; i++) {
            const url = reels[i]?.mediaUrl;
            if (url) preloadOne(url);
        }
    }, [reels, preloadOne]);

    return { getCachedUrl, preloadAround, preloadOne };
}
