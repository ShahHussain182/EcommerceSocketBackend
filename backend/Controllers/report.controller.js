import { Order } from '../Models/Order.model.js';
import { User } from '../Models/user.model.js';
import { Product } from '../Models/Product.model.js';
import { Review } from '../Models/Review.model.js';
import catchErrors from '../Utils/catchErrors.js';
import {
  salesReportSchema,
  customerReportSchema,
  inventoryReportSchema,
  orderHistoryReportSchema,
  reviewSummaryReportSchema,
} from '../Schemas/reportSchema.js';
import { format } from 'date-fns';
import mongoose from 'mongoose';

// Helper to format data into CSV string
const toCsv = (data, headers) => {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n'; // Just headers if no data
  }

  const csvRows = [];
  csvRows.push(headers.join(',')); // Add header row

  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header] !== undefined && row[header] !== null ? row[header] : '';
      // Handle nested objects for populated fields
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        value = JSON.stringify(value); // Stringify objects
      }
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
};

/**
 * @description Generate Sales Report (CSV)
 */
export const generateSalesReport = catchErrors(async (req, res) => {
  const { period } = salesReportSchema.parse(req.query);

  let startDate = new Date();
  let groupByFormat;
  let fileNameSuffix;

  switch (period) {
    case 'daily':
      startDate.setDate(startDate.getDate() - 30); // Last 30 days for daily
      groupByFormat = '%Y-%m-%d';
      fileNameSuffix = 'Daily';
      break;
    case 'weekly':
      startDate.setDate(startDate.getDate() - 90); // Last ~12 weeks
      groupByFormat = '%Y-%m-%W';
      fileNameSuffix = 'Weekly';
      break;
    case 'monthly':
      startDate.setFullYear(startDate.getFullYear() - 1); // Last 12 months
      groupByFormat = '%Y-%m';
      fileNameSuffix = 'Monthly';
      break;
    case 'yearly':
      startDate.setFullYear(startDate.getFullYear() - 5); // Last 5 years
      groupByFormat = '%Y';
      fileNameSuffix = 'Yearly';
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
      groupByFormat = '%Y-%m-%d';
      fileNameSuffix = 'Daily';
      break;
  }

  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $ne: 'Cancelled' },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: groupByFormat, date: '$createdAt' } },
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $project: {
        _id: 0,
        Date: '$_id',
        TotalRevenue: { $round: ['$totalRevenue', 2] },
        NumberOfOrders: '$totalOrders',
      },
    },
  ]);

  const headers = ['Date', 'TotalRevenue', 'NumberOfOrders'];
  const csv = toCsv(salesData, headers);

  res.header('Content-Type', 'text/csv');
  res.attachment(`SalesReport_${fileNameSuffix}_${format(new Date(), 'yyyyMMddHHmmss')}.csv`);
  res.send(csv);
});

/**
 * @description Generate Customer Report (CSV)
 */
export const generateCustomerReport = catchErrors(async (req, res) => {
  const { type } = customerReportSchema.parse(req.query);

  const pipeline = [
    { $match: { role: 'user' } },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'userId',
        as: 'customerOrders',
      },
    },
    {
      $addFields: {
        totalOrders: { $size: '$customerOrders' },
        totalSpent: { $sum: '$customerOrders.totalAmount' },
      },
    },
  ];

  if (type === 'vip') {
    pipeline.push({ $match: { totalSpent: { $gt: 2000 } } });
  } else if (type === 'new') {
    pipeline.push({ $match: { totalOrders: 0 } });
  } else if (type === 'potential') {
    pipeline.push({ $match: { totalSpent: { $lt: 100 }, totalOrders: { $gt: 0 } } });
  } else if (type === 'inactive') {
    pipeline.push({ $match: { lastLogin: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, totalOrders: { $gt: 0 } } });
  }

  pipeline.push({
    $project: {
      _id: 0,
      Username: '$userName',
      Email: '$email',
      PhoneNumber: '$phoneNumber',
      JoinedDate: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', date: '$createdAt' } },
      LastLogin: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', date: '$lastLogin' } },
      TotalOrders: '$totalOrders',
      TotalSpent: { $round: ['$totalSpent', 2] },
      IsVerified: '$isVerified',
    },
  });

  const customers = await User.aggregate(pipeline);

  const headers = ['Username', 'Email', 'PhoneNumber', 'JoinedDate', 'LastLogin', 'TotalOrders', 'TotalSpent', 'IsVerified'];
  const csv = toCsv(customers, headers);

  res.header('Content-Type', 'text/csv');
  res.attachment(`CustomerReport_${type}_${format(new Date(), 'yyyyMMddHHmmss')}.csv`);
  res.send(csv);
});

/**
 * @description Generate Inventory Report (CSV)
 */
