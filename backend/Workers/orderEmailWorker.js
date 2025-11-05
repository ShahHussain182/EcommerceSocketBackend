// workers/orderEmailWorker.js
import dotenv from 'dotenv';
dotenv.config();
import { getChannel } from '../Utils/lavinmqClient.js';
import { sendOrderConfirmationEmailEmailJs } from '../Utils/sendOrderConfirmationEmailEmailJs.js';

const QUEUE =  'order_emails';
const MAX_RETRIES = Number( 5);
const BASE_BACKOFF_MS = 2000; // 2s backoff base


async function start() {
  const channel = await getChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  // Process one message at a time to avoid rate spikes
  channel.prefetch(1);
  console.log(`[orderEmailWorker] Waiting for messages in ${QUEUE}...`);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const raw = msg.content.toString();
      const job = JSON.parse(raw);
      const retries = (msg.properties.headers && msg.properties.headers['x-retries']) || 0;

      console.log(`[orderEmailWorker] Processing job for order ${job?.order?.orderNumber || job?.order?._id} (retries:${retries})`);

      // job expected shape: { to: 'user@example.com', order: { ... } }
      if (!job || !job.to || !job.order) {
        console.warn('[orderEmailWorker] Invalid job, acking and skipping', job);
        channel.ack(msg);
        return;
      }

      // Attempt to send
      await sendOrderConfirmationEmailEmailJs({ to: job.to, order: job.order });
      console.log('[orderEmailWorker] Email sent successfully to', job.to);

      // Acknowledge the message after successful send
      channel.ack(msg);
    } catch (err) {
      console.error('[orderEmailWorker] send failed:', err);

      // read retries from header
      const headers = msg.properties.headers || {};
      const currentRetries = headers['x-retries'] ? Number(headers['x-retries']) : 0;

      if (currentRetries < MAX_RETRIES) {
        const nextRetries = currentRetries + 1;
        const backoff = BASE_BACKOFF_MS * Math.pow(2, currentRetries); // exponential backoff
        console.log(`[orderEmailWorker] Scheduling retry #${nextRetries} after ${backoff}ms`);

        // re-publish the message after a delay (in-process)
        // Approach: ack original then setTimeout to republish with incremented header.
        channel.ack(msg);

        // Delay then republish
        setTimeout(async () => {
          try {
            await channel.assertQueue(QUEUE, { durable: true });
            const payload = Buffer.from(msg.content.toString());
            channel.sendToQueue(QUEUE, payload, {
              persistent: true,
              headers: { 'x-retries': nextRetries },
            });
            console.log(`[orderEmailWorker] Requeued job (retry ${nextRetries})`);
          } catch (pubErr) {
            console.error('[orderEmailWorker] failed to republish job', pubErr);
            // In case of publish failure, log; not much else to do without DLQ
          }
        }, backoff);
      } else {
        console.error(`[orderEmailWorker] Max retries reached (${MAX_RETRIES}). Discarding or moving to DLQ:`, msg.content.toString());
        // You can implement a DLQ: publish to another queue like `${QUEUE}_dlq` with details for manual inspection.
        try {
          const dlq = `${QUEUE}_dlq`;
          await channel.assertQueue(dlq, { durable: true });
          channel.sendToQueue(dlq, msg.content, { persistent: true, headers: { 'x-retries': currentRetries } });
          console.log('[orderEmailWorker] pushed to DLQ:', dlq);
        } catch (dlqErr) {
          console.error('[orderEmailWorker] Failed to push to DLQ', dlqErr);
        }
        // acknowledge original so it doesn't reappear
        channel.ack(msg);
      }
    }
  }, { noAck: false });
}

start().catch((err) => {
  console.error('orderEmailWorker failed to start', err);
  process.exit(1);
});
