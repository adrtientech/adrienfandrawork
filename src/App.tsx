import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CrmProvider } from '@/context/crm-context';
import { AppLayout } from '@/components/layout/app-layout';
import { MissionControlPage } from '@/pages/mission-control';
import { BoardroomPage } from '@/pages/boardroom';
import { TeamOrgChartPage } from '@/pages/team-org-chart';
import { PipelinePage } from '@/pages/pipeline';
import { ActionQueuePage } from '@/pages/action-queue';
import { AssetVaultPage } from '@/pages/asset-vault';
import { SettingsPage } from '@/pages/settings';
import { Toaster } from 'sonner';

export const App: React.FC = () => {
  return (
    <CrmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<MissionControlPage />} />
            <Route path="boardroom" element={<BoardroomPage />} />
            <Route path="team" element={<TeamOrgChartPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="queue" element={<ActionQueuePage />} />
            <Route path="vault" element={<AssetVaultPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </CrmProvider>
  );
};

export default App;
