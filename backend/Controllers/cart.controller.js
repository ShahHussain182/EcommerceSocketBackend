import { Cart } from '../Models/Cart.model.js';
import { Product } from '../Models/Product.model.js';
import catchErrors from '../Utils/catchErrors.js';
import mongoose from 'mongoose';

// Helper to find or create a cart for a user
const findOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
};

/**
 * @description Get the user's cart. This is the main synchronization endpoint.
 * It validates the cart against the live product database before returning it.
 */
export const getCart = catchErrors(async (req, res) => {
  const userId = req.userId;
  let cart = await findOrCreateCart(userId);

  // --- Real-time Validation Logic ---
  let needsUpdate = false;
  const validationPromises = cart.items.map(async (item) => {
    const product = await Product.findById(item.productId);
    
    // Case 1: Product or variant was deleted
    if (!product) {
      return null; // This item will be filtered out
    }
    const variant = product.variants.id(item.variantId);
    if (!variant) {
      return null; // This item will be filtered out
    }

    // Case 2: Check for price changes
    if (item.priceAtTime !== variant.price) {
      // In a real app, you might flag this to the user. For now, we'll auto-update.
      item.priceAtTime = variant.price;
      needsUpdate = true;
    }

    // Case 3: Check stock and adjust quantity if necessary
    if (item.quantity > variant.stock) {
      item.quantity = Math.max(variant.stock, 1); // Adjust to max available stock
      needsUpdate = true;
    }

    // Case 4: Update variant details if they changed (e.g., color name changed)
    // OR if they are missing (for old cart items that predate the schema change)
    if (item.sizeAtTime === undefined || item.sizeAtTime !== variant.size) {
      item.sizeAtTime = variant.size;
      needsUpdate = true;
    }
    if (item.colorAtTime === undefined || item.colorAtTime !== variant.color) {
      item.colorAtTime = variant.color;
      needsUpdate = true;
    }

    // Case 5: Update imageAtTime to use thumbnail rendition if available
    const currentThumbnail = product.imageRenditions[0]?.thumbnail || product.imageUrls[0] || '/placeholder.svg';
    if (item.imageAtTime !== currentThumbnail) {
      item.imageAtTime = currentThumbnail;
      needsUpdate = true;
    }
    
    return item;
  });

  const validatedItems = (await Promise.all(validationPromises)).filter(Boolean); // Filter out nulls

  if (validatedItems.length !== cart.items.length || needsUpdate) {
    cart.items = validatedItems;
    await cart.save(); // This is where validation happens
  }

  // Populate product details for a rich response to the frontend
  await cart.populate({
    path: 'items.productId',
    select: 'name description category'
  });

  res.status(200).json({ success: true, cart });
});

/**
 * @description Add an item to the cart or update its quantity.
 */
export const addItemToCart = catchErrors(async (req, res) => {
  const userId = req.userId;
  const { productId, variantId, quantity } = req.body;

  // 1. Validate the product and variant exist and have stock
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  const variant = product.variants.id(variantId);
  if (!variant) {
    return res.status(404).json({ success: false, message: 'Product variant not found.' });
  }
  if (variant.stock < quantity) {
    return res.status(400).json({ success: false, message: 'Not enough stock available.' });
  }

  // 2. Find or create the user's cart
  const cart = await findOrCreateCart(userId);

  // 3. Check if the item (product + variant) already exists
  const existingItem = cart.items.find(
    item => item.productId.equals(productId) && item.variantId.equals(variantId)
  );

  // Determine the image URL to store (thumbnail rendition)
  const imageToStore = product.imageRenditions[0]?.thumbnail || product.imageUrls[0] || '/placeholder.svg';

  if (existingItem) {
    // Update quantity, ensuring it doesn't exceed stock
    existingItem.quantity = Math.min(existingItem.quantity + quantity, variant.stock);
    // Also update imageAtTime in case the product's primary image/rendition changed
    existingItem.imageAtTime = imageToStore;
  } else {
    // Add new item with a data snapshot, including variant details
    cart.items.push({
      productId,
      variantId,
      quantity,
      priceAtTime: variant.price,
      nameAtTime: product.name,
      imageAtTime: imageToStore, // Store thumbnail rendition
      sizeAtTime: variant.size, // Store variant size
      colorAtTime: variant.color, // Store variant color
    });
  }

  await cart.save();
  await cart.populate({ path: 'items.productId', select: 'name' });

  res.status(200).json({ success: true, cart });
});

/**
 * @description Update the quantity of a specific item in the cart.
 */
export const updateItemQuantity = catchErrors(async (req, res) => {
    const userId = req.userId;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
        return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    const item = cart.items.id(itemId);
    if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    // Validate against stock
    const product = await Product.findById(item.productId);
    const variant = product.variants.id(item.variantId);
    if (quantity > variant.stock) {
        return res.status(400).json({ success: false, message: `Only ${variant.stock} items available.` });
    }

    item.quantity = quantity;
    await cart.save();
    await cart.populate({ path: 'items.productId', select: 'name' });

    res.status(200).json({ success: true, cart });
});


/**
 * @description Remove an item from the cart.
 */
export const removeItemFromCart = catchErrors(async (req, res) => {
    const userId = req.userId;
    const { itemId } = req.params;

    const cart = await Cart.findOneAndUpdate(
        { userId },
        { $pull: { items: { _id: itemId } } },
        { new: true }
    ).populate({ path: 'items.productId', select: 'name' });

    if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    res.status(200).json({ success: true, cart });
});

/**
 * @description Clear all items from the cart.
 */
export const clearCart = catchErrors(async (req, res) => {
    const userId = req.userId;
    const cart = await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } },
        { new: true }
    );

    if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    res.status(200).json({ success: true, cart });
});