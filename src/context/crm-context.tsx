import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Brand, AppSettings } from '@/types/brand';
import { BrandService } from '@/lib/brand-service';
import { initialMockSettings } from '@/data/mock-settings';
import { toast } from 'sonner';

interface CrmContextType {
  brands: Brand[];
  settings: AppSettings;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  updateBrand: (id: string, updates: Partial<Brand>) => Promise<Brand>;
  addBrand: (payload: Omit<Brand, 'id' | 'created_at' | 'updated_at'>) => Promise<Brand>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  toggleGlobalPause: () => Promise<boolean>;
  triggerAiDiscovery: () => Promise<void>;
  triggerInboxCheck: () => Promise<{ newCount: number; message: string }>;
  resetAllData: () => Promise<void>;

  // Derived state for Action Queue
  replyQueue: Brand[];
  manualPhoneQueue: Brand[];
  fallbackDmQueue: Brand[];
  totalActionRequired: number;

  // Derived stats
  waitingCount: number;
  negotiationAndDealCount: number;
  totalDealValueUsd: number;
  fitRatioPercent: number;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [settings, setSettings] = useState<AppSettings>(initialMockSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load initial data
  const refreshData = useCallback(async () => {
    try {
      const [fetchedBrands, fetchedSettings] = await Promise.all([
        BrandService.fetchBrands(),
        BrandService.fetchSettings()
      ]);
      setBrands(fetchedBrands);
      setSettings(fetchedSettings);
    } catch (err) {
      console.error('Failed to load CRM data:', err);
      toast.error('Gagal memuat data CRM.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Update a brand
  const updateBrand = useCallback(async (id: string, updates: Partial<Brand>): Promise<Brand> => {
    try {
      const updated = await BrandService.updateBrand(id, updates);
      setBrands((prev) => prev.map((b) => (b.id === id ? updated : b)));
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui brand');
      throw err;
    }
  }, []);

  // Add a brand manually
  const addBrand = useCallback(async (payload: Omit<Brand, 'id' | 'created_at' | 'updated_at'>): Promise<Brand> => {
    try {
      const newBrand = await BrandService.createBrand(payload);
      setBrands((prev) => [newBrand, ...prev]);
      toast.success(`Brand "${newBrand.company_name}" berhasil ditambahkan ke pipeline!`);
      return newBrand;
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan brand');
      throw err;
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    try {
      const updated = await BrandService.updateSettings(updates);
      setSettings(updated);
      toast.success('Pengaturan CRM berhasil disimpan!');
      return updated;
    } catch (err: any) {
      toast.error('Gagal memperbarui pengaturan.');
      throw err;
    }
  }, []);

  // Toggle Global Engine Pause
  const toggleGlobalPause = useCallback(async (): Promise<boolean> => {
    const newState = !settings.is_global_paused;
    await updateSettings({ is_global_paused: newState });
    if (newState) {
      toast.warning('Engine Otomasi Dijeda (Paused). Pengiriman email & scrape dihentikan sementara.');
    } else {
      toast.success('Engine Otomasi Aktif! Sistem siap memproses antrean email.');
    }
    return newState;
  }, [settings.is_global_paused, updateSettings]);

  // AI Discovery (Real Agent with Simulation Fallback)
  const triggerAiDiscovery = useCallback(async (): Promise<void> => {
    try {
      const res = await BrandService.runAiDiscovery();
      await refreshData();
      toast.success(res.message);
    } catch (err: any) {
      toast.error('Gagal menjalankan riset AI.');
      throw err;
    }
  }, [refreshData]);

  // Inbox Check (Real Agent with Simulation Fallback)
  const triggerInboxCheck = useCallback(async (): Promise<{ newCount: number; message: string }> => {
    try {
      const res = await BrandService.runInboxSync();
      await refreshData();
      if (res.newCount > 0) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
      return res;
    } catch (err: any) {
      toast.error('Gagal memeriksa inbox.');
      throw err;
    }
  }, [refreshData]);

  // Reset Data to defaults
  const resetAllData = useCallback(async () => {
    await BrandService.resetToDefaults();
    await refreshData();
    toast.info('Data berhasil di-reset ke nilai default.');
  }, [refreshData]);

  // Derived collections for Action Queue
  const replyQueue = useMemo(
    () => brands.filter((b) => b.pipeline_status === 'in_progress'),
    [brands]
  );

  const manualPhoneQueue = useMemo(
    () => brands.filter((b) => b.pipeline_status === 'ready_manual'),
    [brands]
  );

  const fallbackDmQueue = useMemo(
    () => brands.filter((b) => b.pipeline_status === 'fallback_dm'),
    [brands]
  );

  const totalActionRequired = useMemo(
    () => replyQueue.length + manualPhoneQueue.length + fallbackDmQueue.length,
    [replyQueue.length, manualPhoneQueue.length, fallbackDmQueue.length]
  );

  // Derived statistics
  const waitingCount = useMemo(
    () => brands.filter((b) => ['cold_sent', 'followup_1', 'followup_2'].includes(b.pipeline_status)).length,
    [brands]
  );

  const negotiationAndDealCount = useMemo(
    () => brands.filter((b) => ['in_progress', 'deal'].includes(b.pipeline_status)).length,
    [brands]
  );

  const totalDealValueUsd = useMemo(
    () =>
      brands
        .filter((b) => ['in_progress', 'deal', 'completed'].includes(b.pipeline_status))
        .reduce((acc, curr) => acc + (curr.deal_value_usd || 0), 0),
    [brands]
  );

  const fitRatioPercent = useMemo(() => {
    if (brands.length === 0) return 0;
    const passed = brands.filter((b) => b.ai_fit_score >= settings.min_fit_score).length;
    return Math.round((passed / brands.length) * 100);
  }, [brands, settings.min_fit_score]);

  return (
    <CrmContext.Provider
      value={{
        brands,
        settings,
        isLoading,
        refreshData,
        updateBrand,
        addBrand,
        updateSettings,
        toggleGlobalPause,
        triggerAiDiscovery,
        triggerInboxCheck,
        resetAllData,
        replyQueue,
        manualPhoneQueue,
        fallbackDmQueue,
        totalActionRequired,
        waitingCount,
        negotiationAndDealCount,
        totalDealValueUsd,
        fitRatioPercent,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
};
