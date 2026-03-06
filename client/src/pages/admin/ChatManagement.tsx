/**
 * Admin Chat & Broadcast Management Page
 * ════════════════════════════════════════
 * Main layout with tab navigation; each tab is a separate component.
 * Moderation & Settings unified into single tab.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, MessageSquare, Send, Phone, Radio, Shield, Flag, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OverviewTab } from "./chat/OverviewTab";
import { ConversationsTab } from "./chat/ConversationsTab";
import { MessagesTab } from "./chat/MessagesTab";
import { CallsTab } from "./chat/CallsTab";
import { LiveStreamsTab } from "./chat/LiveStreamsTab";
import { ModerationSettingsTab } from "./chat/ModerationSettingsTab";
import { ReportsTab } from "./chat/ReportsTab";
import { BlocksTab } from "./chat/BlocksTab";

const TABS = [
  { key: "overview", icon: BarChart3, labelKey: "admin.chatManagement.tabs.overview" },
  { key: "conversations", icon: MessageSquare, labelKey: "admin.chatManagement.tabs.conversations" },
  { key: "messages", icon: Send, labelKey: "admin.chatManagement.tabs.messages" },
  { key: "calls", icon: Phone, labelKey: "admin.chatManagement.tabs.calls" },
  { key: "streams", icon: Radio, labelKey: "admin.chatManagement.tabs.streams" },
  { key: "moderation", icon: Shield, labelKey: "admin.chatManagement.tabs.moderation" },
  { key: "reports", icon: Flag, labelKey: "admin.chats.reports" },
  { key: "blocks", icon: Ban, labelKey: "admin.chats.blocks" },
];

export function ChatManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t("admin.chatManagement.title")}</h1>
        <p className="text-white/50 text-sm mt-1">{t("admin.chatManagement.subtitle")}</p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-purple-500/30 shadow-lg shadow-purple-500/10"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? "text-purple-400" : ""}`} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "conversations" && <ConversationsTab />}
          {activeTab === "messages" && <MessagesTab />}
          {activeTab === "calls" && <CallsTab />}
          {activeTab === "streams" && <LiveStreamsTab />}
          {activeTab === "moderation" && <ModerationSettingsTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "blocks" && <BlocksTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
