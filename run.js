import mongoose from "mongoose";
import { User } from "./backend/Models/user.model.js";
import { connectDB } from "./backend/DB/connectDB.js";
import dotenv from "dotenv";
dotenv.config();
const run = async () => {
  await connectDB();
  // adjust pattern to match your placeholder pattern
  const res = await User.updateMany(
    { phoneNumber: { $regex: /^\+0000000000/ } },
    { $unset: { phoneNumber: "" } }
  );
  console.log("Updated users:", res.modifiedCount);
  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });