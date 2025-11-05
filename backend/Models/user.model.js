import mongoose from 'mongoose';
import { compareValue, hashValue } from '../Utils/bcrypt.js';
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now(),
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: String,
    resetPasswordTokenExpiresAt: Date,
   
    
    phoneNumber: {
      type: String,
      required: false,
      unique: true,
      trim: true,
      sparse: true, // allow many docs with absent phoneNumber

    },
    googleId: {
      type: String,
      index: true,
      sparse: true, // allow many docs without googleId
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next){
  if (!this.isModified("password")) {
    return(next);
  }
  this.password = await hashValue(this.password);
  next();
});
userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  if (update.password) {
    update.password = await hashValue(update.password);
    this.setUpdate(update);
  }

  next();
});

userSchema.methods.comparePassword = async function (value) {
  return compareValue(value,this.password)
  
}
userSchema.methods.pomitPassword =  function () {
   const user = this.toObject({ versionKey: false });
  delete user.password;
  return user;
}


export const User =mongoose.model('User',userSchema)