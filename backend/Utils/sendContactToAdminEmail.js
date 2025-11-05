// utils/sendContactToAdminEmail.js
import emailjs from '@emailjs/nodejs';
import dotenv from 'dotenv';
dotenv.config();

const EMAILJS_SERVICE_ID = process.env.SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.PRIVATE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "muhammadhussnainasghar866@gmail.com"; // destination admin email
const APP_NAME = 'UniqueGamer';
function escapeHtml(input = '') {
    return String(input)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
/**
 * Send contact message email to admin
 * @param {{ name: string, email: string, subject: string, message: string }} opts
 */
export const sendContactToAdminEmail = async ({ name, email, subject, message }) => {

      // make safe text
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const messageHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${APP_NAME} — New Contact Message</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto; padding:20px; background-color:#f2f2f2;">
    <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding:20px; text-align:center;">
      <h1 style="color:white; margin:0;">New Contact Message — ${APP_NAME}</h1>
    </div>
  
    <div style="background-color:#fff; padding:25px; border-radius:0 0 5px 5px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
      <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
      <p style="white-space:pre-wrap;">${safeMessage}</p>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
      <p style="font-size:12px; color:#666;">Received: ${new Date().toLocaleString()}</p>
    </div>
  
    <div style="text-align:center; margin-top:20px; color:#888; font-size:0.8em;">
      <p>This message was sent from the contact form on ${APP_NAME}.</p>
    </div>
  </body>
  </html>
  `;
  


  try {
    const res = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        email:ADMIN_EMAIL,
        title: `New Contact Message — ${APP_NAME}`,
        
        message_html: messageHtml,
        
       
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY,
      }
    );
    console.log('Email sent successfully:', res);
    return res;
  } catch (err) {
    console.error('sendContactToAdminEmail error:', err);
    throw err;
  }
}
