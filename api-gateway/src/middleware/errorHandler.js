import logger from "../utils/logger.js";

const errorHandler = (err, req, res, next) => {
  logger.error("Error occurred: %s", err.message, { stack: err.stack });

  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
};

export default errorHandler;
