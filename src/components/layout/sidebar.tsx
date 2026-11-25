import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Compass,
  Layers,
  Inbox,
  Sliders,
  Bot,
  Sun,
  Moon,
  Users,
  FolderArchive,
  MessagesSquare,
  Menu,
  X
} from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const navItems = [
  {
    label: 'AI Manager',
    to: '/',
    icon: Compass,
    exact: true,
  },
  {
    label: 'Ruang Rapat Tim',
    to: '/boardroom',
    icon: MessagesSquare,
  },
  {
    label: 'Struktur Tim AI',
    to: '/team',
    icon: Users,
  },
  {
    label: 'Brand Pipeline',
    to: '/pipeline',
    icon: Layers,
  },
  {
    label: 'Action Queue',
    to: '/queue',
    icon: Inbox,
    badgeKey: 'actionRequired',
  },
  {
    label: 'Asset Vault & PDF',
    to: '/vault',
    icon: FolderArchive,
  },
  {
    label: 'AI Brain & Controls',
    to: '/settings',
    icon: Sliders,
  },
];

interface SidebarProps {
  isMobileDrawer?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileDrawer, onClose }) => {
  const { settings, totalActionRequired } = useCrm();
  const [isDark, setIsDark] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    // Default to clean white/light mode
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    setIsDark(false);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    if (isMobileDrawer && onClose) {
      onClose();
    }
  }, [location.pathname]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      setIsDark(true);
    }
  };

  const content = (
    <div className="flex flex-col justify-between h-full select-none">
      {/* Brand & App Title */}
      <div>
        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h1 className="font-semibold text-[13px] tracking-tight leading-tight flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                  Outbound AI
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    CRM
                  </span>
                </h1>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">
                  Head of Outbound Manager
                </p>
              </div>
            </div>

            {isMobileDrawer && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Engine Status Indicator */}
          <div className="mt-3 pt-2.5 border-t border-zinc-200/50 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "relative flex h-2 w-2 rounded-full",
                  settings.is_global_paused ? "bg-amber-500" : "bg-emerald-500"
                )}
              >
                {!settings.is_global_paused && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                )}
              </span>
              <span className="text-zinc-600 dark:text-zinc-300 text-[11px] font-medium">
                {settings.is_global_paused ? 'Engine Dijeda' : 'Engine Aktif'}
              </span>
            </div>
            <span className="text-[10.5px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
              {settings.emails_sent_today}/{settings.daily_email_limit}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-2.5 space-y-0.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 py-1.5">
            Menu Utama
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const badgeCount = item.badgeKey === 'actionRequired' && totalActionRequired > 0 ? totalActionRequired : null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (isMobileDrawer && onClose) onClose();
                }}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between px-2.5 py-2 rounded-md text-[12.5px] font-medium transition-all duration-150 ease-out group craft-button",
                    isActive
                      ? "bg-zinc-950 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 active:bg-zinc-200/70"
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <span>{item.label}</span>
                </div>

                {badgeCount !== null && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-semibold tabular-nums rounded-full",
                      "bg-rose-500 text-white"
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Utilities */}
      <div className="p-3 border-t border-zinc-200/60 dark:border-zinc-800 space-y-2 bg-white/50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between px-1.5 py-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center text-[10px] font-bold">
              AF
            </div>
            <div className="overflow-hidden">
              <p className="text-[11.5px] font-medium leading-tight truncate text-zinc-900 dark:text-zinc-100">
                {settings.sender_name}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                {settings.sender_email}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-7 text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 w-full justify-start px-2 gap-1.5 craft-button"
            title="Ganti Tema"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  // If used as Mobile Drawer
  if (isMobileDrawer) {
    return (
      <div className="fixed inset-0 z-50 md:hidden flex">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />
        {/* Drawer Panel */}
        <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 z-50 shadow-2xl animate-in slide-in-from-left duration-200 flex flex-col h-full">
          {content}
        </aside>
      </div>
    );
  }

  // Desktop Sidebar
  return (
    <aside className="hidden md:flex w-60 shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950 flex-col justify-between h-screen sticky top-0">
      {content}
    </aside>
  );
};

/**
 * Mobile Top Header (Sticky Topbar on small screens)
 */
export const MobileHeader: React.FC<{ onOpenMenu: () => void }> = ({ onOpenMenu }) => {
  const { settings, totalActionRequired } = useCrm();

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 z-40 flex items-center justify-between px-3.5 md:hidden">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-zinc-950 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 shadow-xs">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs tracking-tight text-zinc-900 dark:text-zinc-100">
            Outbound AI
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            CRM
          </span>
        </div>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full ml-1",
            settings.is_global_paused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
          )}
          title={settings.is_global_paused ? "Engine Dijeda" : "Engine Aktif"}
        />
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMenu}
          className="h-8 w-8 text-zinc-700 dark:text-zinc-300 relative"
          aria-label="Buka Menu"
        >
          <Menu className="h-5 w-5" />
          {totalActionRequired > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
          )}
        </Button>
      </div>
    </header>
  );
};

/**
 * Mobile Bottom Navigation Bar (Fixed thumb-friendly bottom bar)
 */
export const MobileBottomNav: React.FC<{ onOpenMenu: () => void }> = ({ onOpenMenu }) => {
  const { totalActionRequired } = useCrm();

  const primaryItems = [
    { label: 'Manager', to: '/', icon: Compass, exact: true },
    { label: 'Rapat', to: '/boardroom', icon: MessagesSquare },
    { label: 'Pipeline', to: '/pipeline', icon: Layers },
    {
      label: 'Antrean',
      to: '/queue',
      icon: Inbox,
      badge: totalActionRequired > 0 ? totalActionRequired : null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800 z-40 flex items-center justify-around px-1 md:hidden select-none pb-safe">
      {primaryItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors relative",
                isActive
                  ? "text-zinc-950 dark:text-white font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900"
              )
            }
          >
            <div className="relative">
              <Icon className="h-4 w-4" />
              {item.badge !== null && item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 px-1 text-[9px] font-bold rounded-full bg-rose-500 text-white min-w-3.5 h-3.5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="mt-0.5 leading-none">{item.label}</span>
          </NavLink>
        );
      })}

      {/* Menu / Drawer Toggle */}
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900"
      >
        <Menu className="h-4 w-4" />
        <span className="mt-0.5 leading-none">Menu</span>
      </button>
    </nav>
  );
};
