import { z } from "zod";
import mongoose from 'mongoose';

// Custom validation for MongoDB ObjectId strings
const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  {
    message: "Invalid ObjectId format",
  }
);

export const createCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters.").max(50, "Category name cannot exceed 50 characters."),
  description: z.string().max(500, "Category description cannot exceed 500 characters.").optional(),
}).strict();

export const updateCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters.").max(50, "Category name cannot exceed 50 characters.").optional(),
  description: z.string().max(500, "Category description cannot exceed 500 characters.").optional(),
}).strict().partial(); // Allow partial updates