import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { CallPopup } from "@/components/ui/CallPopup";
import { AnnouncementPopup } from "@/components/ui/AnnouncementPopup";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useState, useEffect, lazy, Suspense } from "react";
import { callsApi } from "@/lib/socialApi";
import { ensurePushSubscription } from "@/lib/pushNotifications";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { NotificationCenterPanel } from "@/components/NotificationCenterPanel";
import {
  ensureForegroundNotificationPermission,
  initNotificationCenter,
  publishNotification,
} from "@/lib/notificationCenter";

// ── Lazy-loaded pages (code splitting) ──
const Home = lazy(() => import("@/pages/Home").then(m => ({ default: m.Home })));
const Room = lazy(() => import("@/pages/Room").then(m => ({ default: m.Room })));
const Wallet = lazy(() => import("@/pages/Wallet").then(m => ({ default: m.Wallet })));
const UserAuth = lazy(() => import("@/pages/UserAuth").then(m => ({ default: m.UserAuth })));
const PinEntry = lazy(() => import("@/pages/PinEntry").then(m => ({ default: m.PinEntry })));
const PinSetup = lazy(() => import("@/pages/PinSetup").then(m => ({ default: m.PinSetup })));
const Profile = lazy(() => import("@/pages/Profile").then(m => ({ default: m.Profile })));
const Policy = lazy(() => import("@/pages/Policy").then(m => ({ default: m.Policy })));
const ResetPassword = lazy(() => import("@/pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const DownloadPage = lazy(() => import("@/pages/Download").then(m => ({ default: m.DownloadPage })));
const AgentApply = lazy(() => import("@/pages/AgentApply").then(m => ({ default: m.AgentApply })));
const AccountApply = lazy(() => import("@/pages/AccountApply").then(m => ({ default: m.AccountApply })));
const Friends = lazy(() => import("@/pages/Friends").then(m => ({ default: m.Friends })));
const CallScreen = lazy(() => import("@/pages/CallScreen").then(m => ({ default: m.CallScreen })));
const WorldExplore = lazy(() => import("@/pages/WorldExplore").then(m => ({ default: m.WorldExplore })));
const LiveBroadcast = lazy(() => import("@/pages/LiveBroadcast").then(m => ({ default: m.LiveBroadcast })));

// Admin Pages (separate chunk)
const AdminProvider = lazy(() => import("@/pages/admin/AdminLayout").then(m => ({ default: m.AdminProvider })));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() => import("@/pages/admin/Login").then(m => ({ default: m.AdminLoginPage })));
const DashboardPage = lazy(() => import("@/pages/admin/Dashboard").then(m => ({ default: m.DashboardPage })));
const UsersManagementPage = lazy(() => import("@/pages/admin/UsersManagement").then(m => ({ default: m.UsersManagementPage })));
const AgentsManagementPage = lazy(() => import("@/pages/admin/AgentsManagement").then(m => ({ default: m.AgentsManagementPage })));
const GiftsManagementPage = lazy(() => import("@/pages/admin/GiftsManagement").then(m => ({ default: m.GiftsManagementPage })));
const FinancesPage = lazy(() => import("@/pages/admin/Finances").then(m => ({ default: m.FinancesPage })));
const ReportsPage = lazy(() => import("@/pages/admin/Reports").then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import("@/pages/admin/Settings").then(m => ({ default: m.SettingsPage })));
const FraudDetectionPage = lazy(() => import("@/pages/admin/FraudDetection").then(m => ({ default: m.FraudDetectionPage })));
const ChatManagementPage = lazy(() => import("@/pages/admin/ChatManagement").then(m => ({ default: m.ChatManagementPage })));

// Agent Pages (separate chunk)
const AgentProvider = lazy(() => import("@/pages/agent/AgentPanel").then(m => ({ default: m.AgentProvider })));
const AgentLoginPage = lazy(() => import("@/pages/agent/AgentPanel").then(m => ({ default: m.AgentLoginPage })));
const AgentDashboardPage = lazy(() => import("@/pages/agent/AgentPanel").then(m => ({ default: m.AgentDashboardPage })));

// ── Loading fallback ──
function PageLoader() {
  return (
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

/** Admin Panel — completely separate layout and auth */
function AdminRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminProvider>
        <Switch>
          <Route path="/admin" component={AdminLoginPage} />
          <Route path="/admin/dashboard">
            <AdminLayout><DashboardPage /></AdminLayout>
          </Route>
          <Route path="/admin/users">
            <AdminLayout><UsersManagementPage /></AdminLayout>
          </Route>
          <Route path="/admin/agents">
            <AdminLayout><AgentsManagementPage /></AdminLayout>
          </Route>
          <Route path="/admin/chat-management">
            <AdminLayout><ChatManagementPage /></AdminLayout>
          </Route>
          <Route path="/admin/gifts">
            <AdminLayout><GiftsManagementPage /></AdminLayout>
          </Route>
          <Route path="/admin/finances">
            <AdminLayout><FinancesPage /></AdminLayout>
          </Route>
          <Route path="/admin/reports">
            <AdminLayout><ReportsPage /></AdminLayout>
          </Route>
          <Route path="/admin/fraud">
            <AdminLayout><FraudDetectionPage /></AdminLayout>
          </Route>
          <Route path="/admin/settings">
            <AdminLayout><SettingsPage /></AdminLayout>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </AdminProvider>
    </Suspense>
  );
}

/** Agent Panel — separate layout and auth */
function AgentRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AgentProvider>
        <Switch>
          <Route path="/agent" component={AgentLoginPage} />
          <Route path="/agent/dashboard" component={AgentDashboardPage} />
          <Route component={NotFound} />
        </Switch>
      </AgentProvider>
    </Suspense>
  );
}

