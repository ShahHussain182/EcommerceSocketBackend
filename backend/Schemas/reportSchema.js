import { z } from "zod";

export const salesReportSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly'], {
    message: "Invalid sales report period. Must be 'daily', 'weekly', 'monthly', or 'yearly'.",
  }).default('monthly'),
}).strict();

export const customerReportSchema = z.object({
  type: z.enum(['all', 'new', 'vip', 'potential', 'inactive'], {
    message: "Invalid customer report type. Must be 'all', 'new', 'vip', 'potential', or 'inactive'.",
  }).default('all'),
}).strict();

export const inventoryReportSchema = z.object({
  type: z.enum(['all', 'low_stock', 'top_selling'], {
    message: "Invalid inventory report type. Must be 'all', 'low_stock', or 'top_selling'.",
  }).default('all'),
}).strict();

// Schema for general order history report (no specific params needed beyond auth)
export const orderHistoryReportSchema = z.object({}).strict().optional();

// Schema for general review summary report (no specific params needed beyond auth)
export const reviewSummaryReportSchema = z.object({}).strict().optional();