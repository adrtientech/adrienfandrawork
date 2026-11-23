import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  Layers,
  Inbox,
  Sliders,
  Bot,
  Sun,
  Moon,
  RotateCcw,
  Users,
  FolderArchive
} from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const Sidebar: React.FC = () => {
  const { settings, totalActionRequired, resetAllData } = useCrm();
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    // Default to clean white/light mode
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    setIsDark(false);
  }, []);

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

  const navItems = [
    {
      label: 'AI Manager',
      to: '/',
      icon: Compass,
      exact: true,
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
      badge: totalActionRequired > 0 ? totalActionRequired : null,
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

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200/80 bg-zinc-50/40 flex flex-col justify-between h-screen sticky top-0 select-none">
      {/* Brand & App Title */}
      <div>
        <div className="p-4 border-b border-zinc-200/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-950 flex items-center justify-center text-white shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h1 className="font-semibold text-[13px] tracking-tight leading-tight flex items-center gap-1.5 text-zinc-900">
                Outbound AI
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                  CRM
                </span>
              </h1>
              <p className="text-[11px] text-zinc-400 leading-none mt-0.5">
                Head of Outbound Manager
              </p>
            </div>
          </div>

          {/* Engine Status Indicator */}
          <div className="mt-3 pt-2.5 border-t border-zinc-200/50 flex items-center justify-between text-xs">
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
              <span className="text-zinc-600 text-[11px] font-medium">
                {settings.is_global_paused ? 'Engine Dijeda' : 'Engine Aktif'}
              </span>
            </div>
            <span className="text-[10.5px] font-mono tabular-nums text-zinc-400">
              {settings.emails_sent_today}/{settings.daily_email_limit}
            </span>
          </div>
        </div>

        {/* 4 Main Nav Items */}
        <nav className="p-2.5 space-y-0.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 px-3 py-1.5">
            Menu Utama
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between px-2.5 py-2 rounded-md text-[12.5px] font-medium transition-all duration-150 ease-out group craft-button",
                    isActive
                      ? "bg-zinc-950 text-white shadow-xs shadow-zinc-950/10"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50 active:bg-zinc-200/70"
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-semibold tabular-nums rounded-full",
                      "bg-zinc-900 text-white border border-zinc-700"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Utilities */}
      <div className="p-3 border-t border-zinc-200/60 space-y-2 bg-white/50">
        <div className="flex items-center justify-between px-1.5 py-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold">
              AF
            </div>
            <div className="overflow-hidden">
              <p className="text-[11.5px] font-medium leading-tight truncate text-zinc-900">
                {settings.sender_name}
              </p>
              <p className="text-[10px] text-zinc-400 truncate">
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
            className="h-7 text-[11px] text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 w-full justify-start px-2 gap-1.5 craft-button"
            title="Ganti Tema"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};
