import { User } from '../Models/user.model.js';
import { Order } from '../Models/Order.model.js'; // To aggregate order data
import catchErrors from '../Utils/catchErrors.js';
import { getAllCustomersParamsSchema } from '../Schemas/customerSchema.js';
import mongoose from 'mongoose';

/**
 * @description Get all customers (users with role 'user') with pagination, search, and filters.
 * Includes aggregated data for total orders and total spent.
 */
export const getAllCustomers = catchErrors(async (req, res) => {
  const { page, limit, searchTerm, statusFilter, sortBy, sortOrder } = getAllCustomersParamsSchema.parse(req.query);

  const skip = (page - 1) * limit;

  const pipeline = [];

  // Initial match for users with role 'user'
  pipeline.push({
    $match: {
      role: 'user',
    },
  });

  // Add search term filter
  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm, 'i');
    pipeline.push({
      $match: {
        $or: [
          { userName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
        ],
      },
    });
  }

  // Lookup orders to calculate total orders and total spent
  pipeline.push({
    $lookup: {
      from: 'orders', // The collection name for Order model
      localField: '_id',
      foreignField: 'userId',
      as: 'customerOrders',
    },
  });

  // Add fields for totalOrders and totalSpent
  pipeline.push({
    $addFields: {
      totalOrders: { $size: '$customerOrders' },
      totalSpent: { $sum: '$customerOrders.totalAmount' },
    },
  });

  // Add status filter based on derived fields
  if (statusFilter && statusFilter !== 'All') {
    if (statusFilter === 'VIP') {
      pipeline.push({ $match: { totalSpent: { $gt: 2000 } } });
    } else if (statusFilter === 'New') {
      pipeline.push({ $match: { totalOrders: 0 } });
    } else if (statusFilter === 'Potential') {
      pipeline.push({ $match: { totalSpent: { $lt: 100 }, totalOrders: { $gt: 0 } } });
    } else if (statusFilter === 'Active') {
      pipeline.push({ $match: { totalOrders: { $gt: 0 }, totalSpent: { $gte: 100 } } });
    } else if (statusFilter === 'Inactive') {
      pipeline.push({ $match: { lastLogin: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, totalOrders: { $gt: 0 } } }); // Last login older than 30 days
    }
  }

  // Count total documents before pagination
  const countPipeline = [...pipeline];
  countPipeline.push({ $count: 'total' });
  const totalResult = await User.aggregate(countPipeline);
  const totalCustomers = totalResult.length > 0 ? totalResult[0].total : 0;

  // Add sorting, skip, and limit for pagination
  const sortStage = {};
  if (sortBy === 'totalOrders') {
    sortStage.totalOrders = sortOrder === 'asc' ? 1 : -1;
  } else if (sortBy === 'totalSpent') {
    sortStage.totalSpent = sortOrder === 'asc' ? 1 : -1;
  } else {
    sortStage[sortBy] = sortOrder === 'asc' ? 1 : -1;
  }

  pipeline.push(
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        password: 0, // Exclude password
        customerOrders: 0, // Exclude raw order data
      },
    }
  );

  const customers = await User.aggregate(pipeline);

  res.status(200).json({
    success: true,
    data: customers,
    totalCustomers,
    nextPage: totalCustomers > skip + customers.length ? page + 1 : null,
  });
});

/**
 * @description Get customer growth data over a specified time period for charting.
 */
export const getCustomerGrowthOverTime = catchErrors(async (req, res) => {
  const { period = '30days' } = req.query; // '7days', '30days', '1year'

  let startDate = new Date();
  let groupByFormat;

  switch (period) {
    case '7days':
      startDate.setDate(startDate.getDate() - 7);
      groupByFormat = '%Y-%m-%d'; // Group by day
      break;
    case '30days':
      startDate.setDate(startDate.getDate() - 30);
      groupByFormat = '%Y-%m-%d'; // Group by day
      break;
    case '1year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      groupByFormat = '%Y-%m'; // Group by month
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
      groupByFormat = '%Y-%m-%d';
      break;
  }

  const customerGrowthData = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        role: 'user', // Only count regular users
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: groupByFormat, date: '$createdAt' } },
        newCustomers: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 }, // Sort by date
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        newCustomers: 1,
      },
    },
  ]);

  res.status(200).json({ success: true, data: customerGrowthData });
});