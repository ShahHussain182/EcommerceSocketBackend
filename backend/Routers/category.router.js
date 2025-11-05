import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { requireAdmin } from '../Middleware/requireAdmin.js';
import { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory } from '../Controllers/category.controller.js';

const categoryRouter = express.Router();

// Public route to get all categories
categoryRouter.get('/', getAllCategories);
categoryRouter.get('/:id', getCategoryById);

// Admin-only routes for CRUD operations
categoryRouter.post('/', requireAuth, requireAdmin, createCategory);
categoryRouter.put('/:id', requireAuth, requireAdmin, updateCategory);
categoryRouter.delete('/:id', requireAuth, requireAdmin, deleteCategory);

export default categoryRouter;