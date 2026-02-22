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
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  const [incomingCall, setIncomingCall] = useState(false);
  const [location, setLocation] = useLocation();

  // Simulate an incoming call after 10 seconds for the demo
  useEffect(() => {
    const timer = setTimeout(() => {
      // Don't show popup if already in a room
      if (!location.startsWith('/room')) {
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
          onAccept={() => {
            setIncomingCall(false);
            setLocation('/room/random');
          }} 
          onDecline={() => setIncomingCall(false)} 
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;