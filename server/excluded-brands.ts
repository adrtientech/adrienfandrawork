import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseServer, isServerSupabaseConfigured } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXCLUDED_FILE_PATH = path.resolve(__dirname, 'data/excluded-brands.json');

export interface ExcludedBrand {
  id: string;
  name: string;
  domain?: string;
  reason: string;
  addedAt: string;
}

export function getExcludedBrands(): ExcludedBrand[] {
  try {
    if (fs.existsSync(EXCLUDED_FILE_PATH)) {
      const data = fs.readFileSync(EXCLUDED_FILE_PATH, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.warn('[ExcludedBrands] Gagal membaca excluded-brands.json:', err);
  }
  return [];
}

export function saveExcludedBrands(list: ExcludedBrand[]): void {
  try {
    const dir = path.dirname(EXCLUDED_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EXCLUDED_FILE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ExcludedBrands] Gagal menyimpan excluded-brands.json:', err);
  }
}

export async function addExcludedBrand(name: string, domain?: string, reason?: string): Promise<ExcludedBrand> {
  const current = getExcludedBrands();
  const cleanName = name.trim();
  const cleanDomain = domain ? domain.toLowerCase().trim() : '';
  
  // Cek duplikat
  const existing = current.find(
    (b) => b.name.toLowerCase() === cleanName.toLowerCase() || (cleanDomain && b.domain?.toLowerCase() === cleanDomain)
  );
  if (existing) return existing;

  const newItem: ExcludedBrand = {
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    domain: cleanDomain || undefined,
    reason: reason || 'Dikecualikan atas instruksi Adrien Fandra',
    addedAt: new Date().toISOString(),
  };

  const updated = [newItem, ...current];
  saveExcludedBrands(updated);

  // Jika brand ini sudah ada di Supabase CRM, otomatis ubah statusnya menjadi 'skipped'
  if (isServerSupabaseConfigured()) {
    try {
      await supabaseServer
        .from('brands')
        .update({
          pipeline_status: 'skipped',
          ai_fit_reason: `Dikecualikan oleh Adrien: ${newItem.reason}`,
        })
        .or(`company_name.ilike.%${cleanName}%,domain.ilike.%${cleanDomain || cleanName}%`);
    } catch (err) {
      console.warn('[ExcludedBrands] Gagal auto-skip di Supabase:', err);
    }
  }

  return newItem;
}

export function removeExcludedBrand(id: string): boolean {
  const current = getExcludedBrands();
  const filtered = current.filter((b) => b.id !== id && b.name.toLowerCase() !== id.toLowerCase());
  if (filtered.length !== current.length) {
    saveExcludedBrands(filtered);
    return true;
  }
  return false;
}

export function isBrandExcluded(nameOrDomain: string): boolean {
  if (!nameOrDomain) return false;
  const target = nameOrDomain.toLowerCase().trim();
  const list = getExcludedBrands();
  return list.some((b) => {
    const nameMatch = b.name.toLowerCase() === target || target.includes(b.name.toLowerCase());
    const domainMatch = b.domain && (b.domain.toLowerCase() === target || target.includes(b.domain.toLowerCase()));
    return nameMatch || domainMatch;
  });
}
