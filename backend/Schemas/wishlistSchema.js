import { z } from "zod";
import mongoose from 'mongoose';

// Custom validation for MongoDB ObjectId strings
const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  {
    message: "Invalid ObjectId format",
  }
);

export const addWishlistItemSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema,
}).strict();