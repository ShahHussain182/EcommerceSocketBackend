import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
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
  },
  // Snapshot of product/variant details at the time of order
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
}, { _id: true }); // Each item in the order should have its own ID


const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderNumber: { // New field for sequential order number
      type: Number,
      unique: true,
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: {
      type: String, // e.g., 'Credit Card', 'PayPal', 'Cash on Delivery'
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative.'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending',
      index: true, // Add index for faster queries
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Add indexes for common query patterns
orderSchema.index({ userId: 1, createdAt: -1 }); // For user order history
orderSchema.index({ status: 1, createdAt: -1 }); // For admin order management

export const Order = mongoose.model('Order', orderSchema);