import emailjs from '@emailjs/nodejs';
import dotenv from 'dotenv';    
import { VERIFICATION_EMAIL_TEMPLATE, WELCOME_EMAIL_TEMPLATE,PASSWORD_RESET_REQUEST_TEMPLATE,PASSWORD_RESET_SUCCESS_TEMPLATE } from '../mailtrap/emailTemplates.js';
dotenv.config();
const EMAILJS_SERVICE_ID = process.env.SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.PRIVATE_KEY;
console.log(process.env)

export const sendVerificationEmailEmailJs = async (to, verificationCode) => {
const htmlContent = VERIFICATION_EMAIL_TEMPLATE.replace('{verificationCode}', verificationCode);
try {
    const response = await emailjs.send(
    EMAILJS_SERVICE_ID,
     EMAILJS_TEMPLATE_ID,
      {
        title:"Verify your email",
        email: to,
        message_html: htmlContent,
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY,
      }
    );
    console.log('Email sent successfully:', response);
    return response;

}
catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}
export const sendWelcomeEmailEmailJs = async (to, name) => {
  const htmlContent = WELCOME_EMAIL_TEMPLATE
  .replace(/{appName}/g, 'UniqueGamer')
  .replace(/{userName}/g, name)
  .replace(/{userEmail}/g, to)
  .replace(/{loginUrl}/g, 'https://app.acme.com/login')
  .replace(/{supportUrl}/g, 'https://acme.com/support');
    try {
        const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
         EMAILJS_TEMPLATE_ID,
          {
            title:`Welcome to the UniqueGamer, ${name}!`,
            email: to,
            message_html: htmlContent,
          },
          {
            publicKey: EMAILJS_PUBLIC_KEY,
            privateKey: EMAILJS_PRIVATE_KEY,
          }
        );
        console.log('Email sent successfully:', response);
        return response;
    
    }
    catch (error) {
        console.error('Failed to send email:', error);
        throw error;
      }
    }
export const sendNewsletterWelcomeEmailEmailJs = async (to) => {
  const htmlContent = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2 style="color: #4F46E5;">Welcome to the UniqueGamer Newsletter!</h2>
    <p>Thanks for subscribing! You’ll now receive updates about our latest releases, offers, and news — directly in your inbox.</p>
    <p>If you didn’t subscribe, you can safely ignore this email.</p>
    <br/>
    <p>— The UniqueGamer Team</p>
  </div>
`;

        try {
            const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
             EMAILJS_TEMPLATE_ID,
              {
                title:`Welcome to the UniqueGamer Newsletter!`,
                email: to,
                message_html: htmlContent,
              },
              {
                publicKey: EMAILJS_PUBLIC_KEY,
                privateKey: EMAILJS_PRIVATE_KEY,
              }
            );
            console.log('Email sent successfully:', response);
            return response;
        
        }
        catch (error) {
            console.error('Failed to send email:', error);
            throw error;
          }
        }
export const sendPasswordResetRequestEmailEmailJs = async (to, resetLink) => {
      const htmlContent = PASSWORD_RESET_REQUEST_TEMPLATE.replace('{resetURL}', resetLink);
        try {
            const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
             EMAILJS_TEMPLATE_ID,
              {
                title:`Reset Your Password`,
                email: to,
                message_html: htmlContent,
              },
              {
                publicKey: EMAILJS_PUBLIC_KEY,
                privateKey: EMAILJS_PRIVATE_KEY,
              }
            );
            console.log('Email sent successfully:', response);
            return response;
        
        }
        catch (error) {
            console.error('Failed to send email:', error);
            throw error;
          }
        }
export const sendPasswordResetSuccessEmailEmailJs = async (to, userName) => {
          const htmlContent = PASSWORD_RESET_SUCCESS_TEMPLATE .replace(/{userName}/g, userName)
          .replace(/{appName}/g, 'UniqueGamer')
          .replace(/{supportUrl}/g, 'https://acmeapp.com/support');
            try {
                const response = await emailjs.send(
                EMAILJS_SERVICE_ID,
                 EMAILJS_TEMPLATE_ID,
                  {
                    title:`Password Reset Successful`,
                    email: to,
                    message_html: htmlContent,
                  },
                  {
                    publicKey: EMAILJS_PUBLIC_KEY,
                    privateKey: EMAILJS_PRIVATE_KEY,
                  }
                );
                console.log('Email sent successfully:', response);
                return response;
            
            }
            catch (error) {
                console.error('Failed to send email:', error);
                throw error;
              }
            }        
    