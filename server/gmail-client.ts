import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3001/oauth2callback'
  );

  oAuth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

export function isGmailConfigured(): boolean {
  return (
    !!process.env.GMAIL_CLIENT_ID &&
    !!process.env.GMAIL_CLIENT_SECRET &&
    !!process.env.GMAIL_REFRESH_TOKEN &&
    !process.env.GMAIL_CLIENT_ID.includes('your-client-id')
  );
}

/**
 * Menghasilkan PDF Media Kit 1-halaman valid (standar PDF 1.4) atau membaca dari file lokal
 * jika MEDIA_KIT_PDF_PATH tersedia, untuk dilampirkan otomatis pada Gmail Draft (Tahap B3).
 */
export function getOrGenerateMediaKitPdfBase64(creatorName = 'Adrien Fandra', mediaKitUrl = 'https://creatoroutbound.co/media-kit.pdf'): {
  filename: string;
  base64Data: string;
} {
  const customPath = process.env.MEDIA_KIT_PDF_PATH || './public/media-kit-adrien.pdf';
  const resolvedPath = path.resolve(process.cwd(), customPath);

  if (fs.existsSync(resolvedPath)) {
    try {
      const fileBuffer = fs.readFileSync(resolvedPath);
      return {
        filename: path.basename(resolvedPath),
        base64Data: fileBuffer.toString('base64'),
      };
    } catch (e) {
      console.warn('[Gmail Client] Gagal membaca file PDF lokal, menggunakan generator PDF Media Kit bawaan.');
    }
  }

  // Buat dokumen PDF 1.4 ringkas & valid berisi ringkasan Media Kit & Rate Card
  const streamText = [
    'BT',
    '/F1 18 Tf',
    '50 750 Td',
    `(${creatorName} - Official Creator Media Kit & Rate Card) Tj`,
    '/F1 11 Tf',
    '0 -30 Td',
    '(Audience: 180,000+ Indonesian Tech Enthusiasts, Gen-Z, Developers & Freelancers) Tj',
    '0 -22 Td',
    '(Primary Market: Indonesia & Southeast Asia | Engagement Rate: 6.8% Avg) Tj',
    '0 -32 Td',
    '(Sponsorship Tier Options:) Tj',
    '0 -20 Td',
    '(1. Starter Package: 1x Dedicated Short/Reels or 60s Integrated Segment) Tj',
    '0 -18 Td',
    '(2. Growth Bundle: 3x Cross-Platform Videos + Pinned Link in Bio for 30 Days) Tj',
    '0 -18 Td',
    '(3. Full Expansion Partnership: Dedicated YouTube Deep-Dive + 60-Day Whitelisting Ads) Tj',
    '0 -32 Td',
    `(Full Interactive Media Kit & Case Studies: ${mediaKitUrl}) Tj`,
    'ET',
  ].join('\n');

  const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${Buffer.byteLength(streamText, 'utf8')} >>
stream
${streamText}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000229 00000 n 
0000000297 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
${350 + Buffer.byteLength(streamText, 'utf8')}
%%EOF`;

  return {
    filename: `${creatorName.toLowerCase().replace(/\s+/g, '-')}-media-kit.pdf`,
    base64Data: Buffer.from(pdfContent, 'utf-8').toString('base64'),
  };
}

// Encode email in base64url standard for Gmail API (Supports optional PDF attachment for Stage B3 Drafts)
export function createRawEmail(params: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachmentPdf?: {
    filename: string;
    base64Data: string;
  };
}): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`;

  // Jika tidak ada lampiran (Tahap B1-B2 Cold Email & Tahap C1-C2 Follow-Up)
  if (!params.attachmentPdf) {
    const headers = [
      `To: ${params.to}`,
      `From: ${params.from}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
    ];

    if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
    if (params.references) headers.push(`References: ${params.references}`);

    const email = `${headers.join('\r\n')}\r\n\r\n${params.body}`;
    return Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Jika menggunakan lampiran PDF Media Kit (Tahap B3 Gmail Drafts)
  const boundary = `====_BOUNDARY_CREATOR_CRM_${Date.now()}_====`;
  const headers = [
    `To: ${params.to}`,
    `From: ${params.from}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);

  const mimeParts = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${params.attachmentPdf.filename}"`,
    `Content-Disposition: attachment; filename="${params.attachmentPdf.filename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    params.attachmentPdf.base64Data,
    '',
    `--${boundary}--`,
  ];

  return Buffer.from(mimeParts.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
