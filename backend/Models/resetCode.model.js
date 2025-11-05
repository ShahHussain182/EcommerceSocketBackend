import mongoose from "mongoose";


import crypto from "crypto";


const resetCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },

  expiresAt: {
    type: Date,
    required: true,
  },

  code: {
    type: String,
    default:crypto.randomBytes(20).toString("hex")
  },
});





export const ResetCode = mongoose.model("ResetCode", resetCodeSchema);