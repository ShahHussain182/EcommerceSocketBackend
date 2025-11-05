// Middleware/errorHandler.js
import { z } from "zod";
import { logger } from "../Utils/logger.js";// ✅ use shared logger
import { getRequestId } from "../Utils/requestContext.js";

// ----------------- Zod Error Handler -----------------
const handleZodError = (res, error) => {
  const errorsMap = new Map();

  error.issues.forEach((err) => {
    const field = err.path.join(".");
    if (!errorsMap.has(field)) {
      errorsMap.set(field, {
        message: err.message,
        path: err.path,
      });
    }
  });

  const errors = Array.from(errorsMap.values());

  res.status(400).json({
    status: "fail",
    message: "Validation Error",
    errors,
  });
};

// ----------------- Global Error Handler -----------------
const errorHandler = (error, req, res, next) => {
  const requestId = getRequestId();
  logger.error(`❌ Path: ${req.path} | Error: ${error.message}`, {
    error,
    requestId,
  });

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      status: "error",
      message:
        "Invalid JSON payload received. Please check your request body format.",
    });
  }

  if (error instanceof z.ZodError) {
    return handleZodError(res, error);
  }

  res.status(500).json({
    status: "error",
    requestId, // 🔥 return to client too
    message:
      process.env.NODE_ENV === "development"
        ? error.message || "Internal Server Error"
        : "Internal Server Error",
  });
};

// ----------------- 404 Handler -----------------
const notFoundHandler = (req, res, next) => {
  logger.warn(`404 Not Found - Path: ${req.originalUrl}`);

  res.status(404).json({
    status: "error",
    message: "Route not found",
    errors: [],
  });
};

export { errorHandler, notFoundHandler };
