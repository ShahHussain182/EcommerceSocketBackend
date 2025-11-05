// server/lib/zohoMailClient.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'https://accounts.zoho.com';
const FROM_ADDRESS = process.env.FROM_ADDRESS 

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.warn('ZohoMailClient: missing ZOHO_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN env vars');
}

// In-memory cache (replace with DB for multi-process)
let cachedAccessToken = null;
let accessTokenExpiry = 0;
let cachedAccountId = null;

// refresh access token using refresh_token
async function refreshAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < accessTokenExpiry - 60_000) return cachedAccessToken;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const tokenUrl = `${ACCOUNTS_HOST}/oauth/v2/token`;
  const res = await axios.post(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  const data = res.data;
  if (!data.access_token) throw new Error('Zoho token refresh failed: no access_token returned');

  cachedAccessToken = data.access_token;
  accessTokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedAccessToken;
}

// get accountId (cached)
async function getAccountId() {
  if (cachedAccountId) return cachedAccountId;
  const token = await refreshAccessToken();
  const r = await axios.get('https://mail.zoho.com/api/accounts', {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    timeout: 10000,
  });

  const body = r.data;
  // Typical shape: { data: [ { accountId: '...' } ] }
  if (body.data && Array.isArray(body.data) && body.data.length > 0) {
    cachedAccountId = body.data[0].accountId || body.data[0].id || body.data[0].account_id;
  } else if (body.accounts && Array.isArray(body.accounts) && body.accounts.length > 0) {
    cachedAccountId = body.accounts[0].accountId;
  } else {
    throw new Error('Unexpected accounts response: ' + JSON.stringify(body).slice(0, 300));
  }
  if (!cachedAccountId) throw new Error('accountId not found in Zoho response');
  return cachedAccountId;
}

// send email function you call from your signup/login logic
export async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error('sendMail: to is required');
  const token = await refreshAccessToken();
  const accountId = await getAccountId();
  const url = `https://mail.zoho.com/api/accounts/${accountId}/messages`;
  const payload = {
    fromAddress: FROM_ADDRESS,
    toAddress: to,
    subject,
    content: html || text || '',
  };

  const r = await axios.post(url, payload, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return r.data;
}


