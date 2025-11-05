import { SearchHistory } from '../Models/SearchHistory.model.js';
import catchErrors from '../Utils/catchErrors.js';
import { createSearchHistorySchema, getSearchHistoryParamsSchema } from '../Schemas/searchHistorySchema.js';
import mongoose from 'mongoose';
import trackEvent from '../Utils/metaRank.js'

/**
 * @description Record a new search query for the authenticated user.
 */
export const recordSearch = catchErrors(async (req, res) => {
  const userId = req.userId; // From requireAuth middleware
  const { query } = req.body;

  // Validate the incoming query
  const validatedData = createSearchHistorySchema.parse({ userId, query });

  const searchRecord = await SearchHistory.create(validatedData);
  await trackEvent({
    event: 'search',
    user: userId,
    item: `query:${query}`, // prefix helps avoid collisions with real products
    timestamp: Date.now(),
  });

  res.status(201).json({ success: true, message: 'Search recorded successfully!', searchRecord });
});

/**
 * @description Get the search history for the authenticated user.
 * Supports pagination, filtering by search term, and sorting.
 */
export const getSearchHistory = catchErrors(async (req, res) => {
  const userId = req.userId; // From requireAuth middleware

  // Validate and parse query parameters
  const { page, limit, searchTerm, sortBy, sortOrder } = getSearchHistoryParamsSchema.parse(req.query);

  const skip = (page - 1) * limit;

  const matchStage = { userId: new mongoose.Types.ObjectId(userId) };

  if (searchTerm) {
    matchStage.query = { $regex: searchTerm, $options: 'i' }; // Case-insensitive search
  }

  const sortStage = {};
  sortStage[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const searchHistory = await SearchHistory.find(matchStage)
    .sort(sortStage)
    .skip(skip)
    .limit(limit);

  const totalSearches = await SearchHistory.countDocuments(matchStage);

  res.status(200).json({
    success: true,
    searchHistory,
    totalSearches,
    nextPage: totalSearches > skip + searchHistory.length ? page + 1 : null,
  });
});

/**
 * @description Clear all search history for the authenticated user.
 */
export const clearSearchHistory = catchErrors(async (req, res) => {
  const userId = req.userId; // From requireAuth middleware

  await SearchHistory.deleteMany({ userId });

  res.status(200).json({ success: true, message: 'Search history cleared successfully!' });
});