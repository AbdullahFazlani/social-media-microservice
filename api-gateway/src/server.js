import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import Redis from "ioredis";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import logger from "./utils/logger.js";
import proxy from "express-http-proxy";
import errorHandler from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

app.use(helmet());
app.use(express.json());
app.use(cors());

const rateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 50, // limit each IP to 50 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later",
    });
  },
});

app.use(rateLimiter);

app.use((req, res, next) => {
  logger.info("Request received", { method: req.method, url: req.url });
  logger.info("Request body", { body: req.body });
  next();
});

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHAndler: (err, res, next) => {
    logger.error("Proxy error", { error: err.message });
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  },
};

app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info("Response from identity service", {
        statusCode: proxyRes.statusCode,
      });
      return proxyResData;
    },
  })
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(
    `Proxying requests to identity service at ${process.env.IDENTITY_SERVICE_URL}`
  );
  logger.info(`Redis connected at ${process.env.REDIS_URL}`);
});
