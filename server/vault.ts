import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_FILE_PATH = path.resolve(__dirname, 'data/vault-documents.json');

export interface VaultDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  category: 'rate_card' | 'case_study' | 'contract' | 'custom';
  triggerContext: 'rate_request' | 'proof_request' | 'contract_deal' | 'custom';
  contextRule: string;
  isColdEmailAllowed: boolean;
  uploadedAt: string;
  url: string;
}

export function getVaultDocuments(): VaultDocument[] {
  try {
    if (fs.existsSync(VAULT_FILE_PATH)) {
      const data = fs.readFileSync(VAULT_FILE_PATH, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.warn('[Vault] Gagal membaca vault-documents.json:', err);
  }
  return [];
}

export function saveVaultDocuments(list: VaultDocument[]): void {
  try {
    const dir = path.dirname(VAULT_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VAULT_FILE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Vault] Gagal menyimpan vault-documents.json:', err);
  }
}

export function addVaultDocument(doc: Omit<VaultDocument, 'id' | 'uploadedAt'>): VaultDocument {
  const current = getVaultDocuments();
  const newDoc: VaultDocument = {
    ...doc,
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    uploadedAt: new Date().toISOString(),
  };
  saveVaultDocuments([newDoc, ...current]);
  return newDoc;
}

export function removeVaultDocument(id: string): boolean {
  const current = getVaultDocuments();
  const filtered = current.filter((d) => d.id !== id);
  if (filtered.length !== current.length) {
    saveVaultDocuments(filtered);
    return true;
  }
  return false;
}

/**
 * Mencari dokumen yang relevan sesuai konteks percakapan brand (HANYA jika tepat waktu/diminta)
 * ATURAN BAKU: Cold outreach SELALU return null (0 attachment)
 */
export function findDocumentForContext(context: 'cold_outreach' | 'rate_request' | 'proof_request' | 'contract_deal'): VaultDocument | null {
  if (context === 'cold_outreach') {
    // 0 Attachment di email dingin pertama
    return null;
  }
  const allDocs = getVaultDocuments();
  return allDocs.find((d) => d.triggerContext === context) || null;
}
