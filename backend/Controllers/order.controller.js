import { Order } from '../Models/Order.model.js';
import { Cart } from '../Models/Cart.model.js';
import { Product } from '../Models/Product.model.js';
import { Counter } from '../Models/Counter.model.js';
import { User } from '../Models/user.model.js'; // Import User model
import catchErrors from '../Utils/catchErrors.js';
import { createOrderSchema, updateOrderStatusSchema } from '../Schemas/orderSchema.js';
import mongoose from 'mongoose';
import { publishToQueue } from '../Utils/lavinmqClient.js';
import { logger } from '../Utils/logger.js';

// Helper function to get the next sequential value
async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, runValidators: true }
  );
  return sequenceDocument.seq;
}

/**
 * @description Create a new order from the user's cart.
 * This is a critical endpoint that handles stock management and transactional integrity.
 */
export const createOrder = catchErrors(async (req, res) => {
  console.log("create order")
  const userId = req.userId;

  // 1. Validate incoming request body
  const { shippingAddress, paymentMethod } = createOrderSchema.parse(req.body);

  // 2. Fetch the user's current cart
  const cart = await Cart.findOne({ userId });

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ success: false, message: 'Your cart is empty.' });
  }

  // --- IMPORTANT: Removed transaction logic for standalone MongoDB compatibility ---
  // For a production-grade application, you should configure MongoDB as a replica set
  // and re-enable transactions to ensure atomicity.

  let totalAmount = 0;
  const orderItems = [];
  const productUpdates = [];

  // 3. Validate stock and prepare order items
  for (const cartItem of cart.items) {
    const product = await Product.findById(cartItem.productId);
    if (!product) {
      throw new Error(`Product with ID ${cartItem.productId} not found.`);
    }

    const variant = product.variants.id(cartItem.variantId);
    if (!variant) {
      throw new Error(`Product variant with ID ${cartItem.variantId} not found for product ${product.name}.`);
    }

    if (variant.stock < cartItem.quantity) {
      throw new Error(`Not enough stock for ${product.name} (${variant.size} / ${variant.color}). Available: ${variant.stock}, Requested: ${cartItem.quantity}.`);
    }

    // Prepare order item snapshot
    orderItems.push({
      productId: cartItem.productId,
      variantId: cartItem.variantId,
      quantity: cartItem.quantity,
      nameAtTime: cartItem.nameAtTime,
      imageAtTime: cartItem.imageAtTime,
      priceAtTime: cartItem.priceAtTime,
      sizeAtTime: cartItem.sizeAtTime,
      colorAtTime: cartItem.colorAtTime,
    });

    totalAmount += cartItem.priceAtTime * cartItem.quantity;

    // Prepare stock decrement
    productUpdates.push({
      updateOne: {
        filter: { '_id': product._id, 'variants._id': variant._id },
        update: { $inc: { 'variants.$.stock': -cartItem.quantity } },
      },
    });
  }

  // 4. Decrement product stock
  if (productUpdates.length > 0) {
    // Note: Without a session, this is not atomic with order creation.
    // If the server crashes between this and order.save(), inconsistencies can occur.
    await Product.bulkWrite(productUpdates);
  }

  // 5. Generate sequential order number
  const orderNumber = await getNextSequenceValue('orderId');

  // 6. Create the new order
  const order = new Order({
    userId,
    orderNumber, // Assign the generated sequential number
    items: orderItems,
    shippingAddress,
    paymentMethod,
    totalAmount,
    status: 'Pending', // Initial status
  });
  await order.save();

  // 7. Clear the user's cart
  cart.items = [];
  await cart.save();
  try {
    const job = {
      to:  req.user?.email ,// ensure you have user's email available on req or user object
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
      },
    };
    // publish; we don't await to keep request fast, but we will await and log any publish error
    await publishToQueue( 'order_emails', job);
    console.log('[createOrder] published order email job for order', order._id);
  } catch (err) {
    console.error('[createOrder] failed to publish order email job', err);
    // don't fail the request — log and continue
  }
  res.status(201).json({ success: true, message: 'Order placed successfully!', order });
});

/**
 * @description Get all orders for the admin panel with pagination, search, and sorting.
 */
export const getAllOrders = catchErrors(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const { searchTerm, statusFilter, sortBy, sortOrder } = req.query;

  const matchStage = {};

  // Apply status filter
  if (statusFilter && statusFilter !== 'All') {
    matchStage.status = statusFilter;
  }

  // Apply search term (by order number, customer name, or product name in items)
  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm, 'i'); // Case-insensitive search
    matchStage.$or = [
      { orderNumber: parseInt(searchTerm) || 0 }, // Search by order number if it's a number
      { 'shippingAddress.fullName': searchRegex },
      { 'items.nameAtTime': searchRegex },
    ];
  }

  const sortStage = {};
  if (sortBy === 'date') {
    sortStage.createdAt = sortOrder === 'asc' ? 1 : -1;
  } else if (sortBy === 'total') {
    sortStage.totalAmount = sortOrder === 'asc' ? 1 : -1;
  } else {
    sortStage.createdAt = -1; // Default sort
  }

  const orders = await Order.find(matchStage)
    .populate({
      path: 'userId',
      select: 'userName email' // Populate user details
    })
    .sort(sortStage)
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments(matchStage);

  res.status(200).json({
    success: true,
    data: orders,
    totalOrders,
    nextPage: totalOrders > skip + orders.length ? page + 1 : null,
  });
});

