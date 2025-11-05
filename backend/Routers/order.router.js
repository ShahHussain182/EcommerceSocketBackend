import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { requireAdmin } from '../Middleware/requireAdmin.js';
import { createOrder, getUserOrders, getOrderById, updateOrderStatus, getAllOrders, getOrderMetrics, getSalesDataOverTime, getTopSellingProducts } from '../Controllers/order.controller.js';

const orderRouter = express.Router();

// All order routes require authentication
orderRouter.use(requireAuth);

// Admin routes
orderRouter.get('/admin', requireAdmin, getAllOrders); // Get all orders (admin)
orderRouter.get('/metrics', requireAdmin, getOrderMetrics); // Get order metrics (admin)
orderRouter.get('/sales-over-time', requireAdmin, getSalesDataOverTime); // New: Get sales data over time (admin)
orderRouter.get('/top-selling-products', requireAdmin, getTopSellingProducts); // New: Get top-selling products (admin)

// User routes
orderRouter.route('/')
  .post(createOrder) // Create a new order
  .get(getUserOrders); // Get all orders for the authenticated user

orderRouter.route('/:id')
  .get(getOrderById) // Get a specific order by ID
  .put(updateOrderStatus); // Update order status (e.g., cancel)

export default orderRouter;