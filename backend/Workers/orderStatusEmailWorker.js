// backend/Workers/orderStatusEmailWorker.js

import dotenv from 'dotenv';
dotenv.config();

import { getChannel } from '../Utils/lavinmqClient.js';
import { sendOrderStatusUpdateEmailEmailJs } from '../Utils/sendOrderStatusUpdateEmailEmailJs.js';

const QUEUE = 'order_status_emails';
const MAX_RETRIES = Number( 5);
const BASE_BACKOFF_MS = 2000;

async function start() {
  const channel = await getChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  channel.prefetch(1);
  console.log(`[orderStatusEmailWorker] Waiting for messages in ${QUEUE}...`);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const raw = msg.content.toString();
      const job = JSON.parse(raw);
      const headers = msg.properties.headers || {};
      const retries = Number(headers['x-retries'] || 0);

      if (!job || !job.to || !job.order) {
        console.warn('[orderStatusEmailWorker] Invalid job - acking and skipping', job);
        channel.ack(msg);
        return;
      }

      await sendOrderStatusUpdateEmailEmailJs({ to: job.to, order: job.order, meta: job.meta });
      console.log('[orderStatusEmailWorker] Sent status update email to', job.to);
      channel.ack(msg);
    } catch (err) {
      console.error('[orderStatusEmailWorker] send failed:', err);
      const headers = msg.properties.headers || {};
      const currentRetries = Number(headers['x-retries'] || 0);

      if (currentRetries < MAX_RETRIES) {
        const nextRetries = currentRetries + 1;
        const backoff = BASE_BACKOFF_MS * Math.pow(2, currentRetries);
        channel.ack(msg);
        setTimeout(async () => {
          try {
            await channel.assertQueue(QUEUE, { durable: true });
            channel.sendToQueue(QUEUE, Buffer.from(msg.content.toString()), {
              persistent: true,
              headers: { 'x-retries': nextRetries },
            });
            console.log(`[orderStatusEmailWorker] Requeued job (retry ${nextRetries})`);
          } catch (pubErr) {
            console.error('[orderStatusEmailWorker] failed to republish job', pubErr);
          }
        }, backoff);
      } else {
        // Push to DLQ for inspection
        try {
          const dlq = `${QUEUE}_dlq`;
          await channel.assertQueue(dlq, { durable: true });
          await channel.sendToQueue(dlq, msg.content, { persistent: true, headers: { 'x-retries': currentRetries } });
          console.error('[orderStatusEmailWorker] pushed to DLQ:', dlq);
        } catch (dlqErr) {
          console.error('[orderStatusEmailWorker] Failed to push to DLQ', dlqErr);
        }
        channel.ack(msg);
      }
    }
  }, { noAck: false });
}

start().catch((err) => {
  console.error('orderStatusEmailWorker failed to start', err);
  process.exit(1);
});
