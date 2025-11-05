// Middleware/requestContext.js
import { createNamespace } from "cls-hooked";
import { v4 as uuidv4 } from "uuid";

const session = createNamespace("request");

export const requestContextMiddleware = (req, res, next) => {
  session.run(() => {
    const requestId = uuidv4();
    session.set("requestId", requestId);
    req.requestId = requestId; // attach to req for controllers
    next();
  });
};

export const getRequestId = () => session.get("requestId");
