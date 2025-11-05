import jwt from "jsonwebtoken";
import { User } from "../Models/user.model.js"; // Import the User model
import { logger } from "../Utils/logger.js"; // Import logger

export const requireAuth = async (req, res, next) => {
  const token = req.cookies?.AccessToken || req.headers['authorization']?.replace(/^Bearer\s/i, '');
  
  logger.debug(`[requireAuth] Attempting to authenticate for path: ${req.path}`);
  logger.debug(`[requireAuth] AccessToken from cookies: ${req.cookies?.AccessToken ? 'present' : 'missing'}`);
  logger.debug(`[requireAuth] Authorization header: ${req.headers['authorization'] ? 'present' : 'missing'}`);

  if (!token) {
    logger.warn(`[requireAuth] Unauthorized: No token provided for path: ${req.path}`);
    return res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    logger.debug(`[requireAuth] Token decoded for userId: ${decoded.userId}`);
    
    req.userId = decoded.userId;
    req.sessionId = decoded.sessionId;

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      logger.warn(`[requireAuth] Unauthorized: User not found for userId: ${decoded.userId}`);
      return res.status(401).json({ success: false, message: "Unauthorized - user not found" });
    }
    req.user = user;
    logger.debug(`[requireAuth] User ${user.userName} authenticated.`);

    if (req.session) {
      req.session.touch();
      logger.debug(`[requireAuth] Session ${req.sessionID} touched.`);
    }

    next();
  } catch (error) {
    logger.error(`[requireAuth] Authentication error for path: ${req.path} - ${error.name}: ${error.message}`);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Access token expired" });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    } else {
      // For any other unexpected error, send a generic 500
      return res.status(500).json({ success: false, message: "Server error during authentication" });
    }
  }
};