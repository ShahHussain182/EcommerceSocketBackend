import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { 
    getWishlist, 
    addItemToWishlist, 
    removeItemFromWishlist, 
    clearWishlist 
} from '../Controllers/wishlist.controller.js';

const wishlistRouter = express.Router();

// Apply the requireAuth middleware to all routes in this file
wishlistRouter.use(requireAuth);

wishlistRouter.route('/')
    .get(getWishlist)
    .delete(clearWishlist);

wishlistRouter.route('/items')
    .post(addItemToWishlist);

wishlistRouter.route('/items/:itemId')
    .delete(removeItemFromWishlist);

export default wishlistRouter;