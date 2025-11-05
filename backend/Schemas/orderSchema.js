import { z } from "zod";

export const shippingAddressSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  addressLine1: z.string().min(5, "Address Line 1 is required."),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required."),
  state: z.string().min(2, "State/Province is required."),
  postalCode: z.string().min(3, "Postal code is required."),
  country: z.string().min(2, "Country is required."),
});

export const createOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.string().min(1, "Payment method is required."),
  // The actual cart items and total will be derived from the user's cart on the backend
  // to prevent tampering, so they are not part of the incoming request body.
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']),
});