// server.js
import express from "express";
import dotenv from "dotenv";
import MongoStore from "connect-mongo";
import session from "express-session";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { requestContextMiddleware } from "./Utils/requestContext.js";
import redisClient from "./Utils/redisClient.js";
import { connectDB } from "./DB/connectDB.js";
import authRouter from "./Routers/auth.router.js";
import productRouter from "./Routers/product.router.js";
import cartRouter from "./Routers/cart.router.js";
import orderRouter from "./Routers/order.router.js";
import wishlistRouter from "./Routers/wishlist.router.js";
import reviewRouter from "./Routers/review.router.js";
import customerRouter from "./Routers/customer.router.js";
import categoryRouter from "./Routers/category.router.js";
import reportRouter from "./Routers/report.router.js";
import userRouter from "./Routers/user.router.js";
import adminRouter from "./Routers/admin.router.js";
import { errorHandler, notFoundHandler } from "./Middleware/errorHandler.js";
import { config } from "./Utils/config.js";
import { logger } from "./Utils/logger.js";
import { Product } from "./Models/Product.model.js";
import { mockProducts } from "./Utils/mockProducts.js";
import { Counter } from "./Models/Counter.model.js";
import { Category } from "./Models/Category.model.js";
import { mockCategories } from "./Utils/mockCategories.js";
import { imageProcessingQueue } from './Queues/imageProcessing.queue.js'; // Import queue
import { imageProcessingWorker } from './Workers/imageProcessing.worker.js'; // Import worker
import rabbit,{ closeRabbitConnection } from './Utils/lavinmqClient.js';


dotenv.config();

const app = express();
const mongoUrl = config.MONGO_URL;

// ----------------- Middleware -----------------
if (config.NODE_ENV === "development") {
  logger.debug("Running in development mode");
}
app.use(requestContextMiddleware); 
app.use(morgan("combined", { stream: logger.stream }));
const CLIENT_URL = process.env.CLIENT_URL
app.use(helmet());
app.use(
  cors({
    origin: [CLIENT_URL, "http://localhost:5173"], // multiple origins
    credentials: true,
  })
);



app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ message: "Too many requests, slow down." });
    },
  })
);

app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", 1);

// ----------------- Session Store -----------------
const mongoClient = new MongoClient(mongoUrl);
await mongoClient.connect();
logger.info("MongoClient connected for sessions.");

const sessionTTL = 60 * 60 * 24 * 30; // 30 days (seconds)

const store = MongoStore.create({
  client: mongoClient,
  collectionName: "sessions",
  ttl: sessionTTL,
  autoRemove: "native",
});

app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      maxAge: sessionTTL * 1000,
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  })
);

// ----------------- Routes -----------------
app.use("/api/v1",userRouter)
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/wishlist", wishlistRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// ----------------- Server -----------------
let server;

const startServer = async () => {
  await connectDB();
  await rabbit.getChannel(); 
  await rabbit.assertQueues(['order_emails','order_status_emails']);
  // --- Database Seeding Logic ---
  try {
    // Seed Products
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      logger.info("No products found. Seeding database with mock data...");
      // For initial seeding, we'll create products with 'completed' status
      // In a real scenario, these would also go through the queue
      await Product.insertMany(mockProducts.map(p => ({ ...p, imageProcessingStatus: 'completed' })));
      logger.info("✅ Database seeded successfully with mock products.");
    } else {
      logger.info(`${productCount} products already exist in the database. Skipping product seeding.`);
    }

    // Seed Categories
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      logger.info("No categories found. Seeding database with mock categories...");
      await Category.insertMany(mockCategories);
      logger.info("✅ Database seeded successfully with mock categories.");
    } else {
      logger.info(`${categoryCount} categories already exist in the database. Skipping category seeding.`);
    }

    // Initialize order number counter if it doesn't exist
    const orderCounter = await Counter.findById('orderId');
    if (!orderCounter) {
      await Counter.create({ _id: 'orderId', seq: 1000 }); // Start from 1000
      logger.info("✅ Order number counter initialized to 1000.");
    } else {
      logger.info(`Order number counter already exists, current sequence: ${orderCounter.seq}`);
    }
    

    (async () => {
      try {
        await redisClient.set("test-key", "hello");
        const value = await redisClient.get("test-key");
        console.log("Redis test value:", value); // should log "hello"
      } catch (err) {
        console.error("Redis test failed:", err);
      }
    })();
    
  } catch (error) {
    logger.error("❌ Error during database seeding or counter initialization:", error);
  }
  // --- End of Seeding Logic ---

  server = app.listen(config.PORT, () => {
    logger.info(
      `🚀 Server running in ${config.NODE_ENV} mode on port ${config.PORT}`
    );
    if (config.NODE_ENV === "development") {
      logger.debug(`http://localhost:${config.PORT}`);
    }
  });
};

