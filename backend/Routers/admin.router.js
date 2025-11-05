import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { requireAdmin } from '../Middleware/requireAdmin.js';
import {
  getAllUsers,
  getUserById,
  updateUserProfileByAdmin,
  deleteUserByAdmin
} from '../Controllers/user.controller.js';

const adminRouter = express.Router();

// Apply authentication and admin middleware to all routes in this router
adminRouter.use(requireAuth, requireAdmin);

// User (Customer) Management Routes
adminRouter.route('/users')
  .get(getAllUsers); // Get all users/customers

adminRouter.route('/users/:id')
  .get(getUserById) // Get a specific user by ID
  .put(updateUserProfileByAdmin) // Update a user's profile (Admin)
  .delete(deleteUserByAdmin); // Delete a user (Admin)

export default adminRouter;