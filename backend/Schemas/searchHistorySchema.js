import { z } from "zod";
import mongoose from 'mongoose';

// Custom validation for MongoDB ObjectId strings
const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  {
    message: "Invalid ObjectId format",
  }
);

export const createSearchHistorySchema = z.object({
  userId: objectIdSchema,
  query: z.string().min(1, "Search query cannot be empty.").max(255, "Search query cannot exceed 255 characters."),
}).strict();

export const getSearchHistoryParamsSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
  searchTerm: z.string().optional(), // For filtering search history queries
  sortBy: z.enum(['createdAt', 'query']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
}).partial();