import mongoose from "mongoose";
import argon2 from "argon2";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving the user
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await argon2.hash(this.password);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to verify password
userSchema.methods.verifyPassword = async function (password) {
  try {
    return await argon2.verify(this.password, password);
  } catch (err) {
    throw new Error("Password verification failed");
  }
};

userSchema.index({ username: "text" });
const User = mongoose.model("User", userSchema);

export default User;
