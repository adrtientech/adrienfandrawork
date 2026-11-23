import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden min-w-0 bg-background/50">
        <Outlet />
      </main>
    </div>
  );
};
