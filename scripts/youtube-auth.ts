#!/usr/bin/env npx ts-node
// ═══════════════════════════════════════════════════════════════
// YouTube OAuth2 Setup — One-time script
// ═══════════════════════════════════════════════════════════════
// Run this ONCE to get a refresh token for the stibe YouTube account.
//
// Usage:
//   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy npx ts-node scripts/youtube-auth.ts
// ═══════════════════════════════════════════════════════════════

import { google } from 'googleapis';
import * as http from 'http';
import { execSync } from 'child_process';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables.');
  console.error('');
  console.error('Usage:');
  console.error('  YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy npx ts-node scripts/youtube-auth.ts');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent select_account',
  login_hint: 'stibelearningventures@gmail.com',
});

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  stibe — YouTube OAuth2 Setup');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Opening browser... if it does not open, paste this URL manually:');
console.log('');
console.log(`  ${authUrl}`);
console.log('');
console.log('Waiting for authorisation on port', PORT, '...');

// Start local server to capture the OAuth callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2>Error: ${error}</h2><p>Close this tab and check the terminal.</p>`);
    server.close();
    console.error('OAuth error:', error);
    process.exit(1);
  }

  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<p>Waiting...</p>');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h2>✅ Authorised! You can close this tab and go back to the terminal.</h2>');
  server.close();

  try {
    const { tokens } = await oauth2.getToken(code);

    console.log('');
    console.log('✅ Success! Add these to .env.local on the production server:');
    console.log('');
    console.log(`YOUTUBE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`YOUTUBE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('Error exchanging code for token:', err);
  }

  process.exit(0);
});

server.listen(PORT, () => {
  // Auto-open browser
  try { execSync(`open "${authUrl}"`); } catch { /* ignore */ }
});

