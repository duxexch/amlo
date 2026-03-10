/**
 * useSocketInvalidation — Socket.io → React Query cache invalidation
 * ══════════════════════════════════════════════════════════════════
 * Listens to real-time socket events and invalidates the relevant
 * React Query caches so the UI refreshes instantly without manual
 * refetching or page reloads.
 */
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { getSocket } from "@/lib/socketManager";

/** Query keys used across the app */
export const QUERY_KEYS = {
    me: ["/api/auth/me"],
    conversations: ["/api/social/conversations"],
    unreadCount: ["/api/social/unread-count"],
    friends: ["/api/social/friends"],
    friendRequests: ["/api/social/friends/requests"],
    walletBalance: ["/api/social/wallet/balance"],
} as const;

export function useSocketInvalidation() {
    useEffect(() => {
        const socket = getSocket();

        // ── Messages → refresh conversations + unread count ──
        const onNewMessage = () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
        };

        // ── Friend events → refresh friends list + requests ──
        const onFriendRequest = () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
        };

        const onFriendAccepted = () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friends });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
        };

        const onFriendRemoved = () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.friends });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
        };

        // ── Balance changes → refresh wallet + profile ──
        const onBalanceUpdate = () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.walletBalance });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
        };

        const onGiftReceived = () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.walletBalance });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
        };

        // ── Call ended → refresh balance (coins deducted) ──
        const onCallEnded = () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.walletBalance });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
        };

        socket.on("new-message", onNewMessage);
        socket.on("friend-request", onFriendRequest);
        socket.on("friend-accepted", onFriendAccepted);
        socket.on("friend-removed", onFriendRemoved);
        socket.on("balance-update", onBalanceUpdate);
        socket.on("gift-received", onGiftReceived);
        socket.on("call-ended", onCallEnded);

        return () => {
            socket.off("new-message", onNewMessage);
            socket.off("friend-request", onFriendRequest);
            socket.off("friend-accepted", onFriendAccepted);
            socket.off("friend-removed", onFriendRemoved);
            socket.off("balance-update", onBalanceUpdate);
            socket.off("gift-received", onGiftReceived);
            socket.off("call-ended", onCallEnded);
        };
    }, []);
}
