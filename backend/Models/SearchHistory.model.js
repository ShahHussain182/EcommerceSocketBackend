import mongoose from 'mongoose';

const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for efficient lookup by user
    },
    query: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Search query cannot be empty.'],
      maxlength: [255, 'Search query cannot exceed 255 characters.'],
    },
    // Automatically adds createdAt and updatedAt
  },
  {
    timestamps: true, 
  }
);

// Optional: Add a compound index to prevent duplicate entries for the same user and query
// within a short period, or to ensure uniqueness if desired.
// For now, we'll allow duplicates to simply record every search.
// searchHistorySchema.index({ userId: 1, query: 1 }, { unique: false });

// Optional: Add a TTL index to automatically delete old search history entries
// For example, to delete entries older than 90 days:
// searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);