# Creator Outbound AI CRM

Platform otomatisasi outreach berbasis AI untuk kreator konten dan agensi. Dilengkapi dengan pipeline multi-agen untuk *Discovery*, *Enrichment*, *Verification*, *Outreach*, *Inbox Watcher*, dan *Follow-up*.

## ✨ Fitur Utama

- **Discovery Agent**: Menemukan calon brand sponsor potensial yang relevan dengan niche kreator.
- **Enrichment Agent**: Melengkapi data profil, kontak keputusan (decision makers), dan media sosial brand.
- **BounceShield & Verifier**: Verifikasi DNS MX record dan validitas email sebelum pengiriman.
- **Timezone-Aware Outreach**: Mengirimkan email penawaran terpersonalisasi pada slot waktu optimal sesuai zona waktu brand target.
- **Inbox Watcher**: Memantau balasan email masuk secara otomatis dan menyiapkan draf balasan beserta Media Kit PDF.
- **Follow-up Engine**: Follow-up terjadwal secara cerdas tanpa spamming.
- **Mission Control UI**: Dashboard modern berbasis React + Vite + Tailwind CSS untuk memantau performa outreach secara real-time.

## 🚀 Panduan Memulai

### 1. Prasyarat
- Node.js (v18+)
- npm atau pnpm

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (.env)
Salin `.env.example` ke `.env` lalu sesuaikan kredensial Anda:
```bash
cp .env.example .env
```
Variabel yang diperlukan antara lain:
- `SUPABASE_URL` & `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `SERPER_API_KEY`
- Kredensial Gmail OAuth2 (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, dll.)

### 4. Menjalankan Server Lokal
Jalankan frontend (Vite) dan backend server (Express) secara bersamaan:
```bash
npm run dev:all
```
- Frontend UI: `http://localhost:5173`
- Backend Server: `http://localhost:3001`

Atau jalankan secara terpisah:
```bash
# Menjalankan frontend saja
npm run dev

# Menjalankan backend server saja
npm run dev:server
```

### 5. Build untuk Produksi
```bash
npm run build
```

---
*Dibuat untuk otomatisasi Creator Outbound & Dealflow CRM.*
