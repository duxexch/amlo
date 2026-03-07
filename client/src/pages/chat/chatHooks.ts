/**
 * Chat Custom Hooks — هوكس الدردشة
 * ════════════════════════════════════════
 * Extracted from Chat.tsx for cleaner architecture.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { chatApi, callsApi, chatBlocksApi, messageReportsApi, translateApi, uploadMedia } from "@/lib/socialApi";
import { toast } from "sonner";
import { getSocket, socketManager } from "@/lib/socketManager";
import type {
  Conversation, ChatMessage, BlockStatus, ChatSettings,
  ViewMode, NewMessagePayload, TypingPayload, MessagesReadPayload,
  ChatBlockedPayload, ReportCategory,
} from "./chatTypes";

// ── Typing throttle: per-conversation (fixes shared global state issue) ──
const TYPING_THROTTLE_MS = 2500;
const lastTypingEmitMap = new Map<string, number>();

// ── Notification sound ──
let notifAudio: HTMLAudioElement | null = null;
let notifPermissionRequested = false;

function playNotificationSound() {
  try {
    if (!notifAudio) {
      notifAudio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZWTi4F3cXV7f4WIioqHhH95dHB0eYCFiImIhYJ+eXZ0d3t/g4aHh4WDgH15dnd5fICDhYaFg4GAfoB8fH5/gIGBgQA=");
    }
    notifAudio.currentTime = 0;
    notifAudio.volume = 0.65;
    notifAudio.play().catch(() => { });
  } catch { }
}

function getNotificationMode(): "all" | "sound" | "push" | "off" {
  try {
    const mode = localStorage.getItem("ablox_chat_notify_mode");
    if (mode === "all" || mode === "sound" || mode === "push" || mode === "off") return mode;
  } catch { }
  return "all";
}

function shouldPlaySound(): boolean {
  const mode = getNotificationMode();
  return mode === "all" || mode === "sound";
}

function shouldShowPush(): boolean {
  const mode = getNotificationMode();
  return mode === "all" || mode === "push";
}

async function showDesktopNotification(title: string, body: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (!shouldShowPush()) return;

  let permission = Notification.permission;
  if (permission === "default" && !notifPermissionRequested) {
    notifPermissionRequested = true;
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }
  if (permission !== "granted") return;

  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "ablox-chat-message",
    });
    n.onclick = () => {
      try { window.focus(); } catch { }
      n.close();
    };
    if ("vibrate" in navigator) {
      try { navigator.vibrate([120, 60, 120]); } catch { }
    }
  } catch { }
}

function revokeBlobUrlIfNeeded(url?: string | null) {
  if (url && url.startsWith("blob:")) {
    try { URL.revokeObjectURL(url); } catch { }
  }
}

/** Hook: Manage conversations list + settings */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [typingConvIds, setTypingConvIds] = useState<Set<string>>(new Set());
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [convs, chatSettings] = await Promise.all([
          chatApi.conversations(),
          chatApi.settings(),
        ]);
        setConversations(convs || []);
        setSettings(chatSettings as ChatSettings);
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Listen for typing events to show in conversation list
  useEffect(() => {
    const s = getSocket();
    const onTyping = (data: TypingPayload) => {
      setTypingConvIds(prev => new Set(prev).add(data.conversationId));
      const existing = typingTimeoutsRef.current.get(data.conversationId);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        setTypingConvIds(prev => {
          const next = new Set(prev);
          next.delete(data.conversationId);
          return next;
        });
        typingTimeoutsRef.current.delete(data.conversationId);
      }, 4000);
      typingTimeoutsRef.current.set(data.conversationId, timeout);
    };
    const onStopTyping = (data: TypingPayload) => {
      const existing = typingTimeoutsRef.current.get(data.conversationId);
      if (existing) {
        clearTimeout(existing);
        typingTimeoutsRef.current.delete(data.conversationId);
      }
      setTypingConvIds(prev => {
        const next = new Set(prev);
        next.delete(data.conversationId);
        return next;
      });
    };
    s.on("typing", onTyping);
    s.on("stop-typing", onStopTyping);
    return () => {
      s.off("typing", onTyping);
      s.off("stop-typing", onStopTyping);
      typingTimeoutsRef.current.forEach(t => clearTimeout(t));
      typingTimeoutsRef.current.clear();
    };
  }, []);

  const totalUnread = useMemo(() =>
    conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  return { conversations, setConversations, settings, loading, totalUnread, typingConvIds };
}