export const generateInventoryReport = catchErrors(async (req, res) => {
  const { type } = inventoryReportSchema.parse(req.query);

  const pipeline = [];

  // Add fields for total stock and min price across variants
  pipeline.push({
    $addFields: {
      totalStock: { $sum: '$variants.stock' },
      minPrice: { $min: '$variants.price' },
    },
  });

  if (type === 'low_stock') {
    pipeline.push({ $match: { totalStock: { $lt: 10, $gt: 0 } } }); // Products with less than 10 total stock, but not 0
  } else if (type === 'top_selling') {
    // This requires joining with orders, which is more complex for a simple inventory report.
    // For now, we'll just get all products and indicate top selling based on a placeholder.
    // In a real app, you'd aggregate from Order items.
    pipeline.push({ $sort: { numberOfReviews: -1 } }); // Placeholder: sort by most reviewed
    pipeline.push({ $limit: 10 }); // Top 10
  }

  pipeline.push({
    $project: {
      _id: 0,
      ProductName: '$name',
      Category: '$category',
      Description: '$description',
      MinPrice: { $round: ['$minPrice', 2] },
      TotalStock: '$totalStock',
      IsFeatured: '$isFeatured',
      AverageRating: { $round: ['$averageRating', 1] },
      NumberOfReviews: '$numberOfReviews',
      Variants: {
        $map: {
          input: '$variants',
          as: 'variant',
          in: {
            $concat: [
              'Size: ', '$$variant.size',
              ', Color: ', '$$variant.color',
              ', Price: $', { $toString: { $round: ['$$variant.price', 2] } },
              ', Stock: ', { $toString: '$$variant.stock' }
            ]
          }
        }
      }
    },
  });

  const products = await Product.aggregate(pipeline);

  const headers = ['ProductName', 'Category', 'Description', 'MinPrice', 'TotalStock', 'IsFeatured', 'AverageRating', 'NumberOfReviews', 'Variants'];
  const csv = toCsv(products, headers);

  res.header('Content-Type', 'text/csv');
  res.attachment(`InventoryReport_${type}_${format(new Date(), 'yyyyMMddHHmmss')}.csv`);
  res.send(csv);
});

/**
 * @description Generate Order History Report (CSV)
 */
export const generateOrderHistoryReport = catchErrors(async (req, res) => {
  orderHistoryReportSchema.parse(req.query); // Validate empty schema

  const orders = await Order.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'customerInfo',
      },
    },
    { $unwind: { path: '$customerInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        OrderNumber: '$orderNumber',
        CustomerName: { $ifNull: ['$customerInfo.userName', '$shippingAddress.fullName'] },
        CustomerEmail: '$customerInfo.email',
        OrderDate: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', date: '$createdAt' } },
        TotalAmount: { $round: ['$totalAmount', 2] },
        Status: '$status',
        PaymentMethod: '$paymentMethod',
        ShippingAddress: {
          $concat: [
            '$shippingAddress.addressLine1',
            { $ifNull: [', ' + '$shippingAddress.addressLine2', ''] },
            ', ', '$shippingAddress.city',
            ', ', '$shippingAddress.state',
            ', ', '$shippingAddress.postalCode',
            ', ', '$shippingAddress.country',
          ],
        },
        Items: {
          $map: {
            input: '$items',
            as: 'item',
            in: {
              $concat: [
                '$$item.nameAtTime',
                ' (', '$$item.sizeAtTime', '/', '$$item.colorAtTime', ')',
                ' x', { $toString: '$$item.quantity' },
                ' @$', { $toString: { $round: ['$$item.priceAtTime', 2] } }
              ]
            }
          }
        }
      },
    },
    { $sort: { OrderDate: -1 } },
  ]);

  const headers = [
    'OrderNumber', 'CustomerName', 'CustomerEmail', 'OrderDate', 'TotalAmount',
    'Status', 'PaymentMethod', 'ShippingAddress', 'Items'
  ];
  const csv = toCsv(orders, headers);

  res.header('Content-Type', 'text/csv');
  res.attachment(`OrderHistoryReport_${format(new Date(), 'yyyyMMddHHmmss')}.csv`);
  res.send(csv);
});

/**
 * @description Generate Review Summary Report (CSV)
 */
export const generateReviewSummaryReport = catchErrors(async (req, res) => {
  reviewSummaryReportSchema.parse(req.query); // Validate empty schema

  const reviews = await Review.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'reviewerInfo',
      },
    },
    { $unwind: { path: '$reviewerInfo', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'productInfo',
      },
    },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        ReviewId: '$_id',
        ProductName: '$productInfo.name',
        ReviewerName: '$reviewerInfo.userName',
        ReviewerEmail: '$reviewerInfo.email',
        Rating: '$rating',
        Title: '$title',
        Comment: '$comment',
        ReviewDate: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', date: '$createdAt' } },
      },
    },
    { $sort: { ReviewDate: -1 } },
  ]);

  const headers = [
    'ReviewId', 'ProductName', 'ReviewerName', 'ReviewerEmail', 'Rating',
    'Title', 'Comment', 'ReviewDate'
  ];
  const csv = toCsv(reviews, headers);

  res.header('Content-Type', 'text/csv');
  res.attachment(`ReviewSummaryReport_${format(new Date(), 'yyyyMMddHHmmss')}.csv`);
  res.send(csv);
});