/** User-facing app — original layout */
function UserRouter() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/live" component={LiveBroadcast} />
          <Route path="/room" component={Room} />
          <Route path="/room/:id" component={Room} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/profile" component={Profile} />
          <Route path="/profile/:id" component={Profile} />
          <Route path="/friends" component={Friends} />
          <Route path="/chat" component={Friends} />
          <Route path="/world" component={WorldExplore} />
          <Route path="/privacy" >{() => <Policy type="privacy" />}</Route>
          <Route path="/terms" >{() => <Policy type="terms" />}</Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

function Router() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const isAgent = location.startsWith("/agent");
  const isAgentApply = location.startsWith("/agent-apply");
  const isAccountApply = location.startsWith("/account-apply");
  if (isAgentApply) return <Suspense fallback={<PageLoader />}><Route path="/agent-apply" component={AgentApply} /></Suspense>;
  if (isAccountApply) return <Suspense fallback={<PageLoader />}><Route path="/account-apply" component={AccountApply} /></Suspense>;
  if (location === "/call") return <Suspense fallback={<PageLoader />}><CallScreen /></Suspense>;
  if (location === "/auth") return <Suspense fallback={<PageLoader />}><UserAuth /></Suspense>;
  if (location === "/pin") return <Suspense fallback={<PageLoader />}><PinEntry /></Suspense>;
  if (location === "/pin-setup") return <Suspense fallback={<PageLoader />}><PinSetup /></Suspense>;
  if (location.startsWith("/reset-password")) return <Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>;
  if (location === "/download") return <Suspense fallback={<PageLoader />}><DownloadPage /></Suspense>;
  return isAdmin ? <AdminRouter /> : isAgent ? <AgentRouter /> : <UserRouter />;
}