/**
 * @description Get all orders for the authenticated user.
 */
export const getUserOrders = catchErrors(async (req, res) => {
  const userId = req.userId;
  const orders = await Order.find({ userId })
    .populate({
      path: 'items.productId',
      select: 'name imageUrls' // Populate minimal product details for display
    })
    .sort({ createdAt: -1 }); // Latest orders first

  res.status(200).json({ success: true, orders });
});

/**
 * @description Get a single order by its ID for the authenticated user.
 */
export const getOrderById = catchErrors(async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID format.' });
  }

  const order = await Order.findOne({ _id: id, userId })
    .populate({
      path: 'items.productId',
      select: 'name imageUrls'
    });

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found or you do not have permission to view it.' });
  }

  res.status(200).json({ success: true, order });
});

/**
 * @description Update the status of an order (Admin only, or specific transitions).
 * For a production app, this would have robust authorization checks.
 */
export const updateOrderStatus = catchErrors(async (req, res) => {
  const { id } = req.params;
  const { status } = updateOrderStatusSchema.parse(req.body);
  const userId = req.userId;
  const userRole = req.user.role;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID format.' });
  }

  // Build the query conditionally:
  const query = userRole === 'admin' ? { _id: id } : { _id: id, userId };

  const order = await Order.findOneAndUpdate(
    query,
    { status },
    { new: true, runValidators: true }
  );

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found or you do not have permission to update it.',
    });
  }
  try {
    // Ensure we have the user's email (populate if not present)
    let userEmail = req.user.email;
  
      // order.userId may already be populated in getAllOrders path, but not here; fetch minimal
      const u = await User.findById(order.userId)
      userEmail = u?.email;
    
  
    const job = {
      to: userEmail,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        items: order.items,
        shippingAddress: order.shippingAddress,
        updatedAt: new Date(),
      },
      // optional metadata for email:
     
    };
  
    // Publish to status-email queue (non-blocking, but await so we can log)
    await publishToQueue( 'order_status_emails', job);
    logger.info('[updateOrderStatus] published order status email job', { orderId: order._id, to: userEmail });
  } catch (err) {
    // Fail silently for user flow: log and continue
    logger.error('[updateOrderStatus] failed to publish order status email job', { error: err?.message || err, orderId: order._id });
  }
  res.status(200).json({
    success: true,
    message: 'Order status updated successfully.',
    order,
  });
});


/**
 * @description Get order metrics for the admin dashboard.
 */
export const getOrderMetrics = catchErrors(async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const totalRevenueResult = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' } } }, // Only count non-cancelled orders for revenue
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

  const totalCustomers = await User.countDocuments({ role: 'user' });
  const totalProducts = await Product.countDocuments();

  // Simplified growth metrics for now (can be expanded with more complex logic)
  const revenueGrowth = 12.5; 
  const ordersGrowth = 8.2; 
  const customersGrowth = -2.3; 
  const productsGrowth = 5.1; 

  const statusCounts = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'userName');

  res.status(200).json({
    success: true,
    totalOrders,
    totalRevenue,
    revenueGrowth,
    ordersGrowth,
    totalCustomers,
    customersGrowth,
    totalProducts,
    productsGrowth,
    statusCounts,
    recentOrders
  });
});

/**
 * @description Get sales data over a specified time period for charting.
 */
export const getSalesDataOverTime = catchErrors(async (req, res) => {
  const { period = '30days' } = req.query; // '7days', '30days', '90days', '1year'

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
    case '90days':
      startDate.setDate(startDate.getDate() - 90);
      groupByFormat = '%Y-%m-%W'; // Group by week
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

  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $ne: 'Cancelled' }, // Only count non-cancelled orders
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
      $sort: { _id: 1 }, // Sort by date
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        revenue: '$totalRevenue',
        orders: '$totalOrders',
      },
    },
  ]);

  res.status(200).json({ success: true, data: salesData });
});

/**
 * @description Get top-selling products based on total revenue or quantity sold.
 */
export const getTopSellingProducts = catchErrors(async (req, res) => {
  const { limit = 5, sortBy = 'revenue' } = req.query; // sortBy: 'revenue' or 'quantity'

  const sortField = sortBy === 'quantity' ? 'totalSales' : 'totalRevenue';

  const topProducts = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        totalSales: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.priceAtTime'] } },
        productName: { $first: '$items.nameAtTime' },
        productImage: { $first: '$items.imageAtTime' },
      },
    },
    {
      $sort: { [sortField]: -1 }, // Sort by totalRevenue or totalSales descending
    },
    { $limit: parseInt(limit) },
    {
      $project: {
        _id: 1,
        name: '$productName',
        imageUrls: ['$productImage'], // Format as array for consistency with Product type
        totalSales: 1,
        totalRevenue: 1,
      },
    },
  ]);
       
  res.status(200).json({ success: true, data: topProducts });
});