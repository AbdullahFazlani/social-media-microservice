import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import logger from "../utils/Logger.js";
import { validateRegistration } from "../utils/validation.js";

// register user
export const registerUser = async (req, res) => {
  logger.info("Registering endpoint hit", { body: req.body });

  try {
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.error("Validation error: %s", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (existingUser) {
      logger.warn("User already exists", { username, email });
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const newUser = new User({
      username,
      email,
      password,
    });
    await newUser.save();
    logger.info("User registered successfully", { id: newUser._id });

    const { accessToken, refreshToken } = await generateToken(newUser);
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error("Error registering user: %s", error.message, {
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
