import { useState, useEffect, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, UserCog, Gift, Wallet, Flag, Settings,
  LogOut, Menu, X, ChevronLeft, Bell, Shield, ShieldAlert, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminAuth } from "@/lib/adminApi";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ── Admin Auth Context ────────────────────────────────────
interface AdminData {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatar: string | null;
}

interface AdminCtx {
  admin: AdminData | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminCtx>({
  admin: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAdmin = () => useContext(AdminContext);

// ── Nav Sections (grouped) ────────────────────────────────
interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  path: string;
}

interface NavSection {
  sectionKey: string; // i18n key for section header
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    sectionKey: "admin.sections.main",
    items: [
      { icon: LayoutDashboard, labelKey: "admin.nav.dashboard", path: "/admin/dashboard" },
    ],
  },
  {
    sectionKey: "admin.sections.people",
    items: [
      { icon: Users,   labelKey: "admin.nav.users",  path: "/admin/users" },
      { icon: UserCog, labelKey: "admin.nav.agents", path: "/admin/agents" },
    ],
  },
  {
    sectionKey: "admin.sections.content",
    items: [
      { icon: MessageSquare, labelKey: "admin.nav.chatManagement", path: "/admin/chat-management" },
      { icon: Gift,          labelKey: "admin.nav.gifts",          path: "/admin/gifts" },
    ],
  },
  {
    sectionKey: "admin.sections.finance",
    items: [
      { icon: Wallet, labelKey: "admin.nav.finances", path: "/admin/finances" },
    ],
  },
  {
    sectionKey: "admin.sections.safety",
    items: [
      { icon: Flag,        labelKey: "admin.nav.reports", path: "/admin/reports" },
      { icon: ShieldAlert, labelKey: "admin.nav.fraud",   path: "/admin/fraud" },
    ],
  },
  {
    sectionKey: "admin.sections.system",
    items: [
      { icon: Settings, labelKey: "admin.nav.settings", path: "/admin/settings" },
    ],
  },
];

// Flat list for top-bar title lookup
const allNavItems = navSections.flatMap(s => s.items);

// ── Admin Layout Provider ─────────────────────────────────
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    adminAuth.me()
      .then((res) => {
        if (res.success && res.data) setAdmin(res.data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await adminAuth.login(username, password);
    if (res.success && res.data) {
      setAdmin(res.data as AdminData);
      setLocation("/admin/dashboard");
    }
  };

  const logout = async () => {
    await adminAuth.logout().catch(() => {});
    setAdmin(null);
    setLocation("/admin");
  };

  return (
    <AdminContext.Provider value={{ admin, isLoading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

// ── Admin Layout Shell ────────────────────────────────────
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { admin, logout } = useAdmin();
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();

  return (
    <div className="min-h-screen bg-[#06060f] text-white flex" dir={dir}>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-[#0c0c1d] border-l border-white/5 h-screen sticky top-0 z-40">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-xl text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            A
          </div>
          <div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary" style={{ fontFamily: "Outfit" }}>
              Ablox
            </span>
            <span className="block text-[10px] font-bold text-white/30 -mt-1 tracking-wider">{t("admin.brand.subtitle")}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto no-scrollbar">
          {navSections.map((section, si) => (
            <div key={section.sectionKey} className={si > 0 ? "mt-4" : ""}>
              {/* Section header */}
              <p className="px-4 mb-1.5 text-[10px] font-bold text-white/25 uppercase tracking-widest select-none">
                {t(section.sectionKey)}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.path || (location.startsWith(item.path) && item.path !== "/admin/dashboard");
                  const isDash = item.path === "/admin/dashboard" && location === "/admin/dashboard";
                  const active = isActive || isDash;

                  return (
                    <Link key={item.path} href={item.path}>
                      <a className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-white/50 hover:text-white hover:bg-white/5",
                      )}>
                        {active && (
                          <motion.div
                            layoutId="admin-nav"
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-l-full"
                          />
                        )}
                        <item.icon className={cn("w-5 h-5 shrink-0", active && "text-primary")} />
                        <span className="font-bold text-sm">{t(item.labelKey)}</span>
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Language Switcher */}
        <div className="px-3 pb-2">
          <LanguageSwitcher />
        </div>

        {/* Admin Info */}
        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{admin?.displayName}</p>
              <p className="text-[10px] text-white/30 font-medium">{admin?.role === "super_admin" ? t("admin.role.superAdmin") : t("admin.role.moderator")}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all text-sm font-bold"
          >
            <LogOut className="w-4 h-4" />
            {t("common.logout")}
          </button>
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: 260 }}
              animate={{ x: 0 }}
              exit={{ x: 260 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-[260px] bg-[#0c0c1d] border-l border-white/5 z-50 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-sm text-white">A</div>
                  <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary" style={{ fontFamily: "Outfit" }}>{t("admin.brand.mobileName")}</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-white/5">
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              <nav className="flex-1 py-3 px-3 overflow-y-auto no-scrollbar">
                {navSections.map((section, si) => (
                  <div key={section.sectionKey} className={si > 0 ? "mt-4" : ""}>
                    <p className="px-4 mb-1.5 text-[10px] font-bold text-white/25 uppercase tracking-widest select-none">
                      {t(section.sectionKey)}
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = location === item.path || (location.startsWith(item.path) && item.path !== "/admin/dashboard") || (item.path === "/admin/dashboard" && location === "/admin/dashboard");
                        return (
                          <Link key={item.path} href={item.path}>
                            <a
                              onClick={() => setSidebarOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all",
                                active ? "bg-primary/15 text-primary" : "text-white/50 hover:text-white hover:bg-white/5",
                              )}
                            >
                              <item.icon className="w-5 h-5" />
                              <span className="font-bold text-sm">{t(item.labelKey)}</span>
                            </a>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="px-3 pb-2">
                <LanguageSwitcher />
              </div>
              <div className="border-t border-white/5 p-4">
                <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-all text-sm font-bold">
                  <LogOut className="w-4 h-4" />
                  {t("common.logout")}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#06060f]/80 backdrop-blur-xl border-b border-white/5 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5 text-white/70" />
            </button>
            <h2 className="text-lg font-bold text-white/80 hidden sm:block">
              {allNavItems.find((n) => location === n.path || (location.startsWith(n.path) && n.path !== "/admin/dashboard"))?.labelKey ? t(allNavItems.find((n) => location === n.path || (location.startsWith(n.path) && n.path !== "/admin/dashboard"))!.labelKey) : t("admin.nav.dashboard")}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2.5 rounded-xl hover:bg-white/5 transition-colors">
              <Bell className="w-5 h-5 text-white/50" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
