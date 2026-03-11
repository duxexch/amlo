/**
 * BunnyCDN Storage Service — خدمة تخزين BunnyCDN
 * ═══════════════════════════════════════════════════
 * Uploads files to BunnyCDN Storage Zone for CDN delivery.
 * Fully opt-in: disabled when BUNNY_STORAGE_API_KEY is not set.
 *
 * Usage:
 *   Set these env vars to enable:
 *     BUNNY_STORAGE_API_KEY   — Storage Zone API key
 *     BUNNY_STORAGE_ZONE      — Storage Zone name (e.g. "ablox-media")
 *     BUNNY_STORAGE_REGION    — Region code: "" (Falkenstein), "ny", "la", "sg", "syd"
 *     CDN_URL                 — Pull Zone URL (e.g. "https://ablox.b-cdn.net")
 *
 *   The CDN_URL is already used by cdn.ts for URL rewriting.
 */
import fs from "fs";
import { createLogger } from "../logger";

const log = createLogger("bunny-cdn");

// ── Configuration ──
const BUNNY_API_KEY = process.env.BUNNY_STORAGE_API_KEY || "";
const BUNNY_ZONE = process.env.BUNNY_STORAGE_ZONE || "";
const BUNNY_REGION = process.env.BUNNY_STORAGE_REGION || "";

function getStorageHost(): string {
    if (!BUNNY_REGION || BUNNY_REGION === "de") return "storage.bunnycdn.com";
    return `${BUNNY_REGION}.storage.bunnycdn.com`;
}

/** Whether BunnyCDN storage is configured and enabled */
export function isBunnyCdnEnabled(): boolean {
    return !!(BUNNY_API_KEY && BUNNY_ZONE);
}

/**
 * Upload a local file to BunnyCDN Storage.
 * @param localPath - Absolute path to the file on disk
 * @param remotePath - Path inside the storage zone (e.g. "media/abc123.mp4")
 * @returns true if uploaded successfully, false otherwise
 */
export async function uploadToBunny(localPath: string, remotePath: string): Promise<boolean> {
    if (!isBunnyCdnEnabled()) return false;

    const cleanPath = remotePath.replace(/^\/+/, "");
    const url = `https://${getStorageHost()}/${BUNNY_ZONE}/${cleanPath}`;

    try {
        const fileBuffer = fs.readFileSync(localPath);

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "AccessKey": BUNNY_API_KEY,
                "Content-Type": "application/octet-stream",
                "Content-Length": String(fileBuffer.byteLength),
            },
            body: fileBuffer,
        });

        if (response.ok) {
            log.info(`Uploaded to BunnyCDN: ${cleanPath} (${(fileBuffer.byteLength / 1024).toFixed(1)}KB)`);
            return true;
        }

        const text = await response.text().catch(() => "");
        log.error(`BunnyCDN upload failed: ${response.status} ${response.statusText} — ${text} (path: ${cleanPath})`);
        return false;
    } catch (err: any) {
        log.error({ err }, `BunnyCDN upload error: ${cleanPath}`);
        return false;
    }
}

/**
 * Delete a file from BunnyCDN Storage.
 * @param remotePath - Path inside the storage zone (e.g. "avatars/old-avatar.jpg")
 * @returns true if deleted successfully
 */
export async function deleteFromBunny(remotePath: string): Promise<boolean> {
    if (!isBunnyCdnEnabled()) return false;

    const cleanPath = remotePath.replace(/^\/+/, "");
    const url = `https://${getStorageHost()}/${BUNNY_ZONE}/${cleanPath}`;

    try {
        const response = await fetch(url, {
            method: "DELETE",
            headers: { "AccessKey": BUNNY_API_KEY },
        });

        if (response.ok || response.status === 404) {
            log.info(`Deleted from BunnyCDN: ${cleanPath}`);
            return true;
        }

        log.warn(`BunnyCDN delete failed: ${response.status} (path: ${cleanPath})`);
        return false;
    } catch (err: any) {
        log.error({ err }, `BunnyCDN delete error: ${cleanPath}`);
        return false;
    }
}

/**
 * Upload to BunnyCDN in the background (fire-and-forget).
 * Does NOT block the upload response — local file is always the source of truth.
 * @param localPath - Absolute path to the file
 * @param remotePath - CDN storage path (e.g. "media/abc123.mp4")
 */
export function uploadToBunnyAsync(localPath: string, remotePath: string): void {
    if (!isBunnyCdnEnabled()) return;
    uploadToBunny(localPath, remotePath).catch(() => { });
}

/**
 * Delete from BunnyCDN in the background (fire-and-forget).
 */
export function deleteFromBunnyAsync(remotePath: string): void {
    if (!isBunnyCdnEnabled()) return;
    deleteFromBunny(remotePath).catch(() => { });
}

// Log status on module load
if (isBunnyCdnEnabled()) {
    log.info(`BunnyCDN enabled — zone: ${BUNNY_ZONE}, region: ${BUNNY_REGION || "de (default)"}`);
} else {
    log.info("BunnyCDN disabled — set BUNNY_STORAGE_API_KEY and BUNNY_STORAGE_ZONE to enable");
}
