import express from 'express';
import { getProducts, getProductById, getFeaturedProducts, createProduct, updateProduct, deleteProduct, getAutocompleteSuggestions, uploadProductImages, deleteProductImage } from '../Controllers/product.controller.js';
import { requireAuth } from '../Middleware/requireAuth.js'; // Import requireAuth
import { requireAdmin } from '../Middleware/requireAdmin.js'; // Import requireAdmin
import { upload } from '../Utils/multerConfig.js'; // Import multer upload middleware

const productRouter = express.Router();

// Public routes
productRouter.get('/featured', getFeaturedProducts);
productRouter.get('/suggestions', getAutocompleteSuggestions); // New route for autocomplete
productRouter.get('/:id', getProductById);
productRouter.get('/', getProducts); // This now uses Atlas Search

// Protected routes (Admin only)
// These routes now require both authentication and admin role
productRouter.post('/', requireAuth, requireAdmin, upload.array('images', 5), createProduct); // Added upload.array middleware
productRouter.put('/:id', requireAuth, requireAdmin, updateProduct);
productRouter.delete('/:id', requireAuth, requireAdmin, deleteProduct);

productRouter.post('/:id/upload-images', requireAuth, requireAdmin, upload.array('images', 5), uploadProductImages); // 'images' is the field name, 5 is max files
productRouter.delete('/:id/images', requireAuth, requireAdmin, deleteProductImage); // New route to delete a specific image

export default productRouter;