import catchErrors from '../Utils/catchErrors.js';

export const requireAdmin = catchErrors(async (req, res, next) => {
  // requireAuth middleware should have already populated req.user
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden - Admin access required.' });
  }
  next();
});