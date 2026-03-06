/**
 * Chat Custom Hooks — هوكس الدردشة
 * ════════════════════════════════════════
 * Extracted from Chat.tsx for cleaner architecture.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { chatApi, callsApi, chatBlocksApi, messageReportsApi, translateApi } from "@/lib/socialApi";
import { getSocket, socketManager } from "@/lib/socketManager";
import type {
  Conversation, ChatMessage, BlockStatus, ChatSettings,
  ViewMode, NewMessagePayload, TypingPayload, MessagesReadPayload,
  ChatBlockedPayload, ReportCategory,
} from "./chatTypes";

// ── Typing throttle: client-side (complementary to server-side throttle) ──
const TYPING_THROTTLE_MS = 2500;
let lastTypingEmit = 0;

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

/** Hook: Manage conversations list + settings */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [loading, setLoading] = useState(true);

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

  const totalUnread = useMemo(() =>
    conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  return { conversations, setConversations, settings, loading, totalUnread };
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
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Track which conversations have typing indicators */
  const [typingConvIds, setTypingConvIds] = useState<Set<string>>(new Set());
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Socket listeners
  useEffect(() => {
    const s = getSocket();

    const handleNewMessage = (data: NewMessagePayload) => {
      if (activeConv?.id === data.conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        s.emit("messages-read", {
          conversationId: data.conversationId,
          receiverId: activeConv.otherUser?.id,
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
              unreadCount: activeConv?.id === data.conversationId ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    };

    const handleTyping = (data: TypingPayload) => {
      if (data.conversationId === activeConv?.id) setIsTyping(true);
      // Show typing in conversation list
      setTypingConvIds(prev => new Set(prev).add(data.conversationId));
      // Auto-clear typing after 4s
      const existing = typingTimeouts.current.get(data.conversationId);
      if (existing) clearTimeout(existing);
      typingTimeouts.current.set(data.conversationId, setTimeout(() => {
        setTypingConvIds(prev => {
          const next = new Set(prev);
          next.delete(data.conversationId);
          return next;
        });
        if (data.conversationId === activeConv?.id) setIsTyping(false);
      }, 4000));
    };

    const handleStopTyping = (data: { conversationId: string }) => {
      if (data.conversationId === activeConv?.id) setIsTyping(false);
      setTypingConvIds(prev => {
        const next = new Set(prev);
        next.delete(data.conversationId);
        return next;
      });
    };

    const handleMessagesRead = (data: MessagesReadPayload) => {
      if (data.conversationId === activeConv?.id) {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      }
    };

    const handleChatBlocked = (data: ChatBlockedPayload) => {
      if (activeConv?.otherUser?.id === data.blockerId) {
        setBlockStatus({ isBlocked: true, blockedByThem: true, blockedByMe: false });
      }
    };

    s.on("new-message", handleNewMessage);
    s.on("typing", handleTyping);
    s.on("stop-typing", handleStopTyping);
    s.on("messages-read", handleMessagesRead);
    s.on("chat-blocked", handleChatBlocked);

    return () => {
      s.off("new-message", handleNewMessage);
      s.off("typing", handleTyping);
      s.off("stop-typing", handleStopTyping);
      s.off("messages-read", handleMessagesRead);
      s.off("chat-blocked", handleChatBlocked);
    };
  }, [activeConv, setConversations]);

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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    setView("list");
    setActiveConv(null);
    setMessages([]);
    setBlockStatus(null);
    setShowBlockMenu(false);
    setReplyTo(null);
    setMsgSearch("");
    setShowMsgSearch(false);
  };

  const sendMessage = useCallback(async (t: (key: string) => string) => {
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

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
      setMessages(prev => prev.filter(m => m.id !== tempId));
      if (err.status === 402) {
        alert(t("chat.notEnoughCoins"));
      } else if (err.status === 403) {
        alert(err.message || t("chat.blocked"));
      }
    } finally {
      setSendingMsg(false);
    }
  }, [newMessage, activeConv, sendingMsg, blockStatus, replyTo, setConversations]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!activeConv) return;

    const now = Date.now();
    if (now - lastTypingEmit >= TYPING_THROTTLE_MS) {
      lastTypingEmit = now;
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
      console.error("Block error:", err);
    }
  };

  const handleReport = async (category: string, reason: string) => {
    // This will be called with reportTarget set externally
  };

  const deleteMyMessage = useCallback(async (msgId: string) => {
    try {
      await chatApi.deleteMessage(msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: null } : m));
    } catch (err) {
      console.error("Delete message error:", err);
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
    messagesEndRef, messagesTopRef, inputRef,
    openConversation, goBack, sendMessage, handleInputChange, handleToggleBlock,
    deleteMyMessage,
    typingConvIds,
    // Infinite scroll
    loadOlderMessages, hasMoreMessages, loadingMore,
    // In-conversation search
    msgSearch, setMsgSearch, showMsgSearch, setShowMsgSearch, filteredMessages,
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
      console.error("Failed to report message:", err);
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
      // silently fail
    } finally {
      setIsTranslating(false);
    }
  };

  return { translatedText, isTranslating, showTranslation, handleTranslate };
}
