import { NewsletterSubscriber } from '../Models/NewsletterSubscriber.js';

export async function saveToMailingList(email) {
    await NewsletterSubscriber.updateOne(
      { email },
      { $setOnInsert: { email } },
      { upsert: true }
    );
  }