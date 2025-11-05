import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { requireAdmin } from '../Middleware/requireAdmin.js'; // Import requireAdmin
import { createReview, getProductReviews, updateReview, deleteReview, getAllReviews } from '../Controllers/review.controller.js';

const reviewRouter = express.Router();

// Route to create a new review (requires authentication)
reviewRouter.post('/', requireAuth, createReview);

// Route to get all reviews for a specific product (no authentication required)
reviewRouter.get('/product/:productId', getProductReviews);

// New route to get all reviews (requires authentication and admin role)
reviewRouter.get('/', requireAuth, requireAdmin, getAllReviews);

// Routes to update or delete a specific review (requires authentication and ownership)
reviewRouter.route('/:reviewId')
  .put(requireAuth, updateReview)
  .delete(requireAuth, deleteReview);

export default reviewRouter;