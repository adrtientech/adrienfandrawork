import { google } from 'googleapis';
import http from 'http';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

const REDIRECT_URI = 'http://localhost:3001/oauth2callback';

async function main() {
  console.log('================================================================');
  console.log('🔑 GMAIL OAUTH2 REFRESH TOKEN GENERATOR');
  console.log('================================================================\n');

  let clientId = process.env.GMAIL_CLIENT_ID;
  let clientSecret = process.env.GMAIL_CLIENT_SECRET;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  if (!clientId || clientId.includes('your-client-id')) {
    clientId = await question('Masukkan GMAIL_CLIENT_ID Anda: ');
  }
  if (!clientSecret || clientSecret.includes('GOCSPX-')) {
    clientSecret = await question('Masukkan GMAIL_CLIENT_SECRET Anda: ');
  }

  if (!clientId || !clientSecret) {
    console.error('❌ Client ID dan Client Secret wajib diisi.');
    rl.close();
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId.trim(),
    clientSecret.trim(),
    REDIRECT_URI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Memaksa agar selalu mengembalikan refresh_token
  });

  console.log('\n----------------------------------------------------------------');
  console.log('LANGKAH 1: Buka tautan berikut di browser Anda:');
  console.log('----------------------------------------------------------------\n');
  console.log(authUrl);
  console.log('\n----------------------------------------------------------------');
  console.log('Menunggu otorisasi via callback (atau salin kode auth dari URL)...');

  // Siapkan server HTTP lokal sementara untuk menangkap kode otomatis
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url?.startsWith('/oauth2callback')) {
        const urlObj = new URL(req.url, 'http://localhost:3001');
        const code = urlObj.searchParams.get('code');

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Autentikasi Berhasil!</h1><p>Kembali ke terminal untuk melihat Refresh Token Anda.</p>');

          console.log('\n✓ Kode otorisasi berhasil diterima!');
          const { tokens } = await oAuth2Client.getToken(code);

          console.log('\n================================================================');
          console.log('🎉 REFRESH TOKEN GMAIL ANDA BERHASIL DIDAPATKAN:');
          console.log('================================================================\n');
          console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
          console.log('Silakan salin baris di atas ke file .env Anda!');
          console.log('================================================================\n');

          server.close();
          rl.close();
          process.exit(0);
        }
      }
    } catch (err: any) {
      console.error('❌ Gagal menukar token:', err.message);
      res.writeHead(500);
      res.end('Error');
      server.close();
      rl.close();
      process.exit(1);
    }
  });

  server.listen(3001, () => {
    console.log('Server callback listening di port 3001...\n');
  });

  // Alternatif jika redirect port 3001 terblokir, pengguna bisa input kode manual
  const manualCode = await question('Atau jika tidak redirect otomatis, paste kode "code=..." di sini: ');
  if (manualCode.trim()) {
    try {
      const { tokens } = await oAuth2Client.getToken(manualCode.trim());
      console.log('\n================================================================');
      console.log('🎉 REFRESH TOKEN GMAIL ANDA:');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('================================================================\n');
      server.close();
      rl.close();
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Gagal menukar token manual:', err.message);
      server.close();
      rl.close();
      process.exit(1);
    }
  }
}

main();
