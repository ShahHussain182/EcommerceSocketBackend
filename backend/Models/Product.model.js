import mongoose from 'mongoose';

// This schema defines the structure for product variations (e.g., size, color, price).
// It will be embedded within the main Product document.
const variantSchema = new mongoose.Schema({
  size: {
    type: String,
    required: true,
    trim: true,
  },
  color: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: [true, "Variant price is required."],
    min: [0, "Price cannot be negative."],
  },
  stock: {
    type: Number,
    required: true,
    min: [0, "Stock cannot be negative."],
    default: 0,
  },
}, { _id: true }); // Ensure variants get their own unique _id

// Schema for storing different image renditions
const imageRenditionSchema = new mongoose.Schema({
  original: { type: String, required: true },
  medium: { type: String, required: true },
  thumbnail: { type: String, required: true },
  webp: { type: String }, // Optional WebP version
  avif: { type: String }, // Optional AVIF version
  uploadId: { type: String, index: true, sparse: true },      // stable id to match uploads -> worker
  originalS3Key: { type: String, sparse: true },              // the original S3 key for reference
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required."],
      trim: true,
      index: true, // Add index for faster searching
    },
    description: {
      type: String,
      required: [true, "Product description is required."],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Product category is required."],
      trim: true,
      index: true,
    },
    imageUrls: {
      type: [String],
      required: true, // Now required for creation
      minlength: [1, 'At least one image URL is required.'], // Enforce minimum 1
      maxlength: [5, 'Maximum of 5 images allowed.'], // Enforce maximum 5
      validate: [v => Array.isArray(v) && v.length > 0, 'At least one image URL is required.'] // Adjusted validation
    },
    imageRenditions: { // New field to store all renditions
      type: [imageRenditionSchema],
      default: [],
    },
    imageProcessingStatus: { // New field to track processing status
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    variants: {
      type: [variantSchema],
      default: [], // Default to an empty array if not provided
    },
    // New fields for reviews
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Average rating cannot be less than 0.'],
      max: [5, 'Average rating cannot be more than 5.'],
      set: (val) => parseFloat(val.toFixed(1)), // Store with one decimal place
    },
    numberOfReviews: {
      type: Number,
      default: 0,
      min: [0, 'Number of reviews cannot be negative.'],
    },
  },
  { 
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export const Product = mongoose.model('Product', productSchema);