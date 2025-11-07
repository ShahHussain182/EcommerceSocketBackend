import { ContactMessage } from '../Models/ContactMessage.model.js';
import catchErrors from '../Utils/catchErrors.js';
import mongoose from 'mongoose';

/**
 * @description Get all contact messages with pagination, search, and filtering (Admin only).
 */
export const getAllContactMessages = catchErrors(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const searchTerm = typeof req.query.searchTerm === 'string' ? req.query.searchTerm.trim() : '';
  const matchStage = {};

  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm, 'i');
    matchStage.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { subject: searchRegex },
      { message: searchRegex },
    ];
  }

  const messages = await ContactMessage.find(matchStage)
    .sort({ createdAt: -1 }) // Newest first
    .skip(skip)
    .limit(limit);

  const totalMessages = await ContactMessage.countDocuments(matchStage);

  res.status(200).json({
    success: true,
    messages,
    totalMessages,
    nextPage: totalMessages > skip + messages.length ? page + 1 : null,
  });
});

/**
 * @description Delete a specific contact message (Admin only).
 */
export const deleteContactMessage = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID format.' });
  }

  const result = await ContactMessage.findByIdAndDelete(id);

  if (!result) {
    return res.status(404).json({ success: false, message: 'Contact message not found.' });
  }

  res.status(200).json({ success: true, message: 'Contact message deleted successfully.' });
});