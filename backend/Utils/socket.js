// src/Utils/socket.js
import { Server as IOServer } from "socket.io";

let io = null;

export function initSocket(server, opts = {}) {
  if (io) return io;
  io = new IOServer(server, {
    cors: {
      origin: opts.corsOrigin || "*", // tighten for prod
      methods: ["GET", "POST"],
    },
    // pingTimeout / pingInterval can be tuned for your infra
  });
  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    // optional: join product room from client event
    socket.on("joinProduct", (productId) => {
      if (!productId) return;
      socket.join(`product:${productId}`);
      console.log(socket.id, "joined product:", productId);
    });

    socket.on("leaveProduct", (productId) => {
      socket.leave(`product:${productId}`);
    });

    socket.on("disconnect", () => {
      // handle if needed
    });
  });

  return io;
}

// Helper to broadcast to a product room
export function notifyProduct(productId, payload) {
  if (!io) {
    console.warn("notifyProduct called before socket initialized");
    return;
  }
  io.to(`product:${productId}`).emit("imageStatus", payload);
  console.log(payload)
}

// For direct emits to all clients (if needed)
export function emitGlobal(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

export function getIo() {
  return io;
}
