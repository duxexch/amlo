/**
 * Admin Chat — Blocks Tab (الحظر)
 * ════════════════════════════════════════
 */
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Ban, Unlock, Loader2 } from "lucide-react";
import { adminChatManagement } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { LoadingSkeleton, EmptyState, formatDate } from "./AdminChatShared";
import type { ChatBlock } from "../../chat/chatTypes";

export function BlocksTab() {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [blockPage, setBlockPage] = useState(1);
  const [blockTotal, setBlockTotal] = useState(0);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminChatManagement.getChatBlocks(blockPage);
      setBlocks(res.data || []);
      setBlockTotal(res.pagination?.total || 0);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [blockPage]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleRemoveBlock = async (id: string) => {
    setRemovingBlockId(id);
    try {
      await adminChatManagement.removeChatBlock(id);
      setBlocks(prev => prev.filter(b => b.id !== id));
    } catch (err) { console.error(err); }
    setRemovingBlockId(null);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {blocks.length > 0 ? (
        <div className="space-y-3">
          {blocks.map(block => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <Ban className="w-5 h-5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {block.blocker?.displayName || block.blocker?.username || block.blockerId}
                  </p>
                  <p className="text-white/30 text-[11px]">
                    {t("admin.chats.blocked")}: {block.blocked?.displayName || block.blocked?.username || block.blockedId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-white/20 text-[10px]">{formatDate(block.createdAt)}</span>
                <button
                  onClick={() => handleRemoveBlock(block.id)}
                  disabled={removingBlockId === block.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {removingBlockId === block.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                  {t("admin.chats.removeBlock")}
                </button>
              </div>
            </motion.div>
          ))}

          {blockTotal > 20 && (
            <div className="flex justify-center gap-2 pt-4">
              <button onClick={() => setBlockPage(p => Math.max(1, p - 1))} disabled={blockPage <= 1} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30">{t("common.previous")}</button>
              <span className="px-3 py-1.5 text-xs text-white/30">{blockPage}</span>
              <button onClick={() => setBlockPage(p => p + 1)} disabled={blocks.length < 20} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:bg-white/10 disabled:opacity-30">{t("common.next")}</button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState message={t("admin.chats.noBlocks")} icon={Ban} />
      )}
    </div>
  );
}
