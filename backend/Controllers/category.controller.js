import { Category } from '../Models/Category.model.js';
import { Product } from '../Models/Product.model.js'; // To check for associated products
import catchErrors from '../Utils/catchErrors.js';
import { createCategorySchema, updateCategorySchema } from '../Schemas/categorySchema.js';
import mongoose from 'mongoose';

/**
 * @description Create a new product category. (Admin only)
 */
export const createCategory = catchErrors(async (req, res) => {
  const categoryData = createCategorySchema.parse(req.body);

  const existingCategory = await Category.findOne({ name: categoryData.name });
  if (existingCategory) {
    return res.status(409).json({ success: false, message: 'Category with this name already exists.' });
  }

  const category = await Category.create(categoryData);

  res.status(201).json({ success: true, message: 'Category created successfully!', category });
});

/**
 * @description Get all product categories. (Public)
 */
export const getAllCategories = catchErrors(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }); // Sort alphabetically

  res.status(200).json({ success: true, categories });
});

/**
 * @description Get a single category by ID. (Public)
 */
export const getCategoryById = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid category ID format.' });
  }

  const category = await Category.findById(id);

  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }

  res.status(200).json({ success: true, category });
});

/**
 * @description Update an existing product category. (Admin only)
 */
export const updateCategory = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid category ID format.' });
  }

  const updates = updateCategorySchema.parse(req.body);

  // Check if new name conflicts with another category
  if (updates.name) {
    const existingCategory = await Category.findOne({ name: updates.name });
    if (existingCategory && !existingCategory._id.equals(id)) {
      return res.status(409).json({ success: false, message: 'Category with this name already exists.' });
    }
  }

  const category = await Category.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }

  res.status(200).json({ success: true, message: 'Category updated successfully!', category });
});

/**
 * @description Delete a product category. (Admin only)
 * IMPORTANT: In a real application, you would handle associated products (e.g., reassign, delete, prevent deletion).
 * For this implementation, we'll prevent deletion if products are still linked.
 */
export const deleteCategory = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid category ID format.' });
  }

  // Check for associated products
  const categoryToDelete = await Category.findById(id);
  if (!categoryToDelete) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }

  const associatedProductsCount = await Product.countDocuments({ category: categoryToDelete.name });
  if (associatedProductsCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete category "${categoryToDelete.name}" because ${associatedProductsCount} product(s) are still assigned to it. Please reassign or delete these products first.`,
    });
  }

  await Category.findByIdAndDelete(id);

  res.status(200).json({ success: true, message: 'Category deleted successfully!' });
});