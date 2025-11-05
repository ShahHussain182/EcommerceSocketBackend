import express from 'express';
import { requireAuth } from '../Middleware/requireAuth.js';
import { 
    getCart, 
    addItemToCart, 
    updateItemQuantity, 
    removeItemFromCart, 
    clearCart 
} from '../Controllers/cart.controller.js';

const cartRouter = express.Router();

// Apply the requireAuth middleware to all routes in this file
cartRouter.use(requireAuth);

cartRouter.route('/')
    .get(getCart)
    .delete(clearCart);

cartRouter.route('/items')
    .post(addItemToCart);

cartRouter.route('/items/:itemId')
    .put(updateItemQuantity)
    .delete(removeItemFromCart);

export default cartRouter;