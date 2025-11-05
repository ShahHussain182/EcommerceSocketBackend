// DB/connectDB.js
import mongoose from "mongoose";
import { logger } from "../Utils/logger.js";// reuse same Winston instance

export const connectDB = async () => {
  // ✅ Attach listeners BEFORE connect()
  mongoose.connection.on("connected", () => {
    logger.info("✅ Mongoose connected to DB");
  });

  mongoose.connection.on("error", (err) => {
    logger.error("❌ Mongoose connection error:", { message: err.message, stack: err.stack });
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("⚠️ Mongoose connection is disconnected.");
  });

  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    logger.info(`📦 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error("❌ Error connecting to MongoDB:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
};
