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
function playNotificationSound() {
  try {
    if (!notifAudio) {
      notifAudio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZWTi4F3cXV7f4WIioqHhH95dHB0eYCFiImIhYJ+eXZ0d3t/g4aHh4WDgH15dnd5fICDhYaFg4GAfoB8fH5/gIGBgQA=");
    }
    notifAudio.currentTime = 0;
    notifAudio.volume = 0.3;
    notifAudio.play().catch(() => {});
  } catch {}
}

function revokeBlobUrlIfNeeded(url?: string | null) {
  if (url && url.startsWith("blob:")) {
    try { URL.revokeObjectURL(url); } catch {}
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
  const [msgPage, setMsgPage] = useState(1);
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Revoke any leftover local blob URLs on unmount.
  useEffect(() => {
    return () => {
      for (const m of messagesRef.current) revokeBlobUrlIfNeeded(m.mediaUrl);
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
        // Play sound for messages in other conversations
        playNotificationSound();
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
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      }
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
    setMsgPage(1);
    setHasMoreMessages(true);
    setMsgSearch("");
    setShowMsgSearch(false);

    try {
      const [msgs, blockSt] = await Promise.all([
        chatApi.messages(conv.id),
        chatBlocksApi.status(conv.otherUser?.id || ""),
      ]);
      const msgArr = (msgs || []) as ChatMessage[];
      setMessages(msgArr);
      setHasMoreMessages(msgArr.length >= 50);
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
    if (!activeConv || loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    try {
      const nextPage = msgPage + 1;
      const older = await chatApi.messages(activeConv.id, nextPage) as ChatMessage[];
      if (older.length === 0 || older.length < 50) setHasMoreMessages(false);
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        setMsgPage(nextPage);
      }
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeConv, msgPage, loadingMore, hasMoreMessages]);

  const goBack = () => {
    for (const m of messagesRef.current) revokeBlobUrlIfNeeded(m.mediaUrl);
    setView("list");
    setActiveConv(null);
    setMessages([]);
    setBlockStatus(null);
    setShowBlockMenu(false);
    setReplyTo(null);
    setMsgSearch("");
    setShowMsgSearch(false);
    // Cleanup per-conversation typing throttle entries
    lastTypingEmitMap.clear();
  };

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
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
      if (err.status === 402) {
        toast.error(t("chat.notEnoughCoins", "رصيد غير كافي"));
      } else if (err.status === 403) {
        toast.error(err.message || t("chat.blocked", "تم الحظر"));
      }
    } finally {
      setSendingMsg(false);
    }
  }, [newMessage, activeConv, sendingMsg, blockStatus, replyTo, setConversations]);

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
        if (err.status === 402) toast.error(t("chat.notEnoughCoins", "رصيد غير كافي"));
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

/** Hook: Translation */
export function useMessageTranslation(content: string | null, i18nLang: string) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }
    if (!content || isTranslating) return;
    setIsTranslating(true);
    try {
      const targetLang = localStorage.getItem("ablox_translate_lang") || i18nLang || "ar";
      const result = await translateApi.translate(content, targetLang);
      setTranslatedText(result.translatedText);
      setShowTranslation(true);
    } catch {
      toast.error("فشل في الترجمة");
    } finally {
      setIsTranslating(false);
    }
  };

  return { translatedText, isTranslating, showTranslation, handleTranslate };
}
