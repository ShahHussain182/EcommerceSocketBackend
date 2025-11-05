import { z } from "zod";

export const getAllCustomersParamsSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
  searchTerm: z.string().optional(),
  statusFilter: z.enum(['Active', 'Inactive', 'VIP', 'New', 'Potential', 'All']).optional().default('All'),
  sortBy: z.enum(['userName', 'email', 'createdAt', 'lastLogin', 'totalOrders', 'totalSpent']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
}).partial(); // Allow partial parameters for flexibility