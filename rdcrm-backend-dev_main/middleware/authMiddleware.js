import jwt from "jsonwebtoken";
import userModel from "../models/users/userModel.js";

// export const requireSignIn = async (req, res, next) => {

//   try {
//     const decoded = jwt.verify(
//       req.headers.authorization,
//       process.env.JWT_SECRET,
//     );
//     req.user = decoded;
//     next();
//   } catch (error) {
//     console.error("JWT verification failed:", error);
//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired token",
//     });
//   }
// };

export const requireSignIn = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing or malformed",
      });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is active
    const user = await userModel.findOne({ _id: decoded._id });
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "User is not active or valid",
      });
    }

    req.user = {
      ...decoded,
      email: user.email || decoded.email || "",
      email_app_password: user.email_app_password || "",
    };
    req.userDoc = user;
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 1) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized Access",
      });
    }

    next();
  } catch (error) {
    console.error("Error in admin middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while checking admin access",
      error: error.message,
    });
  }
};
