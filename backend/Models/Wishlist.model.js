import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  // Snapshot of product/variant details at the time of adding to wishlist
  nameAtTime: {
    type: String,
    required: true,
  },
  imageAtTime: {
    type: String,
    required: true,
  },
  priceAtTime: {
    type: Number,
    required: true,
  },
  sizeAtTime: {
    type: String,
    required: true,
  },
  colorAtTime: {
    type: String,
    required: true,
  },
}, { timestamps: true, _id: true }); // Each item in the wishlist should have its own ID


const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Ensures one wishlist per user.
      index: true,
    },
    items: [wishlistItemSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual to calculate the total number of items in the wishlist
wishlistSchema.virtual('totalItems').get(function() {
  return this.items.length;
});

export const Wishlist = mongoose.model('Wishlist', wishlistSchema);