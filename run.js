// testNotify.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.INTERNAL_API_URL || 'https://ecommercesocketbackend.onrender.com';
const WORKER_SECRET = process.env.WORKER_SECRET || 'super-long-secret-string-please-change';

const internalApi = axios.create({
  baseURL: API_URL,
  timeout: 5000,
  headers: {
    'x-worker-secret': WORKER_SECRET,
    'Content-Type': 'application/json'
  }
});

(async function test() {
  try {
    console.log('Posting to', API_URL);
    const resp = await internalApi.post('/internal/notify-product', {
      productId: '6901b75f40aba8140b3f426b',
      status: 'completed',
      imageIndex: 0
    });
    console.log('resp status', resp.status, resp.data);
  } catch (err) {
    if (err.response) {
      console.error('err.response.status', err.response.status, err.response.data);
    } else if (err.request) {
      console.error('no response, request made:', err.message);
    } else {
      console.error('err', err.message);
    }
  }
})();