startServer();

// ----------------- Graceful Shutdown -----------------
async function cleanup() {
  logger.info("Starting cleanup process...");

  if (server) {
    logger.debug("Closing HTTP server...");
    try {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error("Error closing HTTP server:", err);
            return reject(err);
          }
          logger.info("HTTP server closed.");
          resolve();
        });
      });
    } catch (error) {
      logger.error("Failed to close HTTP server:", error);
    }
  }
  await closeRabbitConnection();
  if (mongoose.connection.readyState !== 0) {
    logger.debug("Disconnecting Mongoose...");
    try {
      await mongoose.disconnect();
      logger.info("Mongoose disconnected.");
    } catch (error) {
      logger.error("Failed to disconnect Mongoose:", error);
    }
  }

  if (mongoClient) {
    logger.debug("Closing Mongo client...");
    try {
      await mongoClient.close(true);
      logger.info("MongoStore client disconnected.");
    } catch (error) {
      logger.error("Failed to close Mongo client:", error);
    }
  }

  // Close BullMQ queue and worker connections
  logger.debug("Closing BullMQ queue and worker connections...");
  try {
    await imageProcessingQueue.close();
    logger.info("BullMQ image processing queue closed.");
  } catch (error) {
    logger.error(`Failed to close image processing queue: ${error.message}`);
  }
  try {
    await imageProcessingWorker.close();
    logger.info("BullMQ image processing worker closed.");
  } catch (error) {
    logger.error(`Failed to close image processing worker: ${error.message}`);
  }


  logger.info("All connections closed successfully.");
}

async function flushLogger() {
  logger.debug("Flushing logs...");
  return new Promise((resolve) => {
    const transports = logger.transports.filter(t => t.close);
    let pendingTransports = transports.length;

    if (pendingTransports === 0) {
      logger.debug("No transports to flush.");
      return resolve();
    }

    let closedCount = 0;
    const onTransportClosed = () => {
      closedCount++;
      if (closedCount === pendingTransports) {
        logger.debug("All transports flushed.");
        resolve();
      }
    };

    transports.forEach(transport => {
      transport.close(onTransportClosed);
    });

    setTimeout(() => {
      logger.warn("Flush logger timeout reached.");
      resolve();
    }, 1000);
  });
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    logger.warn(`Received ${signal}, starting graceful shutdown...`);
    
    const timeout = setTimeout(() => {
      logger.error("Force exiting after 10s...");
      process.exit(1);
    }, 20000);
    
    try {
      logger.info("Starting cleanup process...");
      await cleanup();
      logger.info("✅ Cleanup complete, exiting.");
      
      logger.info("Flushing logs...");
      await flushLogger();
      logger.info("Logs flushed successfully.");
      
      clearTimeout(timeout);
      console.log("Graceful shutdown completed.");
      
      setTimeout(() => process.exit(0), 100);
    } catch (err) {
      logger.error(`Error during shutdown: ${err.message}`);
      process.exit(1);
    }
  });
});

["uncaughtException", "unhandledRejection"].forEach((event) => {
  process.on(event, async (err) => {
    logger.error(`Fatal error due to ${event}:`, err);

    const timeout = setTimeout(() => {
      console.log("Force exiting after 10s...");
      process.exit(1);
    }, 10000);

    try {
      await cleanup();
      logger.info("Emergency cleanup completed.");
      await flushLogger();
      clearTimeout(timeout);
      process.exit(1);
    } catch (e) {
      logger.error("Error during forced shutdown:", e);
      try {
        await flushLogger();
      } catch (flushError) {
        console.error("Failed to flush logs during emergency shutdown:", flushError);
      }
      clearTimeout(timeout);
      process.exit(1);
    }
  });
});