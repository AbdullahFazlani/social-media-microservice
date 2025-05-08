import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createClient } from "redis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import connectDb from "./utils/connectDb.js";
import AuthRoutes from "./routes/identity-service.js";
import logger from "./utils/Logger.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Connect MongoDB
connectDb();

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => {
  logger.error("Redis connection error: %s", err.message);
  process.exit(1);
});

// Connect Redis and only then start server
redisClient
  .connect()
  .then(() => {
    logger.info("Redis connected");

    // Middleware
    app.use(helmet());
    app.use(express.json());
    app.use(cors());

    app.use((req, res, next) => {
      logger.info("Request received", { method: req.method, url: req.url });
      logger.info("Request body", { body: req.body });
      next();
    });

    // Rate limiter using redis
    // const rateLimiter = new RateLimiterRedis({
    //   storeClient: redisClient,
    //   keyPrefix: "middleware",
    //   points: 10, // 10 requests
    //   duration: 10, // per second
    // });

    // app.use(async (req, res, next) => {
    //   try {
    //     await rateLimiter.consume(req.ip);
    //     next();
    //   } catch {
    //     logger.warn("Too many requests", { ip: req.ip });
    //     res.status(429).json({
    //       success: false,
    //       message: "Too many requests",
    //     });
    //   }
    // });

    // Sensitive endpoint limiter
    const sensitiveRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: "Too many requests from this IP, please try again later",
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      }),
      handler: (req, res) => {
        logger.warn("Sensitive endpoint Rate limit exceeded", { ip: req.ip });
        res.status(429).json({
          success: false,
          message: "Too many requests from this IP, please try again later",
        });
      },
    });

    app.use("/api/auth/register", sensitiveRateLimiter);

    // Routes
    app.use("/api/auth", AuthRoutes);

    // Error handler
    app.use(errorHandler);

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        service: "identity-service",
      });
    });
  })
  .catch((err) => {
    logger.error("Redis failed to connect: %s", err.message);
    process.exit(1);
  });

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err.message, { stack: err.stack });
  process.exit(1);
});
