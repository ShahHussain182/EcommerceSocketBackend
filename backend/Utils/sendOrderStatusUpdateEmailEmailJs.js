// backend/Utils/sendOrderStatusUpdateEmailEmailJs.js
import emailjs from '@emailjs/nodejs';

import dotenv from 'dotenv';

dotenv.config();

const EMAILJS_SERVICE_ID = process.env.SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.PRIVATE_KEY;
const APP_NAME = process.env.APP_NAME || 'UniqueGamer';

function escapeHtml(s='') {
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');
}

export async function sendOrderStatusUpdateEmailEmailJs({ to, order, meta = {} }) {
  const orderNumber = escapeHtml(String(order.orderNumber || order._id || ''));
  const newStatus = escapeHtml(String(order.status || 'Updated'));
  const updatedAt = escapeHtml(new Date(order.updatedAt || order.updatedAt || Date.now()).toLocaleString());
  const changedBy = escapeHtml(meta.changedBy || '');

  const itemsHtml = (order.items || []).map(it => {
    const name = escapeHtml(it.nameAtTime || it.name || '');
    const qty = escapeHtml(String(it.quantity || 1));
    const price = escapeHtml(String(it.priceAtTime || it.price || '0'));
    const variant = escapeHtml(`${it.sizeAtTime || it.size || ''}${it.colorAtTime ? ' / ' + it.colorAtTime : ''}`);
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${variant}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${price}</td>
    </tr>`;
  }).join('');

  const htmlContent = `<!doctype html><html lang="en"><head><meta charset="utf-8"/></head><body style="font-family:Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto; padding:20px; background:#f2f2f2;">
  <div style="background:linear-gradient(90deg,#4CAF50,#45a049); padding:20px; text-align:center;">
    <h1 style="color:#fff; margin:0;">${APP_NAME} — Order Update</h1>
  </div>
  <div style="background:#fff; padding:20px; border-radius:0 0 5px 5px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin-top:0;">Hello,</p>
    <p>Your order <strong>#${orderNumber}</strong> status has been updated to <strong>${newStatus}</strong>.</p>

    <h4 style="margin-top:10px;">Order details</h4>
    <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Item</th>
          <th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Variant</th>
          <th style="text-align:center; padding:8px; border-bottom:2px solid #ddd;">Qty</th>
          <th style="text-align:right; padding:8px; border-bottom:2px solid #ddd;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p style="font-weight:600; text-align:right; margin:0 0 12px 0;">Total: ${escapeHtml(String(order.totalAmount || '0'))}</p>

    <p>Changed by: ${changedBy || 'System'} • ${updatedAt}</p>

    <p>If you have any questions, reply to this email or visit our support page.</p>
    <p>Thanks,<br/>The ${APP_NAME} Team</p>
  </div>
  <div style="text-align:center; margin-top:20px; color:#888; font-size:0.8em;">
    <p>This is an automated message from ${APP_NAME}. Please do not reply directly to this email.</p>
  </div>
</body></html>`;

  try {
    const res = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        email: to,
        title: `Order #${orderNumber} — status updated to ${newStatus}`,
        message_html: htmlContent,
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY,
      }
    );
    console.log('Email sent successfully:', res);
    return res;
  } catch (err) {
    console.error('sendOrderStatusUpdateEmailEmailJs error:', err);
    throw err;
  }
}
