import mongoose from "mongoose";
import logger from "./Logger.js";

const connectDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`, {
      service: "identity-service",
    });
  } catch (error) {
    logger.error("MongoDB connection error: %s", error.message);
    console.log("MongoDB connection error: %s", error);
    process.exit(1); // Exit process with failure
  }
};

export default connectDb;
