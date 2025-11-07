// src/routes/internal.js
import express from 'express';
import { notifyProduct } from '../Utils/socket.js';

const router = express.Router();
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-worker-secret-change-me';

router.post('/notify-product', express.json(), (req, res) => {
  const secret = req.header('x-worker-secret');
  if (!secret || secret !== WORKER_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { productId, status, imageIndex, rendition, error } = req.body;
  if (!productId || !status) {
    return res.status(400).json({ success: false, message: 'Missing productId or status' });
  }

  try {
    notifyProduct(String(productId), { status, productId: String(productId), imageIndex, rendition, error });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[internal.notify-product] failed', err);
    return res.status(500).json({ success: false, message: 'Notify failure' });
  }
});

export default router;
