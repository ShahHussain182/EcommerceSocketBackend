 import {sendMail} from './backend/Utils/zohoMailClient.js'// <-- adjust path to where zohoMailClient actually lives

const appName = 'UniqueGamer';
const userName = 'Hasnain';
const userEmail = 'saifimalook42@gmail.com';
const loginUrl = 'https://uniquegamer.example.com/login';
const supportUrl = 'support@uniquegamer.dpdns.org';

(async () => {
  try {
    const html = `<!doctype html>
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f2f2f2;">
        <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to ${appName}!</h1>
        </div>

        <div style="background-color: #fff; padding: 25px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <p style="margin-top: 0;">Hi ${userName},</p>

          <p>We're excited to have you join the ${appName} community! You’ve successfully created your account and are ready to explore everything we have to offer.</p>

          <p>To help you get started, here are a few quick tips:</p>
          <ul style="padding-left: 20px; margin: 10px 0;">
            <li>Sign in using your email: <strong>${userEmail}</strong></li>
            <li>Customize your profile to make it yours</li>
            <li>Start exploring your dashboard</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: #4CAF50; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; display: inline-block;">
              Go to Dashboard
            </a>
          </div>

          <p>If you have any questions or need support, simply reply to this email or visit our <a href="${supportUrl}" style="color: #4CAF50; text-decoration: none;">Help Center</a>.</p>

          <p>We’re thrilled to have you with us.<br>— The ${appName} Team</p>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
          <p>This is an automated message from ${appName}. Please do not reply directly to this email.</p>
        </div>
      </body>
    </html>`;

    const result = await sendMail({
      to: userEmail,
      subject: 'Welcome to UniqueGamer App',
      html,
    });

    console.log('Mail sent:', result);
  }  catch (err) {
    // Better logging — prints Zoho's JSON body and headers
    console.error('Zoho sendMail failed. status:', err.response?.status);
    console.error('Zoho response.data:', JSON.stringify(err.response?.data, null, 2));
    console.error('Zoho response.headers:', err.response?.headers);
    throw err; // rethrow if you want to keep upstream behavior
  }
})();
