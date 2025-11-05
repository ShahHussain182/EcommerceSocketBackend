import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();
console.log("Loaded env:", process.env.MONGO_URL, process.env.SESSION_SECRET);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  MONGO_URL: z.string().url(),
  SESSION_SECRET: z.string().min(5),
  PORT: z.string().default("3000"),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  MEILI_HOST: z.string().url().optional(),
  MEILI_MASTER_KEY: z.string().optional(),
  
});

export const config = envSchema.parse(process.env);
