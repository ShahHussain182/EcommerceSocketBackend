import jwt from "jsonwebtoken";

import redisClient from "./redisClient.js";

export const verifyAccessToken =  (req) =>  {
	const token = req.cookies?.AccessToken || req.headers['authorization']?.replace(/^Bearer\s/i, '');
    if (!token) {
      return { valid: false, status: 401, message: "Unauthorized - no token provided" };
    }
  
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); // Corrected: Use ACCESS_TOKEN_SECRET
      return { valid: true, userId: decoded.userId , sessionId : decoded.sessionId};

		
      
		
	} catch (error) {
		console.log("Error in verifyToken ", error);
    if (error.name === "TokenExpiredError") {
      return { valid: false, status: 401, message: "Access token expired" };
    } else if (error.name === "JsonWebTokenError") {
      return { valid: false, status: 401, message: "Invalid token" };
    } else {
      return { valid: false, status: 500, message: "Server error" };
    }
		
	}
};
export const verifyRefreshToken = async (token) => {
  
  if (!token) {
    return { valid: false, status: 401, message: "Unauthorized - no token provided" };
  }

 

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    return { valid: true, userId: decoded.userId, sessionId: decoded.sessionId };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { valid: false, status: 401, message: "Refresh token expired" };
    } else if (error.name === "JsonWebTokenError") {
      return { valid: false, status: 401, message: "Invalid refresh token" };
    } else {
      return { valid: false, status: 500, message: "Server error" };
    }
  }
};