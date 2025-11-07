// imageWorker.js
import dotenv from 'dotenv';
dotenv.config();

import { config } from '../Utils/config.js';
import { createImageProcessingWorker } from './imageProcessing.worker.js';
import mongoose from 'mongoose';
import {connectDB} from "../DB/connectDB.js"
(async function main() {
  try {
    console.log('[ImageWorker] env loaded, connecting to MongoDB...');
    await connectDB(); // await DB connect; ensure this resolves or throws

    console.log('[ImageWorker] MongoDB connected:', mongoose.connection.readyState);

    const connection = {
      host: config.REDIS_HOST,
      port: Number(config.REDIS_PORT),
      username: config.REDIS_USERNAME,
      password: config.REDIS_PASSWORD,
      db: Number(config.REDIS_DB || 0)
    };

    const worker = createImageProcessingWorker(connection);

    // graceful shutdown for worker process
    const shutdown = async () => {
      console.log('Shutting down image worker...');
      try {
        await worker.close();
        await mongoose.disconnect();
        console.log('Image worker and mongoose closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error closing worker:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', async (err) => {
      console.error('uncaughtException in worker:', err);
      await shutdown();
    });
    process.on('unhandledRejection', async (err) => {
      console.error('unhandledRejection in worker:', err);
      await shutdown();
    });

  } catch (err) {
    console.error('[ImageWorker] Failed to start due to:', err);
    process.exit(1);
  }
})();