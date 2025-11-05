import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { requireAdmin } from '../Middleware/requireAdmin.js';
import {
  generateSalesReport,
  generateCustomerReport,
  generateInventoryReport,
  generateOrderHistoryReport,
  generateReviewSummaryReport,
} from '../Controllers/report.controller.js';

const reportRouter = express.Router();

// All report routes require authentication and admin role
reportRouter.use(requireAuth, requireAdmin);

reportRouter.get('/sales', generateSalesReport);
reportRouter.get('/customers', generateCustomerReport);
reportRouter.get('/inventory', generateInventoryReport);
reportRouter.get('/order-history', generateOrderHistoryReport);
reportRouter.get('/review-summary', generateReviewSummaryReport);

export default reportRouter;