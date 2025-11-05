import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true, // Index for efficient lookup of reviews by product
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for efficient lookup of reviews by user
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required.'],
      min: [1, 'Rating must be at least 1.'],
      max: [5, 'Rating cannot be more than 5.'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Review title cannot exceed 100 characters.'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required.'],
      minlength: [10, 'Review comment must be at least 10 characters.'],
      maxlength: [1000, 'Review comment cannot exceed 1000 characters.'],
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Ensure a user can only leave one review per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);