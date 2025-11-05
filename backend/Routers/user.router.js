import express from "express";
import { sendNewsletterWelcomeEmailEmailJs } from "../Utils/emailjsClient.js";
import {saveToMailingList} from "../Utils/saveToMailingList.js";
import { ContactMessage } from "../Models/ContactMessage.model.js";
import { sendContactToAdminEmail } from "../Utils/sendContactToAdminEmail.js";
import {z} from "zod";
const userRouter = express.Router();
const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(5),
  message: z.string().min(10),
});

userRouter.post("/subscribe-newsletter", async (req, res) => {
    // Logic for subscribing to newsletter
    const { email } = req.body;
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json(  {success: false,message: "Invalid email address"  });
  }
  try {
    await sendNewsletterWelcomeEmailEmailJs(email);
  await saveToMailingList(email);

  return res.status(200).json({  success: true,message: "Subscribed to newsletter successfully" });
} catch (err) {
  console.error('Newsletter send failed:', err);
  return res.status(500).json(  {success: false,message: "Failed to subscribe to newsletter"  });
}
});
userRouter.post("/contact-us", async (req, res) => {
  try {
    // Logic for contact us form submission
    const payload = contactSchema.parse(req.body);

    // record request metadata if available
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.get('User-Agent') || null;
    const saved = await ContactMessage.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      subject: payload.subject,
      message: payload.message,
      ip,
      userAgent,
    });
    try {
      await sendContactToAdminEmail({
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
      });
    } catch (mailErr) {
      // Log error but don't fail the whole request
      console.error('Failed to send contact email to admin:', mailErr);
    }
    return res.status(201).json({ success: true, message: 'Message received. We will get back to you shortly.' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Invalid input', errors: err.errors });
    }
    console.error('Contact route error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});
export default userRouter;