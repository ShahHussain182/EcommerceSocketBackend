import Redis from "ioredis";
import { config } from "./config.js";

const redisClient = new Redis({
  host: config.REDIS_HOST,
  port: Number(config.REDIS_PORT),
  username: config.REDIS_USERNAME,  // still required on Redis Cloud
  password: config.REDIS_PASSWORD,
  // ❌ no tls here
});

redisClient.on("connect", () => console.log("✅ Connected to Redis (no TLS)"));
redisClient.on("error", (err) => console.error("❌ Redis error:", err));

export default redisClient;