function App() {
  const { t } = useTranslation();
  const [incomingCall, setIncomingCall] = useState(false);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{
    callerName?: string;
    callerId?: string;
    isVideo?: boolean;
    callId?: string;
  }>({});
  const [location, navigate] = useLocation();
  const isAppPage = !location.startsWith('/admin') && !location.startsWith('/agent') && !location.startsWith('/agent-apply') && !location.startsWith('/account-apply') && location !== '/auth' && location !== '/pin' && location !== '/pin-setup' && !location.startsWith('/reset-password') && location !== '/download';

  // ── Listen for incoming calls via Socket.io ──
  useEffect(() => {
    initNotificationCenter();
    void ensureForegroundNotificationPermission().then((permission) => {
      if (permission === "granted") {
        void ensurePushSubscription();
      }
    });

    let socket: any;
    import("@/lib/socketManager").then(({ getSocket }) => {
      socket = getSocket();
      const handleIncomingCall = (data: any) => {
        if (data && typeof data === "object") {
          const call = data.call || {};
          const caller = data.caller || {};
          setIncomingCallInfo({
            callerName: caller.displayName || caller.username || data.callerName || data.senderName,
            callerId: call.callerId || caller.id || data.callerId,
            isVideo: (call.type || data.type) === "video",
            callId: call.id || data.callId,
          });
          setIncomingCall(true);

          const callerName = caller.displayName || caller.username || data.callerName || data.senderName || "Unknown";
          publishNotification({
            type: "call",
            titleKey: "notify.call.title",
            bodyKey: "notify.call.body",
            params: { name: callerName },
            title: t("social.incomingCall", "مكالمة واردة"),
            body: `${callerName}`,
            url: "/friends",
            persistent: true,
            meta: { kind: "incoming-call" },
          });
        }
      };

      const handleNewMessageGlobal = (data: any) => {
        const onFriendsPage = window.location.pathname.startsWith("/friends") || window.location.pathname.startsWith("/chat");
        if (onFriendsPage && !document.hidden) return;

        const senderName = data?.sender?.displayName || data?.sender?.username || "User";
        const preview = data?.message?.content || t("social.newMessage", "رسالة جديدة");
        publishNotification({
          type: "message",
          titleKey: "notify.message.title",
          bodyKey: "notify.message.body",
          params: { name: senderName },
          title: t("social.newMessage", "رسالة جديدة"),
          body: preview,
          url: "/friends",
          persistent: false,
          meta: { kind: "chat-message" },
        });
      };

      const handleFriendRequestGlobal = (data: any) => {
        const onFriendsPage = window.location.pathname.startsWith("/friends") || window.location.pathname.startsWith("/chat");
        if (onFriendsPage && !document.hidden) return;

        const senderName = data?.sender?.displayName || data?.sender?.username || "User";
        publishNotification({
          type: "friend-request",
          titleKey: "notify.friend.title",
          bodyKey: "notify.friend.body",
          params: { name: senderName },
          title: t("social.newFriendRequest", "طلب صداقة جديد"),
          body: senderName,
          url: "/friends",
          persistent: false,
          meta: { kind: "friend-request" },
        });
      };

      const handleFinanceUpdatedGlobal = () => {
        if (!window.location.pathname.startsWith("/admin")) return;
        publishNotification({
          type: "admin",
          titleKey: "notify.admin.title",
          bodyKey: "notify.admin.body",
          title: t("admin.finances.title", "التحديثات المالية"),
          body: t("admin.finances.tabTransactions", "تم تحديث البيانات"),
          url: "/admin/finances",
          persistent: false,
          meta: { kind: "admin-finance" },
        });
      };

      socket.on("incoming-call", handleIncomingCall);
      socket.on("new-message", handleNewMessageGlobal);
      socket.on("friend-request", handleFriendRequestGlobal);
      socket.on("finance-updated", handleFinanceUpdatedGlobal);
      // Store cleanup ref
      (window as any).__cleanupIncomingCall = () => {
        socket.off("incoming-call", handleIncomingCall);
        socket.off("new-message", handleNewMessageGlobal);
        socket.off("friend-request", handleFriendRequestGlobal);
        socket.off("finance-updated", handleFinanceUpdatedGlobal);
      };
    });
    return () => {
      (window as any).__cleanupIncomingCall?.();
    };
  }, [t]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConnectionStatus />
          <Toaster />
          <SonnerToaster position="top-center" richColors theme="dark" />
          <Router />
          <CallPopup 
            isOpen={incomingCall} 
            callerName={incomingCallInfo.callerName}
            isVideo={incomingCallInfo.isVideo}
            onAccept={async () => {
              const { callId, callerId, isVideo } = incomingCallInfo;
              if (!callId || !callerId) {
                setIncomingCall(false);
                toast.error(t("social.callDataIncomplete", "بيانات المكالمة غير مكتملة"));
                return;
              }
              try {
                await callsApi.answer(callId);
              } catch {
                toast.error(t("social.callAcceptFailed", "تعذر قبول المكالمة"));
                setIncomingCall(false);
                return;
              }
              setIncomingCall(false);
              navigate(`/call?user=${callerId}&type=${isVideo ? "video" : "voice"}&session=${callId}`);
            }}
            onDecline={async () => {
              const { callId } = incomingCallInfo;
              if (callId) {
                try { await callsApi.reject(callId); } catch {}
              }
              setIncomingCall(false);
            }}
          />
          {isAppPage && <AnnouncementPopup />}
          {isAppPage && <PWAInstallBanner />}
          <NotificationCenterPanel />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;