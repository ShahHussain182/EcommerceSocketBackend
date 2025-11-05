// lib/rabbitmq.js
import amqp from 'amqplib';
import { logger } from './logger.js'; // your logger (winston/pino/etc.)
import dotenv from 'dotenv';
dotenv.config();  
const RABBITMQ_URL =  process.env.CLOUDAMQP_URL 
const MAX_RETRIES = Number(process.env.RABBITMQ_CONNECT_MAX_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.RABBITMQ_CONNECT_RETRY_DELAY_MS || 5000); // 5s default

let _conn = null;
let _channel = null;
let _connecting = null; // promise for ongoing connection attempt

function safeLog(level, ...args) {
  if (logger && typeof logger[level] === 'function') {
    logger[level](...args);
  } else {
    // fallback
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](...args);
  }
}

async function connectWithRetries() {
  // If a connection attempt is already in progress, return that
  if (_connecting) return _connecting;

  _connecting = (async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        safeLog('info', `Attempting to connect to RabbitMQ (attempt ${attempt}/${MAX_RETRIES}) -> ${RABBITMQ_URL}`);
        _conn = await amqp.connect(RABBITMQ_URL);

        // handle unexpected errors / close
        _conn.on('error', (err) => {
          safeLog('error', 'RabbitMQ connection error:', err && err.message ? err.message : err);
          // reset so next getChannel() will attempt reconnect
          _conn = null;
          _channel = null;
        });

        _conn.on('close', () => {
          safeLog('warn', 'RabbitMQ connection closed');
          _conn = null;
          _channel = null;
        });

        // create confirm channel for publish reliability
        _channel = await _conn.createConfirmChannel();

        // Good idea: set default prefetch for consumers if you plan to use channel for consuming
        // _channel.prefetch(Number(process.env.RABBITMQ_PREFETCH || 1));

        safeLog('info', 'RabbitMQ connected and confirm channel created');
        return; // success
      } catch (err) {
        safeLog('error', `RabbitMQ connection failed (attempt ${attempt}/${MAX_RETRIES}):`, err && err.message ? err.message : err);
        // cleanup partials
        try {
          if (_channel) {
            await _channel.close().catch(() => {});
            _channel = null;
          }
          if (_conn) {
            await _conn.close().catch(() => {});
            _conn = null;
          }
        } catch (_) {}

        if (attempt === MAX_RETRIES) {
          safeLog('error', 'Max retries reached. RabbitMQ connection failed.');
          throw new Error('Failed to connect to RabbitMQ after maximum retries');
        }
        // wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  })();

  try {
    await _connecting;
    return;
  } finally {
    // reset connecting reference so future reconnects create new promise if needed
    _connecting = null;
  }
}

/**
 * Ensure channel is ready. Connects first time (with retries).
 * Returns a confirm channel.
 */
export async function getChannel() {
  if (_channel) return _channel;
  await connectWithRetries();
  if (!_channel) {
    throw new Error('RabbitMQ channel not initialized after connect');
  }
  return _channel;
}

/**
 * Publish a JSON message to a durable queue and wait for confirm.
 * Resolves when broker confirms the publish.
 *
 * @param {string} queueName
 * @param {object} messageObj
 * @returns {Promise<void>}
 */
export async function publishToQueue(queueName, messageObj) {
  if (!queueName) throw new Error('queueName is required');
  const channel = await getChannel();
  // ensure queue exists durable
  await channel.assertQueue(queueName, { durable: true });

  const payload = Buffer.from(JSON.stringify(messageObj));
  return new Promise((resolve, reject) => {
    // sendToQueue on a confirm channel accepts a callback invoked when the broker acks/nacks
    try {
      channel.sendToQueue(queueName, payload, { persistent: true }, (err, ok) => {
        if (err) {
          safeLog('error', `Failed to publish to queue ${queueName}:`, err && err.message ? err.message : err);
          return reject(err);
        }
        // ok is usually undefined; presence of callback with no err means success
        safeLog('info', `Published message to queue ${queueName}`);
        return resolve(ok);
      });
    } catch (err) {
      safeLog('error', `Exception while publishing to queue ${queueName}:`, err && err.message ? err.message : err);
      return reject(err);
    }
  });
}

/**
 * Close channel and connection gracefully
 */
export async function closeRabbitConnection() {
  try {
    if (_channel) {
      await _channel.close();
      safeLog('info', 'RabbitMQ channel closed');
      _channel = null;
    }
    if (_conn) {
      await _conn.close();
      safeLog('info', 'RabbitMQ connection closed');
      _conn = null;
    }
  } catch (err) {
    safeLog('error', 'Error closing RabbitMQ connection:', err && err.message ? err.message : err);
  }
}

// Optionally expose a helper to assert multiple queues used by your app
export async function assertQueues(queueNames = []) {
  const channel = await getChannel();
  for (const q of queueNames) {
    await channel.assertQueue(q, { durable: true });
    safeLog('info', `Asserted queue ${q}`);
  }
}

export default {
  getChannel,
  publishToQueue,
  closeRabbitConnection,
  assertQueues,
};
