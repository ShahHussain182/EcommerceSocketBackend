import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { requireAdmin } from '../Middleware/requireAdmin.js';
import { getAllCustomers, getCustomerGrowthOverTime } from '../Controllers/customer.controller.js';

const customerRouter = express.Router();

// All customer routes require authentication and admin role
customerRouter.use(requireAuth, requireAdmin);

customerRouter.route('/')
    .get(getAllCustomers); // Get all customers with filters and pagination

// New route for customer growth metrics
customerRouter.get('/growth-over-time', getCustomerGrowthOverTime);

export default customerRouter;