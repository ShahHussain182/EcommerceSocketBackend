import jwt from "jsonwebtoken";
export const verifyAccessToken = (req, res, next) => {
	const token = req.cookies.AccessToken;
	if (!token) return res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
	try {
		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized - invalid token" });

		req.userId = decoded.userId;
        console.log(decoded.userId)
		next();
	} catch (error) {
		console.log("Error in verifyToken ", error);
        if (error.name === "TokenExpiredError") {
            // Access token expired
            return res.status(401).json({ success: false, message: "Access token expired" });
          } else if (error.name === "JsonWebTokenError") {
            // Invalid token (tampered or wrong secret)
            return res.status(401).json({ success: false, message: "Invalid token" });
          } else {
            // Other JWT-related error
            return res.status(500).json({ success: false, message: "Server error" });
          }
		
	}
};
