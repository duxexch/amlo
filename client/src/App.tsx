import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { Home } from "@/pages/Home";
import { Room } from "@/pages/Room";
import { Wallet } from "@/pages/Wallet";
import { UserAuth } from "@/pages/UserAuth";
import { PinEntry } from "@/pages/PinEntry";
import { PinSetup } from "@/pages/PinSetup";
import { Profile } from "@/pages/Profile";
import { Policy } from "@/pages/Policy";
import { AgentApply } from "@/pages/AgentApply";
import { AccountApply } from "@/pages/AccountApply";
import { Friends } from "@/pages/Friends";
import { CallScreen } from "@/pages/CallScreen";
import { WorldExplore } from "@/pages/WorldExplore";
import { LiveBroadcast } from "@/pages/LiveBroadcast";
import { CallPopup } from "@/components/ui/CallPopup";
import { AnnouncementPopup } from "@/components/ui/AnnouncementPopup";
import { useState, useEffect } from "react";

// Admin Pages (separated module)
import { AdminProvider, AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminLoginPage } from "@/pages/admin/Login";
import { DashboardPage } from "@/pages/admin/Dashboard";
import { UsersManagementPage } from "@/pages/admin/UsersManagement";
import { AgentsManagementPage } from "@/pages/admin/AgentsManagement";
import { GiftsManagementPage } from "@/pages/admin/GiftsManagement";
import { FinancesPage } from "@/pages/admin/Finances";
import { ReportsPage } from "@/pages/admin/Reports";
import { SettingsPage } from "@/pages/admin/Settings";
import { FraudDetectionPage } from "@/pages/admin/FraudDetection";
import { ChatManagementPage } from "@/pages/admin/ChatManagement";

// Agent Pages
import { AgentProvider, AgentLoginPage, AgentDashboardPage } from "@/pages/agent/AgentPanel";

/** Admin Panel — completely separate layout and auth */
function AdminRouter() {
  return (
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
  );
}

/** Agent Panel — separate layout and auth */
function AgentRouter() {
  return (
    <AgentProvider>
      <Switch>
        <Route path="/agent" component={AgentLoginPage} />
        <Route path="/agent/dashboard" component={AgentDashboardPage} />
        <Route component={NotFound} />
      </Switch>
    </AgentProvider>
  );
}

/** User-facing app — original layout */
function UserRouter() {
  return (
    <AppLayout>
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
    </AppLayout>
  );
}

function Router() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const isAgent = location.startsWith("/agent");
  const isAgentApply = location.startsWith("/agent-apply");
  const isAccountApply = location.startsWith("/account-apply");
  if (isAgentApply) return <Route path="/agent-apply" component={AgentApply} />;
  if (isAccountApply) return <Route path="/account-apply" component={AccountApply} />;
  if (location === "/call") return <CallScreen />;
  if (location === "/auth") return <UserAuth />;
  if (location === "/pin") return <PinEntry />;
  if (location === "/pin-setup") return <PinSetup />;
  return isAdmin ? <AdminRouter /> : isAgent ? <AgentRouter /> : <UserRouter />;
}

function App() {
  const [incomingCall, setIncomingCall] = useState(false);
  const [location] = useLocation();
  const isAppPage = !location.startsWith('/admin') && !location.startsWith('/agent') && !location.startsWith('/agent-apply') && !location.startsWith('/account-apply') && location !== '/auth' && location !== '/pin' && location !== '/pin-setup';

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <CallPopup 
          isOpen={incomingCall} 
          onAccept={() => setIncomingCall(false)} 
          onDecline={() => setIncomingCall(false)} 
        />
        {isAppPage && <AnnouncementPopup />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;