/** Hook: Manage active chat view (messages, send, typing, block, search) */
export function useActiveChat(
  conversations: Conversation[],
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>,
  settings: ChatSettings | null,
) {
  const [view, setView] = useState<ViewMode>("list");
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [blockStatus, setBlockStatus] = useState<BlockStatus | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showNewMsgIndicator, setShowNewMsgIndicator] = useState(false);
  const [reactionVersion, setReactionVersion] = useState(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const retryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Revoke any leftover local blob URLs on unmount.
  useEffect(() => {
    return () => {
      for (const m of messagesRef.current) revokeBlobUrlIfNeeded(m.mediaUrl);
      retryTimersRef.current.forEach((timer) => clearTimeout(timer));
      retryTimersRef.current.clear();
    };
  }, []);

  const isNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowNewMsgIndicator(false);
  };
  /** Track which conversations have typing indicators */
  const [typingConvIds, setTypingConvIds] = useState<Set<string>>(new Set());
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Ref to avoid stale closures in socket handlers
  const activeConvRef = useRef(activeConv);
  activeConvRef.current = activeConv;

  // Socket listeners — uses refs to avoid stale closures
  useEffect(() => {
    const s = getSocket();

    const handleNewMessage = (data: NewMessagePayload) => {
      const conv = activeConvRef.current;

      // Acknowledge delivery to the sender
      if (data.message.senderId !== "me") {
        s.emit("message-delivered", {
          messageId: data.message.id,
          conversationId: data.conversationId,
          senderId: data.message.senderId,
        });
      }

      if (conv?.id === data.conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        if (isNearBottom()) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        } else {
          setShowNewMsgIndicator(true);
        }
        s.emit("messages-read", {
          conversationId: data.conversationId,
          receiverId: conv.otherUser?.id,
        });
      } else {
        if (shouldPlaySound()) playNotificationSound();
      }

      if (document.hidden || conv?.id !== data.conversationId) {
        const senderName = data.sender?.displayName || data.sender?.username || "Ablock";
        const preview = data.message?.content || (data.message?.type === "image" ? "Image" : "Voice message");
        void showDesktopNotification(senderName, preview);
      }

      setConversations(prev =>
        prev.map(c => {
          if (c.id === data.conversationId) {
            return {
              ...c,
              lastMessage: data.message,
              lastMessageAt: data.message.createdAt,
              unreadCount: activeConvRef.current?.id === data.conversationId ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    };

    const handleTyping = (data: TypingPayload) => {
      if (data.conversationId === activeConvRef.current?.id) setIsTyping(true);
      setTypingConvIds(prev => new Set(prev).add(data.conversationId));
      const existing = typingTimeouts.current.get(data.conversationId);
      if (existing) clearTimeout(existing);
      typingTimeouts.current.set(data.conversationId, setTimeout(() => {
        setTypingConvIds(prev => {
          const next = new Set(prev);
          next.delete(data.conversationId);
          return next;
        });
        if (data.conversationId === activeConvRef.current?.id) setIsTyping(false);
      }, 4000));
    };

    const handleStopTyping = (data: { conversationId: string }) => {
      if (data.conversationId === activeConvRef.current?.id) setIsTyping(false);
      setTypingConvIds(prev => {
        const next = new Set(prev);
        next.delete(data.conversationId);
        return next;
      });
    };

    const handleMessagesRead = (data: MessagesReadPayload) => {
      if (data.conversationId === activeConvRef.current?.id) {
        setMessages(prev => prev.map(m => (m.senderId === "me" ? { ...m, isRead: true } : m)));
      }
    };

    const handleMessageSent = (data: { message: ChatMessage; conversationId: string }) => {
      if (!data?.message || !data?.conversationId) return;

      if (activeConvRef.current?.id === data.conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, { ...data.message, senderId: "me" }];
        });
      }

      setConversations(prev =>
        prev.map(c => c.id === data.conversationId
          ? { ...c, lastMessage: { ...data.message, senderId: "me" }, lastMessageAt: data.message.createdAt }
          : c
        )
      );
    };

    const handleChatBlocked = (data: ChatBlockedPayload) => {
      if (activeConvRef.current?.otherUser?.id === data.blockerId) {
        setBlockStatus({ isBlocked: true, blockedByThem: true, blockedByMe: false });
      }
    };

    const handleMessageDeleted = (data: { messageId: string; conversationId: string }) => {
      if (activeConvRef.current?.id === data.conversationId) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isDeleted: true, content: null } : m));
      }
    };

    const handleMessageDelivered = (data: { messageId: string; conversationId: string }) => {
      if (activeConvRef.current?.id === data.conversationId) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, _delivered: true } : m));
      }
    };

    const handleConversationDeleted = (data: { conversationId: string }) => {
      if (activeConvRef.current?.id === data.conversationId) {
        setView("list");
        setActiveConv(null);
        setMessages([]);
        setBlockStatus(null);
        setShowBlockMenu(false);
        setReplyTo(null);
        setMsgSearch("");
        setShowMsgSearch(false);
        setIsTyping(false);
      }
      setConversations(prev => prev.filter(c => c.id !== data.conversationId));
    };

    s.on("new-message", handleNewMessage);
    s.on("typing", handleTyping);
    s.on("stop-typing", handleStopTyping);
    s.on("messages-read", handleMessagesRead);
    s.on("message-sent", handleMessageSent);
    s.on("chat-blocked", handleChatBlocked);
    s.on("message-deleted", handleMessageDeleted);
    s.on("message-delivered", handleMessageDelivered);
    s.on("conversation-deleted", handleConversationDeleted);

    const handleReactionUpdated = () => {
      setReactionVersion(v => v + 1);
    };
    s.on("reaction-updated", handleReactionUpdated);

    return () => {
      s.off("new-message", handleNewMessage);
      s.off("typing", handleTyping);
      s.off("stop-typing", handleStopTyping);
      s.off("messages-read", handleMessagesRead);
      s.off("message-sent", handleMessageSent);
      s.off("chat-blocked", handleChatBlocked);
      s.off("message-deleted", handleMessageDeleted);
      s.off("message-delivered", handleMessageDelivered);
      s.off("conversation-deleted", handleConversationDeleted);
      s.off("reaction-updated", handleReactionUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConversations]);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setView("chat");
    setMessages([]);
    setIsTyping(false);
    setBlockStatus(null);
    setReplyTo(null);
    setMessagesCursor(null);
    setHasMoreMessages(true);
    setMsgSearch("");
    setShowMsgSearch(false);

    try {
      const [msgsRes, blockSt] = await Promise.all([
        chatApi.messagesCursor(conv.id),
        chatBlocksApi.status(conv.otherUser?.id || ""),
      ]);
      const msgArr = (Array.isArray((msgsRes as any)?.messages)
        ? (msgsRes as any).messages
        : (Array.isArray(msgsRes) ? msgsRes : [])) as ChatMessage[];
      setMessages(msgArr);
      setMessagesCursor((msgsRes as any)?.nextCursor || null);
      setHasMoreMessages(Boolean((msgsRes as any)?.hasMore ?? (msgArr.length >= 50)));
      setBlockStatus(blockSt as BlockStatus);

      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c)
      );

      setTimeout(() => {
        scrollToBottom("auto");
        inputRef.current?.focus();
      }, 100);

      const s = getSocket();
      s.emit("messages-read", { conversationId: conv.id, receiverId: conv.otherUser?.id });
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  // Infinite scroll: load older messages
  const loadOlderMessages = useCallback(async () => {
    if (!activeConv || loadingMore || !hasMoreMessages || !messagesCursor) return;
    setLoadingMore(true);
    try {
      const olderRes = await chatApi.messagesCursor(activeConv.id, messagesCursor);
      const older = (olderRes?.messages || []) as ChatMessage[];
      setMessagesCursor(olderRes?.nextCursor || null);
      setHasMoreMessages(Boolean(olderRes?.hasMore));
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
      }
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeConv, messagesCursor, loadingMore, hasMoreMessages]);

  const goBack = () => {
    for (const m of messagesRef.current) revokeBlobUrlIfNeeded(m.mediaUrl);
    setView("list");
    setActiveConv(null);
    setMessages([]);
    setBlockStatus(null);
    setShowBlockMenu(false);
    setReplyTo(null);
    setMessagesCursor(null);
    setMsgSearch("");
    setShowMsgSearch(false);
    // Cleanup per-conversation typing throttle entries
    lastTypingEmitMap.clear();
    retryTimersRef.current.forEach((timer) => clearTimeout(timer));
    retryTimersRef.current.clear();
  };

  const isTransientSendError = (err: any) => {
    const status = Number(err?.status || 0);
    return !status || status === 408 || status >= 500;
  };

  const scheduleAutoRetry = useCallback((params: {
    tempId: string;
    conversationId: string;
    content: string;
    replyToId?: string | null;
    attempt: number;
    t: any;
  }) => {
    const { tempId, conversationId, content, replyToId, attempt, t } = params;
    const maxAttempts = 3;
    if (attempt > maxAttempts) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
      toast.error(t("chat.sendFailed", "فشل إرسال الرسالة"));
      return;
    }

    const delayMs = Math.min(8000, 1000 * (2 ** (attempt - 1)));
    setMessages(prev => prev.map(m => m.id === tempId
      ? { ...m, _pending: true, _failed: false, _retryCount: attempt, _nextRetryAt: new Date(Date.now() + delayMs).toISOString() }
      : m
    ));

    const existing = retryTimersRef.current.get(tempId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        const sentMsg = await chatApi.sendMessage(conversationId, {
          content,
          type: "text",
          ...(replyToId ? { replyToId } : {}),
        }) as any;

        setMessages(prev => prev.map(m => m.id === tempId ? { ...sentMsg, senderId: "me", _pending: false } : m));
        setConversations(prev => prev.map(c => c.id === conversationId
          ? { ...c, lastMessage: { ...sentMsg, content }, lastMessageAt: sentMsg.createdAt }
          : c
        ));
        retryTimersRef.current.delete(tempId);
      } catch (err: any) {
        if (isTransientSendError(err)) {
          scheduleAutoRetry({ tempId, conversationId, content, replyToId, attempt: attempt + 1, t });
        } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
          retryTimersRef.current.delete(tempId);
          toast.error(err?.message || t("chat.sendFailed", "فشل إرسال الرسالة"));
        }
      }
    }, delayMs);

    retryTimersRef.current.set(tempId, timer);
  }, [setConversations]);

  const sendMessage = useCallback(async (t: any) => {
    if (!newMessage.trim() || !activeConv || sendingMsg) return;
    if (blockStatus?.isBlocked) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: activeConv.id,
      senderId: "me",
      content,
      type: "text",
      createdAt: new Date().toISOString(),
      isRead: false,
      isDeleted: false,
      coinsCost: 0,
      isEncrypted: true,
      _pending: true,
      replyToId: replyTo?.id || null,
      replyToContent: replyTo?.content || null,
      replyToSenderName: replyTo ? (replyTo.senderId === "me" ? t("chat.you") : activeConv.otherUser?.displayName || "") : null,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage("");
    setReplyTo(null);
    setTimeout(() => scrollToBottom(), 50);

    const s = getSocket();
    s.emit("stop-typing", { conversationId: activeConv.id, receiverId: activeConv.otherUser?.id });

    try {
      setSendingMsg(true);
      const sentMsg = await chatApi.sendMessage(activeConv.id, {
        content,
        type: "text",
        ...(replyTo?.id ? { replyToId: replyTo.id } : {}),
      }) as any;

      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...sentMsg, senderId: "me", _pending: false } : m)
      );

      setConversations(prev =>
        prev.map(c => c.id === activeConv.id
          ? { ...c, lastMessage: { ...sentMsg, content }, lastMessageAt: sentMsg.createdAt }
          : c
        )
      );
    } catch (err: any) {
      // Mark as failed instead of removing (allows retry)
      if (err.status === 402) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
        toast.error(t("chat.notEnoughCoins", "رصيد غير كافي"));
      } else if (err.status === 429) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
        toast.error(err.message || t("chat.rateLimited", "أنت ترسل بسرعة كبيرة، حاول بعد قليل"));
      } else if (err.status === 403) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
        toast.error(err.message || t("chat.blocked", "تم الحظر"));
      } else {
        if (isTransientSendError(err)) {
          scheduleAutoRetry({
            tempId,
            conversationId: activeConv.id,
            content,
            replyToId: replyTo?.id || null,
            attempt: 1,
            t,
          });
        } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
          toast.error(err?.message || t("chat.sendFailed", "فشل إرسال الرسالة"));
        }
      }
    } finally {
      setSendingMsg(false);
    }
  }, [newMessage, activeConv, sendingMsg, blockStatus, replyTo, setConversations, scheduleAutoRetry]);

  /** Send a media message (image or voice) */
  const sendMedia = useCallback(async (file: File | Blob, type: "image" | "voice", t: any) => {
    if (!activeConv || sendingMsg) return;
    if (blockStatus?.isBlocked) return;

    const tempId = `temp-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);

    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: activeConv.id,
      senderId: "me",
      content: type === "image" ? "📷 صورة" : "🎤 رسالة صوتية",
      type,
      mediaUrl: localUrl,
      createdAt: new Date().toISOString(),
      isRead: false,
      isDeleted: false,
      coinsCost: 0,
      _pending: true,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(), 50);

    try {
      setSendingMsg(true);
      // Upload file first
      const mediaUrl = await uploadMedia(file, file instanceof File ? file.name : undefined);
      // Then send message with the server URL
      const sentMsg = await chatApi.sendMessage(activeConv.id, {
        content: type === "image" ? "📷 صورة" : "🎤 رسالة صوتية",
        type,
        mediaUrl,
      }) as any;

      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...sentMsg, senderId: "me", _pending: false } : m)
      );
      revokeBlobUrlIfNeeded(localUrl);

      setConversations(prev =>
        prev.map(c => c.id === activeConv.id
          ? { ...c, lastMessage: { ...sentMsg, content: sentMsg.content }, lastMessageAt: sentMsg.createdAt }
          : c
        )
      );
    } catch (err: any) {
      // Mark as failed instead of removing (allows retry) — keep blob URL alive for retry
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
      if (err.status === 402) {
        toast.error(t("chat.notEnoughCoins", "رصيد غير كافي"));
      } else {
        toast.error(err.message || t("chat.uploadFailed", "فشل في الرفع"));
      }
    } finally {
      setSendingMsg(false);
    }
  }, [activeConv, sendingMsg, blockStatus, setConversations]);

  /** Retry a failed message — directly calls API instead of relying on setState */
  const retryMessage = useCallback(async (failedMsg: ChatMessage, t: any) => {
    if (!activeConv || sendingMsg) return;

    const pendingTimer = retryTimersRef.current.get(failedMsg.id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      retryTimersRef.current.delete(failedMsg.id);
    }

    // Mark as pending (retrying)
    setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, _failed: false, _pending: true } : m));

    if (failedMsg.type === "text" && failedMsg.content) {
      try {
        setSendingMsg(true);
        const sentMsg = await chatApi.sendMessage(activeConv.id, {
          content: failedMsg.content,
          type: "text",
          ...(failedMsg.replyToId ? { replyToId: failedMsg.replyToId } : {}),
        }) as any;
        setMessages(prev =>
          prev.map(m => m.id === failedMsg.id ? { ...sentMsg, senderId: "me", _pending: false } : m)
        );
        setConversations(prev =>
          prev.map(c => c.id === activeConv.id
            ? { ...c, lastMessage: { ...sentMsg, content: failedMsg.content }, lastMessageAt: sentMsg.createdAt }
            : c
          )
        );
      } catch (err: any) {
        setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, _pending: false, _failed: true } : m));
        if (err.status === 402) {
          toast.error(t("chat.notEnoughCoins", "رصيد غير كافي"));
        } else if (err.status === 429) {
          toast.error(err.message || t("chat.rateLimited", "أنت ترسل بسرعة كبيرة، حاول بعد قليل"));
        } else if (err.status === 403) {
          toast.error(err.message || t("chat.blocked", "تم الحظر"));
        } else {
          toast.error(err?.message || t("chat.retryFailed", "فشل في إعادة المحاولة"));
        }
      } finally {
        setSendingMsg(false);
      }
    } else if ((failedMsg.type === "image" || failedMsg.type === "voice") && failedMsg.mediaUrl) {
      try {
        const resp = await fetch(failedMsg.mediaUrl);
        const blob = await resp.blob();
        // Remove failed and re-send via sendMedia
        setMessages(prev => prev.filter(m => m.id !== failedMsg.id));
        revokeBlobUrlIfNeeded(failedMsg.mediaUrl);
        sendMedia(blob, failedMsg.type, t);
      } catch {
        setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, _pending: false, _failed: true } : m));
        toast.error(t("chat.retryFailed", "فشل في إعادة المحاولة"));
      }
    }
  }, [activeConv, sendingMsg, sendMedia, setConversations]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (!activeConv) return;

    const now = Date.now();
    const lastEmit = lastTypingEmitMap.get(activeConv.id) || 0;
    if (now - lastEmit >= TYPING_THROTTLE_MS) {
      lastTypingEmitMap.set(activeConv.id, now);
      socketManager.emitVolatile("typing", {
        conversationId: activeConv.id,
        receiverId: activeConv.otherUser?.id,
      });
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketManager.emitVolatile("stop-typing", {
        conversationId: activeConv.id,
        receiverId: activeConv.otherUser?.id,
      });
    }, 3000);
  };

  const handleToggleBlock = async () => {
    if (!activeConv?.otherUser?.id) return;
    try {
      if (blockStatus?.blockedByMe) {
        await chatBlocksApi.unblock(activeConv.otherUser.id);
        setBlockStatus({ isBlocked: false, blockedByMe: false, blockedByThem: false });
      } else {
        await chatBlocksApi.block(activeConv.otherUser.id);
        setBlockStatus({ isBlocked: true, blockedByMe: true, blockedByThem: false });
      }
      setShowBlockMenu(false);
    } catch (err) {
      toast.error("حدث خطأ في الحظر");
    }
  };

  const deleteMyMessage = useCallback(async (msgId: string, mode: "forMe" | "forEveryone" = "forEveryone") => {
    try {
      await chatApi.deleteMessage(msgId, mode);
      if (mode === "forMe") {
        // Just remove from local view
        let removedMediaUrl: string | null | undefined;
        setMessages(prev => {
          const target = prev.find(m => m.id === msgId);
          removedMediaUrl = target?.mediaUrl;
          return prev.filter(m => m.id !== msgId);
        });
        revokeBlobUrlIfNeeded(removedMediaUrl);
      } else {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: null } : m));
      }
    } catch (err) {
      toast.error("فشل في حذف الرسالة");
    }
  }, []);

  // Filtered messages for search
  const filteredMessages = useMemo(() => {
    if (!msgSearch.trim()) return messages;
    const q = msgSearch.toLowerCase();
    return messages.filter(m => m.content?.toLowerCase().includes(q));
  }, [messages, msgSearch]);

  return {
    view, setView,
    activeConv, setActiveConv,
    messages, setMessages,
    newMessage, setNewMessage,
    isTyping,
    sendingMsg,
    blockStatus, setBlockStatus,
    showBlockMenu, setShowBlockMenu,
    replyTo, setReplyTo,
    messagesEndRef, messagesTopRef, messagesContainerRef, inputRef,
    openConversation, goBack, sendMessage, sendMedia, retryMessage, handleInputChange, handleToggleBlock,
    deleteMyMessage,
    typingConvIds,
    showNewMsgIndicator, scrollToBottom,
    // Infinite scroll
    loadOlderMessages, hasMoreMessages, loadingMore,
    // In-conversation search
    msgSearch, setMsgSearch, showMsgSearch, setShowMsgSearch, filteredMessages,
    // Reaction version (incremented on socket reaction-updated events)
    reactionVersion,
  };
}

/** Hook: Manage report modal */
export function useReportModal(activeConv: Conversation | null) {
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);

  const handleReport = async (category: string, reason: string) => {
    if (!reportTarget || !activeConv) return;
    try {
      await messageReportsApi.report({
        messageId: reportTarget.id,
        conversationId: activeConv.id,
        reportedUserId: activeConv.otherUser?.id || "",
        category,
        reason,
      });
      setReportTarget(null);
    } catch (err) {
      toast.error("فشل في إرسال البلاغ");
    }
  };

  return { reportTarget, setReportTarget, handleReport };
}

type TranslationEntry = {
  text: string;
  detectedLang?: string;
};

const translationCache = new Map<string, TranslationEntry>();
const translationInflight = new Set<string>();

function normalizeLangCode(code: string): string {
  const normalized = String(code || "").trim().replace(/_/g, "-");
  if (!normalized) return "ar";
  const parts = normalized.split("-");
  if (parts.length < 2) return parts[0].toLowerCase();
  return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
}

function getCacheKey(content: string, targetLang: string) {
  return `${normalizeLangCode(targetLang)}::${content.trim()}`;
}

/** Hook: Automatic translation map for all visible chat messages. */
export function useAutoMessageTranslations(params: {
  messages: ChatMessage[];
  targetLang: string;
  enabled: boolean;
}) {
  const { messages, targetLang, enabled } = params;
  const [translations, setTranslations] = useState<Record<string, TranslationEntry>>({});
  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({});

  const translateOne = useCallback(async (msg: ChatMessage) => {
    const content = msg.content?.trim();
    if (!content || msg.type !== "text" || msg.isDeleted) return;

    const cacheKey = getCacheKey(content, targetLang);
    const cached = translationCache.get(cacheKey);
    if (cached) {
      setTranslations((prev) => (prev[msg.id]?.text === cached.text ? prev : { ...prev, [msg.id]: cached }));
      return;
    }

    if (translationInflight.has(cacheKey)) return;
    translationInflight.add(cacheKey);
    setLoadingById((prev) => ({ ...prev, [msg.id]: true }));

    try {
      const result = await translateApi.translate(content, targetLang);
      const entry: TranslationEntry = {
        text: String(result.translatedText || "").trim(),
        detectedLang: result.detectedLang,
      };
      translationCache.set(cacheKey, entry);
      setTranslations((prev) => ({ ...prev, [msg.id]: entry }));
    } catch {
      // Silent fail to avoid noisy UX while auto-translating.
    } finally {
      translationInflight.delete(cacheKey);
      setLoadingById((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
    }
  }, [targetLang]);

  useEffect(() => {
    if (!enabled) return;

    const candidates = messages.filter((m) => {
      if (!m.content || m.type !== "text" || m.isDeleted) return false;
      if (translations[m.id]?.text) return false;
      const key = getCacheKey(m.content, targetLang);
      return !translationInflight.has(key);
    });

    if (candidates.length === 0) return;

    // Limit work per cycle to keep scrolling smooth on large conversations.
    const batch = candidates.slice(0, 12);
    void Promise.all(batch.map((m) => translateOne(m)));
  }, [messages, enabled, targetLang, translations, translateOne]);

  useEffect(() => {
    if (enabled) return;
    setLoadingById({});
  }, [enabled]);

  return {
    translations,
    loadingById,
    forceTranslateMessage: translateOne,
    normalizedTargetLang: normalizeLangCode(targetLang),
  };
}
