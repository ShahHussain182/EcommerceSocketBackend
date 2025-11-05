import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity cannot be less than 1.'],
    default: 1,
  },
  // --- Data Snapshotting ---
  // Store key details at the time of adding to cart.
  // This prevents unexpected changes if the product is updated later.
  priceAtTime: {
    type: Number,
    required: true,
  },
  nameAtTime: {
    type: String,
    required: true,
  },
  imageAtTime: {
    type: String,
    required: true,
  },
  // New fields to store variant details
  sizeAtTime: {
    type: String,
    required: true,
  },
  colorAtTime: {
    type: String,
    required: true,
  }
}, { timestamps: true, _id: true });


const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Crucial: Ensures one cart per user.
      index: true,
    },
    items: [cartItemSchema],
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// --- Virtuals for Dynamic Calculation ---

// Calculate the subtotal of the cart on the fly.
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => {
    return total + (item.priceAtTime * item.quantity);
  }, 0);
});

// Calculate the total number of items in the cart.
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => {
    return total + item.quantity;
  }, 0);
});

export const Cart = mongoose.model('Cart', cartSchema);