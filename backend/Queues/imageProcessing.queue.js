import { Queue } from 'bullmq';
import { config } from '../Utils/config.js';
import { logger } from '../Utils/logger.js';

const connection = {
  host: config.REDIS_HOST,
  port: Number(config.REDIS_PORT),
  username: config.REDIS_USERNAME,
  password: config.REDIS_PASSWORD,
};

export const imageProcessingQueue = new Queue('image-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 1000, // Initial delay of 1 second, then 2s, 4s, etc.
    },
  },
});

imageProcessingQueue.on('error', (err) => {
  logger.error(`[ImageProcessingQueue] Queue error: ${err.message}`, { error: err });
});

logger.info('[ImageProcessingQueue] Image processing queue initialized.');