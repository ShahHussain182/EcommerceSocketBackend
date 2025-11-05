// utils/sendOrderConfirmationEmailEmailJs.js
import emailjs from '@emailjs/nodejs';
import dotenv from 'dotenv';
dotenv.config();

const EMAILJS_SERVICE_ID = process.env.SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.PRIVATE_KEY;
const APP_NAME = process.env.APP_NAME || 'UniqueGamer';

/**
 * Minimal escape helper
 */
function escapeHtml(input = '') {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Compose order details html (items snapshot must be passed in messagePayload)
 * @param {object} params
 * @returns {Promise<any>}
 */
export async function sendOrderConfirmationEmailEmailJs({ to, order }) {
  // order should contain: orderNumber, items (array), totalAmount, shippingAddress, createdAt
  const orderNumber = escapeHtml(String(order.orderNumber || order._id || ''));
  const total = escapeHtml(String(order.totalAmount ?? ''));
  const createdAt = escapeHtml(new Date(order.createdAt || Date.now()).toLocaleString());

  // Render items as table rows
  const itemsHtml = (order.items || []).map((it) => {
    const name = escapeHtml(it.nameAtTime || it.name || '');
    const qty = escapeHtml(String(it.quantity || 0));
    const price = escapeHtml(String(it.priceAtTime || it.price || '0'));
    const size = escapeHtml(it.sizeAtTime || it.size || '');
    const color = escapeHtml(it.colorAtTime || it.color || '');
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${size} / ${color}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${price}</td>
    </tr>`;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto; padding:20px; background-color:#f2f2f2;">
  <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding:20px; text-align:center;">
    <h1 style="color:white; margin:0;">${APP_NAME} — Order Confirmation</h1>
  </div>

  <div style="background:#fff; padding:20px; border-radius:0 0 5px 5px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin-top:0;">Hi,</p>
    <p>Thanks for your order! We’ve received it and are processing it now.</p>

    <h3 style="margin-top:16px;">Order #${orderNumber}</h3>
    <p style="margin:6px 0 12px 0;color:#666;">Placed: ${createdAt}</p>

    <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
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

    <p style="font-weight:600; text-align:right; margin:0 0 12px 0;">Total: ${total}</p>

    <h4>Shipping Address</h4>
    <p style="margin:6px 0 12px 0;">${escapeHtml(order.shippingAddress?.line1 || '')}<br/>
      ${escapeHtml(order.shippingAddress?.city || '')} ${escapeHtml(order.shippingAddress?.postalCode || '')}<br/>
      ${escapeHtml(order.shippingAddress?.country || '')}
    </p>

    <p>If you have any questions about your order, reply to this email and we’ll help.</p>
    <p>Thanks —<br/>The ${APP_NAME} Team</p>
  </div>

  <div style="text-align:center; margin-top:20px; color:#888; font-size:0.9em;">
    <p>This is an automated email. Please do not reply unless you have questions about your order.</p>
  </div>
</body>
</html>`;

  try {
    const res = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        email: to,
        title: `Order Confirmation - #${orderNumber}`,
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
    console.error('sendOrderConfirmationEmailEmailJs error:', err);
    throw err;
  }
}
