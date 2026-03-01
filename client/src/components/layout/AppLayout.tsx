import { Link, useLocation } from "wouter";
import { Home, Wallet, Radio, User, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();

  // Pages without navigation (full-screen experiences)
  const noNavPages = ["/admin", "/auth", "/room"];
  if (noNavPages.some(page => location.startsWith(page))) {
    return <div className="min-h-screen bg-black" dir={dir}>{children}</div>;
  }

  const navItems = [
    { icon: Home, label: t("nav.home"), path: "/" },
    { icon: Radio, label: t("nav.liveStream"), path: "/live" },
    { icon: MessageCircle, label: t("nav.social"), path: "/friends" },
    { icon: Wallet, label: t("nav.wallet"), path: "/wallet" },
    { icon: User, label: t("nav.profile"), path: "/profile" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row pb-20 md:pb-0 font-sans" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-e border-white/10 h-screen sticky top-0 z-40 p-4">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-xl neon-border text-white">A</div>
          <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary" style={{fontFamily: 'Outfit'}}>Aplo</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path || (location.startsWith(item.path) && item.path !== '/' && item.path !== '/room');
            const isRoomActive = item.path === '/live' && (location.startsWith('/live') || location.startsWith('/room'));
            const actuallyActive = isActive || isRoomActive;

            return (
              <Link key={item.path} href={item.path}>
                <a className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  actuallyActive 
                    ? "bg-primary/20 text-primary neon-border" 
                    : "hover:bg-white/5 text-muted-foreground hover:text-white"
                )}>
                  <item.icon className={cn("w-5 h-5", actuallyActive && "animate-pulse")} />
                  <span className="font-bold text-lg">{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <div className="mt-auto pt-4 border-t border-white/10">
          <LanguageSwitcher />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-2 overflow-y-auto">
        <div className="md:hidden flex justify-between items-center mb-1">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-xl neon-border text-white" aria-label="Aplo">A</div>
           <div className="flex items-center gap-2">
             <LanguageSwitcher />
             <Link href="/auth"><button className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold border border-primary/20" aria-label={t("common.login")}>{t("common.login")}</button></Link>
           </div>
        </div>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 z-50 px-6 py-3 flex justify-between items-center safe-area-bottom">
        {navItems.map((item) => {
          const isActive = location === item.path || (location.startsWith(item.path) && item.path !== '/' && item.path !== '/live');
          const isRoomActive = item.path === '/live' && (location.startsWith('/live') || location.startsWith('/room'));
          const actuallyActive = isActive || isRoomActive;

          return (
            <Link key={item.path} href={item.path}>
              <a className="flex flex-col items-center gap-1 relative">
                {actuallyActive && (
                  <motion.div 
                    layoutId="mobile-nav-indicator"
                    className="absolute -top-3 w-12 h-1 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]"
                  />
                )}
                <item.icon className={cn("w-6 h-6 transition-all duration-300", actuallyActive ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-xs font-bold transition-all duration-300", actuallyActive ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </a>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}