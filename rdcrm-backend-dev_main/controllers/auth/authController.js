import jwt from "jsonwebtoken";
import userModel from "../../models/users/userModel.js";
import { comparePassword } from "../../helpers/auth.js";
import { generateSignedUrl } from "../../helpers/r2helper.js";
import { v4 as uuidv4 } from "uuid";


export const loginController = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const user = await userModel.findOne({ username }).populate("role").populate("department_id");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "User is not active. Please contact support." });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const newUuid = uuidv4();
    await userModel.updateOne(
      { _id: user._id },
      { $set: { uuid: newUuid } }
    );

    let signedImage = user.image;
    if (user.image) {
      try {
        signedImage = await generateSignedUrl(user.image, 86400);
      } catch (err) {
        console.error("Error generating signed URL for image:", user.image, err);
      }
    }



    const token = jwt.sign(
      {
        id: user.id,
        uuid: newUuid,
        username: user.username,
        name: user.name,
        role: user.role?.name,
        is_head: user.is_head,
        permission: user.role?.permission,
        image: signedImage || "",
        _id: user._id,
        is_pricing_specialist: user.is_pricing_specialist,
        department_id: user.department_id?._id,
        department_name: user.department_id?.name,
        only_profile: user.only_profile,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        _id: user._id,
        id: user.id,
        name: user.name,
        role: user.role?.name,
        permission: user.role?.permission,
        is_pricing_specialist: user.is_pricing_specialist,
        is_head: user.is_head,
        department_id: user.department_id?._id,
        department_name: user.department_id?.name,
        only_profile: user.only_profile,
      },
      token,
    });
  } catch (err) {
    console.error("Login Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again later.",
    });
  }
};





export const sessionService = async (req, res) => {
  try {
    const { Id, uuID } = req.body;

    console.log("req.body", req.body)

    if (!Id || !uuID) {
      return res.status(400).json({ status: false, message: "Missing required fields" });
    }

    const user = await userModel.findOne({
      id: Id,
      uuid: uuID,
    });

    if (user) {
      return res.json({ status: true, message: "Valid User" });
    } else {
      return res.json({ status: false, message: "User not found" });
    }

  } catch (error) {
    console.error("Error in sessionService:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
