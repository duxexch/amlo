/**
 * LiveKit Utility — إدارة التوكنات والغرف
 * ════════════════════════════════════════════
 * - Token generation with role-based permissions
 * - Room management via LiveKit Server API
 * - Security: tokens expire, room-scoped
 */
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

// ── ENV Configuration ──
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "ablox_livekit_key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "ablox_livekit_secret_2026_secure";
const LIVEKIT_URL = process.env.LIVEKIT_URL || "http://localhost:7880";
const LIVEKIT_PUBLIC_URL = process.env.LIVEKIT_PUBLIC_URL || "ws://localhost:7880";

/** Publicly accessible LiveKit WebSocket URL (for clients) */
export function getLiveKitPublicUrl(): string {
  return LIVEKIT_PUBLIC_URL;
}

/** Room service client for server-side room management */
let roomService: RoomServiceClient | null = null;

function getRoomService(): RoomServiceClient {
  if (!roomService) {
    // Use internal Docker URL for server-side communication
    const host = LIVEKIT_URL.replace(/^ws/, "http");
    roomService = new RoomServiceClient(host, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return roomService;
}

/**
 * Generate a LiveKit access token for a participant
 *
 * @param roomName - The LiveKit room name (usually stream ID)
 * @param participantId - Unique user ID
 * @param participantName - Display name
 * @param isHost - Whether this participant is the stream host (can publish)
 * @param isSpeaker - Whether this participant is an invited speaker
 * @param ttlSeconds - Token time-to-live (default: 4 hours)
 */
export async function generateLiveKitToken(
  roomName: string,
  participantId: string,
  participantName: string,
  isHost: boolean,
  isSpeaker: boolean = false,
  ttlSeconds: number = 4 * 60 * 60
): Promise<string> {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantId,
    name: participantName,
    ttl: ttlSeconds,
    metadata: JSON.stringify({
      role: isHost ? "host" : isSpeaker ? "speaker" : "viewer",
    }),
  });

  // Set permissions based on role
  if (isHost) {
    // Host can publish audio + video, subscribe to all, manage data
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    });
  } else if (isSpeaker) {
    // Speaker can publish audio only, subscribe to all
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,        // audio publishing for speakers
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: false,
    });
  } else {
    // Viewer: can only subscribe (watch/listen), not publish
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: false,
      canPublishData: false,    // viewers can't send data
      canSubscribe: true,
      canUpdateOwnMetadata: false,
    });
  }

  return await token.toJwt();
}

/**
 * Create a LiveKit room (optional — rooms auto-create on first join)
 */
export async function createLiveKitRoom(
  roomName: string,
  emptyTimeout: number = 300,
  maxParticipants: number = 500
): Promise<void> {
  try {
    const svc = getRoomService();
    await svc.createRoom({
      name: roomName,
      emptyTimeout,
      maxParticipants,
    });
  } catch (err: any) {
    // Room might already exist — that's fine
    if (err?.message?.includes("already exists")) return;
    console.error("[LiveKit] Failed to create room:", err?.message);
    throw err;
  }
}

/**
 * Delete a LiveKit room (when stream ends)
 */
export async function deleteLiveKitRoom(roomName: string): Promise<void> {
  try {
    const svc = getRoomService();
    await svc.deleteRoom(roomName);
  } catch (err: any) {
    // Room might not exist — that's fine during cleanup
    console.warn("[LiveKit] Failed to delete room:", roomName, err?.message);
  }
}

/**
 * Get active rooms (for monitoring)
 */
export async function listLiveKitRooms() {
  try {
    const svc = getRoomService();
    return await svc.listRooms();
  } catch {
    return [];
  }
}

/**
 * Remove a participant from a room (for moderation)
 */
export async function removeParticipant(roomName: string, participantId: string): Promise<void> {
  try {
    const svc = getRoomService();
    await svc.removeParticipant(roomName, participantId);
  } catch (err: any) {
    console.warn("[LiveKit] Failed to remove participant:", err?.message);
  }
}

/**
 * Mute a participant's track (for moderation)
 */
export async function muteParticipant(
  roomName: string,
  participantId: string,
  trackSid: string,
  mute: boolean = true
): Promise<void> {
  try {
    const svc = getRoomService();
    await svc.mutePublishedTrack(roomName, participantId, trackSid, mute);
  } catch (err: any) {
    console.warn("[LiveKit] Failed to mute participant:", err?.message);
  }
}

/**
 * Update participant permissions (e.g., promote viewer to speaker)
 */
export async function updateParticipantPermissions(
  roomName: string,
  participantId: string,
  canPublish: boolean
): Promise<void> {
  try {
    const svc = getRoomService();
    await svc.updateParticipant(roomName, participantId, undefined, {
      canPublish,
      canPublishData: canPublish,
      canSubscribe: true,
    });
  } catch (err: any) {
    console.warn("[LiveKit] Failed to update permissions:", err?.message);
  }
}
