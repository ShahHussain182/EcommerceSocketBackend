import { Wishlist } from '../Models/Wishlist.model.js';
import { Product } from '../Models/Product.model.js';
import catchErrors from '../Utils/catchErrors.js';
import { addWishlistItemSchema } from '../Schemas/wishlistSchema.js';
import mongoose from 'mongoose';

// Helper to find or create a wishlist for a user
const findOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ userId, items: [] });
  }
  return wishlist;
};

/**
 * @description Get the user's wishlist.
 * It validates the wishlist against the live product database before returning it.
 */
export const getWishlist = catchErrors(async (req, res) => {
  const userId = req.userId;
  let wishlist = await findOrCreateWishlist(userId);

  // --- Real-time Validation Logic ---
  let needsUpdate = false;
  const validationPromises = wishlist.items.map(async (item) => {
    const product = await Product.findById(item.productId);
    
    // Case 1: Product or variant was deleted
    if (!product) {
      needsUpdate = true;
      return null; // This item will be filtered out
    }
    const variant = product.variants.id(item.variantId);
    if (!variant) {
      needsUpdate = true;
      return null; // This item will be filtered out
    }

    // Determine the current thumbnail URL
    const currentThumbnail = product.imageRenditions[0]?.thumbnail || product.imageUrls[0] || '/placeholder.svg';

    // Case 2: Check for price changes or other variant detail changes
    if (
      item.priceAtTime !== variant.price ||
      item.sizeAtTime !== variant.size ||
      item.colorAtTime !== variant.color ||
      item.nameAtTime !== product.name ||
      item.imageAtTime !== currentThumbnail // Check if imageAtTime needs update
    ) {
      item.priceAtTime = variant.price;
      item.sizeAtTime = variant.size;
      item.colorAtTime = variant.color;
      item.nameAtTime = product.name;
      item.imageAtTime = currentThumbnail; // Update to thumbnail rendition
      needsUpdate = true;
    }
    
    return item;
  });

  const validatedItems = (await Promise.all(validationPromises)).filter(Boolean); // Filter out nulls

  if (validatedItems.length !== wishlist.items.length || needsUpdate) {
    wishlist.items = validatedItems;
    await wishlist.save();
  }

  // Populate product details for a rich response to the frontend
  await wishlist.populate({
    path: 'items.productId',
    select: 'name description category imageUrls variants imageRenditions' // Select imageRenditions for frontend use
  });

  res.status(200).json({ success: true, wishlist });
});

/**
 * @description Add an item to the wishlist.
 */
export const addItemToWishlist = catchErrors(async (req, res) => {
  const userId = req.userId;
  const { productId, variantId } = addWishlistItemSchema.parse(req.body);

  // 1. Validate the product and variant exist
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  const variant = product.variants.id(variantId);
  if (!variant) {
    return res.status(404).json({ success: false, message: 'Product variant not found.' });
  }

  // 2. Find or create the user's wishlist
  const wishlist = await findOrCreateWishlist(userId);

  // 3. Check if the item (product + variant) already exists in the wishlist
  const existingItem = wishlist.items.find(
    item => item.productId.equals(productId) && item.variantId.equals(variantId)
  );

  if (existingItem) {
    return res.status(409).json({ success: false, message: 'Item already in wishlist.' });
  } else {
    // Determine the image URL to store (thumbnail rendition)
    const imageToStore = product.imageRenditions[0]?.thumbnail || product.imageUrls[0] || '/placeholder.svg';

    // Add new item with a data snapshot, including variant details
    wishlist.items.push({
      productId,
      variantId,
      nameAtTime: product.name,
      imageAtTime: imageToStore, // Store thumbnail rendition
      priceAtTime: variant.price,
      sizeAtTime: variant.size,
      colorAtTime: variant.color,
    });
  }

  await wishlist.save();
  await wishlist.populate({
    path: 'items.productId',
    select: 'name description category imageUrls variants imageRenditions' // Select imageRenditions for frontend use
  });

  res.status(200).json({ success: true, wishlist });
});

/**
 * @description Remove an item from the wishlist.
 */
export const removeItemFromWishlist = catchErrors(async (req, res) => {
    const userId = req.userId;
    const { itemId } = req.params;

    const wishlist = await Wishlist.findOneAndUpdate(
        { userId },
        { $pull: { items: { _id: itemId } } },
        { new: true }
    ).populate({
      path: 'items.productId',
      select: 'name description category imageUrls variants imageRenditions' // Select imageRenditions for frontend use
    });

    if (!wishlist) {
        return res.status(404).json({ success: false, message: 'Wishlist not found.' });
    }

    res.status(200).json({ success: true, wishlist });
});

/**
 * @description Clear all items from the wishlist.
 */
export const clearWishlist = catchErrors(async (req, res) => {
    const userId = req.userId;
    const wishlist = await Wishlist.findOneAndUpdate(
        { userId },
        { $set: { items: [] } },
        { new: true }
    );

    if (!wishlist) {
        return res.status(404).json({ success: false, message: 'Wishlist not found.' });
    }

    res.status(200).json({ success: true, wishlist });
});