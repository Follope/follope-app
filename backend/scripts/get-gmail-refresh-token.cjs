#!/usr/bin/env node
/**
 * ⚡ Follope Gmail OAuth2 Refresh Token Generator
 * 
 * Run this script to generate your GMAIL_REFRESH_TOKEN for the Gmail HTTP REST API:
 * node scripts/get-gmail-refresh-token.cjs
 */

const http = require('http');
const url = require('url');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n======================================================');
  console.log('   📧 Follope Gmail HTTP OAuth2 Setup Wizard           ');
  console.log('======================================================\n');
  console.log('This wizard will generate your GMAIL_REFRESH_TOKEN so');
  console.log('Follope can send emails via Gmail HTTP (Port 443) on Render.\n');

  let clientId = process.env.GMAIL_CLIENT_ID || '';
  let clientSecret = process.env.GMAIL_CLIENT_SECRET || '';

  // Check if a client_secret json exists in Downloads or backend
  const downloadsDir = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');
  try {
    const files = fs.readdirSync(downloadsDir);
    const jsonFile = files.find((f) => f.startsWith('client_secret_') && f.endsWith('.json'));
    if (jsonFile && (!clientId || !clientSecret)) {
      const data = JSON.parse(fs.readFileSync(path.join(downloadsDir, jsonFile), 'utf8'));
      const webOrInstalled = data.web || data.installed;
      if (webOrInstalled) {
        clientId = webOrInstalled.client_id;
        clientSecret = webOrInstalled.client_secret;
        console.log(`💡 Found Google credentials from: ${jsonFile}\n`);
      }
    }
  } catch {}

  if (!clientId) {
    clientId = await question('Enter your Google OAuth Client ID: ');
  } else {
    const useFound = await question(`Use Client ID (${clientId.slice(0, 20)}...)? (Y/n): `);
    if (useFound.trim().toLowerCase() === 'n') {
      clientId = await question('Enter your Google OAuth Client ID: ');
    }
  }

  if (!clientSecret) {
    clientSecret = await question('Enter your Google OAuth Client Secret: ');
  }

  clientId = clientId.trim();
  clientSecret = clientSecret.trim();

  const redirectUri = 'http://localhost:8088/oauth2callback';
  const scope = 'https://www.googleapis.com/auth/gmail.send';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(
    scope
  )}&access_type=offline&prompt=consent`;

  console.log('\n------------------------------------------------------');
  console.log('👉 STEP 1: Add this Authorized Redirect URI to your Google Cloud Console:');
  console.log(`   ${redirectUri}`);
  console.log('------------------------------------------------------\n');
  console.log('👉 STEP 2: Open this URL in your browser to sign in with your Gmail:');
  console.log(`\n${authUrl}\n`);
  console.log('------------------------------------------------------');
  console.log('Waiting for authorization callback on http://localhost:8088/oauth2callback ...\n');

  const server = http.createServer(async (req, res) => {
    const reqUrl = url.parse(req.url, true);
    if (reqUrl.pathname === '/oauth2callback') {
      const code = reqUrl.query.code;
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization failed: No code received</h1>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #10B981;">✅ Authorization Successful!</h1>
          <p>You can close this tab and return to your terminal.</p>
        </div>
      `);

      server.close();

      try {
        console.log('⏳ Exchanging code for refresh token with Google...');
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        const tokens = await tokenRes.json();
        if (!tokens.refresh_token) {
          console.error('\n❌ Google did not return a refresh_token.');
          console.log('Response:', tokens);
          console.log('\nTip: Make sure you selected prompt=consent or revoked previous access at:');
          console.log('https://myaccount.google.com/permissions');
          process.exit(1);
        }

        console.log('\n======================================================');
        console.log('   🎉 SUCCESS! Here are your Gmail HTTP credentials:  ');
        console.log('======================================================\n');
        console.log(`GMAIL_CLIENT_ID=${clientId}`);
        console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('GMAIL_USER=follope.official@gmail.com');
        console.log('\n👉 Copy and paste these into your Render Environment Variables!');
        console.log('======================================================\n');
        process.exit(0);
      } catch (err) {
        console.error('Error exchanging token:', err);
        process.exit(1);
      }
    }
  });

  server.listen(8088);
}

main().catch(console.error);
