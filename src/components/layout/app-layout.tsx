import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, MobileHeader, MobileBottomNav } from './sidebar';

export const AppLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar (hidden on mobile, sticky on desktop) */}
      <Sidebar />

      {/* Mobile Top Header (sticky on phone) */}
      <MobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <Sidebar
          isMobileDrawer
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden min-w-0 bg-background/50 pt-14 md:pt-0 pb-14 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />
    </div>
  );
};
