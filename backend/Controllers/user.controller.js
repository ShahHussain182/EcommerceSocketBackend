import { User } from '../Models/user.model.js';
import { Order } from '../Models/Order.model.js';     // Import Order model
import { Cart } from '../Models/Cart.model.js';       // Import Cart model
import { Wishlist } from '../Models/Wishlist.model.js'; // Import Wishlist model
import { Review } from '../Models/Review.model.js';     // Import Review model
import catchErrors from '../Utils/catchErrors.js';
import { updateUserSchema } from '../Schemas/authSchema.js';
import mongoose from 'mongoose';

// ... (other controller functions: getAllUsers, getUserById, updateUserProfileByAdmin) ...
/**
 * @description Get all users (customers) for admin panel.
 * This reuses the existing getAllCustomers logic from customer.controller.js for consistency.
 * It's placed here to keep user-related admin functions together.
 */
export const getAllUsers = async (req, res, next) => {
  // Delegate to the existing customer controller function
  // We need to import it to avoid duplication
  const customerController = await import('./customer.controller.js');
  return customerController.getAllCustomers(req, res, next);
};

/**
 * @description Get a single user by ID (Admin only).
 */
export const getUserById = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
  }

  const user = await User.findById(id).select('-password'); // Exclude password

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  res.status(200).json({ success: true, data: user });
});

/**
 * @description Update a user's profile information (Admin only).
 * This is an admin version of the user's own profile update endpoint.
 */
export const updateUserProfileByAdmin = catchErrors(async (req, res) => {
  const { id } = req.params; // Customer ID from URL
  const updates = updateUserSchema.parse(req.body);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  // Handle unique constraint checks for email, userName, phoneNumber
  // These checks ensure the new values are not already taken by another user
  if (updates.email && updates.email !== user.email) {
    const emailExists = await User.findOne({ email: updates.email, _id: { $ne: id } });
    if (emailExists) {
      return res.status(400).json({ success: false, message: 'Email already in use by another user.' });
    }
    user.email = updates.email;
    // Note: Changing email might require re-verification in a real app
    
  }

  if (updates.userName && updates.userName !== user.userName) {
    const userNameExists = await User.findOne({ userName: updates.userName, _id: { $ne: id } });
    if (userNameExists) {
      return res.status(400).json({ success: false, message: 'Username already in use by another user.' });
    }
    user.userName = updates.userName;
  }

  if (updates.phoneNumber && updates.phoneNumber !== user.phoneNumber) {
    const phoneNumberExists = await User.findOne({ phoneNumber: updates.phoneNumber, _id: { $ne: id } });
    if (phoneNumberExists) {
      return res.status(400).json({ success: false, message: 'Phone number already in use by another user.' });
    }
    user.phoneNumber = updates.phoneNumber;
  }

  // Save the updated user, bypassing password hashing if only profile fields are changed
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Customer profile updated successfully.',
    data: user.pomitPassword(), // Return updated user without password
  });
});

/**
 * @description Delete a user (Admin only).
 */
export const deleteUserByAdmin = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findByIdAndDelete(id, { session });

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Delete associated data within the transaction
    // Using Promise.all for concurrent deletion, but awaited within the transaction
    await Promise.all([
      Order.deleteMany({ userId: id }, { session }),
      Cart.deleteMany({ userId: id }, { session }),
      Wishlist.deleteMany({ userId: id }, { session }),
      Review.deleteMany({ userId: id }, { session }),
      // If you have other user-related models (e.g., SearchHistory), add their deletions here:
      // SearchHistory.deleteMany({ userId: id }, { session }),
    ]);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Customer and all associated data deleted successfully.' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error deleting user and associated data:', error);
    res.status(500).json({ success: false, message: 'An error occurred while deleting the user and associated data.' });
  }
});