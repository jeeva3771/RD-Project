import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/users/userModel.js";

export const hashPassword = async (password) => {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.log(error);
    throw new Error("Error occurred while hashing password", { cause: error });
  }
};

export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.log(error);
    throw new Error("Error occurred while comparing passwords", { cause: error });
  }
};

export const getAuthUserFromReq = async (req) => {
  try {
    if (req.user && req.user._id && req.user._id !== "client-gate-public-portal") {
      const user = await userModel.findById(req.user._id).populate("role", "name");
      if (user) {
        return {
          _id: user._id,
          name: user.name || user.username || "Staff",
          role: user.role?.name || (typeof req.user.role === "string" ? req.user.role : "Internal User"),
        };
      }
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded._id) {
        const user = await userModel.findById(decoded._id).populate("role", "name");
        if (user) {
          return {
            _id: user._id,
            name: user.name || user.username || "Staff",
            role: user.role?.name || (typeof decoded.role === "string" ? decoded.role : "Internal User"),
          };
        }
      }
    }
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    // Auth missing or invalid - treating as client
  }
  return null;
};

