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
import { Admin } from "@/pages/Admin";
import { AdminLogin } from "@/pages/AdminLogin";
import { UserAuth } from "@/pages/UserAuth";
import { Profile } from "@/pages/Profile";
import { Policy } from "@/pages/Policy";
import { CallPopup } from "@/components/ui/CallPopup";
import { useState, useEffect } from "react";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/room" component={Room} />
        <Route path="/room/:id" component={Room} />
        <Route path="/wallet" component={Wallet} />
        <Route path="/auth" component={UserAuth} />
        <Route path="/profile" component={Profile} />
        <Route path="/privacy" >{() => <Policy type="privacy" />}</Route>
        <Route path="/terms" >{() => <Policy type="terms" />}</Route>
        <Route path="/admin" component={AdminLogin} />
        <Route path="/admin/dashboard" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  const [incomingCall, setIncomingCall] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      const isAuthPage = location === '/auth' || location.startsWith('/admin');
      if (!location.startsWith('/room') && !isAuthPage) {
        setIncomingCall(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [location]);

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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;